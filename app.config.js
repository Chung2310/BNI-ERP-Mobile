module.exports = ({ config }) => {
  const isProductionIosBuild = process.env.IOS_BUILD_PROFILE === 'production';
  if (isProductionIosBuild) {
    const value = process.env.EXPO_PUBLIC_API_URL;
    let url;
    try { url = new URL(value); } catch { throw new Error('Set EXPO_PUBLIC_API_URL in GitHub Actions before building the iOS production app.'); }
    const host = url.hostname.replace(/^\[|\]$/g, '');
    if (url.protocol !== 'https:' || url.username || url.password || ['localhost', '127.0.0.1', '::1'].includes(host) || host.endsWith('.localhost')) {
      throw new Error('Production EXPO_PUBLIC_API_URL must be a public HTTPS URL without credentials.');
    }
  }
  const isIosBuild = isProductionIosBuild || process.env.IOS_BUILD_PLATFORM === 'ios' || process.env.EXPO_OS === 'ios';
  if (isIosBuild) {
    // Android Firebase configuration is restored separately by its build workflow.
    const android = { ...config.android };
    delete android.googleServicesFile;
    return { ...config, android };
  }
  if (process.env.APP_VARIANT !== 'production') return config;

  const versionCode = process.env.ANDROID_VERSION_CODE;
  return {
    ...config,
    android: {
      ...config.android,
      ...(versionCode ? { versionCode: Number(versionCode) } : {}),
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON || config.android.googleServicesFile,
    },
    plugins: [...config.plugins.map(plugin => {
      if (!Array.isArray(plugin) || plugin[0] !== 'expo-build-properties') return plugin;
      const [name, options] = plugin;
      return [name, {
        ...options,
        android: {
          ...options.android,
          buildArchs: ['armeabi-v7a', 'arm64-v8a', 'x86', 'x86_64'],
          useLegacyPackaging: false,
        },
      }];
    }), './plugins/withAndroidPlaySigning.cjs'],
  };
};
