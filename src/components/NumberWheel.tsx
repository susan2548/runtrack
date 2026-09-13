import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontFamily, radius } from '../theme/theme';

const ITEM_WIDTH = 76;

interface NumberWheelProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  accessibilityLabel: string;
  onChange: (value: number) => void;
}

export function NumberWheel({
  value,
  min,
  max,
  step = 1,
  unit,
  accessibilityLabel,
  onChange,
}: NumberWheelProps) {
  const listRef = useRef<FlatList<number>>(null);
  const userScrollingRef = useRef(false);
  const [width, setWidth] = useState(0);
  const values = useMemo(() => {
    const count = Math.floor((max - min) / step) + 1;
    return Array.from({ length: count }, (_, index) => Number((min + index * step).toFixed(2)));
  }, [max, min, step]);
  const selectedIndex = Math.max(0, Math.min(values.length - 1, Math.round((value - min) / step)));

  useEffect(() => {
    if (!width) return;
    listRef.current?.scrollToIndex({ index: selectedIndex, animated: false });
  }, [selectedIndex, width]);

  const changeBy = (offset: number) => {
    const nextIndex = Math.max(0, Math.min(values.length - 1, selectedIndex + offset));
    onChange(values[nextIndex]);
    listRef.current?.scrollToIndex({ index: nextIndex, animated: true });
  };

  const commitScrollPosition = (offsetX: number) => {
    if (!userScrollingRef.current) return;
    userScrollingRef.current = false;
    const index = Math.max(0, Math.min(values.length - 1, Math.round(offsetX / ITEM_WIDTH)));
    onChange(values[index]);
  };

  return (
    <View
      style={styles.root}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      accessibilityLabel={`${accessibilityLabel}: ${value} ${unit}`}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Decrease ${accessibilityLabel}`}
        onPress={() => changeBy(-1)}
        style={styles.stepButton}
      >
        <Ionicons name="remove" size={22} color={colors.text} />
      </Pressable>
      <View style={styles.track}>
        <FlatList
          ref={listRef}
          horizontal
          data={values}
          keyExtractor={(item) => String(item)}
          showsHorizontalScrollIndicator={false}
          snapToInterval={ITEM_WIDTH}
          decelerationRate="fast"
          contentContainerStyle={{ paddingHorizontal: Math.max(0, (width - 96 - ITEM_WIDTH) / 2) }}
          getItemLayout={(_, index) => ({ length: ITEM_WIDTH, offset: ITEM_WIDTH * index, index })}
          onScrollBeginDrag={() => { userScrollingRef.current = true; }}
          onScrollEndDrag={(event) => commitScrollPosition(event.nativeEvent.contentOffset.x)}
          onMomentumScrollEnd={(event) => commitScrollPosition(event.nativeEvent.contentOffset.x)}
          renderItem={({ item }) => {
            const selected = item === values[selectedIndex];
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => onChange(item)}
                style={styles.numberCell}
              >
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.72}
                  style={[styles.number, selected && styles.numberSelected]}
                >
                  {item}
                </Text>
              </Pressable>
            );
          }}
        />
        <View pointerEvents="none" style={styles.selectionFrame} />
        <Text pointerEvents="none" style={styles.unit}>{unit}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Increase ${accessibilityLabel}`}
        onPress={() => changeBy(1)}
        style={styles.stepButton}
      >
        <Ionicons name="add" size={22} color={colors.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSolid,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  track: { flex: 1, height: 74, justifyContent: 'center' },
  numberCell: { width: ITEM_WIDTH, height: 74, alignItems: 'center', justifyContent: 'center' },
  number: {
    width: ITEM_WIDTH,
    color: colors.textFaint,
    fontFamily: fontFamily.monoMedium,
    fontSize: 17,
    textAlign: 'center',
    includeFontPadding: false,
  },
  numberSelected: { color: colors.primary, fontFamily: fontFamily.mono, fontSize: 26, transform: [{ translateY: -5 }] },
  selectionFrame: {
    position: 'absolute',
    alignSelf: 'center',
    width: ITEM_WIDTH,
    top: 8,
    bottom: 8,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: 'rgba(83,242,129,0.05)',
  },
  stepButton: { width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  unit: { position: 'absolute', alignSelf: 'center', bottom: 7, color: colors.textMuted, fontFamily: fontFamily.monoLabel, fontSize: 8 },
});
