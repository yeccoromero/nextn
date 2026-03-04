const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, 'src', 'lib', 'anim', 'runtime.ts');
let code = fs.readFileSync(srcPath, 'utf8');

if (!code.includes('[ANIM_DEBUG] updateFrame Runtime Apply')) {
  // Inject at the very beginning of updateFrame
  code = code.replace(/updateFrame\(timeMs: number\) \{/g, 'updateFrame(timeMs: number) { console.log("[ANIM_DEBUG] updateFrame Runtime Apply", timeMs);');
  
  fs.writeFileSync(srcPath, code);
  console.log('Injected debug logs into runtime.ts');
} else {
  console.log('Debug logs already present in runtime.ts.');
}
