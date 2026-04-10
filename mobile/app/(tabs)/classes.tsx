import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
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

type ClassRow = {
  id: string;
  name: string;
  ageMin: number;
  ageMax: number;
  gradeLabel: string | null;
  room: string | null;
  capacity: number;
  enrolled: number;
  checkedIn: number;
  leaderName: string | null;
};

export default function ClassesScreen() {
  const router = useRouter();
  const { token, seasonId } = useAuth();
  const [classes, setClasses] = useState<ClassRow[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token || !seasonId) return;
    const res = await apiFetch<{ classes: ClassRow[] }>(
      `/api/mobile/v1/seasons/${seasonId}/classes`,
      { token },
    );
    setClasses(res.classes);
  }, [token, seasonId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (classes === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={palette.accent} />
      </View>
    );
  }

  return (
    <FlatList
      data={classes}
      keyExtractor={(c) => c.id}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      ListEmptyComponent={
        <Text style={styles.empty}>No active classes this season.</Text>
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() => router.push(`/class/${item.id}`)}
          style={({ pressed }) => [
            styles.card,
            pressed && { opacity: 0.92 },
          ]}
        >
          <Text style={styles.title}>{item.name}</Text>
          <Text style={styles.meta}>
            Ages {item.ageMin}–{item.ageMax}
            {item.gradeLabel ? ` · ${item.gradeLabel}` : ''}
          </Text>
          <Text style={styles.meta}>
            {item.room ? `Room ${item.room}` : 'Room TBD'}
            {item.leaderName ? ` · ${item.leaderName}` : ''}
          </Text>
          <View style={styles.footer}>
            <Text style={styles.counts}>
              {item.checkedIn}/{item.enrolled} in · cap {item.capacity}
            </Text>
            <View
              style={[
                styles.live,
                item.checkedIn >= item.enrolled && item.enrolled > 0
                  ? { backgroundColor: palette.successBg }
                  : null,
              ]}
            >
              <Text style={styles.liveText}>Roster</Text>
            </View>
          </View>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', backgroundColor: palette.bg },
  list: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: palette.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  title: { fontSize: 18, fontWeight: '700', color: palette.text },
  meta: { fontSize: 14, color: palette.textSecondary, marginTop: 4 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  counts: { fontSize: 14, fontWeight: '600', color: palette.text },
  live: {
    backgroundColor: palette.expectedBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  liveText: { fontSize: 12, fontWeight: '700', color: palette.textSecondary },
  empty: { textAlign: 'center', marginTop: 40, color: palette.textSecondary },
});
