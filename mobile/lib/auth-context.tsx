import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { apiFetch } from '@/lib/api';
import type { AppRole } from '@/lib/roles';

const STORE = {
  token: 'vbs_mobile_access_token',
  season: 'vbs_active_season_id',
  biometric: 'vbs_biometric_gate',
} as const;

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  role: AppRole;
};

type AuthContextValue = {
  ready: boolean;
  token: string | null;
  user: AuthUser | null;
  seasonId: string | null;
  biometricGateEnabled: boolean;
  sessionUnlocked: boolean;
  setBiometricGateEnabled: (on: boolean) => Promise<void>;
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ accessToken: string; user: AuthUser }>;
  signOut: () => Promise<void>;
  setSeasonId: (id: string | null) => Promise<void>;
  refreshUser: () => Promise<void>;
  unlockWithBiometrics: () => Promise<boolean>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function readToken() {
  try {
    return await SecureStore.getItemAsync(STORE.token);
  } catch {
    return null;
  }
}

async function readSeason() {
  try {
    return await SecureStore.getItemAsync(STORE.season);
  } catch {
    return null;
  }
}

async function readBiometricPref() {
  try {
    return (await SecureStore.getItemAsync(STORE.biometric)) === '1';
  } catch {
    return false;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [seasonId, setSeasonIdState] = useState<string | null>(null);
  const [biometricGateEnabled, setBiometricGateState] = useState(false);
  const [sessionUnlocked, setSessionUnlocked] = useState(true);

  const applyBiometricGate = useCallback(
    (enabled: boolean, hasToken: boolean) => {
      if (enabled && hasToken) {
        setSessionUnlocked(false);
      } else {
        setSessionUnlocked(true);
      }
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [t, s, bio] = await Promise.all([
        readToken(),
        readSeason(),
        readBiometricPref(),
      ]);
      if (cancelled) return;
      setToken(t);
      setSeasonIdState(s);
      setBiometricGateState(bio);
      applyBiometricGate(bio, !!t);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [applyBiometricGate]);

  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (state === 'background' || state === 'inactive') {
        if (biometricGateEnabled && token) {
          setSessionUnlocked(false);
        }
      }
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [biometricGateEnabled, token]);

  const refreshUser = useCallback(async () => {
    if (!token) {
      setUser(null);
      return;
    }
    try {
      const res = await apiFetch<{ user: AuthUser }>('/api/mobile/v1/me', {
        token,
      });
      setUser(res.user);
    } catch {
      setUser(null);
    }
  }, [token]);

  useEffect(() => {
    if (token && sessionUnlocked) {
      void refreshUser();
    }
    if (!token) {
      setUser(null);
    }
  }, [token, sessionUnlocked, refreshUser]);

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await apiFetch<{
      accessToken: string;
      user: AuthUser;
    }>('/api/mobile/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    await SecureStore.setItemAsync(STORE.token, res.accessToken);
    setToken(res.accessToken);
    setUser(res.user);
    const bio = await readBiometricPref();
    applyBiometricGate(bio, true);
    return res;
  }, [applyBiometricGate]);

  const signOut = useCallback(async () => {
    await SecureStore.deleteItemAsync(STORE.token).catch(() => {});
    await SecureStore.deleteItemAsync(STORE.season).catch(() => {});
    setToken(null);
    setUser(null);
    setSeasonIdState(null);
    setSessionUnlocked(true);
  }, []);

  const setSeasonId = useCallback(async (id: string | null) => {
    if (id) {
      await SecureStore.setItemAsync(STORE.season, id);
      setSeasonIdState(id);
    } else {
      await SecureStore.deleteItemAsync(STORE.season).catch(() => {});
      setSeasonIdState(null);
    }
  }, []);

  const setBiometricGateEnabled = useCallback(
    async (on: boolean) => {
      if (on) {
        const has = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        if (!has || !enrolled) {
          throw new Error('Biometrics not available on this device');
        }
        await SecureStore.setItemAsync(STORE.biometric, '1');
        setBiometricGateState(true);
        if (token) setSessionUnlocked(false);
      } else {
        await SecureStore.deleteItemAsync(STORE.biometric).catch(() => {});
        setBiometricGateState(false);
        setSessionUnlocked(true);
      }
    },
    [token],
  );

  const unlockWithBiometrics = useCallback(async () => {
    const r = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock VBS',
      fallbackLabel: 'Use password',
      cancelLabel: 'Cancel',
    });
    if (r.success) {
      setSessionUnlocked(true);
      return true;
    }
    return false;
  }, []);

  const value = useMemo(
    () => ({
      ready,
      token,
      user,
      seasonId,
      biometricGateEnabled,
      sessionUnlocked,
      setBiometricGateEnabled,
      signIn,
      signOut,
      setSeasonId,
      refreshUser,
      unlockWithBiometrics,
    }),
    [
      ready,
      token,
      user,
      seasonId,
      biometricGateEnabled,
      sessionUnlocked,
      setBiometricGateEnabled,
      signIn,
      signOut,
      setSeasonId,
      refreshUser,
      unlockWithBiometrics,
    ],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
