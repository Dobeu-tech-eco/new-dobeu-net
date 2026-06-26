## 2024-06-26 - Fix XSS Vulnerability in Proof Component
**Vulnerability:** The `Proof` component rendered user quotes using `dangerouslySetInnerHTML`, creating an XSS risk if quote data were ever supplied externally or modified.
**Learning:** Always prefer standard React children (`{variable}`) over `dangerouslySetInnerHTML` for rendering text, even for static or trusted data, as it provides built-in escaping.
**Prevention:** Avoid `dangerouslySetInnerHTML` unless rendering explicitly trusted, sanitized HTML (e.g., from a robust HTML sanitizer).
