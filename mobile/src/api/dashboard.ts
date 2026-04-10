import { apiFetch } from './client';

export interface Milestone {
  title: string;
  target_count: number;
  current_count: number;
}

export interface GoalEvent {
  id: number;
  user_id: number;
  event_id: number;
  goal_type: 'career' | 'social';
  contribution_score: number;
  contribution_label: string | null;
  attended: boolean | null;
  added_by: string;
  added_at: string;
  event: {
    id: number;
    title: string;
    location: string;
    starts_at: string;
    ends_at: string | null;
    rsvp_count: number;
    tags: { id: number; name: string; category: string }[];
    lat: number | null;
    lng: number | null;
  };
}

export interface GoalDashboard {
  goal_id: number;
  primary_type: string;
  career_milestones: Milestone[];
  social_milestones: Milestone[];
  career_events: GoalEvent[];
  social_events: GoalEvent[];
  career_progress: number;
  social_progress: number;
}

export interface ScheduleFit {
  fits: boolean;
  conflicts: { event_id: number; title: string }[];
}

export async function fetchDashboard(userId: number): Promise<GoalDashboard> {
  return apiFetch<GoalDashboard>(`/goals/${userId}/dashboard`);
}

export async function fetchGoalDashboard(userId: number, goalId: number): Promise<GoalDashboard> {
  return apiFetch<GoalDashboard>(`/goals/${userId}/dashboard?goal_id=${goalId}`);
}

export async function addGoalEvent(
  userId: number,
  eventId: number,
  goalType: 'career' | 'social',
  contributionScore: number,
  contributionLabel: string,
  addedBy: 'copilot' | 'user' = 'copilot',
): Promise<GoalEvent> {
  return apiFetch<GoalEvent>(`/goals/${userId}/events`, {
    method: 'POST',
    body: JSON.stringify({
      user_id: userId,
      event_id: eventId,
      goal_type: goalType,
      contribution_score: contributionScore,
      contribution_label: contributionLabel,
      added_by: addedBy,
    }),
  });
}

export async function markAttendance(
  userId: number,
  eventId: number,
  attended: boolean,
  goalType: 'career' | 'social' = 'career',
): Promise<GoalEvent> {
  return apiFetch<GoalEvent>(`/goals/${userId}/events/${eventId}?goal_type=${goalType}`, {
    method: 'PATCH',
    body: JSON.stringify({ attended }),
  });
}

export async function removeGoalEvent(
  userId: number,
  eventId: number,
  goalType: 'career' | 'social' = 'career',
): Promise<void> {
  await apiFetch(`/goals/${userId}/events/${eventId}?goal_type=${goalType}`, { method: 'DELETE' });
}

export async function checkScheduleFit(userId: number, eventId: number): Promise<ScheduleFit> {
  return apiFetch<ScheduleFit>(`/goals/${userId}/schedule-fit/${eventId}`);
}
