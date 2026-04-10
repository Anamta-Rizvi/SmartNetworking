import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Image,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Colors } from '../constants/colors';
import { TagChip } from '../components/TagChip';
import { fetchEvent } from '../api/events';
import { createRSVP, getUserRSVPs } from '../api/users';
import { fetchEventAttendees, sendConnectionRequest, RSVPAttendeeOut } from '../api/connections';
import { useStore } from '../store/useStore';
import { API_BASE } from '../api/client';

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

export function EventDetailScreen({ route, navigation }: any) {
  const { eventId } = route.params;
  const userId = useStore(s => s.userId);
  const queryClient = useQueryClient();
  const [showAllAttendees, setShowAllAttendees] = useState(false);
  const [localStatuses, setLocalStatuses] = useState<Record<number, string>>({});

  const eventQuery = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => fetchEvent(eventId),
  });

  const rsvpsQuery = useQuery({
    queryKey: ['rsvps', userId],
    queryFn: () => getUserRSVPs(userId!),
    enabled: !!userId,
  });

  const attendeesQuery = useQuery<RSVPAttendeeOut[]>({
    queryKey: ['attendees', eventId, userId],
    queryFn: () => fetchEventAttendees(eventId, userId!),
    enabled: !!userId,
  });

  const rsvpMutation = useMutation({
    mutationFn: () => createRSVP(userId!, eventId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rsvps', userId] });
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['attendees', eventId, userId] });
    },
    onError: (e: any) => Alert.alert('Error', e.message),
  });

  const connectMutation = useMutation({
    mutationFn: (addresseeId: number) => sendConnectionRequest(userId!, addresseeId),
    onSuccess: (_, addresseeId) => {
      setLocalStatuses(prev => ({ ...prev, [addresseeId]: 'pending_sent' }));
    },
    onError: () => Alert.alert('Error', 'Could not send connection request.'),
  });

  const event = eventQuery.data;
  const alreadyRSVPed = rsvpsQuery.data?.some(r => r.event_id === eventId) ?? false;
  const attendees = attendeesQuery.data ?? [];
  const visibleAttendees = showAllAttendees ? attendees : attendees.slice(0, 5);

  if (eventQuery.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.center}>
        <Text style={{ color: Colors.subtext }}>Event not found.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.categoryBar}>
          {event.tags.slice(0, 2).map(tag => (
            <TagChip key={tag.id} label={tag.name} category={tag.category} small />
          ))}
          {event.is_virtual && <TagChip label="Virtual" category="academic" small />}
        </View>

        <Text style={styles.title}>{event.title}</Text>

        <View style={styles.metaRow}>
          <Text style={styles.metaIcon}>🏛</Text>
          <Text style={styles.metaText}>{event.organizer}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaIcon}>📅</Text>
          <Text style={styles.metaText}>{formatDateTime(event.starts_at)}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaIcon}>📍</Text>
          <Text style={styles.metaText}>{event.location}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaIcon}>👥</Text>
          <Text style={styles.metaText}>{event.rsvp_count} people going</Text>
        </View>

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>About</Text>
        <Text style={styles.description}>{event.description}</Text>

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Tags</Text>
        <View style={styles.tagsRow}>
          {event.tags.map(tag => (
            <TagChip key={tag.id} label={tag.name} category={tag.category} />
          ))}
        </View>

        {attendees.length > 0 && (
          <>
            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>Who's Going ({attendees.length})</Text>
            {visibleAttendees.map(a => {
              const status = localStatuses[a.user_id] ?? a.connection_status;
              return (
                <View key={a.user_id} style={styles.attendeeRow}>
                  <View style={styles.attendeeAvatar}>
                    {a.avatar_url ? (
                      <Image source={{ uri: `${API_BASE}${a.avatar_url}` }} style={styles.attendeeAvatarImg} />
                    ) : (
                      <Text style={styles.attendeeAvatarText}>{a.display_name.charAt(0).toUpperCase()}</Text>
                    )}
                  </View>
                  <Text style={styles.attendeeName} numberOfLines={1}>{a.display_name}</Text>
                  {status === 'self' ? null : status === 'connected' ? (
                    <View style={styles.connectedBadge}><Text style={styles.connectedBadgeText}>Connected</Text></View>
                  ) : status === 'pending_sent' ? (
                    <Text style={styles.pendingText}>Pending</Text>
                  ) : (
                    <TouchableOpacity
                      style={styles.connectBtn}
                      onPress={() => connectMutation.mutate(a.user_id)}
                    >
                      <Text style={styles.connectBtnText}>Connect</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
            {!showAllAttendees && attendees.length > 5 && (
              <TouchableOpacity onPress={() => setShowAllAttendees(true)}>
                <Text style={styles.seeAllText}>+ {attendees.length - 5} more</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={styles.footer}>
        {alreadyRSVPed ? (
          <View style={styles.rsvpedBox}>
            <Text style={styles.rsvpedText}>✓ You're going!</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.rsvpBtn}
            onPress={() => rsvpMutation.mutate()}
            disabled={rsvpMutation.isPending}
            activeOpacity={0.85}
          >
            {rsvpMutation.isPending
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.rsvpBtnText}>RSVP Now</Text>}
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  navBar: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  backBtn: { padding: 4 },
  backText: { color: Colors.primaryLight, fontSize: 15, fontWeight: '600' },
  content: { paddingHorizontal: 24, paddingTop: 12 },
  categoryBar: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
  title: { color: Colors.text, fontSize: 24, fontWeight: '800', lineHeight: 32, marginBottom: 20 },
  metaRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10, gap: 10 },
  metaIcon: { fontSize: 16, width: 22 },
  metaText: { color: Colors.subtext, fontSize: 14, flex: 1, lineHeight: 20 },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 20 },
  sectionTitle: { color: Colors.text, fontSize: 16, fontWeight: '700', marginBottom: 10 },
  description: { color: Colors.subtext, fontSize: 15, lineHeight: 24 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap' },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.background, padding: 24, paddingBottom: 36,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  rsvpBtn: {
    backgroundColor: Colors.primary, borderRadius: 14,
    padding: 16, alignItems: 'center',
  },
  rsvpBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  rsvpedBox: {
    backgroundColor: Colors.surface, borderRadius: 14,
    padding: 16, alignItems: 'center', borderWidth: 1, borderColor: Colors.success,
  },
  rsvpedText: { color: Colors.success, fontSize: 16, fontWeight: '700' },
  attendeeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  attendeeAvatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden',
  },
  attendeeAvatarImg: { width: 32, height: 32, borderRadius: 16 },
  attendeeAvatarText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  attendeeName: { color: Colors.text, fontSize: 14, flex: 1 },
  connectedBadge: {
    backgroundColor: 'rgba(16,185,129,0.15)', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  connectedBadgeText: { color: Colors.success, fontSize: 11, fontWeight: '700' },
  pendingText: { color: Colors.muted, fontSize: 12, fontWeight: '600' },
  connectBtn: {
    backgroundColor: Colors.primary, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  connectBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  seeAllText: { color: Colors.primaryLight, fontSize: 13, fontWeight: '600', marginTop: 10 },
});
