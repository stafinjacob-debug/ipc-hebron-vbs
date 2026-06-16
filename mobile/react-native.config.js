/** Brother SDK is iOS-only in this app; skip native autolinking on Android. */
module.exports = {
  dependencies: {
    'react-native-brother-print': {
      platforms: {
        android: null,
      },
    },
  },
};
