import { AdminError } from '../types';

export const ADMIN_TOKEN_KEY = 'zin26_admin_token';

export async function adminFetch<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const token = sessionStorage.getItem(ADMIN_TOKEN_KEY);

  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (options.body && !headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      sessionStorage.removeItem(ADMIN_TOKEN_KEY);
      window.dispatchEvent(new CustomEvent('zin26:admin-unauthorised'));
    }

    const isJson = response.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await response.json() : null;

    if (!response.ok || (data && data.success === false)) {
      const errorMessage = data?.message || data?.error || `Request failed with status ${response.status}`;
      const errorCode = data?.error_code || `HTTP_${response.status}`;
      throw new AdminError(errorMessage, errorCode);
    }

    return data as T;
  } catch (error: any) {
    if (error instanceof AdminError) {
      throw error;
    }
    throw new AdminError(error.message || 'Network error occurred while connecting to server.');
  }
}
