"""
Zinnia 2026 — Registration Controller
Handles team registration requests and event validation.
"""

from flask import request, jsonify
from services.registration_service import register_team_service

class RegistrationController:
    """Controller handling team registration."""

    @staticmethod
    def register():
        """
        POST /api/register
        Accepts: {
          team_name, college, department, year,
          selected_event_ids: ["EV-01", "EV-02"],
          members: [{ name, email, phone, is_leader }]
        }
        """
        data = request.get_json(silent=True) or {}
        print(f"\n[Backend API] 📥 POST /api/register received with payload:\n{data}")
        if not data or not isinstance(data, dict):
            print("[Backend API] ❌ POST /api/register -> HTTP 400 | Invalid JSON body.")
            return jsonify({"success": False, "error_code": "INVALID_BODY", "message": "Invalid JSON body."}), 400

        try:
            result = register_team_service(data)
            if result.get("success"):
                status_code = 200
            elif result.get("error_code") == "DUPLICATE_EMAIL":
                status_code = 409
            elif result.get("error_code") == "VALIDATION_ERROR":
                status_code = 422
            else:
                status_code = 400

            print(f"[Backend API] 📤 POST /api/register -> HTTP {status_code} | Result: {result}\n")
            return jsonify(result), status_code
        except Exception as e:
            print(f"[Backend API Error] ❌ POST /api/register -> HTTP 500 | Exception: {e}\n")
            return jsonify({
                "success": False,
                "error_code": "REGISTRATION_ERROR",
                "message": f"Server encountered an error processing registration: {str(e)}"
            }), 500
