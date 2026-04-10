import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Colors } from '../constants/colors';
import { TagChip } from '../components/TagChip';
import { getUserRSVPs, getInterests } from '../api/users';
import { getGoal } from '../api/goals';
import { fetchEvent } from '../api/events';
import { useStore } from '../store/useStore';

const GOAL_TYPE_LABEL: Record<string, string> = {
  career: '💼 Career',
  social: '🎉 Social',
  both: '⚡ Career + Social',
};

function UpcomingRSVPs({ userId, navigation }: { userId: number; navigation: any }) {
  const { data: rsvps } = useQuery({
    queryKey: ['rsvps', userId],
    queryFn: () => getUserRSVPs(userId),
  });

  const upcoming = rsvps?.slice(0, 3) ?? [];

  if (upcoming.length === 0) {
    return <Text style={styles.emptyText}>No RSVPs yet. Discover events on the Home tab.</Text>;
  }

  return (
    <View style={styles.rsvpList}>
      {upcoming.map(rsvp => (
        <RSVPItem key={rsvp.id} eventId={rsvp.event_id} navigation={navigation} />
      ))}
    </View>
  );
}

function RSVPItem({ eventId, navigation }: { eventId: number; navigation: any }) {
  const { data: event } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => fetchEvent(eventId),
  });

  if (!event) return null;

  return (
    <TouchableOpacity
      style={styles.rsvpItem}
      onPress={() => navigation.navigate('EventDetail', { eventId })}
      activeOpacity={0.8}
    >
      <View style={styles.rsvpDot} />
      <View style={{ flex: 1 }}>
        <Text style={styles.rsvpTitle} numberOfLines={1}>{event.title}</Text>
        <Text style={styles.rsvpMeta}>
          {new Date(event.starts_at).toLocaleDateString('en-US', {
            weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
          })}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export function ProfileScreen({ navigation }: any) {
  const { userId, displayName, email, major, gradYear, reset } = useStore();

  const goalQuery = useQuery({
    queryKey: ['goal', userId],
    queryFn: () => getGoal(userId!),
    enabled: !!userId,
  });

  const interestsQuery = useQuery({
    queryKey: ['interests', userId],
    queryFn: () => getInterests(userId!),
    enabled: !!userId,
  });

  const goal = goalQuery.data;
  const interests = interestsQuery.data ?? [];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {displayName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.name}>{displayName}</Text>
        <Text style={styles.email}>{email}</Text>
        {(major || gradYear) && (
          <Text style={styles.meta}>
            {[major, gradYear ? `Class of ${gradYear}` : ''].filter(Boolean).join(' · ')}
          </Text>
        )}

        {goal && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Goals</Text>
            <View style={styles.goalCard}>
              <Text style={styles.goalType}>{GOAL_TYPE_LABEL[goal.primary_type] ?? goal.primary_type}</Text>
              {goal.career_track && (
                <View style={styles.goalRow}>
                  <Text style={styles.goalLabel}>Track</Text>
                  <Text style={styles.goalValue}>{goal.career_track}</Text>
                </View>
              )}
              {goal.social_intent && (
                <View style={styles.goalRow}>
                  <Text style={styles.goalLabel}>Looking for</Text>
                  <Text style={styles.goalValue}>{goal.social_intent}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {interests.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Interests</Text>
            <View style={styles.chips}>
              {interests.map(tag => (
                <TagChip key={tag.id} label={tag.name} category={tag.category} selected />
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming RSVPs</Text>
          {userId && <UpcomingRSVPs userId={userId} navigation={navigation} />}
        </View>

        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() => { reset(); }}
          activeOpacity={0.8}
        >
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 24, paddingTop: 40, alignItems: 'center' },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  avatarText: { color: '#fff', fontSize: 32, fontWeight: '800' },
  name: { color: Colors.text, fontSize: 22, fontWeight: '800', marginBottom: 4 },
  email: { color: Colors.subtext, fontSize: 14, marginBottom: 4 },
  meta: { color: Colors.muted, fontSize: 13, marginBottom: 8 },
  section: { width: '100%', marginTop: 28 },
  sectionTitle: { color: Colors.text, fontSize: 16, fontWeight: '700', marginBottom: 12 },
  goalCard: {
    backgroundColor: Colors.card, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: Colors.border,
  },
  goalType: { color: Colors.primaryLight, fontSize: 16, fontWeight: '700', marginBottom: 10 },
  goalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  goalLabel: { color: Colors.subtext, fontSize: 13 },
  goalValue: { color: Colors.text, fontSize: 13, fontWeight: '600', flex: 1, textAlign: 'right' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  rsvpList: { gap: 10 },
  rsvpItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.card, borderRadius: 12,
    padding: 14, borderWidth: 1, borderColor: Colors.border,
  },
  rsvpDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  rsvpTitle: { color: Colors.text, fontSize: 14, fontWeight: '600' },
  rsvpMeta: { color: Colors.subtext, fontSize: 12, marginTop: 2 },
  emptyText: { color: Colors.muted, fontSize: 14, textAlign: 'center' },
  logoutBtn: {
    marginTop: 32, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12,
  },
  logoutText: { color: Colors.subtext, fontSize: 14, fontWeight: '600' },
});
