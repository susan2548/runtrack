import { StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, spacing } from '../theme/theme';
import type { MapCoordinate } from '../types';

export function RoutePlannerMap({ points }: { points: MapCoordinate[]; currentLocation: MapCoordinate | null; onAddPoint: (point: MapCoordinate) => void }) {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Route drawing is available in the Android app</Text>
      <Text style={styles.body}>{points.length} planned waypoints</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.surfaceLow },
  title: { color: colors.text, fontFamily: fontFamily.headline, textAlign: 'center' },
  body: { color: colors.textMuted, fontFamily: fontFamily.body },
});
