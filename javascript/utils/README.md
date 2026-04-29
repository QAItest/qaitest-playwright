# JavaScript utils

Reusable JavaScript helpers aligned with the Python framework utilities.

Included modules:
- `aws.js`
- `gherkin_sanitizer.js`
- `xray.js`
- `export_test_xray.js`
- `import_test_xray.js`

Design goals:
- keep function responsibilities close to the Python implementation
- stay generic and reusable outside private infrastructure
- support local files, environment variables, and optional remote test-management endpoints
