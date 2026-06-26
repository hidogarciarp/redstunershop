import fs from "fs";

const content = fs.readFileSync("app/page.js", "utf8");
const lines = content.split("\n");
for (let i = 1540; i <= 1575; i++) {
  console.log(`${i}: ${lines[i - 1]}`);
}
