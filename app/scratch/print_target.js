import fs from 'fs';

const filePath = 'c:/Users/Garrido/registro-servicos/app/components/pages/RelatorioPage.jsx';
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n');
const idx = lines.findIndex(line => line.includes('idsInativosAlerta'));
if (idx !== -1) {
  console.log(lines.slice(idx, idx + 25).join('\n'));
} else {
  console.log("Not found!");
}
