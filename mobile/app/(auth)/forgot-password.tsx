import { useRouter } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { palette } from '@/constants/theme';
import { PrimaryButton } from '@/components/ui';
import { getApiBase } from '@/lib/api';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 16 }]}>
      <Text style={styles.title}>Reset your password</Text>
      <Text style={styles.body}>
        Password reset is handled through the admin website. Open the site in
        Safari, use “Forgot password” if available, or contact a church admin.
      </Text>
      <Text style={styles.mono} selectable>
        {getApiBase()}
      </Text>
      <PrimaryButton label="Back to sign in" onPress={() => router.back()} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: palette.bg,
    paddingHorizontal: 24,
    gap: 16,
  },
  title: { fontSize: 22, fontWeight: '700', color: palette.text },
  body: {
    fontSize: 16,
    color: palette.textSecondary,
    lineHeight: 22,
  },
  mono: {
    fontSize: 13,
    color: palette.text,
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    marginVertical: 8,
  },
});
