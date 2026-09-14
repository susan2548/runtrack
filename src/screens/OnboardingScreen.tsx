import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { completeOnboarding } from '../db/profileRepository';
import { upsertGoal } from '../db/goalRepository';
import { ensureForegroundLocationPermission } from '../services/locationPermissions';
import { useAppSetup } from '../onboarding/AppSetupContext';
import { useLanguage } from '../i18n/LanguageContext';
import { colors, fontFamily, radius, spacing } from '../theme/theme';
import { IconBadge } from '../components/IconBadge';
import { LanguageToggle, PillButton } from '../components/ui';
import { NumberWheel } from '../components/NumberWheel';

export default function OnboardingScreen() {
  const { t } = useLanguage();
  const { refresh } = useAppSetup();
  const [step, setStep] = useState(0);
  const [weight, setWeight] = useState(65);
  const [runGoal, setRunGoal] = useState(15);
  const [cycleGoal, setCycleGoal] = useState(50);

  const finish = async (requestLocation: boolean) => {
    if (requestLocation) await ensureForegroundLocationPermission();
    await Promise.all([
      completeOnboarding({ weightKg: weight, heightCm: 170, age: 30, sex: 'unspecified' }),
      upsertGoal('running', runGoal * 1000),
      upsertGoal('cycling', cycleGoal * 1000),
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
              <NumberWheel value={weight} onChange={setWeight} min={30} max={250} step={0.5} unit="KG" accessibilityLabel={t('weightLabel')} />
              <PillButton label={t('continue')} onPress={() => setStep(2)} />
            </View>
          ) : null}

          {step === 2 ? (
            <View style={styles.panel}>
              <IconBadge name="target" set="mci" size={64} />
              <Text style={styles.title}>{t('weeklyGoalTitle')}</Text>
              <Text style={styles.body}>{t('weeklyGoalBody')}</Text>
              <GoalInput label={t('modeRun')} value={runGoal} onChange={setRunGoal} min={1} max={100} step={1} />
              <GoalInput label={t('modeCycle')} value={cycleGoal} onChange={setCycleGoal} min={5} max={300} step={5} />
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

function GoalInput({ label, value, onChange, min, max, step }: { label: string; value: number; onChange: (value: number) => void; min: number; max: number; step: number }) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <NumberWheel value={value} onChange={onChange} min={min} max={max} step={step} unit="KM/WK" accessibilityLabel={label} />
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
});
