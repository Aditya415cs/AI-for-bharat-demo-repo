/**
 * Environment configuration
 *
 * Values are read from EXPO_PUBLIC_* env vars (set in .env at project root).
 * Expo SDK 49+ automatically exposes EXPO_PUBLIC_* vars to the JS bundle.
 *
 * Fill in your actual values in .env — never commit real secrets to source control.
 */

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const BACKEND_API_KEY = process.env.EXPO_PUBLIC_BACKEND_API_KEY;

if (!BACKEND_URL) {
  console.warn(
    '[env] EXPO_PUBLIC_BACKEND_URL is not set. ' +
      'Add it to your .env file. Falling back to empty string.'
  );
}

if (!BACKEND_API_KEY) {
  console.warn(
    '[env] EXPO_PUBLIC_BACKEND_API_KEY is not set. ' +
      'Add it to your .env file. Falling back to empty string.'
  );
}

export const ENV = {
  BACKEND_URL: BACKEND_URL ?? '',
  BACKEND_API_KEY: BACKEND_API_KEY ?? '',
} as const;
