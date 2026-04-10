import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, SafeAreaView, Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Colors } from '../constants/colors';
import { TagChip } from '../components/TagChip';
import { fetchEvent } from '../api/events';
import { createRSVP, getUserRSVPs } from '../api/users';
import { useStore } from '../store/useStore';

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

  const eventQuery = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => fetchEvent(eventId),
  });

  const rsvpsQuery = useQuery({
    queryKey: ['rsvps', userId],
    queryFn: () => getUserRSVPs(userId!),
    enabled: !!userId,
  });

  const rsvpMutation = useMutation({
    mutationFn: () => createRSVP(userId!, eventId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rsvps', userId] });
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
    },
    onError: (e: any) => Alert.alert('Error', e.message),
  });

  const event = eventQuery.data;
  const alreadyRSVPed = rsvpsQuery.data?.some(r => r.event_id === eventId) ?? false;

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
});
