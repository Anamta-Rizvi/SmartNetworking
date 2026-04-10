import { apiFetch, API_BASE } from './client';

export interface MapEvent {
  id: number;
  title: string;
  location: string;
  starts_at: string;
  lat: number;
  lng: number;
  rsvp_count: number;
  tags: { id: number; name: string; category: string }[];
}

export interface MapUser {
  user_id: number;
  display_name: string;
  sharing_mode: string;
  lat: number;
  lng: number;
  updated_at: string;
}

export async function fetchMapEvents(bounds?: {
  sw_lat: number; sw_lng: number; ne_lat: number; ne_lng: number;
}): Promise<MapEvent[]> {
  const params = bounds
    ? `?sw_lat=${bounds.sw_lat}&sw_lng=${bounds.sw_lng}&ne_lat=${bounds.ne_lat}&ne_lng=${bounds.ne_lng}`
    : '';
  return apiFetch<MapEvent[]>(`/map/events${params}`);
}

export async function fetchMapUsers(): Promise<MapUser[]> {
  return apiFetch<MapUser[]>('/map/users');
}

export async function updateLocation(
  userId: number,
  lat: number,
  lng: number,
  sharingMode: 'everyone' | 'connections' | 'off',
  fuzzy: boolean,
  expiresMinutes?: number,
) {
  return apiFetch(`/map/users/${userId}/location`, {
    method: 'POST',
    body: JSON.stringify({ lat, lng, sharing_mode: sharingMode, fuzzy, expires_minutes: expiresMinutes }),
  });
}

export async function clearLocation(userId: number) {
  await fetch(`${API_BASE}/map/users/${userId}/location`, { method: 'DELETE' });
}
