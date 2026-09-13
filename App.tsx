import { useEffect, useRef } from 'react';
import { Alert, Linking, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import { LanguageProvider } from './src/i18n/LanguageContext';
import { useAppFonts } from './src/theme/useAppFonts';
import { colors } from './src/theme/theme';
import { AppSetupProvider } from './src/onboarding/AppSetupContext';
import { useLanguage } from './src/i18n/LanguageContext';
import { completeAuthRedirect } from './src/services/authService';

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.primary,
    background: colors.canvas,
    card: colors.background,
    text: colors.text,
    border: colors.border,
    notification: colors.secondary,
  },
};

function AuthDeepLinkHandler() {
  const { t } = useLanguage();
  const handled = useRef(new Set<string>());

  useEffect(() => {
    const handleUrl = async (url: string | null) => {
      if (!url?.startsWith('runtracker://auth/callback') || handled.current.has(url)) return;
      handled.current.add(url);
      const result = await completeAuthRedirect(url);
      Alert.alert(
        result.ok ? t('authConfirmedTitle') : t('authConfirmationFailedTitle'),
        result.ok ? t('authConfirmedBody') : (result.error || t('authUnknownError'))
      );
    };

    void Linking.getInitialURL().then(handleUrl);
    const subscription = Linking.addEventListener('url', ({ url }) => void handleUrl(url));
    return () => subscription.remove();
  }, [t]);

  return null;
}

export default function App() {
  const [fontsLoaded] = useAppFonts();

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: colors.canvas }} />;
  }

  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <AuthDeepLinkHandler />
        <AppSetupProvider>
          <NavigationContainer theme={navigationTheme}>
            <RootNavigator />
          </NavigationContainer>
        </AppSetupProvider>
      </LanguageProvider>
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}
