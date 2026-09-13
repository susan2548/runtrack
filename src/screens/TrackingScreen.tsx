import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useActivityTracker } from '../hooks/useActivityTracker';
import { formatDistanceKm, formatDuration, formatPaceMinPerKm, formatSpeedKmh } from '../utils/format';
import { colors, fontFamily, radius, spacing } from '../theme/theme';
import { GlassCard, Label, MonoValue, PillButton } from '../components/ui';
import { IconBadge } from '../components/IconBadge';
import { LiveRouteMap } from '../components/LiveRouteMap';
import { useLanguage } from '../i18n/LanguageContext';
import type { ActivityType } from '../types';
import type { RootStackParamList } from '../navigation/types';

export default function TrackingScreen() {
  const { t } = useLanguage();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const tracker = useActivityTracker();
  const active = tracker.status === 'tracking' || tracker.status === 'paused';
  const isRunning = tracker.activityType === 'running';
  const primaryMetric = isRunning
    ? formatPaceMinPerKm(tracker.currentSpeedMs)
    : formatSpeedKmh(tracker.currentSpeedMs);

  const start = async () => {
    const result = await tracker.start();
    if (result && !result.backgroundGranted) {
      Alert.alert(t('backgroundTitle'), t('backgroundBody'), [
        { text: t('notNow'), style: 'cancel' },
        { text: t('enable'), onPress: () => void tracker.enableBackgroundTracking() },
      ]);
    }
  };

  const finish = async () => {
    const activityId = await tracker.finish();
    if (activityId) navigation.navigate('ActivityEditor', { activityId, afterFinish: true });
  };

  if (tracker.initializing) {
    return <View style={styles.loading}><Text style={styles.muted}>{t('loadingApp')}</Text></View>;
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>{active ? t('activeSession') : t('trackHeaderTitle')}</Text>
              <Text style={styles.title}>{isRunning ? t('modeRun') : t('modeCycle')}</Text>
            </View>
            <View style={[styles.gpsChip, tracker.accuracyMeters !== null && tracker.accuracyMeters <= 25 && styles.gpsChipReady]}>
              <View style={[styles.dot, tracker.accuracyMeters !== null && tracker.accuracyMeters <= 25 && styles.dotReady]} />
              <Text style={styles.gpsText}>
                {tracker.accuracyMeters === null || tracker.accuracyMeters > 25 ? t('gpsWeak') : t('gpsReady')}
              </Text>
            </View>
          </View>

          {!active ? (
            <View style={styles.modeSwitch} accessibilityRole="tablist">
              {(['running', 'cycling'] as ActivityType[]).map((type) => (
                <Pressable
                  key={type}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: tracker.activityType === type }}
                  onPress={() => tracker.setActivityType(type)}
                  style={[styles.modeButton, tracker.activityType === type && styles.modeButtonActive]}
                >
                  <IconBadge
                    name={type === 'running' ? 'run' : 'bike'}
                    set="mci"
                    size={30}
                    color={tracker.activityType === type ? colors.onPrimary : colors.textMuted}
                  />
                  <Text style={[styles.modeText, tracker.activityType === type && styles.modeTextActive]}>
                    {type === 'running' ? t('modeRun') : t('modeCycle')}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {tracker.recovered ? (
            <GlassCard glowVariant="secondary"><Text style={styles.recovered}>{t('recoveredSession')}</Text></GlassCard>
          ) : null}
          {tracker.permissionDenied ? (
            <GlassCard glowVariant="secondary"><Text style={styles.warning}>{t('permissionError')}</Text></GlassCard>
          ) : null}

          <View style={styles.timerBlock}>
            <Label>{t('elapsedTime')}</Label>
            <MonoValue size={48}>{formatDuration(tracker.elapsedMs)}</MonoValue>
          </View>

          <View style={styles.primaryMetrics}>
            <View style={styles.metricHero}>
              <MonoValue size={38}>{formatDistanceKm(tracker.distanceMeters)}</MonoValue>
              <Text style={styles.unit}>KM</Text>
              <Label>{t('distance')}</Label>
            </View>
            <View style={styles.divider} />
            <View style={styles.metricHero}>
              <MonoValue size={38}>{primaryMetric}</MonoValue>
              <Text style={styles.unit}>{isRunning ? '/KM' : 'KM/H'}</Text>
              <Label>{isRunning ? t('pace') : t('groundSpeed')}</Label>
            </View>
          </View>

          <View style={styles.routeHeader}>
            <Text style={styles.sectionTitle}>{t('liveRoute')}</Text>
            <Text style={styles.routeMeta}>{tracker.routePoints.length} GPS</Text>
          </View>
          <View style={styles.mapWrap}><LiveRouteMap points={tracker.routePoints} /></View>

          <View style={styles.secondaryMetrics}>
            <SmallMetric icon="flash-outline" label={t('maxSpeed')} value={`${formatSpeedKmh(tracker.maxSpeedMs)} km/h`} />
            <SmallMetric icon="flame-outline" label={t('calories')} value={`${Math.round(tracker.caloriesKcal)} kcal`} color={colors.secondary} />
          </View>

          {!active ? (
            <PillButton label={t('startTracking')} onPress={() => void start()} />
          ) : (
            <>
              <View style={styles.controls}>
                <PillButton
                  label={tracker.status === 'tracking' ? t('pause') : t('resume')}
                  onPress={tracker.status === 'tracking' ? tracker.pause : tracker.resume}
                  variant="secondary"
                  flex={1}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('holdToFinish')}
                  delayLongPress={700}
                  onLongPress={() => void finish()}
                  style={styles.finishButton}
                >
                  <Text style={styles.finishText}>{t('holdToFinish')}</Text>
                </Pressable>
              </View>
              {tracker.recovered ? (
                <PillButton label={t('discardSession')} onPress={tracker.discard} variant="ghost" />
              ) : null}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function SmallMetric({ icon, label, value, color }: { icon: keyof typeof import('@expo/vector-icons').Ionicons.glyphMap; label: string; value: string; color?: string }) {
  return (
    <GlassCard style={styles.smallCard}>
      <IconBadge name={icon} size={28} color={color} />
      <MonoValue size={17} color={color}>{value}</MonoValue>
      <Label>{label}</Label>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  safe: { flex: 1 },
  loading: { flex: 1, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { color: colors.primary, fontFamily: fontFamily.monoLabel, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase' },
  title: { color: colors.text, fontFamily: fontFamily.display, fontSize: 28 },
  gpsChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: colors.surfaceHigh },
  gpsChipReady: { backgroundColor: 'rgba(83,242,129,0.12)' },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.warning },
  dotReady: { backgroundColor: colors.primary },
  gpsText: { color: colors.textMuted, fontFamily: fontFamily.bodySemiBold, fontSize: 11 },
  modeSwitch: { flexDirection: 'row', gap: spacing.sm },
  modeButton: { flex: 1, minHeight: 68, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSolid, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  modeButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  modeText: { color: colors.textMuted, fontFamily: fontFamily.bodySemiBold, fontSize: 15 },
  modeTextActive: { color: colors.onPrimary },
  recovered: { color: colors.warning, fontFamily: fontFamily.bodySemiBold },
  warning: { color: colors.danger, fontFamily: fontFamily.bodyMedium },
  timerBlock: { alignItems: 'center', gap: 2, paddingVertical: spacing.sm },
  primaryMetrics: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceSolid, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.lg },
  metricHero: { flex: 1, alignItems: 'center' },
  divider: { width: 1, height: 66, backgroundColor: colors.border },
  unit: { color: colors.primary, fontFamily: fontFamily.monoLabel, fontSize: 11, marginBottom: 5 },
  routeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: colors.text, fontFamily: fontFamily.headline, fontSize: 17 },
  routeMeta: { color: colors.textFaint, fontFamily: fontFamily.monoLabel, fontSize: 10 },
  mapWrap: { height: 210, borderRadius: radius.xl, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  secondaryMetrics: { flexDirection: 'row', gap: spacing.sm },
  smallCard: { flex: 1 },
  controls: { flexDirection: 'row', gap: spacing.sm },
  finishButton: { flex: 1, minHeight: 50, backgroundColor: 'rgba(255,107,107,0.14)', borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(255,107,107,0.4)', alignItems: 'center', justifyContent: 'center' },
  finishText: { color: colors.danger, fontFamily: fontFamily.monoLabel, fontSize: 12, textTransform: 'uppercase' },
  muted: { color: colors.textMuted, fontFamily: fontFamily.body },
});
