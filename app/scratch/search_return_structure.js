import fs from "fs";

const content = fs.readFileSync("app/components/pages/PontoAdminPage.jsx", "utf8");
const lines = content.split("\n");
for (let i = 1040; i <= 1079; i++) {
  console.log(`${i}: ${lines[i - 1]}`);
}
