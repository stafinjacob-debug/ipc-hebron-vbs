import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { readStationMode, writeStationMode } from '@/lib/station-mode';

type StationModeContextValue = {
  stationMode: boolean;
  ready: boolean;
  setStationMode: (on: boolean) => Promise<void>;
};

const StationModeContext = createContext<StationModeContextValue | null>(null);

export function StationModeProvider({ children }: { children: React.ReactNode }) {
  const [stationMode, setStationModeState] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void readStationMode().then((on) => {
      setStationModeState(on);
      setReady(true);
    });
  }, []);

  const setStationMode = useCallback(async (on: boolean) => {
    await writeStationMode(on);
    setStationModeState(on);
  }, []);

  const value = useMemo(
    () => ({ stationMode, ready, setStationMode }),
    [stationMode, ready, setStationMode],
  );

  return (
    <StationModeContext.Provider value={value}>
      {children}
    </StationModeContext.Provider>
  );
}

export function useStationMode() {
  const ctx = useContext(StationModeContext);
  if (!ctx) {
    throw new Error('useStationMode must be used within StationModeProvider');
  }
  return ctx;
}
