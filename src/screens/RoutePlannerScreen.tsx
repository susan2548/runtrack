import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RoutePlannerMap } from '../components/RoutePlannerMap';
import { GlassCard, Label, MonoValue, PillButton } from '../components/ui';
import { IconBadge } from '../components/IconBadge';
import { MapSetupHelp } from '../components/MapSetupHelp';
import { deleteRoutePlan, getRoutePlans, saveRoutePlan } from '../db/routePlanRepository';
import { ensureForegroundLocationPermission } from '../services/locationPermissions';
import { calculateRouteDistance } from '../utils/activityMetrics';
import { formatDistanceKm } from '../utils/format';
import { generateId } from '../utils/id';
import { useLanguage } from '../i18n/LanguageContext';
import { colors, fontFamily, radius, spacing } from '../theme/theme';
import type { MapCoordinate, RoutePlan } from '../types';
import type { RootStackParamList } from '../navigation/types';

export default function RoutePlannerScreen() {
  const { t } = useLanguage();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [points, setPoints] = useState<MapCoordinate[]>([]);
  const [plans, setPlans] = useState<RoutePlan[]>([]);
  const [currentLocation, setCurrentLocation] = useState<MapCoordinate | null>(null);
  const distance = calculateRouteDistance(points);

  const refresh = useCallback(() => getRoutePlans().then(setPlans), []);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  useEffect(() => {
    let mounted = true;
    const locate = async () => {
      if (!(await ensureForegroundLocationPermission())) return;
      const cached = await Location.getLastKnownPositionAsync({ maxAge: 60_000, requiredAccuracy: 100 });
      const location = cached ?? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      if (mounted) setCurrentLocation({ latitude: location.coords.latitude, longitude: location.coords.longitude });
    };
    void locate().catch(() => {});
    return () => { mounted = false; };
  }, []);

  const save = async () => {
    if (points.length < 2) {
      Alert.alert(t('routeNeedsPointsTitle'), t('routeNeedsPointsBody'));
      return;
    }
    const id = generateId();
    await saveRoutePlan(id, `${t('routeDefaultName')} ${plans.length + 1}`, distance, points);
    setPoints([]);
    await refresh();
  };

  const useRoute = (routePlanId: string) => navigation.navigate('Main', { screen: 'Track', params: { routePlanId } });
  const confirmDelete = (plan: RoutePlan) => Alert.alert(t('deleteRouteTitle'), plan.name, [
    { text: t('cancel'), style: 'cancel' },
    { text: t('delete'), style: 'destructive', onPress: () => void deleteRoutePlan(plan.id).then(refresh) },
  ]);

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View>
            <Text style={styles.eyebrow}>ROUTE STUDIO</Text>
            <Text style={styles.title}>{t('drawYourRoute')}</Text>
            <Text style={styles.body}>{t('drawRouteHint')}</Text>
          </View>

          <View style={styles.mapWrap}>
            <RoutePlannerMap points={points} currentLocation={currentLocation} onAddPoint={(point) => setPoints((current) => [...current, point])} />
            <View pointerEvents="none" style={styles.distanceBadge}>
              <MonoValue size={18}>{formatDistanceKm(distance)}</MonoValue><Label>KM</Label>
            </View>
          </View>
          <MapSetupHelp />

          <View style={styles.actions}>
            <MiniAction icon="locate-outline" label={t('startHere')} disabled={!currentLocation} onPress={() => currentLocation && setPoints((current) => current.length ? current : [currentLocation])} />
            <MiniAction icon="arrow-undo-outline" label={t('undo')} disabled={!points.length} onPress={() => setPoints((current) => current.slice(0, -1))} />
            <MiniAction icon="trash-outline" label={t('clear')} disabled={!points.length} onPress={() => setPoints([])} />
          </View>
          <PillButton label={t('saveRoute')} onPress={() => void save()} disabled={points.length < 2} />

          <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{t('savedRoutes')}</Text><Label>{plans.length}</Label></View>
          {plans.length ? plans.map((plan) => (
            <GlassCard key={plan.id} style={styles.planCard}>
              <IconBadge name="map-marker-path" set="mci" size={34} color={colors.secondary} />
              <View style={styles.planCopy}>
                <Text style={styles.planName}>{plan.name}</Text>
                <Text style={styles.planMeta}>{formatDistanceKm(plan.distance_meters)} KM</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel={t('delete')} onPress={() => confirmDelete(plan)} style={styles.iconButton}>
                <IconBadge name="trash-outline" size={21} color={colors.danger} />
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => useRoute(plan.id)} style={styles.useButton}>
                <Text style={styles.useText}>{t('useRoute')}</Text>
              </Pressable>
            </GlassCard>
          )) : <GlassCard><Text style={styles.empty}>{t('noSavedRoutes')}</Text></GlassCard>}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function MiniAction({ icon, label, disabled, onPress }: { icon: keyof typeof import('@expo/vector-icons').Ionicons.glyphMap; label: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.miniAction, disabled && styles.disabled]}>
      <IconBadge name={icon} size={22} />
      <Text style={styles.miniLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  safe: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
  eyebrow: { color: colors.secondary, fontFamily: fontFamily.monoLabel, fontSize: 10, letterSpacing: 2 },
  title: { color: colors.text, fontFamily: fontFamily.display, fontSize: 30, marginTop: 3 },
  body: { color: colors.textMuted, fontFamily: fontFamily.body, fontSize: 14, lineHeight: 21, marginTop: spacing.xs },
  mapWrap: { height: 390, borderRadius: radius.xl, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  distanceBadge: { position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'baseline', gap: 5, backgroundColor: 'rgba(7,10,9,0.88)', borderRadius: radius.full, paddingHorizontal: 13, paddingVertical: 8 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  miniAction: { flex: 1, minHeight: 58, alignItems: 'center', justifyContent: 'center', gap: 3, backgroundColor: colors.surfaceSolid, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  miniLabel: { color: colors.textMuted, fontFamily: fontFamily.bodySemiBold, fontSize: 11 },
  disabled: { opacity: 0.4 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  sectionTitle: { color: colors.text, fontFamily: fontFamily.headline, fontSize: 18 },
  planCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  planCopy: { flex: 1 },
  planName: { color: colors.text, fontFamily: fontFamily.bodySemiBold, fontSize: 15 },
  planMeta: { color: colors.secondary, fontFamily: fontFamily.monoLabel, fontSize: 10, marginTop: 3 },
  iconButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  useButton: { minHeight: 44, justifyContent: 'center', borderRadius: radius.full, backgroundColor: colors.primary, paddingHorizontal: 13 },
  useText: { color: colors.onPrimary, fontFamily: fontFamily.monoLabel, fontSize: 10 },
  empty: { color: colors.textMuted, fontFamily: fontFamily.body, textAlign: 'center' },
});
