from flask import Flask, render_template, request, redirect, url_for, flash
from config import Config
import requests

app = Flask(__name__)
app.config.from_object(Config)


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/contact', methods=['GET', 'POST'])
def contact():
    if request.method == 'POST':
        name = request.form.get('name')
        phone = request.form.get("phone")
        email = request.form.get("email", "Не указан")
        message = request.form.get('message')

        if not name or not phone or not message:
            flash('Будь ласка, заповніть поля', 'error')
            return redirect(url_for('contact'))

        text = f"📩 Новое сообщение:\n\nИмя: {name}\nEmail: {email}\nСообщение: {message} \nНомер: {phone}"

        url = f"https://api.telegram.org/bot{app.config['TELEGRAM_TOKEN']}/sendMessage"
        data = {'chat_id': app.config['TELEGRAM_CHAT_ID'], 'text': text}

        try:
            requests.post(url, data=data, timeout=5)
            flash('Повідомлення успішно відправлено!', 'success')
        except Exception as e:
            flash('Помилка при відправленні повідомлення. Спробуйте пізніше.', 'error')
            print(e)

        return redirect(url_for('contact'))

    return render_template('contact.html')


@app.route('/calculate-km')
def calculate_km():
    return render_template('calculate_km.html',google_api_key=app.config['GOOGLE_MAPS_API_KEY'])


if __name__ == '__main__':
    import os
    app.run(
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 5000)),
        debug=os.environ.get("FLASK_DEBUG", "0") == "1"
    )