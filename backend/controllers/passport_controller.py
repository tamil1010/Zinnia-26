"""
Zinnia 2026 — Passport & Check-in Controller
Handles request parsing, input validation, and responses for Digital Passport & Checkpoints.
"""

from flask import request, jsonify
from services.passport_service import (
    process_entry_checkin,
    process_event_checkin,
    process_food_checkin,
    trigger_passport_dispatch,
    update_dispatch_status,
    lookup_member
)

class PassportController:
    """Controller handling Passport Lookup, Entry, Event, Food, and Dispatch endpoints."""

    @staticmethod
    def lookup_passport():
        """GET /api/passport/lookup — Find member and team by token, ID, or email."""
        q = request.args.get("token") or request.args.get("id") or request.args.get("q", "")
        if not q:
            return jsonify({"success": False, "reason": "No identifier provided."}), 400
        
        member, team = lookup_member(q)
        if not member:
            return jsonify({"success": False, "reason": f"No record found for '{q}'."}), 404
            
        return jsonify({"success": True, "member": member, "team": team})

    @staticmethod
    def checkin_entry():
        """POST /api/checkin/entry — Campus Entry Gate check-in."""
        data = request.get_json(silent=True) or {}
        token_or_id = data.get("passport_token") or data.get("id") or data.get("token", "")
        admin_user = getattr(g, "admin", None)
        scanned_by = admin_user.get("name") if admin_user else data.get("scanned_by", "Gate Reception Desk")
        location = data.get("location", "Main Campus Gate")

        if not token_or_id:
            return jsonify({"success": False, "reason": "Missing passport_token or id in request body."}), 400

        result = process_entry_checkin(token_or_id=token_or_id, scanned_by=scanned_by, location=location)
        status_code = 200 if result.get("success") else 400
        return jsonify(result), status_code

    @staticmethod
    def checkin_event():
        """POST /api/checkin/event — Event Track admittance verification."""
        data = request.get_json(silent=True) or {}
        token_or_id = data.get("passport_token") or data.get("id") or data.get("token", "")
        event_id = data.get("event_id", "")
        admin_user = getattr(g, "admin", None)
        scanned_by = admin_user.get("name") if admin_user else data.get("scanned_by", "Event Coordinator")
        location = data.get("location", "Event Room")

        if not token_or_id or not event_id:
            return jsonify({"success": False, "reason": "Missing passport_token (or id) or event_id."}), 400

        result = process_event_checkin(
            token_or_id=token_or_id,
            event_id=event_id,
            scanned_by=scanned_by,
            location=location,
            admin_user=admin_user
        )
        status_code = 200 if result.get("success") else 400
        return jsonify(result), status_code

    @staticmethod
    def checkin_food():
        """POST /api/checkin/food — Food & Refreshment token lock."""
        data = request.get_json(silent=True) or {}
        token_or_id = data.get("passport_token") or data.get("id") or data.get("token", "")
        admin_user = getattr(g, "admin", None)
        scanned_by = admin_user.get("name") if admin_user else data.get("scanned_by", "Dining Staff")
        location = data.get("location", "Dining Hall")

        if not token_or_id:
            return jsonify({"success": False, "reason": "Missing passport_token or id in request body."}), 400

        result = process_food_checkin(token_or_id=token_or_id, scanned_by=scanned_by, location=location)
        status_code = 200 if result.get("success") else 400
        return jsonify(result), status_code

    @staticmethod
    def dispatch_webhook():
        """POST /api/passport-dispatch/webhook — Trigger webhook to n8n for team passes."""
        data = request.get_json(silent=True) or {}
        team_id = data.get("team_id")
        app_base_url = data.get("app_base_url", request.host_url.rstrip("/"))
        if not team_id:
            return jsonify({"success": False, "error": "Missing team_id."}), 400

        res = trigger_passport_dispatch(team_id, app_base_url)
        return jsonify(res)

    @staticmethod
    def dispatch_callback():
        """POST /api/passport-dispatch/callback — n8n delivery status callback."""
        data = request.get_json(silent=True) or {}
        member_id = data.get("member_id")
        status = data.get("status", "SENT").upper()
        channel = data.get("channel", "WHATSAPP")
        provider_ref = data.get("provider_ref")
        error_message = data.get("error_message")

        if not member_id:
            return jsonify({"success": False, "error": "Missing member_id."}), 400

        res = update_dispatch_status(
            member_id=member_id,
            status=status,
            channel=channel,
            provider_ref=provider_ref,
            error_message=error_message
        )
        return jsonify(res)

    @staticmethod
    def dispatch_resend():
        """POST /api/passport-dispatch/resend — Manual pass re-dispatch."""
        data = request.get_json(silent=True) or {}
        member_id = data.get("member_id") or data.get("id") or data.get("email")
        if not member_id:
            return jsonify({"success": False, "error": "Missing member_id or email."}), 400

        member, team = lookup_member(member_id)
        if not member:
            return jsonify({"success": False, "error": f"Member '{member_id}' not found."}), 404

        team_id = member.get("team_id", "")
        res = trigger_passport_dispatch(team_id)
        return jsonify({"success": True, "message": f"Pass re-dispatched for {member.get('name')}", "details": res})

    @staticmethod
    def serve_qr_image(token_or_id: str):
        """GET /api/passport/qr/<token_or_id> — Render and stream raw PNG QR Code image."""
        from services.passport_service import generate_qr_image_bytes
        from flask import Response
        if not token_or_id:
            return jsonify({"error": "Missing token or ID"}), 400
        
        png_bytes = generate_qr_image_bytes(token_or_id)
        if not png_bytes:
            return jsonify({"error": "Failed to generate QR"}), 500
            
        return Response(png_bytes, mimetype="image/png")

    @staticmethod
    def send_passport_email():
        """POST /api/passport/send-email — Dispatch pass email to a specific member or whole team."""
        data = request.get_json(silent=True) or {}
        team_id = data.get("team_id")
        member_id = data.get("member_id") or data.get("email") or data.get("token")
        
        if member_id:
            member, team = lookup_member(member_id)
            if not member:
                return jsonify({"success": False, "error": f"Participant '{member_id}' not found."}), 404
            team_id = member.get("team_id", "")

        if not team_id:
            return jsonify({"success": False, "error": "Must provide team_id, member_id, email, or token."}), 400

        res = trigger_passport_dispatch(team_id)
        return jsonify(res)
