import { StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, radius } from '../theme/theme';
import type { LocationPoint, MapCoordinate } from '../types';

export function LiveRouteMap({ points, plannedPoints = [] }: { points: LocationPoint[]; plannedPoints?: MapCoordinate[]; accuracyMeters?: number | null }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.text}>{points.length ? `${points.length} live GPS points` : plannedPoints.length ? `${plannedPoints.length} planned waypoints` : 'Live map is available on Android'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceLow, borderRadius: radius.xl },
  text: { color: colors.textMuted, fontFamily: fontFamily.body, fontSize: 12 },
});
