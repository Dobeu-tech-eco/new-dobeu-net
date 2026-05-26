## 2024-05-26 - Added visual feedback for async submit buttons
**Learning:** Text-only feedback (e.g. changing "Submit" to "Sending...") during async operations is often insufficient. It can lead to a feeling of unresponsiveness or duplicate clicks since users are accustomed to movement/spinners indicating "loading".
**Action:** Always include a visual animation, such as an animated spinner (`<Loader2 className="animate-spin" />`), alongside loading text on primary submit buttons.
