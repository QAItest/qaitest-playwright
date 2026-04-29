# TypeScript utils

Reusable TypeScript helpers aligned with the Python framework utilities.

Included modules:
- `aws.ts`
- `gherkin_sanitizer.ts`
- `xray.ts`
- `export_test_xray.ts`
- `import_test_xray.ts`

Design goals:
- keep function responsibilities close to the Python implementation
- stay generic and reusable outside private infrastructure
- support local files, environment variables, and optional remote test-management endpoints
