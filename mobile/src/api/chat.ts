import { apiFetch } from './client';

export interface DirectMessage {
  id: number;
  sender_id: number;
  receiver_id: number;
  content: string;
  is_ai_generated: boolean;
  read_at?: string;
  created_at: string;
}

export interface Conversation {
  peer: {
    id: number;
    display_name: string;
    avatar_url?: string;
    major?: string;
  };
  last_message?: DirectMessage;
  unread_count: number;
}

export interface ReferralSuggestionPeer {
  user_id: number;
  display_name: string;
  major?: string;
  avatar_url?: string;
  shared_event_id?: number;
  shared_event_title?: string;
}

export function getConversations(userId: number): Promise<Conversation[]> {
  return apiFetch(`/chat/${userId}/conversations`);
}

export function getMessages(userId: number, peerId: number): Promise<DirectMessage[]> {
  return apiFetch(`/chat/${userId}/messages/${peerId}`);
}

export function sendMessage(payload: {
  sender_id: number;
  receiver_id: number;
  content: string;
  is_ai_generated?: boolean;
}): Promise<DirectMessage> {
  return apiFetch('/chat/send', { method: 'POST', body: JSON.stringify(payload) });
}

export function getReferralSuggestions(
  userId: number
): Promise<{ suggestions: ReferralSuggestionPeer[] }> {
  return apiFetch(`/chat/${userId}/referral-suggestions`);
}

export function sendBulkAIMessage(payload: {
  sender_id: number;
  receiver_ids: number[];
  event_id?: number;
}): Promise<DirectMessage[]> {
  return apiFetch('/chat/bulk-ai-message', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
