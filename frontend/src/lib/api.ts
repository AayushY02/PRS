import axios from 'axios';

// In production, default to same-site relative "/api" paths so cookies are first-party.
// In local dev, fall back to http://localhost:8080 when no env override is set.
const envBase = (import.meta.env.VITE_API_BASE as string | undefined)?.trim();
const isLocalhost = typeof window !== 'undefined' && /^localhost(?::\d+)?$/.test(window.location.hostname);

export const api = axios.create({
  baseURL: envBase || (isLocalhost ? 'http://localhost:8080' : undefined),
  withCredentials: true,
});

const refreshClient = axios.create({
  baseURL: envBase || (isLocalhost ? 'http://localhost:8080' : undefined),
  withCredentials: true,
});

let refreshPromise: Promise<void> | null = null;

const shouldSkipRefresh = (url?: string) => {
  if (!url) return false;
  return url.includes('/api/auth/login')
    || url.includes('/api/auth/signup')
    || url.includes('/api/auth/logout')
    || url.includes('/api/auth/refresh');
};

async function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = refreshClient.post('/api/auth/refresh').then(() => {}).finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error?.config as (typeof error.config & { _retry?: boolean } | undefined);
    if (!original || original._retry) {
      return Promise.reject(error);
    }

    if (error?.response?.status === 401 && !shouldSkipRefresh(original.url)) {
      original._retry = true;
      try {
        await refreshSession();
        return api(original);
      } catch (err) {
        return Promise.reject(err);
      }
    }

    return Promise.reject(error);
  }
);
