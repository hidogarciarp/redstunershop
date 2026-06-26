const fs = require('fs');
const content = fs.readFileSync('c:/Users/Garrido/registro-servicos/app/components/pages/AdminPage.jsx', 'utf8');

const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.toLowerCase().includes('periodo') || line.toLowerCase().includes('observacao') || line.toLowerCase().includes('observacoes')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
