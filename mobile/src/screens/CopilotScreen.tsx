import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, SafeAreaView, ActivityIndicator,
  ScrollView, Animated,
} from 'react-native';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { Alert } from 'react-native';
import { Colors } from '../constants/colors';
import { streamCopilotChat, CopilotMode, Message } from '../api/copilot';
import { API_BASE } from '../api/client';
import { useStore } from '../store/useStore';

const MODES: { key: CopilotMode; label: string; emoji: string; desc: string }[] = [
  { key: 'goal_setup', emoji: '🎯', label: 'Goal Setup', desc: 'Define your goals' },
  { key: 'daily_planner', emoji: '📅', label: 'Daily Plan', desc: "Today's priorities" },
  { key: 'networking', emoji: '🤝', label: 'Networking', desc: 'Prep for an event' },
  { key: 'elevator_pitch', emoji: '🚀', label: 'Elevator Pitch', desc: '30-sec pitch' },
  { key: 'icebreaker', emoji: '💬', label: 'Icebreaker', desc: 'Social starters' },
  { key: 'followup', emoji: '📩', label: 'Follow-Up', desc: 'After meeting someone' },
];

export function CopilotScreen() {
  const userId = useStore(s => s.userId);
  const [mode, setMode] = useState<CopilotMode>('goal_setup');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);

  // Voice
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    setMessages([]);
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
    } catch (e) {
      Alert.alert('Voice Error', 'Could not connect to the server.');
    } finally {
      setTranscribing(false);
    }
  }

  function toggleRecording() {
    if (isRecording) {
      stopRecordingAndTranscribe();
    } else {
      startRecording();
    }
  }

  function speakText(text: string) {
    Speech.stop();
    Speech.speak(text, { language: 'en-US', rate: 1.0 });
  }

  async function send(textOverride?: string) {
    const content = (textOverride ?? input).trim();
    if (!content || streaming || !userId) return;
    const userMsg: Message = { role: 'user', content };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setStreaming(true);

    const assistantMsg: Message = { role: 'assistant', content: '' };
    setMessages(prev => [...prev, assistantMsg]);
    scrollToBottom();

    let fullResponse = '';
    await streamCopilotChat(
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
        if (ttsEnabled && fullResponse) speakText(fullResponse);
      },
    );
  }

  const selectedMode = MODES.find(m => m.key === mode)!;

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

      {messages.length === 0 && !isRecording && !transcribing && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>{selectedMode.emoji}</Text>
          <Text style={styles.emptyTitle}>{selectedMode.label}</Text>
          <Text style={styles.emptyDesc}>{selectedMode.desc}</Text>
          <Text style={styles.emptyHint}>Type or tap the mic to speak</Text>
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

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        {messages.length > 0 && !isRecording && !transcribing && (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(_, i) => String(i)}
            contentContainerStyle={styles.messages}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={scrollToBottom}
            renderItem={({ item, index }) => (
              <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.aiBubble]}>
                {item.role === 'assistant' && (
                  <View style={styles.bubbleHeader}>
                    <Text style={styles.bubbleRole}>Copilot</Text>
                    {index === messages.length - 1 && !streaming && item.content && (
                      <TouchableOpacity onPress={() => speakText(item.content)} style={styles.speakBtn}>
                        <Text style={styles.speakBtnText}>🔊</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
                <Text style={[styles.bubbleText, item.role === 'user' && styles.userBubbleText]}>
                  {item.content}
                  {streaming && index === messages.length - 1 && item.role === 'assistant' && (
                    <Text style={styles.cursor}>▍</Text>
                  )}
                </Text>
              </View>
            )}
          />
        )}

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={transcribing ? 'Transcribing...' : `Ask about ${selectedMode.label.toLowerCase()}...`}
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
  modeBar: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
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
  emptyDesc: { color: Colors.subtext, fontSize: 14, marginBottom: 8, textAlign: 'center' },
  emptyHint: { color: Colors.muted, fontSize: 13 },
  recordingOverlay: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16,
  },
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
