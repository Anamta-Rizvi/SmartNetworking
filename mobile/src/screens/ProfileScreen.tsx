import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert,
  Modal, TextInput,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../constants/colors';
import { TagChip } from '../components/TagChip';
import { getUser, getInterests, getRsvpsWithConnections, RSVPWithConnections } from '../api/users';
import { getGoals, updateGoalStatus, Goal } from '../api/goals';
import { fetchEvent } from '../api/events';
import { getConnections, getPendingRequests } from '../api/connections';
import { uploadAvatar } from '../api/uploads';
import { useStore } from '../store/useStore';
import { API_BASE } from '../api/client';
import { getSchedule, addClass, deleteClass, ClassSlot, DAY_NAMES } from '../api/schedule';
import { getCompanyPreferences, addCompanyPreference, deleteCompanyPreference, getSuggestedCompanies } from '../api/companies';

// ─── Class Schedule Section ───────────────────────────────────────────────────
function ClassScheduleSection({ userId }: { userId: number }) {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [className, setClassName] = useState('');
  const [day, setDay] = useState(0);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:30');

  const { data: slots = [] } = useQuery({
    queryKey: ['schedule', userId],
    queryFn: () => getSchedule(userId),
  });

  const addMutation = useMutation({
    mutationFn: () => addClass({ user_id: userId, class_name: className, day_of_week: day, start_time: startTime, end_time: endTime }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['schedule', userId] }); setShowModal(false); setClassName(''); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteClass(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedule', userId] }),
  });

  const byDay = DAY_NAMES.map((name, idx) => ({
    name,
    slots: slots.filter(s => s.day_of_week === idx),
  })).filter(d => d.slots.length > 0);

  return (
    <View>
      <View style={pref.sectionHeader}>
        <Text style={pref.sectionTitle}>Class Schedule</Text>
        <TouchableOpacity style={pref.addBtn} onPress={() => setShowModal(true)}>
          <Text style={pref.addBtnText}>+ Add Class</Text>
        </TouchableOpacity>
      </View>
      {byDay.length === 0 ? (
        <Text style={pref.empty}>No classes added. Add your schedule so Copilot can suggest events around your free time.</Text>
      ) : (
        byDay.map(d => (
          <View key={d.name} style={{ marginBottom: 8 }}>
            <Text style={pref.dayLabel}>{d.name}</Text>
            {d.slots.map(slot => (
              <View key={slot.id} style={pref.slotRow}>
                <Text style={pref.slotName}>{slot.class_name}</Text>
                <Text style={pref.slotTime}>{slot.start_time}–{slot.end_time}</Text>
                <TouchableOpacity onPress={() => deleteMutation.mutate(slot.id)}>
                  <Text style={pref.deleteText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ))
      )}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={pref.overlay}>
          <View style={pref.sheet}>
            <Text style={pref.modalTitle}>Add Class</Text>
            <Text style={pref.label}>Class Name *</Text>
            <TextInput style={pref.input} value={className} onChangeText={setClassName} placeholder="e.g. Algorithms" placeholderTextColor={Colors.muted} />
            <Text style={pref.label}>Day</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {DAY_NAMES.map((n, i) => (
                  <TouchableOpacity key={i} style={[pref.dayChip, day === i && pref.dayChipActive]} onPress={() => setDay(i)}>
                    <Text style={[pref.dayChipText, day === i && { color: Colors.white }]}>{n.slice(0, 3)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={pref.label}>Start (HH:MM)</Text>
                <TextInput style={pref.input} value={startTime} onChangeText={setStartTime} placeholder="09:00" placeholderTextColor={Colors.muted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={pref.label}>End (HH:MM)</Text>
                <TextInput style={pref.input} value={endTime} onChangeText={setEndTime} placeholder="10:30" placeholderTextColor={Colors.muted} />
              </View>
            </View>
            <View style={pref.btnRow}>
              <TouchableOpacity style={pref.cancelBtn} onPress={() => setShowModal(false)}>
                <Text style={pref.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[pref.saveBtn, !className.trim() && { opacity: 0.4 }]}
                disabled={!className.trim()}
                onPress={() => addMutation.mutate()}
              >
                <Text style={pref.saveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Company Preferences Section ──────────────────────────────────────────────
function CompanyPreferencesSection({ userId }: { userId: number }) {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [jobRole, setJobRole] = useState('');

  const { data: prefs = [] } = useQuery({
    queryKey: ['company-prefs', userId],
    queryFn: () => getCompanyPreferences(userId),
  });

  const { data: suggestions } = useQuery({
    queryKey: ['company-suggestions', userId],
    queryFn: () => getSuggestedCompanies(userId),
    enabled: prefs.length > 0,
  });

  const addMutation = useMutation({
    mutationFn: () => addCompanyPreference(userId, companyName, jobRole || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company-prefs', userId] });
      qc.invalidateQueries({ queryKey: ['company-suggestions', userId] });
      setShowModal(false);
      setCompanyName('');
      setJobRole('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteCompanyPreference(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company-prefs', userId] });
      qc.invalidateQueries({ queryKey: ['company-suggestions', userId] });
    },
  });

  return (
    <View>
      <View style={pref.sectionHeader}>
        <Text style={pref.sectionTitle}>Target Companies</Text>
        <TouchableOpacity style={pref.addBtn} onPress={() => setShowModal(true)}>
          <Text style={pref.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>
      {prefs.length === 0 ? (
        <Text style={pref.empty}>Add companies you're targeting. Copilot will prioritize events and connections from these companies.</Text>
      ) : (
        <View style={{ gap: 8 }}>
          {prefs.map(p => (
            <View key={p.id} style={pref.companyRow}>
              <View style={{ flex: 1 }}>
                <Text style={pref.companyName}>{p.company_name}</Text>
                {p.job_role ? <Text style={pref.companyRole}>{p.job_role}</Text> : null}
              </View>
              <TouchableOpacity onPress={() => deleteMutation.mutate(p.id)}>
                <Text style={pref.deleteText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
      {suggestions?.suggestions && suggestions.suggestions.length > 0 && (
        <View style={{ marginTop: 12 }}>
          <Text style={pref.aiSuggestHeader}>AI also suggests</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
            {suggestions.suggestions.slice(0, 6).map((s, i) => (
              <TouchableOpacity
                key={i}
                style={pref.suggestChip}
                onPress={() => {
                  setCompanyName(s);
                  setShowModal(true);
                }}
              >
                <Text style={pref.suggestChipText}>+ {s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={pref.overlay}>
          <View style={pref.sheet}>
            <Text style={pref.modalTitle}>Add Target Company</Text>
            <Text style={pref.label}>Company Name *</Text>
            <TextInput style={pref.input} value={companyName} onChangeText={setCompanyName} placeholder="e.g. Google" placeholderTextColor={Colors.muted} />
            <Text style={pref.label}>Job Role / Function (optional)</Text>
            <TextInput style={pref.input} value={jobRole} onChangeText={setJobRole} placeholder="e.g. Software Engineer" placeholderTextColor={Colors.muted} />
            <View style={pref.btnRow}>
              <TouchableOpacity style={pref.cancelBtn} onPress={() => setShowModal(false)}>
                <Text style={pref.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[pref.saveBtn, !companyName.trim() && { opacity: 0.4 }]}
                disabled={!companyName.trim()}
                onPress={() => addMutation.mutate()}
              >
                <Text style={pref.saveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const pref = StyleSheet.create({
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  addBtn: { backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  addBtnText: { color: Colors.white, fontSize: 13, fontWeight: '700' },
  empty: { color: Colors.muted, fontSize: 13, lineHeight: 18 },
  dayLabel: { color: Colors.subtext, fontSize: 12, fontWeight: '700', marginBottom: 4, textTransform: 'uppercase' },
  slotRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.card, borderRadius: 10, padding: 10, marginBottom: 6,
    borderWidth: 1, borderColor: Colors.border,
  },
  slotName: { flex: 1, color: Colors.text, fontSize: 14, fontWeight: '600' },
  slotTime: { color: Colors.subtext, fontSize: 12 },
  deleteText: { color: Colors.muted, fontSize: 16, paddingLeft: 4 },
  overlay: { flex: 1, backgroundColor: '#00000088', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalTitle: { color: Colors.text, fontSize: 18, fontWeight: '700', marginBottom: 16 },
  label: { color: Colors.subtext, fontSize: 13, marginBottom: 4, marginTop: 10 },
  input: { backgroundColor: Colors.surface, borderRadius: 10, padding: 12, color: Colors.text, fontSize: 14, borderWidth: 1, borderColor: Colors.border },
  dayChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  dayChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  dayChipText: { color: Colors.subtext, fontSize: 13, fontWeight: '600' },
  btnRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: Colors.surface, alignItems: 'center' },
  cancelText: { color: Colors.subtext, fontWeight: '600' },
  saveBtn: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: Colors.primary, alignItems: 'center' },
  saveText: { color: Colors.white, fontWeight: '700' },
  companyRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.card, borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  companyName: { color: Colors.text, fontSize: 14, fontWeight: '600' },
  companyRole: { color: Colors.subtext, fontSize: 12, marginTop: 2 },
  aiSuggestHeader: { color: Colors.subtext, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  suggestChip: { backgroundColor: Colors.primary + '18', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: Colors.primary + '55' },
  suggestChipText: { color: Colors.primaryLight, fontSize: 13, fontWeight: '600' },
});

const GOAL_TYPE_LABEL: Record<string, string> = {
  career: '💼 Career',
  social: '🎉 Social',
  both: '⚡ Career + Social',
};

function UpcomingRSVPs({ userId, navigation }: { userId: number; navigation: any }) {
  const { data: rsvpsWithConn = [] } = useQuery({
    queryKey: ['rsvps-connections', userId],
    queryFn: () => getRsvpsWithConnections(userId),
  });

  const upcoming = rsvpsWithConn
    .filter(r => new Date(r.event_starts_at) >= new Date())
    .slice(0, 5);

  if (upcoming.length === 0) {
    return <Text style={styles.emptyText}>No RSVPs yet. Discover events on the Home tab.</Text>;
  }

  return (
    <View style={styles.rsvpList}>
      {upcoming.map(r => (
        <TouchableOpacity
          key={r.rsvp_id}
          style={styles.rsvpItem}
          onPress={() => navigation.navigate('EventDetail', { eventId: r.event_id })}
          activeOpacity={0.8}
        >
          <View style={styles.rsvpDot} />
          <View style={{ flex: 1 }}>
            <Text style={styles.rsvpTitle} numberOfLines={1}>{r.event_title}</Text>
            <Text style={styles.rsvpMeta}>
              {new Date(r.event_starts_at).toLocaleDateString('en-US', {
                weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
              })}
              {r.event_location ? ` · ${r.event_location}` : ''}
            </Text>
            {r.connections_attending.length > 0 && (
              <View style={styles.rsvpConnRow}>
                <View style={{ flexDirection: 'row', gap: -6 }}>
                  {r.connections_attending.slice(0, 3).map((c, i) => (
                    <View key={c.user_id} style={[styles.rsvpConnAvatar, { zIndex: 10 - i }]}>
                      <Text style={styles.rsvpConnLetter}>{c.display_name[0].toUpperCase()}</Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.rsvpConnText}>
                  {r.connections_attending.length === 1
                    ? `${r.connections_attending[0].display_name} is also going`
                    : `${r.connections_attending[0].display_name} +${r.connections_attending.length - 1} connections going`}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function GoalCard({ goal, onMarkDone, onMarkOngoing, navigation }: {
  goal: Goal;
  onMarkDone: (id: number) => void;
  onMarkOngoing: (id: number) => void;
  navigation: any;
}) {
  const isCompleted = goal.status === 'completed';
  return (
    <View style={[styles.goalCard, !isCompleted && styles.goalCardCurrent, isCompleted && styles.goalCardCompleted]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <Text style={[styles.goalType, isCompleted && { color: Colors.muted }]}>
          {GOAL_TYPE_LABEL[goal.primary_type] ?? goal.primary_type}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={styles.goalDateText}>
            {new Date(goal.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </Text>
          <TouchableOpacity
            style={[styles.goalStatusBtn, isCompleted && styles.goalStatusBtnCompleted]}
            onPress={() => isCompleted ? onMarkOngoing(goal.id) : onMarkDone(goal.id)}
          >
            <Text style={[styles.goalStatusBtnText, isCompleted && styles.goalStatusBtnTextCompleted]}>
              {isCompleted ? 'Completed' : 'Mark done'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Career section */}
      {['career', 'both'].includes(goal.primary_type) && (
        <View style={styles.goalSection}>
          <Text style={styles.goalSectionHeader}>Career</Text>
          {goal.career_track ? (
            <View style={styles.goalRow}>
              <Text style={styles.goalLabel}>Track</Text>
              <Text style={[styles.goalValue, isCompleted && { color: Colors.muted }]}>{goal.career_track}</Text>
            </View>
          ) : (
            <Text style={styles.goalEmpty}>No career track set</Text>
          )}
        </View>
      )}

      {/* Social section */}
      {['social', 'both'].includes(goal.primary_type) && (
        <View style={styles.goalSection}>
          <Text style={styles.goalSectionHeader}>Social</Text>
          {goal.social_intent ? (
            <View style={styles.goalRow}>
              <Text style={styles.goalLabel}>Looking for</Text>
              <Text style={[styles.goalValue, isCompleted && { color: Colors.muted }]}>{goal.social_intent}</Text>
            </View>
          ) : (
            <Text style={styles.goalEmpty}>No social intent set</Text>
          )}
          {goal.social_pref_note && (
            <View style={styles.goalRow}>
              <Text style={styles.goalLabel}>Preferences</Text>
              <Text style={[styles.goalValue, isCompleted && { color: Colors.muted }]}>{goal.social_pref_note}</Text>
            </View>
          )}
        </View>
      )}

      <TouchableOpacity
        style={styles.seeProgressBtn}
        onPress={() => navigation.navigate('Progress', { goalId: goal.id, primaryType: goal.primary_type })}
      >
        <Text style={styles.seeProgressText}>See Progress →</Text>
      </TouchableOpacity>
    </View>
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

  const userQuery = useQuery({
    queryKey: ['user', userId],
    queryFn: () => getUser(userId!),
    enabled: !!userId,
  });

  const goalQuery = useQuery({
    queryKey: ['goals', userId],
    queryFn: () => getGoals(userId!),
    enabled: !!userId,
    staleTime: 0,
  });

  // Refetch goals every time this screen comes into focus
  const refetchGoals = goalQuery.refetch;
  useFocusEffect(useCallback(() => {
    if (userId) refetchGoals();
  }, [userId, refetchGoals]));

  const interestsQuery = useQuery({
    queryKey: ['interests', userId],
    queryFn: () => getInterests(userId!),
    enabled: !!userId,
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

  const qcGoals = useQueryClient();
  const goalStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'ongoing' | 'completed' }) =>
      updateGoalStatus(id, status),
    onSuccess: () => qcGoals.invalidateQueries({ queryKey: ['goals', userId] }),
  });

  const goals = goalQuery.data ?? [];
  const ongoingGoals = goals.filter(g => g.status !== 'completed');
  const completedGoals = goals.filter(g => g.status === 'completed');
  const interests = interestsQuery.data ?? [];
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
        {userQuery.data?.title && (
          <View style={styles.titleBadge}>
            <Text style={styles.titleBadgeText}>{userQuery.data.title}</Text>
          </View>
        )}
        <Text style={styles.email}>{email}</Text>
        {(major || gradYear) && (
          <Text style={styles.meta}>
            {[major, gradYear ? `Class of ${gradYear}` : ''].filter(Boolean).join(' · ')}
          </Text>
        )}

        {goals.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Goals ({goals.length})</Text>
            <View style={{ gap: 16 }}>
              {ongoingGoals.length > 0 && (
                <View style={{ gap: 10 }}>
                  <Text style={styles.goalGroupLabel}>Ongoing</Text>
                  {ongoingGoals.map(g => (
                    <GoalCard
                      key={g.id}
                      goal={g}
                      navigation={navigation}
                      onMarkDone={id => goalStatusMutation.mutate({ id, status: 'completed' })}
                      onMarkOngoing={id => goalStatusMutation.mutate({ id, status: 'ongoing' })}
                    />
                  ))}
                </View>
              )}
              {completedGoals.length > 0 && (
                <View style={{ gap: 10 }}>
                  <Text style={styles.goalGroupLabel}>Completed</Text>
                  {completedGoals.map(g => (
                    <GoalCard
                      key={g.id}
                      goal={g}
                      navigation={navigation}
                      onMarkDone={id => goalStatusMutation.mutate({ id, status: 'completed' })}
                      onMarkOngoing={id => goalStatusMutation.mutate({ id, status: 'ongoing' })}
                    />
                  ))}
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

        {/* Class Schedule */}
        {userId && (
          <View style={styles.section}>
            <ClassScheduleSection userId={userId} />
          </View>
        )}

        {/* Company Preferences */}
        {userId && (
          <View style={styles.section}>
            <CompanyPreferencesSection userId={userId} />
          </View>
        )}

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
  seeProgressBtn: {
    marginTop: 12, paddingVertical: 8, borderRadius: 8,
    backgroundColor: Colors.primary + '18',
    alignItems: 'center', borderWidth: 1, borderColor: Colors.primary + '44',
  },
  seeProgressText: { color: Colors.primaryLight, fontSize: 13, fontWeight: '700' },
  goalGroupLabel: { color: Colors.subtext, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  goalType: { color: Colors.primaryLight, fontSize: 15, fontWeight: '700' },
  goalCardCurrent: { borderColor: Colors.primary + '66' },
  goalCardCompleted: { opacity: 0.65 },
  goalDateText: { color: Colors.muted, fontSize: 11 },
  goalStatusBtn: {
    backgroundColor: Colors.primary + '22', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: Colors.primary + '44',
  },
  goalStatusBtnText: { color: Colors.primaryLight, fontSize: 11, fontWeight: '700' },
  goalStatusBtnCompleted: { backgroundColor: Colors.success + '22', borderColor: Colors.success + '44' },
  goalStatusBtnTextCompleted: { color: Colors.success },
  goalSection: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  goalSectionHeader: { color: Colors.subtext, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  goalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  goalLabel: { color: Colors.subtext, fontSize: 13 },
  goalValue: { color: Colors.text, fontSize: 13, fontWeight: '600', flex: 1, textAlign: 'right' },
  goalEmpty: { color: Colors.muted, fontSize: 13, fontStyle: 'italic' },
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
  titleBadge: {
    backgroundColor: Colors.primary + '22', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 4,
    marginBottom: 6, borderWidth: 1, borderColor: Colors.primary + '44',
  },
  titleBadgeText: { color: Colors.primaryLight, fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  rsvpConnRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  rsvpConnAvatar: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: Colors.primary + 'bb',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: Colors.card,
  },
  rsvpConnLetter: { color: Colors.white, fontSize: 9, fontWeight: '700' },
  rsvpConnText: { color: Colors.subtext, fontSize: 11, fontWeight: '500', flex: 1 },
  logoutBtn: {
    marginTop: 32, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12,
  },
  logoutText: { color: Colors.subtext, fontSize: 14, fontWeight: '600' },
});
