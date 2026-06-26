import fs from "fs";

const content = fs.readFileSync("app/components/pages/RelatorioPage.jsx", "utf8");
const lines = content.split("\n");
lines.forEach((line, idx) => {
  if (line.includes("todosRegs")) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
