"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { db, auth, storage } from "@/lib/firebase";
import { doc, deleteDoc } from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import AuthGate from "@/components/AuthGate";

interface Ticket {
  id: string;
  opprettet: string;
  dato: string;
  klokkeslett: string;
  tognummer: string;
  fra: string;
  til: string;
  beskrivelse: string;
  fil: {
    name: string;
    type: string;
    size: number;
    dataURL: string;
  };
  claimStatus?: "none" | "pending" | "submitted" | "approved" | "rejected";
}

function BilletterPageContent() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load tickets from localStorage
    const storageKey = "tr_billetter";
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setTickets(parsed);
      } catch (error) {
        console.error("Error parsing tickets:", error);
      }
    }
    setIsLoading(false);
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Er du sikker på at du vil slette denne billetten?")) {
      return;
    }

    try {
      const user = auth.currentUser;
      const ticket = tickets.find((t) => t.id === id);

      if (!ticket) {
        alert("Kunne ikke finne billetten");
        return;
      }

      // Delete from Firebase if user is logged in
      if (user) {
        try {
          // Delete from Firestore
          const ticketRef = doc(db, `users/${user.uid}/tickets`, id);
          await deleteDoc(ticketRef);
          console.log("✅ Deleted from Firestore:", id);

          // Delete file from Storage if it exists
          if (ticket.fil?.name) {
            const storagePath = `users/${user.uid}/tickets/${id}/${ticket.fil.name}`;
            const storageRef = ref(storage, storagePath);
            try {
              await deleteObject(storageRef);
              console.log("✅ Deleted from Storage:", storagePath);
            } catch (storageError: any) {
              // File might not exist in Storage (old localStorage-only ticket)
              if (storageError.code !== "storage/object-not-found") {
                console.error("Storage deletion error:", storageError);
              }
            }
          }
        } catch (firebaseError) {
          console.error("Firebase deletion error:", firebaseError);
          alert("⚠️ Kunne ikke slette fra Firebase, men fjerner fra lokal liste.");
        }
      }

      // Always remove from localStorage
      const updated = tickets.filter((t) => t.id !== id);
      setTickets(updated);
      localStorage.setItem("tr_billetter", JSON.stringify(updated));
    } catch (error) {
      console.error("Error deleting ticket:", error);
      alert("❌ Feil ved sletting av billett.");
    }
  };

  const handleEdit = (ticket: Ticket) => {
    // Store ticket as draft for editing
    localStorage.setItem("ticketDraft", JSON.stringify(ticket));
    window.location.href = "/billetter/upload";
  };

  const getClaimStatusBadge = (status?: string) => {
    switch (status) {
      case "pending":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            ⏱️ Under behandling
          </span>
        );
      case "submitted":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-primary-50 text-primary-700 border border-primary-200">
            📤 Sendt
          </span>
        );
      case "approved":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            ✅ Godkjent
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
            ❌ Avslått
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
            📋 Aktiv
          </span>
        );
    }
  };

  // Separate tickets by claim status
  const activeTickets = tickets.filter(
    (t) => !t.claimStatus || t.claimStatus === "none"
  );
  const ticketsWithClaims = tickets.filter(
    (t) => t.claimStatus && t.claimStatus !== "none"
  );

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="text-center">Laster billetter...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-300">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Mine billetter</h1>
            <p className="mt-2 text-slate-600">
              Se og administrer dine togbilletter
            </p>
          </div>
          <Link
            href="/billetter/upload"
            className="inline-flex items-center justify-center px-6 py-3 bg-primary-500 text-white rounded-full font-semibold hover:bg-primary-700 transition-colors duration-200 shadow-sm hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
          >
            + Last opp billett
          </Link>
        </div>

      {tickets.length === 0 ? (
        <>
          {/* Empty state */}
          <div className="bg-white rounded-xl shadow-sm p-12">
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-50 rounded-full">
                <span className="text-3xl">🎫</span>
              </div>
              <h2 className="text-xl font-semibold text-slate-900">
                Ingen billetter ennå
              </h2>
              <p className="text-slate-600 max-w-md mx-auto">
                Last opp din første togbillett for å komme i gang med automatisk
                refusjon.
              </p>
              <div className="pt-4 space-y-3">
                <Link
                  href="/billetter/upload"
                  className="inline-flex items-center justify-center px-6 py-3 bg-primary-500 text-white rounded-full font-semibold hover:bg-primary-700 transition-colors duration-200 shadow-sm hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                >
                  Last opp billett
                </Link>
                <p className="text-sm text-slate-500">
                  Støtter QR-skanning, e-post og manuell opplasting
                </p>
              </div>
            </div>
          </div>

          {/* Info box */}
          <div className="mt-8 bg-primary-50 border border-primary-200 rounded-xl p-6">
            <h3 className="text-sm font-semibold text-primary-700 mb-2">
              💡 Hvordan fungerer det?
            </h3>
            <ul className="text-sm text-primary-700 space-y-1 list-disc list-inside">
              <li>Last opp togbilletten din (PDF, bilde eller QR-kode)</li>
              <li>Vi overvåker togstatusene dine automatisk</li>
              <li>Ved forsinkelse genereres refusjonskrav automatisk</li>
              <li>Du godkjenner og sender kravet med ett klikk</li>
            </ul>
          </div>
        </>
      ) : (
        <>
          {/* Active Tickets */}
          {activeTickets.length > 0 && (
            <div className="mb-12">
              <h2 className="text-2xl font-semibold text-slate-900 mb-6">
                Aktive billetter ({activeTickets.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeTickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow duration-200"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="text-2xl">🎫</div>
                      {getClaimStatusBadge(ticket.claimStatus)}
                    </div>

                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      Tog {ticket.tognummer}
                    </h3>

                    <div className="space-y-2 text-sm text-slate-600">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Rute:</span>
                        {ticket.fra} → {ticket.til}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Dato:</span>
                        {ticket.dato} kl. {ticket.klokkeslett}
                      </div>
                      {ticket.beskrivelse && (
                        <div className="mt-3 pt-3 border-t border-slate-100">
                          <span className="font-medium">Beskrivelse:</span>
                          <p className="text-slate-600 mt-1">
                            {ticket.beskrivelse}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <div className="text-xs text-slate-500 mb-3">
                        📎 {ticket.fil.name} (
                        {(ticket.fil.size / 1024).toFixed(1)} kB)
                      </div>
                      <div className="text-xs text-slate-400 mb-3">
                        Opprettet:{" "}
                        {new Date(ticket.opprettet).toLocaleDateString("no-NO", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(ticket)}
                          className="flex-1 px-3 py-2 text-sm border-2 border-slate-300 text-slate-700 rounded-full hover:bg-slate-50 transition-colors duration-200 font-medium"
                        >
                          Rediger
                        </button>
                        <button
                          onClick={() => handleDelete(ticket.id)}
                          className="flex-1 px-3 py-2 text-sm border-2 border-rose-300 text-rose-600 rounded-full hover:bg-rose-50 transition-colors duration-200 font-medium"
                        >
                          Slett
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tickets with Claims */}
          {ticketsWithClaims.length > 0 && (
            <div>
              <h2 className="text-2xl font-semibold text-slate-900 mb-6">
                Billetter med krav ({ticketsWithClaims.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {ticketsWithClaims.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow duration-200"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="text-2xl">🎫</div>
                      {getClaimStatusBadge(ticket.claimStatus)}
                    </div>

                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      Tog {ticket.tognummer}
                    </h3>

                    <div className="space-y-2 text-sm text-slate-600">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Rute:</span>
                        {ticket.fra} → {ticket.til}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Dato:</span>
                        {ticket.dato} kl. {ticket.klokkeslett}
                      </div>
                      {ticket.beskrivelse && (
                        <div className="mt-3 pt-3 border-t border-slate-100">
                          <span className="font-medium">Beskrivelse:</span>
                          <p className="text-slate-600 mt-1">
                            {ticket.beskrivelse}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <div className="text-xs text-slate-500 mb-3">
                        📎 {ticket.fil.name} (
                        {(ticket.fil.size / 1024).toFixed(1)} kB)
                      </div>
                      <div className="text-xs text-slate-400 mb-3">
                        Opprettet:{" "}
                        {new Date(ticket.opprettet).toLocaleDateString("no-NO", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDelete(ticket.id)}
                          className="flex-1 px-3 py-2 text-sm border-2 border-rose-300 text-rose-600 rounded-full hover:bg-rose-50 transition-colors duration-200 font-medium"
                        >
                          Slett
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Info banner */}
          <div className="mt-8 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm text-amber-900">
              💡 <strong>Lokal lagring:</strong> Billettene er lagret lokalt i
              nettleseren din. Dette er en midlertidig løsning før backend er på
              plass (TR-IM-301).
            </p>
          </div>
        </>
      )}
      </div>
    </div>
  );
}

export default function BilletterPage() {
  return (
    <AuthGate>
      <BilletterPageContent />
    </AuthGate>
  );
}
