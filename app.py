from flask import Flask
from config import Config
from routes.contact import contact_bp
from routes.main import main_bp   # <--- Import your new blueprint
from utils import setup_logger    # <--- Import the logging helper

def create_app():
    app = Flask(__name__)
    
    # 1. Config
    app.config.from_object(Config)

    # 2. Setup Logging
    setup_logger(app)

    # 3. Register Blueprints
    app.register_blueprint(contact_bp)
    app.register_blueprint(main_bp) # <--- Register the new blueprint

    return app

if __name__ == "__main__":
    app = create_app()
    app.run(debug=True, port=5001, host='0.0.0.0')