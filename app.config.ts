import type { ExpoConfig, ConfigContext } from 'expo/config';
import appJson from './app.json';

export default ({ config }: ConfigContext): ExpoConfig => {
  const base = { ...config, ...appJson.expo } as ExpoConfig;
  const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
  const plugins = (base.plugins ?? []).filter((plugin) => {
    const name = Array.isArray(plugin) ? plugin[0] : plugin;
    return name !== 'react-native-maps';
  });

  return {
    ...base,
    plugins: [
      ...plugins,
      [
        'react-native-maps',
        {
          androidGoogleMapsApiKey: mapsKey,
        },
      ],
    ],
    android: {
      ...base.android,
    },
  };
};
