@TEST-101 @javascript @env_ui
Feature: Example Playwright workflow in JavaScript

  Scenario: Open the Playwright homepage
    Given an example browser context is initialized in JavaScript
    When the user opens the Playwright homepage in JavaScript
    Then the JavaScript Playwright example should pass
