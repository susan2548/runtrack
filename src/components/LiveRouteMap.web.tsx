import { StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, radius } from '../theme/theme';
import type { LocationPoint } from '../types';

export function LiveRouteMap({ points }: { points: LocationPoint[] }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.text}>{points.length ? `${points.length} GPS points` : 'Live map is available on Android'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceLow, borderRadius: radius.xl },
  text: { color: colors.textMuted, fontFamily: fontFamily.body, fontSize: 12 },
});
