import { useCallback, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { getProfile, updateProfile } from '../db/profileRepository';
import { clearActivityData, getAllActivities } from '../db/activityRepository';
import { getGoals, upsertGoal } from '../db/goalRepository';
import { colors, fontFamily, radius, spacing } from '../theme/theme';
import { GlassCard, Label, PillButton, LanguageToggle } from '../components/ui';
import { IconBadge } from '../components/IconBadge';
import { useLanguage } from '../i18n/LanguageContext';
import { shareText } from '../utils/share';
import { NumberWheel } from '../components/NumberWheel';
import type { ProfileSex } from '../types';

const PROFILE_IMAGE_SIZE = 512;
const SEX_OPTIONS: ProfileSex[] = ['female', 'male', 'unspecified'];

export default function ProfileScreen() {
  const { t } = useLanguage();
  const [displayName, setDisplayName] = useState('');
  const [avatarData, setAvatarData] = useState<string | null>(null);
  const [weightInput, setWeightInput] = useState(65);
  const [heightInput, setHeightInput] = useState(170);
  const [ageInput, setAgeInput] = useState(30);
  const [sexInput, setSexInput] = useState<ProfileSex>('unspecified');
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [runGoalInput, setRunGoalInput] = useState(15);
  const [cycleGoalInput, setCycleGoalInput] = useState(50);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([getProfile(), getGoals()]).then(([profile, goals]) => {
        if (!active) return;
        setDisplayName(profile.display_name ?? '');
        setAvatarData(profile.avatar_data);
        setWeightInput(profile.weight_kg);
        setHeightInput(profile.height_cm);
        setAgeInput(profile.age);
        setSexInput(profile.sex);
        const runGoal = goals.find((goal) => goal.activity_type === 'running');
        const cycleGoal = goals.find((goal) => goal.activity_type === 'cycling');
        if (runGoal) setRunGoalInput(runGoal.weekly_distance_meters / 1000);
        if (cycleGoal) setCycleGoalInput(cycleGoal.weekly_distance_meters / 1000);
      });
      return () => { active = false; };
    }, [])
  );

  const choosePhoto = async () => {
    setPhotoBusy(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });
      if (result.canceled || !result.assets[0]?.uri) return;

      const context = ImageManipulator.manipulate(result.assets[0].uri);
      context.resize({ width: PROFILE_IMAGE_SIZE, height: PROFILE_IMAGE_SIZE });
      const rendered = await context.renderAsync();
      const saved = await rendered.saveAsync({ base64: true, compress: 0.72, format: SaveFormat.JPEG });
      if (!saved.base64) throw new Error('Image conversion returned no data');
      setAvatarData(`data:image/jpeg;base64,${saved.base64}`);
      setSavedMessage(null);
    } catch {
      Alert.alert(t('profilePhoto'), t('profilePhotoFailed'));
    } finally {
      setPhotoBusy(false);
    }
  };

  const saveProfile = async () => {
    await updateProfile({
      displayName: displayName.trim() || null,
      avatarData,
      weightKg: weightInput,
      heightCm: heightInput,
      age: ageInput,
      sex: sexInput,
    });
    setSavedMessage(t('profileSaved'));
  };

  const saveGoals = async () => {
    await Promise.all([
      upsertGoal('running', runGoalInput * 1000),
      upsertGoal('cycling', cycleGoalInput * 1000),
    ]);
    setSavedMessage(t('profileSaved'));
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
            <ProfileAvatar avatarData={avatarData} size={64} />
            <View style={styles.headerCopy}>
              <Text style={styles.title}>{displayName.trim() || t('profileTitle')}</Text>
              {displayName.trim() ? <Text style={styles.headerSubtitle}>{t('profileTitle')}</Text> : null}
            </View>
            <LanguageToggle />
          </View>

          <GlassCard>
            <View style={styles.cardTitleRow}>
              <IconBadge name="account-edit-outline" set="mci" size={32} />
              <Label style={styles.cardTitleLabel}>{t('personalDetails')}</Label>
            </View>

            <View style={styles.avatarRow}>
              <ProfileAvatar avatarData={avatarData} size={88} />
              <View style={styles.avatarActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('changePhoto')}
                  disabled={photoBusy}
                  onPress={() => void choosePhoto()}
                  style={({ pressed }) => [styles.compactButton, pressed && styles.compactButtonPressed]}
                >
                  <Text style={styles.compactButtonText}>{photoBusy ? t('detailLoading') : t('changePhoto')}</Text>
                </Pressable>
                {avatarData ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('removePhoto')}
                    onPress={() => setAvatarData(null)}
                    style={styles.removeButton}
                  >
                    <Text style={styles.removeButtonText}>{t('removePhoto')}</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>

            <Label>{t('displayName')}</Label>
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder={t('displayNamePlaceholder')}
              placeholderTextColor={colors.textFaint}
              maxLength={50}
              autoCapitalize="words"
              returnKeyType="done"
              style={styles.textInput}
              accessibilityLabel={t('displayName')}
            />

            <Label>{t('weightLabel')}</Label>
            <NumberWheel value={weightInput} onChange={setWeightInput} min={30} max={250} step={0.5} unit="KG" accessibilityLabel={t('weightLabel')} />

            <Label>{t('heightLabel')}</Label>
            <NumberWheel value={heightInput} onChange={setHeightInput} min={120} max={230} step={1} unit="CM" accessibilityLabel={t('heightLabel')} />

            <Label>{t('ageLabel')}</Label>
            <NumberWheel value={ageInput} onChange={setAgeInput} min={13} max={100} step={1} unit="YEARS" accessibilityLabel={t('ageLabel')} />

            <Label>{t('sexLabel')}</Label>
            <SexSelector value={sexInput} onChange={setSexInput} labels={{
              female: t('sexFemale'),
              male: t('sexMale'),
              unspecified: t('sexUnspecified'),
            }} />
            <Text style={styles.hint}>{t('calorieProfileHint')}</Text>
            <PillButton label={t('save')} onPress={() => void saveProfile()} variant="secondary" disabled={photoBusy} />
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

function ProfileAvatar({ avatarData, size }: { avatarData: string | null; size: number }) {
  if (avatarData) {
    return <Image source={{ uri: avatarData }} style={[styles.avatarImage, { width: size, height: size, borderRadius: size / 2 }]} />;
  }
  return <IconBadge name="account-circle" set="mci" size={size} />;
}

function SexSelector({
  value,
  onChange,
  labels,
}: {
  value: ProfileSex;
  onChange: (value: ProfileSex) => void;
  labels: Record<ProfileSex, string>;
}) {
  return (
    <View style={styles.segmentedControl}>
      {SEX_OPTIONS.map((option) => (
        <Pressable
          key={option}
          accessibilityRole="radio"
          accessibilityLabel={labels[option]}
          accessibilityState={{ checked: value === option }}
          onPress={() => onChange(option)}
          style={[styles.segment, value === option && styles.segmentActive]}
        >
          <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.segmentText, value === option && styles.segmentTextActive]}>
            {labels[option]}
          </Text>
        </Pressable>
      ))}
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
  headerCopy: { flex: 1 },
  title: { fontFamily: fontFamily.headline, fontSize: 20, color: colors.text },
  headerSubtitle: { color: colors.textMuted, fontFamily: fontFamily.body, fontSize: 11 },
  card: { gap: spacing.xs },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  cardTitleLabel: { flex: 1 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  avatarImage: { borderWidth: 2, borderColor: colors.primary, backgroundColor: colors.surfaceHigh },
  avatarActions: { flex: 1, gap: spacing.xs },
  compactButton: { minHeight: 44, borderRadius: radius.lg, backgroundColor: colors.surfaceHigh, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm },
  compactButtonPressed: { opacity: 0.78 },
  compactButtonText: { color: colors.text, fontFamily: fontFamily.bodySemiBold, fontSize: 13 },
  removeButton: { minHeight: 36, justifyContent: 'center', alignItems: 'center' },
  removeButtonText: { color: colors.secondary, fontFamily: fontFamily.body, fontSize: 12 },
  textInput: { minHeight: 50, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSolid, color: colors.text, fontFamily: fontFamily.body, fontSize: 16, paddingHorizontal: spacing.md, marginBottom: spacing.xs },
  segmentedControl: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: radius.lg, backgroundColor: colors.surfaceSolid, borderWidth: 1, borderColor: colors.border },
  segment: { flex: 1, minHeight: 44, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: { color: colors.textMuted, fontFamily: fontFamily.bodySemiBold, fontSize: 12, textAlign: 'center' },
  segmentTextActive: { color: colors.onPrimary },
  hint: { color: colors.textMuted, fontFamily: fontFamily.body, fontSize: 12, lineHeight: 18, marginVertical: spacing.xs },
  savedMessage: { color: colors.primary, fontSize: 12, marginTop: spacing.xs, fontFamily: fontFamily.body },
  goalGroup: { gap: spacing.xs },
  goalLabel: { color: colors.text, fontFamily: fontFamily.bodySemiBold },
});
