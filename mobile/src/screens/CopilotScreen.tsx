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
import { addGoalEvent } from '../api/dashboard';
import { API_BASE } from '../api/client';
import { useStore } from '../store/useStore';

// ── Types ───────────────────────────────────────────────────────────────────

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
  QUESTION_RE.lastIndex = 0; // reset stateful regex
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

// ── Modes ───────────────────────────────────────────────────────────────────

const MODES: { key: CopilotMode; label: string; emoji: string; desc: string }[] = [
  { key: 'goal_setup', emoji: '🎯', label: 'Goal Setup', desc: 'Define your goals with guided questions' },
  { key: 'daily_planner', emoji: '📅', label: 'Daily Plan', desc: "Today's priorities" },
  { key: 'networking', emoji: '🤝', label: 'Networking', desc: 'Prep for an event' },
  { key: 'elevator_pitch', emoji: '🚀', label: 'Elevator Pitch', desc: '30-sec pitch' },
  { key: 'icebreaker', emoji: '💬', label: 'Icebreaker', desc: 'Social starters' },
  { key: 'followup', emoji: '📩', label: 'Follow-Up', desc: 'After meeting someone' },
  { key: 'progress_review', emoji: '📊', label: 'Progress', desc: 'Review your goals' },
];

// ── Component ────────────────────────────────────────────────────────────────

export function CopilotScreen({ route, navigation }: any) {
  const userId = useStore(s => s.userId);
  const initialMode: CopilotMode = route?.params?.initialMode ?? 'goal_setup';
  const [mode, setMode] = useState<CopilotMode>(initialMode);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [pendingSuggestion, setPendingSuggestion] = useState<EventSuggestion | null>(null);
  const [suggestionAdded, setSuggestionAdded] = useState(false);

  // Structured questionnaire state
  const [pendingQuestion, setPendingQuestion] = useState<CopilotQuestion | null>(null);
  const [goalComplete, setGoalComplete] = useState<GoalCompleteData | null>(null);
  const [savingGoal, setSavingGoal] = useState(false);

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

  // ── Voice helpers ─────────────────────────────────────────────────────────

  async function startRecording() {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      setIsRecording(true);
    } catch (e) {
      console.error('Failed to start recording', e);
    }
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

      const res = await fetch(`${API_BASE}/copilot/transcribe`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.detail) {
        Alert.alert('Voice Unavailable', data.detail);
      } else if (data.text?.trim()) {
        setInput(data.text.trim());
      }
    } catch {
      Alert.alert('Voice Error', 'Could not connect to the server.');
    } finally {
      setTranscribing(false);
    }
  }

  function toggleRecording() {
    if (isRecording) stopRecordingAndTranscribe();
    else startRecording();
  }

  function speakText(text: string) {
    Speech.stop();
    Speech.speak(text, { language: 'en-US', rate: 1.0 });
  }

  // ── Goal completion handler ───────────────────────────────────────────────

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
    } catch {
      // Goal may have already been set — non-fatal
    } finally {
      setSavingGoal(false);
    }
  }, [userId, savingGoal]);

  // ── Send message ──────────────────────────────────────────────────────────

  async function send(textOverride?: string) {
    const content = (textOverride ?? input).trim();
    if (!content || streaming || !userId) return;

    // Clear pending question when user answers
    setPendingQuestion(null);

    const userMsg: Message = { role: 'user', content };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setStreaming(true);

    const assistantMsg: Message = { role: 'assistant', content: '' };
    setMessages(prev => [...prev, assistantMsg]);
    scrollToBottom();

    let fullResponse = '';
    streamCopilotChat(
      userId, mode, newMessages, {},
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

        // Parse for structured question marker
        const question = extractQuestion(fullResponse);
        if (question) setPendingQuestion(question);
      },
      (suggestion) => {
        setPendingSuggestion(suggestion);
        setSuggestionAdded(false);
      },
      (goalData) => {
        handleGoalComplete(goalData);
      },
    );
  }

  // ── Option chip handler ───────────────────────────────────────────────────

  function handleOptionTap(option: string) {
    if (streaming) return;
    send(option);
  }

  // ── Dashboard suggestion ──────────────────────────────────────────────────

  async function handleAddSuggestion() {
    if (!pendingSuggestion || !userId) return;
    try {
      await addGoalEvent(
        userId,
        pendingSuggestion.event_id,
        'career',
        0.3,
        pendingSuggestion.contribution_label,
        'copilot',
      );
      setSuggestionAdded(true);
    } catch {
      Alert.alert('Error', 'Could not add event to dashboard.');
    }
  }

  const selectedMode = MODES.find(m => m.key === mode)!;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>🤖 Copilot</Text>
          <Text style={styles.subtitle}>Your AI campus advisor</Text>
        </View>
        <TouchableOpacity
          style={[styles.ttsBtn, ttsEnabled && styles.ttsBtnActive]}
          onPress={() => { setTtsEnabled(v => !v); Speech.stop(); }}
          activeOpacity={0.8}
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
              activeOpacity={0.8}
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
        {messages.length === 0 && !isRecording && !transcribing && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>{selectedMode.emoji}</Text>
            <Text style={styles.emptyTitle}>{selectedMode.label}</Text>
            <Text style={styles.emptyDesc}>{selectedMode.desc}</Text>
            {mode === 'goal_setup' ? (
              <TouchableOpacity
                style={styles.startBtn}
                onPress={() => send("Let's get started")}
                activeOpacity={0.85}
              >
                <Text style={styles.startBtnText}>Start Goal Setup →</Text>
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
              // Strip markers from display text
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
                    {streaming && isLastAssistant && (
                      <Text style={styles.cursor}>▍</Text>
                    )}
                  </Text>
                </View>
              );
            }}
          />
        )}

        {/* Structured question option chips */}
        {pendingQuestion && !streaming && (
          <View style={styles.questionContainer}>
            <Text style={styles.questionText}>{pendingQuestion.text}</Text>
            <View style={styles.optionsGrid}>
              {pendingQuestion.options.map((opt, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.optionChip}
                  onPress={() => handleOptionTap(opt)}
                  activeOpacity={0.8}
                >
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
                Your milestones are set for{' '}
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
            <Text style={styles.suggestionHeader}>🎯 Copilot suggests for your goal</Text>
            <Text style={styles.suggestionTitle} numberOfLines={1}>{pendingSuggestion.title}</Text>
            <Text style={styles.suggestionMeta}>
              {pendingSuggestion.location} · {new Date(pendingSuggestion.starts_at).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}
            </Text>
            <Text style={styles.suggestionLabel}>{pendingSuggestion.contribution_label}</Text>
            {suggestionAdded ? (
              <Text style={styles.suggestionDone}>✓ Added to your dashboard</Text>
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

        {/* Input row */}
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
            activeOpacity={0.8}
          >
            <Text style={styles.micIcon}>{isRecording ? '⏹' : '🎤'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || streaming) && styles.sendBtnDisabled]}
            onPress={() => send()}
            disabled={!input.trim() || streaming}
            activeOpacity={0.8}
          >
            {streaming
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.sendIcon}>↑</Text>}
          </TouchableOpacity>
        </View>
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
  startBtn: {
    backgroundColor: Colors.primary, borderRadius: 12,
    paddingHorizontal: 24, paddingVertical: 14,
  },
  startBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  recordingOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  recordingPulse: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.accent + '33',
    borderWidth: 3, borderColor: Colors.accent,
  },
  recordingText: { color: Colors.text, fontSize: 18, fontWeight: '700' },
  recordingHint: { color: Colors.subtext, fontSize: 13 },

  messages: { paddingHorizontal: 16, paddingVertical: 8, gap: 12 },
  bubble: { maxWidth: '85%', borderRadius: 16, padding: 14 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: Colors.primary },
  aiBubble: {
    alignSelf: 'flex-start', backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border,
  },
  bubbleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  bubbleRole: { color: Colors.primaryLight, fontSize: 11, fontWeight: '700' },
  speakBtn: { padding: 2 },
  speakBtnText: { fontSize: 14 },
  bubbleText: { color: Colors.text, fontSize: 15, lineHeight: 22 },
  userBubbleText: { color: '#fff' },
  cursor: { color: Colors.primaryLight },

  // Structured question styles
  questionContainer: {
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: Colors.card, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Colors.primary + '66',
  },
  questionText: {
    color: Colors.text, fontSize: 14, fontWeight: '600', marginBottom: 12, lineHeight: 20,
  },
  optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  optionChip: {
    backgroundColor: Colors.primary + '18',
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9,
    borderWidth: 1.5, borderColor: Colors.primary,
  },
  optionChipText: { color: Colors.primary, fontSize: 13, fontWeight: '700' },
  orType: { color: Colors.muted, fontSize: 11, textAlign: 'center', fontStyle: 'italic' },

  // Goal complete banner
  goalCompleteBanner: {
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: '#7C3AED18', borderRadius: 14, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1.5, borderColor: '#7C3AED',
  },
  goalCompleteIcon: { fontSize: 24 },
  goalCompleteTitle: { color: Colors.text, fontSize: 14, fontWeight: '700' },
  goalCompleteSub: { color: Colors.subtext, fontSize: 12, marginTop: 2 },
  goalCompleteBtn: {
    backgroundColor: '#7C3AED', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
  },
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
  suggestionAddBtn: {
    backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8,
  },
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
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: Colors.surface },
  sendIcon: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
