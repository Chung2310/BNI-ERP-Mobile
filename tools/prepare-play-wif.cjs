const fs = require("node:fs");
const path = require("node:path");

function readPlayWifConfig(provider, serviceAccountEmail) {
  const normalizedProvider = provider?.trim();
  if (!normalizedProvider || !/^projects\/\d+\/locations\/global\/workloadIdentityPools\/[a-z0-9][a-z0-9-]{0,31}\/providers\/[a-z0-9][a-z0-9-]{0,31}$/.test(normalizedProvider)) {
    throw new Error("GOOGLE_WORKLOAD_IDENTITY_PROVIDER must be the full provider resource name (projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/POOL/providers/PROVIDER).");
  }
  const normalizedEmail = serviceAccountEmail?.trim();
  if (!normalizedEmail || !/^[^@\s]+@[^@\s]+\.iam\.gserviceaccount\.com$/.test(normalizedEmail)) {
    throw new Error("GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL must be the service account email ending in .iam.gserviceaccount.com.");
  }
  return { provider: normalizedProvider, serviceAccountEmail: normalizedEmail };
}

if (require.main === module) {
  try {
    readPlayWifConfig(process.env.GOOGLE_WORKLOAD_IDENTITY_PROVIDER, process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL);
    const config = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../app.json"), "utf8")).expo;
    const packageName = config?.android?.package;
    if (typeof packageName !== "string" || !/^([a-zA-Z][\w]*\.)+[a-zA-Z][\w]*$/.test(packageName)) {
      throw new Error("app.json must define a valid expo.android.package.");
    }
    if (typeof config.version !== "string" || !/^\d+\.\d+\.\d+$/.test(config.version)) {
      throw new Error("app.json must define a numeric expo.version such as 1.0.0.");
    }
    if (!process.env.GITHUB_OUTPUT) throw new Error("GITHUB_OUTPUT is required for Play upload preparation.");
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `package_name=${packageName}\nversion_name=${config.version}\n`);
    console.log(`Prepared GitHub OIDC authentication for ${packageName} to internal (draft).`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { readPlayWifConfig };
