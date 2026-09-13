import { useCallback, useMemo, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { getAllActivities } from '../db/activityRepository';
import { getGoal } from '../db/goalRepository';
import { calculateStreak, startOfWeek } from '../utils/activityMetrics';
import { formatDistanceKm, formatDuration, formatSpeedKmh } from '../utils/format';
import { colors, fontFamily, radius, spacing } from '../theme/theme';
import { GlassCard, Label, MonoValue } from '../components/ui';
import { HudGridBackground } from '../components/HudGridBackground';
import { IconBadge } from '../components/IconBadge';
import { useLanguage } from '../i18n/LanguageContext';
import type { Activity } from '../types';
import type { Goal } from '../types';
import type { RootStackParamList } from '../navigation/types';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function lastNDaysBuckets(activities: Activity[], days: number) {
  const buckets: { label: string; distanceMeters: number }[] = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(now);
    day.setDate(now.getDate() - i);
    day.setHours(0, 0, 0, 0);
    const nextDay = new Date(day);
    nextDay.setDate(day.getDate() + 1);

    const distanceMeters = activities
      .filter((a) => a.start_time >= day.getTime() && a.start_time < nextDay.getTime())
      .reduce((sum, a) => sum + a.total_distance, 0);

    buckets.push({ label: DAY_LABELS[day.getDay()], distanceMeters });
  }

  return buckets;
}

export default function StatsScreen() {
  const { t } = useLanguage();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [runGoal, setRunGoal] = useState<Goal | null>(null);
  const [periodDays, setPeriodDays] = useState<7 | 30>(7);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      Promise.all([getAllActivities(), getGoal('running')]).then(([rows, goal]) => {
        if (mounted) { setActivities(rows); setRunGoal(goal); }
      });
      return () => {
        mounted = false;
      };
    }, [])
  );

  const finished = activities.filter((a) => a.end_time !== null);
  const totalDistance = finished.reduce((sum, a) => sum + a.total_distance, 0);
  const totalDurationMs = finished.reduce((sum, a) => sum + ((a.end_time ?? a.start_time) - a.start_time), 0);
  const totalCalories = finished.reduce((sum, a) => sum + a.calories_burned, 0);
  const avgSpeed = finished.length
    ? finished.reduce((sum, a) => sum + a.avg_speed, 0) / finished.length
    : 0;

  const personalBest = useMemo(
    () => finished.reduce<Activity | null>((best, a) => (!best || a.total_distance > best.total_distance ? a : best), null),
    [finished]
  );

  const buckets = lastNDaysBuckets(finished, periodDays);
  const maxDistance = Math.max(...buckets.map((b) => b.distanceMeters), 1);
  const weeklyRunDistance = finished
    .filter((activity) => activity.type === 'running' && activity.start_time >= startOfWeek())
    .reduce((sum, activity) => sum + activity.total_distance, 0);
  const goalPercent = Math.min(100, Math.round((weeklyRunDistance / Math.max(runGoal?.weekly_distance_meters ?? 1, 1)) * 100));
  const streak = calculateStreak(finished);

  return (
    <View style={styles.root}>
      <HudGridBackground />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <IconBadge name="stats-chart" size={40} />
            <Text style={styles.title}>{t('statsTitle')}</Text>
          </View>

          {personalBest ? (
            <GlassCard glowVariant="primary">
              <View style={styles.bestRow}>
                <IconBadge name="trophy" set="mci" size={48} color={colors.secondary} />
                <View style={{ flex: 1 }}>
                  <Label>{t('personalBest')}</Label>
                  <View style={styles.heroRow}>
                    <MonoValue size={24}>{formatDistanceKm(personalBest.total_distance)}</MonoValue>
                    <Text style={styles.heroUnit}>KM</Text>
                  </View>
                  <Label style={{ marginTop: 2 }}>
                    {personalBest.type === 'running' ? t('modeRun') : t('modeCycle')} ·{' '}
                    {new Date(personalBest.start_time).toLocaleDateString('en-US', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </Label>
                </View>
              </View>
            </GlassCard>
          ) : null}

          <View style={styles.summaryGrid}>
            <SummaryCard icon="flag-outline" label={t('totalActivities')} value={`${finished.length}`} delay={0} />
            <SummaryCard
              icon="navigate-outline"
              label={t('totalDistanceStat')}
              value={`${formatDistanceKm(totalDistance)} km`}
              delay={40}
            />
            <SummaryCard icon="time-outline" label={t('totalTime')} value={formatDuration(totalDurationMs)} delay={80} />
            <SummaryCard
              icon="flame-outline"
              label={t('totalCalories')}
              value={`${Math.round(totalCalories)} kcal`}
              color={colors.secondary}
              delay={120}
            />
            <SummaryCard
              icon="speedometer-outline"
              label={t('avgSpeed')}
              value={`${formatSpeedKmh(avgSpeed)} km/h`}
              delay={160}
            />
            <SummaryCard icon="flame-outline" label={t('streak')} value={`${streak} ${t('dayStreak')}`} color={colors.secondary} delay={180} />
            <SummaryCard icon="locate-outline" label={t('weeklyGoal')} value={`${goalPercent}%`} color={colors.primary} delay={200} />
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{periodDays === 7 ? t('last7Days') : t('last30Days')}</Text>
            <View style={styles.periodToggle}>
              {([7, 30] as const).map((days) => (
                <Pressable key={days} onPress={() => setPeriodDays(days)} style={[styles.periodButton, periodDays === days && styles.periodButtonActive]}>
                  <Text style={[styles.periodText, periodDays === days && styles.periodTextActive]}>{days}D</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <GlassCard delay={200}>
            <View style={styles.chart}>
              {buckets.map((bucket, i) => {
                const height = Math.max(
                  (bucket.distanceMeters / maxDistance) * 100,
                  bucket.distanceMeters > 0 ? 4 : 0
                );
                return (
                  <View key={i} style={styles.barColumn}>
                    <View style={styles.barTrack}>
                      <Animated.View
                        entering={FadeInUp.duration(500).delay(220 + i * 60)}
                        style={[styles.bar, { height }]}
                      >
                        <LinearGradient
                          colors={[colors.primary, colors.tertiary]}
                          style={StyleSheet.absoluteFill}
                          start={{ x: 0, y: 1 }}
                          end={{ x: 0, y: 0 }}
                        />
                      </Animated.View>
                    </View>
                    <Label>{periodDays === 7 || i % 5 === 0 ? bucket.label : ''}</Label>
                  </View>
                );
              })}
            </View>
          </GlassCard>
          <Pressable onPress={() => navigation.navigate('Heatmap')} accessibilityRole="button">
            <GlassCard style={styles.heatmapLink}>
              <IconBadge name="map" set="mci" size={40} color={colors.tertiary} />
              <View style={{ flex: 1 }}><Text style={styles.sectionTitle}>{t('routeHeatmap')}</Text><Label>{t('heatmapTitle')}</Label></View>
              <IconBadge name="chevron-forward" size={26} />
            </GlassCard>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  color,
  delay,
}: {
  icon: keyof typeof import('@expo/vector-icons').Ionicons.glyphMap;
  label: string;
  value: string;
  color?: string;
  delay?: number;
}) {
  return (
    <GlassCard style={styles.summaryCard} delay={delay}>
      <View style={styles.summaryCardInner}>
        <IconBadge name={icon} size={32} color={color} />
        <MonoValue size={15} color={color}>
          {value}
        </MonoValue>
        <Label style={styles.summaryLabel}>{label}</Label>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  safeArea: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { fontFamily: fontFamily.headline, fontSize: 20, color: colors.text },
  bestRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  heroRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 2 },
  heroUnit: { fontFamily: fontFamily.headline, fontSize: 14, color: colors.primary },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  summaryCard: { width: '31%' },
  summaryCardInner: { alignItems: 'center', gap: 4 },
  summaryLabel: { textAlign: 'center' },
  sectionTitle: { fontFamily: fontFamily.bodySemiBold, fontSize: 14, color: colors.text, marginTop: spacing.xs },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  periodToggle: { flexDirection: 'row', borderRadius: radius.full, padding: 3, backgroundColor: colors.surfaceHigh },
  periodButton: { borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 6 },
  periodButtonActive: { backgroundColor: colors.primary },
  periodText: { color: colors.textMuted, fontFamily: fontFamily.monoLabel, fontSize: 10 },
  periodTextActive: { color: colors.onPrimary },
  heatmapLink: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 140,
  },
  barColumn: { alignItems: 'center', gap: 6, flex: 1 },
  barTrack: { height: 100, justifyContent: 'flex-end' },
  bar: { width: 8, minWidth: 3, borderRadius: radius.sm, overflow: 'hidden' },
});
