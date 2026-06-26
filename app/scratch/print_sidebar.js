import fs from 'fs';

const pagePath = 'c:/Users/Garrido/registro-servicos/app/page.js';
const content = fs.readFileSync(pagePath, 'utf-8');
const lines = content.split('\n');

console.log(lines.slice(2794, 2815).join('\n'));
