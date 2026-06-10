import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'vbs_brother_printer_config';

export type BrotherConnection = 'wifi' | 'bluetooth';

export type BrotherPrinterConfig = {
  enabled: boolean;
  connection: BrotherConnection;
  modelName: string;
  ipAddress: string;
};

export const BROTHER_MODEL_OPTIONS = [
  'QL-820NWB',
  'QL-820NWBc',
  'QL-810W',
  'QL-810Wc',
  'QL-1110NWB',
  'QL-1110NWBc',
] as const;

export const DEFAULT_BROTHER_PRINTER_CONFIG: BrotherPrinterConfig = {
  enabled: false,
  connection: 'wifi',
  modelName: 'QL-820NWB',
  ipAddress: '',
};

export async function readBrotherPrinterConfig(): Promise<BrotherPrinterConfig> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_BROTHER_PRINTER_CONFIG };
    const parsed = JSON.parse(raw) as Partial<BrotherPrinterConfig>;
    return {
      enabled: parsed.enabled === true,
      connection: parsed.connection === 'bluetooth' ? 'bluetooth' : 'wifi',
      modelName:
        typeof parsed.modelName === 'string' && parsed.modelName.trim()
          ? parsed.modelName.trim()
          : DEFAULT_BROTHER_PRINTER_CONFIG.modelName,
      ipAddress:
        typeof parsed.ipAddress === 'string' ? parsed.ipAddress.trim() : '',
    };
  } catch {
    return { ...DEFAULT_BROTHER_PRINTER_CONFIG };
  }
}

export async function writeBrotherPrinterConfig(
  config: BrotherPrinterConfig,
): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(config));
}

export function isBrotherPrinterReady(config: BrotherPrinterConfig): boolean {
  if (!config.enabled) return false;
  if (!config.modelName.trim()) return false;
  if (config.connection === 'wifi' && !config.ipAddress.trim()) return false;
  return true;
}
