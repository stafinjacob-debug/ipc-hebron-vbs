import { Redirect, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AnnouncementFormFields,
  type AnnouncementAudience,
} from '@/components/AnnouncementFormFields';
import { PrimaryButton } from '@/components/ui';
import { ApiError, apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { canManageAnnouncements } from '@/lib/roles';

export default function NewAnnouncementScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token, seasonId, user, ready } = useAuth();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<AnnouncementAudience>('STAFF');
  const [pinned, setPinned] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!ready) {
    return null;
  }
  if (!canManageAnnouncements(user?.role)) {
    return <Redirect href="/(tabs)/announcements" />;
  }

  async function onSave() {
    if (!token || !seasonId) return;
    const t = title.trim();
    const b = body.trim();
    if (!t || !b) {
      Alert.alert('Missing fields', 'Add a title and message.');
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch<{ announcement: { id: string } }>(
        `/api/mobile/v1/seasons/${seasonId}/announcements`,
        {
          method: 'POST',
          token,
          body: JSON.stringify({
            title: t,
            body: b,
            audience,
            pinned,
          }),
        },
      );
      router.replace(`/announcement/${res.announcement.id}`);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Could not save';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
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
          label="Post announcement"
          loading={saving}
          onPress={onSave}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F2F4F7' },
  scroll: { padding: 20 },
});
