import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Colors } from '../constants/colors';
import { useStore } from '../store/useStore';
import {
  fetchDashboard,
  markAttendance,
  removeGoalEvent,
  checkScheduleFit,
  GoalEvent,
  Milestone,
} from '../api/dashboard';

function ProgressBar({ value }: { value: number }) {
  return (
    <View style={pb.track}>
      <View style={[pb.fill, { width: `${Math.round(value * 100)}%` }]} />
    </View>
  );
}

const pb = StyleSheet.create({
  track: { height: 8, backgroundColor: '#252535', borderRadius: 4, overflow: 'hidden', marginVertical: 6 },
  fill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 4 },
});

function MilestoneChip({ milestone }: { milestone: Milestone }) {
  const pct = Math.round((milestone.current_count / milestone.target_count) * 100);
  return (
    <View style={mc.chip}>
      <Text style={mc.title}>{milestone.title}</Text>
      <Text style={mc.count}>{milestone.current_count}/{milestone.target_count}</Text>
      <View style={mc.track}>
        <View style={[mc.fill, { width: `${pct}%` }]} />
      </View>
    </View>
  );
}

const mc = StyleSheet.create({
  chip: { backgroundColor: '#1E1E2A', borderRadius: 12, padding: 12, marginRight: 10, minWidth: 140 },
  title: { color: Colors.subtext, fontSize: 11, marginBottom: 4 },
  count: { color: Colors.text, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  track: { height: 4, backgroundColor: '#252535', borderRadius: 2, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: Colors.primaryLight, borderRadius: 2 },
});

type EventStatus = 'upcoming' | 'past_pending' | 'attended' | 'skipped';

function getEventStatus(ge: GoalEvent): EventStatus {
  if (ge.attended === true) return 'attended';
  if (ge.attended === false) return 'skipped';
  const now = new Date();
  const start = new Date(ge.event.starts_at);
  return start < now ? 'past_pending' : 'upcoming';
}

function GoalEventCard({
  ge,
  onAttended,
  onSkipped,
  onRemove,
  onViewDetail,
}: {
  ge: GoalEvent;
  onAttended: () => void;
  onSkipped: () => void;
  onRemove: () => void;
  onViewDetail: () => void;
}) {
  const status = getEventStatus(ge);
  const [scheduleFit, setScheduleFit] = useState<{ fits: boolean; conflicts: { event_id: number; title: string }[] } | null>(null);
  const { userId } = useStore();

  React.useEffect(() => {
    if (status === 'upcoming' && userId) {
      checkScheduleFit(userId, ge.event_id).then(setScheduleFit).catch(() => {});
    }
  }, [ge.event_id, status, userId]);

  const dateStr = new Date(ge.event.starts_at).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });

  return (
    <View style={ec.card}>
      <TouchableOpacity onPress={onViewDetail}>
        <View style={ec.header}>
          <View style={{ flex: 1 }}>
            <Text style={ec.title} numberOfLines={2}>{ge.event.title}</Text>
            <Text style={ec.meta}>{dateStr}</Text>
            <Text style={ec.meta}>{ge.event.location}</Text>
          </View>
          {status === 'upcoming' && scheduleFit && (
            <View style={[ec.fitBadge, !scheduleFit.fits && ec.fitBadgeConflict]}>
              <Text style={ec.fitText}>{scheduleFit.fits ? '🟢 Fits' : '🔴 Conflict'}</Text>
            </View>
          )}
          {status === 'attended' && (
            <View style={ec.attendedBadge}>
              <Text style={ec.attendedText}>✓ Attended</Text>
            </View>
          )}
        </View>

        {ge.contribution_label && (
          <Text style={ec.contribution}>
            🎯 {ge.contribution_label}
            {ge.contribution_score > 0 && ` · +${Math.round(ge.contribution_score * 100)}%`}
          </Text>
        )}
      </TouchableOpacity>

      {status === 'past_pending' && (
        <View style={ec.attendanceRow}>
          <Text style={ec.attendanceQ}>Did you go?</Text>
          <TouchableOpacity style={ec.yesBtn} onPress={onAttended}>
            <Text style={ec.yesBtnText}>Yes!</Text>
          </TouchableOpacity>
          <TouchableOpacity style={ec.noBtn} onPress={onSkipped}>
            <Text style={ec.noBtnText}>No</Text>
          </TouchableOpacity>
        </View>
      )}

      {(status === 'skipped' || status === 'upcoming') && (
        <TouchableOpacity style={ec.removeBtn} onPress={onRemove}>
          <Text style={ec.removeBtnText}>Remove</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const ec = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title: { color: Colors.text, fontSize: 14, fontWeight: '700', marginBottom: 3 },
  meta: { color: Colors.subtext, fontSize: 12, marginBottom: 1 },
  fitBadge: { backgroundColor: 'rgba(16,185,129,0.15)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  fitBadgeConflict: { backgroundColor: 'rgba(255,107,107,0.15)' },
  fitText: { fontSize: 11, fontWeight: '600', color: Colors.text },
  attendedBadge: { backgroundColor: 'rgba(16,185,129,0.2)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  attendedText: { color: Colors.success, fontSize: 11, fontWeight: '700' },
  contribution: { color: Colors.primaryLight, fontSize: 12, marginTop: 8, fontStyle: 'italic' },
  attendanceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  attendanceQ: { color: Colors.subtext, fontSize: 13, flex: 1 },
  yesBtn: { backgroundColor: Colors.success, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  yesBtnText: { color: Colors.white, fontWeight: '700', fontSize: 13 },
  noBtn: { backgroundColor: Colors.surface, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  noBtnText: { color: Colors.subtext, fontWeight: '600', fontSize: 13 },
  removeBtn: { alignSelf: 'flex-end', marginTop: 8 },
  removeBtnText: { color: Colors.muted, fontSize: 12 },
});

function TrackSection({
  label,
  progress,
  milestones,
  events,
  onAttended,
  onSkipped,
  onRemove,
  navigation,
}: {
  label: string;
  progress: number;
  milestones: Milestone[];
  events: GoalEvent[];
  onAttended: (ge: GoalEvent) => void;
  onSkipped: (ge: GoalEvent) => void;
  onRemove: (ge: GoalEvent) => void;
  navigation: any;
}) {
  return (
    <View style={styles.trackSection}>
      <Text style={styles.trackLabel}>{label}</Text>
      <View style={styles.progressRow}>
        <ProgressBar value={progress} />
        <Text style={styles.progressPct}>{Math.round(progress * 100)}%</Text>
      </View>

      {milestones.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.milestoneScroll}>
          {milestones.map((m, i) => <MilestoneChip key={i} milestone={m} />)}
        </ScrollView>
      )}

      {events.length === 0 ? (
        <Text style={styles.emptyText}>No events yet. Ask Copilot to suggest one.</Text>
      ) : (
        events.map((ge) => (
          <GoalEventCard
            key={ge.id}
            ge={ge}
            onAttended={() => onAttended(ge)}
            onSkipped={() => onSkipped(ge)}
            onRemove={() => onRemove(ge)}
            onViewDetail={() => navigation.navigate('EventDetail', { eventId: ge.event_id })}
          />
        ))
      )}
    </View>
  );
}

export default function GoalDashboardScreen({ navigation }: any) {
  const { userId, goalType } = useStore();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data: dashboard, isLoading, refetch } = useQuery({
    queryKey: ['dashboard', userId],
    queryFn: () => fetchDashboard(userId!),
    enabled: !!userId,
  });

  const attendMutation = useMutation({
    mutationFn: ({ ge, attended }: { ge: GoalEvent; attended: boolean }) =>
      markAttendance(userId!, ge.event_id, attended, ge.goal_type),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dashboard', userId] }),
  });

  const removeMutation = useMutation({
    mutationFn: (ge: GoalEvent) => removeGoalEvent(userId!, ge.event_id, ge.goal_type),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dashboard', userId] }),
  });

  const handleSkipped = useCallback((ge: GoalEvent) => {
    Alert.alert(
      'Remove from dashboard?',
      'Since you didn\'t attend, this will be removed and won\'t count toward your goal.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeMutation.mutate(ge),
        },
      ],
    );
  }, [removeMutation]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  if (!dashboard) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>Set a goal to see your dashboard.</Text>
      </View>
    );
  }

  const showCareer = ['career', 'both'].includes(dashboard.primary_type);
  const showSocial = ['social', 'both'].includes(dashboard.primary_type);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
    >
      <Text style={styles.header}>Goal Progress</Text>

      {showCareer && (
        <TrackSection
          label="Career Track"
          progress={dashboard.career_progress}
          milestones={dashboard.career_milestones}
          events={dashboard.career_events}
          onAttended={(ge) => attendMutation.mutate({ ge, attended: true })}
          onSkipped={handleSkipped}
          onRemove={(ge) => removeMutation.mutate(ge)}
          navigation={navigation}
        />
      )}

      {showSocial && (
        <TrackSection
          label="Social Track"
          progress={dashboard.social_progress}
          milestones={dashboard.social_milestones}
          events={dashboard.social_events}
          onAttended={(ge) => attendMutation.mutate({ ge, attended: true })}
          onSkipped={handleSkipped}
          onRemove={(ge) => removeMutation.mutate(ge)}
          navigation={navigation}
        />
      )}

      <TouchableOpacity
        style={styles.copilotBtn}
        onPress={() => navigation.navigate('Copilot', { initialMode: 'progress_review' })}
      >
        <Text style={styles.copilotBtnText}>Ask Copilot to review my progress</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  header: { color: Colors.text, fontSize: 24, fontWeight: '800', marginBottom: 24 },
  trackSection: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  trackLabel: { color: Colors.primary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressPct: { color: Colors.text, fontSize: 14, fontWeight: '700', minWidth: 36 },
  milestoneScroll: { marginVertical: 12 },
  emptyText: { color: Colors.muted, fontSize: 13, fontStyle: 'italic', marginTop: 8, textAlign: 'center' },
  copilotBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  copilotBtnText: { color: Colors.white, fontSize: 15, fontWeight: '700' },
});
