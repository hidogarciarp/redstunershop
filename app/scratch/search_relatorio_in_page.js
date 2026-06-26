import fs from "fs";

const content = fs.readFileSync("app/page.js", "utf8");
const lines = content.split("\n");
lines.forEach((line, idx) => {
  if (line.includes("registrosRelatorio") || line.includes("buscarRelatorio")) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
