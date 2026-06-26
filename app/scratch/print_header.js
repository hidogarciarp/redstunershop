import fs from 'fs';

const filePath = 'c:/Users/Garrido/registro-servicos/app/components/HeaderBar.jsx';
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n');

console.log("Lines 45-75:");
console.log(lines.slice(44, 75).join('\n'));
console.log("\nLines 80-110:");
console.log(lines.slice(79, 110).join('\n'));
