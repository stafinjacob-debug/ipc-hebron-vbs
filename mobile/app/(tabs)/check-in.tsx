import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  CheckInLookupModal,
  type CheckInLookupMatch,
} from '@/components/CheckInLookupModal';
import { CheckInQrScanner } from '@/components/CheckInQrScanner';
import { StatusChip } from '@/components/ui';
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
import { pushRecentRegistrationId } from '@/lib/recent-search';

type SearchRow = {
  registrationId: string;
  studentName: string;
  ageYears: number;
  className: string | null;
  room: string | null;
  registrationCode: string | null;
  checkedIn: boolean;
  guardianName: string;
  hasMedicalAlert: boolean;
};

export default function CheckInScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const { token, seasonId } = useAuth();

  const [mode, setMode] = useState<'arrivals' | 'dismissal'>('arrivals');
  const [codeInput, setCodeInput] = useState('');
  const [lookupPending, setLookupPending] = useState(false);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const [lookupMatches, setLookupMatches] = useState<CheckInLookupMatch[]>([]);
  const [lookupModalOpen, setLookupModalOpen] = useState(false);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [deskSettings, setDeskSettings] = useState<CheckInDeskSettings>({
    badgePrintingEnabled: false,
    autoPrintOnCheckIn: false,
    multiDayCheckInEnabled: false,
    campDates: [],
    todayCampDate: null,
    selectedCampDate: null,
  });
  const [campDate, setCampDate] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [printMode, setPrintMode] = useState<'brother' | 'airprint' | 'none'>('none');

  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [results, setResults] = useState<SearchRow[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 320);
    return () => clearTimeout(t);
  }, [q]);

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
          campDates: [],
          todayCampDate: null,
          selectedCampDate: null,
        });
      });
  }, [token, seasonId, campDate]);

  const selectedCampDay = deskSettings.campDates.find((d) => d.key === campDate);
  const campDateLocked = Boolean(selectedCampDay?.isPast);

  useEffect(() => {
    if (!successMessage) return;
    const t = setTimeout(() => setSuccessMessage(null), 2800);
    return () => clearTimeout(t);
  }, [successMessage]);

  const runSearch = useCallback(async () => {
    if (!token || !seasonId || debounced.length < 2) {
      setResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const campDateQuery = campDate
        ? `&campDate=${encodeURIComponent(campDate)}`
        : '';
      const res = await apiFetch<{ results: SearchRow[] }>(
        `/api/mobile/v1/seasons/${seasonId}/search?q=${encodeURIComponent(debounced)}${campDateQuery}`,
        { token },
      );
      setResults(res.results);
    } catch {
      setResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, [token, seasonId, debounced, campDate]);

  useEffect(() => {
    void runSearch();
  }, [runSearch]);

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
      setLookupMessage('Enter a registration code or scan a QR code.');
      closeLookupModal();
      return;
    }
    if (!token || !seasonId) return;

    setCodeInput(value);
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

  async function handleCheckIn(match: CheckInLookupMatch) {
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
          body: JSON.stringify({ checkedIn: !match.checkedIn, campDate }),
        },
      );
      const nextCheckedIn = !match.checkedIn;
      setLookupMatches((prev) =>
        prev.map((m) =>
          m.id === match.id ? { ...m, checkedIn: nextCheckedIn } : m,
        ),
      );
      void runSearch();
      if (nextCheckedIn) {
        closeLookupModal();
        setCodeInput('');
        setSuccessMessage(`Checked in: ${match.studentName}`);
        if (
          result.shouldPrintBadge &&
          deskSettings.badgePrintingEnabled
        ) {
          printBadgeInBackground(token, seasonId, match.id, (msg) => {
            Alert.alert('Badge print failed', msg);
          });
        }
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

  async function openStudent(row: SearchRow) {
    await pushRecentRegistrationId(row.registrationId);
    router.push({
      pathname: '/student/[id]',
      params: {
        id: row.registrationId,
        mode: mode === 'dismissal' ? 'dismissal' : 'arrivals',
        campDate: campDate ?? '',
      },
    });
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

  const lookupPanel = (
    <View style={[styles.panel, isWide && styles.panelWide]}>
      <Text style={styles.panelTitle}>Scan or enter code</Text>
      <Text style={styles.panelHint}>
        Scan a ticket or badge QR code, or type a registration number / family
        submission code.
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
          value={codeInput}
          onChangeText={setCodeInput}
          placeholder="Registration code, e.g. VBS-2026-001"
          placeholderTextColor={palette.textSecondary}
          style={styles.codeInput}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={() => void runLookup(codeInput)}
        />
        <Pressable
          onPress={() => void runLookup(codeInput)}
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
  );

  const searchPanel = (
    <View style={[styles.panel, styles.searchPanel, isWide && styles.flex1]}>
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

      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder={
          mode === 'arrivals'
            ? 'Search name, parent, code, or phone'
            : 'Find student to check out'
        }
        placeholderTextColor={palette.textSecondary}
        style={styles.search}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
      />

      {searchLoading ? (
        <ActivityIndicator style={{ marginTop: 16 }} color={palette.accent} />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.registrationId}
          style={styles.list}
          contentContainerStyle={{ paddingBottom: 120 }}
          ListEmptyComponent={
            debounced.length >= 2 ? (
              <Text style={styles.empty}>No matches</Text>
            ) : (
              <Text style={styles.hint}>
                Type at least 2 characters to search by name.
              </Text>
            )
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => void openStudent(item)}
              style={({ pressed }) => [
                styles.card,
                pressed && { opacity: 0.92 },
              ]}
            >
              <View style={styles.cardTop}>
                <Text style={styles.name}>{item.studentName}</Text>
                {item.hasMedicalAlert ? (
                  <StatusChip label="Alert" tone="warning" />
                ) : null}
              </View>
              <Text style={styles.meta}>
                {item.className ?? 'Class TBD'}
                {item.room ? ` · Room ${item.room}` : ''}
              </Text>
              <Text style={styles.meta}>
                {item.ageYears} yrs · {item.guardianName}
              </Text>
              <View style={styles.rowFooter}>
                <StatusChip
                  label={item.checkedIn ? 'Checked in' : 'Expected'}
                  tone={item.checkedIn ? 'success' : 'neutral'}
                />
                {item.registrationCode ? (
                  <Text style={styles.code}>{item.registrationCode}</Text>
                ) : null}
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );

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
      {isWide ? (
        <View style={styles.rowLayout}>
          {lookupPanel}
          {searchPanel}
        </View>
      ) : (
        <>
          {lookupPanel}
          {searchPanel}
        </>
      )}

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
        onCheckIn={(match) => void handleCheckIn(match)}
        onPrintBadge={(match) => void runPrintBadge(match.id)}
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
  rowLayout: {
    flex: 1,
    flexDirection: 'row',
    gap: 16,
  },
  panel: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  panelWide: {
    width: 360,
    marginBottom: 0,
  },
  flex1: { flex: 1, marginBottom: 0 },
  searchPanel: { flex: 1 },
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
  search: {
    backgroundColor: palette.bg,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 18,
    color: palette.text,
  },
  list: { marginTop: 8 },
  card: {
    backgroundColor: palette.bg,
    borderRadius: 14,
    padding: 16,
    marginTop: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  name: { fontSize: 18, fontWeight: '700', color: palette.text, flex: 1 },
  meta: { fontSize: 14, color: palette.textSecondary, marginTop: 4 },
  rowFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  code: { fontSize: 12, color: palette.textSecondary, fontWeight: '600' },
  empty: { textAlign: 'center', marginTop: 24, color: palette.textSecondary },
  hint: { textAlign: 'center', marginTop: 24, color: palette.textSecondary },
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
