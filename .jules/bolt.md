## 2025-01-20 - Memoizing Context Values
**Learning:** In React, passing inline object literals (like `value={{ open, close }}`) to Context Providers causes the context value to fail reference equality checks on every render. This forces all consumers of the context to re-render, even if the actual data hasn't changed.
**Action:** Always wrap context values in `React.useMemo` if they are derived from multiple values or objects, to prevent unnecessary re-renders in consumers.
