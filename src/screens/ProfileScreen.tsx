import { useCallback, useState } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { HudGridBackground } from '../components/HudGridBackground';
import { getProfile, setWeightKg } from '../db/profileRepository';
import { clearActivityData, getAllActivities } from '../db/activityRepository';
import { getGoals, upsertGoal } from '../db/goalRepository';
import { useAuth } from '../hooks/useAuth';
import { useAutoSync } from '../hooks/useAutoSync';
import { signOut } from '../services/authService';
import { isSupabaseConfigured } from '../services/supabaseClient';
import AuthForm from '../components/AuthForm';
import { colors, fontFamily, radius, spacing } from '../theme/theme';
import { GlassCard, Label, PillButton, LanguageToggle } from '../components/ui';
import { IconBadge } from '../components/IconBadge';
import { useLanguage } from '../i18n/LanguageContext';
import { shareText } from '../utils/share';

export default function ProfileScreen() {
  const { t } = useLanguage();
  const { user, initializing } = useAuth();
  const { lastStatus, isSyncing, runSync } = useAutoSync(user?.id ?? null);
  const [weightInput, setWeightInput] = useState('65');
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [runGoalInput, setRunGoalInput] = useState('15');
  const [cycleGoalInput, setCycleGoalInput] = useState('50');

  useFocusEffect(
    useCallback(() => {
      Promise.all([getProfile(), getGoals()]).then(([profile, goals]) => {
        setWeightInput(String(profile.weight_kg));
        const runGoal = goals.find((goal) => goal.activity_type === 'running');
        const cycleGoal = goals.find((goal) => goal.activity_type === 'cycling');
        if (runGoal) setRunGoalInput(String(runGoal.weekly_distance_meters / 1000));
        if (cycleGoal) setCycleGoalInput(String(cycleGoal.weekly_distance_meters / 1000));
      });
    }, [])
  );

  const saveWeight = async () => {
    const parsed = parseFloat(weightInput.replace(',', '.'));
    if (Number.isNaN(parsed) || parsed <= 0 || parsed > 400) {
      setSavedMessage(t('weightInvalid'));
      return;
    }
    await setWeightKg(parsed);
    setSavedMessage(t('weightSaved'));
  };

  const saveGoals = async () => {
    const run = Math.max(1, Number(runGoalInput.replace(',', '.')) || 15) * 1000;
    const cycle = Math.max(1, Number(cycleGoalInput.replace(',', '.')) || 50) * 1000;
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
      <HudGridBackground />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
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
            <View style={styles.weightRow}>
              <TextInput
                style={styles.weightInput}
                keyboardType="decimal-pad"
                value={weightInput}
                onChangeText={setWeightInput}
              />
              <Pressable style={styles.saveButton} onPress={saveWeight}>
                <Text style={styles.saveButtonText}>{t('save')}</Text>
              </Pressable>
            </View>
            {savedMessage ? <Text style={styles.savedMessage}>{savedMessage}</Text> : null}
          </GlassCard>

          <GlassCard style={styles.card} delay={50}>
            <View style={styles.cardTitleRow}>
              <IconBadge name="target" set="mci" size={32} />
              <Label style={styles.cardTitleLabel}>{t('editGoals')}</Label>
            </View>
            <GoalRow label={t('modeRun')} value={runGoalInput} onChange={setRunGoalInput} />
            <GoalRow label={t('modeCycle')} value={cycleGoalInput} onChange={setCycleGoalInput} />
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

function GoalRow({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <View style={styles.goalRow}>
      <Text style={styles.goalLabel}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} keyboardType="decimal-pad" style={styles.goalInput} />
      <Text style={styles.goalUnit}>KM/WEEK</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  safeArea: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { fontFamily: fontFamily.headline, fontSize: 20, color: colors.text },
  card: { gap: spacing.xs },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  cardTitleLabel: { flex: 1 },
  weightRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  weightInput: {
    flex: 1,
    backgroundColor: colors.surfaceLow,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.text,
    fontFamily: fontFamily.mono,
    borderWidth: 1,
    borderColor: colors.border,
  },
  saveButton: { backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: 18, justifyContent: 'center' },
  saveButtonText: { color: colors.onPrimary, fontFamily: fontFamily.monoLabel },
  savedMessage: { color: colors.primary, fontSize: 12, marginTop: spacing.xs, fontFamily: fontFamily.body },
  emailText: { color: colors.text, fontFamily: fontFamily.bodySemiBold, marginTop: spacing.xs },
  mutedText: { color: colors.textMuted, fontSize: 12, fontFamily: fontFamily.body, marginTop: 2 },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surfaceLow, borderRadius: radius.md, paddingHorizontal: spacing.sm },
  goalLabel: { flex: 1, color: colors.text, fontFamily: fontFamily.bodySemiBold },
  goalInput: { width: 70, color: colors.text, fontFamily: fontFamily.mono, fontSize: 17, paddingVertical: 10, textAlign: 'right' },
  goalUnit: { color: colors.textFaint, fontFamily: fontFamily.monoLabel, fontSize: 9 },
});
