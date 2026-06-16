import type { BrotherPrinterConfig } from '@/lib/brother-printer-config';

export async function brotherPrintImageFile(
  _fileUri: string,
  _config: BrotherPrinterConfig,
): Promise<void> {
  throw new Error(
    'Brother label printing is available on iOS check-in iPads. Use system print on Android.',
  );
}

export async function brotherTestPrint(_config: BrotherPrinterConfig): Promise<void> {
  throw new Error(
    'Brother label printing is available on iOS check-in iPads. Use system print on Android.',
  );
}
