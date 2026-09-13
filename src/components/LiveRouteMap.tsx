import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { colors, radius } from '../theme/theme';
import type { LocationPoint } from '../types';

export function LiveRouteMap({ points }: { points: LocationPoint[] }) {
  const coordinates = points.map((point) => ({ latitude: point.latitude, longitude: point.longitude }));
  const latest = coordinates.at(-1);
  if (!latest) return <View style={styles.empty} />;
  return (
    <MapView
      style={styles.map}
      region={{ ...latest, latitudeDelta: 0.008, longitudeDelta: 0.008 }}
      rotateEnabled={false}
      pitchEnabled={false}
      toolbarEnabled={false}
    >
      <Polyline coordinates={coordinates} strokeColor="rgba(83,242,129,0.22)" strokeWidth={10} />
      <Polyline coordinates={coordinates} strokeColor={colors.primary} strokeWidth={4} />
      <Marker coordinate={latest} pinColor={colors.primary} />
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1, borderRadius: radius.xl },
  empty: { flex: 1, backgroundColor: colors.surfaceLow, borderRadius: radius.xl },
});
