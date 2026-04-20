/**
 * API Helper with Retry Logic & Better Error Handling
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

/**
 * Retry a failed async operation with exponential backoff
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const config = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | null = null;
  let delayMs = config.initialDelayMs;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      console.log(`[API] Attempt ${attempt + 1}/${config.maxRetries + 1}`);
      return await operation();
    } catch (error) {
      lastError = error as Error;
      console.error(`[API] Attempt ${attempt + 1} failed:`, error);

      if (attempt < config.maxRetries) {
        console.log(`[API] Retrying in ${delayMs}ms...`);
        await sleep(delayMs);
        delayMs = Math.min(delayMs * config.backoffMultiplier, config.maxDelayMs);
      }
    }
  }

  throw lastError;
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Parse Supabase error for user-friendly messages
 */
export function getErrorMessage(error: any): string {
  if (!error) return 'Unknown error occurred';

  // Network/timeout errors
  if (error.message === 'Failed to fetch' || error.message?.includes('ERR_CONNECTION_TIMED_OUT')) {
    return 'Network connection failed. Please check your internet and try again.';
  }

  // Supabase auth errors
  if (error.message?.includes('unauthorized') || error.message?.includes('401')) {
    return 'Authentication failed. Please log in again.';
  }

  // Supabase policy errors
  if (error.message?.includes('policy')) {
    return 'You do not have permission to access this resource.';
  }

  // Generic Supabase error
  if (error.message) {
    return error.message;
  }

  return 'Something went wrong. Please try again.';
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: any): boolean {
  if (!error) return false;

  const retryableMessages = [
    'Failed to fetch',
    'ERR_CONNECTION_TIMED_OUT',
    'timeout',
    'ECONNREFUSED',
    'ECONNRESET',
    'Network request failed',
  ];

  const errorString = JSON.stringify(error).toLowerCase();
  return retryableMessages.some(msg => errorString.includes(msg.toLowerCase()));
}

/**
 * Add request timeout wrapper
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = 15000
): Promise<T> {
  const timeoutPromise = new Promise<T>((_, reject) =>
    setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
  );

  return Promise.race([promise, timeoutPromise]);
}
