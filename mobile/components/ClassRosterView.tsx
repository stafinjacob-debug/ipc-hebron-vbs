import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { palette } from '@/constants/theme';
import { StatusChip } from '@/components/ui';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { isTeacherRole } from '@/lib/roles';

type RosterRow = {
  registrationId: string;
  studentName: string;
  hasMedicalAlert: boolean;
  checkedIn: boolean;
  checkedInAt: string | null;
  status: 'expected' | 'checked_in';
};

type AttendanceMeta = {
  campDate: string;
  todayCampDate: string;
  multiDayCheckInEnabled: boolean;
  campDates: Array<{ key: string; label: string }>;
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
  attendance: AttendanceMeta | null;
};

export function ClassRosterView({ classId }: { classId: string }) {
  const router = useRouter();
  const { token, seasonId, user } = useAuth();
  const [data, setData] = useState<ClassPayload | null>(null);
  const [campDate, setCampDate] = useState<string | null>(null);
  const readOnly = isTeacherRole(user?.role);

  const load = useCallback(async () => {
    if (!token || !seasonId || !classId) return;
    const campDateQuery = campDate ? `?campDate=${encodeURIComponent(campDate)}` : '';
    const res = await apiFetch<ClassPayload>(
      `/api/mobile/v1/seasons/${seasonId}/classes/${classId}${campDateQuery}`,
      { token },
    );
    setData(res);
    if (!campDate && res.attendance?.campDate) {
      setCampDate(res.attendance.campDate);
    }
  }, [token, seasonId, classId, campDate]);

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
  const multiDay =
    data.attendance?.multiDayCheckInEnabled &&
    (data.attendance?.campDates.length ?? 0) > 0;
  const dayLabel =
    data.attendance?.campDates.find(
      (d) => d.key === (campDate ?? data.attendance?.campDate),
    )?.label ?? 'Today';

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
            {data.counts.checkedIn}/{data.counts.enrolled} checked in · {dayLabel}{' '}
            · cap {data.class.capacity}
          </Text>
          {data.leaders.length > 0 ? (
            <Text style={styles.meta}>
              Leaders: {data.leaders.map((l) => l.name).join(', ')}
            </Text>
          ) : null}
          {multiDay ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.dayRow}
            >
              {(data.attendance?.campDates ?? []).map((day) => {
                const selected =
                  (campDate ?? data.attendance?.campDate) === day.key;
                return (
                  <Pressable
                    key={day.key}
                    onPress={() => setCampDate(day.key)}
                    style={[styles.dayChip, selected && styles.dayChipSelected]}
                  >
                    <Text
                      style={[
                        styles.dayChipText,
                        selected && styles.dayChipTextSelected,
                      ]}
                    >
                      {day.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}
          <Text style={styles.section}>Not checked in ({missing.length})</Text>
          {missing.length === 0 ? (
            <Text style={styles.muted}>Everyone is checked in for this day.</Text>
          ) : (
            missing.map((m) => (
              <Text key={m.registrationId} style={styles.missingName}>
                {m.studentName}
              </Text>
            ))
          )}
          <Text style={[styles.section, { marginTop: 16 }]}>Roster</Text>
          {readOnly ? (
            <Text style={styles.muted}>
              Tap a student to view details (read-only).
            </Text>
          ) : null}
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() => {
            const campDateParam = campDate ?? data.attendance?.campDate;
            const qs = campDateParam
              ? `?campDate=${encodeURIComponent(campDateParam)}`
              : '';
            router.push(`/student/${item.registrationId}${qs}`);
          }}
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
  header: { marginBottom: 8, paddingTop: 8 },
  title: { fontSize: 24, fontWeight: '800', color: palette.text },
  meta: { fontSize: 14, color: palette.textSecondary, marginTop: 4 },
  dayRow: { marginTop: 12, marginBottom: 4 },
  dayChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    marginRight: 8,
    backgroundColor: palette.surface,
  },
  dayChipSelected: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  dayChipText: { fontSize: 13, fontWeight: '600', color: palette.textSecondary },
  dayChipTextSelected: { color: '#fff' },
  section: {
    fontSize: 12,
    fontWeight: '800',
    color: palette.textSecondary,
    textTransform: 'uppercase',
    marginTop: 12,
  },
  muted: { fontSize: 14, color: palette.textSecondary },
  missingName: {
    fontSize: 15,
    fontWeight: '600',
    color: palette.text,
    marginTop: 4,
  },
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
