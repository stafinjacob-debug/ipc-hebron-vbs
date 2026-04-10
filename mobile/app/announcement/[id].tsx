import {
  Redirect,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { palette } from '@/constants/theme';
import { PrimaryButton, SecondaryButton } from '@/components/ui';
import { ApiError, apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { canManageAnnouncements } from '@/lib/roles';

type Ann = {
  id: string;
  title: string;
  body: string;
  audience: string;
  pinned: boolean;
  createdAt: string;
};

function audienceLabel(a: string) {
  switch (a) {
    case 'VOLUNTEERS':
      return 'Volunteers';
    case 'ALL':
      return 'Everyone';
    default:
      return 'Staff';
  }
}

export default function AnnouncementDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { token, seasonId, user, ready } = useAuth();
  const [data, setData] = useState<Ann | null>(null);
  const [loading, setLoading] = useState(true);
  const admin = canManageAnnouncements(user?.role);

  const load = useCallback(async () => {
    if (!token || !seasonId || !id) return;
    setLoading(true);
    try {
      const res = await apiFetch<{ announcement: Ann }>(
        `/api/mobile/v1/seasons/${seasonId}/announcements/${id}`,
        { token },
      );
      setData(res.announcement);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [token, seasonId, id]);

  useEffect(() => {
    void load();
  }, [load]);

  function confirmDelete() {
    if (!token || !seasonId || !id) return;
    Alert.alert(
      'Delete announcement?',
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiFetch(
                `/api/mobile/v1/seasons/${seasonId}/announcements/${id}`,
                { method: 'DELETE', token },
              );
              router.replace('/(tabs)/announcements');
            } catch (e) {
              const msg = e instanceof ApiError ? e.message : 'Delete failed';
              Alert.alert('Error', msg);
            }
          },
        },
      ],
    );
  }

  if (!ready || !id) {
    return null;
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={palette.accent} />
      </View>
    );
  }

  if (!data) {
    return <Redirect href="/(tabs)/announcements" />;
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {data.pinned ? (
        <View style={styles.pinBadge}>
          <Text style={styles.pinText}>Pinned</Text>
        </View>
      ) : null}
      <Text style={styles.title}>{data.title}</Text>
      <Text style={styles.meta}>
        {audienceLabel(data.audience)} ·{' '}
        {new Date(data.createdAt).toLocaleString()}
      </Text>
      <View style={styles.card}>
        <Text style={styles.body}>{data.body}</Text>
      </View>

      {admin ? (
        <View style={styles.admin}>
          <PrimaryButton
            label="Edit"
            onPress={() =>
              router.push(`/announcement/edit/${id}`)
            }
          />
          <View style={{ height: 12 }} />
          <SecondaryButton label="Delete" onPress={confirmDelete} />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', backgroundColor: palette.bg },
  pinBadge: {
    alignSelf: 'flex-start',
    backgroundColor: palette.accentMuted,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 10,
  },
  pinText: { fontSize: 12, fontWeight: '800', color: palette.accent },
  title: { fontSize: 22, fontWeight: '800', color: palette.text },
  meta: { fontSize: 14, color: palette.textSecondary, marginTop: 8 },
  card: {
    marginTop: 20,
    backgroundColor: palette.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  body: { fontSize: 16, color: palette.text, lineHeight: 24 },
  admin: { marginTop: 28 },
});
