# DotNet utils

Reusable C# helpers aligned with the Python framework utilities.

Included utilities:
- `Aws.cs`
- `SecretLoader.cs`
- `GherkinSanitizer.cs`
- `ExportTestXray.cs`
- `ImportTestXray.cs`
- `Xray.cs`

Design goals:
- keep function responsibilities close to the Python implementation
- stay generic and reusable outside private infrastructure
- support local files, environment variables, and optional remote test-management endpoints
