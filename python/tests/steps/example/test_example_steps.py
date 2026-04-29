from pathlib import Path

from pytest_bdd import given, scenarios, then, when

FEATURE_FILE = Path(__file__).resolve().parents[2] / "features" / "example" / "TEST-301.feature"
scenarios(str(FEATURE_FILE))


@given("an example browser context is initialized in Python")
def example_context(page):
    return {"page": page, "executed": False}


@when("the user opens the Playwright homepage in Python")
def open_homepage(example_context):
    example_context["executed"] = True
    example_context["page"].goto("https://playwright.dev/")


@then("the Python Playwright example should pass")
def expect_homepage(example_context):
    assert example_context["executed"] is True
    assert example_context["page"].get_by_role("link", name="Get started").is_visible()
