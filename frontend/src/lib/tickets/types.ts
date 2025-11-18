/**
 * Ticket domain model for TogRefusjon
 * Unified ticket structure for all import sources (QR, manual, email)
 */

export interface Ticket {
  // Firestore document ID (set by Firestore)
  id?: string;

  // User reference
  userId: string;

  // Core ticket data
  operator: string; // "Vy", "SJ", "Go-Ahead", etc.
  trainNumber: string; // "R20", "L14", etc.
  departureTime: string; // ISO 8601 timestamp
  arrivalTime?: string; // ISO 8601 timestamp (optional)
  fromStation: string; // "Oslo S", "Lillehammer", etc.
  toStation: string; // "Trondheim", "Bergen", etc.

  // Optional metadata
  passengerName?: string;
  seatInfo?: string;
  priceNOK?: number;
  currency?: string; // Default: "NOK"

  // Source tracking
  source: "qr" | "manual" | "email";

  // Relations
  journeyInstanceId?: string; // Links to journey tracking (M5)
  claimId?: string; // Links to claim document (M7)

  // Timestamps
  createdAt: string | FirebaseTimestamp; // ISO or Firestore serverTimestamp
  updatedAt?: string | FirebaseTimestamp;

  // Debug/audit
  raw?: any; // Original parsed payload (QR/email) for debugging
}

/**
 * Firestore Timestamp type (for type safety)
 */
export interface FirebaseTimestamp {
  seconds: number;
  nanoseconds: number;
}

/**
 * Input for creating a new ticket (before Firestore ID is assigned)
 */
export type TicketInput = Omit<Ticket, "id" | "createdAt" | "updatedAt"> & {
  createdAt?: string | FirebaseTimestamp;
  updatedAt?: string | FirebaseTimestamp;
};

/**
 * Partial ticket for updates
 */
export type TicketUpdate = Partial<Omit<Ticket, "id" | "userId" | "createdAt">> & {
  updatedAt?: string | FirebaseTimestamp;
};
