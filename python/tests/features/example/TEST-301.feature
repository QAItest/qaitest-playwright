@TEST-301 @python @env_ui
Feature: Example Playwright workflow in Python

  Scenario: Open the Playwright homepage in Python
    Given an example browser context is initialized in Python
    When the user opens the Playwright homepage in Python
    Then the Python Playwright example should pass
