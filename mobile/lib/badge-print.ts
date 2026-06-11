import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import { Platform } from 'react-native';
import { ApiError, apiFetch, getApiBase } from '@/lib/api';
import { brotherPrintImageFile } from '@/lib/brother-print-service';
import {
  isBrotherPrinterReady,
  readBrotherPrinterConfig,
  type BrotherPrinterConfig,
} from '@/lib/brother-printer-config';

export type CampDateOption = {
  key: string;
  label: string;
  isPast: boolean;
  isToday: boolean;
};

export type CheckInDeskSettings = {
  badgePrintingEnabled: boolean;
  autoPrintOnCheckIn: boolean;
  multiDayCheckInEnabled: boolean;
  campDates: CampDateOption[];
  todayCampDate: string | null;
  selectedCampDate: string | null;
};

export async function fetchCheckInDeskSettings(
  token: string,
  seasonId: string,
  campDate?: string | null,
): Promise<CheckInDeskSettings> {
  const query = campDate ? `?campDate=${encodeURIComponent(campDate)}` : '';
  return apiFetch<CheckInDeskSettings>(
    `/api/mobile/v1/seasons/${seasonId}/check-in/settings${query}`,
    { token },
  );
}

async function fetchBadgePngToCache(
  token: string,
  seasonId: string,
  registrationId: string,
): Promise<string> {
  const url = `${getApiBase()}/api/mobile/v1/seasons/${seasonId}/registrations/${registrationId}/badge?format=png`;
  const dest = `${FileSystem.cacheDirectory}badge-${registrationId}-${Date.now()}.png`;
  const result = await FileSystem.downloadAsync(url, dest, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (result.status !== 200) {
    throw new ApiError(`Badge image download failed (HTTP ${result.status})`, result.status);
  }
  return result.uri;
}

async function printBadgeViaAirPrint(
  token: string,
  seasonId: string,
  registrationId: string,
): Promise<void> {
  const res = await apiFetch<{ html: string }>(
    `/api/mobile/v1/seasons/${seasonId}/registrations/${registrationId}/badge`,
    { token },
  );
  await Print.printAsync({ html: res.html });
}

async function printBadgeViaBrother(
  token: string,
  seasonId: string,
  registrationId: string,
  config: BrotherPrinterConfig,
): Promise<void> {
  const imageUri = await fetchBadgePngToCache(token, seasonId, registrationId);
  await brotherPrintImageFile(imageUri, config);
}

export async function getActivePrintMode(): Promise<'brother' | 'airprint' | 'none'> {
  const config = await readBrotherPrinterConfig();
  if (isBrotherPrinterReady(config) && Platform.OS === 'ios') return 'brother';
  return 'airprint';
}

export async function printBadgeByRegistrationId(
  token: string,
  seasonId: string,
  registrationId: string,
): Promise<'brother' | 'airprint'> {
  const config = await readBrotherPrinterConfig();
  if (isBrotherPrinterReady(config) && Platform.OS === 'ios') {
    await printBadgeViaBrother(token, seasonId, registrationId, config);
    return 'brother';
  }
  await printBadgeViaAirPrint(token, seasonId, registrationId);
  return 'airprint';
}

/**
 * Silent-ish check-in printing: Brother sends directly to the paired printer;
 * AirPrint still opens the iOS print sheet.
 */
export function printBadgeInBackground(
  token: string,
  seasonId: string,
  registrationId: string,
  onError?: (message: string) => void,
): void {
  void printBadgeByRegistrationId(token, seasonId, registrationId).catch((e) => {
    onError?.(badgePrintErrorMessage(e));
  });
}

export function badgePrintErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Badge print failed.';
}

export { brotherTestPrint } from '@/lib/brother-print-service';
