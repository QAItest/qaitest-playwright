@TEST-501 @dotnet @env_ui
Feature: Example Playwright workflow in DotNet

  Scenario: Open the Playwright homepage in DotNet
    Given an example browser context is initialized in DotNet
    When the user opens the Playwright homepage in DotNet
    Then the DotNet Playwright example should pass
