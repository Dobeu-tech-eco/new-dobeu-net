## 2025-05-18 - Fix GitHub Actions non-human actor execution error
**Vulnerability:** Workflow failing due to non-human actor execution restrictions for Claude action.
**Learning:** The `anthropics/claude-code-action@v1` requires the `allowed_bots` configuration to explicitly permit specific bots to trigger the action if it's restricted. Wildcard (`*`) is valid, but specific bots like `google-labs-jules` are preferred unless already configured otherwise.
**Prevention:** Always verify the bot identity and ensure it is included in the `allowed_bots` parameter inside GitHub workflows using `claude-code-action` to prevent CI execution failures for automated agents.
