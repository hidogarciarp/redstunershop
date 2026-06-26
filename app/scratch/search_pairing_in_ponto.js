import fs from "fs";

const content = fs.readFileSync("app/components/pages/PontoAdminPage.jsx", "utf8");
const lines = content.split("\n");
lines.forEach((line, idx) => {
  if (line.includes("entradas.forEach") || line.includes("entradas.map") || line.includes("entradas[") || line.includes("saidas[")) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
