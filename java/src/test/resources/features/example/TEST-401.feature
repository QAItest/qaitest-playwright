@TEST-401 @java @env_ui
Feature: Example Playwright workflow in Java

  Scenario: Open the Playwright homepage in Java
    Given an example browser context is initialized in Java
    When the user opens the Playwright homepage in Java
    Then the Java Playwright example should pass
