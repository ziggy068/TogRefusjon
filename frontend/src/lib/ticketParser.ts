/**
 * Ticket parser for QR code data
 * Handles various Norwegian train ticket formats
 */

export interface ParsedTicket {
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  trainNo: string;
  from: string;
  to: string;
  rawData?: string; // Original QR payload for debugging
}

/**
 * Parse QR code payload into ticket data
 * Supports:
 * - JSON format: { date, time, trainNo, from, to }
 * - VY format: VY|date|time|trainNo|from|to
 * - Entur format: ENTUR|trainNo|from|to|date|time
 * - Generic fallback
 */
export function parseTicket(payload: string): ParsedTicket | null {
  if (!payload || typeof payload !== "string") {
    return null;
  }

  try {
    // Try JSON format first
    const jsonData = JSON.parse(payload);
    if (jsonData.date && jsonData.time && jsonData.trainNo && jsonData.from && jsonData.to) {
      return {
        date: formatDate(jsonData.date),
        time: formatTime(jsonData.time),
        trainNo: jsonData.trainNo,
        from: jsonData.from,
        to: jsonData.to,
        rawData: payload,
      };
    }
  } catch {
    // Not JSON, continue to other parsers
  }

  // Try VY format: VY|2025-11-13|07:00|R20|Oslo S|Lillehammer
  if (payload.startsWith("VY|")) {
    const parts = payload.split("|");
    if (parts.length >= 6) {
      return {
        date: formatDate(parts[1]),
        time: formatTime(parts[2]),
        trainNo: parts[3],
        from: parts[4],
        to: parts[5],
        rawData: payload,
      };
    }
  }

  // Try Entur format: ENTUR|R20|Oslo S|Lillehammer|2025-11-13|07:00
  if (payload.startsWith("ENTUR|")) {
    const parts = payload.split("|");
    if (parts.length >= 6) {
      return {
        date: formatDate(parts[4]),
        time: formatTime(parts[5]),
        trainNo: parts[1],
        from: parts[2],
        to: parts[3],
        rawData: payload,
      };
    }
  }

  // Generic pipe-separated format (try to guess structure)
  const parts = payload.split("|");
  if (parts.length >= 5) {
    // Try common patterns
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    const timePattern = /^\d{2}:\d{2}$/;

    for (let i = 0; i < parts.length - 4; i++) {
      if (datePattern.test(parts[i]) && timePattern.test(parts[i + 1])) {
        return {
          date: formatDate(parts[i]),
          time: formatTime(parts[i + 1]),
          trainNo: parts[i + 2] || "Ukjent",
          from: parts[i + 3] || "Ukjent",
          to: parts[i + 4] || "Ukjent",
          rawData: payload,
        };
      }
    }
  }

  // Could not parse - return null
  return null;
}

/**
 * Format date to YYYY-MM-DD
 */
function formatDate(dateStr: string): string {
  // Already in correct format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  // Try DD.MM.YYYY format
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateStr)) {
    const [day, month, year] = dateStr.split(".");
    return `${year}-${month}-${day}`;
  }

  // Try DD/MM/YYYY format
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    const [day, month, year] = dateStr.split("/");
    return `${year}-${month}-${day}`;
  }

  // Return as-is and let validation catch it
  return dateStr;
}

/**
 * Format time to HH:MM
 */
function formatTime(timeStr: string): string {
  // Already in correct format
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(timeStr)) {
    return timeStr.slice(0, 5); // Remove seconds if present
  }

  // Try HHMM format
  if (/^\d{4}$/.test(timeStr)) {
    return `${timeStr.slice(0, 2)}:${timeStr.slice(2, 4)}`;
  }

  // Return as-is and let validation catch it
  return timeStr;
}

/**
 * Create a draft object for localStorage
 */
export function createTicketDraft(parsed: ParsedTicket) {
  return {
    dato: parsed.date,
    klokkeslett: parsed.time,
    tognummer: parsed.trainNo,
    fra: parsed.from,
    til: parsed.to,
    beskrivelse: parsed.rawData ? `Skannet fra QR: ${parsed.rawData.slice(0, 100)}` : undefined,
  };
}
