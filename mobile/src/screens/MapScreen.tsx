import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  Image,
  Platform,
} from 'react-native';
import MapView, { Marker, Heatmap, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../constants/colors';
import { useStore } from '../store/useStore';
import { fetchMapEvents, updateLocation, clearLocation, MapEvent } from '../api/map';
import { fetchFriendPresence, FriendPresencePin } from '../api/connections';

type MapTab = 'Events' | 'People' | 'Heatmap';
type SharingDuration = '1hr' | '2hr' | 'untilLeave' | 'off';

function getRelevanceColor(score?: number | null): string {
  if (score == null) return '#6B7280';   // gray — no data
  if (score >= 0.8) return '#7C3AED';   // purple — high match
  if (score >= 0.5) return '#F59E0B';   // amber — good match
  if (score >= 0.2) return '#3B82F6';   // blue — partial match
  return '#6B7280';                      // gray — low match
}

function getRelevanceLabel(score?: number | null): string {
  if (score == null) return 'No score';
  if (score >= 0.8) return 'Top match';
  if (score >= 0.5) return 'Good match';
  if (score >= 0.2) return 'Partial match';
  return 'Low match';
}

const RUTGERS_REGION = {
  latitude: 40.5008,
  longitude: -74.4474,
  latitudeDelta: 0.04,
  longitudeDelta: 0.04,
};

export default function MapScreen() {
  const navigation = useNavigation<any>();
  const goToEvent = (eventId: number) => {
    navigation.getParent()?.navigate('EventDetail', { eventId }) ??
    navigation.navigate('EventDetail', { eventId });
  };
  const { userId, ghostMode, setGhostMode, setLocationSharingUntil } = useStore();
  const [activeTab, setActiveTab] = useState<MapTab>('Events');
  const [events, setEvents] = useState<MapEvent[]>([]);
  const [friends, setFriends] = useState<FriendPresencePin[]>([]);
  const [loading, setLoading] = useState(true);
  const [sharingSheetVisible, setSharingSheetVisible] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<MapEvent | null>(null);
  const [selectedFriend, setSelectedFriend] = useState<FriendPresencePin | null>(null);
  const mapRef = useRef<MapView>(null);

  const loadData = useCallback(async () => {
    try {
      const [evs, frds] = await Promise.all([
        fetchMapEvents(userId),
        userId ? fetchFriendPresence(userId) : Promise.resolve([]),
      ]);
      setEvents(evs);
      setFriends(frds);
    } catch {
      // silently fail on network errors
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30_000); // refresh every 30s
    return () => clearInterval(interval);
  }, [loadData]);

  const handleShareLocation = async (duration: SharingDuration) => {
    setSharingSheetVisible(false);
    if (duration === 'off' || !userId) {
      setGhostMode(true);
      setLocationSharingUntil(null);
      await clearLocation(userId!);
      return;
    }

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Location needed', 'Allow location access to share your position.');
      return;
    }

    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const minutes = duration === '1hr' ? 60 : duration === '2hr' ? 120 : undefined;
    const until = minutes ? new Date(Date.now() + minutes * 60_000).toISOString() : null;

    await updateLocation(userId!, loc.coords.latitude, loc.coords.longitude, 'everyone', true, minutes);
    setGhostMode(false);
    setLocationSharingUntil(until);
    loadData();
  };

  const heatmapPoints = events.map((e) => ({
    latitude: e.lat,
    longitude: e.lng,
    weight: Math.min(e.rsvp_count / 100, 1),
  }));

  const renderTabs = () => (
    <View style={styles.tabBar}>
      {(['Events', 'People', 'Heatmap'] as MapTab[]).map((tab) => (
        <TouchableOpacity
          key={tab}
          style={[styles.tab, activeTab === tab && styles.activeTab]}
          onPress={() => setActiveTab(tab)}
        >
          <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderEventPreview = () => {
    if (!selectedEvent) return null;
    const score = selectedEvent.goal_relevance_score;
    const color = getRelevanceColor(score);
    return (
      <View style={[styles.eventPreview, { borderLeftWidth: 4, borderLeftColor: color }]}>
        <Text style={styles.previewTitle} numberOfLines={1}>{selectedEvent.title}</Text>
        {score != null && (
          <View style={styles.relevanceRow}>
            <View style={[styles.relevanceDot, { backgroundColor: color }]} />
            <Text style={[styles.relevanceRowText, { color }]}>
              {getRelevanceLabel(score)} · {Math.round(score * 100)}% goal match
            </Text>
          </View>
        )}
        {selectedEvent.goal_relevance_label && score != null && (
          <Text style={styles.relevanceDetail}>{selectedEvent.goal_relevance_label}</Text>
        )}
        <Text style={styles.previewMeta}>{selectedEvent.location}</Text>
        <Text style={styles.previewMeta}>
          {new Date(selectedEvent.starts_at).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}
          {' · '}{selectedEvent.rsvp_count} going
        </Text>
        <View style={styles.previewActions}>
          <TouchableOpacity
            style={styles.previewBtn}
            onPress={() => {
              setSelectedEvent(null);
              goToEvent(selectedEvent.id);
            }}
          >
            <Text style={styles.previewBtnText}>View Details</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.previewBtnSecondary} onPress={() => setSelectedEvent(null)}>
            <Text style={styles.previewBtnSecondaryText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {renderTabs()}

      {loading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : (
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          initialRegion={RUTGERS_REGION}
          showsUserLocation={!ghostMode}
          showsMyLocationButton={false}
          mapType="standard"
          userInterfaceStyle="dark"
          onPress={() => { setSelectedEvent(null); setSelectedFriend(null); }}
        >
          {/* Event markers — color-coded by goal relevance */}
          {activeTab === 'Events' &&
            events.map((event) => {
              const color = getRelevanceColor(event.goal_relevance_score);
              const pct = event.goal_relevance_score != null
                ? `${Math.round(event.goal_relevance_score * 100)}%`
                : null;
              return (
                <Marker
                  key={`event-${event.id}`}
                  coordinate={{ latitude: event.lat, longitude: event.lng }}
                  onPress={() => setSelectedEvent(event)}
                >
                  <View style={[styles.eventMarker, { borderColor: color }]}>
                    <Text style={styles.eventMarkerText}>📅</Text>
                    {pct && (
                      <View style={[styles.relevanceBadge, { backgroundColor: color }]}>
                        <Text style={styles.relevanceBadgeText}>{pct}</Text>
                      </View>
                    )}
                  </View>
                </Marker>
              );
            })}

          {/* Friend presence pins (at event location, not GPS) */}
          {activeTab === 'People' &&
            friends.map((pin, idx) => (
              <Marker
                key={`friend-${pin.user_id}-${pin.event_id}-${idx}`}
                coordinate={{ latitude: pin.event_lat, longitude: pin.event_lng }}
                onPress={() => { setSelectedFriend(pin); setSelectedEvent(null); }}
              >
                <View style={styles.userMarker}>
                  {pin.avatar_url ? (
                    <Image
                      source={{ uri: `http://10.0.0.236:8000${pin.avatar_url}` }}
                      style={{ width: 32, height: 32, borderRadius: 16 }}
                    />
                  ) : (
                    <Text style={styles.userMarkerText}>
                      {pin.display_name.charAt(0).toUpperCase()}
                    </Text>
                  )}
                </View>
              </Marker>
            ))}

          {/* Heatmap — Android uses native Heatmap, iOS uses colored markers */}
          {activeTab === 'Heatmap' && (
            Platform.OS === 'android' ? (
              heatmapPoints.length > 0 && (
                <Heatmap
                  points={heatmapPoints}
                  opacity={0.7}
                  radius={50}
                  gradient={{ colors: ['#7C3AED', '#FF6B6B'], startPoints: [0.1, 1.0], colorMapSize: 256 }}
                />
              )
            ) : (
              events.map(event => {
                const intensity = Math.min(event.rsvp_count / 100, 1);
                const r = Math.round(124 + (255 - 124) * intensity);
                const g = Math.round(58 + (107 - 58) * intensity);
                const b = Math.round(237 + (107 - 237) * intensity);
                return (
                  <Marker
                    key={`heat-${event.id}`}
                    coordinate={{ latitude: event.lat, longitude: event.lng }}
                    onPress={() => goToEvent(event.id)}
                  >
                    <View style={[styles.heatMarker, { backgroundColor: `rgb(${r},${g},${b})` }]}>
                      <Text style={styles.heatMarkerText}>{event.rsvp_count}</Text>
                    </View>
                  </Marker>
                );
              })
            )
          )}
        </MapView>
      )}

      {/* Event preview card */}
      {selectedEvent && renderEventPreview()}

      {/* Friend presence preview card */}
      {selectedFriend && (
        <View style={styles.eventPreview}>
          <View style={styles.friendPreviewHeader}>
            <View style={styles.friendAvatar}>
              <Text style={styles.friendAvatarText}>{selectedFriend.display_name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.previewTitle}>{selectedFriend.display_name}</Text>
              <Text style={styles.previewMeta}>is going to</Text>
            </View>
          </View>
          <Text style={[styles.previewTitle, { marginTop: 4 }]} numberOfLines={1}>{selectedFriend.event_title}</Text>
          <Text style={styles.previewMeta}>{selectedFriend.event_location}</Text>
          <Text style={styles.previewMeta}>
            {new Date(selectedFriend.event_starts_at).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}
          </Text>
          <View style={styles.previewActions}>
            <TouchableOpacity
              style={styles.previewBtn}
              onPress={() => {
                setSelectedFriend(null);
                goToEvent(selectedFriend.event_id);
              }}
            >
              <Text style={styles.previewBtnText}>View Event</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.previewBtnSecondary} onPress={() => setSelectedFriend(null)}>
              <Text style={styles.previewBtnSecondaryText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* People tab empty state */}
      {activeTab === 'People' && !loading && friends.length === 0 && !selectedFriend && (
        <View style={styles.peopleEmpty}>
          <Text style={styles.peopleEmptyText}>Connect with people to see where your friends are heading</Text>
          <TouchableOpacity
            style={styles.peopleEmptyBtn}
            onPress={() => navigation.getParent()?.navigate('Connections') ?? navigation.navigate('Connections')}
          >
            <Text style={styles.peopleEmptyBtnText}>Find People</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Relevance legend — shown on Events tab */}
      {activeTab === 'Events' && !loading && (
        <View style={styles.legend}>
          {[
            { color: '#7C3AED', label: 'Top match (80%+)' },
            { color: '#F59E0B', label: 'Good (50–79%)' },
            { color: '#3B82F6', label: 'Partial (20–49%)' },
            { color: '#6B7280', label: 'Low / no data' },
          ].map(({ color, label }) => (
            <View key={color} style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: color }]} />
              <Text style={styles.legendLabel}>{label}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Ghost mode FAB */}
      <TouchableOpacity
        style={[styles.ghostFab, ghostMode && styles.ghostFabActive]}
        onPress={() => setSharingSheetVisible(true)}
      >
        <Text style={styles.ghostFabIcon}>{ghostMode ? '👻' : '📍'}</Text>
      </TouchableOpacity>

      {/* Location sharing duration sheet */}
      <Modal
        visible={sharingSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSharingSheetVisible(false)}
      >
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setSharingSheetVisible(false)} />
        <View style={styles.sharingSheet}>
          <Text style={styles.sheetTitle}>Share your location for…</Text>
          {(
            [
              { label: '1 Hour', value: '1hr' },
              { label: '2 Hours', value: '2hr' },
              { label: 'Until I leave', value: 'untilLeave' },
              { label: 'Off (Ghost Mode)', value: 'off' },
            ] as { label: string; value: SharingDuration }[]
          ).map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.sheetOption, opt.value === 'off' && styles.sheetOptionDanger]}
              onPress={() => handleShareLocation(opt.value)}
            >
              <Text style={[styles.sheetOptionText, opt.value === 'off' && styles.sheetOptionDangerText]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  map: { flex: 1 },
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  activeTab: { backgroundColor: Colors.primary },
  tabText: { color: Colors.subtext, fontSize: 13, fontWeight: '600' },
  activeTabText: { color: Colors.white },

  eventMarker: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 6,
    borderWidth: 2,
    borderColor: Colors.primary,
    alignItems: 'center',
  },
  eventMarkerText: { fontSize: 16 },
  relevanceBadge: {
    position: 'absolute',
    bottom: -8,
    right: -8,
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  relevanceBadgeText: { color: '#fff', fontSize: 8, fontWeight: '800' },
  relevanceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  relevanceDot: { width: 8, height: 8, borderRadius: 4 },
  relevanceRowText: { fontSize: 12, fontWeight: '700' },
  relevanceDetail: { color: Colors.muted, fontSize: 11, marginBottom: 6, fontStyle: 'italic' },
  legend: {
    position: 'absolute',
    top: 110,
    right: 12,
    backgroundColor: Colors.card + 'EE',
    borderRadius: 10,
    padding: 8,
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { color: Colors.subtext, fontSize: 10, fontWeight: '500' },

  userMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  userMarkerText: { color: Colors.white, fontWeight: '700', fontSize: 14 },

  eventPreview: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  previewTitle: { color: Colors.text, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  previewMeta: { color: Colors.subtext, fontSize: 13, marginBottom: 2 },
  previewActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  previewBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  previewBtnText: { color: Colors.white, fontWeight: '700', fontSize: 14 },
  previewBtnSecondary: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  previewBtnSecondaryText: { color: Colors.subtext, fontWeight: '600', fontSize: 14 },

  friendPreviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  friendAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.accent, justifyContent: 'center', alignItems: 'center',
  },
  friendAvatarText: { color: Colors.white, fontWeight: '700', fontSize: 15 },

  peopleEmpty: {
    position: 'absolute',
    bottom: 100,
    left: 24,
    right: 24,
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  peopleEmptyText: { color: Colors.subtext, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  peopleEmptyBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  peopleEmptyBtnText: { color: Colors.white, fontWeight: '700', fontSize: 14 },

  heatMarker: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)',
  },
  heatMarkerText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  ghostFab: {
    position: 'absolute',
    bottom: 32,
    left: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
    elevation: 4,
  },
  ghostFabActive: { borderColor: Colors.primary, backgroundColor: Colors.surface },
  ghostFabIcon: { fontSize: 22 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sharingSheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    gap: 10,
  },
  sheetTitle: { color: Colors.text, fontSize: 16, fontWeight: '700', marginBottom: 8 },
  sheetOption: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  sheetOptionDanger: { backgroundColor: 'rgba(255,107,107,0.1)', borderWidth: 1, borderColor: Colors.accent },
  sheetOptionText: { color: Colors.text, fontSize: 15, fontWeight: '600' },
  sheetOptionDangerText: { color: Colors.accent },
});
