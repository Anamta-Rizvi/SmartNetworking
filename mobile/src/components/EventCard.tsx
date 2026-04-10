import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';
import { TagChip } from './TagChip';
import { Event } from '../api/events';

interface Props {
  event: Event;
  reason?: string;
  onPress: () => void;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function EventCard({ event, reason, onPress }: Props) {
  const primaryTag = event.tags[0];

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.header}>
        <View style={styles.dateBadge}>
          <Text style={styles.dateText}>{formatDate(event.starts_at)}</Text>
          <Text style={styles.timeText}>{formatTime(event.starts_at)}</Text>
        </View>
        {event.is_virtual && (
          <View style={styles.virtualBadge}>
            <Text style={styles.virtualText}>Virtual</Text>
          </View>
        )}
      </View>

      <Text style={styles.title} numberOfLines={2}>{event.title}</Text>
      <Text style={styles.organizer}>{event.organizer}</Text>
      <Text style={styles.location} numberOfLines={1}>📍 {event.location}</Text>

      {reason && (
        <View style={styles.reasonBox}>
          <Text style={styles.reasonText}>✨ {reason}</Text>
        </View>
      )}

      <View style={styles.footer}>
        <View style={styles.tags}>
          {event.tags.slice(0, 3).map(tag => (
            <TagChip key={tag.id} label={tag.name} category={tag.category} small />
          ))}
        </View>
        <Text style={styles.rsvpCount}>{event.rsvp_count} going</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  dateBadge: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  dateText: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '600',
  },
  timeText: {
    color: Colors.subtext,
    fontSize: 11,
    marginTop: 1,
  },
  virtualBadge: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  virtualText: {
    color: Colors.success,
    fontSize: 11,
    fontWeight: '600',
  },
  title: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: 4,
  },
  organizer: {
    color: Colors.subtext,
    fontSize: 12,
    marginBottom: 4,
  },
  location: {
    color: Colors.subtext,
    fontSize: 12,
    marginBottom: 10,
  },
  reasonBox: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  reasonText: {
    color: Colors.primaryLight,
    fontSize: 12,
    fontStyle: 'italic',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    flex: 1,
  },
  rsvpCount: {
    color: Colors.muted,
    fontSize: 11,
  },
});
