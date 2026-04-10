import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  ScrollView, Animated, Alert,
} from 'react-native';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { Colors } from '../constants/colors';
import {
  streamCopilotChat, CopilotMode, Message, EventSuggestion, GoalCompleteData,
} from '../api/copilot';
import { API_BASE } from '../api/client';
import { useStore } from '../store/useStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { addGoalEvent, markAttendance } from '../api/dashboard';

// ── Types ────────────────────────────────────────────────────────────────────

interface CopilotQuestion {
  text: string;
  options: string[];
}

const QUESTION_RE = /\[QUESTION:\s*(\{[\s\S]*?\})\]/g;
const GOAL_COMPLETE_RE = /\[GOAL_COMPLETE:\s*(\{[\s\S]*?\})\]/;

function stripMarkers(text: string): string {
  return text
    .replace(/\[QUESTION:\s*\{[\s\S]*?\}\]/g, '')
    .replace(/\[GOAL_COMPLETE:\s*\{[\s\S]*?\}\]/g, '')
    .trim();
}

function extractQuestion(text: string): CopilotQuestion | null {
  const match = QUESTION_RE.exec(text);
  QUESTION_RE.lastIndex = 0;
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}

// ── Modes (removed elevator_pitch, icebreaker, followup) ────────────────────

const MODES: { key: CopilotMode; label: string; emoji: string; desc: string }[] = [
  { key: 'goal_setup',     emoji: '🎯', label: 'Goal Setup',   desc: 'Define your goals with guided questions' },
  { key: 'daily_planner',  emoji: '📅', label: 'Daily Plan',   desc: "Today's schedule-aware plan" },
  { key: 'networking',     emoji: '🤝', label: 'Event Prep',   desc: 'Prepare for an RSVPed event' },
  { key: 'progress_review',emoji: '📊', label: 'Progress',     desc: 'Review your goals' },
];

// ── Today's Events with Accept/Reject (Daily Planner mode) ──────────────────

interface TodayEvent {
  id: number;
  title: string;
  location: string;
  starts_at: string;
  ends_at?: string;
}

interface ClassSlot { class_name: string; start_time: string; end_time: string; }

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function eventConflictsWithClass(event: TodayEvent, classes: ClassSlot[]): ClassSlot | null {
  const eventStart = new Date(event.starts_at);
  const evStartMins = eventStart.getHours() * 60 + eventStart.getMinutes();
  const evEndMins = event.ends_at
    ? new Date(event.ends_at).getHours() * 60 + new Date(event.ends_at).getMinutes()
    : evStartMins + 60;
  for (const cls of classes) {
    const cStart = timeToMinutes(cls.start_time);
    const cEnd = timeToMinutes(cls.end_time);
    if (evStartMins < cEnd && evEndMins > cStart) return cls;
  }
  return null;
}

function DailyPlanEvents({ userId }: { userId: number }) {
  const qc = useQueryClient();
  const [accepted, setAccepted] = useState<Set<number>>(new Set());
  const [rejected, setRejected] = useState<Set<number>>(new Set());
  const [todayEvents, setTodayEvents] = useState<TodayEvent[]>([]);
  const [classes, setClasses] = useState<ClassSlot[]>([]);

  useEffect(() => {
    // Fetch today's events
    fetch(`${API_BASE}/events/today`)
      .then(r => r.json())
      .then((events: TodayEvent[]) => setTodayEvents(events))
      .catch(() => {});
    // Fetch class schedule
    fetch(`${API_BASE}/schedule/${userId}`)
      .then(r => r.json())
      .then((slots: any[]) => {
        const todayDow = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1; // 0=Mon
        setClasses(slots.filter(s => s.day_of_week === todayDow));
      })
      .catch(() => {});
  }, [userId]);

  if (todayEvents.length === 0) return null;

  const accept = async (event: TodayEvent) => {
    setAccepted(prev => { const s = new Set(prev); s.add(event.id); return s; });
    setRejected(prev => { const s = new Set(prev); s.delete(event.id); return s; });
    try {
      // Add to goal dashboard
      await addGoalEvent(userId, event.id, 'career', 0.3, 'Accepted from daily plan', 'user');
      // Mark as attended → increments milestone counters
      await markAttendance(userId, event.id, true, 'career');
      qc.invalidateQueries({ queryKey: ['dashboard', userId] });
    } catch { /* non-fatal — event may already be on dashboard */ }
  };

  const reject = (event: TodayEvent) => {
    setRejected(prev => { const s = new Set(prev); s.add(event.id); return s; });
    setAccepted(prev => { const s = new Set(prev); s.delete(event.id); return s; });
  };

  return (
    <View style={dp.container}>
      <Text style={dp.header}>Today's Events</Text>
      {todayEvents.map(event => {
        const conflict = eventConflictsWithClass(event, classes);
        const isAccepted = accepted.has(event.id);
        const isRejected = rejected.has(event.id);
        const timeStr = new Date(event.starts_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        return (
          <View key={event.id} style={[dp.card, isAccepted && dp.cardAccepted, isRejected && dp.cardRejected]}>
            <View style={dp.cardBody}>
              <Text style={dp.eventTitle} numberOfLines={1}>{event.title}</Text>
              <Text style={dp.eventMeta}>{timeStr} · {event.location}</Text>
              {conflict ? (
                <View style={dp.conflictBadge}>
                  <Text style={dp.conflictText}>Conflicts with {conflict.class_name} ({conflict.start_time}–{conflict.end_time})</Text>
                </View>
              ) : (
                <View style={dp.freeBadge}>
                  <Text style={dp.freeText}>Free slot</Text>
                </View>
              )}
            </View>
            {isAccepted ? (
              <Text style={dp.acceptedLabel}>Added ✓</Text>
            ) : isRejected ? (
              <TouchableOpacity onPress={() => { setRejected(prev => { const s = new Set(prev); s.delete(event.id); return s; }); }}>
                <Text style={dp.rejectedLabel}>Skipped</Text>
              </TouchableOpacity>
            ) : (
              <View style={dp.actions}>
                <TouchableOpacity style={dp.acceptBtn} onPress={() => accept(event)}>
                  <Text style={dp.acceptText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity style={dp.rejectBtn} onPress={() => reject(event)}>
                  <Text style={dp.rejectText}>Skip</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const dp = StyleSheet.create({
  container: { marginHorizontal: 16, marginBottom: 10 },
  header: { color: Colors.subtext, fontSize: 12, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  card: {
    backgroundColor: Colors.card, borderRadius: 12, padding: 12, marginBottom: 8,
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
  },
  cardAccepted: { borderColor: Colors.success + '88' },
  cardRejected: { opacity: 0.5 },
  cardBody: { flex: 1 },
  eventTitle: { color: Colors.text, fontSize: 14, fontWeight: '600' },
  eventMeta: { color: Colors.subtext, fontSize: 12, marginTop: 2 },
  conflictBadge: { backgroundColor: Colors.accent + '22', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginTop: 6, alignSelf: 'flex-start' },
  conflictText: { color: Colors.accent, fontSize: 11 },
  freeBadge: { backgroundColor: Colors.success + '22', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginTop: 6, alignSelf: 'flex-start' },
  freeText: { color: Colors.success, fontSize: 11 },
  actions: { gap: 6 },
  acceptBtn: { backgroundColor: Colors.success, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  acceptText: { color: Colors.white, fontWeight: '700', fontSize: 12 },
  rejectBtn: { backgroundColor: Colors.surface, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: Colors.border },
  rejectText: { color: Colors.subtext, fontSize: 12 },
  acceptedLabel: { color: Colors.success, fontWeight: '700', fontSize: 12 },
  rejectedLabel: { color: Colors.muted, fontSize: 12 },
});

// ── RSVP Event Selector (Networking/Event Prep mode) ─────────────────────────

function RSVPEventSelector({
  userId,
  onSelect,
}: {
  userId: number;
  onSelect: (eventId: number, eventTitle: string) => void;
}) {
  const [events, setEvents] = useState<{ id: number; title: string; starts_at: string; location: string }[]>([]);

  useEffect(() => {
    // Fetch user's upcoming RSVPs
    fetch(`${API_BASE}/users/${userId}/rsvps`)
      .then(r => r.json())
      .then((rsvps: any[]) => {
        const now = new Date();
        const upcoming = rsvps
          .filter(r => r.event && new Date(r.event.starts_at) >= now)
          .map(r => r.event)
          .filter(Boolean)
          .slice(0, 8);
        setEvents(upcoming);
      })
      .catch(() => {});
  }, [userId]);

  if (events.length === 0) return null;

  return (
    <View style={es.container}>
      <Text style={es.header}>Which event are you prepping for?</Text>
      {events.map(e => {
        const dateStr = new Date(e.starts_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        return (
          <TouchableOpacity key={e.id} style={es.row} onPress={() => onSelect(e.id, e.title)}>
            <View style={{ flex: 1 }}>
              <Text style={es.title}>{e.title}</Text>
              <Text style={es.meta}>{dateStr} · {e.location}</Text>
            </View>
            <Text style={es.arrow}>→</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const es = StyleSheet.create({
  container: { marginHorizontal: 16, marginBottom: 12 },
  header: { color: Colors.subtext, fontSize: 12, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.card, borderRadius: 12, padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  title: { color: Colors.text, fontSize: 14, fontWeight: '600' },
  meta: { color: Colors.subtext, fontSize: 12, marginTop: 2 },
  arrow: { color: Colors.primary, fontSize: 18, fontWeight: '700' },
});

// ── Main Component ────────────────────────────────────────────────────────────

export function CopilotScreen({ route, navigation }: any) {
  const userId = useStore(s => s.userId);
  const qc = useQueryClient();
  const initialMode: CopilotMode = route?.params?.initialMode ?? 'goal_setup';
  const [mode, setMode] = useState<CopilotMode>(initialMode);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [pendingSuggestion, setPendingSuggestion] = useState<EventSuggestion | null>(null);
  const [suggestionAdded, setSuggestionAdded] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState<CopilotQuestion | null>(null);
  const [goalComplete, setGoalComplete] = useState<GoalCompleteData | null>(null);
  const [savingGoal, setSavingGoal] = useState(false);

  // Networking mode: selected event for prep
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [selectedEventTitle, setSelectedEventTitle] = useState<string | null>(null);
  const [showDailyPlanEvents, setShowDailyPlanEvents] = useState(false);

  // Voice
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    setMessages([]);
    setPendingSuggestion(null);
    setSuggestionAdded(false);
    setPendingQuestion(null);
    setGoalComplete(null);
    setSelectedEventId(null);
    setSelectedEventTitle(null);
    setShowDailyPlanEvents(false);
    Speech.stop();
  }, [mode]);

  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.35, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [isRecording]);

  function scrollToBottom() {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }

  async function startRecording() {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(recording);
      setIsRecording(true);
    } catch (e) { console.error('Failed to start recording', e); }
  }

  async function stopRecordingAndTranscribe() {
    if (!recording) return;
    setIsRecording(false);
    setTranscribing(true);
    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = recording.getURI();
      setRecording(null);
      if (!uri) return;
      const formData = new FormData();
      formData.append('file', { uri, type: 'audio/m4a', name: 'voice.m4a' } as any);
      const res = await fetch(`${API_BASE}/copilot/transcribe`, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.detail) Alert.alert('Voice Unavailable', data.detail);
      else if (data.text?.trim()) setInput(data.text.trim());
    } catch {
      Alert.alert('Voice Error', 'Could not connect to the server.');
    } finally { setTranscribing(false); }
  }

  function toggleRecording() {
    if (isRecording) stopRecordingAndTranscribe();
    else startRecording();
  }

  function speakText(text: string) { Speech.stop(); Speech.speak(text, { language: 'en-US', rate: 1.0 }); }

  const handleGoalComplete = useCallback(async (goalData: GoalCompleteData) => {
    if (!userId || savingGoal) return;
    setSavingGoal(true);
    try {
      await fetch(`${API_BASE}/goals/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          primary_type: goalData.primary_type || 'both',
          career_track: goalData.career_track || null,
          social_intent: goalData.social_intent || null,
          interests: [],
          timeline: goalData.timeline || null,
        }),
      });
      setGoalComplete(goalData);
      qc.invalidateQueries({ queryKey: ['goals', userId] });
      qc.invalidateQueries({ queryKey: ['dashboard', userId] });
    } catch { /* non-fatal */ } finally { setSavingGoal(false); }
  }, [userId, savingGoal, qc]);

  // Handle RSVP event selection for networking prep
  function handleEventSelect(eventId: number, eventTitle: string) {
    setSelectedEventId(eventId);
    setSelectedEventTitle(eventTitle);
    // Automatically trigger the prep brief
    setTimeout(() => send(`Prepare me for: ${eventTitle}`, { event_id: eventId }), 100);
  }

  async function send(textOverride?: string, extraContext: Record<string, any> = {}) {
    const content = (textOverride ?? input).trim();
    if (!content || streaming || !userId) return;
    setPendingQuestion(null);

    const userMsg: Message = { role: 'user', content };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setStreaming(true);

    const assistantMsg: Message = { role: 'assistant', content: '' };
    setMessages(prev => [...prev, assistantMsg]);
    scrollToBottom();

    // Build context
    const context: Record<string, any> = { ...extraContext };
    if (mode === 'networking' && selectedEventId) context.event_id = selectedEventId;

    let fullResponse = '';
    streamCopilotChat(
      userId, mode, newMessages, context,
      (chunk) => {
        fullResponse += chunk;
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last.role === 'assistant') {
            updated[updated.length - 1] = { ...last, content: last.content + chunk };
          }
          return updated;
        });
        scrollToBottom();
      },
      () => {
        setStreaming(false);
        if (ttsEnabled && fullResponse) speakText(stripMarkers(fullResponse));
        const question = extractQuestion(fullResponse);
        if (question) setPendingQuestion(question);
        // Show event cards after daily planner responds
        if (mode === 'daily_planner') setShowDailyPlanEvents(true);
      },
      (suggestion) => { setPendingSuggestion(suggestion); setSuggestionAdded(false); },
      (goalData) => { handleGoalComplete(goalData); },
    );
  }

  function handleOptionTap(option: string) { if (!streaming) send(option); }

  async function handleAddSuggestion() {
    if (!pendingSuggestion || !userId) return;
    try {
      await addGoalEvent(userId, pendingSuggestion.event_id, 'career', 0.3, pendingSuggestion.contribution_label, 'copilot');
      setSuggestionAdded(true);
    } catch { Alert.alert('Error', 'Could not add event to dashboard.'); }
  }

  const selectedMode = MODES.find(m => m.key === mode)!;
  const showRSVPSelector = mode === 'networking' && messages.length === 0 && !isRecording && !transcribing && !selectedEventId;
  const showEmpty = messages.length === 0 && !isRecording && !transcribing && !showRSVPSelector;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Copilot</Text>
          <Text style={styles.subtitle}>Your AI campus advisor</Text>
        </View>
        <TouchableOpacity
          style={[styles.ttsBtn, ttsEnabled && styles.ttsBtnActive]}
          onPress={() => { setTtsEnabled(v => !v); Speech.stop(); }}
        >
          <Text style={styles.ttsBtnText}>{ttsEnabled ? '🔊' : '🔇'}</Text>
        </TouchableOpacity>
      </View>

      {/* Mode chips */}
      <View style={styles.modeBarContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modeBar}>
          {MODES.map(m => (
            <TouchableOpacity
              key={m.key}
              style={[styles.modeChip, mode === m.key && styles.modeChipActive]}
              onPress={() => setMode(m.key)}
            >
              <Text style={styles.modeEmoji}>{m.emoji}</Text>
              <Text style={[styles.modeLabel, mode === m.key && styles.modeLabelActive]}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* RSVP event selector for networking/event prep */}
        {showRSVPSelector && (
          <ScrollView contentContainerStyle={{ paddingTop: 20, paddingBottom: 20 }}>
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🤝</Text>
              <Text style={styles.emptyTitle}>Event Prep</Text>
              <Text style={styles.emptyDesc}>Select an event you RSVPed to and I'll prepare a brief on who to meet and what to discuss.</Text>
            </View>
            <RSVPEventSelector userId={userId!} onSelect={handleEventSelect} />
          </ScrollView>
        )}

        {showEmpty && !showRSVPSelector && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>{selectedMode.emoji}</Text>
            <Text style={styles.emptyTitle}>{selectedMode.label}</Text>
            <Text style={styles.emptyDesc}>{selectedMode.desc}</Text>
            {mode === 'goal_setup' ? (
              <TouchableOpacity style={styles.startBtn} onPress={() => send("Let's get started")}>
                <Text style={styles.startBtnText}>Start Goal Setup →</Text>
              </TouchableOpacity>
            ) : mode === 'daily_planner' ? (
              <TouchableOpacity style={styles.startBtn} onPress={() => send("Build my daily plan for today")}>
                <Text style={styles.startBtnText}>Build Today's Plan →</Text>
              </TouchableOpacity>
            ) : mode === 'progress_review' ? (
              <TouchableOpacity style={styles.startBtn} onPress={() => send("Review my progress")}>
                <Text style={styles.startBtnText}>Review My Progress →</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.emptyHint}>Type or tap the mic to speak</Text>
            )}
          </View>
        )}

        {isRecording && (
          <View style={styles.recordingOverlay}>
            <Animated.View style={[styles.recordingPulse, { transform: [{ scale: pulseAnim }] }]} />
            <Text style={styles.recordingText}>Listening...</Text>
            <Text style={styles.recordingHint}>Tap mic again to stop</Text>
          </View>
        )}

        {transcribing && (
          <View style={styles.recordingOverlay}>
            <ActivityIndicator color={Colors.primary} size="large" />
            <Text style={styles.recordingText}>Transcribing...</Text>
          </View>
        )}

        {messages.length > 0 && !isRecording && !transcribing && (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(_, i) => String(i)}
            contentContainerStyle={styles.messages}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={scrollToBottom}
            renderItem={({ item, index }) => {
              const isLastAssistant = item.role === 'assistant' && index === messages.length - 1;
              const displayText = item.role === 'assistant' ? stripMarkers(item.content) : item.content;
              return (
                <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.aiBubble]}>
                  {item.role === 'assistant' && (
                    <View style={styles.bubbleHeader}>
                      <Text style={styles.bubbleRole}>Copilot</Text>
                      {isLastAssistant && !streaming && displayText && (
                        <TouchableOpacity onPress={() => speakText(displayText)} style={styles.speakBtn}>
                          <Text style={styles.speakBtnText}>🔊</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                  <Text style={[styles.bubbleText, item.role === 'user' && styles.userBubbleText]}>
                    {displayText}
                    {streaming && isLastAssistant && <Text style={styles.cursor}>▍</Text>}
                  </Text>
                </View>
              );
            }}
          />
        )}

        {/* Today's events with Accept/Reject — shown after daily plan AI responds */}
        {mode === 'daily_planner' && showDailyPlanEvents && !streaming && (
          <DailyPlanEvents userId={userId!} />
        )}

        {/* Structured question chips */}
        {pendingQuestion && !streaming && (
          <View style={styles.questionContainer}>
            <Text style={styles.questionText}>{pendingQuestion.text}</Text>
            <View style={styles.optionsGrid}>
              {pendingQuestion.options.map((opt, idx) => (
                <TouchableOpacity key={idx} style={styles.optionChip} onPress={() => handleOptionTap(opt)}>
                  <Text style={styles.optionChipText}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.orType}>or type your own answer below</Text>
          </View>
        )}

        {/* Goal complete banner */}
        {goalComplete && (
          <View style={styles.goalCompleteBanner}>
            <Text style={styles.goalCompleteIcon}>🎉</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.goalCompleteTitle}>Goal Dashboard Ready!</Text>
              <Text style={styles.goalCompleteSub}>
                Milestones set for{' '}
                <Text style={{ fontWeight: '700' }}>{goalComplete.primary_type}</Text> networking
              </Text>
            </View>
            <TouchableOpacity
              style={styles.goalCompleteBtn}
              onPress={() => {
                const parent = navigation?.getParent?.();
                if (parent) parent.navigate('GoalDashboard');
                else navigation?.navigate?.('GoalDashboard');
              }}
            >
              <Text style={styles.goalCompleteBtnText}>View →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Event suggestion card */}
        {pendingSuggestion && (
          <View style={styles.suggestionCard}>
            <Text style={styles.suggestionHeader}>Copilot suggests for your goal</Text>
            <Text style={styles.suggestionTitle} numberOfLines={1}>{pendingSuggestion.title}</Text>
            <Text style={styles.suggestionMeta}>
              {pendingSuggestion.location} ·{' '}
              {new Date(pendingSuggestion.starts_at).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}
            </Text>
            <Text style={styles.suggestionLabel}>{pendingSuggestion.contribution_label}</Text>
            {suggestionAdded ? (
              <Text style={styles.suggestionDone}>Added to your dashboard ✓</Text>
            ) : (
              <View style={styles.suggestionActions}>
                <TouchableOpacity style={styles.suggestionAddBtn} onPress={handleAddSuggestion}>
                  <Text style={styles.suggestionAddText}>Add to Dashboard</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setPendingSuggestion(null)}>
                  <Text style={styles.suggestionDismiss}>Dismiss</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Input row — hidden during RSVP selector screen */}
        {!showRSVPSelector && (
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder={
                transcribing ? 'Transcribing...'
                : pendingQuestion ? 'Or type your own answer...'
                : `Ask about ${selectedMode.label.toLowerCase()}...`
              }
              placeholderTextColor={Colors.muted}
              multiline
              maxLength={500}
              editable={!transcribing}
            />
            <TouchableOpacity
              style={[styles.micBtn, isRecording && styles.micBtnActive]}
              onPress={toggleRecording}
              disabled={streaming || transcribing}
            >
              <Text style={styles.micIcon}>{isRecording ? '⏹' : '🎤'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sendBtn, (!input.trim() || streaming) && styles.sendBtnDisabled]}
              onPress={() => send()}
              disabled={!input.trim() || streaming}
            >
              {streaming
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.sendIcon}>↑</Text>}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8,
  },
  title: { color: Colors.text, fontSize: 22, fontWeight: '800' },
  subtitle: { color: Colors.subtext, fontSize: 13, marginTop: 2 },
  ttsBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  ttsBtnActive: { backgroundColor: Colors.surface, borderColor: Colors.primary },
  ttsBtnText: { fontSize: 18 },
  modeBarContainer: { height: 60, flexShrink: 0 },
  modeBar: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, alignItems: 'center' },
  modeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.card, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  modeChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  modeEmoji: { fontSize: 15 },
  modeLabel: { color: Colors.subtext, fontSize: 13, fontWeight: '600' },
  modeLabelActive: { color: '#fff' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { color: Colors.text, fontSize: 20, fontWeight: '700', marginBottom: 6 },
  emptyDesc: { color: Colors.subtext, fontSize: 14, marginBottom: 20, textAlign: 'center' },
  emptyHint: { color: Colors.muted, fontSize: 13 },
  startBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 14 },
  startBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  recordingOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  recordingPulse: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.accent + '33', borderWidth: 3, borderColor: Colors.accent,
  },
  recordingText: { color: Colors.text, fontSize: 18, fontWeight: '700' },
  recordingHint: { color: Colors.subtext, fontSize: 13 },
  messages: { paddingHorizontal: 16, paddingVertical: 8, gap: 12 },
  bubble: { maxWidth: '85%', borderRadius: 16, padding: 14 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: Colors.primary },
  aiBubble: { alignSelf: 'flex-start', backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  bubbleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  bubbleRole: { color: Colors.primaryLight, fontSize: 11, fontWeight: '700' },
  speakBtn: { padding: 2 },
  speakBtnText: { fontSize: 14 },
  bubbleText: { color: Colors.text, fontSize: 15, lineHeight: 22 },
  userBubbleText: { color: '#fff' },
  cursor: { color: Colors.primaryLight },
  questionContainer: {
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: Colors.card, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Colors.primary + '66',
  },
  questionText: { color: Colors.text, fontSize: 14, fontWeight: '600', marginBottom: 12, lineHeight: 20 },
  optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  optionChip: {
    backgroundColor: Colors.primary + '18', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 9,
    borderWidth: 1.5, borderColor: Colors.primary,
  },
  optionChipText: { color: Colors.primary, fontSize: 13, fontWeight: '700' },
  orType: { color: Colors.muted, fontSize: 11, textAlign: 'center', fontStyle: 'italic' },
  goalCompleteBanner: {
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: '#7C3AED18', borderRadius: 14, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1.5, borderColor: '#7C3AED',
  },
  goalCompleteIcon: { fontSize: 24 },
  goalCompleteTitle: { color: Colors.text, fontSize: 14, fontWeight: '700' },
  goalCompleteSub: { color: Colors.subtext, fontSize: 12, marginTop: 2 },
  goalCompleteBtn: { backgroundColor: '#7C3AED', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  goalCompleteBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  suggestionCard: {
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: Colors.card, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Colors.primary,
  },
  suggestionHeader: {
    color: Colors.primaryLight, fontSize: 11, fontWeight: '700',
    marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  suggestionTitle: { color: Colors.text, fontSize: 15, fontWeight: '700', marginBottom: 2 },
  suggestionMeta: { color: Colors.subtext, fontSize: 12, marginBottom: 4 },
  suggestionLabel: { color: Colors.muted, fontSize: 12, fontStyle: 'italic', marginBottom: 10 },
  suggestionActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  suggestionAddBtn: { backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  suggestionAddText: { color: Colors.white, fontWeight: '700', fontSize: 13 },
  suggestionDismiss: { color: Colors.muted, fontSize: 13 },
  suggestionDone: { color: Colors.success, fontSize: 13, fontWeight: '600' },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  input: {
    flex: 1, backgroundColor: Colors.card, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10,
    color: Colors.text, fontSize: 15, maxHeight: 120,
    borderWidth: 1, borderColor: Colors.border,
  },
  micBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  micBtnActive: { backgroundColor: Colors.accent + '33', borderColor: Colors.accent },
  micIcon: { fontSize: 18 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: Colors.surface },
  sendIcon: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
