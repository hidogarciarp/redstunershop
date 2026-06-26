import fs from 'fs';
import path from 'path';

function searchInDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.next') {
        searchInDir(fullPath);
      }
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      if (content.includes('NitroAdminPage')) {
        console.log(`Found in: ${fullPath}`);
      }
    }
  }
}

searchInDir('c:/Users/Garrido/registro-servicos/app');
searchInDir('c:/Users/Garrido/registro-servicos');
