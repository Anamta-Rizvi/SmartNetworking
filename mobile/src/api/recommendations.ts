import { apiFetch } from './client';
import { Event } from './events';

export interface Recommendation {
  event: Event;
  score: number;
  reason: string;
}

export const getRecommendations = (userId: number, limit = 20) =>
  apiFetch<Recommendation[]>(`/recommendations/${userId}?limit=${limit}`);
