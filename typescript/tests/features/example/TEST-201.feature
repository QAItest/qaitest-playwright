@TEST-201 @typescript @env_ui
Feature: Example Playwright workflow in TypeScript

  Scenario: Open the Playwright docs in TypeScript
    Given an example browser context is initialized in TypeScript
    When the user opens the Playwright homepage in TypeScript
    Then the TypeScript Playwright example should pass
