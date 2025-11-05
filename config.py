import os
from dotenv import load_dotenv


load_dotenv()

class Config:
    TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN")
    TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key")
    GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_API")