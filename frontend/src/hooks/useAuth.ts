"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      setLoading(false);

      // Create user profile on first login
      if (user) {
        await ensureUserProfile(user);
      }
    });

    return () => unsubscribe();
  }, []);

  const ensureUserProfile = async (user: User) => {
    try {
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        // First time user - create profile
        await setDoc(userRef, {
          displayName: user.displayName || user.email?.split("@")[0] || "Bruker",
          email: user.email,
          photoURL: user.photoURL || null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        console.log("✅ User profile created:", user.uid);
      }
    } catch (error) {
      console.error("Error creating user profile:", error);
    }
  };

  const loginWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      await ensureUserProfile(result.user);
      router.push("/billetter");
      return result.user;
    } catch (error: any) {
      // Hvis brukeren lukker popup-vinduet, ikke kast feil - bare returner null
      if (error?.code === "auth/popup-closed-by-user") {
        console.log("ℹ️ Bruker lukket innloggingsvinduet");
        return null;
      }
      // For andre feil, logg og kast videre
      console.error("Error logging in with Google:", error);
      throw error;
    }
  };

  const loginWithEmail = async (email: string, password: string) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      await ensureUserProfile(result.user);
      router.push("/billetter");
      return result.user;
    } catch (error) {
      console.error("Error logging in with email:", error);
      throw error;
    }
  };

  const signupWithEmail = async (
    email: string,
    password: string,
    displayName?: string
  ) => {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);

      // Update display name if provided
      if (displayName) {
        await updateProfile(result.user, { displayName });
      }

      await ensureUserProfile(result.user);
      router.push("/billetter");
      return result.user;
    } catch (error) {
      console.error("Error signing up with email:", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      router.push("/login");
    } catch (error) {
      console.error("Error logging out:", error);
      throw error;
    }
  };

  return {
    user,
    loading,
    loginWithGoogle,
    loginWithEmail,
    signupWithEmail,
    logout,
  };
}
