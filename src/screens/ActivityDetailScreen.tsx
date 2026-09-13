import { useEffect, useState } from 'react';
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { HudGridBackground } from '../components/HudGridBackground';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  deleteActivity,
  getActivityById,
  getLocationPointsByActivity,
} from '../db/activityRepository';
import { getSplitsByActivity } from '../db/splitRepository';
import { formatDistanceKm, formatDuration, formatSpeedKmh } from '../utils/format';
import { shareText } from '../utils/share';
import { colors, fontFamily, radius, spacing } from '../theme/theme';
import { GlassCard, Label, MonoValue, PillButton } from '../components/ui';
import { IconBadge } from '../components/IconBadge';
import { useLanguage } from '../i18n/LanguageContext';
import type { Activity, LocationPoint, Split } from '../types';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ActivityDetail'>;

export default function ActivityDetailScreen({ route, navigation }: Props) {
  const { t } = useLanguage();
  const { activityId } = route.params;
  const [activity, setActivity] = useState<Activity | null>(null);
  const [points, setPoints] = useState<LocationPoint[]>([]);
  const [splits, setSplits] = useState<Split[]>([]);

  useEffect(() => {
    Promise.all([getActivityById(activityId), getLocationPointsByActivity(activityId), getSplitsByActivity(activityId)]).then(
      ([activityRow, pointRows, splitRows]) => {
        setActivity(activityRow);
        setPoints(pointRows);
        setSplits(splitRows);
      }
    );
  }, [activityId]);

  if (!activity) {
    return (
      <View style={styles.root}>
        <HudGridBackground />
        <SafeAreaView style={styles.safeArea}>
          <Text style={styles.loadingText}>{t('detailLoading')}</Text>
        </SafeAreaView>
      </View>
    );
  }

  const coordinates = points.map((p) => ({ latitude: p.latitude, longitude: p.longitude }));
  const durationMs = activity.moving_time_ms || ((activity.end_time ?? activity.start_time) - activity.start_time);
  const typeLabel = activity.type === 'running' ? t('modeRun') : t('modeCycle');

  const handleShare = async () => {
    await shareText(
      `My ${typeLabel} activity\n` +
        `${t('distance')}: ${formatDistanceKm(activity.total_distance)} km\n` +
        `${t('time')}: ${formatDuration(durationMs)}\n` +
        `${t('avg')}: ${formatSpeedKmh(activity.avg_speed)} km/h\n` +
        `${t('calories')}: ${Math.round(activity.calories_burned)} kcal`
    );
  };

  const handleDelete = () => {
    Alert.alert(t('deleteConfirmTitle'), t('deleteConfirmBody'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteActivity(activity.id);
          navigation.goBack();
        },
      },
    ]);
  };

  return (
    <View style={styles.root}>
      <HudGridBackground />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.mapContainer}>
          {coordinates.length > 0 ? (
            <MapView
              style={styles.map}
              initialRegion={{
                latitude: coordinates[0].latitude,
                longitude: coordinates[0].longitude,
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
              }}
            >
              {/* Wide translucent underlay + bright core stroke — the "trail glow" from the original HUD concept */}
              <Polyline coordinates={coordinates} strokeColor="rgba(0,255,102,0.25)" strokeWidth={10} />
              <Polyline coordinates={coordinates} strokeColor={colors.primary} strokeWidth={4} />
              <Marker coordinate={coordinates[0]} title="Start" pinColor={colors.textMuted} />
              {coordinates.length > 1 ? (
                <Marker coordinate={coordinates[coordinates.length - 1]} title="Finish" pinColor={colors.primary} />
              ) : null}
            </MapView>
          ) : (
            <View style={[styles.map, styles.mapEmpty]}>
              <Text style={styles.emptyText}>{t('noRouteData')}</Text>
            </View>
          )}
        </View>

        {activity.title || activity.notes ? (
          <View style={styles.activityCopy}>
            {activity.title ? <Text style={styles.activityTitle}>{activity.title}</Text> : null}
            {activity.notes ? <Text style={styles.activityNotes}>{activity.notes}</Text> : null}
          </View>
        ) : null}

        <View style={styles.statsGrid}>
          <StatCard icon="navigate-outline" label={t('distance')} value={`${formatDistanceKm(activity.total_distance)} km`} />
          <StatCard icon="time-outline" label={t('time')} value={formatDuration(durationMs)} />
          <StatCard icon="speedometer-outline" label={t('avg')} value={`${formatSpeedKmh(activity.avg_speed)} km/h`} />
          <StatCard icon="flash-outline" label={t('max')} value={`${formatSpeedKmh(activity.max_speed)} km/h`} />
          <StatCard
            icon="flame-outline"
            label={t('calories')}
            value={`${Math.round(activity.calories_burned)} kcal`}
            color={colors.secondary}
          />
          <StatCard
            icon={activity.sync_state === 'synced' ? 'cloud-done-outline' : 'cloud-offline-outline'}
            label={t('status')}
            value={activity.sync_state === 'synced' ? t('synced') : t('pendingSync')}
          />
        </View>

        {splits.length > 0 ? (
          <View style={styles.splitSection}>
            <Text style={styles.splitTitle}>{t('splits')}</Text>
            {splits.map((split) => (
              <View key={split.id} style={styles.splitRow}>
                <MonoValue size={15}>{split.split_index}</MonoValue>
                <Text style={styles.splitDistance}>{formatDistanceKm(split.distance_meters)} km</Text>
                <MonoValue size={15}>{formatDuration(split.duration_ms).slice(3)}</MonoValue>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.actionsRow}>
          <PillButton label={t('shareActivity')} onPress={handleShare} variant="primary" flex={1} />
          <PillButton label={t('editActivity')} onPress={() => navigation.navigate('ActivityEditor', { activityId, afterFinish: false })} variant="secondary" flex={1} />
        </View>
        <PillButton label={t('delete')} onPress={handleDelete} variant="ghost" />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: keyof typeof import('@expo/vector-icons').Ionicons.glyphMap;
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <GlassCard style={styles.statCard}>
      <View style={styles.statCardInner}>
        <IconBadge name={icon} size={30} color={color} />
        <MonoValue size={15} color={color}>
          {value}
        </MonoValue>
        <Label style={styles.statLabel}>{label}</Label>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  safeArea: { flex: 1 },
  content: { paddingBottom: spacing.lg },
  loadingText: { color: colors.textMuted, textAlign: 'center', marginTop: 40, fontFamily: fontFamily.body },
  mapContainer: { height: 260, margin: spacing.md, borderRadius: radius.lg, overflow: 'hidden' },
  map: { flex: 1 },
  mapEmpty: { backgroundColor: colors.surfaceSolid, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.textMuted, textAlign: 'center', paddingHorizontal: 24, fontFamily: fontFamily.body },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.sm, gap: spacing.xs },
  statCard: { width: '31%' },
  statCardInner: { alignItems: 'center', gap: 4 },
  statLabel: { textAlign: 'center' },
  activityCopy: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  activityTitle: { color: colors.text, fontFamily: fontFamily.display, fontSize: 24 },
  activityNotes: { color: colors.textMuted, fontFamily: fontFamily.body, lineHeight: 20, marginTop: 4 },
  splitSection: { margin: spacing.md, backgroundColor: colors.surfaceSolid, borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm },
  splitTitle: { color: colors.text, fontFamily: fontFamily.headline, fontSize: 17 },
  splitRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  splitDistance: { color: colors.textMuted, fontFamily: fontFamily.body },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
});
