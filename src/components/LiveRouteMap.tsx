import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Circle, Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontFamily, radius } from '../theme/theme';
import type { LocationPoint, MapCoordinate } from '../types';
import { useLanguage } from '../i18n/LanguageContext';

interface LiveRouteMapProps {
  points: LocationPoint[];
  plannedPoints?: MapCoordinate[];
  accuracyMeters?: number | null;
}

const FALLBACK = { latitude: 13.7563, longitude: 100.5018 };

export function LiveRouteMap({ points, plannedPoints = [], accuracyMeters }: LiveRouteMapProps) {
  const { t } = useLanguage();
  const mapRef = useRef<MapView>(null);
  const [followUser, setFollowUser] = useState(true);
  const coordinates = points.map((point) => ({ latitude: point.latitude, longitude: point.longitude }));
  const latest = coordinates.at(-1);
  const first = coordinates[0];
  const initial = latest ?? plannedPoints[0] ?? FALLBACK;

  useEffect(() => {
    if (!latest || !followUser) return;
    mapRef.current?.animateCamera({ center: latest, zoom: 17 }, { duration: 450 });
  }, [followUser, latest?.latitude, latest?.longitude]);

  const recenter = () => {
    setFollowUser(true);
    if (latest) mapRef.current?.animateCamera({ center: latest, zoom: 17 }, { duration: 350 });
  };

  return (
    <View style={styles.root}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{ ...initial, latitudeDelta: 0.012, longitudeDelta: 0.012 }}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        loadingEnabled
        customMapStyle={DARK_MAP_STYLE}
        onPanDrag={() => setFollowUser(false)}
        onMapReady={() => {
          if (!latest && plannedPoints.length > 1) {
            mapRef.current?.fitToCoordinates(plannedPoints, {
              edgePadding: { top: 36, right: 36, bottom: 36, left: 36 },
              animated: false,
            });
          }
        }}
      >
        {plannedPoints.length > 1 ? (
          <Polyline coordinates={plannedPoints} strokeColor={colors.secondary} strokeWidth={4} lineDashPattern={[10, 7]} />
        ) : null}
        {plannedPoints.map((point, index) => {
          const isStart = index === 0;
          const isFinish = index === plannedPoints.length - 1;
          const title = isStart ? t('startPoint') : isFinish ? t('finishPoint') : `${t('waypoint')} ${index}`;
          const pinColor = isStart ? colors.secondary : isFinish ? colors.primary : colors.tertiary;
          return <Marker key={`planned-${index}`} coordinate={point} title={title} pinColor={pinColor} />;
        })}
        {coordinates.length > 1 ? (
          <>
            <Polyline coordinates={coordinates} strokeColor="rgba(83,242,129,0.22)" strokeWidth={10} />
            <Polyline coordinates={coordinates} strokeColor={colors.primary} strokeWidth={4} />
          </>
        ) : null}
        {first ? <Marker coordinate={first} title="Start" pinColor={colors.secondary} /> : null}
        {latest && accuracyMeters ? (
          <Circle center={latest} radius={Math.max(accuracyMeters, 5)} fillColor="rgba(91,200,255,0.12)" strokeColor="rgba(91,200,255,0.55)" strokeWidth={1} />
        ) : null}
        {latest ? (
          <Marker coordinate={latest} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
            <View style={styles.currentOuter}><View style={styles.currentInner} /></View>
          </Marker>
        ) : null}
      </MapView>
      {!followUser && latest ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Recenter map" onPress={recenter} style={styles.recenter}>
          <Ionicons name="locate" size={20} color={colors.onPrimary} />
        </Pressable>
      ) : null}
      <View pointerEvents="none" style={styles.legend}>
        <View style={[styles.legendLine, { backgroundColor: colors.secondary }]} />
        <Text style={styles.legendText}>PLAN</Text>
        <View style={[styles.legendLine, { backgroundColor: colors.primary }]} />
        <Text style={styles.legendText}>LIVE</Text>
      </View>
    </View>
  );
}

export const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#151a17' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#88918c' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#151a17' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#29312d' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#354039' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0b2028' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
];

const styles = StyleSheet.create({
  root: { flex: 1 },
  map: { flex: 1, borderRadius: radius.xl },
  currentOuter: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(83,242,129,0.25)', alignItems: 'center', justifyContent: 'center' },
  currentInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary, borderWidth: 2, borderColor: colors.onPrimary },
  recenter: { position: 'absolute', right: 12, bottom: 12, width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  legend: { position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radius.full, backgroundColor: 'rgba(7,10,9,0.82)', paddingHorizontal: 9, paddingVertical: 6 },
  legendLine: { width: 14, height: 3, borderRadius: 2 },
  legendText: { color: colors.textMuted, fontFamily: fontFamily.monoLabel, fontSize: 8 },
});
