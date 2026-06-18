import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { palette } from '@/constants/theme';
import { PrimaryButton, SecondaryButton } from '@/components/ui';

type Props = {
  visible: boolean;
  onClose: () => void;
  onScan: (text: string) => void;
};

export function CheckInQrScanner({ visible, onClose, onScan }: Props) {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanLocked, setScanLocked] = useState(false);
  const pendingScanRef = useRef<string | null>(null);
  const scanDeliveredRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setScanLocked(false);
      setError(null);
      return;
    }
    pendingScanRef.current = null;
    scanDeliveredRef.current = false;
    if (!permission?.granted) {
      void requestPermission();
    }
  }, [visible, permission?.granted, requestPermission]);

  function flushPendingScan() {
    if (scanDeliveredRef.current) return;
    const data = pendingScanRef.current;
    if (!data) return;
    scanDeliveredRef.current = true;
    pendingScanRef.current = null;
    onScan(data);
  }

  function handleBarcode(data: string) {
    if (scanLocked) return;
    setScanLocked(true);
    pendingScanRef.current = data;
    onClose();
    // iOS only presents one modal at a time — wait until this one dismisses before lookup.
    if (Platform.OS !== 'ios') {
      flushPendingScan();
      return;
    }
    // Rare devices may not fire onDismiss; ensure lookup still runs.
    setTimeout(() => {
      flushPendingScan();
    }, 500);
  }

  function handleDismiss() {
    flushPendingScan();
  }

  function handleCancel() {
    pendingScanRef.current = null;
    onClose();
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onDismiss={handleDismiss}
    >
      <View style={[styles.wrap, { paddingTop: insets.top + 12 }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Scan check-in QR code</Text>
          <Text style={styles.sub}>
            Point the iPad camera at the ticket or badge QR code.
          </Text>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {!permission ? (
          <Text style={styles.hint}>Checking camera permission…</Text>
        ) : !permission.granted ? (
          <View style={styles.permissionBox}>
            <Text style={styles.hint}>
              Camera access is required to scan registration QR codes.
            </Text>
            <PrimaryButton
              label="Allow camera"
              onPress={() => void requestPermission()}
            />
          </View>
        ) : (
          <View style={styles.cameraWrap}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={
                scanLocked ? undefined : ({ data }) => handleBarcode(data)
              }
            />
            <View style={styles.reticle} pointerEvents="none" />
          </View>
        )}

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <SecondaryButton label="Cancel" onPress={handleCancel} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  sub: {
    marginTop: 6,
    fontSize: 15,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 21,
  },
  cameraWrap: {
    flex: 1,
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  reticle: {
    position: 'absolute',
    top: '15%',
    left: '10%',
    right: '10%',
    bottom: '15%',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.65)',
    borderRadius: 16,
  },
  hint: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 22,
  },
  permissionBox: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 16,
  },
  errorBox: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: palette.dangerBg,
  },
  errorText: {
    color: palette.danger,
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
});
