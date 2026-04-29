# Java utils

Reusable Java helpers aligned with the Python framework utilities.

Included utilities:
- `Aws.java`
- `SecretLoader.java`
- `GherkinSanitizer.java`
- `ExportTestXray.java`
- `ImportTestXray.java`
- `Xray.java`

Design goals:
- keep function responsibilities close to the Python implementation
- stay generic and reusable outside private infrastructure
- support local files, environment variables, and optional remote test-management endpoints
