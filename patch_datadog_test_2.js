const fs = require('fs');
const content = fs.readFileSync('lib/datadog.test.ts', 'utf8');

const search = `    const { initDatadog } = await freshImport();
    initDatadog();`;
const replace = `    const { initDatadog } = await freshImport();
    await initDatadog();`;

let newContent = content.split(search).join(replace);

const search2 = `    const { initDatadog, ddIdentify } = await freshImport();
    initDatadog();`;
const replace2 = `    const { initDatadog, ddIdentify } = await freshImport();
    await initDatadog();`;
newContent = newContent.split(search2).join(replace2);

const search3 = `    const { initDatadog, ddAction } = await freshImport();
    initDatadog();`;
const replace3 = `    const { initDatadog, ddAction } = await freshImport();
    await initDatadog();`;
newContent = newContent.split(search3).join(replace3);

const search4 = `    const { initDatadog, ddError } = await freshImport();
    initDatadog();`;
const replace4 = `    const { initDatadog, ddError } = await freshImport();
    await initDatadog();`;
newContent = newContent.split(search4).join(replace4);

const search5 = `    await initDatadog();
    initDatadog();`;
const replace5 = `    await initDatadog();
    await initDatadog();`;
newContent = newContent.split(search5).join(replace5);


if (newContent !== content) {
    fs.writeFileSync('lib/datadog.test.ts', newContent);
    console.log("Success");
} else {
    console.log("Failed to patch datadog.test.ts (2)");
}
