"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input, Textarea } from "@/components/forms";
import { fileToDataURL } from "@/lib/file";
import { db, auth, storage } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import AuthGate from "@/components/AuthGate";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

// Validation schema
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_FILE_TYPES = ["image/png", "image/jpeg", "application/pdf"];

const uploadSchema = z.object({
  dato: z.string().min(1, "Dato er påkrevd"),
  klokkeslett: z.string().min(1, "Klokkeslett er påkrevd"),
  tognummer: z.string().min(1, "Tognummer er påkrevd"),
  fra: z.string().min(1, "Fra-stasjon er påkrevd"),
  til: z.string().min(1, "Til-stasjon er påkrevd"),
  beskrivelse: z.string().optional(),
  fil: z
    .custom<FileList>()
    .optional()
    .refine(
      (files) => !files || files.length === 0 || files[0].size <= MAX_FILE_SIZE,
      "Filen må være mindre enn 10 MB"
    )
    .refine(
      (files) => !files || files.length === 0 || ACCEPTED_FILE_TYPES.includes(files[0].type),
      "Kun PNG, JPG eller PDF tillatt"
    ),
});

type UploadFormData = z.infer<typeof uploadSchema>;

function UploadTicketPageContent() {
  const router = useRouter();
  const [preview, setPreview] = useState<{
    name: string;
    size: number;
    type: string;
  } | null>(null);
  const [existingFileData, setExistingFileData] = useState<{
    name: string;
    type: string;
    size: number;
    dataURL: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [existingTicketMetadata, setExistingTicketMetadata] = useState<{
    id?: string;
    opprettet?: string;
    claimStatus?: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<UploadFormData>({
    resolver: zodResolver(uploadSchema),
  });

  // Load draft data on mount (when returning from preview)
  useEffect(() => {
    const draftStr = localStorage.getItem("ticketDraft");
    if (draftStr) {
      try {
        const draft = JSON.parse(draftStr);
        // Populate form with draft data
        setValue("dato", draft.dato);
        setValue("klokkeslett", draft.klokkeslett);
        setValue("tognummer", draft.tognummer);
        setValue("fra", draft.fra);
        setValue("til", draft.til);
        if (draft.beskrivelse) {
          setValue("beskrivelse", draft.beskrivelse);
        }

        // Store file data (can't set file input programmatically)
        if (draft.fil) {
          setExistingFileData(draft.fil);
          setPreview({
            name: draft.fil.name,
            size: draft.fil.size,
            type: draft.fil.type,
          });
        }

        // Store ticket metadata (id, opprettet, claimStatus) for editing
        if (draft.id) {
          setExistingTicketMetadata({
            id: draft.id,
            opprettet: draft.opprettet,
            claimStatus: draft.claimStatus,
          });
        }
      } catch (error) {
        console.error("Error loading draft:", error);
      }
    }
  }, [setValue]);

  // Watch file input for preview
  const fileList = watch("fil");
  const file = fileList?.[0];

  // Update preview when file changes
  useEffect(() => {
    if (file) {
      setPreview({
        name: file.name,
        size: file.size,
        type: file.type,
      });
    }
  }, [file]);

  const onSubmit = async (data: UploadFormData) => {
    setIsSubmitting(true);

    try {
      let fileData;

      // Check if user uploaded a new file or using existing
      if (data.fil && data.fil.length > 0) {
        // New file uploaded
        const file = data.fil[0];
        const dataURL = await fileToDataURL(file);
        fileData = {
          name: file.name,
          type: file.type,
          size: file.size,
          dataURL,
        };
      } else if (existingFileData) {
        // Use existing file data
        fileData = existingFileData;
      } else {
        // No file at all
        alert("❌ Du må laste opp en billett");
        setIsSubmitting(false);
        return;
      }

      // Create ticket draft (preserve metadata if editing)
      const ticketDraft = {
        ...(existingTicketMetadata || {}), // Include id, opprettet, claimStatus if editing
        dato: data.dato,
        klokkeslett: data.klokkeslett,
        tognummer: data.tognummer,
        fra: data.fra,
        til: data.til,
        beskrivelse: data.beskrivelse || "",
        fil: fileData,
      };

      // Save draft to localStorage for preview
      localStorage.setItem("ticketDraft", JSON.stringify(ticketDraft));

      // Navigate to preview page
      router.push("/billetter/preview");
    } catch (error) {
      console.error("Error preparing ticket:", error);
      alert("❌ Feil ved forberedelse av billett. Prøv igjen.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    reset();
    setPreview(null);
    setExistingFileData(null);
    setExistingTicketMetadata(null);
    localStorage.removeItem("ticketDraft");
  };

  const handleSaveDirectly = async (data: UploadFormData) => {
    const user = auth.currentUser;

    // Check if user is logged in
    if (!user) {
      alert("⚠️ Du må logge inn for å lagre billetter.\n\nLogg inn for å lagre billett i skyen.");
      router.push("/login");
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(0);

    try {
      let fileData;
      let fileBlob: Blob;

      // Check if user uploaded a new file or using existing
      if (data.fil && data.fil.length > 0) {
        // New file uploaded
        const file = data.fil[0];
        const dataURL = await fileToDataURL(file);
        fileData = {
          name: file.name,
          type: file.type,
          size: file.size,
          dataURL,
        };
        fileBlob = file;
      } else if (existingFileData) {
        // Use existing file data
        fileData = existingFileData;
        const response = await fetch(existingFileData.dataURL);
        fileBlob = await response.blob();
      } else {
        // No file at all
        alert("❌ Du må laste opp en billett");
        setIsSubmitting(false);
        return;
      }

      const isEditing = !!existingTicketMetadata?.id;
      const ticketId = isEditing ? existingTicketMetadata.id! : crypto.randomUUID();

      // Upload file to Firebase Storage
      const storagePath = `users/${user.uid}/tickets/${ticketId}/${fileData.name}`;
      const storageRef = ref(storage, storagePath);
      const uploadTask = uploadBytesResumable(storageRef, fileBlob);

      // Monitor upload progress with timeout
      const uploadPromise = new Promise<string>((resolve, reject) => {
        // Set timeout after 30 seconds
        const timeout = setTimeout(() => {
          reject(new Error("Upload timeout - Firebase Storage may not be activated"));
        }, 30000);

        uploadTask.on(
          "state_changed",
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgress(Math.round(progress));
            console.log(`Upload progress: ${progress}%`);
          },
          (error) => {
            clearTimeout(timeout);
            console.error("Upload error:", error);
            reject(error);
          },
          async () => {
            clearTimeout(timeout);
            // Upload complete - get download URL
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(downloadURL);
          }
        );
      });

      await uploadPromise.then(async (downloadURL) => {
        // Save metadata to Firestore
        const ticketData = {
          date: data.dato,
          time: data.klokkeslett,
          trainNo: data.tognummer,
          from: data.fra,
          to: data.til,
          description: data.beskrivelse || "",
          fileName: fileData.name,
          fileType: fileData.type,
          fileSize: fileData.size,
          storagePath,
          downloadURL,
          status: "imported",
          claimStatus: existingTicketMetadata?.claimStatus || "none",
          createdAt: isEditing && existingTicketMetadata?.opprettet ? existingTicketMetadata.opprettet : serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        // Save to Firestore under users/{uid}/tickets/{ticketId}
        const ticketRef = doc(db, `users/${user.uid}/tickets`, ticketId);
        await setDoc(ticketRef, ticketData);

        // Update localStorage as backup
        const storageKey = "tr_billetter";
        const existing = JSON.parse(localStorage.getItem(storageKey) || "[]");

        if (isEditing) {
          const index = existing.findIndex((t: any) => t.id === ticketId);
          if (index !== -1) {
            existing[index] = {
              ...existing[index],
              dato: data.dato,
              klokkeslett: data.klokkeslett,
              tognummer: data.tognummer,
              fra: data.fra,
              til: data.til,
              beskrivelse: data.beskrivelse,
              fil: {
                ...fileData,
                downloadURL,
              },
            };
          }
        } else {
          const ticket = {
            id: ticketId,
            opprettet: new Date().toISOString(),
            dato: data.dato,
            klokkeslett: data.klokkeslett,
            tognummer: data.tognummer,
            fra: data.fra,
            til: data.til,
            beskrivelse: data.beskrivelse || "",
            fil: {
              ...fileData,
              downloadURL,
            },
            claimStatus: "none",
          };
          existing.unshift(ticket);
        }

        localStorage.setItem(storageKey, JSON.stringify(existing));
        localStorage.removeItem("ticketDraft");

        alert(isEditing ? "✅ Billett oppdatert!" : "✅ Billett lagret!");
        router.push("/billetter");
      });
    } catch (error: any) {
      console.error("Error saving ticket:", error);

      let errorMessage = "❌ Feil ved lagring av billett.";

      if (error.message && error.message.includes("timeout")) {
        errorMessage += "\n\n⚠️ Firebase Storage er IKKE aktivert!\n\nGå til:\nhttps://console.firebase.google.com/project/togrefusjon/storage\n\nKlikk 'Get Started' for å aktivere Storage.";
      } else if (error.code === "storage/unauthorized") {
        errorMessage += "\n\nFirebase Storage er ikke aktivert eller du mangler tilgang.";
      } else if (error.code === "storage/object-not-found") {
        errorMessage += "\n\nKunne ikke finne filen.";
      } else {
        errorMessage += `\n\n${error.message || "Ukjent feil"}`;
      }

      alert(errorMessage);
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="min-h-screen bg-slate-300">
      <div className="max-w-2xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Last opp billett</h1>
        <p className="mt-2 text-gray-600">
          Fyll ut reisedetaljene og last opp billetten din
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Reisedetaljer */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Reisedetaljer
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Dato"
              type="date"
              error={errors.dato?.message}
              required
              {...register("dato")}
            />

            <Input
              label="Klokkeslett"
              type="time"
              error={errors.klokkeslett?.message}
              required
              {...register("klokkeslett")}
            />

            <Input
              label="Tognummer"
              placeholder="f.eks. 71"
              error={errors.tognummer?.message}
              required
              {...register("tognummer")}
            />

            <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Fra"
                placeholder="Stasjon"
                error={errors.fra?.message}
                required
                {...register("fra")}
              />

              <Input
                label="Til"
                placeholder="Stasjon"
                error={errors.til?.message}
                required
                {...register("til")}
              />
            </div>

            <div className="sm:col-span-2">
              <Textarea
                label="Beskrivelse (valgfritt)"
                placeholder="Tilleggsinfo (sete, bestilling osv.)"
                rows={3}
                error={errors.beskrivelse?.message}
                {...register("beskrivelse")}
              />
            </div>
          </div>
        </div>

        {/* File upload */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Billett (PNG, JPG eller PDF)
          </h2>

          <div className="space-y-4">
            {existingFileData && !file && (
              <div className="text-sm rounded border border-green-200 p-3 bg-green-50">
                <div className="font-medium text-green-900">
                  ✓ Eksisterende fil
                </div>
                <div className="text-green-700 mt-1">
                  {existingFileData.name} ·{" "}
                  {(existingFileData.size / 1024).toFixed(1)} kB
                </div>
                <div className="mt-2 text-xs text-green-600">
                  Du kan laste opp en ny fil nedenfor, eller la dette stå for å
                  beholde eksisterende fil
                </div>
              </div>
            )}

            <Input
              type="file"
              accept=".png,.jpg,.jpeg,.pdf"
              error={errors.fil?.message}
              required={!existingFileData}
              {...register("fil")}
            />

            {preview && file && (
              <div className="text-sm rounded border border-gray-200 p-3 bg-gray-50">
                <div className="font-medium text-gray-900">
                  Ny fil valgt
                </div>
                <div className="text-gray-600 mt-1">
                  {preview.name} · {(preview.size / 1024).toFixed(1)} kB ·{" "}
                  {preview.type}
                </div>
                {preview.type.startsWith("image/") && (
                  <div className="mt-2 text-xs text-gray-500">
                    Bilde vil vises etter lagring
                  </div>
                )}
                {preview.type === "application/pdf" && (
                  <div className="mt-2 text-xs text-gray-500">
                    PDF kan åpnes fra saken etter lagring
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Info box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">
            💡 Hva skjer etter lagring?
          </h3>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li>Billetten og filen lastes opp til Firebase Storage</li>
            <li>Metadata lagres i Firestore</li>
            <li>Vi starter automatisk overvåking av togstatus</li>
          </ul>
        </div>

        {/* Upload progress */}
        {isSubmitting && uploadProgress > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Laster opp...</span>
              <span className="text-sm font-medium text-gray-900">{uploadProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-gray-900 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleSubmit(handleSaveDirectly)}
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting
                ? uploadProgress > 0
                  ? "Laster opp..."
                  : "Lagrer..."
                : "✓ Lagre direkte"}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Forbereder..." : "Forhåndsvisning →"}
            </button>
          </div>
          <button
            type="button"
            onClick={handleReset}
            disabled={isSubmitting}
            className="w-full px-6 py-2 text-sm border border-gray-300 text-gray-600 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Nullstill skjema
          </button>
        </div>

        <p className="text-xs text-gray-500 text-center">
          💡 Lagre direkte eller forhåndsvis før lagring
        </p>
      </form>

      {/* Additional options (future) */}
      <div className="mt-8 pt-8 border-t border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Andre importmetoder (kommer snart)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            className="p-4 border border-gray-200 rounded-lg text-left hover:bg-gray-50 transition-colors disabled:opacity-50"
            disabled
          >
            <div className="text-2xl mb-2">📷</div>
            <h3 className="font-semibold text-gray-900 text-sm">QR-skanning</h3>
            <p className="text-xs text-gray-600 mt-1">
              Skann QR-koden fra billetten (TR-IM-301)
            </p>
          </button>
          <button
            className="p-4 border border-gray-200 rounded-lg text-left hover:bg-gray-50 transition-colors disabled:opacity-50"
            disabled
          >
            <div className="text-2xl mb-2">📧</div>
            <h3 className="font-semibold text-gray-900 text-sm">
              E-post import
            </h3>
            <p className="text-xs text-gray-600 mt-1">
              Importer fra e-post automatisk (TR-IM-302)
            </p>
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}

export default function UploadTicketPage() {
  return (
    <AuthGate>
      <UploadTicketPageContent />
    </AuthGate>
  );
}
