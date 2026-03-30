const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Config plugin to remove Flipper references from MainApplication.kt.
 * Flipper was removed in React Native 0.74 but the prebuild template for
 * RN 0.73 still generates it, causing compilation errors.
 */
const withNoFlipper = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const mainAppPath = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'java',
        'com',
        'securityguard',
        'mobile',
        'MainApplication.kt'
      );

      if (fs.existsSync(mainAppPath)) {
        let contents = fs.readFileSync(mainAppPath, 'utf8');

        // Remove Flipper import
        contents = contents.replace(
          /import com\.facebook\.react\.flipper\.\S+\n?/g,
          ''
        );
        contents = contents.replace(
          /import com\.securityguard\.mobile\.flipper\.\S+\n?/g,
          ''
        );

        // Remove ReactNativeFlipper call and its surrounding block
        contents = contents.replace(
          /\s*if\s*\(BuildConfig\.DEBUG\)\s*\{[^}]*ReactNativeFlipper[^}]*\}\s*/g,
          '\n'
        );

        // Remove standalone ReactNativeFlipper call
        contents = contents.replace(/\s*ReactNativeFlipper\.[^\n]+\n?/g, '\n');

        // Remove initializeFlipper call
        contents = contents.replace(/\s*initializeFlipper\([^\n]+\n?/g, '\n');

        // Remove the initializeFlipper function definition
        contents = contents.replace(
          /\s*private fun initializeFlipper[\s\S]*?^\s*\}/m,
          ''
        );

        fs.writeFileSync(mainAppPath, contents);
        console.log('[withNoFlipper] Removed Flipper references from MainApplication.kt');
      } else {
        console.warn('[withNoFlipper] MainApplication.kt not found at', mainAppPath);
      }

      return config;
    },
  ]);
};

module.exports = withNoFlipper;
