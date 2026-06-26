import os

content = ""
with open("lib/datadog.test.ts", "r") as f:
    content = f.read()

content = content.replace("import { describe, it, expect, beforeEach, afterEach, vi } from \"vitest\";", """import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const rumMock = vi.hoisted(() => ({
  init: vi.fn(),
  setUser: vi.fn(),
  addAction: vi.fn(),
  addError: vi.fn()
}));
const logsMock = vi.hoisted(() => ({
  init: vi.fn(),
  setUser: vi.fn()
}));""")

content = content.replace("""const rumMock = {
  init: vi.fn(),
  setUser: vi.fn(),
  addAction: vi.fn(),
  addError: vi.fn()
};
const logsMock = {
  init: vi.fn(),
  setUser: vi.fn()
};

""", "")

content = content.replace("initDatadog();", "await initDatadog();")

with open("lib/datadog.test.ts", "w") as f:
    f.write(content)

print("done")
