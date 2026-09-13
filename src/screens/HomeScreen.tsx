import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getAllActivities } from '../db/activityRepository';
import { getGoals } from '../db/goalRepository';
import { calculateStreak, startOfWeek } from '../utils/activityMetrics';
import { formatDistanceKm, formatDuration } from '../utils/format';
import { colors, fontFamily, spacing } from '../theme/theme';
import { GlassCard, Label, MonoValue, PillButton } from '../components/ui';
import { IconBadge } from '../components/IconBadge';
import { ProgressRing } from '../components/ProgressRing';
import { useLanguage } from '../i18n/LanguageContext';
import type { Activity, Goal } from '../types';
import type { RootStackParamList } from '../navigation/types';

export default function HomeScreen() {
  const { t } = useLanguage();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      Promise.all([getAllActivities(), getGoals()]).then(([activityRows, goalRows]) => {
        if (!mounted) return;
        setActivities(activityRows);
        setGoals(goalRows);
      });
      return () => { mounted = false; };
    }, [])
  );

  const weekStart = startOfWeek();
  const thisWeek = activities.filter((activity) => activity.start_time >= weekStart);
  const weekDistance = thisWeek.reduce((sum, activity) => sum + activity.total_distance, 0);
  const weekDuration = thisWeek.reduce((sum, activity) => sum + activity.moving_time_ms, 0);
  const runGoal = goals.find((goal) => goal.activity_type === 'running')?.weekly_distance_meters ?? 15000;
  const runDistance = thisWeek.filter((activity) => activity.type === 'running').reduce((sum, activity) => sum + activity.total_distance, 0);
  const goalProgress = runDistance / Math.max(runGoal, 1);
  const streak = calculateStreak(activities);

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>RUNTRACKER</Text>
              <Text style={styles.title}>{t('homeGreeting')}</Text>
            </View>
            <View style={styles.streakBadge}>
              <IconBadge name="fire" set="mci" size={30} color={colors.secondary} />
              <View><MonoValue size={17}>{streak}</MonoValue><Label>{t('dayStreak')}</Label></View>
            </View>
          </View>

          <GlassCard style={styles.goalCard} glowVariant="primary">
            <View style={styles.goalContent}>
              <View style={styles.goalCopy}>
                <Label>{t('thisWeek')} · {t('modeRun')}</Label>
                <View style={styles.valueRow}>
                  <MonoValue size={34}>{formatDistanceKm(runDistance)}</MonoValue>
                  <Text style={styles.unit}>/ {formatDistanceKm(runGoal)} KM</Text>
                </View>
                <Text style={styles.goalHint}>{t('weeklyGoal')}</Text>
              </View>
              <ProgressRing progress={goalProgress} size={92} strokeWidth={8}>
                <MonoValue size={16}>{Math.min(100, Math.round(goalProgress * 100))}%</MonoValue>
              </ProgressRing>
            </View>
          </GlassCard>

          <PillButton label={t('startActivity')} onPress={() => navigation.navigate('Main', { screen: 'Track' })} />
          <PillButton label={t('planRoute')} onPress={() => navigation.navigate('RoutePlanner')} variant="secondary" />

          <View style={styles.metricsRow}>
            <GlassCard style={styles.metricCard}>
              <IconBadge name="map-marker-distance" set="mci" size={32} />
              <MonoValue size={20}>{formatDistanceKm(weekDistance)} km</MonoValue>
              <Label>{t('totalDistance')}</Label>
            </GlassCard>
            <GlassCard style={styles.metricCard}>
              <IconBadge name="timer-outline" set="mci" size={32} color={colors.tertiary} />
              <MonoValue size={20}>{formatDuration(weekDuration)}</MonoValue>
              <Label>{t('totalTime')}</Label>
            </GlassCard>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('recentActivities')}</Text>
            <Pressable accessibilityRole="button" onPress={() => navigation.navigate('History')}>
              <Text style={styles.link}>{t('viewAll')}</Text>
            </Pressable>
          </View>
          {activities.length === 0 ? (
            <GlassCard><Text style={styles.empty}>{t('noRecentActivity')}</Text></GlassCard>
          ) : (
            activities.slice(0, 3).map((activity, index) => (
              <ActivityRow
                key={activity.id}
                activity={activity}
                delay={index * 45}
                onPress={() => navigation.navigate('ActivityDetail', { activityId: activity.id })}
              />
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function ActivityRow({ activity, onPress, delay }: { activity: Activity; onPress: () => void; delay: number }) {
  const { t } = useLanguage();
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <GlassCard style={styles.activityCard} delay={delay}>
        <IconBadge name={activity.type === 'running' ? 'run' : 'bike'} set="mci" size={38} color={activity.type === 'running' ? colors.primary : colors.secondary} />
        <View style={styles.activityCopy}>
          <Text style={styles.activityTitle}>{activity.title || (activity.type === 'running' ? t('modeRun') : t('modeCycle'))}</Text>
          <Text style={styles.date}>{new Date(activity.start_time).toLocaleDateString()}</Text>
        </View>
        <View style={styles.activityValue}>
          <MonoValue size={18}>{formatDistanceKm(activity.total_distance)}</MonoValue>
          <Label>KM</Label>
        </View>
      </GlassCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  safe: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
  eyebrow: { color: colors.primary, fontFamily: fontFamily.monoLabel, fontSize: 10, letterSpacing: 2 },
  title: { color: colors.text, fontFamily: fontFamily.display, fontSize: 29 },
  streakBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surfaceLow, padding: 8, borderRadius: 14 },
  goalCard: { marginBottom: spacing.xs },
  goalContent: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  goalCopy: { flex: 1 },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginVertical: 4 },
  unit: { color: colors.textMuted, fontFamily: fontFamily.monoLabel, fontSize: 11 },
  goalHint: { color: colors.primary, fontFamily: fontFamily.bodyMedium, fontSize: 13 },
  metricsRow: { flexDirection: 'row', gap: spacing.sm },
  metricCard: { flex: 1 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  sectionTitle: { color: colors.text, fontFamily: fontFamily.headline, fontSize: 18 },
  link: { color: colors.primary, fontFamily: fontFamily.bodySemiBold, fontSize: 13, padding: 8 },
  empty: { color: colors.textMuted, fontFamily: fontFamily.body, textAlign: 'center', paddingVertical: spacing.lg },
  activityCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  activityCopy: { flex: 1 },
  activityTitle: { color: colors.text, fontFamily: fontFamily.bodySemiBold, fontSize: 15 },
  date: { color: colors.textMuted, fontFamily: fontFamily.body, fontSize: 12, marginTop: 3 },
  activityValue: { alignItems: 'flex-end' },
});
