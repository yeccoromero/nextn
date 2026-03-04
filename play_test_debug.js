const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, 'src', 'lib', 'anim', 'legacy-runtime.ts');
let code = fs.readFileSync(srcPath, 'utf8');

if (!code.includes('[ANIM_DEBUG] updateFrame')) {
  code = code.replace(/updateFrame\(timeMs: number\) \{/g, 'updateFrame(timeMs: number) { console.log("[ANIM_DEBUG] updateFrame", timeMs, "duration:", this.spec?.durationMs);');
  code = code.replace(/play\(\) \{/g, 'play() { console.log("[ANIM_DEBUG] play", !!this.tl, this.tl?.paused);');
  
  fs.writeFileSync(srcPath, code);
  console.log('Injected debug logs into legacy-runtime.ts');
} else {
  console.log('Debug logs already present.');
}
