from datetime import date

from flask import Blueprint, render_template, url_for, Response

main_bp = Blueprint('main', __name__)

# Публічні сторінки для sitemap (без thank-you — сторінка конверсії)
SITEMAP_PAGES = [
    {"endpoint": "main.index", "priority": "1.0", "changefreq": "weekly"},
    {"endpoint": "main.calculate_km", "priority": "0.9", "changefreq": "weekly"},
    {"endpoint": "main.services", "priority": "0.85", "changefreq": "monthly"},
    {"endpoint": "main.zakordon", "priority": "0.85", "changefreq": "monthly"},
    {"endpoint": "contact.contact", "priority": "0.8", "changefreq": "monthly"},
]

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


@main_bp.route("/robots.txt")
def robots():
    """robots.txt — інструкції для пошукових роботів."""
    sitemap_url = url_for("main.sitemap", _external=True)
    lines = [
        "User-agent: *",
        "Allow: /",
        "",
        "# Службові сторінки — не індексувати",
        "Disallow: /thank-you",
        "",
        f"Sitemap: {sitemap_url}",
    ]
    return Response("\n".join(lines) + "\n", mimetype="text/plain; charset=utf-8")


@main_bp.route("/sitemap.xml")
def sitemap():
    """Динамічна XML-карта сайту для Google, Bing тощо."""
    lastmod = date.today().isoformat()
    pages = [
        {
            "loc": url_for(item["endpoint"], _external=True),
            "lastmod": lastmod,
            "changefreq": item["changefreq"],
            "priority": item["priority"],
        }
        for item in SITEMAP_PAGES
    ]
    sitemap_xml = render_template("sitemap_template.xml", pages=pages)
    return Response(sitemap_xml, mimetype="application/xml; charset=utf-8")