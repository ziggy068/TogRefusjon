"use client";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import AuthGate from "@/components/AuthGate";
import { Input } from "@/components/forms";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Switch from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { profileSchema, type ProfileFormData } from "@/lib/validators/profile";

function ProfilePageContent() {
  const { user } = useAuth();
  const { showToast, ToastComponent } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isDirty, isValid },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    mode: "onChange",
    defaultValues: {
      fullName: "",
      email: user?.email || "",
      iban: "",
      consentDataProcessing: false,
    },
  });

  const consentValue = watch("consentDataProcessing");

  // Load profile data on mount
  useEffect(() => {
    async function loadProfile() {
      if (!user) return;

      try {
        const profileRef = doc(db, "users", user.uid, "profile", "data");
        const profileSnap = await getDoc(profileRef);

        if (profileSnap.exists()) {
          const data = profileSnap.data();
          setValue("fullName", data.fullName || "");
          setValue("email", user.email || "");
          setValue("iban", data.iban || "");
          setValue("consentDataProcessing", data.consentDataProcessing || false);
        } else {
          // First time - set email from auth
          setValue("email", user.email || "");
        }
      } catch (error) {
        console.error("Error loading profile:", error);
        showToast("Kunne ikke laste profil", "error");
      } finally {
        setIsLoading(false);
      }
    }

    loadProfile();
  }, [user, setValue, showToast]);

  const onSubmit = async (data: ProfileFormData) => {
    if (!user) return;

    setIsSaving(true);
    try {
      const profileRef = doc(db, "users", user.uid, "profile", "data");
      await setDoc(
        profileRef,
        {
          fullName: data.fullName,
          email: data.email,
          iban: data.iban || null,
          consentDataProcessing: data.consentDataProcessing,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      showToast("Profil lagret!", "success");
    } catch (error) {
      console.error("Error saving profile:", error);
      showToast("Kunne ikke lagre profil", "error");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mb-4"></div>
          <p className="text-slate-600">Laster profil...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {ToastComponent}

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900">Min profil</h1>
        <p className="text-slate-600 mt-2">
          Administrer dine personopplysninger og innstillinger
        </p>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Full Name */}
          <Input
            label="Fullt navn"
            placeholder="Ola Nordmann"
            {...register("fullName")}
            error={errors.fullName?.message}
            required
          />

          {/* Email (readonly) */}
          <Input
            label="E-post"
            type="email"
            {...register("email")}
            error={errors.email?.message}
            disabled
            helperText="E-postadressen kan ikke endres"
          />

          {/* IBAN / Account number */}
          <Input
            label="Kontonummer"
            placeholder="11 siffer eller IBAN (f.eks. NO9386011117947)"
            {...register("iban")}
            error={errors.iban?.message}
            helperText="Norsk kontonummer (11 siffer) eller internasjonalt IBAN-format"
          />

          {/* Consent */}
          <div className="pt-4 border-t border-slate-200">
            <Switch
              id="consent"
              checked={consentValue}
              onCheckedChange={(checked) =>
                setValue("consentDataProcessing", checked, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
              label="Samtykke til databehandling"
              description="Jeg samtykker til at Tog Refusjon behandler mine personopplysninger for å behandle refusjonskrav."
            />
            {errors.consentDataProcessing && (
              <p className="text-sm text-rose-600 mt-2">
                {errors.consentDataProcessing.message}
              </p>
            )}
          </div>

          {/* Submit button */}
          <div className="flex gap-3 pt-4">
            <Button
              type="submit"
              disabled={!isDirty || !isValid || isSaving}
              className="flex-1"
            >
              {isSaving ? "Lagrer..." : "Lagre endringer"}
            </Button>
          </div>
        </form>
      </Card>

      {/* Info card */}
      <Card className="p-4 mt-4 bg-slate-300">
        <div className="flex gap-3">
          <span className="text-xl">ℹ️</span>
          <div className="text-sm text-slate-600">
            <p className="font-medium text-slate-900 mb-1">
              Hvorfor trenger vi dette?
            </p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Fullt navn brukes i refusjonskrav til togoperatører</li>
              <li>Kontonummer brukes for utbetaling av refusjoner</li>
              <li>Samtykke er nødvendig for å behandle dine personopplysninger</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <AuthGate>
      <ProfilePageContent />
    </AuthGate>
  );
}
