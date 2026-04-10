import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { palette } from '@/constants/theme';
import { StatusChip } from '@/components/ui';
import { ApiError, apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { pushRecentRegistrationId } from '@/lib/recent-search';

type SearchRow = {
  registrationId: string;
  studentName: string;
  ageYears: number;
  className: string | null;
  room: string | null;
  registrationCode: string | null;
  checkedIn: boolean;
  guardianName: string;
  hasMedicalAlert: boolean;
};

export default function CheckInScreen() {
  const router = useRouter();
  const { token, seasonId } = useAuth();
  const [mode, setMode] = useState<'arrivals' | 'dismissal'>('arrivals');
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [results, setResults] = useState<SearchRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 320);
    return () => clearTimeout(t);
  }, [q]);

  const runSearch = useCallback(async () => {
    if (!token || !seasonId || debounced.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch<{ results: SearchRow[] }>(
        `/api/mobile/v1/seasons/${seasonId}/search?q=${encodeURIComponent(debounced)}`,
        { token },
      );
      setResults(res.results);
    } catch (e) {
      setResults([]);
      if (e instanceof ApiError && e.status !== 401) {
        /* silent */
      }
    } finally {
      setLoading(false);
    }
  }, [token, seasonId, debounced]);

  useEffect(() => {
    void runSearch();
  }, [runSearch]);

  async function openStudent(row: SearchRow) {
    await pushRecentRegistrationId(row.registrationId);
    router.push({
      pathname: '/student/[id]',
      params: {
        id: row.registrationId,
        mode: mode === 'dismissal' ? 'dismissal' : 'arrivals',
      },
    });
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.segment}>
        <Pressable
          onPress={() => setMode('arrivals')}
          style={[styles.segBtn, mode === 'arrivals' && styles.segBtnOn]}
        >
          <Text
            style={[
              styles.segLabel,
              mode === 'arrivals' && styles.segLabelOn,
            ]}
          >
            Arrivals
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setMode('dismissal')}
          style={[styles.segBtn, mode === 'dismissal' && styles.segBtnOn]}
        >
          <Text
            style={[
              styles.segLabel,
              mode === 'dismissal' && styles.segLabelOn,
            ]}
          >
            Dismissal
          </Text>
        </Pressable>
      </View>

      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder={
          mode === 'arrivals'
            ? 'Name, parent, code, or phone'
            : 'Find student to check out'
        }
        placeholderTextColor={palette.textSecondary}
        style={styles.search}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
      />

      {loading ? (
        <ActivityIndicator style={{ marginTop: 16 }} color={palette.accent} />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.registrationId}
          contentContainerStyle={{ paddingBottom: 120 }}
          ListEmptyComponent={
            debounced.length >= 2 ? (
              <Text style={styles.empty}>No matches</Text>
            ) : (
              <Text style={styles.hint}>
                Type at least 2 characters to search.
              </Text>
            )
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => void openStudent(item)}
              style={({ pressed }) => [
                styles.card,
                pressed && { opacity: 0.92 },
              ]}
            >
              <View style={styles.cardTop}>
                <Text style={styles.name}>{item.studentName}</Text>
                {item.hasMedicalAlert ? (
                  <StatusChip label="Alert" tone="warning" />
                ) : null}
              </View>
              <Text style={styles.meta}>
                {item.className ?? 'Class TBD'}
                {item.room ? ` · Room ${item.room}` : ''}
              </Text>
              <Text style={styles.meta}>
                {item.ageYears} yrs · {item.guardianName}
              </Text>
              <View style={styles.rowFooter}>
                <StatusChip
                  label={item.checkedIn ? 'Checked in' : 'Expected'}
                  tone={item.checkedIn ? 'success' : 'neutral'}
                />
                {item.registrationCode ? (
                  <Text style={styles.code}>{item.registrationCode}</Text>
                ) : null}
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: palette.bg, paddingHorizontal: 16 },
  segment: {
    flexDirection: 'row',
    backgroundColor: palette.expectedBg,
    borderRadius: 12,
    padding: 4,
    marginTop: 8,
    marginBottom: 12,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  segBtnOn: { backgroundColor: palette.surface },
  segLabel: { fontSize: 15, fontWeight: '600', color: palette.textSecondary },
  segLabelOn: { color: palette.text },
  search: {
    backgroundColor: palette.surface,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 18,
    color: palette.text,
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: 14,
    padding: 16,
    marginTop: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  name: { fontSize: 18, fontWeight: '700', color: palette.text, flex: 1 },
  meta: { fontSize: 14, color: palette.textSecondary, marginTop: 4 },
  rowFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  code: { fontSize: 12, color: palette.textSecondary, fontWeight: '600' },
  empty: { textAlign: 'center', marginTop: 24, color: palette.textSecondary },
  hint: { textAlign: 'center', marginTop: 24, color: palette.textSecondary },
});
