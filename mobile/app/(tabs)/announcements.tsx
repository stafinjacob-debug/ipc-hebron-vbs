import { useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { palette } from '@/constants/theme';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { canManageAnnouncements } from '@/lib/roles';

type Announcement = {
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

export default function AnnouncementsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { token, seasonId, user } = useAuth();
  const [items, setItems] = useState<Announcement[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const admin = canManageAnnouncements(user?.role);

  const load = useCallback(async () => {
    if (!token || !seasonId) return;
    const res = await apiFetch<{ announcements: Announcement[] }>(
      `/api/mobile/v1/seasons/${seasonId}/announcements`,
      { token },
    );
    setItems(res.announcements);
  }, [token, seasonId]);

  useEffect(() => {
    void load();
  }, [load]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: admin
        ? () => (
            <Pressable
              onPress={() => router.push('/announcement/new')}
              style={styles.headerBtn}
              hitSlop={12}
            >
              <Text style={styles.headerBtnText}>New</Text>
            </Pressable>
          )
        : undefined,
    });
  }, [navigation, admin, router]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (items === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={palette.accent} />
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(a) => a.id}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      ListHeaderComponent={
        <View style={styles.pinned}>
          <Text style={styles.pinnedTitle}>Operational notices</Text>
          <Text style={styles.pinnedBody}>
            Season-specific updates for your team. Pull down to refresh.
            {admin ? ' Tap New to post.' : ''}
          </Text>
        </View>
      }
      ListEmptyComponent={
        <Text style={styles.empty}>
          No announcements yet for this season.
          {admin ? ' Tap New to add the first one.' : ''}
        </Text>
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() => router.push(`/announcement/${item.id}`)}
          style={styles.card}
        >
          {item.pinned ? (
            <Text style={styles.pinLabel}>Pinned</Text>
          ) : null}
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardMeta}>
            {audienceLabel(item.audience)} ·{' '}
            {new Date(item.createdAt).toLocaleString()}
          </Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', backgroundColor: palette.bg },
  list: { padding: 16, paddingBottom: 40 },
  headerBtn: { marginRight: 4, paddingVertical: 6, paddingHorizontal: 4 },
  headerBtnText: {
    fontSize: 17,
    fontWeight: '600',
    color: palette.accent,
  },
  pinned: {
    backgroundColor: palette.warningBg,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.warning,
  },
  pinnedTitle: { fontSize: 16, fontWeight: '800', color: palette.warning },
  pinnedBody: { marginTop: 6, fontSize: 14, color: palette.text, lineHeight: 20 },
  card: {
    backgroundColor: palette.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  pinLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: palette.accent,
    marginBottom: 6,
  },
  cardTitle: { fontSize: 17, fontWeight: '700', color: palette.text },
  cardMeta: { fontSize: 13, color: palette.textSecondary, marginTop: 6 },
  empty: {
    textAlign: 'center',
    color: palette.textSecondary,
    marginTop: 12,
    lineHeight: 20,
  },
});
