import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { palette } from '@/constants/theme';
import { PrimaryButton, SecondaryButton } from '@/components/ui';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  onCancel: () => void;
  onSubmit: (pin: string) => void;
};

export function PinEntryModal({
  visible,
  title,
  message,
  onCancel,
  onSubmit,
}: Props) {
  const insets = useSafeAreaInsets();
  const [pin, setPin] = useState('');

  useEffect(() => {
    if (visible) setPin('');
  }, [visible]);

  function handleSubmit() {
    const trimmed = pin.trim();
    if (!/^\d{4}$/.test(trimmed)) return;
    onSubmit(trimmed);
  }

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { marginBottom: Math.max(insets.bottom, 16) }]}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <TextInput
            value={pin}
            onChangeText={(value) => setPin(value.replace(/\D/g, '').slice(0, 4))}
            keyboardType="number-pad"
            maxLength={4}
            secureTextEntry
            placeholder="••••"
            placeholderTextColor={palette.textSecondary}
            style={styles.input}
            autoFocus
            onSubmitEditing={handleSubmit}
          />
          <View style={styles.actions}>
            <SecondaryButton label="Cancel" onPress={onCancel} />
            <PrimaryButton
              label="Confirm"
              disabled={pin.length !== 4}
              onPress={handleSubmit}
            />
          </View>
        </View>
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
  sheet: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    padding: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: palette.text,
  },
  message: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: palette.textSecondary,
  },
  input: {
    marginTop: 16,
    backgroundColor: palette.bg,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 24,
    letterSpacing: 8,
    textAlign: 'center',
    color: palette.text,
  },
  actions: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
});
