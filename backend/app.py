"""
Production Flask Application Entry Point for Zinnia 2026.
Configures CORS, registers middleware, attaches modular route blueprints, and launches server.
"""

import os
import sys

# Ensure stdout and stderr handle utf-8 gracefully on Windows without crashing
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="backslashreplace")
    except Exception:
        pass
if hasattr(sys.stderr, "reconfigure"):
    try:
        sys.stderr.reconfigure(encoding="utf-8", errors="backslashreplace")
    except Exception:
        pass

from dotenv import load_dotenv

# Ensure backend root is on python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Load server environment variables
load_dotenv(override=True)
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"), override=True)

from flask import Flask
from flask_cors import CORS

from routes.passport_routes import passport_bp
from routes.registration_routes import registration_bp
from routes.payment_routes import payment_bp
from routes.admin_routes import admin_bp
from middleware.error_handler import register_error_handlers

def check_db_connection():
    """Verify database connection status and table permissions on server startup."""
    supabase_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY", "")
    
    if not supabase_url or "your_project" in supabase_url.lower() or "your-project" in supabase_url.lower():
        print("[DB Error] Database connection failed: Placeholder SUPABASE_URL configured in .env")
        return

    if not supabase_key or "your_supabase" in supabase_key.lower():
        print("[DB Error] Database connection failed: Placeholder SUPABASE_ANON_KEY configured in .env")
        return

    try:
        import requests
        headers = {
            "apikey": supabase_key,
            "Authorization": f"Bearer {supabase_key}",
            "Content-Type": "application/json"
        }
        r = requests.get(f"{supabase_url}/rest/v1/teams?select=count", headers=headers, timeout=5)
        if r.status_code == 200:
            print(f"[DB] Database connected successfully! ({supabase_url})")
        elif r.status_code == 401:
            print(f"[DB Error] Database connection failed: RLS Policy / Unauthorized. Please check table permissions.")
        else:
            print(f"[DB Error] Database connection failed: HTTP {r.status_code} ({r.text[:150]})")
    except Exception as e:
        print(f"[DB Error] Database connection failed: {type(e).__name__} - {str(e)}")

def create_app() -> Flask:
    """Application Factory creating and configuring the Flask app instance."""
    app = Flask(__name__)
    
    # 1. Enable CORS for frontend communication.
    # Set CORS_ORIGINS to a comma-separated allowlist in production, e.g.
    #   CORS_ORIGINS=https://zinnia2026.example,https://admin.zinnia2026.example
    # "*" is only the fallback for local development.
    cors_origins = [
        o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()
    ] or ["*"]
    CORS(app, resources={r"/api/*": {"origins": cors_origins}})

    # 2. Register Global Middlewares
    register_error_handlers(app)

    # 3. Register Modular Route Blueprints
    app.register_blueprint(passport_bp)
    app.register_blueprint(registration_bp)
    app.register_blueprint(payment_bp)
    app.register_blueprint(admin_bp)

    # 4. Check DB Connection
    check_db_connection()

    return app

app = create_app()

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    host = os.getenv("HOST", "127.0.0.1")
    debug = os.getenv("DEBUG", "False").lower() == "true"

    # The Werkzeug debugger allows arbitrary code execution through the browser.
    # If bound to a public interface (0.0.0.0), automatically force debug=False.
    if debug and host not in ("127.0.0.1", "localhost"):
        print(f"[!] Security Notice: Automatically disabling DEBUG mode because HOST is bound to '{host}'.")
        debug = False

    if not debug:
        print(
            "[!] app.run() is a development server. For production use gunicorn:\n"
            "    gunicorn --bind 0.0.0.0:%d --workers 4 'app:app'" % port
        )

    print(f"[*] Starting Zinnia 2026 Consolidated Server on http://{host}:{port}")
    app.run(host=host, port=port, debug=debug)
