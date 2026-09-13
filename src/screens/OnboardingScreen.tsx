import { useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { completeOnboarding } from '../db/profileRepository';
import { upsertGoal } from '../db/goalRepository';
import { ensureForegroundLocationPermission } from '../services/locationPermissions';
import { useAppSetup } from '../onboarding/AppSetupContext';
import { useLanguage } from '../i18n/LanguageContext';
import { colors, fontFamily, radius, spacing } from '../theme/theme';
import { IconBadge } from '../components/IconBadge';
import { LanguageToggle, PillButton } from '../components/ui';

export default function OnboardingScreen() {
  const { t } = useLanguage();
  const { refresh } = useAppSetup();
  const [step, setStep] = useState(0);
  const [weight, setWeight] = useState('65');
  const [runGoal, setRunGoal] = useState('15');
  const [cycleGoal, setCycleGoal] = useState('50');

  const finish = async (requestLocation: boolean) => {
    if (requestLocation) await ensureForegroundLocationPermission();
    const parsedWeight = Math.min(400, Math.max(30, Number(weight.replace(',', '.')) || 65));
    await Promise.all([
      completeOnboarding(parsedWeight),
      upsertGoal('running', Math.max(1, Number(runGoal.replace(',', '.')) || 15) * 1000),
      upsertGoal('cycling', Math.max(1, Number(cycleGoal.replace(',', '.')) || 50) * 1000),
    ]);
    await refresh();
  };

  return (
    <LinearGradient colors={['#07100B', colors.canvas, '#0B1210']} style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.topRow}>
          <Text style={styles.brand}>RUNTRACKER</Text>
          <LanguageToggle />
        </View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.progressRow}>
            {[0, 1, 2, 3].map((item) => (
              <View key={item} style={[styles.progressDot, item <= step && styles.progressDotActive]} />
            ))}
          </View>

          {step === 0 ? (
            <View style={styles.hero}>
              <View style={styles.heroIcon}><IconBadge name="run-fast" set="mci" size={92} /></View>
              <Text style={styles.title}>{t('welcomeTitle')}</Text>
              <Text style={styles.body}>{t('welcomeBody')}</Text>
              <PillButton label={t('getStarted')} onPress={() => setStep(1)} />
            </View>
          ) : null}

          {step === 1 ? (
            <View style={styles.panel}>
              <IconBadge name="account-heart-outline" set="mci" size={64} />
              <Text style={styles.title}>{t('setupProfile')}</Text>
              <Text style={styles.body}>{t('setupProfileBody')}</Text>
              <Text style={styles.label}>{t('weightLabel')}</Text>
              <View style={styles.inputRow}>
                <TextInput
                  value={weight}
                  onChangeText={setWeight}
                  keyboardType="decimal-pad"
                  style={styles.input}
                  accessibilityLabel={t('weightLabel')}
                />
                <Text style={styles.unit}>KG</Text>
              </View>
              <PillButton label={t('continue')} onPress={() => setStep(2)} />
            </View>
          ) : null}

          {step === 2 ? (
            <View style={styles.panel}>
              <IconBadge name="target" set="mci" size={64} />
              <Text style={styles.title}>{t('weeklyGoalTitle')}</Text>
              <Text style={styles.body}>{t('weeklyGoalBody')}</Text>
              <GoalInput label={t('modeRun')} value={runGoal} onChange={setRunGoal} />
              <GoalInput label={t('modeCycle')} value={cycleGoal} onChange={setCycleGoal} />
              <PillButton label={t('continue')} onPress={() => setStep(3)} />
            </View>
          ) : null}

          {step === 3 ? (
            <View style={styles.panel}>
              <IconBadge name="map-marker-check-outline" set="mci" size={64} />
              <Text style={styles.title}>{t('locationIntroTitle')}</Text>
              <Text style={styles.body}>{t('locationIntroBody')}</Text>
              <PillButton label={t('allowLocation')} onPress={() => void finish(true)} />
              <PillButton label={t('skipForNow')} onPress={() => void finish(false)} variant="ghost" />
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function GoalInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput value={value} onChangeText={onChange} keyboardType="decimal-pad" style={styles.input} />
        <Text style={styles.unit}>KM / WEEK</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg },
  brand: { color: colors.primary, fontFamily: fontFamily.monoLabel, letterSpacing: 2, fontSize: 13 },
  content: { flexGrow: 1, padding: spacing.lg, paddingTop: spacing.sm },
  progressRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.xl },
  progressDot: { flex: 1, height: 3, borderRadius: 2, backgroundColor: colors.surfaceHigh },
  progressDotActive: { backgroundColor: colors.primary },
  hero: { flex: 1, justifyContent: 'center', gap: spacing.md },
  panel: { flex: 1, justifyContent: 'center', gap: spacing.md },
  heroIcon: { alignSelf: 'flex-start', marginBottom: spacing.md },
  title: { color: colors.text, fontFamily: fontFamily.display, fontSize: 38, lineHeight: 43, maxWidth: 330 },
  body: { color: colors.textMuted, fontFamily: fontFamily.body, fontSize: 16, lineHeight: 24, marginBottom: spacing.md },
  label: { color: colors.textMuted, fontFamily: fontFamily.bodySemiBold, fontSize: 13 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceSolid, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingRight: spacing.md },
  input: { flex: 1, color: colors.text, fontFamily: fontFamily.mono, fontSize: 24, padding: spacing.md, minHeight: 58 },
  unit: { color: colors.textMuted, fontFamily: fontFamily.monoLabel, fontSize: 11 },
});
