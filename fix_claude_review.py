import os

content = ""
with open(".github/workflows/claude-code-review.yml", "r") as f:
    content = f.read()

search = """        with:
          claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}"""

replace = """        with:
          claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          allowed_bots: "google-labs-jules" """

content = content.replace(search, replace)

with open(".github/workflows/claude-code-review.yml", "w") as f:
    f.write(content)

print("done")
