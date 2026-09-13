import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getActivityById, updateActivityDetails } from '../db/activityRepository';
import { formatDistanceKm, formatDuration } from '../utils/format';
import { colors, fontFamily, radius, spacing } from '../theme/theme';
import { GlassCard, Label, MonoValue, PillButton } from '../components/ui';
import { IconBadge } from '../components/IconBadge';
import { useLanguage } from '../i18n/LanguageContext';
import type { RootStackParamList } from '../navigation/types';
import type { Activity } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'ActivityEditor'>;

export default function ActivityEditorScreen({ route, navigation }: Props) {
  const { t } = useLanguage();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    getActivityById(route.params.activityId).then((row) => {
      setActivity(row);
      setTitle(row?.title ?? '');
      setNotes(row?.notes ?? '');
    });
  }, [route.params.activityId]);

  const save = async () => {
    await updateActivityDetails(route.params.activityId, title.trim() || null, notes.trim() || null);
    if (route.params.afterFinish) {
      navigation.replace('ActivityDetail', { activityId: route.params.activityId });
    } else {
      navigation.goBack();
    }
  };

  if (!activity) return <View style={styles.loading}><Text style={styles.muted}>{t('detailLoading')}</Text></View>;

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <IconBadge name={activity.type === 'running' ? 'run' : 'bike'} set="mci" size={48} />
            <View>
              <Label>{route.params.afterFinish ? t('savedLocally') : t('editActivity')}</Label>
              <Text style={styles.title}>{activity.type === 'running' ? t('modeRun') : t('modeCycle')}</Text>
            </View>
          </View>
          <View style={styles.summary}>
            <GlassCard style={styles.summaryCard}><MonoValue size={22}>{formatDistanceKm(activity.total_distance)} km</MonoValue><Label>{t('distance')}</Label></GlassCard>
            <GlassCard style={styles.summaryCard}><MonoValue size={22}>{formatDuration(activity.moving_time_ms)}</MonoValue><Label>{t('time')}</Label></GlassCard>
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('activityName')}</Text>
            <TextInput value={title} onChangeText={setTitle} style={styles.input} maxLength={60} placeholder={activity.type === 'running' ? t('modeRun') : t('modeCycle')} placeholderTextColor={colors.textFaint} />
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('notes')}</Text>
            <TextInput value={notes} onChangeText={setNotes} style={[styles.input, styles.notes]} multiline maxLength={500} placeholder={t('notes')} placeholderTextColor={colors.textFaint} textAlignVertical="top" />
          </View>
          <PillButton label={t('saveChanges')} onPress={() => void save()} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas }, safe: { flex: 1 },
  loading: { flex: 1, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center' },
  muted: { color: colors.textMuted, fontFamily: fontFamily.body },
  content: { padding: spacing.md, gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  title: { color: colors.text, fontFamily: fontFamily.display, fontSize: 27 },
  summary: { flexDirection: 'row', gap: spacing.sm }, summaryCard: { flex: 1 },
  field: { gap: spacing.sm }, fieldLabel: { color: colors.text, fontFamily: fontFamily.bodySemiBold, fontSize: 14 },
  input: { color: colors.text, fontFamily: fontFamily.body, fontSize: 16, minHeight: 52, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSolid, paddingHorizontal: spacing.md },
  notes: { minHeight: 140, paddingTop: spacing.md },
});
