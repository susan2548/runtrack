import { View, Text, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import HomeScreen from '../screens/HomeScreen';
import TrackingScreen from '../screens/TrackingScreen';
import HistoryScreen from '../screens/HistoryScreen';
import ActivityDetailScreen from '../screens/ActivityDetailScreen';
import ActivityEditorScreen from '../screens/ActivityEditorScreen';
import HeatmapScreen from '../screens/HeatmapScreen';
import StatsScreen from '../screens/StatsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import RoutePlannerScreen from '../screens/RoutePlannerScreen';
import ActivityReplayScreen from '../screens/ActivityReplayScreen';
import { colors, fontFamily } from '../theme/theme';
import { useLanguage } from '../i18n/LanguageContext';
import { useAppSetup } from '../onboarding/AppSetupContext';
import type { RootStackParamList, RootTabParamList } from './types';

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const icons: Record<keyof RootTabParamList, keyof typeof Ionicons.glyphMap> = {
  Home: 'home-outline',
  Track: 'radio-button-on-outline',
  Progress: 'analytics-outline',
  Profile: 'person-outline',
};

function MainTabs() {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const labels: Record<keyof RootTabParamList, string> = {
    Home: t('tabHome'),
    Track: t('tabTrack'),
    Progress: t('tabProgress'),
    Profile: t('tabProfile'),
  };
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: [
          styles.tabBar,
          {
            height: 62 + Math.max(insets.bottom, 8),
            paddingBottom: Math.max(insets.bottom, 8),
          },
        ],
        tabBarItemStyle: styles.tabItem,
        tabBarLabelStyle: styles.tabLabel,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarHideOnKeyboard: true,
        tabBarIcon: ({ color, size }) => (
          <View style={route.name === 'Track' ? styles.trackIcon : undefined}>
            <Ionicons name={icons[route.name]} color={route.name === 'Track' ? colors.onPrimary : color} size={route.name === 'Track' ? 28 : size} />
          </View>
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: labels.Home }} />
      <Tab.Screen name="Track" component={TrackingScreen} options={{ tabBarLabel: labels.Track }} />
      <Tab.Screen name="Progress" component={StatsScreen} options={{ tabBarLabel: labels.Progress }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: labels.Profile }} />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const { ready, onboardingCompleted } = useAppSetup();
  const { t } = useLanguage();
  if (!ready) return <View style={styles.loading}><Text style={styles.loadingText}>{t('loadingApp')}</Text></View>;
  if (!onboardingCompleted) return <OnboardingScreen />;

  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.text, headerTitleStyle: { fontFamily: fontFamily.headline }, contentStyle: { backgroundColor: colors.canvas } }}>
      <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
      <Stack.Screen name="History" component={HistoryScreen} options={{ title: t('historyTitle') }} />
      <Stack.Screen name="ActivityDetail" component={ActivityDetailScreen} options={{ title: t('activityDetailTitle') }} />
      <Stack.Screen name="ActivityReplay" component={ActivityReplayScreen} options={{ title: t('routeReplay') }} />
      <Stack.Screen name="ActivityEditor" component={ActivityEditorScreen} options={{ title: t('editActivity') }} />
      <Stack.Screen name="Heatmap" component={HeatmapScreen} options={{ title: t('routeHeatmap') }} />
      <Stack.Screen name="RoutePlanner" component={RoutePlannerScreen} options={{ title: t('planRoute') }} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas },
  loadingText: { color: colors.textMuted, fontFamily: fontFamily.body },
  tabBar: { paddingTop: 8, backgroundColor: '#0D110F', borderTopColor: colors.border },
  tabItem: { minHeight: 48 },
  tabLabel: { fontFamily: fontFamily.bodySemiBold, fontSize: 10 },
  trackIcon: { width: 46, height: 46, marginTop: -18, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderWidth: 4, borderColor: colors.canvas },
});
