import type { ExpoConfig, ConfigContext } from 'expo/config';
import appJson from './app.json';

export default ({ config }: ConfigContext): ExpoConfig => {
  const base = { ...config, ...appJson.expo } as ExpoConfig;
  const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
  return {
    ...base,
    android: {
      ...base.android,
      config: { googleMaps: { apiKey: mapsKey } },
    },
    ios: {
      ...base.ios,
      config: { googleMapsApiKey: mapsKey },
    },
  };
};
