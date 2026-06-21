## Memory Recall
When configuring GitHub Actions workflows that use `anthropics/claude-code-action`, explicitly set the `allowed_bots` parameter to the exact bot name (e.g., `google-labs-jules`) to prevent failures when triggered by non-human actors. Do not use `*`, as it introduces security and token exhaustion risks by allowing any bot.
