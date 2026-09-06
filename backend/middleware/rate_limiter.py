"""
Rate Limiting & Request Middlewares for Flask Backend.
"""

import os
import time
from functools import wraps
from collections import defaultdict
from flask import request, jsonify

RATE_LIMIT_PER_MINUTE = int(os.getenv("RATE_LIMIT_PER_MINUTE", "60"))
ip_request_history = defaultdict(list)

def rate_limit(limit: int = RATE_LIMIT_PER_MINUTE):
    """Decorator to rate-limit endpoints per client IP."""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            client_ip = request.headers.get("X-Forwarded-For", request.remote_addr or "127.0.0.1")
            now = time.time()
            # Prune timestamps older than 60s
            ip_request_history[client_ip] = [t for t in ip_request_history[client_ip] if now - t < 60]
            if len(ip_request_history[client_ip]) >= limit:
                return jsonify({
                    "error": "Rate limit exceeded. Please wait a moment before sending more queries.",
                    "answer": "Too many requests. Please wait a few moments before asking another question.",
                    "source": "fallback",
                    "cached": False
                }), 429
            ip_request_history[client_ip].append(now)
            return f(*args, **kwargs)
        return decorated_function
    return decorator
