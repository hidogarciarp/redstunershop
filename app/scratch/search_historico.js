import fs from "fs";
import path from "path";

const dir = "app/components/pages";
fs.readdirSync(dir).forEach(file => {
  const filePath = path.join(dir, file);
  const content = fs.readFileSync(filePath, "utf8");
  if (content.includes("Histórico de Sessões") || content.includes("Historico de Sessoes")) {
    console.log(`Found in: ${filePath}`);
  }
});
