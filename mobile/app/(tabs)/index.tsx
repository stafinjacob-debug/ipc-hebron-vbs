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
import { ApiError, apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { isAdminLikeRole, roleLabel } from '@/lib/roles';

type Dashboard = {
  season: { id: string; name: string; year: number; isActive: boolean };
  kpis: {
    checkedIn: number;
    remainingArrivals: number;
    classesActive: number;
    studentsWithAlerts: number;
  };
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

  const load = useCallback(async () => {
    if (!token || !seasonId) return;
    try {
      const res = await apiFetch<Dashboard>(
        `/api/mobile/v1/seasons/${seasonId}/dashboard`,
        { token },
      );
      setData(res);
    } catch {
      setData(null);
    }
  }, [token, seasonId]);

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
        <Text style={styles.seasonName}>
          {data?.season.name ?? 'VBS season'}
        </Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{roleLabel(user?.role)}</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={palette.accent} />
      ) : data ? (
        <>
          {admin ? (
            <View style={styles.kpiGrid}>
              <Kpi
                label="Checked in"
                value={String(data.kpis.checkedIn)}
                tone="success"
              />
              <Kpi
                label="Still expected"
                value={String(data.kpis.remainingArrivals)}
                tone="neutral"
              />
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
          ) : (
            <View style={styles.kpiRowVolunteer}>
              <Kpi
                label="Checked in"
                value={String(data.kpis.checkedIn)}
                tone="success"
              />
              <Kpi
                label="Expected"
                value={String(data.kpis.remainingArrivals)}
                tone="neutral"
              />
            </View>
          )}

          <SectionTitle>Quick actions</SectionTitle>
          <View style={styles.actions}>
            <QuickAction
              label="Check-in & search"
              onPress={() => router.push('/(tabs)/check-in')}
            />
            <QuickAction
              label="Class rosters"
              onPress={() => router.push('/(tabs)/classes')}
            />
            <QuickAction
              label="Announcements"
              onPress={() => router.push('/(tabs)/announcements')}
            />
          </View>

          <SectionTitle>Recent check-ins</SectionTitle>
          {data.recentCheckIns.length === 0 ? (
            <Text style={styles.muted}>No check-ins yet today.</Text>
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
                  <Text style={styles.muted}>
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
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
    marginBottom: 20,
  },
  seasonName: { fontSize: 16, color: palette.textSecondary, flex: 1 },
  badge: {
    backgroundColor: palette.accentMuted,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: { fontSize: 12, fontWeight: '700', color: palette.accent },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  kpiRowVolunteer: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  kpi: {
    flexGrow: 1,
    minWidth: '44%',
    backgroundColor: palette.surface,
    borderRadius: 14,
    padding: 14,
    borderLeftWidth: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  kpiValue: { fontSize: 26, fontWeight: '800', color: palette.text },
  kpiLabel: { fontSize: 13, color: palette.textSecondary, marginTop: 4 },
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
  muted: { fontSize: 14, color: palette.textSecondary, marginTop: 4 },
  err: { color: palette.danger, fontSize: 15 },
});
