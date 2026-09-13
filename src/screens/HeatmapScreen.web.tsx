import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HudGridBackground } from '../components/HudGridBackground';
import { IconBadge } from '../components/IconBadge';
import { colors, fontFamily, spacing } from '../theme/theme';
import { useLanguage } from '../i18n/LanguageContext';

// react-native-maps has no web renderer (it crashes Metro's web bundle at
// module-load time), so Expo/Metro's ".web.tsx" convention swaps in this
// placeholder whenever the app is bundled for the web platform. The native
// (iOS/Android) build still uses HeatmapScreen.tsx untouched.
export default function HeatmapScreen() {
  const { t } = useLanguage();
  return (
    <View style={styles.root}>
      <HudGridBackground />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <IconBadge name="map" set="mci" size={40} />
          <Text style={styles.title}>{t('heatmapTitle')}</Text>
        </View>
        <View style={styles.notice}>
          <IconBadge name="map-marker-radius" set="mci" size={96} color={colors.primary} />
          <Text style={styles.noticeText}>{t('heatmapWebNotice')}</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, paddingBottom: spacing.xs },
  title: { fontFamily: fontFamily.headline, fontSize: 20, color: colors.text },
  notice: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: spacing.md },
  noticeText: { color: colors.textMuted, textAlign: 'center', lineHeight: 20, fontFamily: fontFamily.body },
});
