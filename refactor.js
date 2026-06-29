const fs = require('fs');
const path = require('path');

function moveFile(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.renameSync(src, dest);
}

// 1. Move files
// Move Engine
const engineSrc = path.join(__dirname, 'apps/server/src/engine');
const engineDest = path.join(__dirname, 'packages/engine/src');
if (fs.existsSync(engineSrc)) {
  fs.mkdirSync(engineDest, { recursive: true });
  fs.cpSync(engineSrc, engineDest, { recursive: true });
  fs.rmSync(engineSrc, { recursive: true, force: true });
}

// Move Engine Tests
const engineTestSrc = path.join(__dirname, 'apps/server/tests/engine');
const engineTestDest = path.join(__dirname, 'packages/engine/tests');
if (fs.existsSync(engineTestSrc)) {
  fs.mkdirSync(engineTestDest, { recursive: true });
  fs.cpSync(engineTestSrc, engineTestDest, { recursive: true });
  fs.rmSync(engineTestSrc, { recursive: true, force: true });
}

// Move Protocol (SocketEvents)
moveFile(
  path.join(__dirname, 'packages/shared/src/types/SocketEvents.ts'),
  path.join(__dirname, 'packages/protocol/src/SocketEvents.ts')
);

// Move Maps (MapConfig)
moveFile(
  path.join(__dirname, 'packages/shared/src/types/MapConfig.ts'),
  path.join(__dirname, 'packages/maps/src/schema/MapConfig.ts')
);

// Remove MapConfig and SocketEvents from shared exports
const sharedIndex = path.join(__dirname, 'packages/shared/src/types/index.ts');
if (fs.existsSync(sharedIndex)) {
  let content = fs.readFileSync(sharedIndex, 'utf8');
  content = content.replace(/export\s+\*\s+from\s+['"]\.\/MapConfig\.js['"];?\n?/g, '');
  content = content.replace(/export\s+\*\s+from\s+['"]\.\/SocketEvents\.js['"];?\n?/g, '');
  fs.writeFileSync(sharedIndex, content);
}

// 2. Rewrite imports
const mapConfigTypes = [
  'PlayerToken', 'MapMeta', 'BankConfig', 'PropertyRents', 'PropertyData',
  'RailroadData', 'UtilityData', 'TaxData', 'TileCoordinates', 'Tile',
  'PropertyGroup', 'CardEffect', 'CardConfig', 'AuctionConfig', 'RulesConfig',
  'MapConfig'
];

const protocolTypes = [
  'ServerToClientEvents', 'ClientToServerEvents', 'InterServerEvents',
  'SocketData', 'SocketEvents'
];

function replaceImports(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // Replace intra-package shared imports if they were moved out
  if (filePath.includes('packages\\protocol') || filePath.includes('packages/protocol') ||
      filePath.includes('packages\\maps') || filePath.includes('packages/maps')) {
    content = content.replace(/from\s+['"]\.\/(.*)['"]/g, "from '@monopoly/shared'");
  }

  // Replace @monopoly/shared -> @monopoly/maps for MapConfig types
  mapConfigTypes.forEach(t => {
    // Regex for specific type imports (e.g. import { Tile } from '@monopoly/shared')
    const regex = new RegExp(`import\\s+(type\\s+)?\\{\\s*([^}]*\\b${t}\\b[^}]*)\\s*\\}\\s+from\\s+['"]@monopoly\\/shared['"]`, 'g');
    content = content.replace(regex, (match, typeKeyword, group) => {
      // Split the group into what belongs to maps vs shared
      const types = group.split(',').map(s => s.trim()).filter(s => s);
      const mapTypes = types.filter(type => mapConfigTypes.some(mt => new RegExp('\\b' + mt + '\\b').test(type)));
      const sharedTypes = types.filter(type => !mapConfigTypes.some(mt => new RegExp('\\b' + mt + '\\b').test(type)));

      let newImport = `import ${typeKeyword || ''}{ ${mapTypes.join(', ')} } from '@monopoly/maps';`;
      if (sharedTypes.length > 0) {
        newImport += `\nimport ${typeKeyword || ''}{ ${sharedTypes.join(', ')} } from '@monopoly/shared';`;
      }
      return newImport;
    });
  });

  // Replace @monopoly/shared -> @monopoly/protocol for SocketEvents types
  protocolTypes.forEach(t => {
    const regex = new RegExp(`import\\s+(type\\s+)?\\{\\s*([^}]*\\b${t}\\b[^}]*)\\s*\\}\\s+from\\s+['"]@monopoly\\/shared['"]`, 'g');
    content = content.replace(regex, (match, typeKeyword, group) => {
      const types = group.split(',').map(s => s.trim()).filter(s => s);
      const protTypes = types.filter(type => protocolTypes.some(pt => new RegExp('\\b' + pt + '\\b').test(type)));
      const sharedTypes = types.filter(type => !protocolTypes.some(pt => new RegExp('\\b' + pt + '\\b').test(type)));

      let newImport = `import ${typeKeyword || ''}{ ${protTypes.join(', ')} } from '@monopoly/protocol';`;
      if (sharedTypes.length > 0) {
        newImport += `\nimport ${typeKeyword || ''}{ ${sharedTypes.join(', ')} } from '@monopoly/shared';`;
      }
      return newImport;
    });
  });

  // Replace relative engine imports in apps/server
  if (filePath.includes('apps\\server') || filePath.includes('apps/server')) {
    if (!filePath.includes('tests')) {
      content = content.replace(/from\s+['"]\.\.?\/.*engine\/.*['"]/g, "from '@monopoly/engine'");
    } else {
      content = content.replace(/from\s+['"]\.\.?\/.*engine\/.*['"]/g, "from '@monopoly/engine'");
    }
  }

  // Replace relative engine test imports inside packages/engine/tests
  if (filePath.includes('packages\\engine\\tests') || filePath.includes('packages/engine/tests')) {
    content = content.replace(/from\s+['"]\.\.\/\.\.\/\.\.\/src\/engine\/(.*)['"]/g, "from '../src/$1'");
  }

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
  }
}

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const full = path.join(dir, file);
    if (fs.statSync(full).isDirectory()) {
      if (!['node_modules', 'dist', '.git'].includes(file)) {
        walk(full);
      }
    } else if (full.endsWith('.ts')) {
      replaceImports(full);
    }
  }
}

walk(path.join(__dirname, 'apps', 'server'));
walk(path.join(__dirname, 'packages', 'engine'));
walk(path.join(__dirname, 'packages', 'maps'));
walk(path.join(__dirname, 'packages', 'protocol'));
walk(path.join(__dirname, 'packages', 'shared'));
