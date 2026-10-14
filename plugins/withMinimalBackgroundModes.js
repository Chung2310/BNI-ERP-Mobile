const { withInfoPlist } = require('expo/config-plugins');

module.exports = function withMinimalBackgroundModes(config) {
  return withInfoPlist(config, (result) => {
    // This app has remote notifications, but no background audio or fetch task.
    result.modResults.UIBackgroundModes = ['remote-notification'];
    delete result.modResults.NSLocationAlwaysUsageDescription;
    delete result.modResults.NSLocationAlwaysAndWhenInUseUsageDescription;
    delete result.modResults.NSMotionUsageDescription;
    return result;
  });
};
