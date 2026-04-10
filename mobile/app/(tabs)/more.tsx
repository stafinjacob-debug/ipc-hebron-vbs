import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { palette } from '@/constants/theme';
import { Card, PrimaryButton, SectionTitle } from '@/components/ui';
import { getApiBase } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { isAdminLikeRole, roleLabel } from '@/lib/roles';

export default function MoreScreen() {
  const router = useRouter();
  const {
    user,
    seasonId,
    signOut,
    refreshUser,
    biometricGateEnabled,
    setBiometricGateEnabled,
  } = useAuth();
  const [busy, setBusy] = useState(false);
  const admin = isAdminLikeRole(user?.role);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <SectionTitle>Profile</SectionTitle>
      <Card style={{ marginBottom: 20 }}>
        <Text style={styles.name}>{user?.name ?? user?.email}</Text>
        <Text style={styles.meta}>{user?.email}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{roleLabel(user?.role)}</Text>
        </View>
      </Card>

      <SectionTitle>Season</SectionTitle>
      <Pressable
        onPress={() => router.push('/(auth)/select-season')}
        style={styles.linkRow}
      >
        <Text style={styles.linkText}>Switch VBS season</Text>
        <Text style={styles.chev}>›</Text>
      </Pressable>
      {seasonId ? (
        <Text style={styles.small}>Current season ID stored on device.</Text>
      ) : null}

      {admin ? (
        <>
          <SectionTitle>Admin</SectionTitle>
          <Text style={styles.help}>
            Post season announcements from the News tab (New). User management
            and full reports stay on the admin website.
          </Text>
        </>
      ) : null}

      <SectionTitle>Security</SectionTitle>
      <Card style={styles.switchCard}>
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchLabel}>Face ID / Touch ID lock</Text>
            <Text style={styles.switchSub}>
              Ask for biometrics when you return to the app
            </Text>
          </View>
          <Switch
            value={biometricGateEnabled}
            onValueChange={async (v) => {
              try {
                await setBiometricGateEnabled(v);
              } catch {
                Alert.alert(
                  'Unavailable',
                  'Biometrics are not set up on this device.',
                );
              }
            }}
          />
        </View>
      </Card>

      <SectionTitle>Sync</SectionTitle>
      <PrimaryButton
        label={busy ? 'Refreshing…' : 'Refresh profile'}
        loading={busy}
        onPress={async () => {
          setBusy(true);
          try {
            await refreshUser();
            Alert.alert('Updated', 'Your profile was refreshed.');
          } finally {
            setBusy(false);
          }
        }}
      />

      <SectionTitle>API</SectionTitle>
      <Text style={styles.mono} selectable>
        {getApiBase()}
      </Text>
      <Text style={styles.help}>
        Set EXPO_PUBLIC_API_URL to your Next.js site (same host as the admin
        portal).
      </Text>

      <View style={{ height: 24 }} />

      <Pressable
        onPress={() =>
          Alert.alert('Sign out?', 'You will need to sign in again.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign out', style: 'destructive', onPress: () => void signOut().then(() => router.replace('/(auth)/login')) },
          ])
        }
        style={styles.signOut}
      >
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  content: { padding: 20, paddingBottom: 48 },
  name: { fontSize: 20, fontWeight: '700', color: palette.text },
  meta: { fontSize: 15, color: palette.textSecondary, marginTop: 4 },
  roleBadge: {
    alignSelf: 'flex-start',
    marginTop: 10,
    backgroundColor: palette.accentMuted,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  roleText: { fontSize: 12, fontWeight: '800', color: palette.accent },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  linkText: { flex: 1, fontSize: 16, fontWeight: '600', color: palette.text },
  chev: { fontSize: 22, color: palette.textSecondary },
  small: { fontSize: 12, color: palette.textSecondary, marginTop: 8 },
  help: {
    fontSize: 14,
    color: palette.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  switchCard: { marginBottom: 16 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchLabel: { fontSize: 16, fontWeight: '600', color: palette.text },
  switchSub: { fontSize: 13, color: palette.textSecondary, marginTop: 4 },
  mono: {
    fontSize: 12,
    color: palette.text,
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    marginBottom: 8,
  },
  signOut: {
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: palette.danger,
  },
  signOutText: { fontSize: 17, fontWeight: '700', color: palette.danger },
});
