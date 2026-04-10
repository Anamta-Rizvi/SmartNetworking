import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../constants/colors';
import { useStore } from '../store/useStore';
import {
  getConversations,
  getReferralSuggestions,
  sendBulkAIMessage,
  Conversation,
  ReferralSuggestionPeer,
} from '../api/chat';

function Avatar({ name, url, size = 44 }: { name: string; url?: string; size?: number }) {
  if (url) {
    return <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return (
    <View style={[av.circle, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[av.letter, { fontSize: size * 0.4 }]}>{name[0]?.toUpperCase() ?? '?'}</Text>
    </View>
  );
}
const av = StyleSheet.create({
  circle: { backgroundColor: Colors.primary + '44', alignItems: 'center', justifyContent: 'center' },
  letter: { color: Colors.primaryLight, fontWeight: '700' },
});

// ─── AI Referral Banner ───────────────────────────────────────────────────────
function ReferralBanner({ userId }: { userId: number }) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [dismissed, setDismissed] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['referral-suggestions', userId],
    queryFn: () => getReferralSuggestions(userId),
  });

  const sendMutation = useMutation({
    mutationFn: (receiverIds: number[]) =>
      sendBulkAIMessage({
        sender_id: userId,
        receiver_ids: receiverIds,
        event_id: data?.suggestions[0]?.shared_event_id,
      }),
    onSuccess: () => {
      Alert.alert('Messages sent!', 'Your AI referral requests have been sent.');
      setDismissed(true);
      qc.invalidateQueries({ queryKey: ['conversations', userId] });
    },
  });

  if (dismissed || isLoading || !data?.suggestions?.length) return null;

  const suggestions = data.suggestions;
  const sharedEvent = suggestions[0]?.shared_event_title;

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <View style={banner.container}>
      <View style={banner.header}>
        <Text style={banner.title}>Ask for a referral?</Text>
        <TouchableOpacity onPress={() => setDismissed(true)}>
          <Text style={banner.dismiss}>✕</Text>
        </TouchableOpacity>
      </View>
      {sharedEvent && (
        <Text style={banner.sub}>
          You connected with {suggestions.length} {suggestions.length === 1 ? 'person' : 'people'} at{' '}
          <Text style={{ color: Colors.primaryLight }}>{sharedEvent}</Text>
        </Text>
      )}
      <View style={banner.list}>
        {suggestions.map((p) => (
          <TouchableOpacity
            key={p.user_id}
            style={[banner.person, selected.has(p.user_id) && banner.personSelected]}
            onPress={() => toggle(p.user_id)}
          >
            <Avatar name={p.display_name} url={p.avatar_url} size={32} />
            <Text style={banner.personName} numberOfLines={1}>{p.display_name}</Text>
            {selected.has(p.user_id) && <Text style={banner.check}>✓</Text>}
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity
        style={[banner.sendBtn, selected.size === 0 && { opacity: 0.4 }]}
        disabled={selected.size === 0 || sendMutation.isPending}
        onPress={() => sendMutation.mutate(Array.from(selected))}
      >
        {sendMutation.isPending ? (
          <ActivityIndicator color={Colors.white} />
        ) : (
          <Text style={banner.sendText}>
            Send AI message to {selected.size} {selected.size === 1 ? 'person' : 'people'}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
const banner = StyleSheet.create({
  container: {
    backgroundColor: Colors.primary + '22',
    borderWidth: 1,
    borderColor: Colors.primary + '55',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: Colors.text, fontSize: 15, fontWeight: '700' },
  dismiss: { color: Colors.muted, fontSize: 16 },
  sub: { color: Colors.subtext, fontSize: 13, marginTop: 4, marginBottom: 12 },
  list: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  personSelected: { borderColor: Colors.primary, backgroundColor: Colors.primary + '33' },
  personName: { color: Colors.text, fontSize: 13, maxWidth: 80 },
  check: { color: Colors.primary, fontWeight: '800', fontSize: 13 },
  sendBtn: { backgroundColor: Colors.primary, borderRadius: 10, padding: 12, alignItems: 'center' },
  sendText: { color: Colors.white, fontWeight: '700', fontSize: 14 },
});

// ─── Conversation Row ─────────────────────────────────────────────────────────
function ConversationRow({ item, onPress }: { item: Conversation; onPress: () => void }) {
  const lastText = item.last_message?.content ?? 'Start a conversation';
  const time = item.last_message
    ? new Date(item.last_message.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : '';
  return (
    <TouchableOpacity style={row.container} onPress={onPress}>
      <Avatar name={item.peer.display_name} url={item.peer.avatar_url} />
      <View style={row.body}>
        <View style={row.top}>
          <Text style={row.name}>{item.peer.display_name}</Text>
          <Text style={row.time}>{time}</Text>
        </View>
        <Text style={row.preview} numberOfLines={1}>{lastText}</Text>
      </View>
      {item.unread_count > 0 && (
        <View style={row.badge}>
          <Text style={row.badgeText}>{item.unread_count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
const row = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  body: { flex: 1 },
  top: { flexDirection: 'row', justifyContent: 'space-between' },
  name: { color: Colors.text, fontSize: 15, fontWeight: '600' },
  time: { color: Colors.muted, fontSize: 12 },
  preview: { color: Colors.subtext, fontSize: 13, marginTop: 2 },
  badge: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { color: Colors.white, fontSize: 11, fontWeight: '700' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ChatScreen() {
  const { userId } = useStore();
  const navigation = useNavigation<any>();

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ['conversations', userId],
    queryFn: () => getConversations(userId!),
    refetchInterval: 15000, // poll every 15s
  });

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.headerRow}>
        <Text style={s.heading}>Messages</Text>
      </View>

      <FlatList
        contentContainerStyle={s.list}
        ListHeaderComponent={<ReferralBanner userId={userId!} />}
        data={conversations}
        keyExtractor={(item) => String(item.peer.id)}
        renderItem={({ item }) => (
          <ConversationRow
            item={item}
            onPress={() =>
              navigation.navigate('Conversation', {
                peerId: item.peer.id,
                peerName: item.peer.display_name,
              })
            }
          />
        )}
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
          ) : (
            <View style={s.empty}>
              <Text style={s.emptyTitle}>No conversations yet</Text>
              <Text style={s.emptySubtext}>
                Message your connections from the Connections tab.
              </Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  headerRow: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  heading: { color: Colors.text, fontSize: 26, fontWeight: '800' },
  list: { padding: 16, paddingTop: 8 },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyTitle: { color: Colors.text, fontSize: 17, fontWeight: '600' },
  emptySubtext: { color: Colors.subtext, fontSize: 14, marginTop: 6, textAlign: 'center', paddingHorizontal: 32 },
});
