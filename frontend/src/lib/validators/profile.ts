import { z } from "zod";

/**
 * IBAN validator (simplified)
 * Accepts Norwegian account numbers (11 digits) or basic IBAN format
 */
const ibanRegex = /^([A-Z]{2}[0-9]{2}[A-Z0-9]+|\d{11})$/;

export const profileSchema = z.object({
  fullName: z
    .string()
    .min(2, "Navn må være minst 2 tegn")
    .max(80, "Navn kan være maks 80 tegn")
    .trim(),
  email: z.string().email("Ugyldig e-postadresse"),
  iban: z
    .string()
    .trim()
    .regex(ibanRegex, "Ugyldig kontonummer (bruk 11 siffer eller IBAN-format)")
    .optional()
    .or(z.literal("")),
  consentDataProcessing: z.boolean(),
});

export type ProfileFormData = z.infer<typeof profileSchema>;
