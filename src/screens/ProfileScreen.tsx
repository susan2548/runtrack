import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getProfile, setWeightKg } from '../db/profileRepository';
import { clearActivityData, getAllActivities } from '../db/activityRepository';
import { getGoals, upsertGoal } from '../db/goalRepository';
import { useAuth } from '../hooks/useAuth';
import { useAutoSync } from '../hooks/useAutoSync';
import { signOut } from '../services/authService';
import { isSupabaseConfigured } from '../services/supabaseClient';
import AuthForm from '../components/AuthForm';
import { colors, fontFamily, spacing } from '../theme/theme';
import { GlassCard, Label, PillButton, LanguageToggle } from '../components/ui';
import { IconBadge } from '../components/IconBadge';
import { useLanguage } from '../i18n/LanguageContext';
import { shareText } from '../utils/share';
import { NumberWheel } from '../components/NumberWheel';

export default function ProfileScreen() {
  const { t } = useLanguage();
  const { user, initializing } = useAuth();
  const { lastStatus, isSyncing, runSync } = useAutoSync(user?.id ?? null);
  const [weightInput, setWeightInput] = useState(65);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [runGoalInput, setRunGoalInput] = useState(15);
  const [cycleGoalInput, setCycleGoalInput] = useState(50);

  useFocusEffect(
    useCallback(() => {
      Promise.all([getProfile(), getGoals()]).then(([profile, goals]) => {
        setWeightInput(profile.weight_kg);
        const runGoal = goals.find((goal) => goal.activity_type === 'running');
        const cycleGoal = goals.find((goal) => goal.activity_type === 'cycling');
        if (runGoal) setRunGoalInput(runGoal.weekly_distance_meters / 1000);
        if (cycleGoal) setCycleGoalInput(cycleGoal.weekly_distance_meters / 1000);
      });
    }, [])
  );

  const saveWeight = async () => {
    await setWeightKg(weightInput);
    setSavedMessage(t('weightSaved'));
  };

  const saveGoals = async () => {
    const run = runGoalInput * 1000;
    const cycle = cycleGoalInput * 1000;
    await Promise.all([upsertGoal('running', run), upsertGoal('cycling', cycle)]);
    setSavedMessage(t('weightSaved'));
  };

  const exportActivities = async () => {
    const activities = await getAllActivities();
    await shareText(JSON.stringify({ exportedAt: new Date().toISOString(), activities }, null, 2));
  };

  const confirmClearData = () => {
    Alert.alert(t('clearData'), t('clearDataConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('delete'), style: 'destructive', onPress: () => void clearActivityData() },
    ]);
  };

  const syncSummary = (() => {
    if (!isSupabaseConfigured) return t('notConfigured');
    if (isSyncing) return t('syncing');
    if (!lastStatus) return '';
    switch (lastStatus.state) {
      case 'idle':
        return lastStatus.uploaded > 0
          ? `${t('syncSuccessPrefix')} ${lastStatus.uploaded} ${t('activitiesWord')}`
          : t('syncUpToDate');
      case 'error':
        return `${t('syncFailedPrefix')} ${lastStatus.message}`;
      case 'skipped':
        if (lastStatus.reason === 'offline') return t('syncOffline');
        if (lastStatus.reason === 'signed-out') return t('syncSignedOut');
        return '';
    }
  })();

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          <View style={styles.header}>
            <IconBadge name="account-circle" set="mci" size={64} />
            <Text style={styles.title}>{t('profileTitle')}</Text>
            <View style={{ flex: 1 }} />
            <LanguageToggle />
          </View>

          <GlassCard>
            <View style={styles.cardTitleRow}>
              <IconBadge name="scale-bathroom" set="mci" size={32} />
              <Label style={styles.cardTitleLabel}>{t('weightLabel')}</Label>
            </View>
            <NumberWheel value={weightInput} onChange={setWeightInput} min={30} max={250} step={0.5} unit="KG" accessibilityLabel={t('weightLabel')} />
            <PillButton label={t('save')} onPress={() => void saveWeight()} variant="secondary" />
            {savedMessage ? <Text style={styles.savedMessage}>{savedMessage}</Text> : null}
          </GlassCard>

          <GlassCard style={styles.card} delay={50}>
            <View style={styles.cardTitleRow}>
              <IconBadge name="target" set="mci" size={32} />
              <Label style={styles.cardTitleLabel}>{t('editGoals')}</Label>
            </View>
            <GoalRow label={t('modeRun')} value={runGoalInput} onChange={setRunGoalInput} min={1} max={100} step={1} />
            <GoalRow label={t('modeCycle')} value={cycleGoalInput} onChange={setCycleGoalInput} min={5} max={300} step={5} />
            <PillButton label={t('saveChanges')} onPress={() => void saveGoals()} variant="secondary" />
          </GlassCard>

          <GlassCard style={styles.card} delay={80}>
            <View style={styles.cardTitleRow}>
              <IconBadge name="cloud-sync-outline" set="mci" size={32} color={colors.tertiary} />
              <Label style={styles.cardTitleLabel}>{t('accountAndSync')}</Label>
            </View>
            {initializing ? (
              <Text style={styles.mutedText}>{t('checkingSignIn')}</Text>
            ) : user ? (
              <>
                <Text style={styles.emailText}>{user.email}</Text>
                <Text style={styles.mutedText}>{syncSummary}</Text>
                <View style={styles.actionsRow}>
                  <PillButton label={t('syncNow')} onPress={() => runSync()} variant="secondary" disabled={isSyncing} flex={1} />
                  <PillButton label={t('signOut')} onPress={() => signOut()} variant="secondary" flex={1} />
                </View>
              </>
            ) : (
              <>
                <Text style={styles.mutedText}>{syncSummary}</Text>
                <AuthForm />
              </>
            )}
          </GlassCard>

          <GlassCard style={styles.card} delay={120}>
            <View style={styles.cardTitleRow}>
              <IconBadge name="shield-lock-outline" set="mci" size={32} color={colors.tertiary} />
              <Label style={styles.cardTitleLabel}>{t('dataAndPrivacy')}</Label>
            </View>
            <PillButton label={t('exportData')} onPress={() => void exportActivities()} variant="secondary" />
            <PillButton label={t('clearData')} onPress={confirmClearData} variant="ghost" />
          </GlassCard>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function GoalRow({ label, value, onChange, min, max, step }: { label: string; value: number; onChange: (value: number) => void; min: number; max: number; step: number }) {
  return (
    <View style={styles.goalGroup}>
      <Text style={styles.goalLabel}>{label}</Text>
      <NumberWheel value={value} onChange={onChange} min={min} max={max} step={step} unit="KM/WK" accessibilityLabel={label} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  safeArea: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: 120, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { fontFamily: fontFamily.headline, fontSize: 20, color: colors.text },
  card: { gap: spacing.xs },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  cardTitleLabel: { flex: 1 },
  savedMessage: { color: colors.primary, fontSize: 12, marginTop: spacing.xs, fontFamily: fontFamily.body },
  emailText: { color: colors.text, fontFamily: fontFamily.bodySemiBold, marginTop: spacing.xs },
  mutedText: { color: colors.textMuted, fontSize: 12, fontFamily: fontFamily.body, marginTop: 2 },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  goalGroup: { gap: spacing.xs },
  goalLabel: { color: colors.text, fontFamily: fontFamily.bodySemiBold },
});
