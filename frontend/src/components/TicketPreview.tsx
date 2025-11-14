"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db, auth, storage } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";

interface TicketDraft {
  id?: string;
  opprettet?: string;
  dato: string;
  klokkeslett: string;
  tognummer: string;
  fra: string;
  til: string;
  beskrivelse?: string;
  fil: {
    name: string;
    type: string;
    size: number;
    dataURL: string;
  };
  claimStatus?: "none" | "pending" | "submitted" | "approved" | "rejected";
}

export default function TicketPreview() {
  const router = useRouter();
  const [draft, setDraft] = useState<TicketDraft | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    const stored = localStorage.getItem("ticketDraft");
    if (stored) {
      try {
        setDraft(JSON.parse(stored));
      } catch (error) {
        console.error("Error parsing ticket draft:", error);
      }
    }
    setIsLoading(false);
  }, []);

  const handleEdit = () => {
    router.push("/billetter/upload");
  };

  const handleConfirm = async () => {
    if (!draft) return;

    const user = auth.currentUser;
    if (!user) {
      alert("⚠️ Du må logge inn for å lagre billetter i skyen.");
      return;
    }

    setIsSaving(true);
    setUploadProgress(0);

    try {
      const isEditing = !!draft.id;

      // Validate file
      const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "application/pdf"];
      if (!allowedTypes.includes(draft.fil.type)) {
        alert("❌ Ugyldig filtype. Kun PNG, JPG, JPEG og PDF er tillatt.");
        setIsSaving(false);
        return;
      }

      const maxSize = 10 * 1024 * 1024; // 10 MB
      if (draft.fil.size > maxSize) {
        alert("❌ Filen er for stor. Maksimal størrelse er 10 MB.");
        setIsSaving(false);
        return;
      }

      // Convert dataURL to Blob for upload
      const response = await fetch(draft.fil.dataURL);
      const blob = await response.blob();

      // Generate unique ID for new tickets
      const ticketId = isEditing ? draft.id! : crypto.randomUUID();

      // Upload file to Firebase Storage
      const storagePath = `users/${user.uid}/tickets/${ticketId}/${draft.fil.name}`;
      const storageRef = ref(storage, storagePath);
      const uploadTask = uploadBytesResumable(storageRef, blob);

      // Monitor upload progress with timeout
      const uploadPromise = new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Upload timeout - Firebase Storage may not be activated"));
        }, 30000);

        uploadTask.on(
          "state_changed",
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgress(Math.round(progress));
          },
          (error) => {
            clearTimeout(timeout);
            reject(error);
          },
          async () => {
            clearTimeout(timeout);
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(downloadURL);
          }
        );
      });

      await uploadPromise.then(async (downloadURL) => {
        // Save metadata to Firestore
        const ticketData = {
          date: draft.dato,
          time: draft.klokkeslett,
          trainNo: draft.tognummer,
          from: draft.fra,
          to: draft.til,
          description: draft.beskrivelse || "",
          fileName: draft.fil.name,
          fileType: draft.fil.type,
          fileSize: draft.fil.size,
          storagePath,
          downloadURL,
          status: "imported",
          claimStatus: draft.claimStatus || "none",
          createdAt: isEditing && draft.opprettet ? draft.opprettet : serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        // Save to Firestore
        const ticketRef = doc(db, `users/${user.uid}/tickets`, ticketId);
        await setDoc(ticketRef, ticketData);

        // Update localStorage as backup
        const storageKey = "tr_billetter";
        const existing = JSON.parse(localStorage.getItem(storageKey) || "[]");

        if (isEditing) {
          const index = existing.findIndex((t: any) => t.id === ticketId);
          if (index !== -1) {
            existing[index] = { ...existing[index], ...draft, fil: { ...draft.fil, downloadURL } };
          }
        } else {
          const ticket = {
            id: ticketId,
            opprettet: new Date().toISOString(),
            ...draft,
            fil: { ...draft.fil, downloadURL },
            claimStatus: "none",
          };
          existing.unshift(ticket);
        }

        localStorage.setItem(storageKey, JSON.stringify(existing));
        localStorage.removeItem("ticketDraft");

        alert(
          isEditing
            ? "✅ Billett oppdatert!"
            : "✅ Billett lagret!\n\nBilletten er nå lagret i skyen og vil bli overvåket for forsinkelser."
        );
        router.push("/billetter");
      });
    } catch (error: any) {
      console.error("Error saving ticket:", error);

      let errorMessage = "❌ Feil ved lagring av billett.";
      if (error.message && error.message.includes("timeout")) {
        errorMessage +=
          "\n\n⚠️ Firebase Storage er IKKE aktivert!\n\nGå til:\nhttps://console.firebase.google.com/project/togrefusjon/storage\n\nKlikk 'Get Started' for å aktivere Storage.";
      } else if (error.code === "storage/unauthorized") {
        errorMessage += "\n\nFirebase Storage er ikke aktivert eller du mangler tilgang.";
      }

      alert(errorMessage);
    } finally {
      setIsSaving(false);
      setUploadProgress(0);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Laster forhåndsvisning...</p>
        </div>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-12">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-full">
              <span className="text-3xl">🎫</span>
            </div>
            <h2 className="text-xl font-semibold text-slate-900">Ingen billett funnet</h2>
            <p className="text-slate-600">Gå til opplasting for å laste opp en billett først.</p>
            <Button onClick={() => router.push("/billetter/upload")} variant="primary">
              Last opp billett
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-300 py-4 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Forhåndsvisning av billett</h1>
          <p className="mt-0.5 text-sm text-slate-600">Sjekk at informasjonen er riktig før du bekrefter</p>
        </div>

        {/* Ticket Card - Boarding Pass Style (NO SCROLL) */}
        <Card className="overflow-hidden">
          {/* Main ticket info - compact horizontal layout */}
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4">
              {/* Left: Route */}
              <div className="md:col-span-5 space-y-2">
                <div className="text-xs uppercase tracking-wide text-slate-500 font-medium">Reise</div>
                <div className="flex items-center gap-2">
                  <span className="text-xl md:text-2xl font-bold text-slate-900">{draft.fra}</span>
                  <svg className="w-5 h-5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                  <span className="text-xl md:text-2xl font-bold text-slate-900">{draft.til}</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-wide text-slate-500 font-medium">Tog</span>
                  <Badge variant="neutral" className="font-semibold">{draft.tognummer}</Badge>
                </div>
              </div>

              {/* Middle: Time & Date */}
              <div className="md:col-span-4 md:border-l md:border-slate-200 md:pl-4 space-y-2">
                <div className="text-xs uppercase tracking-wide text-slate-500 font-medium">Avgang</div>
                <div>
                  <div className="text-lg font-semibold text-slate-900">{draft.klokkeslett}</div>
                  <div className="text-sm text-slate-600">{draft.dato}</div>
                </div>
                <Badge variant="info">
                  <div className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-pulse"></div>
                  Klar for overvåking
                </Badge>
              </div>

              {/* Right: File info */}
              <div className="md:col-span-3 md:border-l md:border-slate-200 md:pl-4">
                <div className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-2">Vedlagt</div>
                <div className="flex items-start gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="w-7 h-7 bg-white rounded flex items-center justify-center flex-shrink-0">
                    <span className="text-base">📎</span>
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-900 truncate">{draft.fil.name}</div>
                    <div className="text-xs text-slate-500">{(draft.fil.size / 1024).toFixed(0)} kB</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Description (if exists) */}
            {draft.beskrivelse && (
              <div className="mt-4 pt-4 border-t border-slate-200">
                <div className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-1">Notat</div>
                <p className="text-sm text-slate-700">{draft.beskrivelse}</p>
              </div>
            )}
          </div>

          {/* File Preview - Compact below */}
          <div className="border-t border-slate-200 bg-slate-50/50 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-2">Forhåndsvisning</div>
            {draft.fil.type.startsWith("image/") && (
              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden max-h-40">
                <img src={draft.fil.dataURL} alt="Billettforhåndsvisning" className="w-full h-auto object-contain max-h-40" />
              </div>
            )}
            {draft.fil.type === "application/pdf" && (
              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <embed src={draft.fil.dataURL} type="application/pdf" className="w-full h-40" />
              </div>
            )}
          </div>
        </Card>

        {/* Info Box - Compact */}
        <Card className="bg-primary-50 border border-primary-200 p-3">
          <div className="flex gap-2 items-start">
            <div className="flex-shrink-0">
              <span className="text-lg">💡</span>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-primary-700 mb-1">Hva skjer når du bekrefter?</h3>
              <p className="text-xs text-primary-700">
                Billetten lastes opp, vi overvåker toget automatisk, og genererer refusjonskrav ved forsinkelse.
              </p>
            </div>
          </div>
        </Card>

        {/* Upload Progress */}
        {isSaving && uploadProgress > 0 && (
          <Card className="p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-700">Laster opp...</span>
              <span className="text-xs font-semibold text-slate-900">{uploadProgress}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-primary-500 to-primary-700 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
          </Card>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-2">
          <Button variant="secondary" onClick={handleEdit} disabled={isSaving} className="flex-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Rediger billett
          </Button>
          <Button variant="primary" onClick={handleConfirm} disabled={isSaving || !auth.currentUser} className="flex-1">
            {isSaving ? (
              <>
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {uploadProgress > 0 ? "Laster opp..." : "Lagrer..."}
              </>
            ) : !auth.currentUser ? (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Logg inn for å lagre
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Bekreft og lagre billett
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
