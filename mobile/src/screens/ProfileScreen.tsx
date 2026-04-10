import { SafeAreaView } from 'react-native-safe-area-context';
import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../constants/colors';
import { TagChip } from '../components/TagChip';
import { getUserRSVPs, getInterests } from '../api/users';
import { getGoal } from '../api/goals';
import { fetchEvent } from '../api/events';
import { fetchDashboard } from '../api/dashboard';
import { getConnections, getPendingRequests } from '../api/connections';
import { uploadAvatar } from '../api/uploads';
import { useStore } from '../store/useStore';
import { API_BASE } from '../api/client';

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
  const { userId, displayName, email, major, gradYear, avatarUrl, setAvatarUrl, reset } = useStore();

  async function handleAvatarPress() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to set a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    try {
      const { avatar_url } = await uploadAvatar(userId!, result.assets[0].uri);
      setAvatarUrl(avatar_url);
    } catch (e: any) {
      Alert.alert('Upload failed', e.message ?? 'Could not upload photo.');
    }
  }

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

  const dashboardQuery = useQuery({
    queryKey: ['dashboard', userId],
    queryFn: () => fetchDashboard(userId!),
    enabled: !!userId,
    retry: false,
  });

  const connectionsQuery = useQuery({
    queryKey: ['connections', userId],
    queryFn: () => getConnections(userId!),
    enabled: !!userId,
  });

  const pendingQuery = useQuery({
    queryKey: ['pending', userId],
    queryFn: () => getPendingRequests(userId!),
    enabled: !!userId,
  });

  const goal = goalQuery.data;
  const interests = interestsQuery.data ?? [];
  const dashboard = dashboardQuery.data;
  const connections = connectionsQuery.data ?? [];
  const pendingCount = pendingQuery.data?.length ?? 0;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={handleAvatarPress} activeOpacity={0.8}>
          <View style={styles.avatar}>
            {avatarUrl ? (
              <Image
                source={{ uri: `${API_BASE}${avatarUrl}` }}
                style={styles.avatarImage}
              />
            ) : (
              <Text style={styles.avatarText}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            )}
            <View style={styles.avatarEditBadge}>
              <Text style={styles.avatarEditIcon}>📷</Text>
            </View>
          </View>
        </TouchableOpacity>
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

        {dashboard && (
          <TouchableOpacity
            style={styles.section}
            onPress={() => navigation.navigate('GoalDashboard')}
            activeOpacity={0.8}
          >
            <Text style={styles.sectionTitle}>Goal Progress</Text>
            <View style={styles.progressCard}>
              {['career', 'both'].includes(dashboard.primary_type) && (
                <View style={styles.progressRow}>
                  <Text style={styles.progressLabel}>Career</Text>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${Math.round(dashboard.career_progress * 100)}%` }]} />
                  </View>
                  <Text style={styles.progressPct}>{Math.round(dashboard.career_progress * 100)}%</Text>
                </View>
              )}
              {['social', 'both'].includes(dashboard.primary_type) && (
                <View style={styles.progressRow}>
                  <Text style={styles.progressLabel}>Social</Text>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${Math.round(dashboard.social_progress * 100)}%` }]} />
                  </View>
                  <Text style={styles.progressPct}>{Math.round(dashboard.social_progress * 100)}%</Text>
                </View>
              )}
              <Text style={styles.progressLink}>View full dashboard →</Text>
            </View>
          </TouchableOpacity>
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

        <TouchableOpacity
          style={styles.section}
          onPress={() => navigation.navigate('Connections')}
          activeOpacity={0.8}
        >
          <View style={styles.connectionsHeader}>
            <Text style={styles.sectionTitle}>Connections</Text>
            <Text style={styles.connectionsCount}>{connections.length} friends →</Text>
          </View>
          <View style={styles.connectionsCard}>
            {pendingCount > 0 && (
              <View style={styles.pendingBadgeRow}>
                <View style={styles.pendingDot} />
                <Text style={styles.pendingBadgeText}>{pendingCount} pending request{pendingCount > 1 ? 's' : ''}</Text>
              </View>
            )}
            {connections.length === 0 ? (
              <Text style={styles.emptyText}>Find people to connect with</Text>
            ) : (
              <View style={styles.avatarRow}>
                {connections.slice(0, 4).map(c => (
                  <View key={c.id} style={styles.miniAvatar}>
                    <Text style={styles.miniAvatarText}>{c.display_name.charAt(0).toUpperCase()}</Text>
                  </View>
                ))}
                {connections.length > 4 && (
                  <Text style={styles.moreText}>+{connections.length - 4}</Text>
                )}
              </View>
            )}
          </View>
        </TouchableOpacity>

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
  avatarImage: { width: 80, height: 80, borderRadius: 40 },
  avatarText: { color: '#fff', fontSize: 32, fontWeight: '800' },
  avatarEditBadge: {
    position: 'absolute', bottom: -2, right: -2,
    backgroundColor: Colors.card, borderRadius: 12, padding: 3,
    borderWidth: 1, borderColor: Colors.border,
  },
  avatarEditIcon: { fontSize: 12 },
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
  progressCard: {
    backgroundColor: Colors.card, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: Colors.border, gap: 10,
  },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressLabel: { color: Colors.subtext, fontSize: 12, width: 48 },
  progressTrack: { flex: 1, height: 6, backgroundColor: '#252535', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 3 },
  progressPct: { color: Colors.text, fontSize: 12, fontWeight: '700', width: 32, textAlign: 'right' },
  progressLink: { color: Colors.primaryLight, fontSize: 12, fontWeight: '600', marginTop: 4 },
  connectionsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  connectionsCount: { color: Colors.primaryLight, fontSize: 13, fontWeight: '600' },
  connectionsCard: {
    backgroundColor: Colors.card, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: Colors.border, gap: 10,
  },
  pendingBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pendingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.accent },
  pendingBadgeText: { color: Colors.accent, fontSize: 13, fontWeight: '600' },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  miniAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center',
  },
  miniAvatarText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  moreText: { color: Colors.subtext, fontSize: 13, fontWeight: '600', marginLeft: 4 },
  logoutBtn: {
    marginTop: 32, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12,
  },
  logoutText: { color: Colors.subtext, fontSize: 14, fontWeight: '600' },
});
