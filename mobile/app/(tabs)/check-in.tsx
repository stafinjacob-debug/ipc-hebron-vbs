import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  CheckInLookupModal,
  type CheckInLookupMatch,
} from '@/components/CheckInLookupModal';
import { CheckInQrScanner } from '@/components/CheckInQrScanner';
import { PinEntryModal } from '@/components/PinEntryModal';
import { palette } from '@/constants/theme';
import { ApiError, apiFetch } from '@/lib/api';
import {
  badgePrintErrorMessage,
  fetchCheckInDeskSettings,
  getActivePrintMode,
  printBadgeByRegistrationId,
  printBadgeInBackground,
  type CampDateOption,
  type CheckInDeskSettings,
} from '@/lib/badge-print';
import { useAuth } from '@/lib/auth-context';

export default function CheckInScreen() {
  const { token, seasonId } = useAuth();

  const [mode, setMode] = useState<'arrivals' | 'dismissal'>('arrivals');
  const [lookupInput, setLookupInput] = useState('');
  const [lookupPending, setLookupPending] = useState(false);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const [lookupMatches, setLookupMatches] = useState<CheckInLookupMatch[]>([]);
  const [lookupModalOpen, setLookupModalOpen] = useState(false);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinPendingMatch, setPinPendingMatch] = useState<CheckInLookupMatch | null>(null);
  const [deskSettings, setDeskSettings] = useState<CheckInDeskSettings>({
    badgePrintingEnabled: false,
    autoPrintOnCheckIn: false,
    multiDayCheckInEnabled: false,
    dismissalTrackingEnabled: false,
    undoPinRequired: false,
    campDates: [],
    todayCampDate: null,
    selectedCampDate: null,
  });
  const [campDate, setCampDate] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [printMode, setPrintMode] = useState<'brother' | 'airprint' | 'none'>('none');

  const dismissal =
    deskSettings.dismissalTrackingEnabled && mode === 'dismissal';

  useFocusEffect(
    useCallback(() => {
      void getActivePrintMode().then(setPrintMode);
    }, []),
  );

  useEffect(() => {
    if (!token || !seasonId) return;
    void fetchCheckInDeskSettings(token, seasonId, campDate)
      .then((settings) => {
        setDeskSettings(settings);
        if (!campDate && settings.selectedCampDate) {
          setCampDate(settings.selectedCampDate);
        }
      })
      .catch(() => {
        setDeskSettings({
          badgePrintingEnabled: false,
          autoPrintOnCheckIn: false,
          multiDayCheckInEnabled: false,
          dismissalTrackingEnabled: false,
          undoPinRequired: false,
          campDates: [],
          todayCampDate: null,
          selectedCampDate: null,
        });
      });
  }, [token, seasonId, campDate]);

  useEffect(() => {
    if (!deskSettings.dismissalTrackingEnabled && mode === 'dismissal') {
      setMode('arrivals');
    }
  }, [deskSettings.dismissalTrackingEnabled, mode]);

  const selectedCampDay = deskSettings.campDates.find((d) => d.key === campDate);
  const campDateLocked = Boolean(selectedCampDay?.isPast);

  useEffect(() => {
    if (!successMessage) return;
    const t = setTimeout(() => setSuccessMessage(null), 2800);
    return () => clearTimeout(t);
  }, [successMessage]);

  function closeLookupModal() {
    setLookupModalOpen(false);
    setLookupMatches([]);
    setSelectedMatchId(null);
  }

  function openLookupResults(matches: CheckInLookupMatch[]) {
    setLookupMatches(matches);
    setSelectedMatchId(matches.length === 1 ? matches[0]!.id : null);
    setLookupModalOpen(true);
  }

  async function runLookup(rawInput: string) {
    const value = rawInput.trim();
    if (!value) {
      setLookupMessage('Enter a name, registration code, phone, or scan a QR code.');
      closeLookupModal();
      return;
    }
    if (!token || !seasonId) return;

    setLookupInput(value);
    setLookupMessage(null);
    setLookupPending(true);
    try {
      const res = await apiFetch<{ matches: CheckInLookupMatch[] }>(
        `/api/mobile/v1/seasons/${seasonId}/check-in/lookup`,
        {
          method: 'POST',
          token,
          body: JSON.stringify({ input: value, campDate }),
        },
      );
      openLookupResults(res.matches);
    } catch (e) {
      closeLookupModal();
      const msg =
        e instanceof ApiError ? e.message : 'Lookup failed. Try again.';
      setLookupMessage(msg);
    } finally {
      setLookupPending(false);
    }
  }

  async function runPrintBadge(registrationId: string) {
    if (!token || !seasonId) return;
    setPrintingId(registrationId);
    try {
      await printBadgeByRegistrationId(token, seasonId, registrationId);
    } catch (e) {
      Alert.alert('Print failed', badgePrintErrorMessage(e));
    } finally {
      setPrintingId(null);
    }
  }

  async function patchAttendance(
    match: CheckInLookupMatch,
    checkedIn: boolean,
    undoPin?: string,
  ) {
    if (!token || !seasonId) return;
    setPendingId(match.id);
    try {
      const result = await apiFetch<{
        ok: boolean;
        shouldPrintBadge?: boolean;
      }>(
        `/api/mobile/v1/seasons/${seasonId}/registrations/${match.id}/attendance`,
        {
          method: 'PATCH',
          token,
          body: JSON.stringify({
            checkedIn,
            campDate,
            undoPin,
            dismissalCheckout: dismissal ? true : undefined,
          }),
        },
      );
      setLookupMatches((prev) =>
        prev.map((m) =>
          m.id === match.id ? { ...m, checkedIn } : m,
        ),
      );
      if (checkedIn) {
        closeLookupModal();
        setLookupInput('');
        setSuccessMessage(`Checked in: ${match.studentName}`);
        if (result.shouldPrintBadge && deskSettings.badgePrintingEnabled) {
          printBadgeInBackground(token, seasonId, match.id, (msg) => {
            Alert.alert('Badge print failed', msg);
          });
        }
      } else if (dismissal) {
        closeLookupModal();
        setLookupInput('');
        setSuccessMessage(`Checked out: ${match.studentName}`);
      } else {
        setSuccessMessage(`Check-in undone: ${match.studentName}`);
      }
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Check-in update failed.';
      Alert.alert('Could not update', msg);
    } finally {
      setPendingId(null);
    }
  }

  function handleCheckIn(match: CheckInLookupMatch) {
    if (dismissal) {
      if (!match.checkedIn) {
        Alert.alert('Not checked in', 'This student is not marked as checked in.');
        return;
      }
      Alert.alert(
        'Confirm dismissal',
        `Check out ${match.studentName}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Check out',
            style: 'destructive',
            onPress: () => void patchAttendance(match, false),
          },
        ],
      );
      return;
    }

    if (match.checkedIn) {
      if (deskSettings.undoPinRequired) {
        setPinPendingMatch(match);
        setPinModalOpen(true);
        return;
      }
      void patchAttendance(match, false);
      return;
    }

    if (match.checkInBlocked) {
      Alert.alert(
        'Check-in blocked',
        match.checkInBlockMessage ?? 'This registration cannot be checked in.',
      );
      return;
    }

    void patchAttendance(match, true);
  }

  function handlePinSubmit(pin: string) {
    const match = pinPendingMatch;
    setPinModalOpen(false);
    setPinPendingMatch(null);
    if (!match) return;
    void patchAttendance(match, false, pin);
  }

  function renderCampDayChip(day: CampDateOption) {
    const selected = campDate === day.key;
    const disabled = day.isPast;
    return (
      <Pressable
        key={day.key}
        disabled={disabled}
        onPress={() => setCampDate(day.key)}
        style={[
          styles.dayChip,
          selected && styles.dayChipOn,
          disabled && styles.dayChipDisabled,
        ]}
      >
        <Text
          style={[
            styles.dayChipText,
            selected && styles.dayChipTextOn,
            disabled && styles.dayChipTextDisabled,
          ]}
        >
          {day.label}
          {day.isToday ? ' · Today' : ''}
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.wrap}>
      {successMessage ? (
        <View style={styles.successBanner}>
          <Text style={styles.successBannerText}>{successMessage}</Text>
        </View>
      ) : null}
      <Text style={styles.screenTitle}>Check-in desk</Text>
      {deskSettings.multiDayCheckInEnabled && deskSettings.campDates.length > 0 ? (
        <View style={styles.dayPicker}>
          <Text style={styles.dayPickerLabel}>Camp day</Text>
          <View style={styles.dayChipRow}>
            {deskSettings.campDates.map((day) => renderCampDayChip(day))}
          </View>
          {campDateLocked ? (
            <Text style={styles.dayPickerHint}>
              Past camp days cannot be changed. Select today to check students in or out.
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.panel}>
        {deskSettings.dismissalTrackingEnabled ? (
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
        ) : null}

        <Text style={styles.panelTitle}>Look up student</Text>
        <Text style={styles.panelHint}>
          Scan a ticket or badge QR code, or search by child name, parent name, phone,
          registration number, or family submission code.
        </Text>
        <Pressable
          onPress={() => setScannerOpen(true)}
          style={({ pressed }) => [
            styles.scanBtn,
            pressed && { opacity: 0.92 },
          ]}
        >
          <Text style={styles.scanBtnText}>Scan QR code</Text>
        </Pressable>
        <View style={styles.lookupRow}>
          <TextInput
            value={lookupInput}
            onChangeText={setLookupInput}
            placeholder={
              dismissal
                ? 'Find student to check out'
                : 'Name, parent, phone, or registration code'
            }
            placeholderTextColor={palette.textSecondary}
            style={styles.codeInput}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => void runLookup(lookupInput)}
          />
          <Pressable
            onPress={() => void runLookup(lookupInput)}
            disabled={lookupPending}
            style={({ pressed }) => [
              styles.lookupBtn,
              lookupPending && styles.lookupBtnDisabled,
              pressed && !lookupPending && { opacity: 0.92 },
            ]}
          >
            <Text style={styles.lookupBtnText}>
              {lookupPending ? '…' : 'Look up'}
            </Text>
          </Pressable>
        </View>
        {lookupMessage ? (
          <View style={styles.messageBox}>
            <Text style={styles.messageText}>{lookupMessage}</Text>
          </View>
        ) : null}
      </View>

      <CheckInQrScanner
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={(text) => void runLookup(text)}
      />

      {deskSettings.badgePrintingEnabled && deskSettings.autoPrintOnCheckIn ? (
        <Text style={styles.printHint}>
          {printMode === 'brother'
            ? 'Brother direct print is on — badges feed automatically after check-in.'
            : 'Auto-print uses AirPrint until you configure a Brother printer in More → Brother label printer.'}
        </Text>
      ) : null}

      <CheckInLookupModal
        visible={lookupModalOpen}
        matches={lookupMatches}
        selectedId={selectedMatchId}
        pendingId={pendingId}
        printingId={printingId}
        badgePrintingEnabled={deskSettings.badgePrintingEnabled}
        onClose={closeLookupModal}
        onSelect={(match) => setSelectedMatchId(match.id)}
        checkInDisabled={campDateLocked}
        dismissalMode={dismissal}
        onCheckIn={(match) => handleCheckIn(match)}
        onPrintBadge={(match) => void runPrintBadge(match.id)}
      />

      <PinEntryModal
        visible={pinModalOpen}
        title="Security code required"
        message="Enter the 4-digit code to undo this check-in."
        onCancel={() => {
          setPinModalOpen(false);
          setPinPendingMatch(null);
        }}
        onSubmit={handlePinSubmit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: palette.bg,
    paddingHorizontal: 16,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: palette.text,
    marginTop: 8,
    marginBottom: 12,
  },
  panel: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.text,
  },
  panelHint: {
    marginTop: 6,
    fontSize: 13,
    color: palette.textSecondary,
    lineHeight: 18,
  },
  scanBtn: {
    marginTop: 14,
    backgroundColor: palette.accent,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
  },
  scanBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  lookupRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  codeInput: {
    flex: 1,
    backgroundColor: palette.bg,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: palette.text,
  },
  lookupBtn: {
    backgroundColor: palette.accentMuted,
    borderRadius: 12,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  lookupBtnDisabled: { opacity: 0.5 },
  lookupBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: palette.accent,
  },
  messageBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: palette.warningBg,
    borderWidth: 1,
    borderColor: palette.warning,
  },
  messageText: {
    fontSize: 14,
    color: palette.warning,
    lineHeight: 20,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: palette.expectedBg,
    borderRadius: 12,
    padding: 4,
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
  printHint: {
    fontSize: 12,
    color: palette.textSecondary,
    lineHeight: 17,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  successBanner: {
    marginTop: 8,
    marginBottom: 4,
    backgroundColor: palette.successBg,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: palette.success,
  },
  successBannerText: {
    fontSize: 15,
    fontWeight: '700',
    color: palette.success,
    textAlign: 'center',
  },
  dayPicker: {
    marginBottom: 12,
  },
  dayPickerLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.textSecondary,
    marginBottom: 8,
  },
  dayChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayChip: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dayChipOn: {
    backgroundColor: palette.accentMuted,
    borderColor: palette.accent,
  },
  dayChipDisabled: {
    opacity: 0.45,
  },
  dayChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.textSecondary,
  },
  dayChipTextOn: {
    color: palette.accent,
  },
  dayChipTextDisabled: {
    color: palette.textSecondary,
  },
  dayPickerHint: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 17,
    color: palette.warning,
  },
});
