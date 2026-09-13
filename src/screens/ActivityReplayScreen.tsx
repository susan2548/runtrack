import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getActivityById, getLocationPointsByActivity } from '../db/activityRepository';
import { DARK_MAP_STYLE } from '../components/LiveRouteMap';
import { GlassCard, Label, MonoValue, PillButton } from '../components/ui';
import { createAndShareRouteReplay } from '../services/routeReplayVideo';
import { formatDistanceKm, formatDuration } from '../utils/format';
import { useLanguage } from '../i18n/LanguageContext';
import { colors, fontFamily, radius, spacing } from '../theme/theme';
import type { Activity, MapCoordinate } from '../types';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ActivityReplay'>;
const REPLAY_DURATION_MS = 15_000;
const MAX_MAP_POINTS = 600;

function sampleRoute(points: MapCoordinate[]): MapCoordinate[] {
  if (points.length <= MAX_MAP_POINTS) return points;
  return Array.from(
    { length: MAX_MAP_POINTS },
    (_, index) => points[Math.round(index * (points.length - 1) / (MAX_MAP_POINTS - 1))]
  );
}

export default function ActivityReplayScreen({ route }: Props) {
  const { t } = useLanguage();
  const mapRef = useRef<MapView>(null);
  const progressRef = useRef(0);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [coordinates, setCoordinates] = useState<MapCoordinate[]>([]);
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    Promise.all([
      getActivityById(route.params.activityId),
      getLocationPointsByActivity(route.params.activityId),
    ]).then(([activityRow, pointRows]) => {
      setActivity(activityRow);
      setCoordinates(sampleRoute(pointRows.map((point) => ({ latitude: point.latitude, longitude: point.longitude }))));
    });
  }, [route.params.activityId]);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    if (!playing || coordinates.length < 2) return;
    const startedAt = Date.now() - progressRef.current * REPLAY_DURATION_MS;
    const timer = setInterval(() => {
      const next = Math.min(1, (Date.now() - startedAt) / REPLAY_DURATION_MS);
      progressRef.current = next;
      setProgress(next);
      if (next >= 1) setPlaying(false);
    }, 80);
    return () => clearInterval(timer);
  }, [playing, coordinates.length]);

  const replayPosition = useMemo(() => {
    if (!coordinates.length) return null;
    if (coordinates.length === 1) return { current: coordinates[0], traveled: coordinates };
    const exactIndex = progress * (coordinates.length - 1);
    const index = Math.min(coordinates.length - 2, Math.floor(exactIndex));
    const fraction = exactIndex - index;
    const from = coordinates[index];
    const to = coordinates[index + 1];
    const current = {
      latitude: from.latitude + (to.latitude - from.latitude) * fraction,
      longitude: from.longitude + (to.longitude - from.longitude) * fraction,
    };
    return { current, traveled: [...coordinates.slice(0, index + 1), current] };
  }, [coordinates, progress]);

  const fitRoute = () => {
    if (coordinates.length < 2) return;
    mapRef.current?.fitToCoordinates(coordinates, {
      edgePadding: { top: 52, right: 38, bottom: 52, left: 38 },
      animated: false,
    });
  };

  const togglePlayback = () => {
    if (progress >= 1) {
      progressRef.current = 0;
      setProgress(0);
      setPlaying(true);
      return;
    }
    setPlaying((current) => !current);
  };

  const shareReplay = async () => {
    if (!activity || coordinates.length < 2 || sharing) return;
    setSharing(true);
    try {
      const points = await getLocationPointsByActivity(activity.id);
      await createAndShareRouteReplay(activity, points);
    } catch (error) {
      Alert.alert(t('routeReplayShareFailed'), error instanceof Error ? error.message : t('authUnknownError'));
    } finally {
      setSharing(false);
    }
  };

  if (!activity) {
    return <View style={styles.loading}><Text style={styles.loadingText}>{t('detailLoading')}</Text></View>;
  }

  const durationMs = activity.moving_time_ms || ((activity.end_time ?? activity.start_time) - activity.start_time);

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.intro}>
          <Text numberOfLines={1} style={styles.title}>{activity.title || t('routeReplay')}</Text>
          <Text style={styles.subtitle}>{t('routeReplayHint')}</Text>
        </View>

        <View style={styles.mapWrap}>
          {coordinates.length > 1 && replayPosition ? (
            <MapView
              ref={mapRef}
              style={styles.map}
              customMapStyle={DARK_MAP_STYLE}
              rotateEnabled={false}
              pitchEnabled={false}
              toolbarEnabled={false}
              initialRegion={{ ...coordinates[0], latitudeDelta: 0.02, longitudeDelta: 0.02 }}
              onMapReady={fitRoute}
            >
              <Polyline coordinates={coordinates} strokeColor="rgba(243,247,244,0.22)" strokeWidth={5} />
              <Polyline coordinates={replayPosition.traveled} strokeColor={colors.primary} strokeWidth={5} />
              <Marker coordinate={coordinates[0]} title={t('startPoint')} pinColor={colors.secondary} />
              <Marker coordinate={coordinates.at(-1)!} title={t('finishPoint')} pinColor={colors.primary} />
              <Marker coordinate={replayPosition.current} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
                <View style={styles.runnerOuter}><View style={styles.runnerInner} /></View>
              </Marker>
            </MapView>
          ) : (
            <View style={[styles.map, styles.emptyMap]}><Text style={styles.loadingText}>{t('noRouteData')}</Text></View>
          )}
          <View pointerEvents="none" style={styles.replayBadge}><Text style={styles.replayBadgeText}>15S REPLAY</Text></View>
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.max(1, progress * 100)}%` }]} />
        </View>

        <GlassCard style={styles.statsCard}>
          <View style={styles.stat}><Label>{t('distance')}</Label><MonoValue size={18}>{formatDistanceKm(activity.total_distance)} KM</MonoValue></View>
          <View style={styles.divider} />
          <View style={styles.stat}><Label>{t('time')}</Label><MonoValue size={18}>{formatDuration(durationMs)}</MonoValue></View>
          <Pressable accessibilityRole="button" accessibilityLabel={playing ? t('pause') : t('playReplay')} onPress={togglePlayback} style={styles.playButton}>
            <Ionicons name={progress >= 1 ? 'refresh' : playing ? 'pause' : 'play'} size={25} color={colors.onPrimary} />
          </Pressable>
        </GlassCard>

        <View style={styles.shareArea}>
          <PillButton
            label={sharing ? t('creatingReplayVideo') : t('shareReplayVideo')}
            onPress={() => void shareReplay()}
            disabled={sharing || coordinates.length < 2}
          />
          {sharing ? <Text style={styles.shareHint}>{t('creatingReplayHint')}</Text> : null}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  safe: { flex: 1, padding: spacing.md, gap: spacing.md },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas },
  loadingText: { color: colors.textMuted, fontFamily: fontFamily.body, textAlign: 'center', paddingHorizontal: spacing.md },
  intro: { gap: 3 },
  title: { color: colors.text, fontFamily: fontFamily.display, fontSize: 25 },
  subtitle: { color: colors.textMuted, fontFamily: fontFamily.body, fontSize: 13 },
  mapWrap: { flex: 1, minHeight: 300, borderRadius: radius.xl, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  map: { flex: 1 },
  emptyMap: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceSolid },
  replayBadge: { position: 'absolute', top: 12, left: 12, borderRadius: radius.full, backgroundColor: 'rgba(7,10,9,0.82)', paddingHorizontal: 10, paddingVertical: 7 },
  replayBadgeText: { color: colors.primary, fontFamily: fontFamily.monoLabel, fontSize: 9, letterSpacing: 1 },
  runnerOuter: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(83,242,129,0.28)', alignItems: 'center', justifyContent: 'center' },
  runnerInner: { width: 13, height: 13, borderRadius: 7, backgroundColor: colors.primary, borderWidth: 2, borderColor: colors.text },
  progressTrack: { height: 5, borderRadius: 3, overflow: 'hidden', backgroundColor: colors.surfaceHigh },
  progressFill: { height: '100%', backgroundColor: colors.primary },
  statsCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stat: { flex: 1, gap: 4 },
  divider: { width: 1, height: 44, backgroundColor: colors.border },
  playButton: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  shareArea: { gap: 5 },
  shareHint: { color: colors.textMuted, fontFamily: fontFamily.body, fontSize: 11, textAlign: 'center' },
});
