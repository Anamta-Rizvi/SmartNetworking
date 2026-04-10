import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { fetchTags, Tag } from '../../api/events';
import { setInterests } from '../../api/users';
import { upsertGoal } from '../../api/goals';
import { useStore } from '../../store/useStore';

interface Props {
  onDone: () => void;
}

const CATEGORY_ORDER = ['career', 'hobby', 'social', 'academic', 'wellness'];
const CATEGORY_LABELS: Record<string, string> = {
  career: '💼 Career',
  hobby: '🎯 Hobbies',
  social: '🎉 Social',
  academic: '📚 Academic',
  wellness: '🌿 Wellness',
};

export function StepInterests({ onDone }: Props) {
  const { userId, goalType, careerTrack, socialIntent, setSelectedTagIds, completeOnboarding } = useStore();
  const [tags, setTags] = useState<Tag[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchTags().then(setTags).finally(() => setLoading(false));
  }, []);

  function toggle(id: number) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleDone() {
    if (!userId) return;
    setSaving(true);
    const tagIds = Array.from(selected);
    const selectedTagNames = tags.filter(t => selected.has(t.id)).map(t => t.name);
    try {
      await setInterests(userId, tagIds);
      await upsertGoal({
        user_id: userId,
        primary_type: goalType,
        career_track: careerTrack || undefined,
        social_intent: socialIntent || undefined,
        interests: selectedTagNames,
      });
      setSelectedTagIds(tagIds);
      completeOnboarding();
      onDone();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  const grouped = CATEGORY_ORDER.reduce<Record<string, Tag[]>>((acc, cat) => {
    acc[cat] = tags.filter(t => t.category === cat);
    return acc;
  }, {});

  return (
    <View style={styles.wrapper}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.step}>Step 3 of 3</Text>
        <Text style={styles.title}>Pick your interests</Text>
        <Text style={styles.subtitle}>Choose as many as you like — we'll use these to find your best events</Text>

        {loading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
        ) : (
          CATEGORY_ORDER.map(cat => (
            grouped[cat]?.length > 0 && (
              <View key={cat} style={styles.section}>
                <Text style={styles.categoryLabel}>{CATEGORY_LABELS[cat]}</Text>
                <View style={styles.chips}>
                  {grouped[cat].map(tag => {
                    const isSelected = selected.has(tag.id);
                    const color = Colors.categoryColors[tag.category] ?? Colors.primary;
                    return (
                      <TouchableOpacity
                        key={tag.id}
                        style={[styles.chip, { borderColor: color }, isSelected && { backgroundColor: color }]}
                        onPress={() => toggle(tag.id)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.chipText, { color: isSelected ? '#fff' : color }]}>
                          {tag.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )
          ))
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.selectedCount}>{selected.size} selected</Text>
        <TouchableOpacity
          style={[styles.button, selected.size === 0 && styles.buttonDisabled]}
          onPress={handleDone}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buttonText}>{selected.size === 0 ? 'Skip for now' : 'Get Started 🚀'}</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  container: { padding: 28, paddingTop: 60 },
  step: {
    color: Colors.primary, fontSize: 13, fontWeight: '600',
    marginBottom: 10, letterSpacing: 1, textTransform: 'uppercase',
  },
  title: { color: Colors.text, fontSize: 28, fontWeight: '800', marginBottom: 6 },
  subtitle: { color: Colors.subtext, fontSize: 15, marginBottom: 28 },
  section: { marginBottom: 20 },
  categoryLabel: {
    color: Colors.text, fontSize: 15, fontWeight: '700', marginBottom: 10,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1.5, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7,
  },
  chipText: { fontSize: 13, fontWeight: '600' },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.background, paddingHorizontal: 28,
    paddingBottom: 40, paddingTop: 16,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  selectedCount: { color: Colors.subtext, fontSize: 13, marginBottom: 10, textAlign: 'center' },
  button: {
    backgroundColor: Colors.primary, borderRadius: 14,
    padding: 16, alignItems: 'center',
  },
  buttonDisabled: { backgroundColor: Colors.surface },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
