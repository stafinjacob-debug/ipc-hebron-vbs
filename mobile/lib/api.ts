import Constants from 'expo-constants';

export function getApiBase(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  const extra = Constants.expoConfig?.extra as { apiUrl?: string } | undefined;
  const base = (fromEnv ?? extra?.apiUrl ?? 'http://localhost:3000').replace(
    /\/$/,
    '',
  );
  return base;
}

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const url = `${getApiBase()}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = new Headers(options.headers);
  if (
    options.body &&
    !headers.has('Content-Type') &&
    !(options.body instanceof FormData)
  ) {
    headers.set('Content-Type', 'application/json');
  }
  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`);
  }
  let res: Response;
  try {
    res = await fetch(url, { ...options, headers });
  } catch (e) {
    const hint =
      e instanceof Error ? e.message : 'Unknown network error';
    throw new ApiError(
      `Network error (${hint}). Check EXPO_PUBLIC_API_URL, HTTPS, and that the device can reach the server.`,
      0,
      e,
    );
  }
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    const fromJson =
      typeof data === 'object' &&
      data !== null &&
      'error' in data &&
      typeof (data as { error: unknown }).error === 'string'
        ? (data as { error: string }).error
        : null;
    const snippet =
      typeof data === 'string'
        ? data.replace(/\s+/g, ' ').slice(0, 160)
        : null;
    const base =
      fromJson ??
      (res.statusText?.trim() || 'Request failed');
    const detail = snippet && !fromJson ? ` Body: ${snippet}` : '';
    const msg = `${base} (HTTP ${res.status})${detail}`;
    throw new ApiError(msg, res.status, data);
  }
  return data as T;
}
