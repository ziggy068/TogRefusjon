/**
 * Ticket normalization functions
 * Converts various input sources (QR, manual, email) into unified Ticket format
 */

import { TicketInput } from "./types";
import { ParsedTicket } from "../ticketParser";

/**
 * Normalize ticket data from QR code parsing
 *
 * @param parsed - Parsed QR code data
 * @param userId - Current user ID
 * @returns Normalized ticket input ready for Firestore
 */
export function normalizeFromQR(
  parsed: ParsedTicket,
  userId: string
): TicketInput {
  // Combine date + time into ISO 8601 timestamp
  const departureTime = `${parsed.date}T${parsed.time}:00.000Z`;

  return {
    userId,
    operator: inferOperator(parsed.trainNo), // Infer from train number prefix
    trainNumber: parsed.trainNo,
    departureTime,
    arrivalTime: undefined, // Not available from QR typically
    fromStation: parsed.from,
    toStation: parsed.to,
    source: "qr",
    raw: {
      rawData: parsed.rawData,
      parsedAt: new Date().toISOString(),
    },
  };
}

/**
 * Normalize ticket data from manual input form
 *
 * @param formData - Form data from manual input
 * @param userId - Current user ID
 * @returns Normalized ticket input ready for Firestore
 */
export function normalizeFromManual(
  formData: {
    operator: string;
    trainNumber?: string; // Optional in manual mode
    departureDate: string; // YYYY-MM-DD
    departureTime: string; // HH:MM
    arrivalDate?: string; // YYYY-MM-DD (optional)
    arrivalTime?: string; // HH:MM (optional)
    fromStation: string;
    toStation: string;
    passengerName?: string;
    seatInfo?: string;
    priceNOK?: number;
    notes?: string;
  },
  userId: string
): TicketInput {
  // Combine date + time into ISO 8601 timestamp
  const departureTimestamp = `${formData.departureDate}T${formData.departureTime}:00.000Z`;

  let arrivalTimestamp: string | undefined;
  if (formData.arrivalDate && formData.arrivalTime) {
    arrivalTimestamp = `${formData.arrivalDate}T${formData.arrivalTime}:00.000Z`;
  }

  return {
    userId,
    operator: formData.operator,
    trainNumber: formData.trainNumber || "UNKNOWN", // Use placeholder if not provided
    departureTime: departureTimestamp,
    arrivalTime: arrivalTimestamp,
    fromStation: formData.fromStation,
    toStation: formData.toStation,
    passengerName: formData.passengerName,
    seatInfo: formData.seatInfo,
    priceNOK: formData.priceNOK,
    currency: formData.priceNOK ? "NOK" : undefined,
    source: "manual",
    raw: formData.notes
      ? {
          notes: formData.notes,
          createdAt: new Date().toISOString(),
        }
      : undefined,
  };
}

/**
 * Infer train operator from train number prefix
 * Common Norwegian train operators and their numbering schemes:
 * - R (Regional): Vy
 * - L (Local): Vy
 * - F (Long-distance): Vy
 * - IC (InterCity): SJ Norge (previously Vy)
 * - GA (Go-Ahead): Go-Ahead Nordic
 */
function inferOperator(trainNumber: string): string {
  const prefix = trainNumber.charAt(0).toUpperCase();

  switch (prefix) {
    case "R":
    case "L":
    case "F":
      return "Vy";
    case "I": // IC trains
      if (trainNumber.startsWith("IC")) {
        return "SJ Norge";
      }
      return "Vy";
    case "G": // Go-Ahead
      if (trainNumber.startsWith("GA")) {
        return "Go-Ahead Nordic";
      }
      return "Ukjent";
    default:
      return "Ukjent";
  }
}

/**
 * Validate ticket input (basic checks)
 *
 * @param input - Ticket input to validate
 * @returns Array of validation errors (empty if valid)
 */
export function validateTicketInput(input: TicketInput): string[] {
  const errors: string[] = [];

  if (!input.userId) errors.push("Bruker-ID mangler");
  if (!input.trainNumber) errors.push("Tognummer er pakrevd");
  if (!input.departureTime) errors.push("Avgangstid er pakrevd");
  if (!input.fromStation) errors.push("Fra-stasjon er pakrevd");
  if (!input.toStation) errors.push("Til-stasjon er pakrevd");

  // Validate ISO 8601 timestamp format
  if (input.departureTime && !isValidISOTimestamp(input.departureTime)) {
    errors.push("Ugyldig avgangstid-format (maa vaere ISO 8601)");
  }

  if (input.arrivalTime && !isValidISOTimestamp(input.arrivalTime)) {
    errors.push("Ugyldig ankomsttid-format (maa vaere ISO 8601)");
  }

  return errors;
}

/**
 * Check if timestamp is valid ISO 8601 format
 */
function isValidISOTimestamp(timestamp: string): boolean {
  const date = new Date(timestamp);
  return !isNaN(date.getTime());
}
