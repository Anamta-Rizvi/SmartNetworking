import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { useStore } from '../../store/useStore';

interface Props {
  onNext: () => void;
}

const GOAL_OPTIONS = [
  {
    type: 'career',
    emoji: '💼',
    title: 'Career First',
    desc: 'Internships, networking, and skill-building',
  },
  {
    type: 'social',
    emoji: '🎉',
    title: 'Social & Hobbies',
    desc: 'Meet people, explore interests, build community',
  },
  {
    type: 'both',
    emoji: '⚡',
    title: 'Both',
    desc: 'Career growth and a thriving social life',
  },
];

export function StepGoal({ onNext }: Props) {
  const { goalType, setGoal } = useStore();
  const [selectedType, setSelectedType] = useState(goalType || 'both');
  const [careerTrack, setCareerTrack] = useState('');
  const [socialIntent, setSocialIntent] = useState('');

  function handleNext() {
    setGoal(selectedType, careerTrack.trim(), socialIntent.trim());
    onNext();
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.step}>Step 2 of 3</Text>
        <Text style={styles.title}>What's your focus?</Text>
        <Text style={styles.subtitle}>We'll personalize your feed and Copilot around this</Text>

        <View style={styles.options}>
          {GOAL_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.type}
              style={[styles.option, selectedType === opt.type && styles.optionSelected]}
              onPress={() => setSelectedType(opt.type)}
              activeOpacity={0.8}
            >
              <Text style={styles.optionEmoji}>{opt.emoji}</Text>
              <View style={styles.optionText}>
                <Text style={[styles.optionTitle, selectedType === opt.type && styles.selectedText]}>
                  {opt.title}
                </Text>
                <Text style={styles.optionDesc}>{opt.desc}</Text>
              </View>
              {selectedType === opt.type && (
                <View style={styles.check}><Text style={styles.checkMark}>✓</Text></View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {(selectedType === 'career' || selectedType === 'both') && (
          <>
            <Text style={styles.label}>Career track (e.g. software, finance, consulting)</Text>
            <TextInput
              style={styles.input}
              placeholder="Software Engineering"
              placeholderTextColor={Colors.muted}
              value={careerTrack}
              onChangeText={setCareerTrack}
            />
          </>
        )}

        {(selectedType === 'social' || selectedType === 'both') && (
          <>
            <Text style={styles.label}>Who or what are you looking for? (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="People interested in climbing and music"
              placeholderTextColor={Colors.muted}
              value={socialIntent}
              onChangeText={setSocialIntent}
            />
          </>
        )}

        <TouchableOpacity style={styles.button} onPress={handleNext} activeOpacity={0.85}>
          <Text style={styles.buttonText}>Continue →</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 28, paddingTop: 60 },
  step: {
    color: Colors.primary, fontSize: 13, fontWeight: '600',
    marginBottom: 10, letterSpacing: 1, textTransform: 'uppercase',
  },
  title: { color: Colors.text, fontSize: 28, fontWeight: '800', marginBottom: 6 },
  subtitle: { color: Colors.subtext, fontSize: 15, marginBottom: 28 },
  options: { gap: 12, marginBottom: 24 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: Colors.border,
    gap: 14,
  },
  optionSelected: { borderColor: Colors.primary, backgroundColor: Colors.surface },
  optionEmoji: { fontSize: 28 },
  optionText: { flex: 1 },
  optionTitle: { color: Colors.text, fontSize: 16, fontWeight: '700', marginBottom: 2 },
  selectedText: { color: Colors.primaryLight },
  optionDesc: { color: Colors.subtext, fontSize: 13 },
  check: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  checkMark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  label: {
    color: Colors.subtext, fontSize: 12, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6, marginTop: 4,
  },
  input: {
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, padding: 14, color: Colors.text, fontSize: 15, marginBottom: 16,
  },
  button: {
    backgroundColor: Colors.primary, borderRadius: 14,
    padding: 16, alignItems: 'center', marginTop: 8,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
