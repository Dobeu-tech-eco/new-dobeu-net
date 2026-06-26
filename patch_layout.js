const fs = require('fs');
const content = fs.readFileSync('app/layout.tsx', 'utf8');

const search1 = `import { getSiteUrl } from "@/lib/utils";`;
const replace1 = `import { getSiteUrl, safeJsonLdStringify } from "@/lib/utils";`;

const search2 = `        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",`;
const replace2 = `        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: safeJsonLdStringify({
              "@context": "https://schema.org",`;

let newContent = content.replace(search1, replace1).replace(search2, replace2);
if (newContent !== content) {
    fs.writeFileSync('app/layout.tsx', newContent);
    console.log("Success");
} else {
    console.log("Failed to patch layout.tsx");
}
