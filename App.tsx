import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import { LanguageProvider } from './src/i18n/LanguageContext';
import { useAppFonts } from './src/theme/useAppFonts';
import { colors } from './src/theme/theme';
import { AppSetupProvider } from './src/onboarding/AppSetupContext';

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

export default function App() {
  const [fontsLoaded] = useAppFonts();

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: colors.canvas }} />;
  }

  return (
    <SafeAreaProvider>
      <LanguageProvider>
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
