import { apiFetch } from './client';

export interface Referral {
  id: number;
  user_id: number;
  company_name: string;
  contact_name?: string;
  notes?: string;
  event_id?: number;
  received_at: string;
}

export function getReferrals(userId: number): Promise<Referral[]> {
  return apiFetch(`/referrals/${userId}`);
}

export function logReferral(payload: {
  user_id: number;
  company_name: string;
  contact_name?: string;
  notes?: string;
  event_id?: number;
}): Promise<Referral> {
  return apiFetch('/referrals', { method: 'POST', body: JSON.stringify(payload) });
}

export function updateReferral(
  referralId: number,
  payload: { company_name?: string; contact_name?: string; notes?: string }
): Promise<Referral> {
  return apiFetch(`/referrals/${referralId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteReferral(referralId: number): Promise<void> {
  return apiFetch(`/referrals/${referralId}`, { method: 'DELETE' });
}
