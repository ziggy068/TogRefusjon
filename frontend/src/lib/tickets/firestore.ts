/**
 * Firestore helpers for ticket management
 * Handles saving and retrieving tickets from Firestore
 */

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  DocumentReference,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { Ticket, TicketInput, TicketUpdate } from "./types";
import { validateTicketInput } from "./normalizeTicket";

/**
 * Save a ticket for a user in Firestore
 *
 * Structure: /users/{uid}/tickets/{ticketId}
 *
 * @param uid - User ID
 * @param ticketInput - Ticket data to save
 * @returns Document reference of created ticket
 * @throws Error if validation fails or Firestore operation fails
 */
export async function saveTicketForUser(
  uid: string,
  ticketInput: TicketInput
): Promise<DocumentReference> {
  // Validate input
  const errors = validateTicketInput(ticketInput);
  if (errors.length > 0) {
    throw new Error(`Valideringsfeil: ${errors.join(", ")}`);
  }

  try {
    const ticketsRef = collection(db, `users/${uid}/tickets`);

    // Prepare document data with server timestamp
    const ticketData = {
      ...ticketInput,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // Remove undefined fields (Firestore doesn't allow undefined)
    const cleanedData = Object.fromEntries(
      Object.entries(ticketData).filter(([_, value]) => value !== undefined)
    );

    // Add document to Firestore
    const docRef = await addDoc(ticketsRef, cleanedData);

    console.log(`[Firestore] Ticket saved: ${docRef.id} for user ${uid}`);

    return docRef;
  } catch (error: any) {
    console.error("[Firestore] Error saving ticket:", error);
    throw new Error(`Kunne ikke lagre billett: ${error.message}`);
  }
}

/**
 * Get all tickets for a user from Firestore
 *
 * @param uid - User ID
 * @returns Array of tickets (with IDs), sorted by creation date (newest first)
 * @throws Error if Firestore operation fails
 */
export async function getTicketsForUser(uid: string): Promise<Ticket[]> {
  try {
    const ticketsRef = collection(db, `users/${uid}/tickets`);
    const q = query(ticketsRef, orderBy("createdAt", "desc"));

    const snapshot = await getDocs(q);

    const tickets: Ticket[] = snapshot.docs.map((doc) => {
      const data = doc.data();

      return {
        id: doc.id,
        ...data,
        // Convert Firestore Timestamp to ISO string for easier consumption
        createdAt: timestampToISO(data.createdAt),
        updatedAt: data.updatedAt ? timestampToISO(data.updatedAt) : undefined,
      } as Ticket;
    });

    console.log(`[Firestore] Fetched ${tickets.length} tickets for user ${uid}`);

    return tickets;
  } catch (error: any) {
    console.error("[Firestore] Error fetching tickets:", error);
    throw new Error(`Kunne ikke hente billetter: ${error.message}`);
  }
}

/**
 * Get a single ticket by ID
 *
 * @param uid - User ID
 * @param ticketId - Ticket document ID
 * @returns Ticket data or null if not found
 */
export async function getTicketById(
  uid: string,
  ticketId: string
): Promise<Ticket | null> {
  try {
    const ticketRef = doc(db, `users/${uid}/tickets`, ticketId);
    const snapshot = await getDoc(ticketRef);

    if (!snapshot.exists()) {
      return null;
    }

    const data = snapshot.data();

    return {
      id: snapshot.id,
      ...data,
      createdAt: timestampToISO(data.createdAt),
      updatedAt: data.updatedAt ? timestampToISO(data.updatedAt) : undefined,
    } as Ticket;
  } catch (error: any) {
    console.error("[Firestore] Error fetching ticket:", error);
    throw new Error(`Kunne ikke hente billett: ${error.message}`);
  }
}

/**
 * Update a ticket (partial update)
 *
 * Note: For now, updates are done via client SDK.
 * In production (M7+), consider using Cloud Functions for critical updates.
 *
 * @param uid - User ID
 * @param ticketId - Ticket document ID
 * @param updates - Partial ticket data to update
 */
export async function updateTicket(
  uid: string,
  ticketId: string,
  updates: TicketUpdate
): Promise<void> {
  try {
    const ticketRef = doc(db, `users/${uid}/tickets`, ticketId);

    const updateData = {
      ...updates,
      updatedAt: serverTimestamp(),
    };

    // Remove undefined fields (Firestore doesn't allow undefined)
    const cleanedData = Object.fromEntries(
      Object.entries(updateData).filter(([_, value]) => value !== undefined)
    );

    // Note: Using setDoc with merge instead of updateDoc to handle missing fields gracefully
    // This is client-side for MVP; in production, use Cloud Function for validation
    const { setDoc } = await import("firebase/firestore");
    await setDoc(ticketRef, cleanedData, { merge: true });

    console.log(`[Firestore] Ticket updated: ${ticketId}`);
  } catch (error: any) {
    console.error("[Firestore] Error updating ticket:", error);
    throw new Error(`Kunne ikke oppdatere billett: ${error.message}`);
  }
}

/**
 * Delete a ticket
 *
 * @param uid - User ID
 * @param ticketId - Ticket document ID
 */
export async function deleteTicket(uid: string, ticketId: string): Promise<void> {
  try {
    const ticketRef = doc(db, `users/${uid}/tickets`, ticketId);
    const { deleteDoc } = await import("firebase/firestore");
    await deleteDoc(ticketRef);

    console.log(`[Firestore] Ticket deleted: ${ticketId}`);
  } catch (error: any) {
    console.error("[Firestore] Error deleting ticket:", error);
    throw new Error(`Kunne ikke slette billett: ${error.message}`);
  }
}

/**
 * Convert Firestore Timestamp to ISO 8601 string
 *
 * @param timestamp - Firestore Timestamp or ISO string
 * @returns ISO 8601 string
 */
function timestampToISO(
  timestamp: Timestamp | string | { seconds: number; nanoseconds: number }
): string {
  if (typeof timestamp === "string") {
    return timestamp; // Already ISO string
  }

  if (timestamp instanceof Timestamp) {
    return timestamp.toDate().toISOString();
  }

  // Plain object with seconds/nanoseconds
  if ("seconds" in timestamp) {
    return new Date(timestamp.seconds * 1000).toISOString();
  }

  // Fallback
  return new Date().toISOString();
}
