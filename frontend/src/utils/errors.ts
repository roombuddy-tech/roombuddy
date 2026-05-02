/**
 * Centralised helpers for surfacing API errors to the user.
 *
 * Why this exists:
 * - The backend returns errors in the shape `{ error, code }`.
 * - Some legacy responses use `{ detail }` (DRF default).
 * - In rare cases, axios/network errors surface with no body at all.
 * - Callers should NEVER show raw machine codes (e.g. "SELF_BOOKING") to
 *   users, and should NEVER concatenate multiple fields into one alert.
 *
 * Usage:
 *
 *     try {
 *       await someApiCall();
 *     } catch (err) {
 *       Alert.alert('Booking failed', getErrorMessage(err, 'Could not start booking'));
 *     }
 */

/**
 * Extracts a human-readable error message from any thrown value.
 *
 * @param err     The caught error (typically from an axios call).
 * @param fallback Message to use when no usable message can be extracted.
 */
export function getErrorMessage(err: unknown, fallback: string = 'Something went wrong'): string {
    if (!err) return fallback;
  
    // Axios-style errors with a JSON body
    const data = (err as any)?.response?.data;
  
    if (data && typeof data === 'object') {
      // Our standard shape: { error, code }
      if (typeof data.error === 'string' && data.error.trim()) {
        return data.error.trim();
      }
      // DRF default: { detail }
      if (typeof data.detail === 'string' && data.detail.trim()) {
        return data.detail.trim();
      }
      // Field-level validation: { field: ["msg"] }
      const firstFieldMessage = extractFirstFieldMessage(data);
      if (firstFieldMessage) return firstFieldMessage;
    }
  
    // Plain string body
    if (typeof data === 'string' && data.trim()) {
      return data.trim();
    }
  
    // JS Error message
    if (typeof (err as any)?.message === 'string' && (err as any).message.trim()) {
      return (err as any).message.trim();
    }
  
    return fallback;
  }
  
  /**
   * Extracts the machine code (e.g. "SELF_BOOKING") from an API error.
   * Useful when callers want to branch on specific error codes.
   *
   * Returns `null` if no recognisable code is present.
   */
  export function getErrorCode(err: unknown): string | null {
    const data = (err as any)?.response?.data;
    if (data && typeof data === 'object' && typeof data.code === 'string') {
      return data.code;
    }
    return null;
  }
  
  function extractFirstFieldMessage(data: Record<string, any>): string | null {
    for (const value of Object.values(data)) {
      if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
        return value[0];
      }
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
    return null;
  }
  