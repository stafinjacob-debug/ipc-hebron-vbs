import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { palette } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { useStationMode } from '@/lib/station-mode-context';

export default function Index() {
  const { ready, token, seasonId } = useAuth();
  const { stationMode, ready: stationReady } = useStationMode();

  if (!ready || !stationReady) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={palette.accent} />
      </View>
    );
  }

  if (!token) {
    return <Redirect href="/(auth)/login" />;
  }
  if (!seasonId) {
    return <Redirect href="/(auth)/select-season" />;
  }
  if (stationMode) {
    return <Redirect href="/(tabs)/check-in" />;
  }
  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: palette.bg,
  },
});
