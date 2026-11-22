const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();

if (import.meta.env.PROD && !configuredApiUrl?.startsWith('https://')) {
  throw new Error('Set VITE_API_URL to the HTTPS API URL before creating a production build.');
}

export const API_BASE_URL = (
  configuredApiUrl || 'http://localhost:8000'
).replace(/\/+$/, '');

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() || '';
export const GOOGLE_AUTH_ENABLED = Boolean(GOOGLE_CLIENT_ID);
