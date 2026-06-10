const { withInfoPlist } = require('@expo/config-plugins');

/** Adds Brother Wi‑Fi / Bluetooth permissions required on iPad check-in stations. */
module.exports = function withBrotherPrint(config) {
  return withInfoPlist(config, (config) => {
    config.modResults.NSBluetoothAlwaysUsageDescription =
      config.modResults.NSBluetoothAlwaysUsageDescription ??
      'Connect to Brother label printers for check-in badges.';
    config.modResults.NSBluetoothPeripheralUsageDescription =
      config.modResults.NSBluetoothPeripheralUsageDescription ??
      'Connect to Brother label printers for check-in badges.';
    config.modResults.NSLocalNetworkUsageDescription =
      config.modResults.NSLocalNetworkUsageDescription ??
      'Find Brother label printers on your church Wi‑Fi network.';
    config.modResults.NSBonjourServices = [
      ...(config.modResults.NSBonjourServices ?? []),
      '_pdl-datastream._tcp',
      '_printer._tcp',
      '_ipp._tcp',
    ];
    return config;
  });
};
