const { withNativeWind } = require("nativewind/metro");
const { getSentryExpoConfig } = require("@sentry/react-native/metro");
const path = require("path");

const config = getSentryExpoConfig(__dirname);

// Enhanced Supabase resolver workaround
config.resolver = {
  ...config.resolver,
  unstable_conditionNames: ["browser"],
  unstable_enablePackageExports: false,
  alias: {
    ...config.resolver?.alias,
    // Add crypto polyfill if needed
    crypto: require.resolve("expo-crypto"),
  },
};

// Apply NativeWind
const nativeWindConfig = withNativeWind(config, { input: "./global.css" });

// Obfuscator plugin
const jsoMetroPlugin = require("obfuscator-io-metro-plugin")(
  {
    compact: false,
    sourceMap: false,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 1,
    numbersToExpressions: true,
    simplify: true,
    stringArrayShuffle: true,
    splitStrings: true,
    stringArrayThreshold: 1,
  },
  {
    runInDev: false,
    logObfuscatedFiles: true,
    filter: (filename) => {
      // Only obfuscate files in your project, not in node_modules
      return !filename.includes(`${path.sep}node_modules${path.sep}`);
    },
  },
);

// Merge everything into one export
module.exports = {
  ...nativeWindConfig,
  transformer: {
    ...nativeWindConfig.transformer,
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: false,
      },
    }),
  },
  ...jsoMetroPlugin,
};
