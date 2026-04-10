import { API_BASE } from './client';

export async function uploadAvatar(userId: number, imageUri: string): Promise<{ avatar_url: string }> {
  const formData = new FormData();
  formData.append('file', {
    uri: imageUri,
    type: 'image/jpeg',
    name: 'avatar.jpg',
  } as any);

  const res = await fetch(`${API_BASE}/uploads/avatar?user_id=${userId}`, {
    method: 'POST',
    body: formData,
    // Don't set Content-Type — let fetch set multipart boundary automatically
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `HTTP ${res.status}`);
  }

  return res.json();
}
