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
  // Auth validation errors
  'weak_password': 'This password is too common or has appeared in a data breach. Please choose a stronger password.',
  'email_exists': 'This email is already registered. Please log in or use a different email.',
  'signup_disabled': 'New signups are currently disabled.',
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
  '22023': 'Some information is invalid. Please check the form and try again.',
};

// Common business logic error patterns
const BUSINESS_ERROR_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  { pattern: /email.*already.*exists/i, message: 'This email is already registered.' },
  { pattern: /user.*already.*registered/i, message: 'This email is already registered. Please log in or use a different email.' },
  { pattern: /already.*registered/i, message: 'This email is already registered. Please log in or use a different email.' },
  { pattern: /weak.?password|password.*weak|known.*weak|easy to guess|password.*should.*be|password.*at least/i, message: 'This password is too common or easy to guess. Please choose a stronger password.' },
  { pattern: /pwned|leaked.*password|compromised/i, message: 'This password has appeared in a data breach. Please choose a different one.' },
  { pattern: /signups.*disabled|signup.*not.*allowed/i, message: 'New signups are currently disabled.' },
  { pattern: /invalid.*email|email.*invalid/i, message: 'Please enter a valid email address.' },
  { pattern: /rate.?limit|too many requests/i, message: 'Too many attempts. Please wait a moment and try again.' },
  { pattern: /company_email/i, message: 'This company email is already registered.' },
  { pattern: /company.*email.*already|company.*already.*exists/i, message: 'A company with this email already exists.' },
  { pattern: /valid company email|valid email/i, message: 'Please enter a valid company email address.' },
  { pattern: /VAT number.*VAT cycle.*next VAT submission/i, message: 'Please complete all VAT fields or turn VAT Registered off.' },
  { pattern: /unique.*violation/i, message: 'This record already exists.' },
  { pattern: /not.*authenticated/i, message: 'Please log in to continue.' },
  { pattern: /organization.*not.*found/i, message: 'Organization not found.' },
  { pattern: /profile.*not.*found/i, message: 'User profile not found.' },
];

const GENERIC_ERROR = 'An error occurred. Please try again or contact support.';

function getErrorValue(error: unknown, key: 'code' | 'message'): string | undefined {
  if (typeof error === 'object' && error !== null && key in error) {
    const value = (error as Record<string, unknown>)[key];
    return typeof value === 'string' ? value : undefined;
  }

  return undefined;
}

/**
 * Get a safe, user-friendly error message
 * In production, this sanitizes error details to prevent information leakage
 * In development, it provides more detail for debugging
 */
export function getSafeErrorMessage(error: unknown): string {
  // In development, show the actual error for debugging
  if (import.meta.env.DEV) {
    return getErrorValue(error, 'message') || GENERIC_ERROR;
  }

  // In production, sanitize the error message
  const errorCode = getErrorValue(error, 'code');
  const errorMessage = getErrorValue(error, 'message') || '';

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
export function logError(context: string, error: unknown): void {
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
export function handleServiceError(context: string, error: unknown): string {
  logError(context, error);
  return getSafeErrorMessage(error);
}

/**
 * Check if an error is an authentication error
 */
export function isAuthError(error: unknown): boolean {
  const errorMessage = getErrorValue(error, 'message')?.toLowerCase() || '';
  return (
    errorMessage.includes('not authenticated') ||
    errorMessage.includes('jwt') ||
    errorMessage.includes('token') ||
    getErrorValue(error, 'code') === '42501'
  );
}

/**
 * Check if an error is a not found error
 */
export function isNotFoundError(error: unknown): boolean {
  return getErrorValue(error, 'code') === 'PGRST116';
}
