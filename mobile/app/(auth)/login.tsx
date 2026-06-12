import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { palette } from '@/constants/theme';
import { FieldLabel, PrimaryButton, SecondaryButton } from '@/components/ui';
import { ApiError, apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signIn, token, seasonId, setSeasonId } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token && seasonId) {
      router.replace('/(tabs)');
    } else if (token && !seasonId) {
      router.replace('/(auth)/select-season');
    }
  }, [token, seasonId, router]);

  async function onSubmit() {
    setLoading(true);
    try {
      const { accessToken } = await signIn(email.trim(), password);
      const { seasons } = await apiFetch<{ seasons: { id: string }[] }>(
        '/api/mobile/v1/seasons',
        { token: accessToken },
      );
      if (seasons.length === 1) {
        await setSeasonId(seasons[0].id);
        router.replace('/(tabs)');
      } else {
        router.replace('/(auth)/select-season');
      }
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Could not sign in';
      Alert.alert('Sign in failed', msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { paddingTop: insets.top + 24 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Image
          source={require('@/assets/images/logocheckin.png')}
          style={styles.logo}
          accessibilityLabel="Anchor Check Ins logo"
        />
        <Text style={styles.title}>Anchor Check Ins</Text>
        <Text style={styles.subtitle}>Staff & volunteer sign in</Text>

        <View style={styles.form}>
          <FieldLabel>Email</FieldLabel>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="username"
            placeholder="you@church.org"
            placeholderTextColor={palette.textSecondary}
            style={styles.input}
          />
          <FieldLabel>Password</FieldLabel>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
            placeholder="••••••••"
            placeholderTextColor={palette.textSecondary}
            style={styles.input}
          />
          <PrimaryButton label="Sign in" loading={loading} onPress={onSubmit} />
        </View>

        <SecondaryButton
          label="Forgot password?"
          onPress={() => router.push('/(auth)/forgot-password')}
        />

        <Text style={styles.footer}>
          Same account as the admin website. Use HTTPS in production.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: palette.bg },
  scroll: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  logo: {
    alignSelf: 'center',
    width: 120,
    height: 120,
    marginBottom: 20,
    borderRadius: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: palette.text,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 16,
    color: palette.textSecondary,
    textAlign: 'center',
    marginBottom: 28,
  },
  form: { gap: 4, marginBottom: 8 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 17,
    backgroundColor: palette.surface,
    color: palette.text,
    marginBottom: 14,
  },
  footer: {
    marginTop: 28,
    fontSize: 12,
    color: palette.textSecondary,
    textAlign: 'center',
    lineHeight: 17,
  },
});
