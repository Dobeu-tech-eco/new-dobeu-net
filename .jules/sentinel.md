## 2024-05-25 - Removed unnecessary dangerouslySetInnerHTML
**Vulnerability:** Use of `dangerouslySetInnerHTML` for simple text rendering (with HTML entities).
**Learning:** Even for static hardcoded strings, `dangerouslySetInnerHTML` creates unnecessary risk if those strings are ever migrated to dynamic sources (like a CMS) in the future.
**Prevention:** Always use standard React text interpolation (`{string}`) which safely escapes content automatically. Only use `dangerouslySetInnerHTML` when absolutely required for rendering complex HTML, and sanitize it first.
