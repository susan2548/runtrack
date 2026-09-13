import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useActivityTracker } from '../hooks/useActivityTracker';
import { formatDistanceKm, formatDuration, formatPaceMinPerKm, formatSpeedKmh } from '../utils/format';
import { colors, fontFamily, radius, spacing } from '../theme/theme';
import { GlassCard, Label, MonoValue, PillButton } from '../components/ui';
import { IconBadge } from '../components/IconBadge';
import { LiveRouteMap } from '../components/LiveRouteMap';
import { MapSetupHelp } from '../components/MapSetupHelp';
import { useLanguage } from '../i18n/LanguageContext';
import type { ActivityType } from '../types';
import type { RoutePlan, RoutePlanWithWaypoints } from '../types';
import type { RootStackParamList, RootTabParamList } from '../navigation/types';
import { getRoutePlan, getRoutePlans } from '../db/routePlanRepository';
import { OFF_ROUTE_THRESHOLD_METERS } from '../utils/activityMetrics';

export default function TrackingScreen() {
  const { t } = useLanguage();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootTabParamList, 'Track'>>();
  const tracker = useActivityTracker();
  const [routePlans, setRoutePlans] = useState<RoutePlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<RoutePlanWithWaypoints | null>(null);
  const active = tracker.status === 'tracking' || tracker.status === 'paused';
  const isRunning = tracker.activityType === 'running';
  const primaryMetric = isRunning
    ? formatPaceMinPerKm(tracker.currentSpeedMs)
    : formatSpeedKmh(tracker.currentSpeedMs);

  useFocusEffect(useCallback(() => {
    let mounted = true;
    getRoutePlans().then((plans) => { if (mounted) setRoutePlans(plans); });
    return () => { mounted = false; };
  }, []));

  useEffect(() => {
    const routePlanId = route.params?.routePlanId;
    if (routePlanId && !active) void getRoutePlan(routePlanId).then(setSelectedPlan);
  }, [active, route.params?.routePlanId]);

  const choosePlan = async (planId: string | null) => {
    setSelectedPlan(planId ? await getRoutePlan(planId) : null);
  };

  const start = async () => {
    const result = await tracker.start(selectedPlan);
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

          {!active ? (
            <GlassCard style={styles.routePlanCard}>
              <View style={styles.routePlanHeader}>
                <View style={styles.routePlanTitleRow}>
                  <IconBadge name="map-outline" size={26} color={colors.secondary} />
                  <View><Text style={styles.sectionTitle}>{t('chooseRoute')}</Text><Text style={styles.routeHint}>{t('routeOptional')}</Text></View>
                </View>
                <Pressable accessibilityRole="button" onPress={() => navigation.navigate('RoutePlanner')} style={styles.addRouteButton}>
                  <Text style={styles.addRouteText}>+ {t('newRoute')}</Text>
                </Pressable>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.routeChips}>
                <RouteChip label={t('freeRoute')} selected={!selectedPlan} onPress={() => void choosePlan(null)} />
                {routePlans.map((plan) => (
                  <RouteChip key={plan.id} label={`${plan.name} · ${formatDistanceKm(plan.distance_meters)} km`} selected={selectedPlan?.id === plan.id} onPress={() => void choosePlan(plan.id)} />
                ))}
              </ScrollView>
            </GlassCard>
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
          <View style={styles.mapWrap}>
            <LiveRouteMap
              points={tracker.routePoints}
              plannedPoints={(tracker.plannedRoute ?? selectedPlan)?.waypoints}
              accuracyMeters={tracker.accuracyMeters}
            />
          </View>
          <MapSetupHelp />
          {active && tracker.routePoints.length ? (
            <View style={styles.locationReadouts}>
              <LocationReadout label={t('startPoint')} point={tracker.routePoints[0]} color={colors.secondary} />
              <View style={styles.locationArrow}><IconBadge name="arrow-forward" size={18} color={colors.textFaint} /></View>
              <LocationReadout label={t('currentPoint')} point={tracker.routePoints.at(-1)!} color={colors.primary} />
            </View>
          ) : null}
          {active && tracker.plannedRoute ? (
            <View style={[styles.routeStatus, tracker.offRouteDistanceMeters !== null && tracker.offRouteDistanceMeters > OFF_ROUTE_THRESHOLD_METERS && styles.routeStatusWarning]}>
              <IconBadge name={tracker.offRouteDistanceMeters === null ? 'locate-outline' : tracker.offRouteDistanceMeters > OFF_ROUTE_THRESHOLD_METERS ? 'warning-outline' : 'navigate-outline'} size={20} color={tracker.offRouteDistanceMeters !== null && tracker.offRouteDistanceMeters > OFF_ROUTE_THRESHOLD_METERS ? colors.warning : colors.primary} />
              <View style={styles.routeStatusCopy}>
                <Text style={styles.routeStatusTitle}>{tracker.offRouteDistanceMeters === null ? t('waitingForPosition') : tracker.offRouteDistanceMeters > OFF_ROUTE_THRESHOLD_METERS ? t('offRoute') : t('onRoute')}</Text>
                <Text style={styles.routeStatusBody}>{tracker.plannedRoute.name}{tracker.offRouteDistanceMeters !== null ? ` · ${Math.round(tracker.offRouteDistanceMeters)} m` : ''}</Text>
              </View>
            </View>
          ) : null}

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

function RouteChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.routeChip, selected && styles.routeChipSelected]}>
      <Text numberOfLines={1} style={[styles.routeChipText, selected && styles.routeChipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function LocationReadout({ label, point, color }: { label: string; point: { latitude: number; longitude: number }; color: string }) {
  return (
    <View style={styles.locationReadout}>
      <View style={[styles.locationDot, { backgroundColor: color }]} />
      <View><Label>{label}</Label><Text style={styles.coordinate}>{point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}</Text></View>
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
  routePlanCard: { gap: spacing.sm },
  routePlanHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  routePlanTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  routeHint: { color: colors.textFaint, fontFamily: fontFamily.body, fontSize: 11, marginTop: 2 },
  addRouteButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm },
  addRouteText: { color: colors.secondary, fontFamily: fontFamily.bodySemiBold, fontSize: 12 },
  routeChips: { gap: spacing.sm },
  routeChip: { maxWidth: 210, minHeight: 42, justifyContent: 'center', borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceLow, paddingHorizontal: 14 },
  routeChipSelected: { borderColor: colors.secondary, backgroundColor: 'rgba(255,154,90,0.10)' },
  routeChipText: { color: colors.textMuted, fontFamily: fontFamily.bodyMedium, fontSize: 12 },
  routeChipTextSelected: { color: colors.secondary },
  timerBlock: { alignItems: 'center', gap: 2, paddingVertical: spacing.sm },
  primaryMetrics: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceSolid, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.lg },
  metricHero: { flex: 1, alignItems: 'center' },
  divider: { width: 1, height: 66, backgroundColor: colors.border },
  unit: { color: colors.primary, fontFamily: fontFamily.monoLabel, fontSize: 11, marginBottom: 5 },
  routeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: colors.text, fontFamily: fontFamily.headline, fontSize: 17 },
  routeMeta: { color: colors.textFaint, fontFamily: fontFamily.monoLabel, fontSize: 10 },
  mapWrap: { height: 280, borderRadius: radius.xl, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  locationReadouts: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceLow, borderRadius: radius.lg, padding: spacing.sm, gap: spacing.xs },
  locationReadout: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
  locationDot: { width: 8, height: 8, borderRadius: 4 },
  locationArrow: { paddingHorizontal: 2 },
  coordinate: { color: colors.textMuted, fontFamily: fontFamily.monoMedium, fontSize: 8, marginTop: 2 },
  routeStatus: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(83,242,129,0.32)', backgroundColor: 'rgba(83,242,129,0.07)', padding: spacing.sm },
  routeStatusWarning: { borderColor: 'rgba(255,200,87,0.45)', backgroundColor: 'rgba(255,200,87,0.09)' },
  routeStatusCopy: { flex: 1 },
  routeStatusTitle: { color: colors.text, fontFamily: fontFamily.bodySemiBold, fontSize: 13 },
  routeStatusBody: { color: colors.textMuted, fontFamily: fontFamily.body, fontSize: 11, marginTop: 2 },
  secondaryMetrics: { flexDirection: 'row', gap: spacing.sm },
  smallCard: { flex: 1 },
  controls: { flexDirection: 'row', gap: spacing.sm },
  finishButton: { flex: 1, minHeight: 50, backgroundColor: 'rgba(255,107,107,0.14)', borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(255,107,107,0.4)', alignItems: 'center', justifyContent: 'center' },
  finishText: { color: colors.danger, fontFamily: fontFamily.monoLabel, fontSize: 12, textTransform: 'uppercase' },
  muted: { color: colors.textMuted, fontFamily: fontFamily.body },
});
