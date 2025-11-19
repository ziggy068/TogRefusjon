/**
 * Delay Check Types for Cloud Functions (TR-TS-402)
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
  source: 'AUTO' | 'MANUAL';

  // Optional message for debugging/display
  message?: string;

  // Trimmed Entur response (not full dump)
  rawEntur?: any;
}

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

export interface JourneyToCheck {
  journeyInstanceId: string;
  trainNumber: string;
  operator: string;
  serviceDate: string;
  fromStopPlaceId: string;
  toStopPlaceId: string;
  plannedDepartureUTC: Date;
  plannedArrivalUTC: Date;
  lastDelayCheckAt?: Date;
}
