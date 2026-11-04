const { execFileSync } = require("node:child_process");
const path = require("node:path");
const { loadProjectEnv } = require("@expo/env");

const root = path.resolve(__dirname, "..");
loadProjectEnv(root, { mode: "production", silent: true });
process.env.APP_VARIANT = "production";
process.env.EXPO_PUBLIC_USE_RN_FETCH = "1";

try {
  const options = { cwd: root, stdio: "inherit" };
  execFileSync(process.execPath, [path.join(__dirname, "check-play-build.cjs"), "--signing"], options);
  execFileSync(process.execPath, [require.resolve("expo/bin/cli"), "prebuild", "--platform", "android", "--clean", "--no-install"], options);
  const androidOptions = { ...options, cwd: path.join(root, "android") };
  if (process.platform === "win32") {
    execFileSync("cmd.exe", ["/d", "/s", "/c", "gradlew.bat app:bundleRelease --no-daemon --stacktrace"], androidOptions);
  } else {
    execFileSync("./gradlew", ["app:bundleRelease", "--no-daemon", "--stacktrace"], androidOptions);
  }
  execFileSync(process.execPath, [path.join(__dirname, "verify-android-aab.cjs")], options);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
