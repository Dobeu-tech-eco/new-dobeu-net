const fs = require('fs');
const content = fs.readFileSync('components/landing/FAQ.tsx', 'utf8');

const search1 = `import {
  Accordion,`;
const replace1 = `import { safeJsonLdStringify } from "@/lib/utils";
import {
  Accordion,`;

const search2 = `      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />`;
const replace2 = `      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }}
      />`;

let newContent = content.replace(search1, replace1).replace(search2, replace2);
if (newContent !== content) {
    fs.writeFileSync('components/landing/FAQ.tsx', newContent);
    console.log("Success");
} else {
    console.log("Failed to patch FAQ.tsx");
}
