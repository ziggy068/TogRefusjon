/**
 * Claim Letter Model
 *
 * Defines the data structure for a claim letter (kravbrev) that can be:
 * - Generated from claim + evidence + ticket + user profile
 * - Rendered as text/HTML for preview
 * - Later exported to PDF (M7)
 * - Sent to train operators
 *
 * This is NOT the PDF itself, but the structured data model.
 */

import { Timestamp } from 'firebase/firestore';

// ============================================================================
// Party Information (Sender & Recipient)
// ============================================================================

/**
 * Information about a party (sender or recipient) in the claim letter
 */
export interface ClaimLetterParty {
  name: string;
  email?: string;
  address?: string;
  phone?: string;
}

// ============================================================================
// Journey Information
// ============================================================================

/**
 * Key facts about the delayed/cancelled journey
 */
export interface ClaimLetterJourneyInfo {
  // Journey identification
  operator: string; // "Vy"
  trainNumber: string; // "601"
  serviceDate: string; // "2025-01-17" (YYYY-MM-DD)

  // Route
  fromStationName: string; // "Oslo S"
  toStationName: string; // "Bergen stasjon"
  fromStopPlaceId: string; // "NSR:StopPlace:59872"
  toStopPlaceId: string; // "NSR:StopPlace:418"

  // Timing
  plannedDeparture: Date;
  plannedArrival: Date;
  actualDeparture?: Date;
  actualArrival?: Date;
  expectedArrival?: Date;
  delayMinutesArrival: number;
  isCancelled: boolean;

  // Cause (optional, depending on what we want to disclose)
  humanReadableCause?: string;
}

// ============================================================================
// Legal Section
// ============================================================================

/**
 * Legal basis and references for the claim
 */
export interface ClaimLetterLegalSection {
  // Legal references
  legalBasisRefs: string[]; // e.g., ["EU_2021_782_art19", "NO_jernbane_forskrift_2023"]

  // Rule version used for decision
  ruleVersionAtDecision: string; // "v1.0-delay-only-mvp"

  // Force majeure flag
  forceMajeure: boolean;

  // Human-readable legal texts (generated from legalBasisRefs)
  legalTexts: string[];
}

// ============================================================================
// Compensation Information
// ============================================================================

/**
 * Compensation amount and calculation
 */
export interface ClaimLetterCompensation {
  ticketPriceNOK: number; // 500
  compensationPct: number; // 25, 50, or 100
  compensationAmountNOK: number; // 125, 250, or 500
}

// ============================================================================
// Metadata
// ============================================================================

/**
 * Metadata about the claim and letter generation
 */
export interface ClaimLetterMetadata {
  claimId: string;
  journeyInstanceId: string;
  ruleVersionAtDecision: string;
  generatedAt: Date;
}

// ============================================================================
// Main Letter Model
// ============================================================================

/**
 * Complete claim letter model
 *
 * This is the main data structure that contains all information needed
 * to generate a claim letter in any format (text, HTML, PDF).
 */
export interface ClaimLetterModel {
  // Parties
  from: ClaimLetterParty; // Passenger (sender)
  to: ClaimLetterParty; // Train operator (recipient)

  // Subject line (computed from journey info)
  subject: string;

  // Journey details
  journey: ClaimLetterJourneyInfo;

  // Legal basis
  legal: ClaimLetterLegalSection;

  // Compensation
  compensation: ClaimLetterCompensation;

  // Metadata
  metadata: ClaimLetterMetadata;

  // Body paragraphs (in recommended order)
  // Each paragraph is a separate string for easy rendering
  bodyParagraphs: string[];
}
