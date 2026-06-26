const fs = require('fs');
const content = fs.readFileSync('app/page.js', 'utf8');

// Parse everything roughly
const regex = /style=\{\s*([^]+?)\s*\}/g;
let match;
while ((match = regex.exec(content)) !== null) {
    const raw = match[1];
    if (raw.trim().startsWith('{') || raw.trim().startsWith('styles.')) {
        // Evaluate the raw block by wrapping it
        // We inject mock variables
        const script = `
        const theme = { accent: "red", border: "gray", bg: "black", subtext: "gray", text: "white", card: "white", card2: "white", green: "green", inputBg: "white" };
        const isDarkMode = true;
        const styles = new Proxy({}, { get: () => ({}) });
        const pontoAtivo = true;
        const corHex = "#000";
        const eq = { cor: "red" };
        const isCampeao = true;
        const isVice = false;
        const ativa = true;
        const cor = "red";
        const _m = { eh_lider: true };
        const m = { eh_lider: true };
        const stylesObj = ${raw.trim()};
        return stylesObj;
        `;
        
        try {
            const result = new Function(script)();
            if (typeof result !== 'object') {
                console.log("NOT AN OBJECT:", raw);
            }
        } catch(e) {
            // Ignore variables we didn't mock
        }
    }
}
console.log('Done scanning!');
