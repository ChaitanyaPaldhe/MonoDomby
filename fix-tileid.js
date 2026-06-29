const fs = require('fs');
const path = require('path');

function fix(dir) {
  if (!fs.existsSync(dir)) return;
  for (const file of fs.readdirSync(dir)) {
    const full = path.join(dir, file);
    if (fs.statSync(full).isDirectory()) {
      fix(full);
    } else if (full.endsWith('.ts')) {
      let content = fs.readFileSync(full, 'utf8');
      
      const sharedTypes = ['TileId', 'TileState', 'ErrorCode'];
      
      // We will look for imports from '@monopoly/maps' that include these,
      // and separate them into '@monopoly/shared'.
      
      sharedTypes.forEach(t => {
        const regex = new RegExp(`import\\s+(type\\s+)?\\{\\s*([^}]*\\b${t}\\b[^}]*)\\s*\\}\\s+from\\s+['"]@monopoly\\/maps['"]`, 'g');
        content = content.replace(regex, (match, typeKeyword, group) => {
          const types = group.split(',').map(s => s.trim()).filter(s => s);
          const shTypes = types.filter(type => sharedTypes.some(st => type.includes(st)));
          const maTypes = types.filter(type => !sharedTypes.some(st => type.includes(st)));

          let res = `import ${typeKeyword || ''}{ ${shTypes.join(', ')} } from '@monopoly/shared';`;
          if (maTypes.length > 0) {
            res += `\nimport ${typeKeyword || ''}{ ${maTypes.join(', ')} } from '@monopoly/maps';`;
          }
          return res;
        });
      });
      
      fs.writeFileSync(full, content, 'utf8');
    }
  }
}

fix(path.join(__dirname, 'packages', 'engine'));
fix(path.join(__dirname, 'apps', 'server'));
