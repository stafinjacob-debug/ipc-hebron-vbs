import { Platform } from 'react-native';
import {
  printImageViaBluetooth,
  printImageViaWifi,
} from 'react-native-brother-print';
import type { BrotherPrinterConfig } from '@/lib/brother-printer-config';

function stripFileScheme(uri: string): string {
  return uri.startsWith('file://') ? uri.slice(7) : uri;
}

export async function brotherPrintImageFile(
  fileUri: string,
  config: BrotherPrinterConfig,
): Promise<void> {
  if (Platform.OS !== 'ios') {
    throw new Error('Brother direct printing is supported on iOS check-in iPads.');
  }
  const path = stripFileScheme(fileUri);
  if (config.connection === 'bluetooth') {
    await printImageViaBluetooth(path, config.modelName);
    return;
  }
  await printImageViaWifi(path, config.ipAddress, config.modelName);
}

export async function brotherTestPrint(config: BrotherPrinterConfig): Promise<void> {
  // 1x1 white PNG
  const pngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const FileSystem = await import('expo-file-system/legacy');
  const uri = `${FileSystem.cacheDirectory}brother-test-${Date.now()}.png`;
  await FileSystem.writeAsStringAsync(uri, pngBase64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  await brotherPrintImageFile(uri, config);
}
