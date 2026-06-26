const fs = require('fs');
const content = fs.readFileSync('c:/Users/Garrido/registro-servicos/app/page.js', 'utf8');

const regex = /\.from\(['"]usuarios['"]\)/g;
let match;
console.log('Searching for .from("usuarios") occurrences:');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes("usuarios") && (line.includes("insert") || line.includes("update") || line.includes("upsert"))) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
