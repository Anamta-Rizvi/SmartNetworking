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
import MapView, { Marker, Callout, Heatmap, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../constants/colors';
import { useStore } from '../store/useStore';
import { fetchMapEvents, updateLocation, clearLocation, MapEvent, PeoplePin, HeatmapPoint } from '../api/map';

// ─── Extended types for dummy data ───────────────────────────────────────────
interface DummyPerson extends PeoplePin {
  major?: string;
  title?: string;           // Student | Senior | Alumni etc.
  connection_status?: 'connected' | 'pending' | 'none';
}

interface DummyHeatEvent extends HeatmapPoint {
  event_location: string;
  event_starts_at: string;
  event_description: string;
  event_organizer: string;
}

// ─── Dummy data for People tab and Heatmap ───────────────────────────────────
const DUMMY_PEOPLE: DummyPerson[] = [
  {
    user_id: 0, display_name: 'You', avatar_url: null, is_self: true,
    lat: 40.4999, lng: -74.4474,
    title: 'Junior', major: 'Computer Science',
  },
  {
    user_id: 101, display_name: 'Priya Sharma', avatar_url: null, is_self: false,
    lat: 40.5003, lng: -74.4490,
    event_id: 1, event_title: 'Tech Career Fair', event_location: 'Rutgers Student Center',
    event_lat: 40.5003, event_lng: -74.4490,
    title: 'Senior', major: 'Computer Science', connection_status: 'connected',
  },
  {
    user_id: 102, display_name: 'James Liu', avatar_url: null, is_self: false,
    lat: 40.5264, lng: -74.4394,
    event_id: 2, event_title: 'Hackathon Kickoff', event_location: 'Livingston Student Center',
    event_lat: 40.5264, event_lng: -74.4394,
    title: 'Junior', major: 'Electrical Engineering', connection_status: 'connected',
  },
  {
    user_id: 103, display_name: 'Aisha Mohammed', avatar_url: null, is_self: false,
    lat: 40.5214, lng: -74.4609,
    event_id: 3, event_title: 'AI/ML Workshop', event_location: 'Busch Campus Core',
    event_lat: 40.5214, event_lng: -74.4609,
    title: 'Graduate Student', major: 'Data Science', connection_status: 'pending',
  },
  {
    user_id: 104, display_name: 'Carlos Rivera', avatar_url: null, is_self: false,
    lat: 40.4988, lng: -74.4460,
    event_id: 4, event_title: 'Networking Mixer', event_location: 'College Ave Gym',
    event_lat: 40.4988, event_lng: -74.4460,
    title: 'Sophomore', major: 'Business Administration', connection_status: 'none',
  },
  {
    user_id: 105, display_name: 'Emma Patel', avatar_url: null, is_self: false,
    lat: 40.4736, lng: -74.4330,
    event_id: 5, event_title: 'Leadership Summit', event_location: 'Cook Student Center',
    event_lat: 40.4736, event_lng: -74.4330,
    title: 'Senior', major: 'Political Science', connection_status: 'connected',
  },
  {
    user_id: 106, display_name: 'Ryan Kim', avatar_url: null, is_self: false,
    lat: 40.5010, lng: -74.4510,
    title: 'Freshman', major: 'Undecided', connection_status: 'none',
  },
  {
    user_id: 107, display_name: 'Sofia Nguyen', avatar_url: null, is_self: false,
    lat: 40.4995, lng: -74.4455,
    event_id: 4, event_title: 'Networking Mixer', event_location: 'College Ave Gym',
    event_lat: 40.4988, event_lng: -74.4460,
    title: 'Junior', major: 'Information Technology', connection_status: 'connected',
  },
];

const DUMMY_HEATMAP: DummyHeatEvent[] = [
  {
    event_id: 1, event_title: 'Tech Career Fair',
    lat: 40.5003, lng: -74.4490, live_count: 18, rsvp_count: 45,
    event_location: 'Rutgers Student Center, College Ave',
    event_starts_at: '2026-04-10T14:00:00', event_organizer: 'RU Career Services',
    event_description: 'Meet recruiters from top tech companies. Bring your resume and dress professionally.',
  },
  {
    event_id: 2, event_title: 'Hackathon Kickoff',
    lat: 40.5264, lng: -74.4394, live_count: 12, rsvp_count: 30,
    event_location: 'Livingston Student Center',
    event_starts_at: '2026-04-10T13:00:00', event_organizer: 'HackRU',
    event_description: '24-hour hackathon starting now. Form teams, pick a track, and build something awesome.',
  },
  {
    event_id: 3, event_title: 'AI/ML Workshop',
    lat: 40.5214, lng: -74.4609, live_count: 7, rsvp_count: 20,
    event_location: 'CoRE Building, Busch Campus',
    event_starts_at: '2026-04-10T15:30:00', event_organizer: 'RU AI Club',
    event_description: 'Hands-on workshop covering neural networks and PyTorch. Laptops required.',
  },
  {
    event_id: 4, event_title: 'Networking Mixer',
    lat: 40.4988, lng: -74.4460, live_count: 24, rsvp_count: 60,
    event_location: 'College Ave Gym Lounge',
    event_starts_at: '2026-04-10T17:00:00', event_organizer: 'RU Business Society',
    event_description: 'Casual networking event with professionals and students. Free food and drinks.',
  },
  {
    event_id: 5, event_title: 'Leadership Summit',
    lat: 40.4736, lng: -74.4330, live_count: 4, rsvp_count: 15,
    event_location: 'Cook Student Center Ballroom',
    event_starts_at: '2026-04-10T16:00:00', event_organizer: 'Student Government',
    event_description: 'Annual leadership summit featuring keynote speakers and panel discussions.',
  },
  {
    event_id: 6, event_title: 'Club Fair',
    lat: 40.5001, lng: -74.4480, live_count: 31, rsvp_count: 80,
    event_location: 'Voorhees Mall, College Ave',
    event_starts_at: '2026-04-10T11:00:00', event_organizer: 'RU Student Life',
    event_description: 'Explore 200+ student clubs and organizations. Find your community at Rutgers.',
  },
];
import { API_BASE } from '../api/client';

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
    navigation.navigate('EventDetail' as never, { eventId } as never);
  };
  const { userId, ghostMode, setGhostMode, setLocationSharingUntil } = useStore();
  const [activeTab, setActiveTab] = useState<MapTab>('Events');
  const [events, setEvents] = useState<MapEvent[]>([]);
  const [peoplePins, setPeoplePins] = useState<PeoplePin[]>([]);
  const [heatmapData, setHeatmapData] = useState<HeatmapPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [sharingSheetVisible, setSharingSheetVisible] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<MapEvent | null>(null);
  const [selectedPin, setSelectedPin] = useState<DummyPerson | null>(null);
  const [selectedHeatEvent, setSelectedHeatEvent] = useState<DummyHeatEvent | null>(null);
  const mapRef = useRef<MapView>(null);

  const loadData = useCallback(async () => {
    try {
      const evs = await fetchMapEvents(userId);
      setEvents(evs);
    } catch {
      // silently fail on network errors
    } finally {
      setLoading(false);
    }
    // People and Heatmap use dummy data
    setPeoplePins(DUMMY_PEOPLE);
    setHeatmapData(DUMMY_HEATMAP);
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

  // Heatmap: weight by live attendee count (people physically at the event right now)
  const heatmapPoints = heatmapData.map((h) => ({
    latitude: h.lat,
    longitude: h.lng,
    weight: Math.max(Math.min(h.live_count / 20, 1), 0.05),
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
          onPress={() => { setSelectedEvent(null); setSelectedPin(null); setSelectedHeatEvent(null); }}
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
                  <Callout tooltip onPress={() => { setSelectedEvent(null); goToEvent(event.id); }}>
                    <View style={styles.callout}>
                      <Text style={styles.calloutTitle}>{event.title}</Text>
                      <Text style={styles.calloutMeta}>📍 {event.location}</Text>
                      <Text style={styles.calloutMeta}>
                        🕐 {new Date(event.starts_at).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}
                      </Text>
                      <Text style={styles.calloutMeta}>👥 {event.rsvp_count} going</Text>
                      {event.goal_relevance_score != null && (
                        <View style={[styles.calloutBadge, { backgroundColor: color }]}>
                          <Text style={styles.calloutBadgeText}>{getRelevanceLabel(event.goal_relevance_score)} · {pct}</Text>
                        </View>
                      )}
                      <Text style={styles.calloutAction}>Tap to view details →</Text>
                    </View>
                  </Callout>
                </Marker>
              );
            })}

          {/* People tab — own location + connections */}
          {activeTab === 'People' &&
            (peoplePins as DummyPerson[]).map((pin, idx) => {
              const lat = pin.lat ?? pin.event_lat;
              const lng = pin.lng ?? pin.event_lng;
              if (!lat || !lng) return null;
              const isSelf = pin.is_self;
              return (
                <Marker
                  key={`pin-${pin.user_id}-${idx}`}
                  coordinate={{ latitude: lat, longitude: lng }}
                >
                  <View style={[styles.userMarker, isSelf && styles.selfMarker]}>
                    {pin.avatar_url ? (
                      <Image source={{ uri: `${API_BASE}${pin.avatar_url}` }} style={{ width: 32, height: 32, borderRadius: 16 }} />
                    ) : (
                      <Text style={styles.userMarkerText}>{pin.display_name.charAt(0).toUpperCase()}</Text>
                    )}
                    {isSelf && <View style={styles.selfBadge}><Text style={{ fontSize: 8, color: '#fff' }}>You</Text></View>}
                    {pin.lat != null && !isSelf && <View style={styles.gpsBadge}><Text style={{ fontSize: 7, color: '#fff' }}>GPS</Text></View>}
                  </View>
                  <Callout tooltip>
                    <View style={styles.callout}>
                      {/* Avatar row */}
                      <View style={styles.calloutPersonRow}>
                        <View style={[styles.calloutAvatar, isSelf && { backgroundColor: Colors.primary }]}>
                          <Text style={styles.calloutAvatarText}>{pin.display_name.charAt(0).toUpperCase()}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.calloutTitle}>{isSelf ? 'You' : pin.display_name}</Text>
                          {pin.title && <Text style={[styles.calloutMeta, { color: Colors.primaryLight, fontWeight: '600' }]}>{pin.title}</Text>}
                        </View>
                        {!isSelf && pin.connection_status === 'connected' && (
                          <View style={styles.calloutConnected}>
                            <Text style={styles.calloutConnectedText}>✓ Connected</Text>
                          </View>
                        )}
                      </View>
                      {pin.major && <Text style={styles.calloutMeta}>📚 {pin.major}</Text>}
                      {pin.event_title && (
                        <Text style={styles.calloutMeta} numberOfLines={1}>
                          📍 {isSelf ? 'RSVPed to' : 'At'}: {pin.event_title}
                        </Text>
                      )}
                      {pin.event_location && <Text style={styles.calloutMeta}>  {pin.event_location}</Text>}
                    </View>
                  </Callout>
                </Marker>
              );
            })}

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
              heatmapData.map(h => {
                const intensity = Math.min(h.live_count / 30, 1);
                // low → purple, high → red-orange
                const r = Math.round(124 + (255 - 124) * intensity);
                const g = Math.round(58 * (1 - intensity));
                const b = Math.round(237 * (1 - intensity));
                return (
                  <Marker
                    key={`heat-${h.event_id}`}
                    coordinate={{ latitude: h.lat, longitude: h.lng }}
                  >
                    <View style={[styles.heatMarker, { backgroundColor: `rgb(${r},${g},${b})` }]}>
                      <Text style={styles.heatMarkerText}>{h.live_count}</Text>
                      <Text style={styles.heatMarkerSub}>live</Text>
                    </View>
                    <Callout tooltip>
                      <View style={styles.callout}>
                        <View style={styles.calloutHeatRow}>
                          <View style={[styles.calloutLiveBadge, { backgroundColor: `rgb(${r},${g},${b})` }]}>
                            <Text style={styles.calloutLiveNum}>{h.live_count}</Text>
                            <Text style={styles.calloutLiveSub}>live</Text>
                          </View>
                          <Text style={[styles.calloutTitle, { flex: 1 }]}>{h.event_title}</Text>
                        </View>
                        <Text style={styles.calloutMeta}>📍 {(h as DummyHeatEvent).event_location}</Text>
                        <Text style={styles.calloutMeta}>
                          🕐 {new Date((h as DummyHeatEvent).event_starts_at).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}
                        </Text>
                        <Text style={styles.calloutMeta} numberOfLines={2}>{(h as DummyHeatEvent).event_description}</Text>
                        <Text style={styles.calloutMeta}>👥 {h.live_count} here now · {h.rsvp_count} RSVPed</Text>
                      </View>
                    </Callout>
                  </Marker>
                );
              })
            )
          )}
        </MapView>
      )}

      {/* Event preview card */}
      {selectedEvent && renderEventPreview()}

      {/* People — profile card */}
      {selectedPin && (
        <View style={styles.profileCard}>
          {/* Avatar + name row */}
          <View style={styles.profileHeader}>
            <View style={[styles.profileAvatar, selectedPin.is_self && { backgroundColor: Colors.primary }]}>
              <Text style={styles.profileAvatarText}>{selectedPin.display_name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName}>
                {selectedPin.is_self ? 'You' : selectedPin.display_name}
              </Text>
              {selectedPin.title && (
                <View style={styles.profileTitleBadge}>
                  <Text style={styles.profileTitleText}>{selectedPin.title}</Text>
                </View>
              )}
            </View>
            {!selectedPin.is_self && selectedPin.connection_status && (
              <View style={[
                styles.connBadge,
                selectedPin.connection_status === 'connected' && styles.connBadgeConnected,
                selectedPin.connection_status === 'pending' && styles.connBadgePending,
              ]}>
                <Text style={styles.connBadgeText}>
                  {selectedPin.connection_status === 'connected' ? '✓ Connected'
                    : selectedPin.connection_status === 'pending' ? 'Pending'
                    : 'Not connected'}
                </Text>
              </View>
            )}
          </View>

          {/* Details */}
          {selectedPin.major && (
            <Text style={styles.profileMeta}>📚 {selectedPin.major}</Text>
          )}
          {selectedPin.event_title && (
            <View style={styles.profileEventRow}>
              <Text style={styles.profileEventIcon}>📍</Text>
              <Text style={styles.profileEventText} numberOfLines={1}>
                {selectedPin.is_self ? 'RSVPed to' : 'At'}: {selectedPin.event_title}
              </Text>
            </View>
          )}
          {selectedPin.event_location && (
            <Text style={styles.profileMeta}>  {selectedPin.event_location}</Text>
          )}

          <TouchableOpacity style={styles.previewBtnSecondary} onPress={() => setSelectedPin(null)}>
            <Text style={styles.previewBtnSecondaryText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Heatmap — event detail card */}
      {selectedHeatEvent && (
        <View style={styles.eventPreview}>
          <View style={styles.heatEventHeader}>
            <View style={styles.liveCountBadge}>
              <Text style={styles.liveCountNum}>{selectedHeatEvent.live_count}</Text>
              <Text style={styles.liveCountLabel}>live</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.previewTitle} numberOfLines={2}>{selectedHeatEvent.event_title}</Text>
              <Text style={styles.previewMeta}>by {selectedHeatEvent.event_organizer}</Text>
            </View>
          </View>
          <Text style={styles.previewMeta}>📍 {selectedHeatEvent.event_location}</Text>
          <Text style={styles.previewMeta}>
            🕐 {new Date(selectedHeatEvent.event_starts_at).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}
          </Text>
          <Text style={styles.heatEventDesc} numberOfLines={2}>{selectedHeatEvent.event_description}</Text>
          <View style={styles.heatEventStats}>
            <Text style={styles.heatStatItem}>👥 {selectedHeatEvent.live_count} here now</Text>
            <Text style={styles.heatStatSep}>·</Text>
            <Text style={styles.heatStatItem}>{selectedHeatEvent.rsvp_count} RSVPed</Text>
          </View>
          <TouchableOpacity style={styles.previewBtnSecondary} onPress={() => setSelectedHeatEvent(null)}>
            <Text style={styles.previewBtnSecondaryText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* People tab empty state — only if no pins at all */}
      {activeTab === 'People' && !loading && peoplePins.length === 0 && !selectedPin && (
        <View style={styles.peopleEmpty}>
          <Text style={styles.peopleEmptyText}>Connect with people to see where your friends are heading</Text>
          <TouchableOpacity
            style={styles.peopleEmptyBtn}
            onPress={() => navigation.navigate('Connections' as never)}
          >
            <Text style={styles.peopleEmptyBtnText}>Find People</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Heatmap legend */}
      {activeTab === 'Heatmap' && !loading && (
        <View style={styles.legend}>
          <Text style={[styles.legendLabel, { fontWeight: '700', marginBottom: 2 }]}>Live attendees</Text>
          {[
            { color: 'rgb(255,0,0)',   label: '25+ people' },
            { color: 'rgb(200,30,80)', label: '15–24 people' },
            { color: 'rgb(150,30,150)',label: '5–14 people' },
            { color: 'rgb(124,58,237)',label: '1–4 people' },
          ].map(({ color, label }) => (
            <View key={label} style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: color }]} />
              <Text style={styles.legendLabel}>{label}</Text>
            </View>
          ))}
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
  heatMarkerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 7 },
  selfMarker: { borderColor: Colors.success, borderWidth: 2 },
  selfBadge: {
    position: 'absolute', bottom: -6, left: '50%', marginLeft: -10,
    backgroundColor: Colors.success, borderRadius: 6, paddingHorizontal: 4, paddingVertical: 1,
  },
  gpsBadge: {
    position: 'absolute', bottom: -6, right: -6,
    backgroundColor: Colors.success, borderRadius: 6, paddingHorizontal: 3, paddingVertical: 1,
  },

  // ── Callout popup (shows above pin on tap) ────────────────────────────────
  callout: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    minWidth: 220,
    maxWidth: 280,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  calloutTitle: { color: Colors.text, fontSize: 15, fontWeight: '700', marginBottom: 6 },
  calloutMeta: { color: Colors.subtext, fontSize: 12, marginBottom: 3, lineHeight: 17 },
  calloutBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start', marginTop: 4 },
  calloutBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  calloutAction: { color: Colors.primaryLight, fontSize: 12, fontWeight: '600', marginTop: 8 },
  // People callout
  calloutPersonRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  calloutAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.accent, justifyContent: 'center', alignItems: 'center',
  },
  calloutAvatarText: { color: Colors.white, fontWeight: '800', fontSize: 16 },
  calloutConnected: { backgroundColor: Colors.success + '22', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  calloutConnectedText: { color: Colors.success, fontSize: 10, fontWeight: '700' },
  // Heatmap callout
  calloutHeatRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  calloutLiveBadge: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  calloutLiveNum: { color: '#fff', fontSize: 16, fontWeight: '800' },
  calloutLiveSub: { color: 'rgba(255,255,255,0.8)', fontSize: 8 },

  // ── People profile card ────────────────────────────────────────────────────
  profileCard: {
    position: 'absolute', bottom: 100, left: 16, right: 16,
    backgroundColor: Colors.card, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: Colors.border,
  },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  profileAvatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.accent, justifyContent: 'center', alignItems: 'center',
  },
  profileAvatarText: { color: Colors.white, fontWeight: '800', fontSize: 20 },
  profileName: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  profileTitleBadge: {
    backgroundColor: Colors.primary + '22', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start', marginTop: 3,
  },
  profileTitleText: { color: Colors.primaryLight, fontSize: 11, fontWeight: '700' },
  connBadge: {
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  connBadgeConnected: { backgroundColor: Colors.success + '22', borderColor: Colors.success + '66' },
  connBadgePending: { backgroundColor: Colors.accent + '22', borderColor: Colors.accent + '66' },
  connBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.subtext },
  profileMeta: { color: Colors.subtext, fontSize: 13, marginBottom: 3 },
  profileEventRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, marginBottom: 2 },
  profileEventIcon: { fontSize: 13 },
  profileEventText: { color: Colors.primaryLight, fontSize: 13, fontWeight: '600', flex: 1 },

  // ── Heatmap event card ─────────────────────────────────────────────────────
  heatEventHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  liveCountBadge: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: Colors.accent, justifyContent: 'center', alignItems: 'center',
  },
  liveCountNum: { color: Colors.white, fontSize: 18, fontWeight: '800' },
  liveCountLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 9, fontWeight: '600' },
  heatEventDesc: { color: Colors.subtext, fontSize: 12, lineHeight: 17, marginTop: 6, marginBottom: 6 },
  heatEventStats: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  heatStatItem: { color: Colors.text, fontSize: 13, fontWeight: '600' },
  heatStatSep: { color: Colors.muted, fontSize: 13 },

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
