"""
Zinnia 2026 — Admin Authentication & RBAC Middleware
Validates HMAC-SHA256 signed bearer tokens and enforces role-based access control.
"""

import os
import hmac
import hashlib
import json
import base64
import time
from functools import wraps
from flask import request, jsonify, g

from dotenv import load_dotenv

load_dotenv()
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))

AUTH_SECRET_KEY = os.getenv("AUTH_SECRET_KEY", "zinnia_2026_auth_secret_key_prod_secure_2026")
if not AUTH_SECRET_KEY:
    raise RuntimeError("CRITICAL SECURITY ERROR: AUTH_SECRET_KEY environment variable is missing!")

def generate_admin_token(user_data: dict, expires_in_seconds: int = 86400 * 7) -> str:
    """Generate a tamper-proof HMAC-signed token for an admin user."""
    payload = {
        "id": str(user_data.get("id", "")),
        "username": user_data.get("username", ""),
        "role": user_data.get("role", ""),
        "name": user_data.get("name", ""),
        "allowed_events": user_data.get("allowed_events", []),
        "exp": int(time.time()) + expires_in_seconds
    }
    payload_json = json.dumps(payload, separators=(',', ':'))
    payload_b64 = base64.urlsafe_b64encode(payload_json.encode()).decode().rstrip("=")
    signature = hmac.new(AUTH_SECRET_KEY.encode(), payload_b64.encode(), hashlib.sha256).hexdigest()
    return f"{payload_b64}.{signature}"

def decode_admin_token(token: str) -> tuple[bool, dict, str]:
    """Verify and decode HMAC-signed token."""
    if not token or "." not in token:
        return False, {}, "Malformed token format."
    
    parts = token.split(".")
    if len(parts) != 2:
        return False, {}, "Invalid token structure."
    
    payload_b64, signature = parts
    expected_sig = hmac.new(AUTH_SECRET_KEY.encode(), payload_b64.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, expected_sig):
        return False, {}, "Invalid token signature."
    
    try:
        # Pad base64 string
        rem = len(payload_b64) % 4
        if rem > 0:
            payload_b64 += "=" * (4 - rem)
        payload_json = base64.urlsafe_b64decode(payload_b64.encode()).decode()
        payload = json.loads(payload_json)
        
        if payload.get("exp", 0) < time.time():
            return False, {}, "Session expired. Please sign in again."
        
        return True, payload, "Valid"
    except Exception as e:
        return False, {}, f"Token decode error: {str(e)}"

def get_current_admin():
    """Extract authenticated admin from request headers."""
    auth_header = request.headers.get("Authorization", "")
    token = ""
    if auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
    elif request.cookies.get("admin_token"):
        token = request.cookies.get("admin_token")
    
    if not token:
        return None
    
    valid, user, _ = decode_admin_token(token)
    return user if valid else None

def require_auth(f):
    """Middleware enforcing valid admin session."""
    @wraps(f)
    def decorated(*args, **kwargs):
        admin = get_current_admin()
        if not admin:
            return jsonify({"success": False, "error_code": "UNAUTHORIZED", "message": "Authentication required. Please sign in."}), 401
        g.admin = admin
        return f(*args, **kwargs)
    return decorated

def require_role(*allowed_roles):
    """Middleware restricting route to specific admin roles."""
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            admin = get_current_admin()
            if not admin:
                return jsonify({"success": False, "error_code": "UNAUTHORIZED", "message": "Authentication required."}), 401
            
            user_role = admin.get("role", "").upper()
            if user_role != "SUPER_ADMIN" and user_role not in [r.upper() for r in allowed_roles]:
                return jsonify({
                    "success": False, 
                    "error_code": "FORBIDDEN", 
                    "message": f"Access denied. Required role: {', '.join(allowed_roles)} (current: {user_role})."
                }), 403
            
            g.admin = admin
            return f(*args, **kwargs)
        return decorated
    return decorator
