const fs = require("node:fs");
const path = require("node:path");
const { getConfig } = require("expo/config");
const { loadProjectEnv } = require("@expo/env");

process.env.APP_VARIANT = "production";
const root = path.resolve(__dirname, "..");
loadProjectEnv(root, { mode: "production", silent: true });
const { exp } = getConfig(root);
const failures = [];
const apiUrl = process.env.EXPO_PUBLIC_API_URL;
try {
  const url = new URL(apiUrl);
  if (url.protocol !== "https:" || /(^|\.)(localhost|example\.com|invalid)$/.test(url.hostname)
    || url.hostname === "127.0.0.1" || url.hostname === "[::1]" || url.username || url.password) {
    throw new Error("Invalid production API URL");
  }
} catch { failures.push("Đặt EXPO_PUBLIC_API_URL thành địa chỉ HTTPS của backend phát hành."); }

const versionCode = process.env.ANDROID_VERSION_CODE || "";
if (!/^[1-9]\d*$/.test(versionCode) || Number(versionCode) > 2100000000) {
  failures.push("Đặt ANDROID_VERSION_CODE là số nguyên từ 1 đến 2100000000, lớn hơn mọi bản đã upload lên Play.");
}
try {
  const googleServices = JSON.parse(fs.readFileSync(path.resolve(root, exp.android.googleServicesFile), "utf8"));
  if (!googleServices.client?.some(client => client.client_info?.android_client_info?.package_name === exp.android.package)) {
    failures.push("Firebase google-services.json phải khớp Android package của ứng dụng.");
  }
} catch { failures.push("Cung cấp google-services.json hợp lệ hoặc biến file GOOGLE_SERVICES_JSON."); }

if (process.argv.includes("--signing")) {
  const keystore = process.env.ANDROID_KEYSTORE_PATH;
  if (!keystore || !path.isAbsolute(keystore) || !fs.existsSync(keystore) || !fs.statSync(keystore).isFile()) {
    failures.push("Đặt ANDROID_KEYSTORE_PATH thành đường dẫn tuyệt đối tới upload keystore.");
  }
  for (const name of ["ANDROID_KEYSTORE_PASSWORD", "ANDROID_KEY_ALIAS", "ANDROID_KEY_PASSWORD"]) {
    if (!process.env[name]) failures.push(`Thiếu biến ký Android: ${name}.`);
  }
  if (process.env.ANDROID_KEY_ALIAS?.toLowerCase() === "androiddebugkey") {
    failures.push("Bản Google Play phải dùng upload key riêng, không dùng androiddebugkey.");
  }
}

if (failures.length) {
  failures.forEach(message => console.error(message));
  process.exitCode = 1;
} else {
  console.log(`Cấu hình Google Play hợp lệ cho ${exp.android.package}.`);
}
