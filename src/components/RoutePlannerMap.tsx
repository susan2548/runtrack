import { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, type MapPressEvent } from 'react-native-maps';
import { colors } from '../theme/theme';
import type { MapCoordinate } from '../types';
import { DARK_MAP_STYLE } from './LiveRouteMap';

const FALLBACK = { latitude: 13.7563, longitude: 100.5018 };

export function RoutePlannerMap({ points, currentLocation, onAddPoint }: { points: MapCoordinate[]; currentLocation: MapCoordinate | null; onAddPoint: (point: MapCoordinate) => void }) {
  const mapRef = useRef<MapView>(null);
  const centeredRef = useRef(false);
  useEffect(() => {
    if (!currentLocation || centeredRef.current) return;
    centeredRef.current = true;
    mapRef.current?.animateToRegion({ ...currentLocation, latitudeDelta: 0.018, longitudeDelta: 0.018 }, 450);
  }, [currentLocation]);
  return (
    <MapView
      ref={mapRef}
      provider={PROVIDER_GOOGLE}
      style={styles.map}
      initialRegion={{ ...(currentLocation ?? FALLBACK), latitudeDelta: 0.018, longitudeDelta: 0.018 }}
      showsUserLocation
      showsMyLocationButton
      toolbarEnabled={false}
      customMapStyle={DARK_MAP_STYLE}
      onPress={(event: MapPressEvent) => onAddPoint(event.nativeEvent.coordinate)}
    >
      {points.length > 1 ? <Polyline coordinates={points} strokeColor={colors.secondary} strokeWidth={5} /> : null}
      {points.map((point, index) => (
        <Marker key={`${point.latitude}:${point.longitude}:${index}`} coordinate={point} title={index === 0 ? 'Start' : index === points.length - 1 ? 'Finish' : `${index + 1}`} pinColor={index === 0 ? colors.primary : colors.secondary} />
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({ map: { flex: 1 } });
