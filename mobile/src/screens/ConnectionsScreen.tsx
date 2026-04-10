import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Alert, RefreshControl, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Colors } from '../constants/colors';
import { useStore } from '../store/useStore';
import { API_BASE } from '../api/client';
import {
  searchUsers, sendConnectionRequest, respondToRequest,
  getConnections, getPendingRequests, removeConnection, getSuggestions,
  getRecentlyAccepted,
  ConnectionUser, ConnectionOut, UserOut, SuggestedUser,
} from '../api/connections';

function Avatar({ name, avatarUrl, size = 40, color = Colors.primary }: {
  name: string; avatarUrl?: string | null; size?: number; color?: string;
}) {
  if (avatarUrl) {
    return (
      <Image
        source={{ uri: `${API_BASE}${avatarUrl}` }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }
  return (
    <View style={[av.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
      <Text style={[av.letter, { fontSize: size * 0.38 }]}>{name.charAt(0).toUpperCase()}</Text>
    </View>
  );
}
const av = StyleSheet.create({
  circle: { justifyContent: 'center', alignItems: 'center' },
  letter: { color: '#fff', fontWeight: '700' },
});

function ConnectButton({ status, onConnect, onAccept, onDecline }: {
  status: string;
  onConnect: () => void;
  onAccept?: () => void;
  onDecline?: () => void;
}) {
  if (status === 'connected') return <Text style={[btn.label, { color: Colors.success }]}>✓ Connected</Text>;
  if (status === 'pending_sent') return <Text style={[btn.label, { color: Colors.muted }]}>Pending</Text>;
  if (status === 'pending_received') {
    return (
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <TouchableOpacity style={[btn.base, { backgroundColor: Colors.success }]} onPress={onAccept}>
          <Text style={btn.text}>Accept</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[btn.base, { backgroundColor: Colors.surface }]} onPress={onDecline}>
          <Text style={[btn.text, { color: Colors.subtext }]}>✕</Text>
        </TouchableOpacity>
      </View>
    );
  }
  return (
    <TouchableOpacity style={[btn.base, { backgroundColor: Colors.primary }]} onPress={onConnect}>
      <Text style={btn.text}>Connect</Text>
    </TouchableOpacity>
  );
}

const btn = StyleSheet.create({
  base: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  text: { color: '#fff', fontWeight: '700', fontSize: 12 },
  label: { fontSize: 12, fontWeight: '600' },
});

export default function ConnectionsScreen({ navigation }: any) {
  const { userId } = useStore();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ConnectionUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [localStatuses, setLocalStatuses] = useState<Record<number, string>>({});

  const { data: connections = [] } = useQuery<UserOut[]>({
    queryKey: ['connections', userId],
    queryFn: () => getConnections(userId!),
    enabled: !!userId,
  });

  const { data: pending = [] } = useQuery<ConnectionOut[]>({
    queryKey: ['pending', userId],
    queryFn: () => getPendingRequests(userId!),
    enabled: !!userId,
  });

  const { data: suggestions = [] } = useQuery<SuggestedUser[]>({
    queryKey: ['suggestions', userId],
    queryFn: () => getSuggestions(userId!),
    enabled: !!userId,
  });

  // Poll for newly accepted requests and notify
  const notifiedIdsRef = useRef<Set<number>>(new Set());
  const isFirstPollRef = useRef(true);
  const { data: recentlyAccepted = [] } = useQuery({
    queryKey: ['recently-accepted', userId],
    queryFn: () => getRecentlyAccepted(userId!),
    enabled: !!userId,
    refetchInterval: 30_000,
  });
  useEffect(() => {
    if (recentlyAccepted.length === 0) return;
    if (isFirstPollRef.current) {
      recentlyAccepted.forEach(c => notifiedIdsRef.current.add(c.connection_id));
      isFirstPollRef.current = false;
      return;
    }
    recentlyAccepted.forEach(c => {
      if (!notifiedIdsRef.current.has(c.connection_id)) {
        notifiedIdsRef.current.add(c.connection_id);
        queryClient.invalidateQueries({ queryKey: ['connections', userId] });
        Alert.alert(
          'Connection Accepted! 🎉',
          `${c.peer_name} accepted your connection request.`,
          [
            {
              text: 'Message',
              onPress: () => navigation.navigate('Conversation', {
                peerId: c.peer_id,
                peerName: c.peer_name,
              }),
            },
            { text: 'OK' },
          ],
        );
      }
    });
  }, [recentlyAccepted]);

  const sendMutation = useMutation({
    mutationFn: (addresseeId: number) => sendConnectionRequest(userId!, addresseeId),
    onSuccess: (_, addresseeId) => {
      setLocalStatuses(prev => ({ ...prev, [addresseeId]: 'pending_sent' }));
      queryClient.invalidateQueries({ queryKey: ['suggestions', userId] });
    },
    onError: () => Alert.alert('Error', 'Could not send connection request.'),
  });

  const respondMutation = useMutation({
    mutationFn: ({ connectionId, status }: { connectionId: number; status: 'accepted' | 'declined' }) =>
      respondToRequest(connectionId, userId!, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections', userId] });
      queryClient.invalidateQueries({ queryKey: ['pending', userId] });
    },
    onError: () => Alert.alert('Error', 'Could not respond to request.'),
  });

  const removeMutation = useMutation({
    mutationFn: (connectionId: number) => removeConnection(connectionId, userId!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['connections', userId] }),
  });

  const handleSearch = useCallback(async (text: string) => {
    setQuery(text);
    if (text.trim().length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const results = await searchUsers(text.trim(), userId!);
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [userId]);

  const handleConnect = useCallback((addresseeId: number) => {
    setLocalStatuses(prev => ({ ...prev, [addresseeId]: 'pending_sent' }));
    sendMutation.mutate(addresseeId);
  }, [sendMutation]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['connections', userId] }),
      queryClient.invalidateQueries({ queryKey: ['pending', userId] }),
      queryClient.invalidateQueries({ queryKey: ['suggestions', userId] }),
    ]);
    setRefreshing(false);
  }, [queryClient, userId]);

  const showSearch = query.trim().length >= 2;

  function WeightBadge({ weight }: { weight?: number }) {
    if (!weight) return null;
    const filled = Math.round(weight);
    const color = weight >= 3 ? Colors.success : weight >= 2 ? '#F59E0B' : Colors.muted;
    return (
      <View style={[wt.badge, { borderColor: color }]}>
        <Text style={[wt.text, { color }]}>⚡ {weight.toFixed(1)}</Text>
      </View>
    );
  }
  const wt = StyleSheet.create({
    badge: {
      borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3,
      borderWidth: 1, alignSelf: 'flex-start', marginTop: 4,
    },
    text: { fontSize: 10, fontWeight: '700' },
  });

  function UserCard({ user, status, onConnect, onAccept, onDecline, subtitle, weight }: {
    user: { user_id?: number; id?: number; display_name: string; major?: string | null; email?: string; avatar_url?: string | null };
    status: string;
    onConnect: () => void;
    onAccept?: () => void;
    onDecline?: () => void;
    subtitle?: string;
    weight?: number;
  }) {
    return (
      <View style={styles.userCard}>
        <Avatar name={user.display_name} avatarUrl={user.avatar_url} />
        <View style={{ flex: 1 }}>
          <Text style={styles.userName}>{user.display_name}</Text>
          <Text style={styles.userMeta}>{subtitle ?? user.major ?? user.email ?? ''}</Text>
          <WeightBadge weight={weight} />
        </View>
        <ConnectButton status={status} onConnect={onConnect} onAccept={onAccept} onDecline={onDecline} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header with back button */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Connections</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Search */}
        <View style={styles.searchRow}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, major, or email…"
            placeholderTextColor={Colors.muted}
            value={query}
            onChangeText={handleSearch}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {searching
            ? <ActivityIndicator color={Colors.primary} size="small" />
            : query.length > 0
              ? <TouchableOpacity onPress={() => { setQuery(''); setSearchResults([]); }}>
                  <Text style={{ color: Colors.muted, fontSize: 16 }}>✕</Text>
                </TouchableOpacity>
              : null}
        </View>

        {/* Search results */}
        {showSearch && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Search Results</Text>
            {searchResults.length === 0 && !searching
              ? <Text style={styles.emptyText}>No users found for "{query}"</Text>
              : searchResults.map(user => (
                <UserCard
                  key={user.user_id}
                  user={user}
                  status={localStatuses[user.user_id] ?? user.connection_status}
                  onConnect={() => handleConnect(user.user_id)}
                />
              ))
            }
          </View>
        )}

        {!showSearch && (
          <>
            {/* Pending requests */}
            {pending.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  Pending Requests <Text style={styles.badge}>{pending.length}</Text>
                </Text>
                {pending.map(req => (
                  <UserCard
                    key={req.id}
                    user={{ display_name: req.requester.display_name, email: req.requester.email }}
                    status="pending_received"
                    subtitle="wants to connect"
                    onConnect={() => {}}
                    onAccept={() => respondMutation.mutate({ connectionId: req.id, status: 'accepted' })}
                    onDecline={() => respondMutation.mutate({ connectionId: req.id, status: 'declined' })}
                  />
                ))}
              </View>
            )}

            {/* Suggestions */}
            {suggestions.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>People You May Know</Text>
                <Text style={styles.sectionHint}>⚡ Weight shows potential connection strength</Text>
                {suggestions.map(user => (
                  <UserCard
                    key={user.user_id}
                    user={user}
                    status={localStatuses[user.user_id] ?? user.connection_status}
                    subtitle={user.reason}
                    weight={user.connection_weight}
                    onConnect={() => handleConnect(user.user_id)}
                  />
                ))}
              </View>
            )}

            {/* My connections */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                My Connections {connections.length > 0 ? `(${connections.length})` : ''}
              </Text>
              {connections.length === 0
                ? <Text style={styles.emptyText}>No connections yet. Search for people above.</Text>
                : connections.map(user => (
                  <View key={user.id} style={styles.userCard}>
                    <Avatar name={user.display_name} avatarUrl={user.avatar_url} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.userName}>{user.display_name}</Text>
                      <Text style={styles.userMeta}>{user.major ?? user.university}</Text>
                      {user.connection_weight != null && (
                        <View style={styles.weightRow}>
                          <Text style={styles.weightLabel}>
                            ⚡ {user.connection_weight.toFixed(1)} strength
                          </Text>
                          <View style={styles.weightBar}>
                            <View style={[
                              styles.weightFill,
                              { width: `${Math.min((user.connection_weight / 5) * 100, 100)}%` as any },
                            ]} />
                          </View>
                        </View>
                      )}
                    </View>
                    <View style={{ gap: 6 }}>
                      <TouchableOpacity
                        style={styles.messageBtn}
                        onPress={() =>
                          navigation.navigate('Conversation', {
                            peerId: user.id,
                            peerName: user.display_name,
                          })
                        }
                      >
                        <Text style={styles.messageBtnText}>Message</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() =>
                          Alert.alert('Remove Connection', `Remove ${user.display_name}?`, [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Remove', style: 'destructive', onPress: () => removeMutation.mutate(user.id) },
                          ])
                        }
                      >
                        <Text style={styles.removeText}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              }
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { padding: 4, minWidth: 60 },
  backText: { color: Colors.primaryLight, fontSize: 15, fontWeight: '600' },
  headerTitle: { color: Colors.text, fontSize: 17, fontWeight: '700' },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.card, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 4,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 20,
  },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, color: Colors.text, fontSize: 15, paddingVertical: 12 },
  section: { marginBottom: 28 },
  sectionTitle: { color: Colors.text, fontSize: 16, fontWeight: '700', marginBottom: 12 },
  badge: {
    color: Colors.primary, fontWeight: '700',
  },
  userCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.card, borderRadius: 12,
    padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  userName: { color: Colors.text, fontSize: 14, fontWeight: '700' },
  userMeta: { color: Colors.subtext, fontSize: 12, marginTop: 2 },
  removeText: { color: Colors.muted, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  messageBtn: { backgroundColor: Colors.primary + '22', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: Colors.primary + '55' },
  messageBtnText: { color: Colors.primaryLight, fontSize: 12, fontWeight: '700' },
  emptyText: { color: Colors.muted, fontSize: 13, fontStyle: 'italic' },
  sectionHint: { color: Colors.muted, fontSize: 11, marginBottom: 10, fontStyle: 'italic' },
  weightRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  weightLabel: { color: Colors.muted, fontSize: 10, fontWeight: '600' },
  weightBar: {
    flex: 1, height: 4, backgroundColor: Colors.border, borderRadius: 2, maxWidth: 60,
  },
  weightFill: {
    height: 4, backgroundColor: Colors.primary, borderRadius: 2,
  },
});
