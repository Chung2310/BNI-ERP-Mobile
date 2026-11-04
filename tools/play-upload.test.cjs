const assert = require("node:assert/strict");
const { generateKeyPairSync } = require("node:crypto");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { readPlayServiceAccount } = require("./prepare-play-upload.cjs");

test("Play upload rejects missing credentials and a Firebase client config", () => {
  for (const value of [undefined, "", " ", "not-json", Buffer.from("{}").toString("base64"), "null",
    JSON.stringify({ project_info: { project_id: "firebase-client" }, client: [] }),
    JSON.stringify({ type: "service_account", project_id: "test", client_email: "invalid", private_key: "secret-invalid-key" })]) {
    assert.throws(() => readPlayServiceAccount(value), /GOOGLE_PLAY_SERVICE_ACCOUNT_JSON/);
  }
  assert.throws(() => readPlayServiceAccount(JSON.stringify({
    type: "service_account", project_id: "test", client_email: "upload@test.iam.gserviceaccount.com", private_key: "secret-invalid-key",
  })), error => !error.message.includes("secret-invalid-key") && /invalid RSA private key/.test(error.message));
});

test("Play upload uses RUNNER_TEMP and resolves Android package from app config without logging credentials", t => {
  const root = path.resolve(__dirname, "..");
  const config = require("../app.json").expo;
  const tempRoot = path.join(root, "node_modules/.tmp");
  fs.mkdirSync(tempRoot, { recursive: true });
  const directory = fs.mkdtempSync(path.join(tempRoot, "play-upload-test-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const account = {
    type: "service_account", project_id: "play-upload-test",
    client_email: "upload@play-upload-test.iam.gserviceaccount.com",
    private_key: generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({ type: "pkcs8", format: "pem" }),
  };
  assert.deepEqual(readPlayServiceAccount(JSON.stringify(account)), account);
  const githubOutput = path.join(directory, "github-output");
  const result = spawnSync(process.execPath, [path.join(__dirname, "prepare-play-upload.cjs")], {
    cwd: root,
    env: { ...process.env, GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: JSON.stringify(account), RUNNER_TEMP: directory, GITHUB_OUTPUT: githubOutput },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(directory, "google-play-service-account.json"), "utf8")), account);
  assert.equal(fs.readFileSync(githubOutput, "utf8"), `package_name=${config.android.package}\nversion_name=${config.version}\n`);
  assert.ok(!result.stdout.includes(account.private_key) && !result.stderr.includes(account.private_key));
});
