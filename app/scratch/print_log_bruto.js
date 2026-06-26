import fs from "fs";

const content = fs.readFileSync("app/components/pages/PontoAdminPage.jsx", "utf8");
const lines = content.split("\n");
for (let i = 2085; i <= 2160; i++) {
  console.log(`${i}: ${lines[i - 1]}`);
}
