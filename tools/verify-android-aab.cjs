const { execFileSync } = require("node:child_process");
const { X509Certificate } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const aab = process.argv[2] ? path.resolve(process.argv[2])
  : path.resolve(__dirname, "../android/app/build/outputs/bundle/release/app-release.aab");
try {
  if (!fs.statSync(aab).isFile()) throw new Error("Missing release AAB.");
  const entries = execFileSync("jar", ["tf", aab], { encoding: "utf8" }).split(/\r?\n/);
  if (!entries.includes("base/assets/index.android.bundle")) throw new Error("AAB is missing its JavaScript bundle.");
  const verification = execFileSync("jarsigner", ["-J-Duser.language=en", "-J-Duser.country=US", "-verify", aab], { encoding: "utf8" });
  // jarsigner also exits 0 for an unsigned archive, so check its success message.
  if (!verification.includes("jar verified.") || /unsigned entries/i.test(verification)) {
    throw new Error("AAB signature verification failed.");
  }
  const certificate = execFileSync("keytool", ["-printcert", "-jarfile", aab, "-rfc"], { encoding: "utf8" });
  const expected = execFileSync("keytool", [
    "-exportcert", "-keystore", process.env.ANDROID_KEYSTORE_PATH,
    "-alias", process.env.ANDROID_KEY_ALIAS, "-storepass:env", "ANDROID_KEYSTORE_PASSWORD",
  ]);
  const actualCertificate = new X509Certificate(certificate);
  if (actualCertificate.fingerprint256 !== new X509Certificate(expected).fingerprint256) {
    throw new Error("AAB was signed with a different upload certificate.");
  }
  if (/CN\s*=\s*Android Debug/i.test(actualCertificate.subject)) throw new Error("AAB uses the Android debug certificate.");
  console.log(`Verified signed AAB with embedded JavaScript: ${aab}`);
  console.log(`Upload certificate SHA-256: ${actualCertificate.fingerprint256}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
