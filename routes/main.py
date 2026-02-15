from flask import Blueprint, render_template, url_for, Response

main_bp = Blueprint('main', __name__)

@main_bp.route("/")
def index():
    # ПРИБРАЛИ: current_app.logger.info("User visited Home Page")
    return render_template("index.html")

@main_bp.route("/calculate-km")
def calculate_km():
    return render_template("calculate_km.html")


@main_bp.route("/thank-you")
def thank_you():
    """Сторінка подяки після відправки форми — для відстеження конверсий (GTM / Google Ads)."""
    return render_template("thank_you.html")


@main_bp.route("/services")
def services():
    """Сторінка «Послуги» — детальний опис послуг перевезень."""
    return render_template("services.html")


@main_bp.route("/zakordón")
def zakordon():
    """Сторінка «Закордон» — перевезення за кордон (Європа тощо)."""
    return render_template("zakordon.html")


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
    # 4. Послуги
    pages.append([url_for('main.services', _external=True), '2025-01-06', '0.85'])
    # 5. Закордон
    pages.append([url_for('main.zakordon', _external=True), '2025-01-06', '0.85'])

    sitemap_xml = render_template('sitemap_template.xml', pages=pages)
    return Response(sitemap_xml, mimetype="application/xml")