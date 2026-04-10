import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { palette } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';

export default function Index() {
  const { ready, token, seasonId } = useAuth();

  if (!ready) {
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
