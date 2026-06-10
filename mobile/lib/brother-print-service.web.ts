import type { BrotherPrinterConfig } from '@/lib/brother-printer-config';

export async function brotherPrintImageFile(
  _fileUri: string,
  _config: BrotherPrinterConfig,
): Promise<void> {
  throw new Error('Brother direct printing requires an iOS development build.');
}

export async function brotherTestPrint(_config: BrotherPrinterConfig): Promise<void> {
  throw new Error('Brother direct printing requires an iOS development build.');
}
