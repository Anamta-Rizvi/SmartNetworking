import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Colors } from '../constants/colors';
import { useStore } from '../store/useStore';
import {
  searchUsers,
  sendConnectionRequest,
  respondToRequest,
  getConnections,
  getPendingRequests,
  removeConnection,
  ConnectionUser,
  ConnectionOut,
  UserOut,
} from '../api/connections';

function Avatar({ name, size = 40, color = Colors.primary }: { name: string; size?: number; color?: string }) {
  return (
    <View style={[av.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
      <Text style={[av.letter, { fontSize: size * 0.4 }]}>{name.charAt(0).toUpperCase()}</Text>
    </View>
  );
}
const av = StyleSheet.create({
  circle: { justifyContent: 'center', alignItems: 'center' },
  letter: { color: '#fff', fontWeight: '700' },
});

const STATUS_COLORS: Record<string, string> = {
  connected: Colors.success,
  pending_sent: Colors.muted,
  pending_received: Colors.accent,
  none: Colors.primary,
};

function ConnectButton({
  status,
  onConnect,
  onAccept,
  onDecline,
}: {
  status: string;
  onConnect: () => void;
  onAccept?: () => void;
  onDecline?: () => void;
}) {
  if (status === 'connected') return <Text style={[btn.label, { color: Colors.success }]}>Connected</Text>;
  if (status === 'pending_sent') return <Text style={[btn.label, { color: Colors.muted }]}>Pending</Text>;
  if (status === 'pending_received') {
    return (
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <TouchableOpacity style={[btn.base, { backgroundColor: Colors.success }]} onPress={onAccept}>
          <Text style={btn.text}>Accept</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[btn.base, { backgroundColor: Colors.surface }]} onPress={onDecline}>
          <Text style={[btn.text, { color: Colors.subtext }]}>Decline</Text>
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
  base: { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  text: { color: '#fff', fontWeight: '700', fontSize: 13 },
  label: { fontSize: 13, fontWeight: '600' },
});

export default function ConnectionsScreen() {
  const { userId } = useStore();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ConnectionUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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

  const sendMutation = useMutation({
    mutationFn: (addresseeId: number) => sendConnectionRequest(userId!, addresseeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections', userId] });
      // Update search results optimistically
      setSearchResults(prev =>
        prev.map(u => u.user_id === userId ? u : { ...u, connection_status: u.connection_status === 'none' ? 'pending_sent' : u.connection_status })
      );
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
    setSearchResults(prev =>
      prev.map(u => u.user_id === addresseeId ? { ...u, connection_status: 'pending_sent' } : u)
    );
    sendMutation.mutate(addresseeId);
  }, [sendMutation]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['connections', userId] }),
      queryClient.invalidateQueries({ queryKey: ['pending', userId] }),
    ]);
    setRefreshing(false);
  }, [queryClient, userId]);

  const showSearchResults = query.trim().length >= 2;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
    >
      <Text style={styles.header}>Connections</Text>

      {/* Search */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or NYU email…"
          placeholderTextColor={Colors.muted}
          value={query}
          onChangeText={handleSearch}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {searching && <ActivityIndicator color={Colors.primary} style={{ marginLeft: 8 }} />}
      </View>

      {showSearchResults && (
        <View style={styles.section}>
          {searchResults.length === 0 && !searching ? (
            <Text style={styles.emptyText}>No users found</Text>
          ) : (
            searchResults.map(user => (
              <View key={user.user_id} style={styles.userCard}>
                <Avatar name={user.display_name} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.userName}>{user.display_name}</Text>
                  <Text style={styles.userMeta}>{user.major ?? user.email}</Text>
                </View>
                <ConnectButton
                  status={user.connection_status}
                  onConnect={() => handleConnect(user.user_id)}
                />
              </View>
            ))
          )}
        </View>
      )}

      {/* Pending requests */}
      {!showSearchResults && pending.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pending Requests</Text>
          {pending.map(req => (
            <View key={req.id} style={styles.userCard}>
              <Avatar name={req.requester.display_name} color={Colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={styles.userName}>{req.requester.display_name}</Text>
                <Text style={styles.userMeta}>wants to connect</Text>
              </View>
              <ConnectButton
                status="pending_received"
                onAccept={() => respondMutation.mutate({ connectionId: req.id, status: 'accepted' })}
                onDecline={() => respondMutation.mutate({ connectionId: req.id, status: 'declined' })}
              />
            </View>
          ))}
        </View>
      )}

      {/* Connections list */}
      {!showSearchResults && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            My Connections {connections.length > 0 ? `(${connections.length})` : ''}
          </Text>
          {connections.length === 0 ? (
            <Text style={styles.emptyText}>No connections yet. Search for people to connect with.</Text>
          ) : (
            connections.map(user => (
              <View key={user.id} style={styles.userCard}>
                <Avatar name={user.display_name} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.userName}>{user.display_name}</Text>
                  <Text style={styles.userMeta}>{user.major ?? user.university}</Text>
                </View>
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
            ))
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  header: { color: Colors.text, fontSize: 24, fontWeight: '800', marginBottom: 20 },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
  },
  searchInput: {
    flex: 1,
    color: Colors.text,
    fontSize: 15,
    paddingVertical: 12,
  },

  section: { marginBottom: 28 },
  sectionTitle: { color: Colors.text, fontSize: 16, fontWeight: '700', marginBottom: 12 },

  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  userName: { color: Colors.text, fontSize: 14, fontWeight: '700' },
  userMeta: { color: Colors.subtext, fontSize: 12, marginTop: 2 },
  removeText: { color: Colors.muted, fontSize: 12, fontWeight: '600' },
  emptyText: { color: Colors.muted, fontSize: 13, fontStyle: 'italic' },
});
