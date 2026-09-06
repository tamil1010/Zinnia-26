"""
Zinnia 2026 — Payment Controller
Handles UPI payment submissions and status inquiries.
"""

from flask import request, jsonify
from services.payment_service import (
    submit_payment_service,
    get_payment_status_service,
    verify_payment_by_treasurer,
    get_pending_payments_service
)

class PaymentController:
    """Controller handling payment operations."""

    @staticmethod
    def get_status():
        """GET /api/payment/status?team_id=... — Fetch live payment details."""
        team_id = request.args.get("team_id") or request.args.get("id", "")
        print(f"\n[Backend API] 📥 GET /api/payment/status?team_id={team_id}")
        if not team_id:
            print("[Backend API] ❌ GET /api/payment/status -> HTTP 400 | Missing team_id")
            return jsonify({"success": False, "error_code": "TEAM_NOT_FOUND", "message": "Missing team_id parameter."}), 400

        result = get_payment_status_service(team_id)
        status_code = 200 if result.get("success") else 404
        print(f"[Backend API] 📤 GET /api/payment/status -> HTTP {status_code} | Result: {result}\n")
        return jsonify(result), status_code

    @staticmethod
    def submit_payment():
        """
        POST /api/payment/submit
        Accepts: { "team_id": "...", "utr_number": "...", "submitted_amount": 500 }
        """
        data = request.get_json(silent=True) or {}
        team_id = data.get("team_id")
        utr_number = data.get("utr_number")
        print(f"\n[Backend API] 📥 POST /api/payment/submit received: {data}")
        
        try:
            submitted_amount = float(data.get("submitted_amount", 0))
        except (ValueError, TypeError):
            submitted_amount = 0

        result = submit_payment_service(
            team_id=team_id,
            utr_number=utr_number,
            submitted_amount=submitted_amount
        )
        status_code = 200 if result.get("success") else (result.get("status_code") or 400)
        print(f"[Backend API] 📤 POST /api/payment/submit -> HTTP {status_code} | Result: {result}\n")
        return jsonify(result), status_code

    @staticmethod
    def verify_payment():
        """
        POST /api/payment/verify — Treasurer verifies or rejects payment.
        Accepts: { "team_id": "...", "action": "VERIFY" | "REJECT", "reason": "..." }
        """
        data = request.get_json(silent=True) or {}
        team_id = data.get("team_id")
        action = str(data.get("action", "VERIFY")).upper()
        reason = data.get("reason", "")

        if not team_id:
            return jsonify({"success": False, "message": "team_id is required."}), 400

        # Whitelist the action. verify_payment_by_treasurer treats anything that
        # is not "VERIFY" as a rejection, so an unrecognised value used to
        # silently REJECT a team's payment instead of erroring.
        if action not in ("VERIFY", "REJECT"):
            return jsonify({
                "success": False,
                "error_code": "INVALID_ACTION",
                "message": f"Unsupported action '{action}'. Must be 'VERIFY' or 'REJECT'."
            }), 400

        # A rejection must say why — the participant sees this on the
        # confirmation page and needs it to resubmit.
        if action == "REJECT" and not str(reason).strip():
            return jsonify({
                "success": False,
                "error_code": "REASON_REQUIRED",
                "message": "A rejection reason is required so the team knows what to correct."
            }), 400

        result = verify_payment_by_treasurer(team_id, action, reason)
        status_code = 200 if result.get("success") else 400
        return jsonify(result), status_code

    @staticmethod
    def get_pending():
        """GET /api/payment/pending — List all pending payments awaiting treasurer verification."""
        result = get_pending_payments_service()
        return jsonify(result), 200
