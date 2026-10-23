import { syncDev } from "./sync.js";

console.log(`Synced dev manifest: ${await syncDev()}`);
console.log("Run Developer: Reload Window in VS Code, then select a Cassidy Dark Dev theme.");
