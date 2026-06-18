import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { palette } from '@/constants/theme';
import { Card, SectionTitle } from '@/components/ui';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  canUseCheckInDesk,
  isAdminLikeRole,
  isSuperAdmin,
  isTeacherRole,
  roleLabel,
} from '@/lib/roles';
import type { CampDateOption } from '@/lib/badge-print';

type ClassSummary = {
  classId: string;
  className: string;
  room: string | null;
  enrolled: number;
  checkedIn: number;
  expected: number;
};

type Dashboard = {
  season: { id: string; name: string; year: number; isActive: boolean };
  attendance: {
    campDate: string;
    campDateLabel: string;
    todayCampDate?: string;
    multiDayCheckInEnabled: boolean;
    campDates?: CampDateOption[];
  } | null;
  kpis: {
    checkedIn: number;
    expected: number;
    remainingArrivals: number;
    classesActive: number;
    studentsWithAlerts: number;
  };
  classSummaries: ClassSummary[];
  recentCheckIns: Array<{
    registrationId: string;
    studentName: string;
    className: string | null;
    checkedInAt: string | null;
  }>;
};

export default function HomeScreen() {
  const router = useRouter();
  const { token, seasonId, user } = useAuth();
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const admin = isAdminLikeRole(user?.role);
  const superAdmin = isSuperAdmin(user?.role);
  const teacher = isTeacherRole(user?.role);
  const checkInDesk = canUseCheckInDesk(user?.role);
  const [campDate, setCampDate] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !seasonId) return;
    try {
      const query = campDate ? `?campDate=${encodeURIComponent(campDate)}` : '';
      const res = await apiFetch<Dashboard>(
        `/api/mobile/v1/seasons/${seasonId}/dashboard${query}`,
        { token },
      );
      setData(res);
      if (!campDate && res.attendance?.campDate) {
        setCampDate(res.attendance.campDate);
      }
    } catch {
      setData(null);
    }
  }, [token, seasonId, campDate]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await load();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const firstName = user?.name?.split(/\s+/)[0] ?? 'there';
  const dayLabel = data?.attendance?.campDateLabel ?? 'Today';
  const campDates = data?.attendance?.campDates ?? [];
  const selectedDay = campDates.find((d) => d.key === campDate);
  const isHistorical = Boolean(selectedDay?.isPast);
  const primaryClass =
    data?.classSummaries.length === 1 ? data.classSummaries[0]! : null;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text style={styles.greeting}>Hi, {firstName}</Text>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.seasonName}>
            {data?.season.name ?? 'VBS season'}
          </Text>
          {primaryClass ? (
            <Text style={styles.className}>{primaryClass.className}</Text>
          ) : null}
          <Text style={styles.dayLabel}>{dayLabel}</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{roleLabel(user?.role)}</Text>
        </View>
      </View>

      {superAdmin && campDates.length > 0 ? (
        <View style={styles.datePicker}>
          <Text style={styles.datePickerLabel}>Check-in date</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dateChipRow}
          >
            {campDates.map((day) => {
              const selected = campDate === day.key;
              return (
                <Pressable
                  key={day.key}
                  onPress={() => setCampDate(day.key)}
                  style={[
                    styles.dateChip,
                    selected && styles.dateChipOn,
                  ]}
                >
                  <Text
                    style={[
                      styles.dateChipText,
                      selected && styles.dateChipTextOn,
                    ]}
                  >
                    {day.label}
                    {day.isToday ? ' · Today' : day.isPast ? ' · Past' : ''}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {isHistorical ? (
            <Text style={styles.datePickerHint}>
              Viewing a past camp day — totals are read-only.
            </Text>
          ) : null}
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator size="large" color={palette.accent} />
      ) : data ? (
        <>
          <View style={[styles.kpiRow, !admin && styles.kpiRowLast]}>
            <Kpi
              label="Checked in"
              value={String(data.kpis.checkedIn)}
              tone="success"
            />
            <Kpi
              label="Expected"
              value={String(data.kpis.expected)}
              tone="neutral"
            />
          </View>

          {admin ? (
            <View style={styles.kpiRowSecondary}>
              <Kpi
                label="Classes"
                value={String(data.kpis.classesActive)}
                tone="neutral"
              />
              <Kpi
                label="Alert notes"
                value={String(data.kpis.studentsWithAlerts)}
                tone={
                  data.kpis.studentsWithAlerts > 0 ? 'warning' : 'neutral'
                }
              />
            </View>
          ) : null}

          {data.classSummaries.length > 0 ? (
            <>
              <SectionTitle>
                {data.classSummaries.length === 1
                  ? 'Your class'
                  : isHistorical
                    ? 'Classes that day'
                    : 'Classes today'}
              </SectionTitle>
              {data.classSummaries.map((c) => (
                <Pressable
                  key={c.classId}
                  onPress={() => router.push(`/class/${c.classId}`)}
                >
                  <Card style={styles.classCard}>
                    <Text style={styles.classCardName}>{c.className}</Text>
                    {c.room ? (
                      <Text style={styles.classCardMeta}>Room {c.room}</Text>
                    ) : null}
                    <Text style={styles.classCardCounts}>
                      {c.checkedIn} checked in · {c.expected} expected ·{' '}
                      {c.enrolled} enrolled
                    </Text>
                  </Card>
                </Pressable>
              ))}
            </>
          ) : null}

          <SectionTitle>Quick actions</SectionTitle>
          <View style={styles.actions}>
            {checkInDesk ? (
              <QuickAction
                label="Check-in & search"
                onPress={() => router.push('/(tabs)/check-in')}
              />
            ) : null}
            <QuickAction
              label={teacher ? 'My class' : 'Class rosters'}
              onPress={() => router.push('/(tabs)/classes')}
            />
            <QuickAction
              label="Announcements"
              onPress={() => router.push('/(tabs)/announcements')}
            />
          </View>

          <SectionTitle>Recent check-ins</SectionTitle>
          {data.recentCheckIns.length === 0 ? (
            <Text style={styles.muted}>No check-ins yet for {dayLabel.toLowerCase()}.</Text>
          ) : (
            data.recentCheckIns.map((r) => (
              <Pressable
                key={r.registrationId}
                onPress={() =>
                  router.push(`/student/${r.registrationId}`)
                }
              >
                <Card style={styles.activityCard}>
                  <Text style={styles.activityName}>{r.studentName}</Text>
                  <Text style={styles.activityClass}>
                    {r.className ?? 'Class TBD'}
                  </Text>
                </Card>
              </Pressable>
            ))
          )}
        </>
      ) : (
        <Text style={styles.err}>
          Could not load dashboard. Pull to refresh or check your connection.
        </Text>
      )}
    </ScrollView>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'success' | 'neutral' | 'warning';
}) {
  const border =
    tone === 'success'
      ? palette.success
      : tone === 'warning'
        ? palette.warning
        : palette.border;
  return (
    <View style={[styles.kpi, { borderLeftColor: border }]}>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function QuickAction({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.qa,
        pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
      ]}
    >
      <Text style={styles.qaText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  content: { padding: 20, paddingBottom: 40 },
  greeting: { fontSize: 28, fontWeight: '700', color: palette.text },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 6,
    marginBottom: 20,
  },
  seasonName: { fontSize: 16, color: palette.textSecondary },
  className: {
    fontSize: 22,
    fontWeight: '800',
    color: palette.text,
    marginTop: 4,
  },
  dayLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.accent,
    marginTop: 4,
  },
  badge: {
    backgroundColor: palette.accentMuted,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: { fontSize: 12, fontWeight: '700', color: palette.accent },
  datePicker: { marginBottom: 16 },
  datePickerLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.textSecondary,
    marginBottom: 8,
  },
  dateChipRow: { gap: 8, paddingRight: 4 },
  dateChip: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  dateChipOn: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  dateChipText: { fontSize: 14, fontWeight: '600', color: palette.text },
  dateChipTextOn: { color: '#fff' },
  datePickerHint: {
    fontSize: 13,
    color: palette.textSecondary,
    marginTop: 8,
  },
  kpiRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  kpiRowLast: { marginBottom: 24 },
  kpiRowSecondary: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  kpi: {
    flex: 1,
    backgroundColor: palette.surface,
    borderRadius: 14,
    padding: 14,
    borderLeftWidth: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  kpiValue: { fontSize: 26, fontWeight: '800', color: palette.text },
  kpiLabel: { fontSize: 13, color: palette.textSecondary, marginTop: 4 },
  classCard: { marginBottom: 10 },
  classCardName: { fontSize: 18, fontWeight: '700', color: palette.text },
  classCardMeta: { fontSize: 14, color: palette.textSecondary, marginTop: 2 },
  classCardCounts: {
    fontSize: 15,
    fontWeight: '600',
    color: palette.text,
    marginTop: 8,
  },
  actions: { gap: 10, marginBottom: 24 },
  qa: {
    backgroundColor: palette.accent,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    minHeight: 52,
    justifyContent: 'center',
  },
  qaText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  activityCard: { marginBottom: 10 },
  activityName: { fontSize: 16, fontWeight: '600', color: palette.text },
  activityClass: {
    fontSize: 15,
    fontWeight: '700',
    color: palette.accent,
    marginTop: 4,
  },
  muted: { fontSize: 14, color: palette.textSecondary, marginTop: 4 },
  err: { color: palette.danger, fontSize: 15 },
});
