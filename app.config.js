module.exports = ({ config }) => {
  if (process.env.EAS_BUILD_PROFILE === 'production') {
    const value = process.env.EXPO_PUBLIC_API_URL;
    let url;
    try { url = new URL(value); } catch { throw new Error('Set EXPO_PUBLIC_API_URL in the EAS production environment before building.'); }
    const host = url.hostname.replace(/^\[|\]$/g, '');
    if (url.protocol !== 'https:' || url.username || url.password || ['localhost', '127.0.0.1', '::1'].includes(host) || host.endsWith('.localhost')) {
      throw new Error('Production EXPO_PUBLIC_API_URL must be a public HTTPS URL without credentials.');
    }
  }
  if (process.env.EAS_BUILD_PLATFORM === 'ios' || process.env.EXPO_OS === 'ios') {
    // Firebase Android configuration is supplied separately by its build workflow.
    const android = { ...config.android };
    delete android.googleServicesFile;
    return { ...config, android };
  }
  return config;
};
