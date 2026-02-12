const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Parse command line arguments
// Example usage: node scripts/log-change.js --title "My Title" --context "Context..." --solution "Solution..." --files "file1, file2"
const args = process.argv.slice(2);
const flags = {};
let currentFlag = null;

args.forEach(arg => {
    if (arg.startsWith('--')) {
        currentFlag = arg.substring(2);
        flags[currentFlag] = true; // Boolean flag by default
    } else if (currentFlag) {
        // Simple string storage. 
        // Note: In shell, strings with spaces should be quoted: --title "My Title"
        flags[currentFlag] = arg;
        currentFlag = null;
    }
});

// Helper to get arg or ask question
function getInput(flagName, question, rl) {
    if (flags[flagName] && typeof flags[flagName] === 'string') {
        return Promise.resolve(flags[flagName]);
    }
    return new Promise(resolve => {
        rl.question(question, (answer) => resolve(answer));
    });
}

const BITACORA_PATH = path.join(__dirname, '../BITACORA.md');

async function main() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    if (Object.keys(flags).length === 0) {
        console.log("📝 Nuevo registro en BITACORA.md");
    } else {
        console.log("🤖 Modo Automático detectado.");
    }

    const title = await getInput('title', 'Título del cambio (ej: Corrección de Login): ', rl);
    const context = await getInput('context', 'Contexto (¿Por qué se hizo? ¿Qué fallaba?): ', rl);
    const solution = await getInput('solution', 'Solución (¿Qué se implementó? Detalles técnicos): ', rl);
    const files = await getInput('files', 'Archivos modificados (separados por coma): ', rl);

    rl.close();

    const date = new Date();
    // Format: YYYY-MM-DD HH:mm
    // Use local time offset if possible or UTC. new Date().toLocaleString() might be better for logs but ISO is standard.
    // Let's stick to the previous format: YYYY-MM-DD HH:mm
    const dateStr = date.toISOString().slice(0, 10) + ' ' + date.toTimeString().slice(0, 5);

    const entry = `
### [${dateStr}] - ${title}
**Estado**: ✅ Implementado

**📝 Contexto:**
${context}

**🛠️ Solución Implementada:**
${solution}

**📂 Archivos Modificados:**
${files.split(',').map(f => `- \`${f.trim()}\``).join('\n')}

---
`;

    try {
        let content = fs.readFileSync(BITACORA_PATH, 'utf8');
        // Insert after the "Historial de Actividades" header
        const header = "## 📅 Historial de Actividades";
        const insertPos = content.indexOf(header);

        if (insertPos === -1) {
            console.error("❌ No se encontró la sección 'Historial de Actividades' en BITACORA.md");
            process.exit(1);
        }

        const insertionPoint = insertPos + header.length;
        const newContent = content.slice(0, insertionPoint) + '\n' + entry + content.slice(insertionPoint);

        fs.writeFileSync(BITACORA_PATH, newContent, 'utf8');
        console.log("✅ Registro agregado exitosamente a BITACORA.md");
    } catch (err) {
        console.error("❌ Error al escribir en BITACORA.md:", err);
        process.exit(1);
    }
}

main();
