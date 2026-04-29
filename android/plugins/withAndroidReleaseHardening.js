const { withGradleProperties } = require("@expo/config-plugins");

const releaseProperties = {
  "android.enableProguardInReleaseBuilds": "true",
  "android.enableShrinkResourcesInReleaseBuilds": "true",
  "EX_DEV_CLIENT_NETWORK_INSPECTOR": "false",
  reactNativeArchitectures: "armeabi-v7a,arm64-v8a"
};

function upsertProperty(properties, key, value) {
  const existing = properties.find((item) => item.type === "property" && item.key === key);
  if (existing) {
    existing.value = value;
    return;
  }
  properties.push({ type: "property", key, value });
}

module.exports = function withAndroidReleaseHardening(config) {
  return withGradleProperties(config, (nextConfig) => {
    Object.entries(releaseProperties).forEach(([key, value]) => {
      upsertProperty(nextConfig.modResults, key, value);
    });
    return nextConfig;
  });
};
