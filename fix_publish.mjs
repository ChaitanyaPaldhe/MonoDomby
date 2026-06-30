import fs from 'fs';
import path from 'path';

const packagesDir = path.join(process.cwd(), 'packages');
const appsDir = path.join(process.cwd(), 'apps');

function updateFilesField(dir) {
  if (!fs.existsSync(dir)) return;
  const dirs = fs.readdirSync(dir);

  for (const d of dirs) {
    const pkgPath = path.join(dir, d, 'package.json');
    if (!fs.existsSync(pkgPath)) continue;

    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    
    // Set files array for publishability
    pkg.files = ["dist"];

    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
  }
}

updateFilesField(packagesDir);
updateFilesField(appsDir);

console.log('Added "files": ["dist"] to all package.json files.');
