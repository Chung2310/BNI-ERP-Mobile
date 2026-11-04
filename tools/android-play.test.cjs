const assert = require("node:assert/strict");
const { execFileSync, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..");
const temporaryRoot = path.join(root, "node_modules/.tmp");
fs.mkdirSync(temporaryRoot, { recursive: true });
const env = {
  ...process.env,
  EXPO_PUBLIC_API_URL: "https://api.igen.test",
  ANDROID_VERSION_CODE: "12",
  EAS_PROJECT_ID: "",
  ANDROID_KEYSTORE_PATH: "",
  ANDROID_KEYSTORE_PASSWORD: "",
  ANDROID_KEY_ALIAS: "",
  ANDROID_KEY_PASSWORD: "",
};

function check(overrides, args = []) {
  return spawnSync(process.execPath, [path.join(__dirname, "check-play-build.cjs"), ...args], {
    cwd: root, env: { ...env, ...overrides }, encoding: "utf8",
  });
}

test("automatic version codes increase between builds and retries and remain within Play limits", t => {
  const { androidVersionCode } = require("./set-android-version-code.cjs");
  assert.equal(androidVersionCode("1", "1"), 101);
  assert.ok(androidVersionCode("1", "2") > androidVersionCode("1", "1"));
  assert.ok(androidVersionCode("2", "1") > androidVersionCode("1", "99"));
  for (const [number, attempt] of [["", "1"], ["0", "1"], ["1.5", "1"], ["1", "0"], ["1", "100"], ["21000000", "1"]]) {
    assert.throws(() => androidVersionCode(number, attempt), `${number}/${attempt}`);
  }
  const directory = fs.mkdtempSync(path.join(temporaryRoot, "igen-play-version-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const githubEnv = path.join(directory, "github-env");
  const result = spawnSync(process.execPath, [path.join(__dirname, "set-android-version-code.cjs")], {
    cwd: root,
    env: { ...process.env, GITHUB_RUN_NUMBER: "12", GITHUB_RUN_ATTEMPT: "2", GITHUB_ENV: githubEnv, ANDROID_VERSION_CODE: "old-value" },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(githubEnv, "utf8"), "ANDROID_VERSION_CODE=1202\n");
});

test("Android production config preserves iOS and the standalone APK configuration", () => {
  const config = require("../app.json").expo;
  const evaluate = variant => JSON.parse(execFileSync(process.execPath, ["-e",
    "console.log(JSON.stringify(require('./app.config.js')({config: require('./app.json').expo})))",
  ], { cwd: root, env: { ...process.env, APP_VARIANT: variant, ANDROID_VERSION_CODE: "12", GOOGLE_SERVICES_JSON: "", IOS_BUILD_PROFILE: "", IOS_BUILD_PLATFORM: "", EXPO_OS: "" }, encoding: "utf8" }));
  const preview = evaluate("");
  const production = evaluate("production");
  assert.deepEqual(preview, config);
  assert.deepEqual(production.ios, config.ios);
  assert.equal(production.android.versionCode, 12);
  assert.ok(production.plugins.includes("./plugins/withAndroidPlaySigning.cjs"));
  const originalBuildOptions = config.plugins.find(plugin => Array.isArray(plugin) && plugin[0] === "expo-build-properties")[1];
  const playBuildOptions = production.plugins.find(plugin => Array.isArray(plugin) && plugin[0] === "expo-build-properties")[1];
  assert.deepEqual(playBuildOptions.android.buildArchs, ["armeabi-v7a", "arm64-v8a", "x86", "x86_64"]);
  assert.equal(playBuildOptions.android.useLegacyPackaging, false);
  assert.equal(playBuildOptions.android.enableMinifyInReleaseBuilds, originalBuildOptions.android.enableMinifyInReleaseBuilds);
  assert.equal(production.extra.eas.projectId, config.extra.eas.projectId);
});

test("iOS production retains its config and API validation when Android release variables exist", () => {
  const config = require("../app.json").expo;
  const evaluate = overrides => spawnSync(process.execPath, ["-e",
    "console.log(JSON.stringify(require('./app.config.js')({config: require('./app.json').expo})))",
  ], {
    cwd: root,
    env: {
      ...process.env, APP_VARIANT: "production", ANDROID_VERSION_CODE: "12",
      GOOGLE_SERVICES_JSON: "android-only.json", IOS_BUILD_PROFILE: "production",
      IOS_BUILD_PLATFORM: "ios", EXPO_PUBLIC_API_URL: "https://api.igen.test", ...overrides,
    },
    encoding: "utf8",
  });
  const result = evaluate({});
  assert.equal(result.status, 0, result.stderr);
  const iosConfig = JSON.parse(result.stdout);
  const expected = { ...config, android: { ...config.android } };
  delete expected.android.googleServicesFile;
  assert.deepEqual(iosConfig, expected);
  assert.notEqual(evaluate({ EXPO_PUBLIC_API_URL: "http://localhost:3000" }).status, 0);
  assert.notEqual(evaluate({ EXPO_PUBLIC_API_URL: "" }).status, 0);
});

test("Play preflight works without EAS and rejects missing or invalid release inputs", t => {
  const directory = fs.mkdtempSync(path.join(temporaryRoot, "igen-play-config-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const firebase = path.join(directory, "google-services.json");
  fs.writeFileSync(firebase, JSON.stringify({ client: [{ client_info: { android_client_info: { package_name: "com.igen.connect" } } }] }));
  const valid = { GOOGLE_SERVICES_JSON: firebase };
  assert.equal(check(valid).status, 0);
  assert.notEqual(check({ ...valid, EXPO_PUBLIC_API_URL: "http://localhost:3012" }).status, 0);
  for (const version of ["", "0", "-1", "1.2", "1e3", "2100000001"]) {
    assert.notEqual(check({ ...valid, ANDROID_VERSION_CODE: version }).status, 0, version);
  }
  assert.notEqual(check(valid, ["--signing"]).status, 0);
  fs.writeFileSync(firebase, JSON.stringify({ client: [{ client_info: { android_client_info: { package_name: "wrong.package" } } }] }));
  assert.notEqual(check(valid).status, 0);
});

test("AAB verifier rejects unsigned, wrong-key and debug-signed archives", async t => {
  const directory = fs.mkdtempSync(path.join(temporaryRoot, "igen-play-signature-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const command = (name, args) => execFileSync(name, [
    ...(name === "jar" || name === "jarsigner" ? [`-J-Djava.io.tmpdir=${directory}`] : []), ...args,
  ], { cwd: directory, stdio: "pipe" });
  const signing = {
    ...env,
    ANDROID_KEYSTORE_PATH: path.join(directory, "upload.jks"),
    ANDROID_KEYSTORE_PASSWORD: "test-password-only",
    ANDROID_KEY_ALIAS: "igen-test-upload",
    ANDROID_KEY_PASSWORD: "test-password-only",
  };
  const createKey = (file, cn) => command("keytool", [
    "-genkeypair", "-keystore", file, "-storetype", "JKS", "-alias", signing.ANDROID_KEY_ALIAS,
    "-storepass", signing.ANDROID_KEYSTORE_PASSWORD, "-keypass", signing.ANDROID_KEY_PASSWORD,
    "-keyalg", "RSA", "-keysize", "2048", "-validity", "2", "-dname", `CN=${cn}`, "-noprompt",
  ]);
  createKey("upload.jks", "iGen Test Upload");
  createKey("other.jks", "Other Test Upload");
  createKey("debug.jks", "Android Debug");
  const assets = path.join(directory, "base/assets");
  fs.mkdirSync(assets, { recursive: true });
  fs.writeFileSync(path.join(assets, "index.android.bundle"), "test fixture");
  command("jar", ["cf", "unsigned.aab", "base"]);
  const verify = (file, overrides) => spawnSync(process.execPath, [path.join(__dirname, "verify-android-aab.cjs"), path.join(directory, file)], {
    cwd: directory, env: { ...signing, ...overrides }, encoding: "utf8",
  });
  const sign = (file, key) => {
    fs.copyFileSync(path.join(directory, "unsigned.aab"), path.join(directory, file));
    command("jarsigner", ["-keystore", key, "-storepass", signing.ANDROID_KEYSTORE_PASSWORD,
      "-keypass", signing.ANDROID_KEY_PASSWORD, file, signing.ANDROID_KEY_ALIAS]);
  };
  await t.test("unsigned archive", () => {
    assert.notEqual(verify("unsigned.aab").status, 0);
  });
  await t.test("matching upload certificate", () => {
    sign("valid.aab", "upload.jks");
    const result = verify("valid.aab");
    assert.equal(result.status, 0, result.stderr);
  });
  await t.test("different upload certificate", () => {
    sign("other.aab", "other.jks");
    assert.notEqual(verify("other.aab").status, 0);
  });
  await t.test("debug certificate even when it matches the supplied keystore", () => {
    sign("debug.aab", "debug.jks");
    assert.notEqual(verify("debug.aab", { ANDROID_KEYSTORE_PATH: path.join(directory, "debug.jks") }).status, 0);
  });
  await t.test("unsigned entries added after signing", () => {
    fs.copyFileSync(path.join(directory, "valid.aab"), path.join(directory, "partial.aab"));
    fs.writeFileSync(path.join(directory, "unsigned.txt"), "unsigned extra content");
    command("jar", ["uf", "partial.aab", "unsigned.txt"]);
    assert.notEqual(verify("partial.aab").status, 0);
  });
});
