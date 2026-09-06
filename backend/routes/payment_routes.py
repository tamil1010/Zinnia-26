"""
Zinnia 2026 — Payment Routes
Defines endpoints for participant payment submission and status lookup.
"""

from flask import Blueprint
from controllers.payment_controller import PaymentController
from middleware.auth_middleware import require_role
from middleware.rate_limiter import rate_limit

payment_bp = Blueprint("payment_bp", __name__)

# ------------------------------------------------------------------------------
# Participant Payment Endpoints (public — a participant has no login)
# Rate limited: these are the only unauthenticated write paths in the app.
# ------------------------------------------------------------------------------
payment_bp.route("/api/payment/status", methods=["GET"])(
    rate_limit(60)(PaymentController.get_status)
)
payment_bp.route("/api/payment/submit", methods=["POST"])(
    rate_limit(10)(PaymentController.submit_payment)
)

# ------------------------------------------------------------------------------
# Treasurer Payment Verification Endpoints
# ------------------------------------------------------------------------------
# Previously unauthenticated. `/api/payment/verify` let anyone on the internet
# mark their own team VERIFIED and trigger pass dispatch; `/api/payment/pending`
# returned every payment record including UTR numbers.
payment_bp.route("/api/payment/verify", methods=["POST"])(
    require_role("TREASURER", "SUPER_ADMIN")(PaymentController.verify_payment)
)
payment_bp.route("/api/payment/pending", methods=["GET"])(
    require_role("TREASURER", "SUPER_ADMIN")(PaymentController.get_pending)
)
