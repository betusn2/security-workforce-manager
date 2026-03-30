const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Config plugin to remove Flipper references from MainApplication.kt.
 * Flipper was removed in React Native 0.74 but the prebuild template for
 * RN 0.73 still generates it, causing compilation errors.
 * Uses line-by-line processing (reliable across all line endings and formats).
 */
const withNoFlipper = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const platformRoot = config.modRequest.platformProjectRoot;
      const mainAppPath = path.join(
        platformRoot,
        'app', 'src', 'main', 'java', 'com', 'securityguard', 'mobile',
        'MainApplication.kt'
      );

      console.log('[withNoFlipper] platformProjectRoot:', platformRoot);
      console.log('[withNoFlipper] Looking for:', mainAppPath);
      console.log('[withNoFlipper] File exists:', fs.existsSync(mainAppPath));

      if (fs.existsSync(mainAppPath)) {
        const raw = fs.readFileSync(mainAppPath, 'utf8');
        const lines = raw.split('\n');
        const out = [];
        let i = 0;

        while (i < lines.length) {
          const line = lines[i];

          // Remove any import line that contains "flipper" (case-insensitive)
          if (/^\s*import\s/i.test(line) && /flipper/i.test(line)) {
            console.log('[withNoFlipper] Removing import:', line.trim());
            i++;
            continue;
          }

          // Detect an if (BuildConfig.DEBUG) block that contains flipper/ReactNativeFlipper
          if (/^\s*if\s*\(BuildConfig\.DEBUG\)/.test(line)) {
            // Scan ahead to determine if block is flipper-related
            let j = i;
            let depth = 0;
            let hasFlipper = false;
            // Count braces starting from the if line
            while (j < lines.length) {
              const l = lines[j];
              depth += (l.match(/\{/g) || []).length;
              depth -= (l.match(/\}/g) || []).length;
              if (/flipper|ReactNativeFlipper|initializeFlipper/i.test(l)) {
                hasFlipper = true;
              }
              j++;
              if (depth <= 0 && j > i) break;
            }
            if (hasFlipper) {
              console.log('[withNoFlipper] Removing DEBUG/Flipper block lines', i, 'to', j - 1);
              i = j;
              continue;
            }
          }

          // Remove any other line mentioning ReactNativeFlipper or initializeFlipper
          if (/ReactNativeFlipper|initializeFlipper/i.test(line)) {
            console.log('[withNoFlipper] Removing line:', line.trim());
            i++;
            continue;
          }

          out.push(line);
          i++;
        }

        const result = out.join('\n');
        if (result !== raw) {
          fs.writeFileSync(mainAppPath, result, 'utf8');
          console.log('[withNoFlipper] ✓ MainApplication.kt patched successfully');
        } else {
          console.log('[withNoFlipper] No Flipper references found, file unchanged');
        }
      } else {
        // File not found — log directory contents to help debug
        console.warn('[withNoFlipper] ⚠ MainApplication.kt not found!');
        const javaRoot = path.join(platformRoot, 'app', 'src', 'main', 'java');
        if (fs.existsSync(javaRoot)) {
          const walk = (dir, depth = 0) => {
            if (depth > 4) return;
            fs.readdirSync(dir).forEach((f) => {
              console.log('[withNoFlipper]' + '  '.repeat(depth) + f);
              const full = path.join(dir, f);
              if (fs.statSync(full).isDirectory()) walk(full, depth + 1);
            });
          };
          walk(javaRoot);
        } else {
          console.warn('[withNoFlipper] java source dir does not exist:', javaRoot);
        }
      }

      return config;
    },
  ]);
};

module.exports = withNoFlipper;
