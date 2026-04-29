# qaitest-playwright

Open-source QA automation framework for Playwright, browser-driven UI testing, and BDD-friendly test organization across multiple languages.

Recommended software combo:
- `Playwright` for browser automation
- language-native test runners per workspace
- CI with GitLab CI, GitHub Actions, or Jenkins
- `Xray for Jira` for test case traceability, execution history, and report publishing

This repository is intentionally framework-first:
- no internal infrastructure
- no vendor-locked secrets flow
- no hardcoded application data
- no mandatory CI provider

It keeps reusable ideas from real-world automation projects:
- one dedicated subfolder per language
- explicit separation between feature intent, steps, specs, and utility helpers
- shared CI and report conventions
- optional `Xray for Jira` oriented reporting

## What this repository provides

- JavaScript Playwright workspace: [javascript](C:/Users/g.prospa/Documents/Team_Software/QA/5-PROJ/qaitest-playwright/javascript)
- TypeScript Playwright workspace: [typescript](C:/Users/g.prospa/Documents/Team_Software/QA/5-PROJ/qaitest-playwright/typescript)
- Python Playwright workspace: [python](C:/Users/g.prospa/Documents/Team_Software/QA/5-PROJ/qaitest-playwright/python)
- Java Playwright workspace: [java](C:/Users/g.prospa/Documents/Team_Software/QA/5-PROJ/qaitest-playwright/java)
- DotNet Playwright workspace: [dotnet](C:/Users/g.prospa/Documents/Team_Software/QA/5-PROJ/qaitest-playwright/dotnet)
- CI examples: [CI](C:/Users/g.prospa/Documents/Team_Software/QA/5-PROJ/qaitest-playwright/CI)
- Shared reports folder: [reports](C:/Users/g.prospa/Documents/Team_Software/QA/5-PROJ/qaitest-playwright/reports)

## Language order

This repository is organized in the requested order:
1. JavaScript
2. TypeScript
3. Python
4. Java
5. DotNet

## Recommended stack

Playwright itself recommends native language integrations rather than one cross-language runner. This repository follows that guidance while preserving a BDD-friendly structure similar to the Python and Cypress repositories.

- `javascript/` and `typescript/` use Playwright Test
- `python/` uses `pytest`, `pytest-playwright`, and `pytest-bdd`
- `java/` uses Playwright with JUnit-friendly test structure
- `dotnet/` uses Playwright with NUnit-friendly test structure

## Quick start

Choose one workspace and start there:

### JavaScript

```bash
cd javascript
npm install
npx playwright install
npm run test-bdd
```

### TypeScript

```bash
cd typescript
npm install
npx playwright install
npm run test-bdd
```

### Python

```bash
cd python
python -m pip install -e .
playwright install
pytest -q
```

### Java

```bash
cd java
mvn test
```

### DotNet

```bash
cd dotnet
dotnet test
```

## Expected project layout

```text
qaitest-playwright/
|-- CI/
|-- reports/
|-- javascript/
|-- typescript/
|-- python/
|-- java/
|-- dotnet/
|-- .gitignore
|-- LICENSE
`-- README.md
```

## Workspaces

### JavaScript

- [javascript/playwright.config.js](C:/Users/g.prospa/Documents/Team_Software/QA/5-PROJ/qaitest-playwright/javascript/playwright.config.js:1)
- [javascript/tests/features](C:/Users/g.prospa/Documents/Team_Software/QA/5-PROJ/qaitest-playwright/javascript/tests/features)
- [javascript/tests/steps](C:/Users/g.prospa/Documents/Team_Software/QA/5-PROJ/qaitest-playwright/javascript/tests/steps)
- [javascript/tests/specs](C:/Users/g.prospa/Documents/Team_Software/QA/5-PROJ/qaitest-playwright/javascript/tests/specs)
- [javascript/utils](C:/Users/g.prospa/Documents/Team_Software/QA/5-PROJ/qaitest-playwright/javascript/utils)

### TypeScript

- [typescript/playwright.config.ts](C:/Users/g.prospa/Documents/Team_Software/QA/5-PROJ/qaitest-playwright/typescript/playwright.config.ts:1)
- [typescript/tests/features](C:/Users/g.prospa/Documents/Team_Software/QA/5-PROJ/qaitest-playwright/typescript/tests/features)
- [typescript/tests/steps](C:/Users/g.prospa/Documents/Team_Software/QA/5-PROJ/qaitest-playwright/typescript/tests/steps)
- [typescript/tests/specs](C:/Users/g.prospa/Documents/Team_Software/QA/5-PROJ/qaitest-playwright/typescript/tests/specs)
- [typescript/utils](C:/Users/g.prospa/Documents/Team_Software/QA/5-PROJ/qaitest-playwright/typescript/utils)

### Python

- [python/pyproject.toml](C:/Users/g.prospa/Documents/Team_Software/QA/5-PROJ/qaitest-playwright/python/pyproject.toml:1)
- [python/tests/features](C:/Users/g.prospa/Documents/Team_Software/QA/5-PROJ/qaitest-playwright/python/tests/features)
- [python/tests/steps](C:/Users/g.prospa/Documents/Team_Software/QA/5-PROJ/qaitest-playwright/python/tests/steps)
- [python/utils](C:/Users/g.prospa/Documents/Team_Software/QA/5-PROJ/qaitest-playwright/python/utils)

### Java

- [java/pom.xml](C:/Users/g.prospa/Documents/Team_Software/QA/5-PROJ/qaitest-playwright/java/pom.xml:1)
- [java/src/test/resources/features](C:/Users/g.prospa/Documents/Team_Software/QA/5-PROJ/qaitest-playwright/java/src/test/resources/features)
- [java/src/test/java/com/qaitest/playwright/steps](C:/Users/g.prospa/Documents/Team_Software/QA/5-PROJ/qaitest-playwright/java/src/test/java/com/qaitest/playwright/steps)
- [java/src/test/java/com/qaitest/playwright/tests](C:/Users/g.prospa/Documents/Team_Software/QA/5-PROJ/qaitest-playwright/java/src/test/java/com/qaitest/playwright/tests)
- [java/utils](C:/Users/g.prospa/Documents/Team_Software/QA/5-PROJ/qaitest-playwright/java/utils)

### DotNet

- [dotnet/QAItest.Playwright.DotNet.csproj](C:/Users/g.prospa/Documents/Team_Software/QA/5-PROJ/qaitest-playwright/dotnet/QAItest.Playwright.DotNet.csproj:1)
- [dotnet/Tests/Features](C:/Users/g.prospa/Documents/Team_Software/QA/5-PROJ/qaitest-playwright/dotnet/Tests/Features)
- [dotnet/Tests/Steps](C:/Users/g.prospa/Documents/Team_Software/QA/5-PROJ/qaitest-playwright/dotnet/Tests/Steps)
- [dotnet/Tests/Specs](C:/Users/g.prospa/Documents/Team_Software/QA/5-PROJ/qaitest-playwright/dotnet/Tests/Specs)
- [dotnet/utils](C:/Users/g.prospa/Documents/Team_Software/QA/5-PROJ/qaitest-playwright/dotnet/utils)

## Example test IDs

The sample workspaces use one example identifier per language:
- `TEST-101` for JavaScript
- `TEST-201` for TypeScript
- `TEST-301` for Python
- `TEST-401` for Java
- `TEST-501` for DotNet

## Utility modules

The repository keeps a utility layer per language so teams can adapt the same ideas in their preferred stack:

- secret loading
- Gherkin sanitization
- feature export
- report summarization
- Xray-oriented metadata helpers

## Xray for Jira

`Xray for Jira` is the recommended test-management combo for this repository.

Typical usage:
- keep business-readable test definitions and traceable IDs
- map scenario identifiers such as `TEST-101`, `TEST-201`, `TEST-301`, `TEST-401`, `TEST-501`
- execute Playwright flows in the language of your choice
- publish reports and evidence from CI
- transform or enrich outputs for `Xray for Jira`

## CI examples

Generic CI templates are available in [CI](C:/Users/g.prospa/Documents/Team_Software/QA/5-PROJ/qaitest-playwright/CI):
- [CI/github-actions.yml](C:/Users/g.prospa/Documents/Team_Software/QA/5-PROJ/qaitest-playwright/CI/github-actions.yml)
- [CI/gitlab-ci.yml](C:/Users/g.prospa/Documents/Team_Software/QA/5-PROJ/qaitest-playwright/CI/gitlab-ci.yml)
- [CI/Jenkinsfile](C:/Users/g.prospa/Documents/Team_Software/QA/5-PROJ/qaitest-playwright/CI/Jenkinsfile)

## License

This project uses the MIT license in [LICENSE](C:/Users/g.prospa/Documents/Team_Software/QA/5-PROJ/qaitest-playwright/LICENSE:1).
