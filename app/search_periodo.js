const fs = require('fs');
const path = require('path');

function search(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.next' && file !== '.git') {
        search(full);
      }
    } else if (file.endsWith('.js') || file.endsWith('.jsx') || file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.sql')) {
      const content = fs.readFileSync(full, 'utf8');
      if (content.toLowerCase().includes('periodo') || content.toLowerCase().includes('observacao') || content.toLowerCase().includes('observações')) {
        console.log(`Found in: ${full}`);
      }
    }
  }
}

search('c:/Users/Garrido/registro-servicos');
