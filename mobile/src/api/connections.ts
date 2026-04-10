import { apiFetch, API_BASE } from './client';

export interface ConnectionUser {
  user_id: number;
  display_name: string;
  email: string;
  major: string | null;
  grad_year: number | null;
  connection_status: 'none' | 'pending_sent' | 'pending_received' | 'connected';
}

export interface ConnectionOut {
  id: number;
  requester_id: number;
  addressee_id: number;
  status: string;
  created_at: string;
  requester: { id: number; display_name: string; email: string };
  addressee: { id: number; display_name: string; email: string };
}

export interface UserOut {
  id: number;
  display_name: string;
  email: string;
  major: string | null;
  grad_year: number | null;
  university: string;
  avatar_url: string | null;
  connection_weight?: number;
}

export interface RSVPAttendeeOut {
  user_id: number;
  display_name: string;
  avatar_url: string | null;
  connection_status: string;
}

export interface FriendPresencePin {
  user_id: number;
  display_name: string;
  avatar_url: string | null;
  event_id: number;
  event_title: string;
  event_location: string;
  event_lat: number;
  event_lng: number;
  event_starts_at: string;
}

export async function sendConnectionRequest(requesterId: number, addresseeId: number): Promise<ConnectionOut> {
  return apiFetch<ConnectionOut>('/connections/request', {
    method: 'POST',
    body: JSON.stringify({ requester_id: requesterId, addressee_id: addresseeId }),
  });
}

export async function respondToRequest(
  connectionId: number,
  userId: number,
  status: 'accepted' | 'declined',
): Promise<ConnectionOut> {
  return apiFetch<ConnectionOut>(`/connections/${connectionId}?user_id=${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function getConnections(userId: number): Promise<UserOut[]> {
  return apiFetch<UserOut[]>(`/connections/${userId}`);
}

export async function getPendingRequests(userId: number): Promise<ConnectionOut[]> {
  return apiFetch<ConnectionOut[]>(`/connections/${userId}/pending`);
}

export async function removeConnection(connectionId: number, userId: number): Promise<void> {
  await fetch(`${API_BASE}/connections/${connectionId}?user_id=${userId}`, { method: 'DELETE' });
}

export async function searchUsers(q: string, userId: number): Promise<ConnectionUser[]> {
  return apiFetch<ConnectionUser[]>(`/connections/search?q=${encodeURIComponent(q)}&user_id=${userId}`);
}

export interface SuggestedUser extends ConnectionUser {
  score: number;
  reason: string;
  connection_weight?: number;
}

export interface RecentlyAccepted {
  connection_id: number;
  peer_id: number;
  peer_name: string;
  accepted_at: string;
}

export async function getSuggestions(userId: number): Promise<SuggestedUser[]> {
  return apiFetch<SuggestedUser[]>(`/connections/${userId}/suggestions`);
}

export async function getRecentlyAccepted(userId: number, minutes = 2): Promise<RecentlyAccepted[]> {
  return apiFetch<RecentlyAccepted[]>(`/connections/${userId}/recently-accepted?minutes=${minutes}`);
}

export async function fetchEventAttendees(eventId: number, userId: number): Promise<RSVPAttendeeOut[]> {
  return apiFetch<RSVPAttendeeOut[]>(`/events/${eventId}/attendees?user_id=${userId}`);
}

export async function fetchFriendPresence(userId: number): Promise<FriendPresencePin[]> {
  return apiFetch<FriendPresencePin[]>(`/map/users?user_id=${userId}`);
}
