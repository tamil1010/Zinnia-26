"""
Zinnia 2026 — Data Models & Schemas
"""

from typing import Optional, List, Dict, Any
from dataclasses import dataclass, asdict

@dataclass
class TeamMemberModel:
    id: str
    team_id: str
    name: str
    email: str
    phone: str
    passport_token: str
    is_leader: bool = False
    food_collected: bool = False
    passport_issued_at: Optional[str] = None
    passport_sent_at: Optional[str] = None
    food_collected_at: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

@dataclass
class TeamModel:
    team_id: str
    team_name: str
    college: str
    department: str
    year: str
    registered_events: List[str]
    payment: bool = False
    members: Optional[List[TeamMemberModel]] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

@dataclass
class AttendanceModel:
    team_id: str
    member_id: str
    participant_name: str
    college: str
    checkin_type: str  # 'ENTRY' | 'EVENT'
    scanned_by: str
    location: str
    passport_token_used: Optional[str] = None
    event_id: Optional[str] = None
    event_name: Optional[str] = None
    scanned_at: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

@dataclass
class PassportDispatchModel:
    member_id: str
    channel: str  # 'EMAIL' | 'WHATSAPP' | 'SMS'
    status: str = "PENDING"  # 'PENDING' | 'SENT' | 'FAILED'
    provider_ref: Optional[str] = None
    error_message: Optional[str] = None
    sent_at: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
