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
  goal_relevance_score?: number | null;
  goal_relevance_label?: string | null;
}

export interface PeoplePin {
  user_id: number;
  display_name: string;
  avatar_url?: string | null;
  is_self: boolean;
  // Real GPS location
  lat?: number | null;
  lng?: number | null;
  // RSVP event context
  event_id?: number | null;
  event_title?: string | null;
  event_location?: string | null;
  event_lat?: number | null;
  event_lng?: number | null;
  event_starts_at?: string | null;
}

export interface HeatmapPoint {
  event_id: number;
  event_title: string;
  lat: number;
  lng: number;
  live_count: number;
  rsvp_count: number;
}

export async function fetchMapEvents(
  userId?: number | null,
  bounds?: { sw_lat: number; sw_lng: number; ne_lat: number; ne_lng: number },
): Promise<MapEvent[]> {
  const params = new URLSearchParams();
  if (userId) params.append('user_id', String(userId));
  if (bounds) {
    params.append('sw_lat', String(bounds.sw_lat));
    params.append('sw_lng', String(bounds.sw_lng));
    params.append('ne_lat', String(bounds.ne_lat));
    params.append('ne_lng', String(bounds.ne_lng));
  }
  const query = params.toString() ? `?${params.toString()}` : '';
  return apiFetch<MapEvent[]>(`/map/events${query}`);
}

export async function fetchPeoplePins(userId: number): Promise<PeoplePin[]> {
  return apiFetch<PeoplePin[]>(`/map/users?user_id=${userId}`);
}

export async function fetchHeatmap(): Promise<HeatmapPoint[]> {
  return apiFetch<HeatmapPoint[]>('/map/heatmap');
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
