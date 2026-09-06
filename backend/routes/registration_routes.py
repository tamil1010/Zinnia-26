"""
Zinnia 2026 — Registration Routes
Defines endpoint for server-side team and event enrollment.
"""

from flask import Blueprint
from controllers.registration_controller import RegistrationController
from middleware.rate_limiter import rate_limit

registration_bp = Blueprint("registration_bp", __name__)

# Public endpoint — participants have no login, so this is rate limited by IP.
# 10/min is well above a human filling in a form and well below a scripted flood.
registration_bp.route("/api/register", methods=["POST"])(
    rate_limit(10)(RegistrationController.register)
)
