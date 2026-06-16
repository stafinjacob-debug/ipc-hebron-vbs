import React from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PinEntryForm } from '@/components/PinEntryForm';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onCancel: () => void;
  onSubmit: (pin: string) => void;
};

export function PinEntryModal({
  visible,
  title,
  message,
  confirmLabel,
  onCancel,
  onSubmit,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      presentationStyle="overFullScreen"
      onRequestClose={onCancel}
    >
      <View style={[styles.backdrop, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <PinEntryForm
          title={title}
          message={message}
          confirmLabel={confirmLabel}
          onCancel={onCancel}
          onSubmit={onSubmit}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
});
