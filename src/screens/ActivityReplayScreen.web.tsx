import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getActivityById } from '../db/activityRepository';
import { PillButton } from '../components/ui';
import { shareText } from '../utils/share';
import { formatDistanceKm, formatDuration } from '../utils/format';
import { useLanguage } from '../i18n/LanguageContext';
import { colors, fontFamily, spacing } from '../theme/theme';
import type { Activity } from '../types';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ActivityReplay'>;

export default function ActivityReplayScreen({ route }: Props) {
  const { t } = useLanguage();
  const [activity, setActivity] = useState<Activity | null>(null);
  useEffect(() => { void getActivityById(route.params.activityId).then(setActivity); }, [route.params.activityId]);

  if (!activity) return <View style={styles.root}><Text style={styles.text}>{t('detailLoading')}</Text></View>;
  const durationMs = activity.moving_time_ms || ((activity.end_time ?? activity.start_time) - activity.start_time);
  const share = () => shareText(`${activity.title || t('routeReplay')}\n${formatDistanceKm(activity.total_distance)} km · ${formatDuration(durationMs)}`);

  return (
    <View style={styles.root}>
      <Text style={styles.title}>{t('routeReplay')}</Text>
      <Text style={styles.text}>{t('routeReplayAndroidOnly')}</Text>
      <PillButton label={t('shareActivity')} onPress={() => void share()} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', gap: spacing.md, padding: spacing.xl, backgroundColor: colors.canvas },
  title: { color: colors.text, fontFamily: fontFamily.display, fontSize: 28, textAlign: 'center' },
  text: { color: colors.textMuted, fontFamily: fontFamily.body, lineHeight: 22, textAlign: 'center' },
});
