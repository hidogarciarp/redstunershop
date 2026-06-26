import fs from "fs";
import path from "path";

const dir = "app/components/pages";
fs.readdirSync(dir).forEach(file => {
  const filePath = path.join(dir, file);
  const content = fs.readFileSync(filePath, "utf8");
  if (content.includes("CONTROLE DE COBRANÇAS POR FUNCIONÁRIO") || content.includes("Módulo Financeiro")) {
    console.log(`Found in: ${filePath}`);
  }
});
