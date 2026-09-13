// "Kinetic Telemetry HUD" design system — carried over from the original
// Stitch concept (DESIGN.md) so the built app matches the mockup's
// stealth-athletic cockpit look: deep OLED base, volt-green/hyper-orange
// accents, glassmorphic cards, tabular mono telemetry numbers.

export const colors = {
  canvas: '#070A09',
  background: '#0D110F',
  surface: 'rgba(24, 30, 27, 0.92)',
  surfaceSolid: '#171D1A',
  surfaceHigh: '#202824',
  surfaceLow: '#101512',
  border: 'rgba(255, 255, 255, 0.09)',
  borderStrong: 'rgba(83, 242, 129, 0.45)',

  text: '#F3F7F4',
  textMuted: '#A4AEA8',
  textFaint: '#68726C',

  primary: '#53F281',
  onPrimary: '#06210E',
  secondary: '#FF9A5A',
  onSecondary: '#2A1003',
  tertiary: '#5BC8FF',
  danger: '#FF6B6B',
  warning: '#FFC857',
} as const;

export const glow = {
  primary: {
    shadowColor: colors.primary,
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  secondary: {
    shadowColor: colors.secondary,
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
} as const;

export const fontFamily = {
  display: 'SpaceGrotesk_700Bold',
  headline: 'SpaceGrotesk_600SemiBold',
  headlineMedium: 'SpaceGrotesk_500Medium',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
  mono: 'JetBrainsMono_700Bold',
  monoMedium: 'JetBrainsMono_500Medium',
  monoLabel: 'JetBrainsMono_600SemiBold',
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 22,
  full: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 40,
} as const;
