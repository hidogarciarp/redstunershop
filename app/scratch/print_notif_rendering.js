import fs from "fs";

const content = fs.readFileSync("app/page.js", "utf8");
const lines = content.split("\n");
for (let i = 4360; i <= 4410; i++) {
  console.log(`${i}: ${lines[i - 1]}`);
}
