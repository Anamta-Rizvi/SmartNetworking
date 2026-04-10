import { apiFetch } from './client';

export interface CompanyPreference {
  id: number;
  user_id: number;
  company_name: string;
  job_role?: string;
}

export function getCompanyPreferences(userId: number): Promise<CompanyPreference[]> {
  return apiFetch(`/companies/${userId}`);
}

export function addCompanyPreference(
  userId: number,
  companyName: string,
  jobRole?: string
): Promise<CompanyPreference> {
  return apiFetch('/companies', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, company_name: companyName, job_role: jobRole }),
  });
}

export function deleteCompanyPreference(prefId: number): Promise<void> {
  return apiFetch(`/companies/${prefId}`, { method: 'DELETE' });
}

export function getSuggestedCompanies(userId: number): Promise<{ suggestions: string[] }> {
  return apiFetch(`/companies/${userId}/suggestions`);
}
