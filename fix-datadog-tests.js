const fs = require('fs');
const file = 'lib/datadog.test.ts';
let code = fs.readFileSync(file, 'utf8');

// The function being tested initDatadog() is now async, so we need to await it
code = code.replace(/initDatadog\(\);/g, 'await initDatadog();');

// For the idempotent test:
code = code.replace(/await initDatadog\(\);\n\s*await initDatadog\(\);/g, 'await initDatadog();\n    await initDatadog();');


fs.writeFileSync(file, code);
