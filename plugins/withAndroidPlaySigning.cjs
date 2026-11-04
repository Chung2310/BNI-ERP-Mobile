const { withAppBuildGradle } = require("expo/config-plugins");

// Read credentials only when Gradle runs; never embed passwords in app config
// or generated native source. A production build must never use the debug key.
const signingBlock = `
// BEGIN IGEN PLAY SIGNING
def playCredential = { String name ->
    def value = System.getenv(name)
    if (value == null || value.isEmpty()) {
        throw new GradleException("Missing Android signing variable: " + name)
    }
    return value
}
android {
    signingConfigs {
        playRelease {
            storeFile file(playCredential("ANDROID_KEYSTORE_PATH"))
            storePassword playCredential("ANDROID_KEYSTORE_PASSWORD")
            keyAlias playCredential("ANDROID_KEY_ALIAS")
            keyPassword playCredential("ANDROID_KEY_PASSWORD")
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.playRelease
        }
    }
}
// END IGEN PLAY SIGNING
`;

module.exports = config => withAppBuildGradle(config, config => {
  if (config.modResults.language !== "groovy") {
    throw new Error("Google Play signing requires a Groovy app/build.gradle.");
  }
  const contents = config.modResults.contents.replace(
    /\n\/\/ BEGIN IGEN PLAY SIGNING[\s\S]*?\/\/ END IGEN PLAY SIGNING\n?/g,
    "",
  );
  config.modResults.contents = contents.trimEnd() + "\n" + signingBlock;
  return config;
});
