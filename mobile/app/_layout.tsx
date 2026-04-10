import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { LockScreen } from '@/components/LockScreen';
import { useColorScheme } from '@/components/useColorScheme';
import { AuthProvider, useAuth } from '@/lib/auth-context';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const {
    ready,
    token,
    biometricGateEnabled,
    sessionUnlocked,
  } = useAuth();

  const locked = ready && !!token && biometricGateEnabled && !sessionUnlocked;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      {locked ? (
        <LockScreen />
      ) : (
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="student/[id]"
            options={{ title: 'Student', headerBackTitle: 'Back' }}
          />
          <Stack.Screen
            name="class/[id]"
            options={{ title: 'Class roster', headerBackTitle: 'Back' }}
          />
          <Stack.Screen
            name="announcement/[id]"
            options={{ title: 'Announcement', headerBackTitle: 'Back' }}
          />
          <Stack.Screen
            name="announcement/new"
            options={{ title: 'New announcement', headerBackTitle: 'Back' }}
          />
          <Stack.Screen
            name="announcement/edit/[id]"
            options={{ title: 'Edit announcement', headerBackTitle: 'Back' }}
          />
        </Stack>
      )}
    </ThemeProvider>
  );
}
