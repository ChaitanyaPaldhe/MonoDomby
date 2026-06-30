import fs from 'fs';
import path from 'path';

const packagesDir = path.join(process.cwd(), 'packages');
const appsDir = path.join(process.cwd(), 'apps');

function getWorkspaceDeps(pkgJson) {
  const deps = { ...pkgJson.dependencies, ...pkgJson.devDependencies };
  const wsDeps = [];
  for (const [name, version] of Object.entries(deps)) {
    if (version.startsWith('workspace:') && name.startsWith('@monopoly/')) {
      wsDeps.push(name.replace('@monopoly/', ''));
    }
  }
  return wsDeps;
}

function processDir(dir, isApp) {
  if (!fs.existsSync(dir)) return;
  const dirs = fs.readdirSync(dir);

  for (const d of dirs) {
    const pkgPath = path.join(dir, d, 'package.json');
    const tsconfigPath = path.join(dir, d, 'tsconfig.json');

    if (!fs.existsSync(pkgPath) || !fs.existsSync(tsconfigPath)) continue;

    // Process package.json
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    pkg.type = 'module';
    
    if (!isApp) {
      pkg.main = './dist/index.js';
      pkg.types = './dist/index.d.ts';
      pkg.exports = {
        '.': {
          import: './dist/index.js',
          default: './dist/index.js'
        }
      };
      
      // Fix build script to use tsc --build
      if (pkg.scripts && pkg.scripts.build) {
        pkg.scripts.build = 'tsc --build';
      }
    } else {
      if (pkg.scripts && pkg.scripts.build === 'tsc') {
        pkg.scripts.build = 'tsc --build';
      }
    }
    
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));

    // Process tsconfig.json
    const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
    
    if (!tsconfig.compilerOptions) tsconfig.compilerOptions = {};
    tsconfig.compilerOptions.composite = true;
    tsconfig.compilerOptions.rootDir = './src';
    tsconfig.compilerOptions.outDir = './dist';
    
    // Add references
    const wsDeps = getWorkspaceDeps(pkg);
    if (wsDeps.length > 0) {
      tsconfig.references = wsDeps.map(dep => {
        // Find if dep is in apps or packages
        if (fs.existsSync(path.join(packagesDir, dep))) {
          return { path: `../../packages/${dep}` };
        } else if (fs.existsSync(path.join(appsDir, dep))) {
          return { path: `../../apps/${dep}` };
        }
        return { path: `../../packages/${dep}` }; // Default
      });
    } else {
      delete tsconfig.references;
    }

    // Server has a weird paths override that we can remove, we rely on base paths or TS project references
    if (d === 'server' && tsconfig.compilerOptions.paths) {
      delete tsconfig.compilerOptions.paths;
    }

    fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2));
  }
}

processDir(packagesDir, false);
processDir(appsDir, true);

// Fix tsconfig.base.json to make sure composite is true and paths points to src 
// (which is correct for TS project references as long as references are set)
const baseTsConfigPath = path.join(process.cwd(), 'tsconfig.base.json');
const baseTsConfig = JSON.parse(fs.readFileSync(baseTsConfigPath, 'utf8'));
baseTsConfig.compilerOptions.composite = true;
fs.writeFileSync(baseTsConfigPath, JSON.stringify(baseTsConfig, null, 2));

console.log('Fixed workspace configs');
