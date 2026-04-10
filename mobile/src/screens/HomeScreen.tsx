import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, SafeAreaView,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Colors } from '../constants/colors';
import { EventCard } from '../components/EventCard';
import { fetchEvents, fetchTodayEvents } from '../api/events';
import { getRecommendations } from '../api/recommendations';
import { useStore } from '../store/useStore';

type Tab = 'for_you' | 'today' | 'all';

export function HomeScreen({ navigation }: any) {
  const userId = useStore(s => s.userId);
  const displayName = useStore(s => s.displayName);
  const [activeTab, setActiveTab] = useState<Tab>('for_you');

  const recsQuery = useQuery({
    queryKey: ['recommendations', userId],
    queryFn: () => getRecommendations(userId!),
    enabled: !!userId && activeTab === 'for_you',
  });

  const todayQuery = useQuery({
    queryKey: ['events', 'today'],
    queryFn: fetchTodayEvents,
    enabled: activeTab === 'today',
  });

  const allQuery = useQuery({
    queryKey: ['events', 'all'],
    queryFn: () => fetchEvents(),
    enabled: activeTab === 'all',
  });

  const isLoading =
    (activeTab === 'for_you' && recsQuery.isLoading) ||
    (activeTab === 'today' && todayQuery.isLoading) ||
    (activeTab === 'all' && allQuery.isLoading);

  const isRefetching =
    (activeTab === 'for_you' && recsQuery.isRefetching) ||
    (activeTab === 'today' && todayQuery.isRefetching) ||
    (activeTab === 'all' && allQuery.isRefetching);

  function refetch() {
    if (activeTab === 'for_you') recsQuery.refetch();
    else if (activeTab === 'today') todayQuery.refetch();
    else allQuery.refetch();
  }

  function renderItem({ item }: any) {
    if (activeTab === 'for_you') {
      return (
        <EventCard
          event={item.event}
          reason={item.reason}
          onPress={() => navigation.navigate('EventDetail', { eventId: item.event.id })}
        />
      );
    }
    return (
      <EventCard
        event={item}
        onPress={() => navigation.navigate('EventDetail', { eventId: item.id })}
      />
    );
  }

  const data =
    activeTab === 'for_you' ? (recsQuery.data ?? []) :
    activeTab === 'today' ? (todayQuery.data ?? []) :
    (allQuery.data ?? []);

  const firstName = displayName.split(' ')[0];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hey, {firstName} 👋</Text>
          <Text style={styles.subtitle}>Here's what's happening</Text>
        </View>
        <TouchableOpacity
          style={styles.copilotBtn}
          onPress={() => navigation.navigate('Copilot')}
          activeOpacity={0.8}
        >
          <Text style={styles.copilotBtnText}>🤖 Ask Copilot</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        {(['for_you', 'today', 'all'] as Tab[]).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'for_you' ? '✨ For You' : tab === 'today' ? '📅 Today' : '🗓 All'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={data as any[]}
          keyExtractor={(item, i) => String(i)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={Colors.primary}
            />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>
              {activeTab === 'today' ? 'No events today.' : 'No events found.'}
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  greeting: { color: Colors.text, fontSize: 22, fontWeight: '800' },
  subtitle: { color: Colors.subtext, fontSize: 13, marginTop: 2 },
  copilotBtn: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  copilotBtnText: { color: Colors.primaryLight, fontSize: 13, fontWeight: '600' },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 8,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  tabText: { color: Colors.subtext, fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  list: { paddingHorizontal: 20, paddingBottom: 30, paddingTop: 4 },
  empty: { color: Colors.muted, textAlign: 'center', marginTop: 60, fontSize: 15 },
});
