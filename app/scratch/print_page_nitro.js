import fs from 'fs';

const pagePath = 'c:/Users/Garrido/registro-servicos/app/page.js';
const content = fs.readFileSync(pagePath, 'utf-8');
const lines = content.split('\n');

const idx = lines.findIndex(line => line.includes('<NitroAdminPage'));
if (idx !== -1) {
  console.log(lines.slice(idx - 2, idx + 15).join('\n'));
} else {
  console.log("Not found!");
}
