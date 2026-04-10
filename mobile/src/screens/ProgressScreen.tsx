import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Colors } from '../constants/colors';
import { useStore } from '../store/useStore';
import { fetchDashboard, markAttendance, GoalEvent } from '../api/dashboard';
import { getReferrals, logReferral, updateReferral, deleteReferral, Referral } from '../api/referrals';

// ─── Mini bar chart ──────────────────────────────────────────────────────────
function BarChart({ data }: { data: { label: string; rsvp: number; attended: number }[] }) {
  const maxVal = Math.max(...data.flatMap((d) => [d.rsvp, d.attended]), 1);
  return (
    <View style={chart.container}>
      {data.map((d, i) => (
        <View key={i} style={chart.col}>
          <View style={chart.bars}>
            <View style={[chart.bar, { height: (d.rsvp / maxVal) * 80, backgroundColor: Colors.primary + 'AA' }]} />
            <View style={[chart.bar, { height: (d.attended / maxVal) * 80, backgroundColor: Colors.success }]} />
          </View>
          <Text style={chart.label}>{d.label}</Text>
        </View>
      ))}
      <View style={chart.legend}>
        <View style={chart.legendItem}>
          <View style={[chart.dot, { backgroundColor: Colors.primary + 'AA' }]} />
          <Text style={chart.legendText}>RSVPed</Text>
        </View>
        <View style={chart.legendItem}>
          <View style={[chart.dot, { backgroundColor: Colors.success }]} />
          <Text style={chart.legendText}>Attended</Text>
        </View>
      </View>
    </View>
  );
}

const chart = StyleSheet.create({
  container: { paddingVertical: 8 },
  col: { alignItems: 'center', flex: 1 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 80 },
  bar: { width: 10, borderRadius: 3 },
  label: { color: Colors.subtext, fontSize: 10, marginTop: 4 },
  legend: { flexDirection: 'row', gap: 16, justifyContent: 'center', marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: Colors.subtext, fontSize: 11 },
});

// ─── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({ value, color = Colors.primary }: { value: number; color?: string }) {
  const pct = Math.min(Math.max(value, 0), 1);
  return (
    <View style={pb.track}>
      <View style={[pb.fill, { width: `${Math.round(pct * 100)}%`, backgroundColor: color }]} />
    </View>
  );
}
const pb = StyleSheet.create({
  track: { height: 6, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
});

// ─── Log Referral Modal ───────────────────────────────────────────────────────
function ReferralModal({
  visible,
  editing,
  onClose,
  onSave,
}: {
  visible: boolean;
  editing?: Referral;
  onClose: () => void;
  onSave: (data: { company_name: string; contact_name: string; notes: string }) => void;
}) {
  const [company, setCompany] = useState(editing?.company_name ?? '');
  const [contact, setContact] = useState(editing?.contact_name ?? '');
  const [notes, setNotes] = useState(editing?.notes ?? '');

  React.useEffect(() => {
    setCompany(editing?.company_name ?? '');
    setContact(editing?.contact_name ?? '');
    setNotes(editing?.notes ?? '');
  }, [editing, visible]);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={modal.overlay}>
        <View style={modal.sheet}>
          <Text style={modal.title}>{editing ? 'Update Referral' : 'Log Referral'}</Text>
          <Text style={modal.label}>Company *</Text>
          <TextInput
            style={modal.input}
            value={company}
            onChangeText={setCompany}
            placeholder="e.g. Google"
            placeholderTextColor={Colors.muted}
          />
          <Text style={modal.label}>Contact Name (optional)</Text>
          <TextInput
            style={modal.input}
            value={contact}
            onChangeText={setContact}
            placeholder="e.g. Jane Smith"
            placeholderTextColor={Colors.muted}
          />
          <Text style={modal.label}>Notes (optional)</Text>
          <TextInput
            style={[modal.input, { height: 72 }]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Any details..."
            placeholderTextColor={Colors.muted}
            multiline
          />
          <View style={modal.row}>
            <TouchableOpacity style={modal.cancel} onPress={onClose}>
              <Text style={modal.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={modal.save}
              onPress={() => {
                if (!company.trim()) return Alert.alert('Company name is required');
                onSave({ company_name: company.trim(), contact_name: contact.trim(), notes: notes.trim() });
              }}
            >
              <Text style={modal.saveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
const modal = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#00000088', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  title: { color: Colors.text, fontSize: 18, fontWeight: '700', marginBottom: 16 },
  label: { color: Colors.subtext, fontSize: 13, marginBottom: 4, marginTop: 12 },
  input: { backgroundColor: Colors.surface, borderRadius: 10, padding: 12, color: Colors.text, fontSize: 14, borderWidth: 1, borderColor: Colors.border },
  row: { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancel: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: Colors.surface, alignItems: 'center' },
  cancelText: { color: Colors.subtext, fontWeight: '600' },
  save: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: Colors.primary, alignItems: 'center' },
  saveText: { color: Colors.white, fontWeight: '700' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ProgressScreen() {
  const { userId } = useStore();
  const qc = useQueryClient();
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [editingReferral, setEditingReferral] = useState<Referral | undefined>();

  const {
    data: dashboard,
    isLoading: dashLoading,
    refetch: refetchDash,
  } = useQuery({ queryKey: ['dashboard', userId], queryFn: () => fetchDashboard(userId!) });

  const {
    data: referrals = [],
    isLoading: refLoading,
    refetch: refetchRef,
  } = useQuery({ queryKey: ['referrals', userId], queryFn: () => getReferrals(userId!) });

  const logMutation = useMutation({
    mutationFn: (data: { company_name: string; contact_name: string; notes: string }) =>
      logReferral({ user_id: userId!, ...data }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['referrals', userId] }); setShowReferralModal(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => updateReferral(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['referrals', userId] }); setShowReferralModal(false); setEditingReferral(undefined); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteReferral(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['referrals', userId] }),
  });

  const attendanceMutation = useMutation({
    mutationFn: ({ userId, eventId, attended, goalType }: any) =>
      markAttendance(userId, eventId, attended, goalType),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dashboard', userId] }),
  });

  const isLoading = dashLoading || refLoading;

  // Build weekly RSVP vs Attended chart data (last 4 weeks)
  const buildChartData = () => {
    if (!dashboard) return [];
    const allEvents = [...(dashboard.career_events || []), ...(dashboard.social_events || [])];
    const weeks: Record<string, { rsvp: number; attended: number }> = {};
    for (let i = 3; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i * 7);
      const label = `W${4 - i}`;
      weeks[label] = { rsvp: 0, attended: 0 };
    }
    allEvents.forEach((ge) => {
      const date = new Date(ge.added_at);
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
      const weekIdx = Math.min(Math.floor(diffDays / 7), 3);
      const label = `W${4 - weekIdx}`;
      if (weeks[label]) {
        weeks[label].rsvp += 1;
        if (ge.attended) weeks[label].attended += 1;
      }
    });
    return Object.entries(weeks).map(([label, v]) => ({ label, ...v }));
  };

  const chartData = buildChartData();

  // Pending confirmation events (attended is null, event is in past)
  const pendingEvents = [
    ...(dashboard?.career_events || []),
    ...(dashboard?.social_events || []),
  ].filter((ge) => ge.attended === null && new Date(ge.event.starts_at) < new Date());

  const allMilestones = [
    ...(dashboard?.career_milestones || []).map((m) => ({ ...m, color: Colors.categoryColors.career })),
    ...(dashboard?.social_milestones || []).map((m) => ({ ...m, color: Colors.categoryColors.social })),
  ];

  const totalRsvp = (dashboard?.career_events?.length || 0) + (dashboard?.social_events?.length || 0);
  const totalAttended = [
    ...(dashboard?.career_events || []),
    ...(dashboard?.social_events || []),
  ].filter((ge) => ge.attended === true).length;

  if (isLoading) {
    return (
      <SafeAreaView style={s.safe}>
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => { refetchDash(); refetchRef(); }}
            tintColor={Colors.primary}
          />
        }
      >
        <Text style={s.heading}>Progress</Text>

        {/* Overview cards */}
        <View style={s.cardRow}>
          <View style={[s.statCard, { borderColor: Colors.primary + '40' }]}>
            <Text style={s.statNum}>{totalRsvp}</Text>
            <Text style={s.statLabel}>RSVPed</Text>
          </View>
          <View style={[s.statCard, { borderColor: Colors.success + '40' }]}>
            <Text style={[s.statNum, { color: Colors.success }]}>{totalAttended}</Text>
            <Text style={s.statLabel}>Attended</Text>
          </View>
          <View style={[s.statCard, { borderColor: Colors.accent + '40' }]}>
            <Text style={[s.statNum, { color: Colors.accent }]}>{referrals.length}</Text>
            <Text style={s.statLabel}>Referrals</Text>
          </View>
        </View>

        {/* Weekly chart */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Weekly Activity</Text>
          <View style={s.card}>
            <View style={{ flexDirection: 'row' }}>
              {chartData.map((d, i) => (
                <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 80, gap: 2 }}>
                    <View style={[chart.bar, { height: Math.max((d.rsvp / Math.max(...chartData.map(x=>x.rsvp),1)) * 80, 4), backgroundColor: Colors.primary + '99' }]} />
                    <View style={[chart.bar, { height: Math.max((d.attended / Math.max(...chartData.map(x=>x.rsvp),1)) * 80, 0), backgroundColor: Colors.success }]} />
                  </View>
                  <Text style={chart.label}>{d.label}</Text>
                </View>
              ))}
            </View>
            <View style={chart.legend}>
              <View style={chart.legendItem}><View style={[chart.dot, { backgroundColor: Colors.primary + '99' }]} /><Text style={chart.legendText}>RSVPed</Text></View>
              <View style={chart.legendItem}><View style={[chart.dot, { backgroundColor: Colors.success }]} /><Text style={chart.legendText}>Attended</Text></View>
            </View>
          </View>
        </View>

        {/* Milestone progress */}
        {allMilestones.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Milestones</Text>
            <View style={s.card}>
              {allMilestones.map((m, i) => {
                const pct = m.target_count > 0 ? m.current_count / m.target_count : 0;
                return (
                  <View key={i} style={{ marginBottom: i < allMilestones.length - 1 ? 16 : 0 }}>
                    <View style={s.milestoneRow}>
                      <Text style={s.milestoneTitle}>{m.title}</Text>
                      <Text style={[s.milestoneCount, { color: m.color }]}>
                        {m.current_count}/{m.target_count}
                      </Text>
                    </View>
                    <ProgressBar value={pct} color={m.color} />
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Pending "Did you go?" */}
        {pendingEvents.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Did you go?</Text>
            {pendingEvents.map((ge) => (
              <View key={ge.id} style={s.pendingCard}>
                <View style={{ flex: 1 }}>
                  <Text style={s.pendingTitle}>{ge.event.title}</Text>
                  <Text style={s.pendingTime}>
                    {new Date(ge.event.starts_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </Text>
                </View>
                <View style={s.pendingBtns}>
                  <TouchableOpacity
                    style={[s.pendingBtn, { backgroundColor: Colors.success + '22', borderColor: Colors.success }]}
                    onPress={() => attendanceMutation.mutate({ userId, eventId: ge.event_id, attended: true, goalType: ge.goal_type })}
                  >
                    <Text style={[s.pendingBtnText, { color: Colors.success }]}>Yes</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.pendingBtn, { backgroundColor: Colors.accent + '22', borderColor: Colors.accent }]}
                    onPress={() => attendanceMutation.mutate({ userId, eventId: ge.event_id, attended: false, goalType: ge.goal_type })}
                  >
                    <Text style={[s.pendingBtnText, { color: Colors.accent }]}>No</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Referral log */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Referrals</Text>
            <TouchableOpacity
              style={s.addBtn}
              onPress={() => { setEditingReferral(undefined); setShowReferralModal(true); }}
            >
              <Text style={s.addBtnText}>+ Log Referral</Text>
            </TouchableOpacity>
          </View>
          {referrals.length === 0 ? (
            <View style={s.emptyCard}>
              <Text style={s.emptyText}>No referrals logged yet.</Text>
              <Text style={s.emptySubtext}>Tap "Log Referral" after receiving one at an event.</Text>
            </View>
          ) : (
            referrals.map((ref) => (
              <View key={ref.id} style={s.referralCard}>
                <View style={{ flex: 1 }}>
                  <Text style={s.refCompany}>{ref.company_name}</Text>
                  {ref.contact_name ? <Text style={s.refContact}>{ref.contact_name}</Text> : null}
                  {ref.notes ? <Text style={s.refNotes}>{ref.notes}</Text> : null}
                  <Text style={s.refDate}>
                    {new Date(ref.received_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </Text>
                </View>
                <View style={s.referralActions}>
                  <TouchableOpacity
                    onPress={() => { setEditingReferral(ref); setShowReferralModal(true); }}
                    style={s.editBtn}
                  >
                    <Text style={s.editBtnText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() =>
                      Alert.alert('Delete referral?', '', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(ref.id) },
                      ])
                    }
                  >
                    <Text style={s.deleteText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <ReferralModal
        visible={showReferralModal}
        editing={editingReferral}
        onClose={() => { setShowReferralModal(false); setEditingReferral(undefined); }}
        onSave={(data) => {
          if (editingReferral) {
            updateMutation.mutate({ id: editingReferral.id, data });
          } else {
            logMutation.mutate(data);
          }
        }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  heading: { color: Colors.text, fontSize: 26, fontWeight: '800', marginBottom: 20 },
  cardRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
  },
  statNum: { color: Colors.primary, fontSize: 26, fontWeight: '800' },
  statLabel: { color: Colors.subtext, fontSize: 12, marginTop: 2 },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { color: Colors.text, fontSize: 17, fontWeight: '700', marginBottom: 12 },
  card: { backgroundColor: Colors.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border },
  milestoneRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  milestoneTitle: { color: Colors.text, fontSize: 14 },
  milestoneCount: { fontSize: 13, fontWeight: '700' },
  pendingCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pendingTitle: { color: Colors.text, fontSize: 14, fontWeight: '600' },
  pendingTime: { color: Colors.subtext, fontSize: 12, marginTop: 2 },
  pendingBtns: { flexDirection: 'row', gap: 8 },
  pendingBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  pendingBtnText: { fontWeight: '700', fontSize: 13 },
  addBtn: { backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  addBtnText: { color: Colors.white, fontSize: 13, fontWeight: '700' },
  emptyCard: { backgroundColor: Colors.card, borderRadius: 14, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  emptyText: { color: Colors.text, fontSize: 15, fontWeight: '600' },
  emptySubtext: { color: Colors.subtext, fontSize: 13, marginTop: 4, textAlign: 'center' },
  referralCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  refCompany: { color: Colors.text, fontSize: 15, fontWeight: '700' },
  refContact: { color: Colors.primaryLight, fontSize: 13, marginTop: 2 },
  refNotes: { color: Colors.subtext, fontSize: 12, marginTop: 2 },
  refDate: { color: Colors.muted, fontSize: 11, marginTop: 4 },
  referralActions: { justifyContent: 'space-around', gap: 8 },
  editBtn: { backgroundColor: Colors.surface, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  editBtnText: { color: Colors.primaryLight, fontSize: 13, fontWeight: '600' },
  deleteText: { color: Colors.accent, fontSize: 13, fontWeight: '600' },
});
