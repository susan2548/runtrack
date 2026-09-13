import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { HudGridBackground } from '../components/HudGridBackground';
import { deleteActivity, getActivityById } from '../db/activityRepository';
import { formatDistanceKm, formatDuration, formatSpeedKmh } from '../utils/format';
import { shareText } from '../utils/share';
import { colors, fontFamily, radius, spacing } from '../theme/theme';
import { GlassCard, Label, MonoValue, PillButton } from '../components/ui';
import { IconBadge } from '../components/IconBadge';
import { useLanguage } from '../i18n/LanguageContext';
import type { Activity } from '../types';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ActivityDetail'>;

// See HeatmapScreen.web.tsx — same reason this screen has a web-only twin
// that skips react-native-maps entirely (map view swapped for a notice).
export default function ActivityDetailScreen({ route, navigation }: Props) {
  const { t } = useLanguage();
  const { activityId } = route.params;
  const [activity, setActivity] = useState<Activity | null>(null);

  useEffect(() => {
    getActivityById(activityId).then(setActivity);
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

  const durationMs = (activity.end_time ?? activity.start_time) - activity.start_time;
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
        <View style={styles.mapPlaceholder}>
          <Text style={styles.emptyText}>{t('mapWebNotice')}</Text>
        </View>

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

        <View style={styles.actionsRow}>
          <PillButton label={t('watchRouteReplay')} onPress={() => navigation.navigate('ActivityReplay', { activityId })} variant="ghost" flex={1} />
          <PillButton label={t('shareActivity')} onPress={handleShare} variant="primary" flex={1} />
          <PillButton label={t('delete')} onPress={handleDelete} variant="secondary" flex={1} />
        </View>
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
  loadingText: { color: colors.textMuted, textAlign: 'center', marginTop: 40, fontFamily: fontFamily.body },
  mapPlaceholder: {
    height: 200,
    margin: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSolid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { color: colors.textMuted, textAlign: 'center', paddingHorizontal: 24, fontFamily: fontFamily.body },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.sm, gap: spacing.xs },
  statCard: { width: '31%' },
  statCardInner: { alignItems: 'center', gap: 4 },
  statLabel: { textAlign: 'center' },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, marginTop: 'auto' },
});
