import { apiFetch } from './client';
import { Tag } from './events';

export interface User {
  id: number;
  email: string;
  display_name: string;
  major: string | null;
  grad_year: number | null;
  university: string;
  avatar_url?: string | null;
  created_at: string;
  title?: string | null;  // "Student" | "Alumni" | "Senior" etc.
}

export interface RSVPWithConnections {
  rsvp_id: number;
  event_id: number;
  event_title: string;
  event_starts_at: string;
  event_location: string;
  connections_attending: { user_id: number; display_name: string; avatar_url?: string | null }[];
}

export interface RSVP {
  id: number;
  user_id: number;
  event_id: number;
  attended: boolean;
  created_at: string;
}

export const createUser = (data: {
  email: string;
  display_name: string;
  major?: string;
  grad_year?: number;
  university?: string;
}) => apiFetch<User>('/users/', { method: 'POST', body: JSON.stringify(data) });

export const getUser = (id: number) =>
  apiFetch<User>(`/users/${id}`);

export const loginByEmail = (email: string) =>
  apiFetch<User>(`/users/login/${encodeURIComponent(email.toLowerCase())}`);

export const setInterests = (userId: number, tagIds: number[]) =>
  apiFetch(`/users/${userId}/interests`, {
    method: 'POST',
    body: JSON.stringify({ tag_ids: tagIds }),
  });

export const getInterests = (userId: number) =>
  apiFetch<Tag[]>(`/users/${userId}/interests`);

export const getUserRSVPs = (userId: number) =>
  apiFetch<RSVP[]>(`/users/${userId}/rsvps`);

export const createRSVP = (userId: number, eventId: number) =>
  apiFetch<RSVP>('/users/rsvp', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, event_id: eventId }),
  });

export const deleteRSVP = (rsvpId: number) =>
  apiFetch(`/users/rsvp/${rsvpId}`, { method: 'DELETE' });

export const getRsvpsWithConnections = (userId: number) =>
  apiFetch<RSVPWithConnections[]>(`/users/${userId}/rsvps/connections`);
