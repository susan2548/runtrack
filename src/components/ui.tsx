import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { colors, fontFamily, glow, radius, spacing } from '../theme/theme';
import { useLanguage } from '../i18n/LanguageContext';

/** Frosted "HUD glass" panel — the base surface used by every card in the app. Fades/slides in on mount. */
export function GlassCard({
  children,
  style,
  glowVariant,
  delay = 0,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  glowVariant?: 'primary' | 'secondary';
  /** ms to stagger the entrance animation by — handy for cascading list items. */
  delay?: number;
}) {
  return (
    <Animated.View
      entering={FadeInUp.duration(260).delay(delay)}
      style={[styles.cardShadow, glowVariant ? glow[glowVariant] : null, style]}
    >
      <BlurView intensity={36} tint="dark" style={styles.cardBlur}>
        <View style={styles.cardOverlay}>{children}</View>
      </BlurView>
    </Animated.View>
  );
}

/** Small uppercase mono label used for every field caption in the HUD. */
export function Label({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.label, style]}>{children}</Text>;
}

/** Big tabular numeric readout (distance, pace, time, ...). */
export function MonoValue({
  children,
  size = 28,
  color = colors.text,
}: {
  children: ReactNode;
  size?: number;
  color?: string;
}) {
  return <Text style={[styles.monoValue, { fontSize: size, color }]}>{children}</Text>;
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'primary' | 'secondary' }) {
  const toneColor = tone === 'primary' ? colors.primary : tone === 'secondary' ? colors.secondary : colors.textMuted;
  return (
    <View style={[styles.badge, { borderColor: toneColor }]}>
      <Text style={[styles.badgeText, { color: toneColor }]}>{children}</Text>
    </View>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

/** Pill-shaped action button with a tactile 3D press-dip (perspective tilt + spring) and a gradient fill on primary. */
export function PillButton({
  label,
  onPress,
  variant = 'primary',
  disabled,
  flex,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  flex?: number;
}) {
  const pressed = useSharedValue(0);
  const variantStyle = BUTTON_VARIANTS[variant];

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 600 },
      { scale: 1 - pressed.value * 0.04 },
      { rotateX: `${pressed.value * 8}deg` },
    ],
  }));

  const handlePressIn = () => {
    pressed.value = withSpring(1, { damping: 14, stiffness: 260 });
  };
  const handlePressOut = () => {
    pressed.value = withSpring(0, { damping: 14, stiffness: 260 });
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={flex ? { flex } : undefined}
    >
      <Animated.View
        style={[
          styles.pillButtonOuter,
          variant === 'primary' ? glow.primary : null,
          animatedStyle,
          disabled ? styles.pillButtonDisabled : null,
        ]}
      >
        <View style={[styles.pillButtonInner, variantStyle.container]}>
          {variant === 'primary' ? (
            <LinearGradient
              colors={['#68F58F', '#37C966']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          ) : null}
          <Text style={[styles.pillButtonText, variantStyle.text]}>{label}</Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const BUTTON_VARIANTS: Record<ButtonVariant, { container: ViewStyle; text: { color: string } }> = {
  primary: { container: {}, text: { color: colors.onPrimary } },
  secondary: { container: { backgroundColor: colors.surfaceHigh }, text: { color: colors.text } },
  danger: { container: { backgroundColor: colors.secondary }, text: { color: colors.onSecondary } },
  ghost: {
    container: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
    text: { color: colors.textMuted },
  },
};

/** Compact EN/TH toggle — persisted app language switch. */
export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();
  return (
    <View style={styles.langToggle}>
      {(['en', 'th'] as const).map((lang) => (
        <Pressable
          key={lang}
          onPress={() => setLanguage(lang)}
          accessibilityRole="button"
          accessibilityLabel={lang === 'en' ? 'English' : 'ภาษาไทย'}
          accessibilityState={{ selected: language === lang }}
          style={[styles.langOption, language === lang && styles.langOptionActive]}
        >
          <Text style={[styles.langOptionText, language === lang && styles.langOptionTextActive]}>
            {lang.toUpperCase()}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  cardShadow: { borderRadius: radius.xl },
  cardBlur: { borderRadius: radius.xl, overflow: 'hidden' },
  cardOverlay: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.md,
  },
  label: {
    fontFamily: fontFamily.monoLabel,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  monoValue: { fontFamily: fontFamily.mono, letterSpacing: -0.5 },
  badge: {
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  badgeText: { fontFamily: fontFamily.monoLabel, fontSize: 10, letterSpacing: 0.5 },
  pillButtonOuter: { borderRadius: radius.lg },
  pillButtonInner: {
    borderRadius: radius.lg,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pillButtonDisabled: { opacity: 0.5 },
  pillButtonText: {
    fontFamily: fontFamily.monoLabel,
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  langToggle: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceHigh,
    borderRadius: radius.full,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  langOption: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full },
  langOptionActive: { backgroundColor: colors.primary },
  langOptionText: { fontFamily: fontFamily.monoLabel, fontSize: 11, color: colors.textMuted },
  langOptionTextActive: { color: colors.onPrimary },
});
