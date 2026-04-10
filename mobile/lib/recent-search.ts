import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'vbs_recent_registration_ids';
const MAX = 12;

export async function pushRecentRegistrationId(id: string) {
  const raw = await AsyncStorage.getItem(KEY);
  let list: string[] = [];
  try {
    list = raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    list = [];
  }
  const next = [id, ...list.filter((x) => x !== id)].slice(0, MAX);
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
}

export async function getRecentRegistrationIds(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(KEY);
  try {
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}
