import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { palette } from '@/constants/theme';
import { StatusChip } from '@/components/ui';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

type RosterRow = {
  registrationId: string;
  studentName: string;
  hasMedicalAlert: boolean;
  checkedIn: boolean;
  checkedInAt: string | null;
  status: 'expected' | 'checked_in';
};

type ClassPayload = {
  class: {
    id: string;
    name: string;
    ageMin: number;
    ageMax: number;
    gradeLabel: string | null;
    room: string | null;
    capacity: number;
  };
  leaders: Array<{ userId: string; name: string; role: string }>;
  roster: RosterRow[];
  counts: { enrolled: number; checkedIn: number };
};

export default function ClassDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { token, seasonId } = useAuth();
  const [data, setData] = useState<ClassPayload | null>(null);

  const load = useCallback(async () => {
    if (!token || !seasonId || !id) return;
    const res = await apiFetch<ClassPayload>(
      `/api/mobile/v1/seasons/${seasonId}/classes/${id}`,
      { token },
    );
    setData(res);
  }, [token, seasonId, id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={palette.accent} />
      </View>
    );
  }

  const missing = data.roster.filter((r) => !r.checkedIn);

  return (
    <FlatList
      data={data.roster}
      keyExtractor={(r) => r.registrationId}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.title}>{data.class.name}</Text>
          <Text style={styles.meta}>
            Ages {data.class.ageMin}–{data.class.ageMax}
            {data.class.room ? ` · Room ${data.class.room}` : ''}
          </Text>
          <Text style={styles.meta}>
            {data.counts.checkedIn}/{data.counts.enrolled} checked in · cap{' '}
            {data.class.capacity}
          </Text>
          {data.leaders.length > 0 ? (
            <Text style={styles.meta}>
              Leaders:{' '}
              {data.leaders.map((l) => l.name).join(', ')}
            </Text>
          ) : null}
          <Text style={styles.section}>Missing ({missing.length})</Text>
          {missing.length === 0 ? (
            <Text style={styles.muted}>Everyone is checked in.</Text>
          ) : (
            missing.map((m) => (
              <Text key={m.registrationId} style={styles.missingName}>
                {m.studentName}
              </Text>
            ))
          )}
          <Text style={[styles.section, { marginTop: 16 }]}>Roster</Text>
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() =>
            router.push(`/student/${item.registrationId}`)
          }
          style={styles.row}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.studentName}>{item.studentName}</Text>
            {item.hasMedicalAlert ? (
              <Text style={styles.alertIcon}>Medical note on file</Text>
            ) : null}
          </View>
          <StatusChip
            label={item.checkedIn ? 'In' : 'Expected'}
            tone={item.checkedIn ? 'success' : 'neutral'}
          />
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', backgroundColor: palette.bg },
  list: { paddingHorizontal: 16, paddingBottom: 40 },
  header: { marginBottom: 8 },
  title: { fontSize: 24, fontWeight: '800', color: palette.text },
  meta: { fontSize: 14, color: palette.textSecondary, marginTop: 4 },
  section: {
    fontSize: 12,
    fontWeight: '800',
    color: palette.textSecondary,
    textTransform: 'uppercase',
    marginTop: 12,
  },
  muted: { fontSize: 14, color: palette.textSecondary },
  missingName: { fontSize: 15, fontWeight: '600', color: palette.text, marginTop: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  studentName: { fontSize: 16, fontWeight: '600', color: palette.text },
  alertIcon: { fontSize: 13, color: palette.warning, marginTop: 4 },
});
