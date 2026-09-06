"""
Zinnia 2026 — Admin Routes Blueprint
Consolidates all administrative, coordinator, payment verification, and check-in endpoints.
"""

from flask import Blueprint
from controllers.admin_controller import AdminController
from middleware.auth_middleware import require_auth, require_role

admin_bp = Blueprint("admin_bp", __name__)

# Authentication & User Profile
admin_bp.add_url_rule("/api/admin/auth/login", endpoint="admin_auth_login", view_func=AdminController.login, methods=["POST"])
admin_bp.add_url_rule("/api/admin/login", endpoint="admin_login", view_func=AdminController.login, methods=["POST"])
admin_bp.add_url_rule("/api/admin/me", endpoint="admin_me", view_func=require_auth(AdminController.get_me), methods=["GET"])

# Telemetry & Dashboard Stats (Authenticated)
admin_bp.add_url_rule("/api/admin/stats", endpoint="admin_stats", view_func=require_auth(AdminController.get_stats), methods=["GET"])
admin_bp.add_url_rule("/api/admin/dashboard", endpoint="admin_dashboard", view_func=require_auth(AdminController.get_dashboard), methods=["GET"])

# Events Oversight & Management
admin_bp.add_url_rule("/api/admin/event-participants", endpoint="admin_event_participants_clean", view_func=require_auth(AdminController.get_event_participants), methods=["GET", "POST", "OPTIONS"])
admin_bp.add_url_rule("/api/admin/events-participants", endpoint="admin_events_participants_clean", view_func=require_auth(AdminController.get_event_participants), methods=["GET", "POST", "OPTIONS"])
admin_bp.add_url_rule("/api/admin/events/participants", endpoint="admin_events_participants", view_func=require_auth(AdminController.get_event_participants), methods=["GET", "POST", "OPTIONS"])
admin_bp.add_url_rule("/api/admin/events", endpoint="admin_events", view_func=require_auth(AdminController.get_events), methods=["GET"])
admin_bp.add_url_rule("/api/admin/events/<event_id>", endpoint="admin_events_update", view_func=require_role("SUPER_ADMIN")(AdminController.update_event), methods=["PATCH", "PUT"])

# Audit Logs & Settings
admin_bp.add_url_rule("/api/admin/audit", endpoint="admin_audit", view_func=require_auth(AdminController.get_audit), methods=["GET"])
admin_bp.add_url_rule("/api/admin/settings", endpoint="admin_settings_get", view_func=require_auth(AdminController.get_settings), methods=["GET"])
admin_bp.add_url_rule("/api/admin/settings", endpoint="admin_settings_update", view_func=require_role("SUPER_ADMIN")(AdminController.update_settings), methods=["POST", "PUT"])

# Exports
admin_bp.add_url_rule("/api/admin/export/preview", endpoint="admin_export_preview", view_func=require_auth(AdminController.export_preview), methods=["GET"])
admin_bp.add_url_rule("/api/admin/export/download", endpoint="admin_export_download", view_func=require_auth(AdminController.export_download), methods=["GET"])

# Admin Check-in Operations (Under /api/admin/checkin/*)
admin_bp.add_url_rule("/api/admin/checkin/entry", endpoint="admin_checkin_entry", view_func=require_role("ENTRY_STAFF", "GATE_ADMIN", "SUPER_ADMIN")(AdminController.checkin_entry), methods=["POST"])
admin_bp.add_url_rule("/api/admin/checkin/event", endpoint="admin_checkin_event", view_func=require_role("EVENT_COORDINATOR", "EVENT_ADMIN", "SUPER_ADMIN")(AdminController.checkin_event), methods=["POST"])
admin_bp.add_url_rule("/api/admin/checkin/food", endpoint="admin_checkin_food", view_func=require_role("FOOD_STAFF", "FOOD_ADMIN", "SUPER_ADMIN")(AdminController.checkin_food), methods=["POST"])

# Payment Verification Operations (Treasurer & Super Admin)
admin_bp.add_url_rule("/api/admin/payments", endpoint="admin_payments", view_func=require_role("TREASURER", "SUPER_ADMIN")(AdminController.get_payments), methods=["GET"])
admin_bp.add_url_rule("/api/admin/payments/list", endpoint="admin_payments_list", view_func=require_role("TREASURER", "SUPER_ADMIN")(AdminController.get_payments), methods=["GET"])
admin_bp.add_url_rule("/api/admin/payments/verify", endpoint="admin_payments_verify", view_func=require_role("TREASURER", "SUPER_ADMIN")(AdminController.verify_payment_endpoint), methods=["POST"])
admin_bp.add_url_rule("/api/admin/payment/verify", endpoint="admin_payment_verify_singular", view_func=require_role("TREASURER", "SUPER_ADMIN")(AdminController.verify_payment_endpoint), methods=["POST"])
admin_bp.add_url_rule("/api/admin/payments/reject", endpoint="admin_payments_reject", view_func=require_role("TREASURER", "SUPER_ADMIN")(AdminController.reject_payment_endpoint), methods=["POST"])
admin_bp.add_url_rule("/api/admin/payment/reject", endpoint="admin_payment_reject_singular", view_func=require_role("TREASURER", "SUPER_ADMIN")(AdminController.reject_payment_endpoint), methods=["POST"])
admin_bp.add_url_rule("/api/admin/payments/hold", endpoint="admin_payments_hold", view_func=require_role("TREASURER", "SUPER_ADMIN")(AdminController.hold_payment), methods=["POST"])
admin_bp.add_url_rule("/api/admin/payment/hold", endpoint="admin_payment_hold_singular", view_func=require_role("TREASURER", "SUPER_ADMIN")(AdminController.hold_payment), methods=["POST"])
admin_bp.add_url_rule("/api/admin/payments/delete", endpoint="admin_payments_delete", view_func=require_role("TREASURER", "SUPER_ADMIN")(AdminController.delete_payment), methods=["POST", "DELETE"])
admin_bp.add_url_rule("/api/admin/payment/delete", endpoint="admin_payment_delete_singular", view_func=require_role("TREASURER", "SUPER_ADMIN")(AdminController.delete_payment), methods=["POST", "DELETE"])
admin_bp.add_url_rule("/api/admin/payments/bulk-verify", endpoint="admin_payments_bulk_verify", view_func=require_role("TREASURER", "SUPER_ADMIN")(AdminController.bulk_verify_payments), methods=["POST"])
