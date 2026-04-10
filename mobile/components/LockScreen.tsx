import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { palette } from '@/constants/theme';
import { PrimaryButton, SecondaryButton } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';

export function LockScreen() {
  const { unlockWithBiometrics, signOut } = useAuth();
  const [busy, setBusy] = useState(false);

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>VBS is locked</Text>
      <Text style={styles.sub}>
        Use Face ID or Touch ID to continue. Your session stays signed in.
      </Text>
      <PrimaryButton
        label="Unlock"
        loading={busy}
        onPress={async () => {
          setBusy(true);
          try {
            await unlockWithBiometrics();
          } finally {
            setBusy(false);
          }
        }}
      />
      <SecondaryButton label="Sign out" onPress={() => void signOut()} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: palette.bg,
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: palette.text,
    textAlign: 'center',
  },
  sub: {
    fontSize: 16,
    color: palette.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
});
