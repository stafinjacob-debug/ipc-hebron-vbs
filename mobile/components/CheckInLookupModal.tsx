import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { palette } from '@/constants/theme';
import { PrimaryButton, SecondaryButton, StatusChip } from '@/components/ui';

export type CheckInLookupMatch = {
  id: string;
  studentName: string;
  className: string;
  checkedIn: boolean;
  registrationNumber: string | null;
  submissionCode: string | null;
  guardianName: string | null;
  dateOfBirth: string | null;
  allergiesNotes: string | null;
  registrationStatus: string;
  checkInBlocked?: boolean;
  checkInBlockMessage?: string | null;
};

type Props = {
  visible: boolean;
  matches: CheckInLookupMatch[];
  selectedId: string | null;
  pendingId: string | null;
  printingId: string | null;
  badgePrintingEnabled: boolean;
  checkInDisabled?: boolean;
  dismissalMode?: boolean;
  onClose: () => void;
  onSelect: (match: CheckInLookupMatch) => void;
  onCheckIn: (match: CheckInLookupMatch) => void;
  onPrintBadge: (match: CheckInLookupMatch) => void;
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

export function CheckInLookupModal({
  visible,
  matches,
  selectedId,
  pendingId,
  printingId,
  badgePrintingEnabled,
  checkInDisabled = false,
  dismissalMode = false,
  onClose,
  onSelect,
  onCheckIn,
  onPrintBadge,
}: Props) {
  const insets = useSafeAreaInsets();
  if (!visible || matches.length === 0) return null;

  const active =
    matches.find((m) => m.id === selectedId) ??
    (matches.length === 1 ? matches[0]! : null);
  const pickingMultiple = matches.length > 1 && !active;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
        >
          <Text style={styles.heading}>Registration found</Text>
          <Text style={styles.subheading}>
            {pickingMultiple
              ? 'Multiple children match that code. Select one to continue.'
              : 'Review the details, then check in when ready.'}
          </Text>

          <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 8 }}>
            {pickingMultiple ? (
              matches.map((match) => (
                <Pressable
                  key={match.id}
                  onPress={() => onSelect(match)}
                  style={({ pressed }) => [
                    styles.pickRow,
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <Text style={styles.pickName}>{match.studentName}</Text>
                  <Text style={styles.pickMeta}>
                    {match.className}
                    {match.registrationNumber
                      ? ` · ${match.registrationNumber}`
                      : ''}
                  </Text>
                </Pressable>
              ))
            ) : active ? (
              <>
                <Text style={styles.studentName}>{active.studentName}</Text>
                <View style={styles.chips}>
                  <StatusChip
                    label={active.checkedIn ? 'Checked in' : 'Expected'}
                    tone={active.checkedIn ? 'success' : 'neutral'}
                  />
                  {active.allergiesNotes ? (
                    <StatusChip label="Medical / allergy" tone="warning" />
                  ) : null}
                </View>
                <DetailRow label="Class" value={active.className} />
                {active.registrationNumber ? (
                  <DetailRow
                    label="Registration #"
                    value={active.registrationNumber}
                  />
                ) : null}
                {active.submissionCode ? (
                  <DetailRow label="Family code" value={active.submissionCode} />
                ) : null}
                {active.guardianName ? (
                  <DetailRow label="Guardian" value={active.guardianName} />
                ) : null}
                {active.dateOfBirth ? (
                  <DetailRow label="Date of birth" value={active.dateOfBirth} />
                ) : null}
                {active.allergiesNotes ? (
                  <View style={styles.alertBox}>
                    <Text style={styles.alertTitle}>Allergies / medical</Text>
                    <Text style={styles.alertBody}>{active.allergiesNotes}</Text>
                  </View>
                ) : null}
                {active.checkInBlocked && !active.checkedIn && active.checkInBlockMessage ? (
                  <View style={styles.blockBox}>
                    <Text style={styles.blockTitle}>Check-in blocked</Text>
                    <Text style={styles.blockBody}>{active.checkInBlockMessage}</Text>
                  </View>
                ) : null}
                <DetailRow
                  label="Registration status"
                  value={active.registrationStatus}
                />
              </>
            ) : null}
          </ScrollView>

          {active ? (
            <View style={styles.actions}>
              {badgePrintingEnabled ? (
                <SecondaryButton
                  label={printingId === active.id ? 'Opening print…' : 'Print badge'}
                  onPress={() => onPrintBadge(active)}
                />
              ) : null}
              <SecondaryButton label="Close" onPress={onClose} />
              <PrimaryButton
                label={
                  pendingId === active.id
                    ? 'Updating…'
                    : active.checkedIn
                      ? dismissalMode
                        ? 'Check out'
                        : 'Undo check-in'
                      : dismissalMode
                        ? 'Not checked in'
                        : 'Check in'
                }
                disabled={
                  checkInDisabled ||
                  Boolean(active.checkInBlocked && !active.checkedIn) ||
                  Boolean(dismissalMode && !active.checkedIn)
                }
                loading={pendingId === active.id}
                onPress={() => onCheckIn(active)}
              />
            </View>
          ) : (
            <SecondaryButton label="Close" onPress={onClose} />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '88%',
    backgroundColor: palette.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  heading: {
    fontSize: 20,
    fontWeight: '800',
    color: palette.text,
  },
  subheading: {
    marginTop: 6,
    fontSize: 14,
    color: palette.textSecondary,
    lineHeight: 20,
  },
  scroll: { marginTop: 16 },
  studentName: {
    fontSize: 26,
    fontWeight: '800',
    color: palette.text,
    marginBottom: 10,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  detailLabel: { fontSize: 14, color: palette.textSecondary },
  detailValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: palette.text,
    textAlign: 'right',
  },
  alertBox: {
    marginTop: 8,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: palette.warningBg,
    borderWidth: 1,
    borderColor: palette.warning,
  },
  alertTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: palette.warning,
    marginBottom: 4,
  },
  alertBody: { fontSize: 15, color: palette.text, lineHeight: 21 },
  blockBox: {
    marginTop: 8,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: palette.warningBg,
    borderWidth: 1,
    borderColor: palette.warning,
  },
  blockTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: palette.warning,
    marginBottom: 4,
  },
  blockBody: { fontSize: 15, color: palette.text, lineHeight: 21 },
  pickRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    backgroundColor: palette.bg,
  },
  pickName: { fontSize: 17, fontWeight: '700', color: palette.text },
  pickMeta: { marginTop: 4, fontSize: 13, color: palette.textSecondary },
  actions: { gap: 10, marginTop: 12 },
});
