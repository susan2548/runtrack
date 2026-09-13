import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { resendConfirmation, signIn, signUp } from '../services/authService';
import type { AuthErrorCode, AuthResult } from '../services/authService';
import { colors, fontFamily, radius, spacing } from '../theme/theme';
import { useLanguage } from '../i18n/LanguageContext';

type Feedback = { kind: 'error' | 'success'; text: string };

export default function AuthForm() {
  const { t } = useLanguage();
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  const errorMessage = (result: AuthResult) => {
    const messages: Partial<Record<AuthErrorCode, string>> = {
      not_configured: t('authNotConfigured'),
      invalid_credentials: t('authInvalidCredentials'),
      email_not_confirmed: t('authEmailNotConfirmed'),
      already_registered: t('authAlreadyRegistered'),
      password_too_short: t('authPasswordTooShort'),
      rate_limited: t('authRateLimited'),
      network: t('authNetworkError'),
    };
    return (result.code && messages[result.code]) || result.error || t('authUnknownError');
  };

  const changeMode = (nextMode: 'signIn' | 'signUp') => {
    setMode(nextMode);
    setPassword('');
    setFeedback(null);
    setAwaitingConfirmation(false);
  };

  const submit = async () => {
    if (busy) return;
    if (!email.trim() || !password) {
      setFeedback({ kind: 'error', text: t('authMissingFields') });
      return;
    }
    if (password.length < 6) {
      setFeedback({ kind: 'error', text: t('authPasswordTooShort') });
      return;
    }

    setBusy(true);
    setFeedback(null);
    try {
      const result = mode === 'signIn' ? await signIn(email, password) : await signUp(email, password);
      if (!result.ok) {
        setFeedback({ kind: 'error', text: errorMessage(result) });
      } else if (mode === 'signUp' && result.needsEmailConfirmation) {
        setFeedback({ kind: 'success', text: t('authCheckEmail') });
        setAwaitingConfirmation(true);
      } else if (mode === 'signUp') {
        setFeedback({ kind: 'success', text: t('authSignedUpAndIn') });
      }
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (busy || !email.trim()) return;
    setBusy(true);
    const result = await resendConfirmation(email);
    setFeedback(result.ok
      ? { kind: 'success', text: t('authConfirmationResent') }
      : { kind: 'error', text: errorMessage(result) });
    setBusy(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabRow}>
        <Pressable
          style={[styles.tab, mode === 'signIn' && styles.tabActive]}
          onPress={() => changeMode('signIn')}
          accessibilityRole="tab"
          accessibilityState={{ selected: mode === 'signIn' }}
        >
          <Text style={[styles.tabText, mode === 'signIn' && styles.tabTextActive]}>{t('signIn')}</Text>
        </Pressable>
        <Pressable
          style={[styles.tab, mode === 'signUp' && styles.tabActive]}
          onPress={() => changeMode('signUp')}
          accessibilityRole="tab"
          accessibilityState={{ selected: mode === 'signUp' }}
        >
          <Text style={[styles.tabText, mode === 'signUp' && styles.tabTextActive]}>{t('signUp')}</Text>
        </Pressable>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>{t('email')}</Text>
        <View style={styles.inputShell}>
          <Ionicons name="mail-outline" size={19} color={colors.textFaint} />
          <TextInput
            style={styles.input}
            placeholder="name@example.com"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            returnKeyType="next"
            value={email}
            onChangeText={setEmail}
            editable={!busy}
          />
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>{t('password')}</Text>
        <View style={styles.inputShell}>
          <Ionicons name="lock-closed-outline" size={19} color={colors.textFaint} />
          <TextInput
            style={styles.input}
            placeholder={t('authPasswordHint')}
            placeholderTextColor={colors.textFaint}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
            returnKeyType="done"
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={() => void submit()}
            editable={!busy}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={showPassword ? t('authHidePassword') : t('authShowPassword')}
            onPress={() => setShowPassword((current) => !current)}
            hitSlop={8}
            style={styles.passwordToggle}
          >
            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
          </Pressable>
        </View>
      </View>

      {feedback ? (
        <View style={[styles.feedback, feedback.kind === 'success' ? styles.feedbackSuccess : styles.feedbackError]}>
          <Ionicons
            name={feedback.kind === 'success' ? 'checkmark-circle-outline' : 'alert-circle-outline'}
            size={20}
            color={feedback.kind === 'success' ? colors.primary : colors.danger}
          />
          <Text style={[styles.feedbackText, feedback.kind === 'success' ? styles.successText : styles.errorText]}>
            {feedback.text}
          </Text>
        </View>
      ) : null}

      {mode === 'signUp' && awaitingConfirmation ? (
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => void resend()} style={styles.resendButton}>
          <Text style={styles.resendText}>{t('authResendConfirmation')}</Text>
        </Pressable>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={mode === 'signIn' ? t('signIn') : t('signUp')}
        style={({ pressed }) => [styles.submitButton, (busy || pressed) && styles.submitButtonPressed]}
        onPress={() => void submit()}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <Text style={styles.submitButtonText}>{mode === 'signIn' ? t('signIn') : t('signUp')}</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceHigh,
    borderRadius: radius.full,
    padding: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tab: { flex: 1, paddingVertical: 8, borderRadius: radius.full, alignItems: 'center' },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontFamily: fontFamily.monoLabel, fontSize: 12, color: colors.textMuted },
  tabTextActive: { color: colors.onPrimary },
  fieldGroup: { gap: 6 },
  fieldLabel: { color: colors.textMuted, fontFamily: fontFamily.bodySemiBold, fontSize: 12 },
  inputShell: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceLow,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 12,
    color: colors.text,
    fontFamily: fontFamily.body,
    fontSize: 15,
  },
  passwordToggle: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' },
  feedback: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  feedbackSuccess: { backgroundColor: 'rgba(83,242,129,0.07)', borderColor: 'rgba(83,242,129,0.3)' },
  feedbackError: { backgroundColor: 'rgba(255,107,107,0.08)', borderColor: 'rgba(255,107,107,0.35)' },
  feedbackText: { flex: 1, fontSize: 12, lineHeight: 18, fontFamily: fontFamily.body },
  successText: { color: colors.primary },
  errorText: { color: colors.danger },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    minHeight: 50,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonPressed: { opacity: 0.72 },
  submitButtonText: { color: colors.onPrimary, fontFamily: fontFamily.monoLabel, letterSpacing: 0.5 },
  resendButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  resendText: { color: colors.tertiary, fontFamily: fontFamily.bodySemiBold, fontSize: 13 },
});
