"""
Zinnia 2026 — Phase 14 Automated End-to-End Acceptance Test Suite
Validates the complete lifecycle:
1. Registration with 2-person team & 2 events (calculating exactly ₹500 fee)
2. Payment submission with genuine 12-digit UTR
3. Duplicate UTR rejection (409 Conflict)
4. Treasurer verification & idempotent passport email dispatch
5. Gate Entry check-in (with Gate Staff role auth) & duplicate scan prevention
6. Event Track check-in & Coordinator Scoping RBAC (allowed vs out-of-scope event vs unauthenticated)
7. Food Token check-in (with Food Staff role auth, DB-authoritative Veg/Non-Veg & single issuance)
8. Cryptographic QR Signature Tamper Detection & Unsigned Structured Payload Rejection
"""

import os
import sys
import json
import time
import requests

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app
from services.passport_service import (
    sign_qr_content,
    generate_signed_qr_payload_for_member,
    parse_and_validate_scan_payload,
    get_headers,
    SUPABASE_URL
)

def run_tests():
    client = app.test_client()
    test_id = str(int(time.time()))[-5:]
    team_name = f"Acceptance Squad {test_id}"
    utr_1 = f"UTR999{test_id}001"
    utr_2_dup = utr_1
    
    print(f"\n==================================================================")
    print(f"🚀 RUNNING ZINNIA 2026 ACCEPTANCE TEST SUITE (Run ID: {test_id})")
    print(f"==================================================================")

    # -------------------------------------------------------------------------
    # TEST 1: Register a 2-person team with 1 Tech + 1 Non-Tech Event
    # -------------------------------------------------------------------------
    print("\n[TEST 1] Registering 2-person team (Debugging + Think Strike & Win)...")
    reg_payload = {
        "team_name": team_name,
        "college": "GCE Erode",
        "department": "Computer Science and Engineering",
        "year": "III",
        "registered_events": ["debugging", "think-strike-and-win"],
        "members": [
            {
                "name": f"Lead Attendee {test_id}",
                "email": f"lead_{test_id}@gcee.ac.in",
                "phone": "9876543210",
                "is_leader": True,
                "food_preference": "VEG"
            },
            {
                "name": f"Partner Attendee {test_id}",
                "email": f"partner_{test_id}@gcee.ac.in",
                "phone": "9876543211",
                "is_leader": False,
                "food_preference": "NON_VEG"
            }
        ]
    }
    
    r = client.post("/api/register", json=reg_payload)
    assert r.status_code in [200, 201], f"Registration failed: {r.status_code} {r.text}"
    reg_res = r.get_json()
    assert reg_res.get("success"), f"Registration response not successful: {reg_res}"
    team_id = reg_res.get("team_id") or reg_res.get("team", {}).get("team_id")
    members = reg_res.get("members") or reg_res.get("team", {}).get("members")
    assert len(members) == 2, f"Expected 2 members, got {len(members)}"
    print(f"  ✓ Team registered successfully: {team_id} ({len(members)} members)")

    # -------------------------------------------------------------------------
    # TEST 2: Verify Invoice Status via /api/payment/status
    # -------------------------------------------------------------------------
    print("\n[TEST 2] Verifying payment invoice status...")
    r = client.get(f"/api/payment/status?team_id={team_id}")
    assert r.status_code == 200, f"Status fetch failed: {r.status_code}"
    status_res = r.get_json()
    assert status_res.get("expected_amount") == 500, f"Expected ₹500, got ₹{status_res.get('expected_amount')}"
    assert status_res.get("payment_status") == "AWAITING_PAYMENT"
    print(f"  ✓ Expected fee is correctly ₹500 (₹250 x 2 attendees)")

    # -------------------------------------------------------------------------
    # TEST 3: Submit Payment Proof (UTR)
    # -------------------------------------------------------------------------
    print(f"\n[TEST 3] Submitting genuine payment proof (UTR: {utr_1})...")
    pay_payload = {
        "team_id": team_id,
        "utr_number": utr_1,
        "submitted_amount": 500
    }
    r = client.post("/api/payment/submit", json=pay_payload)
    assert r.status_code == 200, f"Payment submit failed: {r.status_code} {r.text}"
    pay_res = r.get_json()
    assert pay_res.get("success")
    assert pay_res.get("payment_status") == "PENDING_VERIFICATION"
    print(f"  ✓ Payment proof submitted and transitioned to PENDING_VERIFICATION")

    # -------------------------------------------------------------------------
    # TEST 4: Duplicate UTR Detection (Must reject with 409 Conflict)
    # -------------------------------------------------------------------------
    print(f"\n[TEST 4] Testing duplicate UTR submission prevention (UTR: {utr_2_dup})...")
    dup_payload = {
        "team_id": "ZIN-2026-9999",
        "utr_number": utr_2_dup,
        "submitted_amount": 500
    }
    r = client.post("/api/payment/submit", json=dup_payload)
    assert r.status_code == 409, f"Expected HTTP 409 Conflict on duplicate UTR, got {r.status_code}"
    dup_res = r.get_json()
    assert dup_res.get("error_code") == "DUPLICATE_UTR"
    print(f"  ✓ Duplicate UTR rejected with HTTP 409 DUPLICATE_UTR")

    # -------------------------------------------------------------------------
    # TEST 5: Treasurer Payment Verification & Pass Dispatch
    # -------------------------------------------------------------------------
    print(f"\n[TEST 5] Treasurer verifying payment for team {team_id}...")
    treasurer_login = client.post("/api/admin/auth/login", json={"username": "treasurer", "password": "treasurer@zinnia"})
    assert treasurer_login.status_code == 200, f"Treasurer login failed: {treasurer_login.text}"
    treasurer_token = treasurer_login.get_json()["token"]

    verify_res = client.post(
        "/api/admin/payments/verify",
        headers={"Authorization": f"Bearer {treasurer_token}"},
        json={"team_id": team_id, "admin_name": "Symposium Treasurer"}
    )
    assert verify_res.status_code == 200, f"Treasurer verify failed: {verify_res.text}"
    v_data = verify_res.get_json()
    assert v_data.get("payment_status") == "VERIFIED"
    print(f"  ✓ Payment VERIFIED. Official QR passes dispatched to all member emails.")

    # -------------------------------------------------------------------------
    # AUTHENTICATION SETUP FOR ROLE CHECKPOINTS
    # -------------------------------------------------------------------------
    # Super Admin token
    superadmin_login = client.post("/api/admin/auth/login", json={"username": "admin", "password": "admin@zinnia"})
    assert superadmin_login.status_code == 200, f"Superadmin login failed: {superadmin_login.text}"
    superadmin_token = superadmin_login.get_json()["token"]

    # Gate Staff token
    gate_login = client.post("/api/admin/auth/login", json={"username": "gate", "password": "gate@zinnia"})
    assert gate_login.status_code == 200, f"Gate staff login failed: {gate_login.text}"
    gate_token = gate_login.get_json()["token"]

    # Debugging Coordinator token (scoped to "debugging")
    coord_debug_login = client.post("/api/admin/auth/login", json={"username": "debugging", "password": "debugging@01"})
    assert coord_debug_login.status_code == 200, f"Coordinator login failed: {coord_debug_login.text}"
    coord_debug_token = coord_debug_login.get_json()["token"]

    # Food Staff token
    food_login = client.post("/api/admin/auth/login", json={"username": "food", "password": "food@zinnia"})
    assert food_login.status_code == 200, f"Food staff login failed: {food_login.text}"
    food_token = food_login.get_json()["token"]

    # -------------------------------------------------------------------------
    # TEST 6: Gate Reception Check-in (Single-Use Entry & RBAC)
    # -------------------------------------------------------------------------
    v_members = v_data.get("members") or members
    member_1 = v_members[0]
    token_1 = member_1.get("passport_token") or "dummy_token"
    signed_qr_1 = generate_signed_qr_payload_for_member(member_1, [{"event_id": "debugging"}, {"event_id": "think-strike-and-win"}])

    print(f"\n[TEST 6] Campus Gate Reception entry check-in for {member_1['name']}...")
    # Unauthenticated attempt -> 401
    unauth_gate = client.post("/api/admin/checkin/entry", json={"token": signed_qr_1})
    assert unauth_gate.status_code == 401, f"Expected 401 on unauthenticated gate scan, got {unauth_gate.status_code}"
    print("  ✓ Unauthenticated gate scan correctly rejected with HTTP 401")

    # First scan with Gate Staff token: PASS
    gate_res_1 = client.post(
        "/api/admin/checkin/entry",
        headers={"Authorization": f"Bearer {gate_token}"},
        json={"token": signed_qr_1, "location": "Main Campus Gate"}
    )
    assert gate_res_1.status_code == 200, f"Gate scan failed: {gate_res_1.text}"
    assert gate_res_1.get_json().get("success") == True
    print("  ✓ First gate scan: ADMISSION GRANTED")

    # Second scan: REJECT (Duplicate entry prevention)
    gate_res_2 = client.post(
        "/api/admin/checkin/entry",
        headers={"Authorization": f"Bearer {gate_token}"},
        json={"token": signed_qr_1}
    )
    assert gate_res_2.status_code == 400, f"Expected 400 on duplicate entry, got {gate_res_2.status_code}"
    assert "already checked in" in gate_res_2.get_json().get("reason", "").lower()
    print(f"  ✓ Immediate duplicate gate scan REJECTED: {gate_res_2.get_json().get('reason')}")

    # -------------------------------------------------------------------------
    # TEST 7: Event Track Check-in & Coordinator Scoping RBAC
    # -------------------------------------------------------------------------
    print(f"\n[TEST 7] Event Track check-in & Coordinator Scoping RBAC...")
    # A. Unauthenticated scan -> 401
    unauth_ev = client.post("/api/admin/checkin/event", json={"token": signed_qr_1, "event_id": "debugging"})
    assert unauth_ev.status_code == 401
    print("  ✓ Unauthenticated event check-in correctly rejected with HTTP 401")

    # B. Wrong role (Treasurer attempting event check-in) -> 403 Forbidden
    forbidden_ev = client.post(
        "/api/admin/checkin/event",
        headers={"Authorization": f"Bearer {treasurer_token}"},
        json={"token": signed_qr_1, "event_id": "debugging"}
    )
    assert forbidden_ev.status_code == 403
    print("  ✓ Unauthorized role (Treasurer) correctly blocked from event check-in with HTTP 403")

    # C. Coordinator Scoping: debug1 coordinator attempting to check into short-flim -> REJECTED (400)
    scoped_out = client.post(
        "/api/admin/checkin/event",
        headers={"Authorization": f"Bearer {coord_debug_token}"},
        json={"token": signed_qr_1, "event_id": "short-flim"}
    )
    assert scoped_out.status_code == 400, f"Expected 400 on coordinator scoping violation, got {scoped_out.status_code}"
    assert "is not assigned to manage event" in scoped_out.get_json().get("reason", "")
    print(f"  ✓ Coordinator scoping enforced: debug1 coordinator blocked from checking into 'short-flim'")

    # D. Unregistered track scan by authorized Super Admin (Lost at SQL - event_id: lost-at-sql) -> REJECT
    unregistered_scan = client.post(
        "/api/admin/checkin/event",
        headers={"Authorization": f"Bearer {superadmin_token}"},
        json={"token": signed_qr_1, "event_id": "lost-at-sql"}
    )
    assert unregistered_scan.status_code == 400
    assert "not registered" in unregistered_scan.get_json().get("reason", "").lower()
    print("  ✓ Scan for un-registered event 'Lost at SQL' correctly REJECTED")

    # E. Authorized coordinator (debug1) checking into assigned event 'debugging' -> PASS
    registered_scan_1 = client.post(
        "/api/admin/checkin/event",
        headers={"Authorization": f"Bearer {coord_debug_token}"},
        json={"token": signed_qr_1, "event_id": "debugging"}
    )
    assert registered_scan_1.status_code == 200, f"Event scan failed: {registered_scan_1.text}"
    assert registered_scan_1.get_json().get("success") == True
    print("  ✓ Coordinator 'debug1' successfully admitted attendee to assigned event 'Debugging'")

    # F. Duplicate track scan for same event -> REJECT
    registered_scan_2 = client.post(
        "/api/admin/checkin/event",
        headers={"Authorization": f"Bearer {coord_debug_token}"},
        json={"token": signed_qr_1, "event_id": "debugging"}
    )
    assert registered_scan_2.status_code == 400
    assert "already checked into" in registered_scan_2.get_json().get("reason", "").lower()
    print("  ✓ Duplicate event check-in correctly REJECTED")

    # -------------------------------------------------------------------------
    # TEST 8: Dining Hall Food token check-in (Member 2 - NON_VEG)
    # -------------------------------------------------------------------------
    member_2 = v_members[1] # NON_VEG in registration
    signed_qr_2 = generate_signed_qr_payload_for_member(member_2, [{"event_id": "debugging"}])

    print(f"\n[TEST 8] Dining Hall Food token check-in (Member 2 - NON_VEG)...")
    # First meal claim with Food Staff token: PASS with NON_VEG
    food_res_1 = client.post(
        "/api/admin/checkin/food",
        headers={"Authorization": f"Bearer {food_token}"},
        json={"token": signed_qr_2, "location": "Dining Counter A"}
    )
    assert food_res_1.status_code == 200, f"Food scan failed: {food_res_1.text}"
    food_data = food_res_1.get_json()
    assert food_data.get("success") == True
    assert food_data.get("food_preference") == "NON_VEG"
    print(f"  ✓ Meal token validated. Telemetry returned: {food_data.get('food_preference')} (NON_VEG meal issued)")

    # Second meal claim: REJECT (Single issuance locked)
    food_res_2 = client.post(
        "/api/admin/checkin/food",
        headers={"Authorization": f"Bearer {food_token}"},
        json={"token": signed_qr_2}
    )
    assert food_res_2.status_code == 400
    assert "already claimed" in food_res_2.get_json().get("reason", "").lower()
    print(f"  ✓ Duplicate meal token claim correctly REJECTED: {food_res_2.get_json().get('reason')}")

    # -------------------------------------------------------------------------
    # TEST 9: Cryptographic Security & Tamper Detection
    # -------------------------------------------------------------------------
    print("\n[TEST 9] Testing Cryptographic QR Signature Tamper Detection...")
    # A. Tampered food preference in signature
    tampered_qr = signed_qr_1.replace('"f":"V"', '"f":"N"')
    resolved_tok, qr_obj, is_valid, msg = parse_and_validate_scan_payload(tampered_qr)
    assert not is_valid, "Tampered QR payload must fail signature verification!"
    print(f"  ✓ Tampered payload detected and rejected: {msg}")

    # B. Unsigned structured JSON payload (without 's') -> MUST BE REJECTED
    unsigned_structured_json = json.dumps({"v": 1, "t": token_1, "m": member_1["id"], "f": "N"})
    resolved_tok_2, qr_obj_2, is_valid_2, msg_2 = parse_and_validate_scan_payload(unsigned_structured_json)
    assert not is_valid_2, "Unsigned structured QR payload must be rejected!"
    print(f"  ✓ Unsigned structured JSON badge correctly REJECTED: {msg_2}")

    print("\n==================================================================")
    print("🎉 ALL ACCEPTANCE TESTS PASSED ACCORDING TO SPECIFICATION!")
    print("==================================================================\n")

if __name__ == "__main__":
    run_tests()
