#!/usr/bin/env node

import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

async function buildViewer() {
  console.log('Building React viewer...');

  try {
    // Build React app
    await esbuild.build({
      entryPoints: [path.join(rootDir, 'src/ui/viewer/index.tsx')],
      bundle: true,
      minify: true,
      sourcemap: false,
      target: ['es2020'],
      format: 'iife',
      outfile: path.join(rootDir, 'plugin/ui/viewer-bundle.js'),
      jsx: 'automatic',
      loader: {
        '.tsx': 'tsx',
        '.ts': 'ts'
      },
      define: {
        'process.env.NODE_ENV': '"production"'
      }
    });

    // Copy HTML template to build output, inlining tokens.css so the token
    // system is the last definition loaded and wins the cascade. See
    // .plan/viewer-ui-direction.md section 1 for rationale.
    const htmlTemplate = fs.readFileSync(
      path.join(rootDir, 'src/ui/viewer-template.html'),
      'utf-8'
    );
    const tokensCss = fs.readFileSync(
      path.join(rootDir, 'src/ui/tokens.css'),
      'utf-8'
    );
    // Inject at the very end of the first <style> block so token overrides
    // beat any earlier custom-property declarations in the template.
    const withTokens = htmlTemplate.replace(
      /<\/style>/,
      `\n/* --- inlined src/ui/tokens.css (Phase 1) --- */\n${tokensCss}\n</style>`
    );
    fs.writeFileSync(
      path.join(rootDir, 'plugin/ui/viewer.html'),
      withTokens
    );

    // Copy font assets
    const fontsDir = path.join(rootDir, 'src/ui/viewer/assets/fonts');
    const outputFontsDir = path.join(rootDir, 'plugin/ui/assets/fonts');

    if (fs.existsSync(fontsDir)) {
      fs.mkdirSync(outputFontsDir, { recursive: true });
      const fontFiles = fs.readdirSync(fontsDir);
      for (const file of fontFiles) {
        fs.copyFileSync(
          path.join(fontsDir, file),
          path.join(outputFontsDir, file)
        );
      }
    }

    // Copy icon SVG files
    const srcUiDir = path.join(rootDir, 'src/ui');
    const outputUiDir = path.join(rootDir, 'plugin/ui');
    const iconFiles = fs.readdirSync(srcUiDir).filter(file => file.startsWith('icon-thick-') && file.endsWith('.svg'));
    for (const file of iconFiles) {
      fs.copyFileSync(
        path.join(srcUiDir, file),
        path.join(outputUiDir, file)
      );
    }

    console.log('✓ React viewer built successfully');
    console.log('  - plugin/ui/viewer-bundle.js');
    console.log('  - plugin/ui/viewer.html (from viewer-template.html)');
    console.log('  - plugin/ui/assets/fonts/* (font files)');
    console.log(`  - plugin/ui/icon-thick-*.svg (${iconFiles.length} icon files)`);
  } catch (error) {
    console.error('Failed to build viewer:', error);
    process.exit(1);
  }
}

buildViewer();
