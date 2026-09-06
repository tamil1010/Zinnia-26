"""
Centralized Error Handling Middleware for Flask App.
"""

from flask import Flask, jsonify

def register_error_handlers(app: Flask):
    """Registers standard HTTP and unhandled error handlers on the Flask app."""
    
    @app.errorhandler(400)
    def bad_request(e):
        return jsonify({"success": False, "error": "Bad Request", "message": str(e)}), 400

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"success": False, "error": "Not Found", "message": "Resource not found"}), 404

    @app.errorhandler(429)
    def too_many_requests(e):
        return jsonify({"success": False, "error": "Too Many Requests", "message": "Rate limit exceeded"}), 429

    @app.errorhandler(500)
    def server_error(e):
        return jsonify({"success": False, "error": "Internal Server Error", "message": "An unexpected error occurred"}), 500
