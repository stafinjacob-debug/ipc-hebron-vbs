import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AnnouncementFormFields,
  type AnnouncementAudience,
} from '@/components/AnnouncementFormFields';
import { PrimaryButton } from '@/components/ui';
import { palette } from '@/constants/theme';
import { ApiError, apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { canManageAnnouncements } from '@/lib/roles';

type Ann = {
  id: string;
  title: string;
  body: string;
  audience: string;
  pinned: boolean;
};

export default function EditAnnouncementScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token, seasonId, user, ready } = useAuth();
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<AnnouncementAudience>('STAFF');
  const [pinned, setPinned] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token || !seasonId || !id) return;
    setLoading(true);
    try {
      const res = await apiFetch<{ announcement: Ann }>(
        `/api/mobile/v1/seasons/${seasonId}/announcements/${id}`,
        { token },
      );
      const a = res.announcement;
      setTitle(a.title);
      setBody(a.body);
      setAudience(
        a.audience === 'VOLUNTEERS' || a.audience === 'ALL'
          ? a.audience
          : 'STAFF',
      );
      setPinned(a.pinned);
    } catch {
      Alert.alert('Not found', 'This announcement could not be loaded.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } finally {
      setLoading(false);
    }
  }, [token, seasonId, id, router]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!ready) {
    return null;
  }
  if (!canManageAnnouncements(user?.role)) {
    return <Redirect href="/(tabs)/announcements" />;
  }

  async function onSave() {
    if (!token || !seasonId || !id) return;
    const t = title.trim();
    const b = body.trim();
    if (!t || !b) {
      Alert.alert('Missing fields', 'Add a title and message.');
      return;
    }
    setSaving(true);
    try {
      await apiFetch(
        `/api/mobile/v1/seasons/${seasonId}/announcements/${id}`,
        {
          method: 'PATCH',
          token,
          body: JSON.stringify({
            title: t,
            body: b,
            audience,
            pinned,
          }),
        },
      );
      router.replace(`/announcement/${id}`);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Could not save';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={palette.accent} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { paddingBottom: insets.bottom + 16 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <AnnouncementFormFields
          title={title}
          setTitle={setTitle}
          body={body}
          setBody={setBody}
          audience={audience}
          setAudience={setAudience}
          pinned={pinned}
          setPinned={setPinned}
        />
        <PrimaryButton
          label="Save changes"
          loading={saving}
          onPress={onSave}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: palette.bg },
  scroll: { padding: 20 },
  center: { flex: 1, justifyContent: 'center', backgroundColor: palette.bg },
});
