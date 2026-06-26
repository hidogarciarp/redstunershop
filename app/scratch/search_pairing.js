import fs from "fs";

const content = fs.readFileSync("app/components/pages/PontoAdminPage.jsx", "utf8");
const lines = content.split("\n");
lines.forEach((line, idx) => {
  if (line.includes("entradas") || line.includes("saidas") || line.includes("Date")) {
    if (idx < 500) { // Let's check early parts of the file where matching functions might be
      console.log(`${idx + 1}: ${line.trim()}`);
    }
  }
});
