import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { palette } from '@/constants/theme';
import { Card, PrimaryButton, StatusChip } from '@/components/ui';
import { ApiError, apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

type Detail = {
  registration: {
    id: string;
    status: string;
    checkedIn: boolean;
    checkedInAt: string | null;
    registrationCode: string | null;
    notes: string | null;
  };
  student: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    ageYears: number;
    allergiesNotes: string | null;
    hasMedicalAlert: boolean;
  };
  guardian: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
  };
  class: { id: string; name: string; room: string | null } | null;
  siblings: Array<{ registrationId: string; name: string; className: string | null }>;
};

export default function StudentDetailScreen() {
  const { id, mode } = useLocalSearchParams<{ id: string; mode?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token, seasonId } = useAuth();
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const dismissal = mode === 'dismissal';

  const load = useCallback(async () => {
    if (!token || !seasonId || !id) return;
    setLoading(true);
    try {
      const res = await apiFetch<Detail>(
        `/api/mobile/v1/seasons/${seasonId}/registrations/${id}`,
        { token },
      );
      setData(res);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [token, seasonId, id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patchAttendance(checkedIn: boolean) {
    if (!token || !seasonId || !id) return;
    setActing(true);
    try {
      await apiFetch(
        `/api/mobile/v1/seasons/${seasonId}/registrations/${id}/attendance`,
        {
          method: 'PATCH',
          token,
          body: JSON.stringify({ checkedIn }),
        },
      );
      await load();
      Alert.alert(
        checkedIn ? 'Checked in' : 'Checked out',
        checkedIn
          ? 'Student is marked present.'
          : 'Student is no longer marked in the building.',
      );
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Action failed';
      Alert.alert('Could not update', msg);
    } finally {
      setActing(false);
    }
  }

  function onPrimaryPress() {
    if (!data) return;
    if (dismissal) {
      if (!data.registration.checkedIn) {
        Alert.alert(
          'Not checked in',
          'This student is not marked as checked in.',
        );
        return;
      }
      Alert.alert(
        'Confirm dismissal',
        `Authorized pickup: ${data.guardian.firstName} ${data.guardian.lastName}. Check out this student?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Check out',
            style: 'destructive',
            onPress: () => void patchAttendance(false),
          },
        ],
      );
      return;
    }
    if (data.registration.checkedIn) {
      Alert.alert('Already checked in', 'Use Dismissal tab to check out.');
      return;
    }
    void patchAttendance(true);
  }

  if (loading || !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={palette.accent} />
      </View>
    );
  }

  const fullName = `${data.student.firstName} ${data.student.lastName}`;
  const primaryLabel = dismissal
    ? data.registration.checkedIn
      ? 'Check out'
      : 'Not checked in yet'
    : data.registration.checkedIn
      ? 'Already checked in'
      : 'Check in';

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{fullName}</Text>
        <View style={styles.chips}>
          <StatusChip
            label={data.registration.checkedIn ? 'Checked in' : 'Expected'}
            tone={data.registration.checkedIn ? 'success' : 'neutral'}
          />
          {data.student.hasMedicalAlert ? (
            <StatusChip label="Medical / allergy" tone="warning" />
          ) : null}
        </View>

        <Card style={styles.card}>
          <Text style={styles.section}>Class & room</Text>
          <Text style={styles.body}>
            {data.class?.name ?? 'Not assigned'}
            {data.class?.room ? ` · Room ${data.class.room}` : ''}
          </Text>
        </Card>

        {data.student.allergiesNotes ? (
          <Card style={styles.alertCardWrap}>
            <Text style={styles.alertTitle}>Allergies / medical notes</Text>
            <Text style={styles.body}>{data.student.allergiesNotes}</Text>
          </Card>
        ) : null}

        <Card style={styles.card}>
          <Text style={styles.section}>Guardian</Text>
          <Text style={styles.body}>
            {data.guardian.firstName} {data.guardian.lastName}
          </Text>
          {data.guardian.phone ? (
            <Text style={styles.body}>{data.guardian.phone}</Text>
          ) : null}
          {data.guardian.email ? (
            <Text style={styles.muted}>{data.guardian.email}</Text>
          ) : null}
          <Text style={styles.pickupHint}>
            Pickup authorization follows guardian on file (MVP).
          </Text>
        </Card>

        {data.registration.registrationCode ? (
          <Text style={styles.muted}>
            Code: {data.registration.registrationCode}
          </Text>
        ) : null}

        {data.siblings.length > 0 ? (
          <Card style={styles.card}>
            <Text style={styles.section}>Family / siblings (season)</Text>
            {data.siblings.map((s) => (
              <Pressable
                key={s.registrationId}
                onPress={() =>
                  router.replace({
                    pathname: '/student/[id]',
                    params: { id: s.registrationId, mode },
                  })
                }
              >
                <Text style={styles.body}>
                  {s.name}
                  {s.className ? ` · ${s.className}` : ''}
                </Text>
              </Pressable>
            ))}
          </Card>
        ) : null}
      </ScrollView>

      <View
        style={[
          styles.footer,
          { paddingBottom: Math.max(insets.bottom, 16) },
        ]}
      >
        {data.class?.id ? (
          <Text
            style={styles.classLink}
            onPress={() => router.push(`/class/${data.class!.id}`)}
          >
            View class roster
          </Text>
        ) : null}
        <PrimaryButton
          label={primaryLabel}
          loading={acting}
          disabled={
            (!dismissal && data.registration.checkedIn) ||
            primaryLabel === 'Already checked in' ||
            (dismissal && !data.registration.checkedIn)
          }
          onPress={onPrimaryPress}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: palette.bg },
  center: { flex: 1, justifyContent: 'center', backgroundColor: palette.bg },
  scroll: { padding: 20, paddingBottom: 120 },
  title: { fontSize: 26, fontWeight: '800', color: palette.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  card: { marginTop: 14 },
  alertCardWrap: {
    marginTop: 14,
    borderColor: palette.warning,
    borderWidth: 1,
    backgroundColor: palette.warningBg,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: palette.warning,
    marginBottom: 6,
  },
  section: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  body: { fontSize: 16, color: palette.text, lineHeight: 22 },
  muted: { fontSize: 14, color: palette.textSecondary, marginTop: 8 },
  pickupHint: {
    marginTop: 10,
    fontSize: 13,
    color: palette.textSecondary,
    fontStyle: 'italic',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: palette.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  classLink: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.accent,
    textAlign: 'center',
    marginBottom: 10,
  },
});
