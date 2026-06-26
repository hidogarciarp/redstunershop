const fs = require('fs');
const content = fs.readFileSync('c:/Users/Garrido/registro-servicos/app/page.js', 'utf8');

const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes("salvarNoBanco")) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
