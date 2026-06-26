import fs from "fs";

const content = fs.readFileSync("app/components/pages/PontoAdminPage.jsx", "utf8");
const lines = content.split("\n");
for (let i = 1250; i <= 1320; i++) {
  console.log(`${i}: ${lines[i - 1]}`);
}
