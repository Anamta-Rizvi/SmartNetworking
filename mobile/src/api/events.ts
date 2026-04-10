import { apiFetch } from './client';

export interface Tag {
  id: number;
  name: string;
  category: string;
}

export interface Event {
  id: number;
  title: string;
  description: string;
  location: string;
  organizer: string;
  starts_at: string;
  ends_at: string | null;
  is_virtual: boolean;
  cover_image_url: string | null;
  rsvp_count: number;
  tags: Tag[];
}

export const fetchEvents = (category?: string) =>
  apiFetch<Event[]>(`/events/${category ? `?category=${category}` : ''}`);

export const fetchTodayEvents = () =>
  apiFetch<Event[]>('/events/today');

export const fetchEvent = (id: number) =>
  apiFetch<Event>(`/events/${id}`);

export const fetchTags = () =>
  apiFetch<Tag[]>('/events/tags');
