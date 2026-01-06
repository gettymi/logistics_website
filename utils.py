import os
import logging
from logging.handlers import RotatingFileHandler
from flask import request

def setup_logger(app):
    # 1. Створюємо папку для логів
    if not os.path.exists('logs'):
        os.mkdir('logs')

    # 2. Налаштовуємо формат (Спрощений, без шляхів файлів)
    # Буде: [Час] IP - METHOD /url STATUS
    formatter = logging.Formatter(
        '%(asctime)s | %(message)s', 
        datefmt='%Y-%m-%d %H:%M:%S'
    )

    # 3. Файловий хендлер
    file_handler = RotatingFileHandler('logs/app.log', maxBytes=10240, backupCount=10)
    file_handler.setFormatter(formatter)
    file_handler.setLevel(logging.INFO)
    
    # Очищуємо старі хендлери, щоб не було дублів
    app.logger.handlers.clear()
    
    app.logger.addHandler(file_handler)
    app.logger.setLevel(logging.INFO)

    # 4. АВТОМАТИЧНИЙ ЛОГЕР ЗАПИТІВ (Middleware)
    @app.after_request
    def log_request_info(response):
        # Ігноруємо статику (css, js, картинки), щоб не засмічувати лог
        if request.path.startswith('/static'):
            return response

        # Отримуємо реальний IP
        # X-Forwarded-For потрібен, якщо сайт буде за проксі (Nginx/Cloudflare)
        ip = request.headers.get('X-Forwarded-For', request.remote_addr)
        if ip and ',' in ip:
            ip = ip.split(',')[0].strip()

        # Формуємо красивий рядок логу
        log_message = f"{ip:<15} | {request.method:<5} | {request.path:<20} | {response.status_code}"
        
        # Записуємо
        app.logger.info(log_message)
        
        # Також дублюємо в термінал (print), щоб ви бачили відразу
        print(f"📡 {log_message}")

        return response