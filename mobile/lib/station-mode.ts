import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'vbs_ipad_station_mode';

export async function readStationMode(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === '1';
  } catch {
    return false;
  }
}

export async function writeStationMode(on: boolean): Promise<void> {
  if (on) {
    await AsyncStorage.setItem(KEY, '1');
  } else {
    await AsyncStorage.removeItem(KEY);
  }
}
