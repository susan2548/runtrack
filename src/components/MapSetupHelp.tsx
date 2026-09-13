import { Alert, Platform, Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../i18n/LanguageContext';
import { colors, fontFamily, radius, spacing } from '../theme/theme';

export function MapSetupHelp() {
  const { t } = useLanguage();

  if (Platform.OS === 'web') return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('mapBlankHelp')}
      onPress={() => Alert.alert(t('mapSetupTitle'), t('mapSetupBody'))}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Ionicons name="information-circle-outline" size={18} color={colors.tertiary} />
      <Text style={styles.label}>{t('mapBlankHelp')}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(91,200,255,0.25)',
    backgroundColor: 'rgba(91,200,255,0.06)',
  },
  pressed: { opacity: 0.7 },
  label: { color: colors.tertiary, fontFamily: fontFamily.bodySemiBold, fontSize: 12 },
});
