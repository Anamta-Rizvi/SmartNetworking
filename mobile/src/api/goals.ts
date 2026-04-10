import { apiFetch } from './client';

export interface Goal {
  id: number;
  user_id: number;
  primary_type: string;
  career_track: string | null;
  social_intent: string | null;
  interests: string | null;
  social_pref_note: string | null;
}

export const upsertGoal = (data: {
  user_id: number;
  primary_type: string;
  career_track?: string;
  social_intent?: string;
  interests?: string[];
  social_pref_note?: string;
}) => apiFetch<Goal>('/goals/', { method: 'POST', body: JSON.stringify(data) });

export const getGoal = (userId: number) =>
  apiFetch<Goal>(`/goals/${userId}`);
