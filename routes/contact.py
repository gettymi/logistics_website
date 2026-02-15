from flask import Blueprint, request, render_template, jsonify, current_app
import requests
import redis
import html
import phonenumbers
import time

contact_bp = Blueprint("contact", __name__)

def get_redis():
    url = current_app.config.get("REDIS_URL")
    if not url:
        raise RuntimeError("REDIS_URL is not configured")
    return redis.from_url(url, decode_responses=True)

def get_client_ip():
    xff = request.headers.get("X-Forwarded-For")
    if xff:
        return xff.split(",")[0].strip()
    return request.remote_addr or "0.0.0.0"

def check_rate_limit(ip: str):
    try:
        r = get_redis()
        window = 3600
        max_requests = 5
        cnt_key = f"contact:cnt:{ip}"
        block_key = f"contact:block:{ip}"

        if r.exists(block_key):
            return False

        count = r.incr(cnt_key)
        if count == 1:
            r.expire(cnt_key, window)

        if count > max_requests:
            r.setex(block_key, window, "1")
            return False
        return True
    except Exception as e:
        current_app.logger.error(f"Redis error: {e}")
        return True # У разі збою Redis, пропускаємо заявку

@contact_bp.route("/contact", methods=["GET", "POST"])
def contact():
    # --- МЕТОД GET (Показ сторінки) ---
    if request.method == "GET":
        return render_template("contact.html")

    # --- МЕТОД POST (Обробка форми) ---
    ip = get_client_ip()

    if not check_rate_limit(ip):
        return jsonify({"error": "Забагато запитів. Спробуйте пізніше або зателефонуйте нам."}), 429

    name = request.form.get("name", "").strip() or "Не вказано"
    phone_raw = request.form.get("phone", "").strip()
    email = request.form.get("email", "").strip() or "Не вказано"
    message = request.form.get("message", "").strip() or "Не вказано"

    if not phone_raw:
        return jsonify({"error": "Введіть номер телефону."}), 400

    # Валідація телефону
    try:
        parsed = phonenumbers.parse(phone_raw, "UA")
        if not phonenumbers.is_valid_number(parsed):
            raise ValueError
        phone = phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.INTERNATIONAL)
    except:
        return jsonify({"error": "Введіть коректний номер телефону."}), 400

    # Санітизація
    name = html.escape(name)
    email = html.escape(email)
    message = html.escape(message)

    text = (
        "<b>📩 Нове повідомлення</b>\n\n"
        f"<b>Імʼя:</b> {name}\n"
        f"<b>Телефон:</b> {phone}\n"
        f"<b>Email:</b> {email}\n"
        f"<b>IP:</b> {ip}\n\n"
        f"<b>Повідомлення:</b>\n{message}"
    )

    try:
        token = current_app.config["TELEGRAM_TOKEN"]
        chat_id = current_app.config["TELEGRAM_CHAT_ID"]
        url = f"https://api.telegram.org/bot{token}/sendMessage"
        
        resp = requests.post(
            url,
            data={"chat_id": chat_id, "text": text, "parse_mode": "HTML"},
            timeout=5
        )
        resp.raise_for_status()
    except Exception as e:
        current_app.logger.exception(e)
        return jsonify({"error": "Не вдалося надіслати. Спробуйте пізніше."}), 500

    return jsonify({"success": True})