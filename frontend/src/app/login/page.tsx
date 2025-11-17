"use client";
import { useState, FormEvent, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/forms";
import { validateEmail, validatePassword } from "@/lib/validation";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const { loginWithGoogle, loginWithEmail, signupWithEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isSignup, setIsSignup] = useState(false);

  // Check for signup query parameter on mount
  useEffect(() => {
    if (searchParams.get("signup") === "true") {
      setIsSignup(true);
    }
  }, [searchParams]);
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    general?: string;
  }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setErrors({});
    setIsGoogleLoading(true);

    try {
      const result = await loginWithGoogle();
      // Hvis result er null, betyr det at brukeren lukket popup - ikke vis feil
      if (result === null) {
        console.log("Bruker avbrøt innlogging");
      }
    } catch (error: any) {
      setErrors({ general: error.message || "Feil ved innlogging med Google" });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate inputs
    const emailValidation = validateEmail(email);
    const passwordValidation = validatePassword(password);

    if (!emailValidation.isValid || !passwordValidation.isValid) {
      setErrors({
        email: emailValidation.error,
        password: passwordValidation.error,
      });
      return;
    }

    setIsSubmitting(true);

    try {
      if (isSignup) {
        await signupWithEmail(email, password, displayName);
      } else {
        await loginWithEmail(email, password);
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      let errorMessage = "Feil ved innlogging";

      if (error.code === "auth/user-not-found") {
        errorMessage = "Bruker ikke funnet";
      } else if (error.code === "auth/wrong-password") {
        errorMessage = "Feil passord";
      } else if (error.code === "auth/email-already-in-use") {
        errorMessage = "E-posten er allerede i bruk";
      } else if (error.code === "auth/weak-password") {
        errorMessage = "Passordet er for svakt";
      }

      setErrors({ general: errorMessage });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-300 flex items-center justify-center py-12 px-6">
      <div className="max-w-md w-full bg-white rounded-xl shadow-sm p-8">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-primary-500 rounded-full mb-3">
            <span className="text-2xl text-white">🚆</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            {isSignup ? "Opprett konto" : "Logg inn"}
          </h1>
          <p className="text-slate-600 mt-2">Velkommen til Tog Refusjon</p>
        </div>

        {/* Error message */}
        {errors.general && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-800">
            {errors.general}
          </div>
        )}

        {/* Google login */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isGoogleLoading}
          className="w-full px-6 py-3 border-2 border-slate-300 text-slate-700 rounded-full font-semibold hover:bg-slate-50 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 mb-4"
        >
          {isGoogleLoading ? (
            <>
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Vennligst vent...
            </>
          ) : (
            <>
              <div style={{ width: '18px', height: '18px', flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                  <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                  <path fill="#34A853" d="M9.003 18c2.43 0 4.467-.806 5.956-2.18L12.05 13.56c-.806.54-1.836.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9.003 18z"/>
                  <path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9.001c0 1.452.348 2.827.957 4.041l3.007-2.332z"/>
                  <path fill="#EA4335" d="M9.003 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.464.891 11.428 0 9.002 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29c.708-2.127 2.692-3.71 5.036-3.71z"/>
                </svg>
              </div>
              Fortsett med Google
            </>
          )}
        </button>

        <div className="relative mb-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-slate-500">Eller</span>
          </div>
        </div>

        {/* Email/password form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignup && (
            <Input
              type="text"
              label="Navn"
              placeholder="Ditt navn"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="name"
            />
          )}

          <Input
            type="email"
            label="E-post"
            placeholder="din@epost.no"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
            required
            autoComplete="email"
          />

          <Input
            type="password"
            label="Passord"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            helperText="Minst 8 tegn"
            required
            autoComplete={isSignup ? "new-password" : "current-password"}
          />

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full px-6 py-3 bg-primary-500 text-white rounded-full font-semibold hover:bg-primary-700 transition-colors duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
          >
            {isSubmitting
              ? "Vennligst vent..."
              : isSignup
              ? "Opprett konto"
              : "Logg inn"}
          </button>
        </form>

        {/* Toggle signup/login */}
        <div className="mt-6 text-center text-sm text-slate-600">
          {isSignup ? (
            <>
              Har du allerede en konto?{" "}
              <button
                onClick={() => setIsSignup(false)}
                className="text-primary-500 hover:text-primary-700 font-medium"
              >
                Logg inn
              </button>
            </>
          ) : (
            <>
              Har du ikke en konto?{" "}
              <button
                onClick={() => setIsSignup(true)}
                className="text-primary-500 hover:text-primary-700 font-medium"
              >
                Opprett ny konto
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
