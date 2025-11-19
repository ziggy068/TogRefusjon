"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { normalizeFromManual } from "@/lib/tickets/normalizeTicket";
import { saveTicketForUser } from "@/lib/tickets/firestore";
import { lookupTrainByNumber, TrainLookupResult } from "@/lib/entur/trainLookup";
import { searchStations, getDeparturesFromStation, StationSuggestion, Departure } from "@/lib/entur/stationLookup";
import { useToast } from "@/components/ui/Toast";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import AuthGate from "@/components/AuthGate";

function AddTicketPageContent() {
  const router = useRouter();
  const { showToast, ToastComponent } = useToast();

  // Form state
  const [formData, setFormData] = useState({
    operator: "",
    trainNumber: "",
    departureDate: "",
    departureTime: "",
    arrivalDate: "",
    arrivalTime: "",
    fromStation: "",
    toStation: "",
    passengerName: "",
    seatInfo: "",
    priceNOK: "",
    notes: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);

  // Train lookup results - all departures
  const [allDepartures, setAllDepartures] = useState<TrainLookupResult[]>([]);

  // New flow: Station -> Time -> Station
  const [allStations, setAllStations] = useState<string[]>([]);
  const [selectedFromStation, setSelectedFromStation] = useState<string>("");
  const [availableDepartureTimes, setAvailableDepartureTimes] = useState<Array<{time: string, departure: TrainLookupResult}>>([]);
  const [selectedDepartureTime, setSelectedDepartureTime] = useState<string>("");
  const [selectedDeparture, setSelectedDeparture] = useState<TrainLookupResult | null>(null);
  const [availableToStations, setAvailableToStations] = useState<Array<{name: string, arrivalTime: string}>>([]);

  // Manual station autocomplete
  const [fromStationSuggestions, setFromStationSuggestions] = useState<StationSuggestion[]>([]);
  const [toStationSuggestions, setToStationSuggestions] = useState<StationSuggestion[]>([]);
  const [isSearchingFromStation, setIsSearchingFromStation] = useState(false);
  const [isSearchingToStation, setIsSearchingToStation] = useState(false);
  const [manualDepartures, setManualDepartures] = useState<Departure[]>([]);
  const [isLoadingManualDepartures, setIsLoadingManualDepartures] = useState(false);
  const [selectedFromStationId, setSelectedFromStationId] = useState<string>("");
  const [lastFetchKey, setLastFetchKey] = useState<string>(""); // Track last fetch to prevent duplicates
  const [departureFilter, setDepartureFilter] = useState<string>(""); // Filter departures by train number or destination
  const [isManualMode, setIsManualMode] = useState(false); // Track if user is using manual station selection

  // Keyboard navigation for autocomplete
  const [highlightedFromIndex, setHighlightedFromIndex] = useState(-1);
  const [highlightedToIndex, setHighlightedToIndex] = useState(-1);

  // Common Norwegian operators
  const commonOperators = ["Vy", "SJ Norge", "Go-Ahead Nordic"];

  // Infer operator from train number
  const inferOperator = (trainNumber: string): string => {
    const prefix = trainNumber.charAt(0).toUpperCase();

    switch (prefix) {
      case "R":
      case "L":
      case "F":
        return "Vy";
      case "I": // IC trains
        if (trainNumber.toUpperCase().startsWith("IC")) {
          return "SJ Norge";
        }
        return "Vy";
      case "G": // Go-Ahead
        if (trainNumber.toUpperCase().startsWith("GA")) {
          return "Go-Ahead Nordic";
        }
        return "Ukjent";
      default:
        return "Ukjent";
    }
  };

  // Normalize operator name from Entur API to match our dropdown values
  const normalizeOperatorName = (enturOperator: string): string => {
    const normalized = enturOperator.trim().toLowerCase();

    // Map common variations to our dropdown values
    if (normalized.includes('vy')) {
      return 'Vy';
    }
    if (normalized.includes('sj')) {
      return 'SJ Norge';
    }
    if (normalized.includes('go-ahead') || normalized.includes('go ahead')) {
      return 'Go-Ahead Nordic';
    }

    // If no match, return the original (will show as "Annet")
    return enturOperator;
  };

  // Handle input change
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Helper: Extract all unique stations from all departures
  const extractAllStations = (departures: TrainLookupResult[]): string[] => {
    const stationSet = new Set<string>();
    departures.forEach(dep => {
      dep.allStops.forEach(stop => {
        if (stop.stationName && stop.stationName !== 'Ukjent') {
          stationSet.add(stop.stationName);
        }
      });
    });
    return Array.from(stationSet).sort();
  };

  // Helper: Get all departure times from a specific station (for automatic flow)
  const getDepartureTimesFromStation = (departures: TrainLookupResult[], stationName: string) => {
    const result: Array<{time: string, departure: TrainLookupResult}> = [];

    departures.forEach(dep => {
      const stopAtStation = dep.allStops.find(stop => stop.stationName === stationName);
      if (stopAtStation && stopAtStation.departureTime) {
        result.push({
          time: stopAtStation.departureTime,
          departure: dep
        });
      }
    });

    // Sort by time
    result.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    return result;
  };

  // Helper: Get all stations AFTER a given station in the route
  const getStationsAfter = (departure: TrainLookupResult, fromStationName: string) => {
    const fromIndex = departure.allStops.findIndex(stop => stop.stationName === fromStationName);
    if (fromIndex === -1) return [];

    return departure.allStops
      .slice(fromIndex + 1)
      .filter(stop =>
        stop.stationName &&
        stop.stationName !== 'Ukjent' &&
        stop.stationName !== fromStationName  // Never allow same station as from-station
      )
      .map(stop => ({
        name: stop.stationName,
        arrivalTime: stop.arrivalTime || ''
      }));
  };

  // Handle train lookup (TR-IM-303, TR-IM-304 + dropdown)
  const handleTrainLookup = async () => {
    // Validate required fields for lookup
    if (!formData.trainNumber) {
      showToast("Vennligst fyll inn tognummer først", "error");
      return;
    }

    if (!formData.departureDate) {
      showToast("Vennligst fyll inn avgangsdato først", "error");
      return;
    }

    // Check if fields are already filled - ask for confirmation
    const hasExistingData = formData.fromStation || formData.toStation || formData.departureTime;
    if (hasExistingData) {
      const confirmed = window.confirm(
        "Feltene er allerede fylt inn. Vil du overskrive med nye data fra togsøket?"
      );
      if (!confirmed) {
        return;
      }
    }

    // Use the extracted function
    await performTrainLookup(formData.trainNumber, formData.departureDate);
  };

  // New flow handlers

  // Step 1: Handle from-station selection
  const handleFromStationSelect = (stationName: string) => {
    setSelectedFromStation(stationName);

    // Get all stations that appear AFTER this station in ANY departure
    const toStationsSet = new Set<string>();
    allDepartures.forEach(dep => {
      const fromIndex = dep.allStops.findIndex(stop => stop.stationName === stationName);
      if (fromIndex !== -1) {
        dep.allStops.slice(fromIndex + 1).forEach(stop => {
          if (stop.stationName && stop.stationName !== 'Ukjent') {
            toStationsSet.add(stop.stationName);
          }
        });
      }
    });

    const toStations = Array.from(toStationsSet).map(name => ({ name, arrivalTime: '' }));
    setAvailableToStations(toStations);

    // Reset downstream selections
    setSelectedDepartureTime("");
    setSelectedDeparture(null);
    setAvailableDepartureTimes([]);

    // Update form
    setFormData((prev) => ({ ...prev, fromStation: stationName, toStation: '', departureTime: '', arrivalDate: '', arrivalTime: '' }));

    console.log(`[StationSelect] From: ${stationName}, found ${toStations.length} possible to-stations`);
  };

  // Step 3: Handle departure time selection (now sets arrival time too)
  const handleDepartureTimeSelect = (timeStr: string) => {
    setSelectedDepartureTime(timeStr);

    // Find the departure that matches this time
    const matchingDep = availableDepartureTimes.find(dt => dt.time === timeStr);
    if (!matchingDep) return;

    setSelectedDeparture(matchingDep.departure);

    // Find arrival time at the selected to-station
    const toStop = matchingDep.departure.allStops.find(stop => stop.stationName === formData.toStation);
    const arrTime = toStop?.arrivalTime ? new Date(toStop.arrivalTime) : null;

    // Update form with departure and arrival times
    // Parse time directly from ISO string to avoid timezone conversion issues
    const depDate = timeStr.split("T")[0]; // "2025-11-18"
    const depTimeMatch = timeStr.match(/T(\d{2}:\d{2})/); // Extract "23:46" from "2025-11-18T23:46:00+01:00"
    const depTimeStr = depTimeMatch ? depTimeMatch[1] : "";

    const arrDate = toStop?.arrivalTime ? toStop.arrivalTime.split("T")[0] : "";
    const arrTimeMatch = toStop?.arrivalTime ? toStop.arrivalTime.match(/T(\d{2}:\d{2})/) : null;
    const arrTimeStr = arrTimeMatch ? arrTimeMatch[1] : "";

    const newFormData = {
      departureDate: depDate,
      departureTime: depTimeStr,
      arrivalDate: arrDate,
      arrivalTime: arrTimeStr,
    };

    console.log(`[TimeSelect] Raw times - Departure: ${timeStr}, Arrival: ${toStop?.arrivalTime}`);
    console.log(`[TimeSelect] Setting form data:`, newFormData);

    setFormData((prev) => ({
      ...prev,
      ...newFormData
    }));
  };

  // Step 2: Handle to-station selection (now shows departure times)
  const handleToStationSelect = (stationName: string) => {
    // Update form with to-station
    setFormData((prev) => ({
      ...prev,
      toStation: stationName,
    }));

    console.log(`[StationSelect] Filtering departures from "${selectedFromStation}" to "${stationName}"`);
    console.log(`[StationSelect] Total departures to check:`, allDepartures.length);

    // Find all departures that go from selectedFromStation to stationName
    const relevantDepartures: Array<{time: string, departure: TrainLookupResult}> = [];

    allDepartures.forEach((dep, depIdx) => {
      const fromIndex = dep.allStops.findIndex(stop => stop.stationName === selectedFromStation);
      const toIndex = dep.allStops.findIndex(stop => stop.stationName === stationName);

      console.log(`[StationSelect] Departure ${depIdx + 1}: fromIndex=${fromIndex}, toIndex=${toIndex}`);

      if (fromIndex === -1) {
        console.log(`[StationSelect]   ✗ Doesn't stop at "${selectedFromStation}"`);
        console.log(`[StationSelect]   All stops:`, dep.allStops.map(s => s.stationName).join(' → '));
      } else if (toIndex === -1) {
        console.log(`[StationSelect]   ✗ Doesn't stop at "${stationName}"`);
        console.log(`[StationSelect]   All stops:`, dep.allStops.map(s => s.stationName).join(' → '));
      } else if (fromIndex >= toIndex) {
        console.log(`[StationSelect]   ✗ Wrong direction (from at ${fromIndex}, to at ${toIndex})`);
      } else {
        const fromStop = dep.allStops[fromIndex];
        if (fromStop.departureTime) {
          console.log(`[StationSelect]   ✓ Valid: departure at ${fromStop.departureTime}`);
          relevantDepartures.push({
            time: fromStop.departureTime,
            departure: dep
          });
        } else {
          console.log(`[StationSelect]   ✗ No departure time at ${selectedFromStation}`);
        }
      }
    });

    // Sort by departure time
    relevantDepartures.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    setAvailableDepartureTimes(relevantDepartures);

    console.log(`[StationSelect] ===== SUMMARY =====`);
    console.log(`[StationSelect] To: ${stationName}, found ${relevantDepartures.length} departure times`);
    console.log(`[StationSelect] Departure times:`, relevantDepartures.map(d => d.time));
  };

  // Manual station autocomplete handlers
  const handleFromStationSearch = async (searchTerm: string) => {
    console.log('[FromStationSearch] Called with:', searchTerm, 'length:', searchTerm.trim().length);

    if (searchTerm.trim().length < 2) {
      setFromStationSuggestions([]);
      return;
    }

    setIsSearchingFromStation(true);
    try {
      const suggestions = await searchStations(searchTerm);
      console.log('[FromStationSearch] Found suggestions:', suggestions.length);
      setFromStationSuggestions(suggestions);
    } catch (error: any) {
      console.error('[FromStationSearch] Error:', error);
    } finally {
      setIsSearchingFromStation(false);
    }
  };

  const handleToStationSearch = async (searchTerm: string) => {
    console.log('[ToStationSearch] Called with:', searchTerm, 'length:', searchTerm.trim().length);

    if (searchTerm.trim().length < 2) {
      setToStationSuggestions([]);
      return;
    }

    setIsSearchingToStation(true);
    try {
      const suggestions = await searchStations(searchTerm);
      console.log('[ToStationSearch] Found suggestions:', suggestions.length);
      setToStationSuggestions(suggestions);
    } catch (error: any) {
      console.error('[ToStationSearch] Error:', error);
    } finally {
      setIsSearchingToStation(false);
    }
  };

  // Function to fetch departures when all required fields are set
  const fetchManualDepartures = useCallback(async (fromStationId: string, toStationName: string, date: string) => {
    console.log('[FetchManualDepartures] Fetching with:', { fromStationId, toStationName, date });
    setIsLoadingManualDepartures(true);
    try {
      // Pass toStationName to filter departures to only trains that stop there
      const departures = await getDeparturesFromStation(fromStationId, date, toStationName);
      console.log('[FetchManualDepartures] API returned departures:', departures.length);

      setManualDepartures(departures);

      if (departures.length > 0) {
        showToast(`Fant ${departures.length} avgang${departures.length > 1 ? 'er' : ''} fra ${formData.fromStation} til ${toStationName}`, "success");
      } else {
        showToast(`Ingen avganger funnet fra ${formData.fromStation} til ${toStationName}. Fyll inn tidene manuelt.`, "info");
      }
    } catch (error: any) {
      console.error('[FetchManualDepartures] Error:', error);
      showToast("Kunne ikke hente avganger. Fyll inn tidene manuelt.", "error");
    } finally {
      setIsLoadingManualDepartures(false);
    }
  }, [showToast, formData.fromStation]);

  // Watch for date changes - if we have both stations selected, fetch departures
  // Debounced to avoid too many requests
  useEffect(() => {
    if ((!formData.trainNumber || isManualMode) && selectedFromStationId && formData.toStation && formData.departureDate) {
      // Create unique key to prevent duplicate fetches
      const fetchKey = `${selectedFromStationId}|${formData.toStation}|${formData.departureDate}`;

      if (fetchKey === lastFetchKey) {
        console.log('[useEffect] Already fetched this combination, skipping');
        return;
      }

      console.log('[useEffect] All fields filled, will fetch departures after delay');

      // Debounce: wait 1 second before fetching to avoid spamming API
      const timeoutId = setTimeout(() => {
        setLastFetchKey(fetchKey);
        fetchManualDepartures(selectedFromStationId, formData.toStation, formData.departureDate);
      }, 1000);

      return () => clearTimeout(timeoutId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.departureDate, isManualMode, selectedFromStationId, formData.toStation]);

  const handleSelectFromStation = (station: StationSuggestion) => {
    console.log('[SelectFromStation] Station selected:', station.name, 'ID:', station.id);
    setFormData((prev) => ({ ...prev, fromStation: station.name }));
    setFromStationSuggestions([]);
    setSelectedFromStationId(station.id);
    setHighlightedFromIndex(-1);
    setIsManualMode(true); // User is now in manual mode

    // Clear previous departures when changing from-station
    setManualDepartures([]);

    // Don't fetch here - useEffect will handle it with debouncing
  };

  const handleSelectToStation = async (station: StationSuggestion) => {
    console.log('[SelectToStation] Station selected:', station.name);
    setFormData((prev) => ({ ...prev, toStation: station.name }));
    setToStationSuggestions([]);
    setHighlightedToIndex(-1);
    setIsManualMode(true); // User is now in manual mode

    // Don't fetch here - useEffect will handle it with debouncing
  };

  // Keyboard navigation for from-station
  const handleFromStationKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (fromStationSuggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedFromIndex((prev) =>
          prev < fromStationSuggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedFromIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedFromIndex >= 0 && highlightedFromIndex < fromStationSuggestions.length) {
          handleSelectFromStation(fromStationSuggestions[highlightedFromIndex]);
        }
        break;
      case 'Escape':
        setFromStationSuggestions([]);
        setHighlightedFromIndex(-1);
        break;
    }
  };

  // Keyboard navigation for to-station
  const handleToStationKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (toStationSuggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedToIndex((prev) =>
          prev < toStationSuggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedToIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedToIndex >= 0 && highlightedToIndex < toStationSuggestions.length) {
          handleSelectToStation(toStationSuggestions[highlightedToIndex]);
        }
        break;
      case 'Escape':
        setToStationSuggestions([]);
        setHighlightedToIndex(-1);
        break;
    }
  };

  // Extract train lookup logic for reuse
  const performTrainLookup = async (trainNumber: string, departureDate: string) => {
    setIsLookingUp(true);
    try {
      console.log(`[Lookup] Searching for train ${trainNumber} on date ${departureDate}`);

      const departures = await lookupTrainByNumber({
        trainNumber,
        serviceDate: departureDate,
      });

      console.log(`[Lookup] API returned ${departures.length} departures`);

      // Log first few departures to see what we got
      departures.slice(0, 3).forEach((dep, idx) => {
        console.log(`[Lookup] Departure ${idx + 1}:`, {
          stops: dep.allStops.map(s => s.stationName).join(' → '),
          firstDepartureTime: dep.allStops.find(s => s.departureTime)?.departureTime,
        });
      });

      setAllDepartures(departures);

      const stations = extractAllStations(departures);
      setAllStations(stations);

      // Reset selections
      setSelectedFromStation("");
      setSelectedDepartureTime("");
      setSelectedDeparture(null);
      setAvailableDepartureTimes([]);
      setAvailableToStations([]);

      // Auto-fill operator
      if (!formData.operator) {
        setFormData((prev) => ({ ...prev, operator: inferOperator(trainNumber) }));
      }

      console.log(`[Lookup] Found ${stations.length} unique stations across all departures`);
      showToast(`Fant ${departures.length} avgang${departures.length > 1 ? 'er' : ''} med ${stations.length} stasjoner. Velg fra-stasjon nedenfor.`, "success");
    } catch (error: any) {
      console.error("[Lookup] Error fetching train data:", error);
      showToast(
        "Kunne ikke hente strekning nå. Prøv igjen eller fyll inn manuelt.",
        "error"
      );
    } finally {
      setIsLookingUp(false);
    }
  };

  // Handle form submission (TR-IM-304)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const user = auth.currentUser;
    if (!user) {
      showToast("Du må være innlogget for å legge til billetter", "error");
      router.push("/login");
      return;
    }

    // Validate required fields (trainNumber is optional in manual mode)
    if (!formData.operator || !formData.departureDate || !formData.departureTime || !formData.fromStation || !formData.toStation) {
      showToast("Vennligst fyll ut alle påkrevde felter", "error");
      return;
    }

    setIsSubmitting(true);

    try {
      // Normalize form data
      const ticketInput = normalizeFromManual(
        {
          operator: formData.operator,
          trainNumber: formData.trainNumber,
          departureDate: formData.departureDate,
          departureTime: formData.departureTime,
          arrivalDate: formData.arrivalDate || undefined,
          arrivalTime: formData.arrivalTime || undefined,
          fromStation: formData.fromStation,
          toStation: formData.toStation,
          passengerName: formData.passengerName || undefined,
          seatInfo: formData.seatInfo || undefined,
          priceNOK: formData.priceNOK ? parseFloat(formData.priceNOK) : undefined,
          notes: formData.notes || undefined,
        },
        user.uid
      );

      // Save to Firestore
      const docRef = await saveTicketForUser(user.uid, ticketInput);

      console.log("[Save] Ticket saved successfully:", docRef.id);

      showToast("Billett lagret!", "success");

      // Redirect to tickets list after short delay
      setTimeout(() => {
        router.push("/billetter");
      }, 1000);
    } catch (error: any) {
      console.error("[Save] Error saving ticket:", error);
      showToast(
        "Kunne ikke lagre billett. Prøv igjen.",
        "error"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-300 py-8 px-4">
      {ToastComponent}

      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.push("/billetter")}
            className="text-primary-500 hover:text-primary-700 mb-4 inline-flex items-center gap-2"
          >
            Tilbake til billetter
          </button>
          <h1 className="text-3xl font-bold text-slate-900">Legg til billett</h1>
          <p className="text-slate-600 mt-2">
            Velg stasjoner og avgangstidspunkt
          </p>
        </div>

        {/* Form */}
        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Operator */}
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Operator <span className="text-rose-500">*</span>
              </label>
              <select
                name="operator"
                value={formData.operator}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Velg operator</option>
                {commonOperators.map((op) => (
                  <option key={op} value={op}>
                    {op}
                  </option>
                ))}
                <option value="Annet">Annet</option>
              </select>
            </div>

            {/* Train Number */}
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Tognummer
              </label>
              <input
                type="text"
                name="trainNumber"
                value={formData.trainNumber}
                onChange={handleChange}
                placeholder="Fylles automatisk når du velger avgang"
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Departure Date & Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Dato for avgang <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  name="departureDate"
                  value={formData.departureDate}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Klokkeslett for avgang (fylles ved oppslag)
                </label>
                <input
                  type="time"
                  name="departureTime"
                  value={formData.departureTime}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            {/* Train Lookup Button (TR-IM-303) - REMOVED */}
              {/* <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <span className="text-xl">=</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-primary-900 mb-2">
                    Automatisk utfylling fra Entur
                  </p>
                  <p className="text-xs text-primary-700 mb-3">
                    Vi fyller inn operator, strekning og avgangstid automatisk. Du kan justere feltene etterpå hvis nødvendig.
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleTrainLookup}
                    disabled={isLookingUp || !formData.trainNumber || !formData.departureDate}
                  >
                    {isLookingUp ? "Søker..." : "Hent strekning"}
                  </Button>
                </div>
              </div>
            </div> */}

            {/* Arrival Date & Time (optional) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Dato for ankomst (valgfri)
                </label>
                <input
                  type="date"
                  name="arrivalDate"
                  value={formData.arrivalDate}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Klokkeslett for ankomst (valgfri)
                </label>
                <input
                  type="time"
                  name="arrivalTime"
                  value={formData.arrivalTime}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            {/* Manual Station Input (if no train number OR in manual mode) */}
            {(() => {
              console.log('[RENDER] isManualMode:', isManualMode, 'trainNumber:', formData.trainNumber, 'fromStation:', formData.fromStation, 'toStation:', formData.toStation);
              return null;
            })()}
            {(!formData.trainNumber || isManualMode) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* From Station */}
                <div className="relative">
                  <label className="block text-sm font-medium text-slate-900 mb-2">
                    Fra-stasjon <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="fromStation"
                    value={formData.fromStation}
                    onChange={(e) => {
                      handleChange(e);
                      handleFromStationSearch(e.target.value);
                    }}
                    onKeyDown={handleFromStationKeyDown}
                    placeholder="Begynn å skrive stasjonsnavn..."
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />

                  {/* From station autocomplete */}
                  {fromStationSuggestions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                      {fromStationSuggestions.map((suggestion, idx) => (
                        <button
                          key={suggestion.id}
                          type="button"
                          onClick={() => handleSelectFromStation(suggestion)}
                          className={`w-full text-left px-4 py-3 transition border-b border-slate-200 last:border-b-0 ${
                            idx === highlightedFromIndex
                              ? 'bg-primary-50 border-primary-200'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="font-medium text-slate-900">{suggestion.name}</div>
                          {suggestion.locality && (
                            <div className="text-sm text-slate-600">{suggestion.locality}</div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {isSearchingFromStation && (
                    <div className="absolute right-3 top-11 text-slate-400">
                      Søker...
                    </div>
                  )}
                </div>

                {/* To Station */}
                <div className="relative">
                  <label className="block text-sm font-medium text-slate-900 mb-2">
                    Til-stasjon <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="toStation"
                    value={formData.toStation}
                    onChange={(e) => {
                      handleChange(e);
                      handleToStationSearch(e.target.value);
                    }}
                    onKeyDown={handleToStationKeyDown}
                    placeholder="Begynn å skrive stasjonsnavn..."
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />

                  {/* To station autocomplete */}
                  {toStationSuggestions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                      {toStationSuggestions.map((suggestion, idx) => (
                        <button
                          key={suggestion.id}
                          type="button"
                          onClick={() => handleSelectToStation(suggestion)}
                          className={`w-full text-left px-4 py-3 transition border-b border-slate-200 last:border-b-0 ${
                            idx === highlightedToIndex
                              ? 'bg-primary-50 border-primary-200'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="font-medium text-slate-900">{suggestion.name}</div>
                          {suggestion.locality && (
                            <div className="text-sm text-slate-600">{suggestion.locality}</div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {isSearchingToStation && (
                    <div className="absolute right-3 top-11 text-slate-400">
                      Søker...
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Manual departures list (when stations selected manually) */}
            {(!formData.trainNumber || isManualMode) && manualDepartures.length > 0 && (() => {
              const filteredDepartures = manualDepartures.filter((dep) => {
                if (!departureFilter) return true;
                const search = departureFilter.toLowerCase();
                return (
                  dep.trainNumber.toLowerCase().includes(search) ||
                  dep.destination.toLowerCase().includes(search) ||
                  formData.toStation.toLowerCase().includes(search)
                );
              });

              return (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-green-900 mb-3">
                  Avganger fra {formData.fromStation} til {formData.toStation} ({filteredDepartures.length}{departureFilter && ` av ${manualDepartures.length}`})
                </h3>

                {/* Filter field */}
                <div className="mb-3">
                  <input
                    type="text"
                    placeholder="Søk etter tognummer eller destinasjon..."
                    value={departureFilter}
                    onChange={(e) => setDepartureFilter(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {filteredDepartures.length === 0 ? (
                    <div className="text-center text-sm text-green-700 py-4">
                      Ingen avganger matcher søket
                    </div>
                  ) : (
                    filteredDepartures.map((dep, idx) => (
                    <button
                      key={`${dep.serviceJourneyId}-${idx}`}
                      type="button"
                      onClick={() => {
                        const depTime = new Date(dep.departureTime);

                        const normalizedOperator = normalizeOperatorName(dep.operator);

                        console.log('[DepartureSelected] BEFORE update - isManualMode:', isManualMode);
                        console.log('[DepartureSelected] Filling in:', {
                          trainNumber: dep.trainNumber,
                          operatorFromAPI: dep.operator,
                          normalizedOperator: normalizedOperator,
                          date: dep.departureTime.split("T")[0],
                          time: depTime.toLocaleTimeString("no", { hour: "2-digit", minute: "2-digit" })
                        });
                        console.log('[DepartureSelected] Available operators in dropdown:', commonOperators);

                        // Fill in train number and operator too
                        setFormData((prev) => ({
                          ...prev,
                          trainNumber: dep.trainNumber,
                          operator: normalizedOperator,
                          departureDate: dep.departureTime.split("T")[0],
                          departureTime: depTime.toLocaleTimeString("no", { hour: "2-digit", minute: "2-digit" }),
                          // Keep fromStation and toStation as they are (already set by user)
                        }));

                        // Clear manual departures list after selection
                        setManualDepartures([]);
                        setDepartureFilter('');

                        console.log('[DepartureSelected] AFTER update - isManualMode should still be:', isManualMode);

                        // Scroll to the form section so user sees the filled fields
                        window.scrollTo({ top: 0, behavior: 'smooth' });

                        showToast("Billett-info fylt inn! Fyll inn ankomsttid manuelt.", "success");
                      }}
                      className="w-full text-left px-3 py-2 bg-white border border-green-300 rounded-lg hover:bg-green-50 hover:border-green-500 transition"
                    >
                      <div className="flex justify-between items-start mb-1">
                        <div className="font-bold text-sm text-green-800">
                          {dep.trainNumber} fra {formData.fromStation} → {dep.destination}
                        </div>
                        <div className="text-sm font-medium text-green-900">
                          {new Date(dep.departureTime).toLocaleTimeString('no', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </div>
                      <div className="text-xs text-green-700">
                        {dep.operator}
                        {dep.platform && ` • Spor ${dep.platform}`}
                      </div>
                    </button>
                  ))
                  )}
                </div>
              </div>
              );
            })()}

            {isLoadingManualDepartures && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center">
                <p className="text-sm text-slate-600">Søker etter avganger...</p>
              </div>
            )}

            {/* New flow: Step-by-step selection */}
            {allStations.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-blue-900 mb-4">
                  Velg reise steg-for-steg ({allDepartures.length} avganger funnet)
                </h3>

                {/* Step 1: Select FROM station */}
                <div className="mb-4">
                  <label className="block text-xs font-medium text-blue-900 mb-2">
                    1. Fra stasjon
                  </label>
                  <select
                    value={selectedFromStation}
                    onChange={(e) => handleFromStationSelect(e.target.value)}
                    className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="">-- Velg fra-stasjon --</option>
                    {allStations.map((station, idx) => (
                      <option key={idx} value={station}>
                        {station}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Step 2: Select TO station */}
                {availableToStations.length > 0 && (
                  <div className="mb-4">
                    <label className="block text-xs font-medium text-blue-900 mb-2">
                      2. Til stasjon
                    </label>
                    <select
                      value={formData.toStation}
                      onChange={(e) => handleToStationSelect(e.target.value)}
                      className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="">-- Velg til-stasjon --</option>
                      {availableToStations.map((station, idx) => (
                        <option key={idx} value={station.name}>
                          {station.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Step 3: Select DEPARTURE TIME */}
                {availableDepartureTimes.length > 0 && formData.toStation && (
                  <div className="mb-2">
                    <label className="block text-xs font-medium text-blue-900 mb-2">
                      3. Avgangstid ({selectedFromStation} → {formData.toStation})
                    </label>
                    <select
                      value={selectedDepartureTime}
                      onChange={(e) => handleDepartureTimeSelect(e.target.value)}
                      className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="">-- Velg avgangstid --</option>
                      {availableDepartureTimes.map((dt, idx) => (
                        <option key={idx} value={dt.time}>
                          {new Date(dt.time).toLocaleTimeString("no", { hour: "2-digit", minute: "2-digit" })} (ank. {dt.departure.allStops.find(s => s.stationName === formData.toStation)?.arrivalTime ? new Date(dt.departure.allStops.find(s => s.stationName === formData.toStation)!.arrivalTime!).toLocaleTimeString("no", { hour: "2-digit", minute: "2-digit" }) : "N/A"})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Optional fields */}
            <div className="border-t border-slate-200 pt-6">
              <h3 className="text-sm font-medium text-slate-900 mb-4">
                Tilleggsinformasjon (valgfri)
              </h3>

              <div className="space-y-4">
                {/* Passenger Name */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Passasjernavn
                  </label>
                  <input
                    type="text"
                    name="passengerName"
                    value={formData.passengerName}
                    onChange={handleChange}
                    placeholder="F.eks. Ola Nordmann"
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                {/* Seat Info */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Seteinformasjon
                  </label>
                  <input
                    type="text"
                    name="seatInfo"
                    value={formData.seatInfo}
                    onChange={handleChange}
                    placeholder="F.eks. Vogn 3, sete 42"
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                {/* Price */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Pris (NOK)
                  </label>
                  <input
                    type="number"
                    name="priceNOK"
                    value={formData.priceNOK}
                    onChange={handleChange}
                    placeholder="F.eks. 499"
                    min="0"
                    step="0.01"
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Notater
                  </label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    rows={3}
                    placeholder="Eventuelle notater eller referanser"
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
            </div>

            {/* Submit buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? "Lagrer..." : "Lagre billett"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.push("/billetter")}
                disabled={isSubmitting}
              >
                Avbryt
              </Button>
            </div>
          </form>
        </Card>

        {/* Help card */}
        <Card className="p-4 mt-4 bg-slate-50">
          <div className="flex gap-3">
            <span className="text-xl">Tips</span>
            <div className="text-sm text-slate-600">
              <p className="font-medium text-slate-900 mb-1">Slik bruker du skjemaet</p>
              <ul className="space-y-1 list-disc list-inside">
                <li><strong>Med tognummer:</strong> Fyll inn tognummer og dato → Klikk "Hent strekning" → Velg fra-stasjon → til-stasjon → avgangstid</li>
                <li><strong>Uten tognummer:</strong> Fyll inn avgangsdato → Skriv fra-stasjon og til-stasjon (autocomplete) → Velg fra listen over tilgjengelige avganger</li>
                <li>Du kan også fylle inn avgangstid og ankomsttid manuelt hvis du vil</li>
                <li>Passasjernavn, seteinformasjon og pris er valgfrie felt</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function AddTicketPage() {
  return (
    <AuthGate>
      <AddTicketPageContent />
    </AuthGate>
  );
}
