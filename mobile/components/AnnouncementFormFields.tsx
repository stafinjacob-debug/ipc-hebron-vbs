import React from 'react';
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { palette } from '@/constants/theme';
import { FieldLabel } from '@/components/ui';

export type AnnouncementAudience = 'STAFF' | 'VOLUNTEERS' | 'ALL';

const AUDIENCES: { value: AnnouncementAudience; label: string }[] = [
  { value: 'STAFF', label: 'Staff' },
  { value: 'VOLUNTEERS', label: 'Volunteers' },
  { value: 'ALL', label: 'Everyone' },
];

export function AnnouncementFormFields({
  title,
  setTitle,
  body,
  setBody,
  audience,
  setAudience,
  pinned,
  setPinned,
}: {
  title: string;
  setTitle: (s: string) => void;
  body: string;
  setBody: (s: string) => void;
  audience: AnnouncementAudience;
  setAudience: (a: AnnouncementAudience) => void;
  pinned: boolean;
  setPinned: (p: boolean) => void;
}) {
  return (
    <View style={styles.wrap}>
      <FieldLabel>Title</FieldLabel>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Check-in opens at 8:30"
        placeholderTextColor={palette.textSecondary}
        style={styles.input}
      />
      <FieldLabel>Message</FieldLabel>
      <TextInput
        value={body}
        onChangeText={setBody}
        placeholder="Details volunteers should know…"
        placeholderTextColor={palette.textSecondary}
        style={[styles.input, styles.bodyInput]}
        multiline
        textAlignVertical="top"
      />
      <FieldLabel>Audience</FieldLabel>
      <View style={styles.seg}>
        {AUDIENCES.map(({ value, label }) => (
          <Pressable
            key={value}
            onPress={() => setAudience(value)}
            style={[
              styles.segBtn,
              audience === value && styles.segBtnOn,
            ]}
          >
            <Text
              style={[
                styles.segText,
                audience === value && styles.segTextOn,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.switchRow}>
        <View style={{ flex: 1 }}>
          <FieldLabel>Pin to top</FieldLabel>
          <Text style={styles.hint}>
            Pinned posts appear first for the season.
          </Text>
        </View>
        <Switch
          value={pinned}
          onValueChange={setPinned}
          trackColor={{ true: palette.accentMuted, false: palette.expectedBg }}
          thumbColor={pinned ? palette.accent : '#f4f4f5'}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 2 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 17,
    backgroundColor: palette.surface,
    color: palette.text,
    marginBottom: 14,
  },
  bodyInput: { minHeight: 140, marginBottom: 14 },
  seg: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  segBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: palette.expectedBg,
  },
  segBtnOn: { backgroundColor: palette.accent },
  segText: { fontSize: 14, fontWeight: '600', color: palette.textSecondary },
  segTextOn: { color: '#fff' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  hint: { fontSize: 13, color: palette.textSecondary, marginTop: 2 },
});
