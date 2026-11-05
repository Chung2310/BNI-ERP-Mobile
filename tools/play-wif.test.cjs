const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { readPlayWifConfig } = require("./prepare-play-wif.cjs");

const validProvider = "projects/123456789012/locations/global/workloadIdentityPools/github-actions/providers/bni-mobile-production";
const validEmail = "github-play-upload@igen-connect-513709.iam.gserviceaccount.com";

test("Play upload requires a full Cloud provider resource and service account email", () => {
  assert.throws(() => readPlayWifConfig(undefined, validEmail), /GOOGLE_WORKLOAD_IDENTITY_PROVIDER/);
  assert.throws(() => readPlayWifConfig("projects/my-project/locations/global/workloadIdentityPools/p/providers/x", validEmail), /GOOGLE_WORKLOAD_IDENTITY_PROVIDER/);
  assert.throws(() => readPlayWifConfig("projects/123/locations/us-central1/workloadIdentityPools/p/providers/x", validEmail), /GOOGLE_WORKLOAD_IDENTITY_PROVIDER/);
  assert.throws(() => readPlayWifConfig(validProvider, ""), /GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL/);
  assert.deepEqual(readPlayWifConfig(` ${validProvider} `, ` ${validEmail} `), {
    provider: validProvider,
    serviceAccountEmail: validEmail,
  });
});

test("Play upload preflight derives package/version without creating credentials", t => {
  const root = path.resolve(__dirname, "..");
  const config = require("../app.json").expo;
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "play-wif-test-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const githubOutput = path.join(directory, "github-output");
  const result = spawnSync(process.execPath, [path.join(__dirname, "prepare-play-wif.cjs")], {
    cwd: root,
    env: {
      ...process.env,
      GOOGLE_WORKLOAD_IDENTITY_PROVIDER: validProvider,
      GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL: validEmail,
      GITHUB_OUTPUT: githubOutput,
    },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(githubOutput, "utf8"), `package_name=${config.android.package}\nversion_name=${config.version}\n`);
  assert.ok(!fs.readdirSync(directory).some(name => name.endsWith(".json")));
  assert.match(result.stdout, /internal \(draft\)/);
});
