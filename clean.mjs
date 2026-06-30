import fs from 'fs';
import path from 'path';

function cleanDir(baseDir) {
  if (!fs.existsSync(baseDir)) return;
  const dirs = fs.readdirSync(baseDir);
  for (const d of dirs) {
    const dist = path.join(baseDir, d, 'dist');
    const tsbuildinfo = path.join(baseDir, d, 'tsconfig.tsbuildinfo');
    if (fs.existsSync(dist)) {
      fs.rmSync(dist, { recursive: true, force: true });
    }
    if (fs.existsSync(tsbuildinfo)) {
      fs.rmSync(tsbuildinfo, { force: true });
    }
  }
}

cleanDir(path.join(process.cwd(), 'packages'));
cleanDir(path.join(process.cwd(), 'apps'));
console.log('Cleaned all dists');
