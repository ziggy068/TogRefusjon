"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { normalizeFromManual } from "@/lib/tickets/normalizeTicket";
import { saveTicketForUser } from "@/lib/tickets/firestore";
import { lookupTrainByNumber } from "@/lib/entur/trainLookup";
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

  // Handle train lookup (TR-IM-303)
  const handleTrainLookup = async () => {
    // Validate required fields for lookup
    if (!formData.trainNumber) {
      showToast("Vennligst fyll inn tognummer forst", "error");
      return;
    }

    if (!formData.departureDate) {
      showToast("Vennligst fyll inn avgangsdato forst", "error");
      return;
    }

    setIsLookingUp(true);

    try {
      const result = await lookupTrainByNumber({
        trainNumber: formData.trainNumber,
        serviceDate: formData.departureDate,
      });

      if (!result) {
        showToast(
          `Fant ikke tog ${formData.trainNumber} pa ${formData.departureDate}. Kontroller tognummer og dato.`,
          "error"
        );
        return;
      }

      console.log("[Train Lookup] Found:", result);

      // Extract date and time from ISO timestamps
      const depDateTime = new Date(result.plannedDepartureTime);
      const depDate = depDateTime.toISOString().split("T")[0]; // YYYY-MM-DD
      const depTime = depDateTime.toTimeString().slice(0, 5); // HH:MM

      let arrDate = "";
      let arrTime = "";
      if (result.plannedArrivalTime) {
        const arrDateTime = new Date(result.plannedArrivalTime);
        arrDate = arrDateTime.toISOString().split("T")[0];
        arrTime = arrDateTime.toTimeString().slice(0, 5);
      }

      // Only auto-fill empty fields (don't overwrite user input)
      const updates: Partial<typeof formData> = {};

      // Infer and set operator if not already set
      if (!formData.operator) {
        updates.operator = inferOperator(formData.trainNumber);
      }

      if (!formData.fromStation) {
        updates.fromStation = result.fromStationName;
      }

      if (!formData.toStation) {
        updates.toStation = result.toStationName;
      }

      if (!formData.departureTime) {
        updates.departureDate = depDate;
        updates.departureTime = depTime;
      }

      if (!formData.arrivalDate && arrDate) {
        updates.arrivalDate = arrDate;
      }

      if (!formData.arrivalTime && arrTime) {
        updates.arrivalTime = arrTime;
      }

      setFormData((prev) => ({ ...prev, ...updates }));

      showToast(`Fant tog og fylte inn strekning: ${result.fromStationName} til ${result.toStationName}`, "success");
    } catch (error: any) {
      console.error("[Train Lookup] Error:", error);
      showToast(
        `Kunne ikke soke etter tog: ${error.message}`,
        "error"
      );
    } finally {
      setIsLookingUp(false);
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const user = auth.currentUser;
    if (!user) {
      showToast("Du ma vare innlogget for a legge til billetter", "error");
      router.push("/login");
      return;
    }

    // Validate required fields
    if (!formData.operator || !formData.trainNumber || !formData.departureDate || !formData.departureTime || !formData.fromStation || !formData.toStation) {
      showToast("Vennligst fyll ut alle felter (bruk 'Hent strekning' eller fyll manuelt)", "error");
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

      console.log("[Add Ticket] Saved:", docRef.id);

      showToast("Billett lagret!", "success");

      // Redirect to tickets list after short delay
      setTimeout(() => {
        router.push("/billetter");
      }, 1000);
    } catch (error: any) {
      console.error("[Add Ticket] Error:", error);
      showToast(
        `Kunne ikke lagre billett: ${error.message}`,
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
                    Hent strekning fra tognummer
                  </p>
                  <p className="text-xs text-primary-700 mb-3">
                    Hvis du vet tognummer og dato, kan vi automatisk finne strekning og avgangstid fra Entur.
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

            {/* From & To Stations */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Fra-stasjon (fylles ved oppslag)
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
                  Til-stasjon (fylles ved oppslag)
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
