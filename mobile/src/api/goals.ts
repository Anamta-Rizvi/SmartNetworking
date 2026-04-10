import { apiFetch } from './client';

export interface Goal {
  id: number;
  user_id: number;
  primary_type: string;
  career_track: string | null;
  social_intent: string | null;
  interests: string | null;
  social_pref_note: string | null;
  status: 'ongoing' | 'completed';
  created_at: string;
}

export const updateGoalStatus = (goalId: number, status: 'ongoing' | 'completed') =>
  apiFetch<Goal>(`/goals/${goalId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });

export const createGoal = (data: {
  user_id: number;
  primary_type: string;
  career_track?: string;
  social_intent?: string;
  interests?: string[];
  social_pref_note?: string;
  timeline?: string;
}) => apiFetch<Goal>('/goals/', { method: 'POST', body: JSON.stringify(data) });

/** @deprecated use createGoal */
export const upsertGoal = createGoal;

export const getGoals = (userId: number) =>
  apiFetch<Goal[]>(`/goals/${userId}`);

/** Returns only the most recently created goal, or null if none. */
export const getGoal = async (userId: number): Promise<Goal | null> => {
  const goals = await getGoals(userId);
  return goals.length > 0 ? goals[0] : null;
};
