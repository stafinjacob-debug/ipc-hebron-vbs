import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { palette } from '@/constants/theme';
import { PrimaryButton, SecondaryButton } from '@/components/ui';

type Props = {
  title: string;
  message: string;
  confirmLabel?: string;
  onCancel: () => void;
  onSubmit: (pin: string) => void;
};

export function PinEntryForm({
  title,
  message,
  confirmLabel = 'Confirm',
  onCancel,
  onSubmit,
}: Props) {
  const [pin, setPin] = useState('');

  useEffect(() => {
    setPin('');
  }, [title, message]);

  function handleSubmit() {
    const trimmed = pin.trim();
    if (!/^\d{4}$/.test(trimmed)) return;
    onSubmit(trimmed);
  }

  return (
    <View style={styles.sheet}>
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
          label={confirmLabel}
          disabled={pin.length !== 4}
          onPress={handleSubmit}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    padding: 20,
    width: '100%',
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
