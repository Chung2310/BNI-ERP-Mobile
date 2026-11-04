const { createPrivateKey } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

function readPlayServiceAccount(raw) {
  if (!raw?.trim()) throw new Error("Missing GOOGLE_PLAY_SERVICE_ACCOUNT_JSON. Add the Google Play service account JSON to GitHub Secrets.");
  let account;
  try { account = JSON.parse(raw); }
  catch { throw new Error("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON must contain the original service account JSON, not Base64 or google-services.json."); }
  if (account?.type !== "service_account" || typeof account.project_id !== "string" || !account.project_id.trim()
    || typeof account.client_email !== "string" || !/^[^@\s]+@[^@\s]+\.iam\.gserviceaccount\.com$/.test(account.client_email)
    || typeof account.private_key !== "string") {
    throw new Error("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON must be a Google service account with project_id, client_email and private_key; google-services.json is the Android client config.");
  }
  try {
    if (createPrivateKey(account.private_key).asymmetricKeyType !== "rsa") throw new Error();
  } catch { throw new Error("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON contains an invalid RSA private key."); }
  return account;
}

if (require.main === module) {
  try {
    const account = readPlayServiceAccount(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON);
    const config = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../app.json"), "utf8")).expo;
    const packageName = config?.android?.package;
    if (typeof packageName !== "string" || !/^([a-zA-Z][\w]*\.)+[a-zA-Z][\w]*$/.test(packageName)) {
      throw new Error("app.json must define a valid expo.android.package.");
    }
    if (typeof config.version !== "string" || !/^\d+\.\d+\.\d+$/.test(config.version)) {
      throw new Error("app.json must define a numeric expo.version such as 1.0.0.");
    }
    if (!process.env.RUNNER_TEMP || !path.isAbsolute(process.env.RUNNER_TEMP) || !process.env.GITHUB_OUTPUT) {
      throw new Error("RUNNER_TEMP and GITHUB_OUTPUT are required for Play upload preparation.");
    }
    const credentialPath = path.join(process.env.RUNNER_TEMP, "google-play-service-account.json");
    fs.writeFileSync(credentialPath, JSON.stringify(account), { encoding: "utf8", mode: 0o600 });
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `package_name=${packageName}\nversion_name=${config.version}\n`);
    console.log(`Prepared Google Play upload for ${packageName} to internal (draft).`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { readPlayServiceAccount };
