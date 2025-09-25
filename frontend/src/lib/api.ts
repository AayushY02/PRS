import axios from 'axios';

// In production, default to same-site relative "/api" paths so cookies are first-party.
// In local dev, fall back to http://localhost:8080 when no env override is set.
const envBase = (import.meta.env.VITE_API_BASE as string | undefined)?.trim();
const isLocalhost = typeof window !== 'undefined' && /^localhost(?::\d+)?$/.test(window.location.hostname);

export const api = axios.create({
  baseURL: envBase || (isLocalhost ? 'http://localhost:8080' : undefined),
  withCredentials: true,
});
