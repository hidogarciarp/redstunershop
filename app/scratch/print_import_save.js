import fs from "fs";

const content = fs.readFileSync("app/components/pages/PontoAdminPage.jsx", "utf8");
const lines = content.split("\n");
for (let i = 1000; i <= 1045; i++) {
  console.log(`${i}: ${lines[i - 1]}`);
}
