import { apiErrorKey, apiErrorMessage } from './apiErrorMessage';

/**
 * Central error mapper (Wave 14 DS2; same name on the website): localised, understandable text for a failed call,
 * chosen from the backend error `code` first, then the HTTP status, else `fallbackKey`. Server `message`s are
 * developer English and never reach the UI. Accepts an `ApiError`, a network failure ("no connection" text) and auth
 * results (`{ code, status }`), so the sign-in screens use it too. Implementation: `apiErrorMessage.ts`.
 */
export const mapApiError = apiErrorMessage;

/** Translation key variant of {@link mapApiError}. */
export const mapApiErrorKey = apiErrorKey;
