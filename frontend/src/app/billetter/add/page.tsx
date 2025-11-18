"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { normalizeFromManual } from "@/lib/tickets/normalizeTicket";
import { saveTicketForUser } from "@/lib/tickets/firestore";
import { lookupTrainByNumber, TrainLookupResult } from "@/lib/entur/trainLookup";
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
  const [selectedDeparture, setSelectedDeparture] = useState<TrainLookupResult | null>(null);
  const [selectedFromIndex, setSelectedFromIndex] = useState<number | null>(null);
  const [selectedToIndex, setSelectedToIndex] = useState<number | null>(null);

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

  // Handle input change
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
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

    setIsLookingUp(true);

    try {
      const departures = await lookupTrainByNumber({
        trainNumber: formData.trainNumber,
        serviceDate: formData.departureDate,
      });

      if (departures.length === 0) {
        console.log(`[Lookup] No train found for ${formData.trainNumber} on ${formData.departureDate}`);
        showToast(
          `Fant ikke tog ${formData.trainNumber} på ${formData.departureDate}. Du kan fylle inn feltene manuelt.`,
          "error"
        );
        return;
      }

      console.log(`[Lookup] Found ${departures.length} departures of ${formData.trainNumber}`);

      // Save all departures and reset selection
      setAllDepartures(departures);
      setSelectedDeparture(null);
      setSelectedFromIndex(null);
      setSelectedToIndex(null);

      // Auto-fill operator
      if (!formData.operator) {
        setFormData((prev) => ({ ...prev, operator: inferOperator(formData.trainNumber) }));
      }

      showToast(`Fant ${departures.length} avgang${departures.length > 1 ? 'er' : ''}. Velg en avgang nedenfor.`, "success");
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

  // Handle departure selection (from list of all departures)
  const handleDepartureSelect = (departure: TrainLookupResult) => {
    setSelectedDeparture(departure);
    setSelectedFromIndex(null);
    setSelectedToIndex(null);
    console.log(`[DepartureSelect] Selected: ${departure.fromStationName} → ${departure.toStationName} at ${departure.plannedDepartureTime}`);
  };

  // Handle from-station selection from dropdown
  const handleFromStationSelect = (index: number) => {
    if (!selectedDeparture) return;

    const stop = selectedDeparture.allStops[index];
    setSelectedFromIndex(index);

    // Auto-fill fromStation and departureTime
    setFormData((prev) => ({
      ...prev,
      fromStation: stop.stationName,
      departureDate: stop.departureTime ? stop.departureTime.split("T")[0] : prev.departureDate,
      departureTime: stop.departureTime ? new Date(stop.departureTime).toTimeString().slice(0, 5) : "",
    }));

    console.log(`[StationSelect] From: ${stop.stationName} (index ${index})`);
  };

  // Handle to-station selection from dropdown
  const handleToStationSelect = (index: number) => {
    if (!selectedDeparture) return;

    const stop = selectedDeparture.allStops[index];
    setSelectedToIndex(index);

    // Auto-fill toStation and arrivalTime
    setFormData((prev) => ({
      ...prev,
      toStation: stop.stationName,
      arrivalDate: stop.arrivalTime ? stop.arrivalTime.split("T")[0] : "",
      arrivalTime: stop.arrivalTime ? new Date(stop.arrivalTime).toTimeString().slice(0, 5) : "",
    }));

    console.log(`[StationSelect] To: ${stop.stationName} (index ${index})`);
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

    // Validate required fields
    if (!formData.operator || !formData.trainNumber || !formData.departureDate || !formData.departureTime || !formData.fromStation || !formData.toStation) {
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
    <div className="min-h-screen bg-slate-50 py-8 px-4">
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
            Fyll ut billett-informasjonen manuelt
          </p>
        </div>

        {/* Form */}
        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Operator */}
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Operator (fylles automatisk ved oppslag)
              </label>
              <select
                name="operator"
                value={formData.operator}
                onChange={handleChange}
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
                Tognummer <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="trainNumber"
                value={formData.trainNumber}
                onChange={handleChange}
                required
                placeholder="F.eks. R20, L14, IC801"
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

            {/* Train Lookup Button (TR-IM-303) */}
            <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <span className="text-xl">=</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-primary-900 mb-2">
                    Automatisk utfylling fra Entur
                  </p>
                  <p className="text-xs text-primary-700 mb-3">
                    Vi fyller inn operator, strekning og avgangstid automatisk. Du kan justere feltene etterpaa hvis nodvendig.
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleTrainLookup}
                    disabled={isLookingUp || !formData.trainNumber || !formData.departureDate}
                  >
                    {isLookingUp ? "Soker..." : "Hent strekning"}
                  </Button>
                </div>
              </div>
            </div>

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

            {/* List of all departures found */}
            {allDepartures.length > 0 && !selectedDeparture && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-blue-900 mb-3">
                  Fant {allDepartures.length} avgang{allDepartures.length > 1 ? 'er' : ''} - velg en:
                </h3>
                <div className="space-y-2">
                  {allDepartures.map((departure, idx) => {
                    const depTime = new Date(departure.plannedDepartureTime).toLocaleTimeString("no", { hour: "2-digit", minute: "2-digit" });
                    const arrTime = departure.plannedArrivalTime ? new Date(departure.plannedArrivalTime).toLocaleTimeString("no", { hour: "2-digit", minute: "2-digit" }) : "";

                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleDepartureSelect(departure)}
                        className="w-full text-left px-4 py-3 border-2 border-blue-300 rounded-lg hover:bg-blue-100 hover:border-blue-400 transition flex items-center justify-between group"
                      >
                        <div>
                          <div className="font-semibold text-blue-900">
                            {departure.fromStationName} → {departure.toStationName}
                          </div>
                          <div className="text-sm text-blue-700">
                            Avgang: {depTime}{arrTime && ` • Ankomst: ${arrTime}`}
                          </div>
                          <div className="text-xs text-blue-600 mt-1">
                            {departure.allStops.length} stopp
                          </div>
                        </div>
                        <div className="text-blue-400 group-hover:text-blue-600 transition text-xl">
                          →
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Dropdown for selecting stops from selected departure */}
            {selectedDeparture && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-emerald-900">
                    Velg stopp fra {selectedDeparture.fromStationName} til {selectedDeparture.toStationName}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setSelectedDeparture(null)}
                    className="text-xs text-emerald-700 hover:text-emerald-900 underline"
                  >
                    Velg annen avgang
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* From station dropdown */}
                  <div>
                    <label className="block text-xs font-medium text-emerald-900 mb-2">
                      Fra stasjon
                    </label>
                    <select
                      value={selectedFromIndex ?? ""}
                      onChange={(e) => handleFromStationSelect(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-emerald-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                    >
                      <option value="">-- Velg fra-stasjon --</option>
                      {selectedDeparture.allStops.map((stop, idx) => (
                        <option key={idx} value={idx}>
                          {stop.stationName}
                          {stop.departureTime && ` (avg. ${new Date(stop.departureTime).toLocaleTimeString("no", { hour: "2-digit", minute: "2-digit" })})`}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* To station dropdown */}
                  <div>
                    <label className="block text-xs font-medium text-emerald-900 mb-2">
                      Til stasjon
                    </label>
                    <select
                      value={selectedToIndex ?? ""}
                      onChange={(e) => handleToStationSelect(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-emerald-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                    >
                      <option value="">-- Velg til-stasjon --</option>
                      {selectedDeparture.allStops.map((stop, idx) => (
                        <option key={idx} value={idx}>
                          {stop.stationName}
                          {stop.arrivalTime && ` (ank. ${new Date(stop.arrivalTime).toLocaleTimeString("no", { hour: "2-digit", minute: "2-digit" })})`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* From & To Stations (manual input fallback) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Fra-stasjon {selectedDeparture ? "(eller juster manuelt)" : "(fylles ved oppslag)"}
                </label>
                <input
                  type="text"
                  name="fromStation"
                  value={formData.fromStation}
                  onChange={handleChange}
                  placeholder="F.eks. Oslo S"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Til-stasjon {selectedDeparture ? "(eller juster manuelt)" : "(fylles ved oppslag)"}
                </label>
                <input
                  type="text"
                  name="toStation"
                  value={formData.toStation}
                  onChange={handleChange}
                  placeholder="F.eks. Trondheim S"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

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
                <li>Fyll inn tognummer og dato, klikk "Hent strekning" for automatisk utfylling</li>
                <li>Eller fyll inn alle feltene manuelt hvis du vil</li>
                <li>Ankomsttid, passasjernavn og pris er valgfri</li>
                <li>Du kan ogsa skanne QR-kode pa Billetter-siden</li>
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
