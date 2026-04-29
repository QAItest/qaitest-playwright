# CI examples

This folder contains generic CI examples for a Playwright multi-language automation repository.

Included examples:
- `github-actions.yml`
- `gitlab-ci.yml`
- `Jenkinsfile`

They show the same ideas across languages:
- bootstrap dependencies per language workspace
- execute Playwright-oriented test suites
- archive `reports/`
- keep the repository friendly for optional `Xray for Jira` publication flows
