const fs = require("node:fs");

function androidVersionCode(runNumber, runAttempt) {
  if (!/^[1-9]\d*$/.test(runNumber ?? "") || !/^[1-9]\d*$/.test(runAttempt ?? "")) {
    throw new Error("GitHub run number and attempt must be positive integers.");
  }
  const number = Number(runNumber);
  const attempt = Number(runAttempt);
  if (!Number.isSafeInteger(number) || attempt >= 100) {
    throw new Error("Start a new workflow run after 99 attempts.");
  }
  const versionCode = number * 100 + attempt;
  if (!Number.isSafeInteger(versionCode) || versionCode > 2100000000) {
    throw new Error("Android versionCode exceeds the Google Play limit.");
  }
  return versionCode;
}

if (require.main === module) {
  try {
    const versionCode = androidVersionCode(process.env.GITHUB_RUN_NUMBER, process.env.GITHUB_RUN_ATTEMPT);
    if (!process.env.GITHUB_ENV) throw new Error("GITHUB_ENV is required.");
    fs.appendFileSync(process.env.GITHUB_ENV, `ANDROID_VERSION_CODE=${versionCode}\n`);
    console.log(`Android versionCode: ${versionCode}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { androidVersionCode };
