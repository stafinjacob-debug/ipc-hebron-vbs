import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useLayoutEffect } from 'react';
import { Pressable, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ClassRosterView } from '@/components/ClassRosterView';
import { palette } from '@/constants/theme';

export default function ClassDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerBackTitle: 'Back',
      headerLeft: () => (
        <Pressable
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
              return;
            }
            router.replace('/(tabs)/classes');
          }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 6,
            paddingRight: 12,
          }}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={28} color={palette.accent} />
          <Text style={{ fontSize: 17, color: palette.accent }}>Back</Text>
        </Pressable>
      ),
    });
  }, [navigation, router]);

  if (!id) return null;

  return (
    <>
      <Stack.Screen options={{ title: 'Class roster' }} />
      <ClassRosterView classId={id} />
    </>
  );
}
