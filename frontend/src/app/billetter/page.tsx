"use client";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import { deleteTicket } from "@/lib/tickets/firestore";
import { useTicketsByStatus } from "@/lib/tickets/hooks";
import AuthGate from "@/components/AuthGate";

function BilletterPageContent() {
  const { activeTickets, ticketsWithClaims, allTickets, loading, error, refresh } =
    useTicketsByStatus();

  const handleDelete = async (id: string) => {
    if (!confirm("Er du sikker på at du vil slette denne billetten?")) {
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      alert("Du må være innlogget for å slette billetter");
      return;
    }

    try {
      await deleteTicket(user.uid, id);
      console.log("✅ Deleted ticket:", id);

      // Refresh tickets list
      refresh();
    } catch (error: any) {
      console.error("Error deleting ticket:", error);
      alert(`❌ Feil ved sletting: ${error.message}`);
    }
  };

  const getClaimStatusBadge = (hasClaimId: boolean) => {
    if (hasClaimId) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-primary-50 text-primary-700 border border-primary-200">
          📤 Har krav
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
        📋 Aktiv
      </span>
    );
  };

  const formatDateTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return {
        date: date.toLocaleDateString("no-NO", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }),
        time: date.toLocaleTimeString("no-NO", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
    } catch {
      return { date: "Ukjent", time: "" };
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
          <p className="mt-2 text-slate-600">Laster billetter...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-center">
          <p className="text-rose-900 font-medium">Feil ved lasting av billetter</p>
          <p className="text-rose-700 text-sm mt-2">{error}</p>
          <button
            onClick={refresh}
            className="mt-4 px-4 py-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600"
          >
            Prøv igjen
          </button>
        </div>
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
          <div className="flex flex-wrap gap-3">
            <Link
              href="/billetter/add"
              className="inline-flex items-center justify-center px-6 py-3 bg-primary-500 text-white rounded-full font-semibold hover:bg-primary-700 transition-colors duration-200 shadow-sm hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
            >
              + Legg til billett
            </Link>
            <Link
              href="/scan"
              className="inline-flex items-center justify-center px-6 py-3 border-2 border-primary-500 text-primary-500 rounded-full font-semibold hover:bg-primary-50 transition-colors duration-200"
            >
              📷 Skann QR
            </Link>
          </div>
        </div>

        {allTickets.length === 0 ? (
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
                  <div className="flex gap-3 justify-center">
                    <Link
                      href="/billetter/add"
                      className="inline-flex items-center justify-center px-6 py-3 bg-primary-500 text-white rounded-full font-semibold hover:bg-primary-700 transition-colors duration-200 shadow-sm hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                    >
                      + Legg til billett
                    </Link>
                    <Link
                      href="/scan"
                      className="inline-flex items-center justify-center px-6 py-3 border-2 border-primary-500 text-primary-500 rounded-full font-semibold hover:bg-primary-50 transition-colors duration-200"
                    >
                      📷 Skann QR
                    </Link>
                  </div>
                  <p className="text-sm text-slate-500">
                    Støtter QR-skanning, manuell input og fil-opplasting
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
                  {activeTickets.map((ticket) => {
                    const departure = formatDateTime(ticket.departureTime);
                    return (
                      <div
                        key={ticket.id}
                        className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow duration-200"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div className="text-2xl">🎫</div>
                          {getClaimStatusBadge(!!ticket.claimId)}
                        </div>

                        <h3 className="text-lg font-semibold text-slate-900 mb-2">
                          {ticket.operator} {ticket.trainNumber}
                        </h3>

                        <div className="space-y-2 text-sm text-slate-600">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Rute:</span>
                            {ticket.fromStation} → {ticket.toStation}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Avgang:</span>
                            {departure.date} kl. {departure.time}
                          </div>
                          {ticket.seatInfo && (
                            <div className="flex items-center gap-2">
                              <span className="font-medium">Sete:</span>
                              {ticket.seatInfo}
                            </div>
                          )}
                          {ticket.priceNOK && (
                            <div className="flex items-center gap-2">
                              <span className="font-medium">Pris:</span>
                              {ticket.priceNOK} NOK
                            </div>
                          )}
                        </div>

                        <div className="mt-4 pt-4 border-t border-slate-100">
                          <div className="text-xs text-slate-400 mb-3">
                            {ticket.source === "qr" && "📱 Skannet fra QR"}
                            {ticket.source === "manual" && "✍️ Lagt til manuelt"}
                            {ticket.source === "email" && "📧 Fra e-post"}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleDelete(ticket.id!)}
                              className="flex-1 px-3 py-2 text-sm border-2 border-rose-300 text-rose-600 rounded-full hover:bg-rose-50 transition-colors duration-200 font-medium"
                            >
                              Slett
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
                  {ticketsWithClaims.map((ticket) => {
                    const departure = formatDateTime(ticket.departureTime);
                    return (
                      <div
                        key={ticket.id}
                        className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow duration-200"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div className="text-2xl">🎫</div>
                          {getClaimStatusBadge(!!ticket.claimId)}
                        </div>

                        <h3 className="text-lg font-semibold text-slate-900 mb-2">
                          {ticket.operator} {ticket.trainNumber}
                        </h3>

                        <div className="space-y-2 text-sm text-slate-600">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Rute:</span>
                            {ticket.fromStation} → {ticket.toStation}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Avgang:</span>
                            {departure.date} kl. {departure.time}
                          </div>
                          {ticket.priceNOK && (
                            <div className="flex items-center gap-2">
                              <span className="font-medium">Pris:</span>
                              {ticket.priceNOK} NOK
                            </div>
                          )}
                        </div>

                        <div className="mt-4 pt-4 border-t border-slate-100">
                          <div className="text-xs text-slate-400 mb-3">
                            Krav-ID: {ticket.claimId}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleDelete(ticket.id!)}
                              className="flex-1 px-3 py-2 text-sm border-2 border-rose-300 text-rose-600 rounded-full hover:bg-rose-50 transition-colors duration-200 font-medium"
                            >
                              Slett
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Info banner */}
            <div className="mt-8 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <p className="text-sm text-emerald-900">
                ✅ <strong>Firestore-lagring aktiv:</strong> Billettene dine er
                nå lagret i Firebase Firestore (TR-IM-302).
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
