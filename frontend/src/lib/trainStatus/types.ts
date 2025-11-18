/**
 * Train Status Types (TR-TS-401)
 *
 * Types for delay checking and train status monitoring
 */

/**
 * Result from a delay check operation
 *
 * Used to store the result of checking a journey's delay status via Entur API.
 * This type is designed to be simple for MVP on-demand checks.
 */
export interface DelayResult {
  // Identity
  journeyInstanceId: string;
  trainNumber: string;
  operator?: string;

  // Times (all ISO 8601 strings)
  plannedDepartureTime?: string;
  actualDepartureTime?: string;
  plannedArrivalTime?: string;
  actualArrivalTime?: string;

  // Calculated delays (in minutes, can be negative for early trains)
  departureDelayMinutes?: number;
  arrivalDelayMinutes?: number;

  // Overall status
  status: 'ON_TIME' | 'DELAYED' | 'CANCELLED' | 'UNKNOWN';

  // Metadata
  checkedAt: string; // ISO timestamp when check was performed
  rawEntur?: any; // Full/partial Entur response for debugging

  // Optional message for debugging/display
  message?: string;
}

/**
 * Parameters for checking delay
 */
export interface DelayCheckParams {
  journeyInstanceId: string;
  trainNumber?: string;
  operatorCode?: string;
  plannedDepartureTime?: string; // ISO
  plannedArrivalTime?: string; // ISO
  serviceDate?: string; // YYYY-MM-DD
  fromStopPlaceId?: string;
  toStopPlaceId?: string;
}
