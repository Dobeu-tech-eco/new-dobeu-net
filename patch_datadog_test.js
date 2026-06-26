const fs = require('fs');
const content = fs.readFileSync('lib/datadog.test.ts', 'utf8');

const search = `const rumMock = {
  init: vi.fn(),
  setUser: vi.fn(),
  addAction: vi.fn(),
  addError: vi.fn()
};
const logsMock = {
  init: vi.fn(),
  setUser: vi.fn()
};

vi.mock("@datadog/browser-rum", () => ({ datadogRum: rumMock }));
vi.mock("@datadog/browser-logs", () => ({ datadogLogs: logsMock }));`;

const replace = `const { rumMock, logsMock } = vi.hoisted(() => {
  return {
    rumMock: {
      init: vi.fn(),
      setUser: vi.fn(),
      addAction: vi.fn(),
      addError: vi.fn()
    },
    logsMock: {
      init: vi.fn(),
      setUser: vi.fn()
    }
  };
});

vi.mock("@datadog/browser-rum", () => ({ datadogRum: rumMock }));
vi.mock("@datadog/browser-logs", () => ({ datadogLogs: logsMock }));`;

const newContent = content.replace(search, replace);
if (newContent !== content) {
    fs.writeFileSync('lib/datadog.test.ts', newContent);
    console.log("Success");
} else {
    console.log("Failed to patch datadog.test.ts");
}
