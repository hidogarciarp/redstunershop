const fs = require('fs');
const content = fs.readFileSync('app/page.js', 'utf8');
const m = content.match(/style=\{\{[^}]+\}\}/g);
if (m) {
  m.forEach(x => {
    if (x.includes('/*') || x.includes('//')) console.log(x);
  })
}
