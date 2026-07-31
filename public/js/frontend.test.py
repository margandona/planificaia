"""
PlanificaIA - Frontend E2E Tests with Playwright
Tests against the deployed production site.
Uses only ASCII output to avoid Windows encoding issues.
"""
import sys
from playwright.sync_api import sync_playwright

BASE_URL = "https://planificacion-con-ia.web.app"
PASS = 0
FAIL = 0

def report(name, ok, detail=""):
    global PASS, FAIL
    if ok:
        PASS += 1
        print(f"  [PASS] {name}" + (f" - {detail}" if detail else ""))
    else:
        FAIL += 1
        print(f"  [FAIL] {name}" + (f" - {detail}" if detail else ""))


def test_landing_page():
    errors = []
    p = sync_playwright().start()
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto(BASE_URL)
    page.wait_for_load_state('networkidle')

    # Title
    title = page.title()
    errors.append(("Title missing PlanificaIA", "PlanificaIA" not in title))

    # Main heading
    h1 = page.locator('h1')
    errors.append(("H1 not visible", not h1.is_visible()))

    # CTA buttons exist
    has_cta = page.locator('a:has-text("Comenzar gratis")').is_visible() or page.locator('a:has-text("Ir al Dashboard")').is_visible()
    errors.append(("No CTA buttons", not has_cta))

    # Feature cards (check for main sections)
    cards_text = page.locator('main').text_content()
    has_alignment = "Alineacion" in cards_text or "Alineaci" in cards_text
    errors.append(("No feature cards", not has_alignment))

    browser.close()
    p.stop()

    for msg, cond in errors:
        if cond:
            report("Landing Page", False, msg)
            return
    report("Landing Page", True)


def test_navigation():
    p = sync_playwright().start()
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto(BASE_URL)
    page.wait_for_load_state('networkidle')

    # Click login link
    has_login = "/login" in page.url or "login" in page.url
    login_btns = page.locator('a').all()
    for btn in login_btns:
        txt = (btn.text_content() or "").lower()
        if "iniciar" in txt or "login" in txt:
            btn.click()
            page.wait_for_load_state('networkidle')
            has_login = "login" in page.url or "Iniciar" in page.content()
            break

    # Click register
    page.goto(BASE_URL)
    page.wait_for_load_state('networkidle')
    reg_btn = page.locator('a:has-text("Registrarse")')
    if reg_btn.is_visible():
        reg_btn.click()
        page.wait_for_load_state('networkidle')
        content = page.content()
        has_register = "Crear cuenta" in content or "registro" in page.url or "Registrarse" in content
    else:
        has_register = False

    browser.close()
    p.stop()
    report("Navigation", has_login and has_register, f"login:{has_login} reg:{has_register}")


def test_login_page():
    p = sync_playwright().start()
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto(f"{BASE_URL}/#/login")
    page.wait_for_load_state('networkidle')

    content = page.content()
    has_email = 'type="email"' in content or 'email' in content.lower()
    has_password = 'type="password"' in content
    has_button = "Iniciar" in content or "login" in content.lower()

    browser.close()
    p.stop()
    report("Login Page Elements", has_email and has_password and has_button, f"email:{has_email} pass:{has_password} btn:{has_button}")


def test_register_page():
    p = sync_playwright().start()
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto(f"{BASE_URL}/#/registro")
    page.wait_for_load_state('networkidle')

    content = page.content()
    has_name = "Tu nombre" in content or "Nombre" in content
    has_email = 'type="email"' in content
    has_password = 'type="password"' in content
    has_checkbox = 'type="checkbox"' in content
    has_submit = "Crear cuenta" in content

    browser.close()
    p.stop()
    report("Register Page Elements", has_name and has_email and has_password and has_checkbox and has_submit)


def test_privacy_page():
    p = sync_playwright().start()
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto(f"{BASE_URL}/#/privacidad")
    page.wait_for_load_state('networkidle')

    content = page.content()
    has_title = "Privacidad" in content
    has_deepseek = "DeepSeek" in content
    has_gemini = "Gemini" in content

    browser.close()
    p.stop()
    report("Privacy Page", has_title and has_deepseek and has_gemini, f"title:{has_title} deepseek:{has_deepseek} gemini:{has_gemini}")


def test_terms_page():
    p = sync_playwright().start()
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto(f"{BASE_URL}/#/terminos")
    page.wait_for_load_state('networkidle')

    content = page.content()
    has_title = "Terminos" in content or "Términos" in content
    has_docente = "docente" in content.lower()

    browser.close()
    p.stop()
    report("Terms Page", has_title and has_docente)


def test_footer():
    p = sync_playwright().start()
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto(BASE_URL)
    page.wait_for_load_state('networkidle')

    content = page.content().lower()
    has_footer = "2026" in content and "makuaz" in content
    has_privacy = "privacidad" in content
    has_terms = "terminos" in content or "términos" in content

    browser.close()
    p.stop()
    report("Footer Links", has_footer and has_privacy and has_terms)


def test_accessibility():
    p = sync_playwright().start()
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto(BASE_URL)
    page.wait_for_load_state('networkidle')

    content = page.content()

    # Check for main landmark
    has_main = 'role="main"' in content or '<main' in content

    # Check for nav with aria-label
    has_nav_aria = 'aria-label="Navegacion' in content or 'aria-label' in content

    # Check for focus-visible styles
    has_focus = 'focus-visible' in content

    browser.close()
    p.stop()
    report("Accessibility Basics", has_main and has_focus, f"main:{has_main} focus:{has_focus}")


def test_mobile_responsive():
    p = sync_playwright().start()
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 375, 'height': 812})
    page.goto(BASE_URL)
    page.wait_for_load_state('networkidle')

    h1 = page.locator('h1')
    is_visible = h1.is_visible()
    text = h1.text_content() or ""

    page.screenshot(path='/tmp/planificaia-mobile.png', full_page=True)
    browser.close()
    p.stop()
    report("Mobile Responsive", is_visible and "PlanificaIA" in text)


def test_wizard_redirect():
    p = sync_playwright().start()
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto(f"{BASE_URL}/#/nueva")
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(2000)

    content = page.content()
    # Should redirect to login or show login form
    redirected = "Iniciar sesion" in content or "login" in page.url or "email" in content

    browser.close()
    p.stop()
    report("Wizard Redirect", redirected)


def test_no_console_errors():
    p = sync_playwright().start()
    browser = p.chromium.launch(headless=True)
    all_errors = []

    for route in ['', '/#/login', '/#/registro', '/#/privacidad', '/#/terminos']:
        page = browser.new_page()
        errors = []
        page.on('console', lambda msg: errors.append(msg.text) if msg.type == 'error' else None)
        page.goto(f"{BASE_URL}{route}")
        page.wait_for_load_state('networkidle')
        page.wait_for_timeout(1000)

        real_errors = [e for e in errors if 'auth' not in e.lower() and 'favicon' not in e.lower()]
        if real_errors:
            all_errors.append(f"{route}: {real_errors}")
        page.close()

    browser.close()
    p.stop()
    report("No Console Errors", len(all_errors) == 0, f"errors: {all_errors}" if all_errors else "")


if __name__ == "__main__":
    tests = [
        ("Landing Page", test_landing_page),
        ("Navigation", test_navigation),
        ("Login Page", test_login_page),
        ("Register Page", test_register_page),
        ("Privacy Page", test_privacy_page),
        ("Terms Page", test_terms_page),
        ("Footer Links", test_footer),
        ("Accessibility", test_accessibility),
        ("Mobile Responsive", test_mobile_responsive),
        ("Wizard Redirect", test_wizard_redirect),
        ("No Console Errors", test_no_console_errors),
    ]

    print("\n===========================================")
    print("  PlanificaIA - Frontend E2E Tests")
    print("===========================================\n")

    for name, fn in tests:
        fn()

    print(f"\n===========================================")
    print(f"  Results: {PASS}/{PASS+FAIL} passed, {FAIL} failed")
    print("===========================================\n")
    sys.exit(0 if FAIL == 0 else 1)
