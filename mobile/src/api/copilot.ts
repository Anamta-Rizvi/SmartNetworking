import { API_BASE } from './client';

export type CopilotMode =
  | 'goal_setup'
  | 'networking'
  | 'elevator_pitch'
  | 'icebreaker'
  | 'followup'
  | 'daily_planner';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export async function streamCopilotChat(
  userId: number,
  mode: CopilotMode,
  messages: Message[],
  context: Record<string, unknown>,
  onChunk: (text: string) => void,
  onDone: () => void,
) {
  const response = await fetch(`${API_BASE}/copilot/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, mode, messages, context }),
  });

  const reader = response.body?.getReader();
  if (!reader) { onDone(); return; }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') { onDone(); return; }
      try {
        const parsed = JSON.parse(data);
        if (parsed.content) onChunk(parsed.content);
      } catch {}
    }
  }
  onDone();
}
