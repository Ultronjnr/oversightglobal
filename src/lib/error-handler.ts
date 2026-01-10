/**
 * Error handling utilities for secure error management
 * 
 * This module provides safe error handling that:
 * 1. Shows user-friendly messages in production
 * 2. Logs detailed errors only in development
 * 3. Prevents information leakage about database structure
 */

// Map of PostgreSQL error codes to user-friendly messages
const USER_ERROR_MESSAGES: Record<string, string> = {
  // Unique constraint violations
  '23505': 'This information is already in use. Please try different values.',
  // Foreign key violations
  '23503': 'Unable to complete this action due to related data.',
  // Not null violations
  '23502': 'Required information is missing. Please fill in all required fields.',
  // Check constraint violations
  '23514': 'The provided values are not valid. Please check your input.',
  // No rows found
  'PGRST116': 'The requested item could not be found.',
  // Row level security violation
  '42501': 'You do not have permission to perform this action.',
  // Invalid input
  '22P02': 'The provided input format is invalid.',
};

// Common business logic error patterns
const BUSINESS_ERROR_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  { pattern: /email.*already.*exists/i, message: 'This email is already registered.' },
  { pattern: /company_email/i, message: 'This company email is already registered.' },
  { pattern: /unique.*violation/i, message: 'This record already exists.' },
  { pattern: /not.*authenticated/i, message: 'Please log in to continue.' },
  { pattern: /organization.*not.*found/i, message: 'Organization not found.' },
  { pattern: /profile.*not.*found/i, message: 'User profile not found.' },
];

const GENERIC_ERROR = 'An error occurred. Please try again or contact support.';

/**
 * Get a safe, user-friendly error message
 * In production, this sanitizes error details to prevent information leakage
 * In development, it provides more detail for debugging
 */
export function getSafeErrorMessage(error: any): string {
  // In development, show the actual error for debugging
  if (import.meta.env.DEV) {
    return error?.message || GENERIC_ERROR;
  }

  // In production, sanitize the error message
  const errorCode = error?.code;
  const errorMessage = error?.message || '';

  // Check for known PostgreSQL error codes
  if (errorCode && USER_ERROR_MESSAGES[errorCode]) {
    return USER_ERROR_MESSAGES[errorCode];
  }

  // Check for business logic patterns
  for (const { pattern, message } of BUSINESS_ERROR_PATTERNS) {
    if (pattern.test(errorMessage)) {
      return message;
    }
  }

  // Return generic error for unknown errors
  return GENERIC_ERROR;
}

/**
 * Log errors safely
 * Only logs detailed errors in development
 * In production, logs are minimized to prevent information exposure
 */
export function logError(context: string, error: any): void {
  if (import.meta.env.DEV) {
    console.error(`[${context}]`, error);
  }
  // In production, we intentionally don't log to console
  // as this exposes information to anyone with DevTools
  // In a real production app, you would send to a monitoring service like Sentry
}

/**
 * Handle API/service errors with consistent pattern
 * Returns a sanitized error message suitable for display
 */
export function handleServiceError(context: string, error: any): string {
  logError(context, error);
  return getSafeErrorMessage(error);
}

/**
 * Check if an error is an authentication error
 */
export function isAuthError(error: any): boolean {
  const errorMessage = error?.message?.toLowerCase() || '';
  return (
    errorMessage.includes('not authenticated') ||
    errorMessage.includes('jwt') ||
    errorMessage.includes('token') ||
    error?.code === '42501'
  );
}

/**
 * Check if an error is a not found error
 */
export function isNotFoundError(error: any): boolean {
  return error?.code === 'PGRST116';
}
