## 2025-05-18 - Remove dangerouslySetInnerHTML in HowItWorks
**Vulnerability:** XSS vulnerability via dangerouslySetInnerHTML in HowItWorks component step body rendering.
**Learning:** Using dangerouslySetInnerHTML with static or dynamic content without strict sanitization creates potential Cross-Site Scripting (XSS) vectors. Text content should always be rendered as React children.
**Prevention:** Always use standard React children rendering (e.g., `{step.body}`) for text content. Avoid dangerouslySetInnerHTML unless absolutely necessary and paired with a robust sanitizer (like DOMPurify).
