/**
 * Validation utilities for Tog Refusjon
 * TR-FE-103: Form validation
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates email format
 */
export function validateEmail(email: string): ValidationResult {
  if (!email || email.trim().length === 0) {
    return { isValid: false, error: "E-post er påkrevd" };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { isValid: false, error: "Ugyldig e-postformat" };
  }

  return { isValid: true };
}

/**
 * Validates password strength
 */
export function validatePassword(password: string): ValidationResult {
  if (!password || password.length === 0) {
    return { isValid: false, error: "Passord er påkrevd" };
  }

  if (password.length < 8) {
    return { isValid: false, error: "Passord må være minst 8 tegn" };
  }

  return { isValid: true };
}

/**
 * Validates file upload
 * @param file File object
 * @param options Validation options
 */
export interface FileValidationOptions {
  maxSizeMB?: number;
  allowedTypes?: string[];
  allowedExtensions?: string[];
}

export function validateFile(
  file: File | null,
  options: FileValidationOptions = {}
): ValidationResult {
  const {
    maxSizeMB = 10,
    allowedTypes = ["image/jpeg", "image/png", "image/jpg", "application/pdf"],
    allowedExtensions = [".jpg", ".jpeg", ".png", ".pdf"],
  } = options;

  if (!file) {
    return { isValid: false, error: "Ingen fil valgt" };
  }

  // Check file size
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return {
      isValid: false,
      error: `Filen er for stor (maks ${maxSizeMB} MB)`,
    };
  }

  // Check file type
  if (!allowedTypes.includes(file.type)) {
    return {
      isValid: false,
      error: "Ugyldig filtype (kun JPG, PNG, PDF)",
    };
  }

  // Check file extension
  const fileName = file.name.toLowerCase();
  const hasValidExtension = allowedExtensions.some((ext) =>
    fileName.endsWith(ext)
  );

  if (!hasValidExtension) {
    return {
      isValid: false,
      error: "Ugyldig filtype (kun .jpg, .png, .pdf)",
    };
  }

  return { isValid: true };
}

/**
 * Validates required field
 */
export function validateRequired(
  value: string | boolean | null | undefined,
  fieldName: string = "Felt"
): ValidationResult {
  if (value === null || value === undefined || value === "") {
    return { isValid: false, error: `${fieldName} er påkrevd` };
  }

  if (typeof value === "boolean" && !value) {
    return { isValid: false, error: `${fieldName} må godkjennes` };
  }

  return { isValid: true };
}

/**
 * Validates consent checkbox
 */
export function validateConsent(checked: boolean): ValidationResult {
  if (!checked) {
    return {
      isValid: false,
      error: "Du må godta vilkårene for å fortsette",
    };
  }
  return { isValid: true };
}

/**
 * Validates phone number (Norwegian format)
 */
export function validatePhoneNumber(phone: string): ValidationResult {
  if (!phone || phone.trim().length === 0) {
    return { isValid: false, error: "Telefonnummer er påkrevd" };
  }

  // Norwegian phone: +47 followed by 8 digits, or just 8 digits
  const phoneRegex = /^(\+47)?[4-9]\d{7}$/;
  const cleanedPhone = phone.replace(/\s/g, "");

  if (!phoneRegex.test(cleanedPhone)) {
    return {
      isValid: false,
      error: "Ugyldig telefonnummer (8 siffer, starter 4-9)",
    };
  }

  return { isValid: true };
}

/**
 * Generic form validation
 */
export function validateForm<T extends Record<string, unknown>>(
  data: T,
  validators: {
    [K in keyof T]?: (value: T[K]) => ValidationResult;
  }
): { isValid: boolean; errors: Partial<Record<keyof T, string>> } {
  const errors: Partial<Record<keyof T, string>> = {};
  let isValid = true;

  for (const field in validators) {
    const validator = validators[field];
    if (validator) {
      const result = validator(data[field]);
      if (!result.isValid) {
        errors[field] = result.error;
        isValid = false;
      }
    }
  }

  return { isValid, errors };
}
