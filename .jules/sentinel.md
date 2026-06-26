## 2023-10-25 - Fix XSS Vulnerability in FAQ
**Vulnerability:** Unsafe rendering of FAQ data using `dangerouslySetInnerHTML`. Using it for static data might seem harmless, but if the `FAQS` array data is ever loaded from an external source or user input, it could lead to stored XSS.
**Learning:** Always use standard React interpolation for strings. Only use `dangerouslySetInnerHTML` if you have complex HTML you have fully sanitized.
**Prevention:** Avoid `dangerouslySetInnerHTML` unless absolutely necessary and paired with a sanitizer like DOMPurify. Replace HTML entities with standard characters in data objects.
