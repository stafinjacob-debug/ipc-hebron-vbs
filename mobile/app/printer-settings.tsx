import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { palette } from '@/constants/theme';
import {
  Card,
  FieldLabel,
  PrimaryButton,
  SectionTitle,
  SecondaryButton,
} from '@/components/ui';
import { brotherTestPrint } from '@/lib/brother-print-service';
import {
  BROTHER_MODEL_OPTIONS,
  DEFAULT_BROTHER_PRINTER_CONFIG,
  isBrotherPrinterReady,
  readBrotherPrinterConfig,
  writeBrotherPrinterConfig,
  type BrotherConnection,
  type BrotherPrinterConfig,
} from '@/lib/brother-printer-config';

export default function PrinterSettingsScreen() {
  const router = useRouter();
  const [config, setConfig] = useState<BrotherPrinterConfig>({
    ...DEFAULT_BROTHER_PRINTER_CONFIG,
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void readBrotherPrinterConfig().then(setConfig);
  }, []);

  async function save(next: BrotherPrinterConfig) {
    setConfig(next);
    await writeBrotherPrinterConfig(next);
  }

  async function onTestPrint() {
    if (!isBrotherPrinterReady(config)) {
      Alert.alert(
        'Printer not ready',
        config.connection === 'wifi'
          ? 'Enter the printer IP address and model, then try again.'
          : 'Select a model and pair the printer in iPad Settings → Bluetooth first.',
      );
      return;
    }
    setBusy(true);
    try {
      await brotherTestPrint(config);
      Alert.alert('Test sent', 'If the printer is online, a label should feed shortly.');
    } catch (e) {
      Alert.alert(
        'Test failed',
        e instanceof Error ? e.message : 'Could not reach the Brother printer.',
      );
    } finally {
      setBusy(false);
    }
  }

  if (Platform.OS !== 'ios') {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Text style={styles.lead}>
          Brother direct printing is configured for iPad check-in stations on iOS.
        </Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.lead}>
        Pair your Brother label printer once per iPad. Check-in then prints badges
        directly — no AirPrint dialog — like Planning Center Check-Ins.
      </Text>

      <Card style={styles.card}>
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchLabel}>Use Brother direct printing</Text>
            <Text style={styles.switchSub}>
              When off, badges use AirPrint and show the system print sheet.
            </Text>
          </View>
          <Switch
            value={config.enabled}
            onValueChange={(enabled) => void save({ ...config, enabled })}
          />
        </View>
      </Card>

      <SectionTitle>Connection</SectionTitle>
      <View style={styles.segment}>
        {(['bluetooth', 'wifi'] as BrotherConnection[]).map((mode) => (
          <Pressable
            key={mode}
            onPress={() => void save({ ...config, connection: mode })}
            style={[styles.segBtn, config.connection === mode && styles.segBtnOn]}
          >
            <Text
              style={[
                styles.segLabel,
                config.connection === mode && styles.segLabelOn,
              ]}
            >
              {mode === 'bluetooth' ? 'Bluetooth' : 'Wi‑Fi (LAN IP)'}
            </Text>
          </Pressable>
        ))}
      </View>

      {config.connection === 'bluetooth' ? (
        <Card style={styles.card}>
          <Text style={styles.helpTitle}>Bluetooth setup (keeps church Wi‑Fi)</Text>
          <Text style={styles.help}>
            1. On the Brother printer, turn Bluetooth on (see printer manual).{'\n'}
            2. iPad Settings → Bluetooth → pair your Brother (e.g. QL-820NWB).{'\n'}
            3. Leave the iPad on your church Wi‑Fi so check-in can reach the server.{'\n'}
            4. Select the matching model below, then tap Print test label.
          </Text>
          <Text style={styles.helpMuted}>
            Pair one iPad to one printer. Bluetooth prints badges; Wi‑Fi on the iPad
            is only used for the VBS app and internet.
          </Text>
        </Card>
      ) : (
        <Text style={styles.help}>
          Enter the printer’s IP on the same network as the iPad. The iPad must stay
          on church Wi‑Fi — do not join the printer’s own Wi‑Fi network.
        </Text>
      )}

      <FieldLabel>Printer model</FieldLabel>
      <View style={styles.modelRow}>
        {BROTHER_MODEL_OPTIONS.map((model) => (
          <Pressable
            key={model}
            onPress={() => void save({ ...config, modelName: model })}
            style={[
              styles.modelChip,
              config.modelName === model && styles.modelChipOn,
            ]}
          >
            <Text
              style={[
                styles.modelChipText,
                config.modelName === model && styles.modelChipTextOn,
              ]}
            >
              {model}
            </Text>
          </Pressable>
        ))}
      </View>

      {config.connection === 'wifi' ? (
        <>
          <FieldLabel>Printer IP address</FieldLabel>
          <TextInput
            value={config.ipAddress}
            onChangeText={(ipAddress) => setConfig((c) => ({ ...c, ipAddress }))}
            onBlur={() => void save(config)}
            placeholder="192.168.1.120"
            placeholderTextColor={palette.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="numbers-and-punctuation"
            style={styles.input}
          />
          <Text style={styles.help}>
            Print a network configuration label from the Brother printer, or find
            the IP in your router / Brother iPrint&amp;Scan app.
          </Text>
        </>
      ) : null}

      <PrimaryButton
        label={busy ? 'Sending test…' : 'Print test label'}
        loading={busy}
        onPress={() => void onTestPrint()}
      />

      <SecondaryButton label="Done" onPress={() => router.back()} />

      <Text style={styles.footer}>
        Supported: QL-820NWB, QL-810W, QL-1110NWB and c variants. Load DK-2205
        (62 mm continuous) or the label size configured in admin badge settings.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  content: { padding: 20, paddingBottom: 48, gap: 8 },
  lead: {
    fontSize: 15,
    lineHeight: 22,
    color: palette.textSecondary,
    marginBottom: 8,
  },
  card: { marginBottom: 8 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchLabel: { fontSize: 16, fontWeight: '700', color: palette.text },
  switchSub: { fontSize: 13, color: palette.textSecondary, marginTop: 4 },
  segment: {
    flexDirection: 'row',
    backgroundColor: palette.expectedBg,
    borderRadius: 12,
    padding: 4,
    marginBottom: 8,
  },
  segBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  segBtnOn: { backgroundColor: palette.surface },
  segLabel: { fontSize: 14, fontWeight: '600', color: palette.textSecondary },
  segLabelOn: { color: palette.text },
  modelRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  modelChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: palette.surface,
  },
  modelChipOn: {
    borderColor: palette.accent,
    backgroundColor: palette.accentMuted,
  },
  modelChipText: { fontSize: 13, fontWeight: '600', color: palette.textSecondary },
  modelChipTextOn: { color: palette.accent },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 17,
    backgroundColor: palette.surface,
    color: palette.text,
    marginBottom: 8,
  },
  help: {
    fontSize: 13,
    lineHeight: 19,
    color: palette.textSecondary,
    marginBottom: 12,
  },
  helpTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: palette.text,
    marginBottom: 8,
  },
  helpMuted: {
    fontSize: 12,
    lineHeight: 17,
    color: palette.textSecondary,
    marginTop: 8,
  },
  footer: {
    marginTop: 16,
    fontSize: 12,
    lineHeight: 17,
    color: palette.textSecondary,
    textAlign: 'center',
  },
});
