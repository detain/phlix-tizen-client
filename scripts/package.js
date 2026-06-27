/**
 * Tizen packaging script
 * Creates the `package/` directory (input to Tizen Studio / `tizen` CLI .wgt
 * signing) from the Vite build output.
 *
 * ESM module ("type":"module" in package.json). Run via `npm run package`,
 * which builds first (`npm run build` → dist/) then invokes this.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const distDir = path.join(root, 'dist');
const pkgDir = path.join(root, 'package');

function packageApp() {
  console.log('Packaging Tizen app...');

  if (!fs.existsSync(distDir)) {
    console.error('Run build first: npm run build');
    process.exit(1);
  }

  // Fresh package directory.
  if (fs.existsSync(pkgDir)) {
    fs.rmSync(pkgDir, { recursive: true });
  }
  fs.mkdirSync(pkgDir);

  // Copy the Vite output (index.html + assets/ at the widget root).
  execSync(`cp -r ${distDir}/* ${pkgDir}/`, { stdio: 'inherit' });

  // Copy the Tizen widget manifest to the package root.
  execSync(`cp ${path.join(root, 'app/config.xml')} ${pkgDir}/`, { stdio: 'inherit' });

  // Sanity-check: the widget entry + manifest must be at the package root.
  const indexAtRoot = fs.existsSync(path.join(pkgDir, 'index.html'));
  const configAtRoot = fs.existsSync(path.join(pkgDir, 'config.xml'));
  if (!indexAtRoot || !configAtRoot) {
    console.error(
      `Packaging incomplete: index.html=${indexAtRoot}, config.xml=${configAtRoot} at ${pkgDir}`
    );
    process.exit(1);
  }

  console.log('Package created in:', pkgDir);
  console.log('Note: Use Tizen Studio (or the tizen CLI) to sign and deploy the .wgt file');
}

packageApp();
