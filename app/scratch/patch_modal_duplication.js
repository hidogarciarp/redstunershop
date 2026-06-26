import fs from 'fs';

const filePath = 'c:/Users/Garrido/registro-servicos/app/components/pages/RelatorioPage.jsx';
let content = fs.readFileSync(filePath, 'utf-8');

const targetLine = `    // Evita duplicatas ao mesclar por ID ou UUID
    const todosRegs = [];`;

const replacementLine = `    // Evita duplicatas ao mesclar por ID ou UUID
    let todosRegs = [];`;

if (content.includes(targetLine)) {
  content = content.replace(targetLine, replacementLine);
  console.log("Successfully fixed const reassignment error!");
  fs.writeFileSync(filePath, content, 'utf-8');
} else {
  console.log("Target line not found!");
}
