import { apiFetch } from './client';

export interface ClassSlot {
  id: number;
  user_id: number;
  class_name: string;
  day_of_week: number; // 0=Mon … 6=Sun
  start_time: string;  // "HH:MM"
  end_time: string;
}

export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function getSchedule(userId: number): Promise<ClassSlot[]> {
  return apiFetch(`/schedule/${userId}`);
}

export function addClass(slot: Omit<ClassSlot, 'id'>): Promise<ClassSlot> {
  return apiFetch('/schedule', { method: 'POST', body: JSON.stringify(slot) });
}

export function deleteClass(slotId: number): Promise<void> {
  return apiFetch(`/schedule/${slotId}`, { method: 'DELETE' });
}
