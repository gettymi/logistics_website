from flask import Blueprint, render_template, current_app, url_for, Response

main_bp = Blueprint('main', __name__)

@main_bp.route("/")
def index():
    # ПРИБРАЛИ: current_app.logger.info("User visited Home Page")
    return render_template("index.html")

@main_bp.route("/calculate-km")
def calculate_km():
    key = current_app.config.get("GOOGLE_MAPS_API_KEY")
    
    # ПРИБРАЛИ блоки if/else з логами про ключ
    # Ключ або є, або ні, користувачу лог про це не потрібен 100 разів

    return render_template(
        "calculate_km.html", 
        google_api_key=key
    )

# --- ROBOTS.TXT (Інструкція для Google) ---
@main_bp.route('/robots.txt')
def robots():
    # Дозволяємо все, вказуємо шлях до sitemap
    lines = [
        "User-agent: *",
        "Allow: /",
        f"Sitemap: {url_for('main.sitemap', _external=True)}"
    ]
    return Response("\n".join(lines), mimetype="text/plain")

# --- SITEMAP.XML (Карта сайту) ---
@main_bp.route('/sitemap.xml')
def sitemap():
    """Генерує XML карту для Google"""
    pages = []
    
    # Вказуємо всі наші статичні сторінки
    # 1. Головна (пріоритет 1.0)
    pages.append([url_for('main.index', _external=True), '2025-01-06', '1.0'])
    
    # 2. Контакти (пріоритет 0.8)
    pages.append([url_for('contact.contact', _external=True), '2025-01-06', '0.8'])
    
    # 3. Калькулятор (пріоритет 0.9)
    pages.append([url_for('main.calculate_km', _external=True), '2025-01-06', '0.9'])

    sitemap_xml = render_template('sitemap_template.xml', pages=pages)
    return Response(sitemap_xml, mimetype="application/xml")