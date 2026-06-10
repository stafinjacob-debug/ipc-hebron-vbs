import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'IPC Hebron VBS',
  slug: 'ipc-hebron-vbs',
  owner: 'stafindebug',
  version: '1.0.0',
  orientation: 'default',
  icon: './assets/images/icon.png',
  scheme: 'ipc-hebron-vbs',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  updates: {
    url: 'https://u.expo.dev/3fcd7e1e-d147-440c-ad91-45ea7127cc59',
  },
  runtimeVersion: {
    policy: 'appVersion',
  },
  splash: {
    image: './assets/images/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },
  ios: {
    bundleIdentifier: 'org.ipchebron.vbs',
    buildNumber: '1',
    supportsTablet: true,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSFaceIDUsageDescription:
        'Unlock the VBS staff app with Face ID or Touch ID.',
      NSCameraUsageDescription:
        'Scan registration QR codes at the check-in desk.',
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
  },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-camera',
      {
        cameraPermission:
          'Scan registration QR codes at the check-in desk.',
      },
    ],
    './plugins/with-brother-print.js',
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000',
    eas: {
      projectId: '3fcd7e1e-d147-440c-ad91-45ea7127cc59',
    },
  },
};

export default config;
