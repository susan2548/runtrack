import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import MapView, { Heatmap, PROVIDER_GOOGLE } from 'react-native-maps';
import { getAllLocationPoints } from '../db/activityRepository';
import { colors, fontFamily, radius, spacing } from '../theme/theme';
import { GlassCard, Label } from '../components/ui';
import { HudGridBackground } from '../components/HudGridBackground';
import { IconBadge } from '../components/IconBadge';
import { useLanguage } from '../i18n/LanguageContext';
import type { LocationPoint } from '../types';

export default function HeatmapScreen() {
  const { t } = useLanguage();
  const [points, setPoints] = useState<LocationPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      getAllLocationPoints().then((rows) => {
        if (mounted) {
          setPoints(rows);
          setLoading(false);
        }
      });
      return () => {
        mounted = false;
      };
    }, [])
  );

  const heatmapPoints = points.map((p) => ({
    latitude: p.latitude,
    longitude: p.longitude,
    weight: 1,
  }));

  return (
    <View style={styles.root}>
      {points.length === 0 ? <HudGridBackground /> : null}
      <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <IconBadge name="map" set="mci" size={40} />
        <Text style={styles.title}>{t('heatmapTitle')}</Text>
      </View>
      {!loading && points.length === 0 ? (
        <View style={styles.emptyContainer}>
          <IconBadge name="map-marker-radius" set="mci" size={96} color={colors.primary} />
          <Text style={styles.emptyText}>{t('heatmapEmpty')}</Text>
        </View>
      ) : (
        <View style={styles.mapWrap}>
          <MapView
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            initialRegion={{
              latitude: heatmapPoints[0]?.latitude ?? 13.7563,
              longitude: heatmapPoints[0]?.longitude ?? 100.5018,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
          >
            {heatmapPoints.length > 0 && (
              <Heatmap
                points={heatmapPoints}
                radius={30}
                opacity={0.8}
                gradient={{
                  colors: [colors.primary, colors.secondary],
                  startPoints: [0.2, 1],
                  colorMapSize: 256,
                }}
              />
            )}
          </MapView>
          <GlassCard style={styles.legend}>
            <Label>{t('legendDensity')}</Label>
            <View style={styles.legendBarRow}>
              <View style={[styles.legendSwatch, { backgroundColor: colors.primary }]} />
              <Label>{t('legendLight')}</Label>
              <View style={[styles.legendSwatch, { backgroundColor: colors.secondary }]} />
              <Label>{t('legendFrequent')}</Label>
            </View>
          </GlassCard>
        </View>
      )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, paddingBottom: spacing.xs },
  title: { fontFamily: fontFamily.headline, fontSize: 20, color: colors.text },
  mapWrap: { flex: 1 },
  map: { flex: 1 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: spacing.md },
  emptyText: { color: colors.textMuted, textAlign: 'center', fontFamily: fontFamily.body },
  legend: { position: 'absolute', left: spacing.md, right: spacing.md, bottom: spacing.md, gap: 6 },
  legendBarRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSwatch: { width: 12, height: 12, borderRadius: radius.sm },
});
