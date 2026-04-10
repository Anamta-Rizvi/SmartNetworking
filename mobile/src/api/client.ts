// For iOS Simulator use localhost. For physical device, replace with your machine's local IP.
// e.g. 'http://192.168.1.x:8000'
export const API_BASE = 'http://172.25.199.30:8000';

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const error = await res.text();
    throw new Error(error || `HTTP ${res.status}`);
  }
  return res.json();
}
