import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { palette } from '@/constants/theme';
import { ApiError, apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

type Season = {
  id: string;
  name: string;
  year: number;
  isActive: boolean;
};

export default function SelectSeasonScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token, setSeasonId } = useAuth();
  const [seasons, setSeasons] = useState<Season[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiFetch<{ seasons: Season[] }>(
        '/api/mobile/v1/seasons',
        { token },
      );
      setSeasons(res.seasons);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load seasons');
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function pick(id: string) {
    await setSeasonId(id);
    router.replace('/(tabs)');
  }

  if (!token) {
    return null;
  }

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 16 }]}>
      <Text style={styles.title}>Choose VBS season</Text>
      <Text style={styles.sub}>
        All check-in and rosters use the season you select here.
      </Text>
      {error ? <Text style={styles.err}>{error}</Text> : null}
      {seasons === null ? (
        <ActivityIndicator size="large" color={palette.accent} />
      ) : (
        <FlatList
          data={seasons}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => void pick(item.id)}
              style={({ pressed }) => [
                styles.row,
                pressed && { opacity: 0.85 },
              ]}
            >
              <View>
                <Text style={styles.rowTitle}>{item.name}</Text>
                <Text style={styles.rowMeta}>{item.year}</Text>
              </View>
              {item.isActive ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>Active</Text>
                </View>
              ) : null}
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: palette.bg,
    paddingHorizontal: 20,
  },
  title: { fontSize: 24, fontWeight: '700', color: palette.text },
  sub: {
    marginTop: 8,
    marginBottom: 20,
    fontSize: 15,
    color: palette.textSecondary,
    lineHeight: 21,
  },
  err: { color: palette.danger, marginBottom: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: palette.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  rowTitle: { fontSize: 17, fontWeight: '600', color: palette.text },
  rowMeta: { fontSize: 14, color: palette.textSecondary, marginTop: 2 },
  badge: {
    backgroundColor: palette.successBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: { fontSize: 12, fontWeight: '600', color: palette.success },
});
