import fs from "fs";

const content = fs.readFileSync("app/components/pages/PontoAdminPage.jsx", "utf8");
const lines = content.split("\n");
lines.forEach((line, idx) => {
  if (line.includes("SALVAR PONTOS") || line.includes("importarSessoesParaBanco") || line.includes("importarSessoes")) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
