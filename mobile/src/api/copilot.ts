import { API_BASE } from './client';

export type CopilotMode =
  | 'goal_setup'
  | 'networking'
  | 'elevator_pitch'
  | 'icebreaker'
  | 'followup'
  | 'daily_planner'
  | 'progress_review';

export interface EventSuggestion {
  event_id: number;
  title: string;
  location: string;
  starts_at: string;
  contribution_label: string;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function streamCopilotChat(
  userId: number,
  mode: CopilotMode,
  messages: Message[],
  context: Record<string, unknown>,
  onChunk: (text: string) => void,
  onDone: () => void,
  onSuggestion?: (suggestion: EventSuggestion) => void,
) {
  const xhr = new XMLHttpRequest();
  xhr.open('POST', `${API_BASE}/copilot/chat`, true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.responseType = 'text';

  let cursor = 0; // how many chars of responseText we've already processed

  function processChunk(text: string) {
    const lines = text.split('\n');
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') { onDone(); return; }
      try {
        const parsed = JSON.parse(data);
        if (parsed.content) onChunk(parsed.content);
        if (parsed.suggestion && onSuggestion) onSuggestion(parsed.suggestion);
      } catch {}
    }
  }

  xhr.onprogress = () => {
    const newText = xhr.responseText.slice(cursor);
    cursor = xhr.responseText.length;
    if (newText) processChunk(newText);
  };

  xhr.onload = () => {
    // process anything not caught by onprogress
    const remaining = xhr.responseText.slice(cursor);
    if (remaining) processChunk(remaining);
    onDone();
  };

  xhr.onerror = () => {
    console.error('[Copilot] XHR error');
    onChunk('Network error — could not reach the server.');
    onDone();
  };

  xhr.ontimeout = () => {
    onChunk('Request timed out.');
    onDone();
  };

  xhr.timeout = 60000; // 60s

  xhr.send(JSON.stringify({ user_id: userId, mode, messages, context }));
}
