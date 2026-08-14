from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import uuid
import logging
import bcrypt
import jwt
import hashlib
import secrets
import smtplib
from datetime import datetime, timezone, timedelta
from email.message import EmailMessage
from typing import List, Optional, Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, Query
from fastapi.security import HTTPBearer
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict


# ---------- Config ----------
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_MINUTES = 60 * 24  # 24h
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@roombook.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Admin@123")
APP_HOST = os.environ.get("APP_HOST", "0.0.0.0")
APP_PORT = int(os.environ.get("APP_PORT", "8000"))
UVICORN_RELOAD = os.environ.get("UVICORN_RELOAD", "true").lower() == "true"
APP_PUBLIC_URL = os.environ.get("APP_PUBLIC_URL", "http://localhost:3001").rstrip("/")
PASSWORD_RESET_MINUTES = int(os.environ.get("PASSWORD_RESET_MINUTES", "30"))
PASSWORD_RESET_DEV_MODE = os.environ.get("PASSWORD_RESET_DEV_MODE", "false").lower() == "true"
SMTP_HOST = os.environ.get("SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USERNAME = os.environ.get("SMTP_USERNAME", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
SMTP_FROM = os.environ.get("SMTP_FROM", SMTP_USERNAME or ADMIN_EMAIL)
SMTP_USE_TLS = os.environ.get("SMTP_USE_TLS", "true").lower() == "true"
try:
    APP_TIMEZONE = ZoneInfo(os.environ.get("APP_TIMEZONE", "Asia/Jakarta"))
except ZoneInfoNotFoundError:
    APP_TIMEZONE = timezone(timedelta(hours=7))

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="Meeting Room Booking API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("roombook")


# ---------- Helpers ----------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_MINUTES),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(request: Request) -> dict:
    token = None
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    _normalize_user_public(user)
    if not user.get("is_approved", True):
        raise HTTPException(status_code=403, detail="Your account is waiting for admin approval")
    return user


ADMIN_ROLES = {"meeting_admin", "car_admin", "manager", "super_admin"}
MEETING_ADMIN_ROLES = {"meeting_admin", "super_admin"}
CAR_ADMIN_ROLES = {"car_admin", "super_admin"}
FNB_MANAGER_ROLES = {"manager", "super_admin"}
MEETING_BLOCKING_STATUSES = ["pending", "confirmed", "approved"]
DEFAULT_OPERATING_START_TIME = "08:00"
DEFAULT_OPERATING_END_TIME = "17:30"
DEFAULT_ROOM_BUILDING = "Unassigned"
LAYOUT_OPTIONS = {"U-Shape", "Classroom", "Round", "Theater", "Lainnya"}


async def require_any_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


async def require_meeting_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") not in MEETING_ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Meeting-room admin access required")
    return user


async def require_super_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")
    return user


async def require_fnb_manager(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") not in FNB_MANAGER_ROLES:
        raise HTTPException(status_code=403, detail="F&B manager access required")
    return user


# Backward-compat alias — treat the old 'admin' name as meeting admin checker for existing routes.
require_admin = require_meeting_admin


# ---------- Models ----------
class UserPublic(BaseModel):
    id: str
    email: EmailStr
    name: str
    company_name: str = ""
    job_title: str = ""
    department: str = ""
    office_address: str = ""
    meeting_buildings: List[str] = []
    fnb_locations: List[str] = []
    role: Literal["user", "meeting_admin", "car_admin", "manager", "super_admin"]
    is_approved: bool = True
    approved_at: Optional[str] = None
    approved_by: Optional[str] = None
    created_at: str


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1)
    company_name: str = Field(min_length=1, max_length=120)
    job_title: str = Field(min_length=1, max_length=120)
    department: str = Field(min_length=1, max_length=120)
    office_address: str = Field(min_length=1, max_length=240)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ForgotPasswordResponse(BaseModel):
    ok: bool = True
    message: str
    reset_url: Optional[str] = None


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=20)
    password: str = Field(min_length=6)


class AuthResponse(BaseModel):
    user: UserPublic
    access_token: str
    token_type: str = "bearer"


class RegisterResponse(BaseModel):
    ok: bool = True
    message: str


class RoomBase(BaseModel):
    name: str
    building: str = DEFAULT_ROOM_BUILDING
    location: str
    capacity: int = Field(ge=1)
    facilities: List[str] = []
    description: str = ""
    image_url: Optional[str] = None
    is_active: bool = True
    operating_start_time: str = DEFAULT_OPERATING_START_TIME
    operating_end_time: str = DEFAULT_OPERATING_END_TIME
    layout_fixed: bool = True


class RoomCreate(RoomBase):
    pass


class RoomUpdate(BaseModel):
    name: Optional[str] = None
    building: Optional[str] = None
    location: Optional[str] = None
    capacity: Optional[int] = None
    facilities: Optional[List[str]] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    is_active: Optional[bool] = None
    operating_start_time: Optional[str] = None
    operating_end_time: Optional[str] = None
    layout_fixed: Optional[bool] = None


class Room(RoomBase):
    id: str
    created_at: str


class BookingCreate(BaseModel):
    room_id: str
    title: str = Field(min_length=1)
    date: str  # YYYY-MM-DD
    start_time: str  # HH:MM (24h)
    end_time: str  # HH:MM (24h)
    participants: int = Field(ge=1)
    layout_type: str = ""
    layout_other: str = ""
    phone_number: str = ""
    additional_facilities: List[str] = []
    food_beverages: str = ""
    fnb_department: str = ""
    fnb_division: str = ""
    fnb_cost_center: str = ""
    fnb_activity_code: str = ""
    fnb_activity_name: str = ""
    guest_type: str = ""
    snack_type: str = ""
    snack_times: Optional[int] = None
    snack_pax: Optional[int] = None
    snack_packaging: str = ""
    meal_types: List[str] = []
    meal_pax: Optional[int] = None
    meal_packaging: str = ""
    notes: Optional[str] = ""


class BookingStatusUpdate(BaseModel):
    status: Literal["pending", "confirmed", "cancelled", "completed"]


class FnbStatusUpdate(BaseModel):
    status: Literal["pending", "approved", "rejected"]


class Booking(BaseModel):
    id: str
    room_id: str
    room_name: str
    room_building: str = DEFAULT_ROOM_BUILDING
    user_id: str
    user_name: str
    user_email: str
    title: str
    date: str
    start_time: str
    end_time: str
    participants: int
    layout_type: str = ""
    layout_other: str = ""
    phone_number: str = ""
    additional_facilities: List[str] = []
    food_beverages: str = ""
    fnb_department: str = ""
    fnb_division: str = ""
    fnb_cost_center: str = ""
    fnb_activity_code: str = ""
    fnb_activity_name: str = ""
    guest_type: str = ""
    snack_type: str = ""
    snack_times: Optional[int] = None
    snack_pax: Optional[int] = None
    snack_packaging: str = ""
    meal_types: List[str] = []
    meal_pax: Optional[int] = None
    meal_packaging: str = ""
    fnb_status: str = "not_required"
    fnb_reviewed_at: Optional[str] = None
    fnb_reviewed_by: Optional[str] = None
    notes: str
    status: str
    created_at: str
    checked_in_at: Optional[str] = None
    checked_out_at: Optional[str] = None


# ---------- Util ----------
def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _app_now_naive() -> datetime:
    return datetime.now(APP_TIMEZONE).replace(tzinfo=None)


def _app_today():
    return datetime.now(APP_TIMEZONE).date()


def _overlap(a_start: str, a_end: str, b_start: str, b_end: str) -> bool:
    return a_start < b_end and b_start < a_end


def _normalize_room(room: dict) -> dict:
    room["building"] = _normalize_building(room.get("building"))
    room.setdefault("operating_start_time", DEFAULT_OPERATING_START_TIME)
    room.setdefault("operating_end_time", DEFAULT_OPERATING_END_TIME)
    room.setdefault("layout_fixed", True)
    return room


def _normalize_building(building: Optional[str]) -> str:
    value = (building or "").strip()
    return value or DEFAULT_ROOM_BUILDING


def _normalize_building_list(buildings: Optional[List[str]]) -> List[str]:
    normalized = []
    seen = set()
    for building in buildings or []:
        value = _normalize_building(building)
        key = value.lower()
        if key not in seen:
            normalized.append(value)
            seen.add(key)
    return normalized


def _can_manage_meeting_building(admin: dict, building: str) -> bool:
    if admin.get("role") == "super_admin":
        return True
    if admin.get("role") != "meeting_admin":
        return False
    return _normalize_building(building) in set(admin.get("meeting_buildings") or [])


def _can_manage_fnb_location(manager: dict, building: str) -> bool:
    if manager.get("role") == "super_admin":
        return True
    if manager.get("role") != "manager":
        return False
    return _normalize_building(building) in set(manager.get("fnb_locations") or [])


def _assert_can_manage_room(admin: dict, room: dict) -> None:
    room = _normalize_room(room)
    if not _can_manage_meeting_building(admin, room["building"]):
        raise HTTPException(status_code=403, detail=f"You are not assigned to approve/manage building: {room['building']}")


def _assert_can_manage_fnb(manager: dict, room: dict) -> None:
    room = _normalize_room(room)
    if not _can_manage_fnb_location(manager, room["building"]):
        raise HTTPException(status_code=403, detail=f"You are not assigned to approve F&B for location: {room['building']}")


def _building_room_query(buildings: List[str]) -> dict:
    buildings = _normalize_building_list(buildings)
    query: dict = {"building": {"$in": buildings}}
    if DEFAULT_ROOM_BUILDING in buildings:
        query = {
            "$or": [
                {"building": {"$in": buildings}},
                {"building": {"$exists": False}},
                {"building": ""},
                {"building": None},
            ]
        }
    return query


async def _allowed_meeting_room_ids(admin: dict, building: Optional[str] = None) -> Optional[List[str]]:
    if admin.get("role") == "super_admin":
        query = _building_room_query([building]) if building else {}
        rooms = await db.rooms.find(query, {"_id": 0, "id": 1}).to_list(1000)
        return [r["id"] for r in rooms] if building else None

    buildings = _normalize_building_list(admin.get("meeting_buildings") or [])
    if building:
        requested = _normalize_building(building)
        if requested not in buildings:
            return []
        buildings = [requested]
    if not buildings:
        return []
    rooms = await db.rooms.find(_building_room_query(buildings), {"_id": 0, "id": 1}).to_list(1000)
    return [r["id"] for r in rooms]


async def _allowed_fnb_room_ids(manager: dict, building: Optional[str] = None) -> Optional[List[str]]:
    if manager.get("role") == "super_admin":
        query = _building_room_query([building]) if building else {}
        rooms = await db.rooms.find(query, {"_id": 0, "id": 1}).to_list(1000)
        return [r["id"] for r in rooms] if building else None

    locations = _normalize_building_list(manager.get("fnb_locations") or [])
    if building:
        requested = _normalize_building(building)
        if requested not in locations:
            return []
        locations = [requested]
    if not locations:
        return []
    rooms = await db.rooms.find(_building_room_query(locations), {"_id": 0, "id": 1}).to_list(1000)
    return [r["id"] for r in rooms]


def _validate_time_range(start_time: str, end_time: str) -> None:
    try:
        datetime.fromisoformat(f"2000-01-01T{start_time}")
        datetime.fromisoformat(f"2000-01-01T{end_time}")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid time format")
    if start_time >= end_time:
        raise HTTPException(status_code=400, detail="End time must be after start time")


def _time_to_minutes(time_value: str) -> int:
    hours, minutes = time_value.split(":")
    return int(hours) * 60 + int(minutes)


def _validate_food_beverages_request(food_beverages: str, start_time: str, end_time: str) -> None:
    if not food_beverages:
        return
    duration = _time_to_minutes(end_time) - _time_to_minutes(start_time)
    food_lower = food_beverages.lower()
    if duration < 4 * 60:
        raise HTTPException(status_code=400, detail="F&B request is available only for meetings of 4 hours or more")
    if "makan" in food_lower and duration < 5 * 60:
        raise HTTPException(status_code=400, detail="Meal request is available only for meetings of 5 hours or more")


def _operating_hours_error(room: dict, start_time: str, end_time: str) -> Optional[str]:
    room = _normalize_room(room)
    if start_time < room["operating_start_time"] or end_time > room["operating_end_time"]:
        return (
            "Booking must be within room operating hours "
            f"({room['operating_start_time']}-{room['operating_end_time']})."
        )
    return None


def _validate_booking_layout(room: dict, layout_type: str, layout_other: str) -> tuple[str, str]:
    room = _normalize_room(room)
    layout_type = (layout_type or "").strip()
    layout_other = (layout_other or "").strip()
    if room.get("layout_fixed", True):
        return "", ""
    if layout_type not in LAYOUT_OPTIONS:
        raise HTTPException(status_code=400, detail="Please select a valid room layout")
    if layout_type == "Lainnya" and not layout_other:
        raise HTTPException(status_code=400, detail="Please describe the custom room layout")
    if layout_type != "Lainnya":
        layout_other = ""
    return layout_type, layout_other


async def _check_overlap(room_id: str, date: str, start: str, end: str, exclude_id: Optional[str] = None) -> bool:
    return bool(await _find_overlaps(room_id, date, start, end, exclude_id=exclude_id))


async def _find_overlaps(room_id: str, date: str, start: str, end: str, exclude_id: Optional[str] = None) -> List[dict]:
    cursor = db.bookings.find(
        {
            "room_id": room_id,
            "date": date,
            "status": {"$in": MEETING_BLOCKING_STATUSES},
        },
        {"_id": 0},
    )
    conflicts = []
    async for bk in cursor:
        if exclude_id and bk["id"] == exclude_id:
            continue
        if _overlap(start, end, bk["start_time"], bk["end_time"]):
            conflicts.append(bk)
    return conflicts


# ---------- Auth Endpoints ----------
def _normalize_user_public(user: dict) -> dict:
    user.setdefault("company_name", "")
    user.setdefault("job_title", "")
    user.setdefault("department", "")
    user.setdefault("office_address", "")
    user["meeting_buildings"] = _normalize_building_list(user.get("meeting_buildings") or [])
    user["fnb_locations"] = _normalize_building_list(user.get("fnb_locations") or [])
    user.setdefault("is_approved", True)
    user.setdefault("approved_at", None)
    user.setdefault("approved_by", None)
    return user


async def _normalize_booking_public(booking: dict) -> dict:
    if not booking.get("room_building"):
        room = await db.rooms.find_one({"id": booking.get("room_id")}, {"_id": 0, "building": 1})
        booking["room_building"] = _normalize_building(room.get("building") if room else None)
    booking.setdefault("phone_number", "")
    booking.setdefault("additional_facilities", [])
    booking.setdefault("food_beverages", "")
    booking.setdefault("fnb_department", "")
    booking.setdefault("fnb_division", "")
    booking.setdefault("fnb_cost_center", "")
    booking.setdefault("fnb_activity_code", "")
    booking.setdefault("fnb_activity_name", "")
    booking.setdefault("guest_type", "")
    booking.setdefault("snack_type", "")
    booking.setdefault("snack_times", None)
    booking.setdefault("snack_pax", None)
    booking.setdefault("snack_packaging", "")
    booking.setdefault("meal_types", [])
    booking.setdefault("meal_pax", None)
    booking.setdefault("meal_packaging", "")
    booking["fnb_status"] = booking.get("fnb_status") or ("pending" if booking.get("food_beverages") else "not_required")
    booking.setdefault("fnb_reviewed_at", None)
    booking.setdefault("fnb_reviewed_by", None)
    booking.setdefault("layout_type", "")
    booking.setdefault("layout_other", "")
    return booking


async def _normalize_bookings_public(bookings: List[dict]) -> List[dict]:
    room_ids = list({b.get("room_id") for b in bookings if b.get("room_id") and not b.get("room_building")})
    rooms = await db.rooms.find({"id": {"$in": room_ids}}, {"_id": 0, "id": 1, "building": 1}).to_list(1000) if room_ids else []
    room_buildings = {r["id"]: _normalize_building(r.get("building")) for r in rooms}
    for booking in bookings:
        booking["room_building"] = _normalize_building(
            booking.get("room_building") or room_buildings.get(booking.get("room_id"))
        )
        booking.setdefault("phone_number", "")
        booking.setdefault("additional_facilities", [])
        booking.setdefault("food_beverages", "")
        booking.setdefault("fnb_department", "")
        booking.setdefault("fnb_division", "")
        booking.setdefault("fnb_cost_center", "")
        booking.setdefault("fnb_activity_code", "")
        booking.setdefault("fnb_activity_name", "")
        booking.setdefault("guest_type", "")
        booking.setdefault("snack_type", "")
        booking.setdefault("snack_times", None)
        booking.setdefault("snack_pax", None)
        booking.setdefault("snack_packaging", "")
        booking.setdefault("meal_types", [])
        booking.setdefault("meal_pax", None)
        booking.setdefault("meal_packaging", "")
        booking["fnb_status"] = booking.get("fnb_status") or ("pending" if booking.get("food_beverages") else "not_required")
        booking.setdefault("fnb_reviewed_at", None)
        booking.setdefault("fnb_reviewed_by", None)
        booking.setdefault("layout_type", "")
        booking.setdefault("layout_other", "")
    return bookings


def _hash_reset_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _reset_url(token: str) -> str:
    return f"{APP_PUBLIC_URL}/reset-password?token={token}"


def _send_password_reset_email(email: str, reset_url: str) -> bool:
    if not SMTP_HOST:
        return False

    message = EmailMessage()
    message["Subject"] = "KCSI Booking System Password Reset"
    message["From"] = SMTP_FROM
    message["To"] = email
    message.set_content(
        "\n".join(
            [
                "We received a request to reset your KCSI Booking System password.",
                "",
                "Open this link to set a new password:",
                reset_url,
                "",
                f"This link expires in {PASSWORD_RESET_MINUTES} minutes.",
                "If you did not request this, you can ignore this email.",
            ]
        )
    )

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as smtp:
            if SMTP_USE_TLS:
                smtp.starttls()
            if SMTP_USERNAME:
                smtp.login(SMTP_USERNAME, SMTP_PASSWORD)
            smtp.send_message(message)
        return True
    except Exception:
        logger.exception("Failed to send password reset email")
        return False


@api.post("/auth/register", response_model=RegisterResponse)
async def register(payload: RegisterRequest):
    email = payload.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = str(uuid.uuid4())
    doc = {
        "id": user_id,
        "email": email,
        "name": payload.name.strip(),
        "company_name": payload.company_name.strip(),
        "job_title": payload.job_title.strip(),
        "department": payload.department.strip(),
        "office_address": payload.office_address.strip(),
        "meeting_buildings": [],
        "fnb_locations": [],
        "password_hash": hash_password(payload.password),
        "role": "user",
        "is_approved": False,
        "approved_at": None,
        "approved_by": None,
        "created_at": _now_iso(),
    }
    await db.users.insert_one(doc)
    return RegisterResponse(message="Account created. Please wait for admin approval before signing in.")


@api.post("/auth/login", response_model=AuthResponse)
async def login(payload: LoginRequest):
    email = payload.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.get("is_approved", True):
        raise HTTPException(status_code=403, detail="Your account is waiting for admin approval")
    token = create_access_token(user["id"], user["email"], user["role"])
    _normalize_user_public(user)
    public = {k: v for k, v in user.items() if k not in ("password_hash", "_id")}
    return AuthResponse(user=UserPublic(**public), access_token=token)


@api.post("/auth/forgot-password", response_model=ForgotPasswordResponse)
async def forgot_password(payload: ForgotPasswordRequest):
    email = payload.email.lower()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    message = "If the email is registered, password reset instructions will be sent."
    reset_url = None

    if user:
        token = secrets.token_urlsafe(48)
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=PASSWORD_RESET_MINUTES)
        doc = {
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "email": email,
            "token_hash": _hash_reset_token(token),
            "created_at": _now_iso(),
            "expires_at": expires_at,
            "used_at": None,
        }
        await db.password_resets.insert_one(doc)
        reset_url = _reset_url(token)
        email_sent = _send_password_reset_email(email, reset_url)
        if not email_sent and not PASSWORD_RESET_DEV_MODE:
            logger.warning("Password reset requested but SMTP is not configured or failed")

    return ForgotPasswordResponse(
        message=message,
        reset_url=reset_url if PASSWORD_RESET_DEV_MODE and user else None,
    )


@api.post("/auth/reset-password")
async def reset_password(payload: ResetPasswordRequest):
    token_hash = _hash_reset_token(payload.token)
    reset_doc = await db.password_resets.find_one({"token_hash": token_hash, "used_at": None}, {"_id": 0})
    if not reset_doc:
        raise HTTPException(status_code=400, detail="Reset link is invalid or has expired")

    expires_at = reset_doc["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Reset link is invalid or has expired")

    result = await db.users.update_one(
        {"id": reset_doc["user_id"]},
        {"$set": {"password_hash": hash_password(payload.password)}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=400, detail="Reset link is invalid or has expired")

    await db.password_resets.update_one(
        {"token_hash": token_hash},
        {"$set": {"used_at": _now_iso()}},
    )
    return {"ok": True, "message": "Password updated successfully. You can sign in now."}


@api.post("/auth/logout")
async def logout():
    return {"ok": True}


@api.get("/auth/me", response_model=UserPublic)
async def me(current_user: dict = Depends(get_current_user)):
    return UserPublic(**current_user)


# Admin: promote a user (super admin only)
class PromoteRequest(BaseModel):
    email: EmailStr
    role: Literal["user", "meeting_admin", "car_admin", "manager", "super_admin"] = "meeting_admin"


@api.post("/auth/promote", response_model=UserPublic)
async def promote_user(payload: PromoteRequest, admin: dict = Depends(require_super_admin)):
    target = await db.users.find_one({"email": payload.email.lower()})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    updates = {"role": payload.role}
    if payload.role != "meeting_admin":
        updates["meeting_buildings"] = []
    if payload.role != "manager":
        updates["fnb_locations"] = []
    await db.users.update_one({"id": target["id"]}, {"$set": updates})
    target["role"] = payload.role
    target.update(updates)
    _normalize_user_public(target)
    return UserPublic(**{k: v for k, v in target.items() if k not in ("password_hash", "_id")})


# ---------- Rooms ----------
@api.get("/rooms", response_model=List[Room])
async def list_rooms(active_only: bool = False):
    query = {"is_active": True} if active_only else {}
    rooms = await db.rooms.find(query, {"_id": 0}).sort([("building", 1), ("name", 1)]).to_list(500)
    return [Room(**_normalize_room(r)) for r in rooms]


@api.get("/rooms/{room_id}", response_model=Room)
async def get_room(room_id: str):
    room = await db.rooms.find_one({"id": room_id}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return Room(**_normalize_room(room))


@api.post("/rooms", response_model=Room)
async def create_room(payload: RoomCreate, admin: dict = Depends(require_admin)):
    _validate_time_range(payload.operating_start_time, payload.operating_end_time)
    building = _normalize_building(payload.building)
    if not _can_manage_meeting_building(admin, building):
        raise HTTPException(status_code=403, detail=f"You are not assigned to create rooms for building: {building}")
    room_id = str(uuid.uuid4())
    doc = {"id": room_id, **payload.model_dump(), "building": building, "created_at": _now_iso()}
    await db.rooms.insert_one(doc)
    return Room(**{k: v for k, v in doc.items() if k != "_id"})


@api.put("/rooms/{room_id}", response_model=Room)
async def update_room(room_id: str, payload: RoomUpdate, admin: dict = Depends(require_admin)):
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items()}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    existing = await db.rooms.find_one({"id": room_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Room not found")
    _assert_can_manage_room(admin, existing)
    next_room = {**_normalize_room(existing), **updates}
    next_room["building"] = _normalize_building(next_room.get("building"))
    if not _can_manage_meeting_building(admin, next_room["building"]):
        raise HTTPException(status_code=403, detail=f"You are not assigned to move rooms to building: {next_room['building']}")
    _validate_time_range(next_room["operating_start_time"], next_room["operating_end_time"])
    if "building" in updates:
        updates["building"] = next_room["building"]
    result = await db.rooms.update_one({"id": room_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Room not found")
    room = await db.rooms.find_one({"id": room_id}, {"_id": 0})
    return Room(**_normalize_room(room))


@api.delete("/rooms/{room_id}")
async def delete_room(room_id: str, admin: dict = Depends(require_admin)):
    room = await db.rooms.find_one({"id": room_id}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    _assert_can_manage_room(admin, room)
    await db.rooms.delete_one({"id": room_id})
    return {"ok": True}


@api.get("/rooms/{room_id}/availability")
async def room_availability(
    room_id: str,
    start_date: str = Query(...),
    end_date: str = Query(...),
):
    room = await db.rooms.find_one({"id": room_id}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    _normalize_room(room)
    bookings = await db.bookings.find(
        {
            "room_id": room_id,
            "date": {"$gte": start_date, "$lte": end_date},
            "status": {"$in": MEETING_BLOCKING_STATUSES},
        },
        {"_id": 0},
    ).to_list(500)
    return {"room_id": room_id, "bookings": bookings}


@api.get("/rooms/{room_id}/availability/check")
async def room_availability_check(
    room_id: str,
    date: str = Query(...),
    start_time: str = Query(...),
    end_time: str = Query(...),
):
    room = await db.rooms.find_one({"id": room_id}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    _normalize_room(room)
    if not room.get("is_active"):
        return {"room_id": room_id, "available": False, "reason": "Room is not active", "conflicts": []}
    _validate_time_range(start_time, end_time)
    try:
        booking_dt = datetime.fromisoformat(f"{date}T{start_time}")
        datetime.fromisoformat(f"{date}T{end_time}")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid date/time format")
    if booking_dt < _app_now_naive().replace(second=0, microsecond=0):
        return {"room_id": room_id, "available": False, "reason": "Cannot book a time in the past", "conflicts": []}
    hours_error = _operating_hours_error(room, start_time, end_time)
    if hours_error:
        return {"room_id": room_id, "available": False, "reason": hours_error, "conflicts": []}

    conflicts = await _find_overlaps(room_id, date, start_time, end_time)
    safe_conflicts = [
        {
            "id": b["id"],
            "title": b.get("title", ""),
            "date": b["date"],
            "start_time": b["start_time"],
            "end_time": b["end_time"],
            "status": b["status"],
            "user_name": b.get("user_name", ""),
        }
        for b in conflicts
    ]
    return {
        "room_id": room_id,
        "date": date,
        "start_time": start_time,
        "end_time": end_time,
        "operating_start_time": room["operating_start_time"],
        "operating_end_time": room["operating_end_time"],
        "available": len(safe_conflicts) == 0,
        "reason": None if len(safe_conflicts) == 0 else "Room is already booked for this time slot",
        "conflicts": safe_conflicts,
    }


# ---------- Bookings ----------
@api.post("/bookings", response_model=Booking)
async def create_booking(payload: BookingCreate, user: dict = Depends(get_current_user)):
    # Validate room
    room = await db.rooms.find_one({"id": payload.room_id}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    _normalize_room(room)
    if not room.get("is_active"):
        raise HTTPException(status_code=400, detail="Room is not active")
    # Validate times
    _validate_time_range(payload.start_time, payload.end_time)
    hours_error = _operating_hours_error(room, payload.start_time, payload.end_time)
    if hours_error:
        raise HTTPException(status_code=400, detail=hours_error)
    # Validate date/time not in past
    try:
        booking_dt = datetime.fromisoformat(f"{payload.date}T{payload.start_time}")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid date/time format")
    if booking_dt < _app_now_naive().replace(second=0, microsecond=0):
        raise HTTPException(status_code=400, detail="Cannot book a time in the past")
    if payload.participants > room["capacity"]:
        raise HTTPException(status_code=400, detail=f"Participants exceed room capacity ({room['capacity']})")
    layout_type, layout_other = _validate_booking_layout(room, payload.layout_type, payload.layout_other)
    # Check overlap
    conflicts = await _find_overlaps(payload.room_id, payload.date, payload.start_time, payload.end_time)
    if conflicts:
        conflict = conflicts[0]
        raise HTTPException(
            status_code=409,
            detail=(
                "Room is already booked for this time slot. "
                f"Existing booking: {conflict['start_time']}-{conflict['end_time']}."
            ),
        )

    food_beverages = payload.food_beverages.strip()
    additional_facilities = [item.strip() for item in payload.additional_facilities if item.strip()]
    invalid_facilities = [item for item in additional_facilities if item not in ("LCD", "Pointer", "Laptop", "Zoom")]
    if invalid_facilities:
        raise HTTPException(status_code=400, detail="Invalid additional facility request")
    _validate_food_beverages_request(food_beverages, payload.start_time, payload.end_time)
    if food_beverages:
        if not payload.fnb_department.strip():
            raise HTTPException(status_code=400, detail="Department is required when requesting F&B")
        if not payload.fnb_division.strip():
            raise HTTPException(status_code=400, detail="Division is required when requesting F&B")
        if not payload.fnb_cost_center.strip():
            raise HTTPException(status_code=400, detail="Cost center is required when requesting F&B")
        if not payload.fnb_activity_code.strip():
            raise HTTPException(status_code=400, detail="Activity code is required when requesting F&B")
        if not payload.fnb_activity_name.strip():
            raise HTTPException(status_code=400, detail="Activity name is required when requesting F&B")
        guest_types = [item.strip() for item in payload.guest_type.split(",") if item.strip()]
        invalid_guest_types = [item for item in guest_types if item not in ("Internal", "BOD", "Xternal", "Tamu")]
        if not guest_types or invalid_guest_types:
            raise HTTPException(status_code=400, detail="Guest type is required when requesting F&B")
    if "snack" in food_beverages.lower():
        if not payload.snack_type.strip():
            raise HTTPException(status_code=400, detail="Snack type is required when requesting snack")
        if payload.snack_times is None or payload.snack_times < 1:
            raise HTTPException(status_code=400, detail="Snack frequency must be at least 1")
        if payload.snack_pax is None or payload.snack_pax < 1:
            raise HTTPException(status_code=400, detail="Snack pax must be at least 1")
        if payload.snack_packaging not in ("Plating", "Dus"):
            raise HTTPException(status_code=400, detail="Snack packaging must be Plating or Dus")
    meal_types = []
    for item in payload.meal_types:
        meal_type = item.strip()
        if meal_type.lower() == "makan siang":
            meal_type = "Makan siang"
        elif meal_type.lower() == "makan malam":
            meal_type = "Makan malam"
        if meal_type and meal_type not in meal_types:
            meal_types.append(meal_type)
    food_lower = food_beverages.lower()
    if "makan siang" in food_lower and "Makan siang" not in meal_types:
        meal_types.append("Makan siang")
    if "makan malam" in food_lower and "Makan malam" not in meal_types:
        meal_types.append("Makan malam")
    invalid_meal_types = [item for item in meal_types if item not in ("Makan siang", "Makan malam", "Makan Siang", "Makan Malam")]
    if invalid_meal_types:
        raise HTTPException(status_code=400, detail="Invalid meal type request")
    if "makan" in food_beverages.lower():
        if not meal_types:
            raise HTTPException(status_code=400, detail="Please select at least one meal type")
        if payload.meal_pax is None or payload.meal_pax < 1:
            raise HTTPException(status_code=400, detail="Meal pax must be at least 1")
        if payload.meal_packaging not in ("Prasmanan", "Dus"):
            raise HTTPException(status_code=400, detail="Meal packaging must be Prasmanan or Dus")
    booking_id = str(uuid.uuid4())
    doc = {
        "id": booking_id,
        "room_id": payload.room_id,
        "room_name": room["name"],
        "room_building": room["building"],
        "user_id": user["id"],
        "user_name": user["name"],
        "user_email": user["email"],
        "title": payload.title,
        "date": payload.date,
        "start_time": payload.start_time,
        "end_time": payload.end_time,
        "participants": payload.participants,
        "layout_type": layout_type,
        "layout_other": layout_other,
        "phone_number": payload.phone_number.strip(),
        "additional_facilities": additional_facilities,
        "food_beverages": food_beverages,
        "fnb_department": payload.fnb_department.strip(),
        "fnb_division": payload.fnb_division.strip(),
        "fnb_cost_center": payload.fnb_cost_center.strip(),
        "fnb_activity_code": payload.fnb_activity_code.strip(),
        "fnb_activity_name": payload.fnb_activity_name.strip(),
        "guest_type": payload.guest_type.strip(),
        "snack_type": payload.snack_type.strip(),
        "snack_times": payload.snack_times,
        "snack_pax": payload.snack_pax,
        "snack_packaging": payload.snack_packaging.strip(),
        "meal_types": meal_types,
        "meal_pax": payload.meal_pax,
        "meal_packaging": payload.meal_packaging.strip(),
        "fnb_status": "pending" if food_beverages else "not_required",
        "fnb_reviewed_at": None,
        "fnb_reviewed_by": None,
        "notes": payload.notes or "",
        "status": "pending",
        "created_at": _now_iso(),
    }
    await db.bookings.insert_one(doc)
    return Booking(**{k: v for k, v in doc.items() if k != "_id"})


@api.get("/bookings/mine", response_model=List[Booking])
async def my_bookings(user: dict = Depends(get_current_user)):
    items = await db.bookings.find({"user_id": user["id"]}, {"_id": 0}).sort([("date", -1), ("start_time", -1)]).to_list(500)
    await _normalize_bookings_public(items)
    return [Booking(**b) for b in items]


@api.get("/bookings", response_model=List[Booking])
async def all_bookings(
    admin: dict = Depends(require_admin),
    status: Optional[str] = None,
    room_id: Optional[str] = None,
    building: Optional[str] = None,
    user_query: Optional[str] = None,
    date: Optional[str] = None,
):
    q: dict = {}
    if status:
        q["status"] = status
    if room_id:
        q["room_id"] = room_id
    allowed_room_ids = await _allowed_meeting_room_ids(admin, building=building)
    if allowed_room_ids is not None:
        if room_id:
            if room_id not in allowed_room_ids:
                q["room_id"] = {"$in": []}
        else:
            q["room_id"] = {"$in": allowed_room_ids}
    if date:
        q["date"] = date
    if user_query:
        q["$or"] = [
            {"user_name": {"$regex": user_query, "$options": "i"}},
            {"user_email": {"$regex": user_query, "$options": "i"}},
        ]
    items = await db.bookings.find(q, {"_id": 0}).sort([("date", -1), ("start_time", -1)]).to_list(1000)
    await _normalize_bookings_public(items)
    return [Booking(**b) for b in items]


@api.patch("/bookings/{booking_id}/status", response_model=Booking)
async def update_booking_status(
    booking_id: str,
    payload: BookingStatusUpdate,
    admin: dict = Depends(require_admin),
):
    bk = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not bk:
        raise HTTPException(status_code=404, detail="Booking not found")
    room = await db.rooms.find_one({"id": bk["room_id"]}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    _assert_can_manage_room(admin, room)
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {"status": payload.status, "room_building": _normalize_room(room)["building"]}},
    )
    bk = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    await _normalize_booking_public(bk)
    return Booking(**bk)


@api.get("/fnb/bookings", response_model=List[Booking])
async def list_fnb_bookings(
    manager: dict = Depends(require_fnb_manager),
    fnb_status: Optional[Literal["pending", "approved", "rejected", "not_required"]] = None,
    booking_status: Optional[Literal["pending", "confirmed", "cancelled", "completed"]] = None,
    building: Optional[str] = None,
    date: Optional[str] = None,
    user_query: Optional[str] = None,
):
    q: dict = {}
    and_conditions = []
    if booking_status:
        q["status"] = booking_status
    if fnb_status == "pending":
        and_conditions.append(
            {
                "$and": [
                    {"food_beverages": {"$exists": True, "$nin": ["", None]}},
                    {
                        "$or": [
                            {"fnb_status": "pending"},
                            {"fnb_status": {"$exists": False}},
                            {"fnb_status": ""},
                            {"fnb_status": None},
                        ]
                    },
                ],
            }
        )
    elif fnb_status == "not_required":
        and_conditions.append(
            {
                "$and": [
                    {"$or": [{"food_beverages": {"$exists": False}}, {"food_beverages": ""}, {"food_beverages": None}]},
                    {"$or": [{"fnb_status": "not_required"}, {"fnb_status": {"$exists": False}}]},
                ]
            }
        )
    elif fnb_status:
        q["fnb_status"] = fnb_status
    allowed_room_ids = await _allowed_fnb_room_ids(manager, building=building)
    if allowed_room_ids is not None:
        q["room_id"] = {"$in": allowed_room_ids}
    if date:
        q["date"] = date
    if user_query:
        and_conditions.append(
            {
                "$or": [
                    {"user_name": {"$regex": user_query, "$options": "i"}},
                    {"user_email": {"$regex": user_query, "$options": "i"}},
                    {"title": {"$regex": user_query, "$options": "i"}},
                    {"room_name": {"$regex": user_query, "$options": "i"}},
                    {"food_beverages": {"$regex": user_query, "$options": "i"}},
                ]
            }
        )
    if and_conditions:
        q["$and"] = and_conditions
    items = await db.bookings.find(q, {"_id": 0}).sort([("date", -1), ("start_time", -1)]).to_list(1000)
    await _normalize_bookings_public(items)
    return [Booking(**b) for b in items]


@api.patch("/fnb/bookings/{booking_id}/status", response_model=Booking)
async def update_fnb_status(
    booking_id: str,
    payload: FnbStatusUpdate,
    manager: dict = Depends(require_fnb_manager),
):
    bk = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not bk:
        raise HTTPException(status_code=404, detail="Booking not found")
    if not (bk.get("food_beverages") or "").strip():
        raise HTTPException(status_code=400, detail="This booking has no F&B request")
    if bk.get("status") != "confirmed":
        raise HTTPException(status_code=400, detail="F&B can be approved only after meeting-room admin approval")
    if payload.status == "approved":
        _validate_food_beverages_request(bk.get("food_beverages") or "", bk["start_time"], bk["end_time"])
    room = await db.rooms.find_one({"id": bk["room_id"]}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    _assert_can_manage_fnb(manager, room)
    await db.bookings.update_one(
        {"id": booking_id},
        {
            "$set": {
                "fnb_status": payload.status,
                "fnb_reviewed_at": _now_iso(),
                "fnb_reviewed_by": manager["id"],
                "room_building": _normalize_room(room)["building"],
            }
        },
    )
    bk = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    await _normalize_booking_public(bk)
    return Booking(**bk)


@api.patch("/fnb/bookings/{booking_id}/meeting-status", response_model=Booking)
async def update_manager_meeting_status(
    booking_id: str,
    payload: BookingStatusUpdate,
    manager: dict = Depends(require_fnb_manager),
):
    if payload.status not in ("confirmed", "cancelled"):
        raise HTTPException(status_code=400, detail="Manager can only approve or reject meeting-room bookings")
    bk = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not bk:
        raise HTTPException(status_code=404, detail="Booking not found")
    if bk.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Only pending meeting-room bookings can be approved or rejected")
    room = await db.rooms.find_one({"id": bk["room_id"]}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    _assert_can_manage_fnb(manager, room)
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {"status": payload.status, "room_building": _normalize_room(room)["building"]}},
    )
    bk = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    await _normalize_booking_public(bk)
    return Booking(**bk)


@api.post("/bookings/{booking_id}/cancel", response_model=Booking)
async def cancel_booking(booking_id: str, user: dict = Depends(get_current_user)):
    bk = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not bk:
        raise HTTPException(status_code=404, detail="Booking not found")
    if user["role"] not in ADMIN_ROLES and bk["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to cancel this booking")
    if user["role"] == "meeting_admin" and bk["user_id"] != user["id"]:
        room = await db.rooms.find_one({"id": bk["room_id"]}, {"_id": 0})
        if not room:
            raise HTTPException(status_code=404, detail="Room not found")
        _assert_can_manage_room(user, room)
    if bk["status"] in ("cancelled", "completed"):
        raise HTTPException(status_code=400, detail=f"Cannot cancel a {bk['status']} booking")
    if user["role"] == "user":
        if bk.get("checked_in_at") and not bk.get("checked_out_at"):
            raise HTTPException(status_code=400, detail="You must check out to release this room after check-in")
        if (bk.get("food_beverages") or "").strip():
            try:
                meeting_date = datetime.fromisoformat(f"{bk['date']}T00:00:00").date()
            except Exception:
                raise HTTPException(status_code=400, detail="Invalid booking date")
            if (meeting_date - _app_today()).days < 1:
                raise HTTPException(status_code=400, detail="F&B bookings can be cancelled only at least 1 day before the meeting date")
    await db.bookings.update_one({"id": booking_id}, {"$set": {"status": "cancelled"}})
    bk["status"] = "cancelled"
    return Booking(**bk)


# ---------- Check-in / Check-out (user) ----------
def _booking_window(bk: dict) -> tuple[datetime, datetime]:
    start = datetime.fromisoformat(f"{bk['date']}T{bk['start_time']}")
    end = datetime.fromisoformat(f"{bk['date']}T{bk['end_time']}")
    return start, end


@api.post("/bookings/{booking_id}/check-in", response_model=Booking)
async def check_in_booking(booking_id: str, user: dict = Depends(get_current_user)):
    bk = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not bk:
        raise HTTPException(status_code=404, detail="Booking not found")
    if bk["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="You can only check in to your own booking")
    if bk["status"] != "confirmed":
        raise HTTPException(
            status_code=400,
            detail=f"Only confirmed bookings can be checked in (current status: {bk['status']})",
        )
    if bk.get("checked_in_at"):
        raise HTTPException(status_code=400, detail="You have already checked in to this booking")
    start, end = _booking_window(bk)
    now = _app_now_naive()
    if now < start:
        raise HTTPException(
            status_code=400,
            detail=f"Too early to check in. Check-in opens at {bk['date']} {bk['start_time']}.",
        )
    if now > end:
        raise HTTPException(
            status_code=400,
            detail=f"Too late to check in. This booking ended at {bk['date']} {bk['end_time']}.",
        )
    ts = datetime.now(timezone.utc).isoformat()
    await db.bookings.update_one({"id": booking_id}, {"$set": {"checked_in_at": ts}})
    bk["checked_in_at"] = ts
    return Booking(**bk)


@api.post("/bookings/{booking_id}/check-out", response_model=Booking)
async def check_out_booking(booking_id: str, user: dict = Depends(get_current_user)):
    bk = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not bk:
        raise HTTPException(status_code=404, detail="Booking not found")
    if bk["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="You can only check out of your own booking")
    if not bk.get("checked_in_at"):
        raise HTTPException(status_code=400, detail="You must check in before you can check out")
    if bk.get("checked_out_at"):
        raise HTTPException(status_code=400, detail="You have already checked out of this booking")
    start, _end = _booking_window(bk)
    now = _app_now_naive()
    if now < start:
        raise HTTPException(status_code=400, detail="Cannot check out before the booking has started")
    ts = datetime.now(timezone.utc).isoformat()
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {"checked_out_at": ts, "status": "completed"}},
    )
    bk["checked_out_at"] = ts
    bk["status"] = "completed"
    return Booking(**bk)


# ---------- Admin: Users management (super admin only) ----------
class AdminUserUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1)
    company_name: Optional[str] = Field(default=None, max_length=120)
    job_title: Optional[str] = Field(default=None, max_length=120)
    department: Optional[str] = Field(default=None, max_length=120)
    office_address: Optional[str] = Field(default=None, max_length=240)
    meeting_buildings: Optional[List[str]] = None
    fnb_locations: Optional[List[str]] = None
    role: Optional[Literal["user", "meeting_admin", "car_admin", "manager", "super_admin"]] = None
    is_approved: Optional[bool] = None


class AdminPasswordReset(BaseModel):
    password: str = Field(min_length=6)


class AdminUserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1)
    company_name: str = ""
    job_title: str = ""
    department: str = ""
    office_address: str = ""
    meeting_buildings: List[str] = []
    fnb_locations: List[str] = []
    role: Literal["user", "meeting_admin", "car_admin", "manager", "super_admin"] = "user"
    is_approved: bool = True


@api.get("/users", response_model=List[UserPublic])
async def list_users(
    admin: dict = Depends(require_super_admin),
    q: Optional[str] = None,
    role: Optional[Literal["user", "meeting_admin", "car_admin", "manager", "super_admin"]] = None,
    approval: Optional[Literal["approved", "pending"]] = None,
):
    query: dict = {}
    if role:
        query["role"] = role
    if approval == "approved":
        query["is_approved"] = True
    elif approval == "pending":
        query["is_approved"] = False
    if q:
        query["$or"] = [
            {"email": {"$regex": q, "$options": "i"}},
            {"name": {"$regex": q, "$options": "i"}},
            {"company_name": {"$regex": q, "$options": "i"}},
            {"job_title": {"$regex": q, "$options": "i"}},
            {"department": {"$regex": q, "$options": "i"}},
            {"office_address": {"$regex": q, "$options": "i"}},
            {"meeting_buildings": {"$regex": q, "$options": "i"}},
            {"fnb_locations": {"$regex": q, "$options": "i"}},
        ]
    users = await db.users.find(query, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(1000)
    for u in users:
        _normalize_user_public(u)
    return [UserPublic(**u) for u in users]


@api.post("/users", response_model=UserPublic)
async def admin_create_user(payload: AdminUserCreate, admin: dict = Depends(require_super_admin)):
    email = payload.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    meeting_buildings = _normalize_building_list(payload.meeting_buildings) if payload.role == "meeting_admin" else []
    fnb_locations = _normalize_building_list(payload.fnb_locations) if payload.role == "manager" else []
    doc = {
        "id": str(uuid.uuid4()),
        "email": email,
        "name": payload.name.strip(),
        "company_name": payload.company_name.strip(),
        "job_title": payload.job_title.strip(),
        "department": payload.department.strip(),
        "office_address": payload.office_address.strip(),
        "meeting_buildings": meeting_buildings,
        "fnb_locations": fnb_locations,
        "password_hash": hash_password(payload.password),
        "role": payload.role,
        "is_approved": payload.is_approved,
        "approved_at": _now_iso() if payload.is_approved else None,
        "approved_by": admin["id"] if payload.is_approved else None,
        "created_at": _now_iso(),
    }
    await db.users.insert_one(doc)
    doc.pop("password_hash", None)
    return UserPublic(**doc)


@api.patch("/users/{user_id}", response_model=UserPublic)
async def admin_update_user(
    user_id: str, payload: AdminUserUpdate, admin: dict = Depends(require_super_admin)
):
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    # Prevent self-demotion away from super_admin
    if user_id == admin["id"] and "role" in updates and updates["role"] != "super_admin":
        raise HTTPException(status_code=400, detail="You cannot change your own role")
    if user_id == admin["id"] and updates.get("is_approved") is False:
        raise HTTPException(status_code=400, detail="You cannot unapprove your own account")
    if "meeting_buildings" in updates:
        updates["meeting_buildings"] = _normalize_building_list(updates["meeting_buildings"])
    if "fnb_locations" in updates:
        updates["fnb_locations"] = _normalize_building_list(updates["fnb_locations"])
    if updates.get("role") and updates["role"] != "meeting_admin":
        updates["meeting_buildings"] = []
    if updates.get("role") and updates["role"] != "manager":
        updates["fnb_locations"] = []
    if updates.get("is_approved") is True:
        updates["approved_at"] = _now_iso()
        updates["approved_by"] = admin["id"]
    elif updates.get("is_approved") is False:
        updates["approved_at"] = None
        updates["approved_by"] = None
    result = await db.users.update_one({"id": user_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    _normalize_user_public(user)
    return UserPublic(**user)


@api.post("/users/{user_id}/password", response_model=UserPublic)
async def admin_reset_password(
    user_id: str, payload: AdminPasswordReset, admin: dict = Depends(require_super_admin)
):
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"password_hash": hash_password(payload.password)}},
    )
    user.pop("password_hash", None)
    _normalize_user_public(user)
    return UserPublic(**user)


@api.delete("/users/{user_id}")
async def admin_delete_user(user_id: str, admin: dict = Depends(require_super_admin)):
    if user_id == admin["id"]:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    # Cascade: delete user's bookings? Safer to keep bookings (historical). Just delete user.
    await db.users.delete_one({"id": user_id})
    return {"ok": True}


# ---------- Admin Stats ----------
@api.get("/admin/stats")
async def admin_stats(admin: dict = Depends(require_any_admin)):
    today = datetime.now().strftime("%Y-%m-%d")
    allowed_room_ids = await _allowed_meeting_room_ids(admin) if admin.get("role") in MEETING_ADMIN_ROLES else None
    room_query = {"id": {"$in": allowed_room_ids}} if allowed_room_ids is not None else {}
    booking_scope = {"room_id": {"$in": allowed_room_ids}} if allowed_room_ids is not None else {}
    total_rooms = await db.rooms.count_documents(room_query)
    active_rooms = await db.rooms.count_documents({**room_query, "is_active": True})
    pending = await db.bookings.count_documents({**booking_scope, "status": "pending"})
    confirmed = await db.bookings.count_documents({**booking_scope, "status": "confirmed"})
    today_bookings = await db.bookings.count_documents({**booking_scope, "date": today, "status": {"$in": ["pending", "confirmed"]}})
    total_users = await db.users.count_documents({"role": "user"})
    return {
        "total_rooms": total_rooms,
        "active_rooms": active_rooms,
        "pending_bookings": pending,
        "confirmed_bookings": confirmed,
        "today_bookings": today_bookings,
        "total_users": total_users,
    }


# ---------- Health ----------
@api.get("/")
async def root():
    return {"message": "Meeting Room Booking API", "status": "ok"}


# ---------- Startup: seed data & indexes ----------
SAMPLE_ROOMS = [
    {
        "name": "Aurora Boardroom",
        "building": "Head Office",
        "location": "Floor 12 · North Wing",
        "capacity": 16,
        "facilities": ["4K Display", "Video Conference", "Whiteboard", "Coffee Bar"],
        "description": "Executive boardroom with panoramic city views. Ideal for C-suite meetings and strategic reviews.",
        "image_url": "https://images.pexels.com/photos/260689/pexels-photo-260689.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
        "is_active": True,
    },
    {
        "name": "Helix Conference Room",
        "building": "Head Office",
        "location": "Floor 8 · East Wing",
        "capacity": 10,
        "facilities": ["Dual Screens", "Polycom Phone", "Whiteboard"],
        "description": "Mid-sized conference room for team stand-ups, quarterly reviews, and client calls.",
        "image_url": "https://images.pexels.com/photos/8761299/pexels-photo-8761299.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
        "is_active": True,
    },
    {
        "name": "Nimbus Huddle Space",
        "building": "Annex",
        "location": "Floor 3 · Open Area",
        "capacity": 4,
        "facilities": ["Smart TV", "Wireless Cast"],
        "description": "Compact huddle space for quick syncs and 1-on-1 discussions.",
        "image_url": "https://images.pexels.com/photos/9300767/pexels-photo-9300767.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
        "is_active": True,
    },
    {
        "name": "Vertex Training Room",
        "building": "Training Center",
        "location": "Floor 5 · Learning Center",
        "capacity": 24,
        "facilities": ["Projector", "Surround Sound", "Movable Tables", "Coffee Bar"],
        "description": "Large flexible training room with reconfigurable seating for workshops and onboarding.",
        "image_url": "https://images.unsplash.com/photo-1762176263996-a0713a49ee4d?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2OTF8MHwxfHNlYXJjaHw0fHxtb2Rlcm4lMjBjb3Jwb3JhdGUlMjBtZWV0aW5nJTIwcm9vbXxlbnwwfHx8fDE3NzY4MjQ3MDF8MA&ixlib=rb-4.1.0&q=85",
        "is_active": True,
    },
    {
        "name": "Quantum Focus Room",
        "building": "Annex",
        "location": "Floor 2 · Quiet Zone",
        "capacity": 2,
        "facilities": ["Acoustic Panels", "Video Conference"],
        "description": "Quiet focus room optimised for interviews and deep-work pairing sessions.",
        "image_url": "https://images.pexels.com/photos/37347/office-sitting-room-executive-sitting.jpg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
        "is_active": True,
    },
    {
        "name": "Orion Workshop Loft",
        "building": "Innovation Hub",
        "location": "Floor 15 · Innovation Lab",
        "capacity": 20,
        "facilities": ["Modular Furniture", "Whiteboards", "Sticky Wall", "Workshop Kit"],
        "description": "Creative loft for design sprints, hackathons, and cross-functional workshops.",
        "image_url": "https://images.pexels.com/photos/260689/pexels-photo-260689.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
        "is_active": False,
    },
]


async def seed_admin():
    existing = await db.users.find_one({"email": ADMIN_EMAIL.lower()})
    if existing is None:
        await db.users.insert_one(
            {
                "id": str(uuid.uuid4()),
                "email": ADMIN_EMAIL.lower(),
                "name": "System Admin",
                "company_name": "KCSI",
                "job_title": "System Administrator",
                "department": "IT",
                "office_address": "KCSI Office",
                "meeting_buildings": [],
                "fnb_locations": [],
                "password_hash": hash_password(ADMIN_PASSWORD),
                "role": "super_admin",
                "is_approved": True,
                "approved_at": _now_iso(),
                "approved_by": "system",
                "created_at": _now_iso(),
            }
        )
        logger.info(f"Seeded super admin user: {ADMIN_EMAIL}")
    else:
        # Ensure the seeded admin always has super_admin role (backward-compat migration)
        if existing.get("role") != "super_admin":
            await db.users.update_one(
                {"email": ADMIN_EMAIL.lower()},
                {
                    "$set": {
                        "role": "super_admin",
                        "is_approved": True,
                        "approved_at": existing.get("approved_at") or _now_iso(),
                        "approved_by": existing.get("approved_by") or "system",
                    }
                },
            )
            logger.info(f"Upgraded {ADMIN_EMAIL} to super_admin role")
        elif not existing.get("is_approved", True):
            await db.users.update_one(
                {"email": ADMIN_EMAIL.lower()},
                {"$set": {"is_approved": True, "approved_at": _now_iso(), "approved_by": "system"}},
            )
            logger.info(f"Approved seeded super admin user: {ADMIN_EMAIL}")
        if not verify_password(ADMIN_PASSWORD, existing["password_hash"]):
            await db.users.update_one(
                {"email": ADMIN_EMAIL.lower()},
                {"$set": {"password_hash": hash_password(ADMIN_PASSWORD)}},
            )
            logger.info(f"Updated super admin password: {ADMIN_EMAIL}")


async def migrate_legacy_roles():
    """Convert any pre-existing generic 'admin' role docs to 'super_admin'."""
    res = await db.users.update_many({"role": "admin"}, {"$set": {"role": "super_admin"}})
    if res.modified_count:
        logger.info(f"Migrated {res.modified_count} legacy admin users to super_admin")
    res = await db.users.update_many(
        {"is_approved": {"$exists": False}},
        {"$set": {"is_approved": True, "approved_at": _now_iso(), "approved_by": "system"}},
    )
    if res.modified_count:
        logger.info(f"Approved {res.modified_count} legacy user accounts")
    res = await db.users.update_many(
        {"meeting_buildings": {"$exists": False}},
        {"$set": {"meeting_buildings": []}},
    )
    if res.modified_count:
        logger.info(f"Initialized meeting_buildings for {res.modified_count} users")
    res = await db.users.update_many(
        {"fnb_locations": {"$exists": False}},
        {"$set": {"fnb_locations": []}},
    )
    if res.modified_count:
        logger.info(f"Initialized fnb_locations for {res.modified_count} users")
    res = await db.bookings.update_many(
        {"food_beverages": {"$nin": ["", None]}, "fnb_status": {"$exists": False}},
        {"$set": {"fnb_status": "pending", "fnb_reviewed_at": None, "fnb_reviewed_by": None}},
    )
    if res.modified_count:
        logger.info(f"Initialized F&B approval status for {res.modified_count} bookings")
    res = await db.bookings.update_many(
        {
            "$or": [{"food_beverages": ""}, {"food_beverages": None}, {"food_beverages": {"$exists": False}}],
            "fnb_status": {"$exists": False},
        },
        {"$set": {"fnb_status": "not_required", "fnb_reviewed_at": None, "fnb_reviewed_by": None}},
    )
    if res.modified_count:
        logger.info(f"Initialized F&B not-required status for {res.modified_count} bookings")
    res = await db.rooms.update_many(
        {"$or": [{"building": {"$exists": False}}, {"building": ""}, {"building": None}]},
        {"$set": {"building": DEFAULT_ROOM_BUILDING}},
    )
    if res.modified_count:
        logger.info(f"Initialized building for {res.modified_count} rooms")
    res = await db.rooms.update_many(
        {"layout_fixed": {"$exists": False}},
        {"$set": {"layout_fixed": True}},
    )
    if res.modified_count:
        logger.info(f"Initialized layout_fixed for {res.modified_count} rooms")


async def seed_rooms():
    count = await db.rooms.count_documents({})
    if count > 0:
        return
    now = _now_iso()
    docs = [{"id": str(uuid.uuid4()), **r, "created_at": now} for r in SAMPLE_ROOMS]
    await db.rooms.insert_many(docs)
    logger.info(f"Seeded {len(docs)} sample rooms")


# ============================================================================
# Vehicle / Car Booking Module
# ============================================================================

VEHICLE_STATUSES = {"available", "booked", "in_use", "maintenance", "retired"}
DRIVER_STATUSES = {"available", "assigned", "off_duty"}
VB_STATUSES = ("pending", "approved", "rejected", "assigned", "in_use", "completed", "cancelled")


# ---------- Vehicle ----------
class VehicleBase(BaseModel):
    plate_number: str = Field(min_length=1, max_length=20)
    name: str = Field(min_length=1)
    type: str = Field(min_length=1)  # sedan / suv / van / truck / bus / motorcycle
    capacity: int = Field(ge=1)
    year: Optional[int] = None
    notes: str = ""
    image_url: Optional[str] = None
    status: Literal["available", "booked", "in_use", "maintenance", "retired"] = "available"


class VehicleCreate(VehicleBase):
    pass


class VehicleUpdate(BaseModel):
    plate_number: Optional[str] = None
    name: Optional[str] = None
    type: Optional[str] = None
    capacity: Optional[int] = None
    year: Optional[int] = None
    notes: Optional[str] = None
    image_url: Optional[str] = None
    status: Optional[Literal["available", "booked", "in_use", "maintenance", "retired"]] = None


class Vehicle(VehicleBase):
    id: str
    created_at: str


# ---------- Driver ----------
class DriverBase(BaseModel):
    name: str = Field(min_length=1)
    phone: str = ""
    license_number: str = ""
    notes: str = ""
    status: Literal["available", "assigned", "off_duty"] = "available"


class DriverCreate(DriverBase):
    pass


class DriverUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    license_number: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[Literal["available", "assigned", "off_duty"]] = None


class Driver(DriverBase):
    id: str
    created_at: str


# ---------- Vehicle Booking ----------
class HandoverInfo(BaseModel):
    user_confirmed_at: Optional[str] = None
    admin_confirmed_at: Optional[str] = None
    odometer_start: Optional[int] = None
    fuel_level_start: Optional[str] = None  # "Full" | "3/4" | "1/2" | "1/4" | "Empty"
    condition_before: Optional[str] = None
    photo_url: Optional[str] = None  # legacy single URL
    photos: List[str] = Field(default_factory=list)  # array of base64 data URLs (or http URLs)
    user_signature_name: Optional[str] = None
    admin_signature_name: Optional[str] = None
    user_signature_data: Optional[str] = None  # base64 PNG of canvas signature
    admin_signature_data: Optional[str] = None


class ReturnInfo(BaseModel):
    user_confirmed_at: Optional[str] = None
    admin_confirmed_at: Optional[str] = None
    odometer_end: Optional[int] = None
    fuel_level_end: Optional[str] = None
    condition_after: Optional[str] = None
    photo_url: Optional[str] = None  # legacy single URL
    photos: List[str] = Field(default_factory=list)
    damage_notes: Optional[str] = None
    user_signature_name: Optional[str] = None
    admin_signature_name: Optional[str] = None
    user_signature_data: Optional[str] = None
    admin_signature_data: Optional[str] = None


class VehicleBookingCreate(BaseModel):
    booking_type: Literal["single_trip", "multi_day"]
    employee_name: str = Field(min_length=1)
    job_title: str = Field(min_length=1)
    department: str = ""
    with_driver: bool = True
    pickup_location: str = ""
    destination: str = ""
    usage_area: str = ""
    purpose: str = Field(min_length=1)
    passengers: int = Field(ge=1, default=1)
    start_date: str  # YYYY-MM-DD
    start_time: str = "08:00"
    end_date: str  # YYYY-MM-DD
    end_time: str = "17:00"


class VehicleBookingAssign(BaseModel):
    vehicle_id: str
    driver_id: Optional[str] = None
    pickup_schedule: Optional[str] = None  # ISO datetime or free-form
    admin_notes: Optional[str] = None


class VehicleBookingReject(BaseModel):
    rejection_notes: str = Field(min_length=1)


class HandoverUserConfirm(BaseModel):
    odometer_start: int = Field(ge=0)
    fuel_level_start: str
    condition_before: str = ""
    photo_url: Optional[str] = None
    photos: Optional[List[str]] = None
    signature_name: str = Field(min_length=1)
    signature_data: Optional[str] = None


class HandoverAdminConfirm(BaseModel):
    odometer_start: Optional[int] = None
    fuel_level_start: Optional[str] = None
    condition_before: Optional[str] = None
    photo_url: Optional[str] = None
    photos: Optional[List[str]] = None
    signature_name: str = Field(min_length=1)
    signature_data: Optional[str] = None


class ReturnUserConfirm(BaseModel):
    odometer_end: int = Field(ge=0)
    fuel_level_end: str
    condition_after: str = ""
    photo_url: Optional[str] = None
    photos: Optional[List[str]] = None
    damage_notes: Optional[str] = None
    signature_name: str = Field(min_length=1)
    signature_data: Optional[str] = None


class ReturnAdminConfirm(BaseModel):
    odometer_end: Optional[int] = None
    fuel_level_end: Optional[str] = None
    condition_after: Optional[str] = None
    photo_url: Optional[str] = None
    photos: Optional[List[str]] = None
    damage_notes: Optional[str] = None
    signature_name: str = Field(min_length=1)
    signature_data: Optional[str] = None


class VehicleBooking(BaseModel):
    id: str
    user_id: str
    user_email: str
    employee_name: str
    job_title: str
    department: str = ""
    booking_type: str
    with_driver: bool
    pickup_location: str = ""
    destination: str = ""
    usage_area: str = ""
    purpose: str
    passengers: int
    start_date: str
    start_time: str
    end_date: str
    end_time: str
    status: str
    rejection_notes: Optional[str] = None
    vehicle_id: Optional[str] = None
    vehicle_name: Optional[str] = None
    vehicle_plate: Optional[str] = None
    driver_id: Optional[str] = None
    driver_name: Optional[str] = None
    pickup_schedule: Optional[str] = None
    admin_notes: Optional[str] = None
    handover: HandoverInfo = Field(default_factory=HandoverInfo)
    return_info: ReturnInfo = Field(default_factory=ReturnInfo)
    created_at: str


# ---------- Helpers ----------
def _strip(d: dict) -> dict:
    return {k: v for k, v in d.items() if k != "_id"}


async def _vehicle_overlap(
    vehicle_id: str, start_date: str, end_date: str, exclude_id: Optional[str] = None
) -> bool:
    cursor = db.vehicle_bookings.find(
        {
            "vehicle_id": vehicle_id,
            "status": {"$in": ["assigned", "in_use"]},
        },
        {"_id": 0},
    )
    async for bk in cursor:
        if exclude_id and bk["id"] == exclude_id:
            continue
        if bk["start_date"] <= end_date and start_date <= bk["end_date"]:
            return True
    return False


# ---------- Vehicles endpoints ----------
@api.get("/vehicles", response_model=List[Vehicle])
async def list_vehicles(status: Optional[str] = None):
    q = {}
    if status:
        q["status"] = status
    items = await db.vehicles.find(q, {"_id": 0}).sort("name", 1).to_list(500)
    return [Vehicle(**v) for v in items]


@api.post("/vehicles", response_model=Vehicle)
async def create_vehicle(payload: VehicleCreate, admin: dict = Depends(require_any_admin)):
    if admin["role"] not in CAR_ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Car admin access required")
    doc = {"id": str(uuid.uuid4()), **payload.model_dump(), "created_at": _now_iso()}
    await db.vehicles.insert_one(doc)
    return Vehicle(**_strip(doc))


@api.put("/vehicles/{vehicle_id}", response_model=Vehicle)
async def update_vehicle(vehicle_id: str, payload: VehicleUpdate, admin: dict = Depends(require_any_admin)):
    if admin["role"] not in CAR_ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Car admin access required")
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    res = await db.vehicles.update_one({"id": vehicle_id}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    v = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    return Vehicle(**v)


@api.delete("/vehicles/{vehicle_id}")
async def delete_vehicle(vehicle_id: str, admin: dict = Depends(require_any_admin)):
    if admin["role"] not in CAR_ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Car admin access required")
    res = await db.vehicles.delete_one({"id": vehicle_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return {"ok": True}


# ---------- Drivers endpoints ----------
@api.get("/drivers", response_model=List[Driver])
async def list_drivers(status: Optional[str] = None):
    q = {}
    if status:
        q["status"] = status
    items = await db.drivers.find(q, {"_id": 0}).sort("name", 1).to_list(500)
    return [Driver(**d) for d in items]


@api.post("/drivers", response_model=Driver)
async def create_driver(payload: DriverCreate, admin: dict = Depends(require_any_admin)):
    if admin["role"] not in CAR_ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Car admin access required")
    doc = {"id": str(uuid.uuid4()), **payload.model_dump(), "created_at": _now_iso()}
    await db.drivers.insert_one(doc)
    return Driver(**_strip(doc))


@api.put("/drivers/{driver_id}", response_model=Driver)
async def update_driver(driver_id: str, payload: DriverUpdate, admin: dict = Depends(require_any_admin)):
    if admin["role"] not in CAR_ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Car admin access required")
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    res = await db.drivers.update_one({"id": driver_id}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Driver not found")
    d = await db.drivers.find_one({"id": driver_id}, {"_id": 0})
    return Driver(**d)


@api.delete("/drivers/{driver_id}")
async def delete_driver(driver_id: str, admin: dict = Depends(require_any_admin)):
    if admin["role"] not in CAR_ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Car admin access required")
    res = await db.drivers.delete_one({"id": driver_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Driver not found")
    return {"ok": True}


# ---------- Vehicle Booking endpoints ----------
async def require_car_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") not in CAR_ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Car admin access required")
    return user


def _public_booking(doc: dict) -> dict:
    out = _strip(doc)
    out.setdefault("handover", {})
    out.setdefault("return_info", {})
    return out


@api.post("/vehicle-bookings", response_model=VehicleBooking)
async def create_vehicle_booking(payload: VehicleBookingCreate, user: dict = Depends(get_current_user)):
    if payload.start_date > payload.end_date:
        raise HTTPException(status_code=400, detail="End date must be on or after start date")
    if payload.booking_type == "single_trip" and payload.start_date != payload.end_date:
        raise HTTPException(status_code=400, detail="Single-trip bookings must be on a single day")
    booking_id = str(uuid.uuid4())
    doc = {
        "id": booking_id,
        "user_id": user["id"],
        "user_email": user["email"],
        "employee_name": payload.employee_name.strip(),
        "job_title": payload.job_title.strip(),
        "department": payload.department.strip(),
        "booking_type": payload.booking_type,
        "with_driver": payload.with_driver,
        "pickup_location": payload.pickup_location.strip(),
        "destination": payload.destination.strip(),
        "usage_area": payload.usage_area.strip(),
        "purpose": payload.purpose.strip(),
        "passengers": payload.passengers,
        "start_date": payload.start_date,
        "start_time": payload.start_time,
        "end_date": payload.end_date,
        "end_time": payload.end_time,
        "status": "pending",
        "rejection_notes": None,
        "vehicle_id": None,
        "vehicle_name": None,
        "vehicle_plate": None,
        "driver_id": None,
        "driver_name": None,
        "pickup_schedule": None,
        "admin_notes": None,
        "handover": {},
        "return_info": {},
        "created_at": _now_iso(),
    }
    await db.vehicle_bookings.insert_one(doc)
    return VehicleBooking(**_public_booking(doc))


@api.get("/vehicle-bookings/mine", response_model=List[VehicleBooking])
async def my_vehicle_bookings(user: dict = Depends(get_current_user)):
    items = await db.vehicle_bookings.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [VehicleBooking(**_public_booking(b)) for b in items]


@api.get("/vehicle-bookings/{booking_id}", response_model=VehicleBooking)
async def get_vehicle_booking(booking_id: str, user: dict = Depends(get_current_user)):
    bk = await db.vehicle_bookings.find_one({"id": booking_id}, {"_id": 0})
    if not bk:
        raise HTTPException(status_code=404, detail="Booking not found")
    if user["role"] not in CAR_ADMIN_ROLES and user["role"] not in FNB_MANAGER_ROLES and bk["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    return VehicleBooking(**_public_booking(bk))


@api.get("/vehicle-bookings", response_model=List[VehicleBooking])
async def list_vehicle_bookings(
    admin: dict = Depends(require_any_admin),
    status: Optional[str] = None,
    vehicle_id: Optional[str] = None,
    user_query: Optional[str] = None,
    date: Optional[str] = None,
):
    if admin.get("role") not in CAR_ADMIN_ROLES and admin.get("role") not in FNB_MANAGER_ROLES:
        raise HTTPException(status_code=403, detail="Car booking monitor access required")
    q: dict = {}
    if status:
        q["status"] = status
    if vehicle_id:
        q["vehicle_id"] = vehicle_id
    if date:
        q["$and"] = [{"start_date": {"$lte": date}}, {"end_date": {"$gte": date}}]
    if user_query:
        q["$or"] = [
            {"employee_name": {"$regex": user_query, "$options": "i"}},
            {"user_email": {"$regex": user_query, "$options": "i"}},
            {"job_title": {"$regex": user_query, "$options": "i"}},
        ]
    items = await db.vehicle_bookings.find(q, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [VehicleBooking(**_public_booking(b)) for b in items]


@api.post("/vehicle-bookings/{booking_id}/cancel", response_model=VehicleBooking)
async def cancel_vehicle_booking(booking_id: str, user: dict = Depends(get_current_user)):
    bk = await db.vehicle_bookings.find_one({"id": booking_id}, {"_id": 0})
    if not bk:
        raise HTTPException(status_code=404, detail="Booking not found")
    if user["role"] not in CAR_ADMIN_ROLES and bk["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    if bk["status"] in ("in_use", "completed", "cancelled", "rejected"):
        raise HTTPException(status_code=400, detail=f"Cannot cancel a {bk['status']} booking")
    await db.vehicle_bookings.update_one({"id": booking_id}, {"$set": {"status": "cancelled"}})
    bk["status"] = "cancelled"
    return VehicleBooking(**_public_booking(bk))


@api.patch("/vehicle-bookings/{booking_id}/approve", response_model=VehicleBooking)
async def approve_vehicle_booking(booking_id: str, admin: dict = Depends(require_car_admin)):
    bk = await db.vehicle_bookings.find_one({"id": booking_id}, {"_id": 0})
    if not bk:
        raise HTTPException(status_code=404, detail="Booking not found")
    if bk["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Cannot approve a {bk['status']} booking")
    await db.vehicle_bookings.update_one({"id": booking_id}, {"$set": {"status": "approved"}})
    bk["status"] = "approved"
    return VehicleBooking(**_public_booking(bk))


@api.patch("/vehicle-bookings/{booking_id}/reject", response_model=VehicleBooking)
async def reject_vehicle_booking(
    booking_id: str, payload: VehicleBookingReject, admin: dict = Depends(require_car_admin)
):
    bk = await db.vehicle_bookings.find_one({"id": booking_id}, {"_id": 0})
    if not bk:
        raise HTTPException(status_code=404, detail="Booking not found")
    if bk["status"] not in ("pending", "approved"):
        raise HTTPException(status_code=400, detail=f"Cannot reject a {bk['status']} booking")
    await db.vehicle_bookings.update_one(
        {"id": booking_id},
        {"$set": {"status": "rejected", "rejection_notes": payload.rejection_notes}},
    )
    bk["status"] = "rejected"
    bk["rejection_notes"] = payload.rejection_notes
    return VehicleBooking(**_public_booking(bk))


@api.patch("/vehicle-bookings/{booking_id}/assign", response_model=VehicleBooking)
async def assign_vehicle_booking(
    booking_id: str, payload: VehicleBookingAssign, admin: dict = Depends(require_car_admin)
):
    bk = await db.vehicle_bookings.find_one({"id": booking_id}, {"_id": 0})
    if not bk:
        raise HTTPException(status_code=404, detail="Booking not found")
    if bk["status"] not in ("approved", "assigned"):
        raise HTTPException(
            status_code=400,
            detail=f"Booking must be approved before assignment (current: {bk['status']})",
        )
    vehicle = await db.vehicles.find_one({"id": payload.vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    if vehicle["status"] in ("retired",):
        raise HTTPException(status_code=400, detail="This vehicle is retired and cannot be assigned")
    if await _vehicle_overlap(payload.vehicle_id, bk["start_date"], bk["end_date"], exclude_id=booking_id):
        raise HTTPException(status_code=409, detail="Vehicle is already booked for this date range")
    driver = None
    if payload.driver_id:
        driver = await db.drivers.find_one({"id": payload.driver_id}, {"_id": 0})
        if not driver:
            raise HTTPException(status_code=404, detail="Driver not found")
    updates = {
        "status": "assigned",
        "vehicle_id": vehicle["id"],
        "vehicle_name": vehicle["name"],
        "vehicle_plate": vehicle["plate_number"],
        "driver_id": driver["id"] if driver else None,
        "driver_name": driver["name"] if driver else None,
        "pickup_schedule": payload.pickup_schedule,
        "admin_notes": payload.admin_notes,
    }
    await db.vehicle_bookings.update_one({"id": booking_id}, {"$set": updates})
    bk.update(updates)
    # Mark vehicle as booked
    await db.vehicles.update_one({"id": vehicle["id"]}, {"$set": {"status": "booked"}})
    if driver:
        await db.drivers.update_one({"id": driver["id"]}, {"$set": {"status": "assigned"}})
    return VehicleBooking(**_public_booking(bk))


# Handover (user)
@api.post("/vehicle-bookings/{booking_id}/handover/user", response_model=VehicleBooking)
async def handover_user_confirm(
    booking_id: str, payload: HandoverUserConfirm, user: dict = Depends(get_current_user)
):
    bk = await db.vehicle_bookings.find_one({"id": booking_id}, {"_id": 0})
    if not bk:
        raise HTTPException(status_code=404, detail="Booking not found")
    if bk["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Only the requester can confirm handover")
    if bk["status"] != "assigned":
        raise HTTPException(status_code=400, detail=f"Booking must be 'assigned' to confirm handover (current: {bk['status']})")
    handover = bk.get("handover") or {}
    handover.update(
        {
            "user_confirmed_at": _now_iso(),
            "odometer_start": payload.odometer_start,
            "fuel_level_start": payload.fuel_level_start,
            "condition_before": payload.condition_before,
            "photo_url": payload.photo_url,
            "user_signature_name": payload.signature_name,
        }
    )
    if payload.signature_data is not None:
        handover["user_signature_data"] = payload.signature_data
    if payload.photos:
        existing = handover.get("photos") or []
        handover["photos"] = existing + payload.photos
    await db.vehicle_bookings.update_one({"id": booking_id}, {"$set": {"handover": handover}})
    bk["handover"] = handover
    return VehicleBooking(**_public_booking(bk))


# Handover (admin) — moves to in_use
@api.post("/vehicle-bookings/{booking_id}/handover/admin", response_model=VehicleBooking)
async def handover_admin_confirm(
    booking_id: str, payload: HandoverAdminConfirm, admin: dict = Depends(require_car_admin)
):
    bk = await db.vehicle_bookings.find_one({"id": booking_id}, {"_id": 0})
    if not bk:
        raise HTTPException(status_code=404, detail="Booking not found")
    if bk["status"] not in ("assigned",):
        raise HTTPException(status_code=400, detail=f"Booking must be 'assigned' (current: {bk['status']})")
    handover = bk.get("handover") or {}
    handover.update(
        {
            "admin_confirmed_at": _now_iso(),
            "admin_signature_name": payload.signature_name,
        }
    )
    if payload.odometer_start is not None:
        handover["odometer_start"] = payload.odometer_start
    if payload.fuel_level_start is not None:
        handover["fuel_level_start"] = payload.fuel_level_start
    if payload.condition_before is not None:
        handover["condition_before"] = payload.condition_before
    if payload.photo_url is not None:
        handover["photo_url"] = payload.photo_url
    if payload.signature_data is not None:
        handover["admin_signature_data"] = payload.signature_data
    if payload.photos:
        existing = handover.get("photos") or []
        handover["photos"] = existing + payload.photos
    await db.vehicle_bookings.update_one(
        {"id": booking_id}, {"$set": {"handover": handover, "status": "in_use"}}
    )
    bk["handover"] = handover
    bk["status"] = "in_use"
    if bk.get("vehicle_id"):
        await db.vehicles.update_one({"id": bk["vehicle_id"]}, {"$set": {"status": "in_use"}})
    return VehicleBooking(**_public_booking(bk))


# Return (user)
@api.post("/vehicle-bookings/{booking_id}/return/user", response_model=VehicleBooking)
async def return_user_confirm(
    booking_id: str, payload: ReturnUserConfirm, user: dict = Depends(get_current_user)
):
    bk = await db.vehicle_bookings.find_one({"id": booking_id}, {"_id": 0})
    if not bk:
        raise HTTPException(status_code=404, detail="Booking not found")
    if bk["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Only the requester can confirm return")
    if bk["status"] != "in_use":
        raise HTTPException(status_code=400, detail=f"Booking must be 'in_use' to confirm return (current: {bk['status']})")
    rinfo = bk.get("return_info") or {}
    rinfo.update(
        {
            "user_confirmed_at": _now_iso(),
            "odometer_end": payload.odometer_end,
            "fuel_level_end": payload.fuel_level_end,
            "condition_after": payload.condition_after,
            "photo_url": payload.photo_url,
            "damage_notes": payload.damage_notes,
            "user_signature_name": payload.signature_name,
        }
    )
    if payload.signature_data is not None:
        rinfo["user_signature_data"] = payload.signature_data
    if payload.photos:
        existing = rinfo.get("photos") or []
        rinfo["photos"] = existing + payload.photos
    await db.vehicle_bookings.update_one({"id": booking_id}, {"$set": {"return_info": rinfo}})
    bk["return_info"] = rinfo
    return VehicleBooking(**_public_booking(bk))


# Return (admin) — completes booking
@api.post("/vehicle-bookings/{booking_id}/return/admin", response_model=VehicleBooking)
async def return_admin_confirm(
    booking_id: str, payload: ReturnAdminConfirm, admin: dict = Depends(require_car_admin)
):
    bk = await db.vehicle_bookings.find_one({"id": booking_id}, {"_id": 0})
    if not bk:
        raise HTTPException(status_code=404, detail="Booking not found")
    if bk["status"] != "in_use":
        raise HTTPException(status_code=400, detail=f"Booking must be 'in_use' (current: {bk['status']})")
    rinfo = bk.get("return_info") or {}
    rinfo.update(
        {
            "admin_confirmed_at": _now_iso(),
            "admin_signature_name": payload.signature_name,
        }
    )
    if payload.odometer_end is not None:
        rinfo["odometer_end"] = payload.odometer_end
    if payload.fuel_level_end is not None:
        rinfo["fuel_level_end"] = payload.fuel_level_end
    if payload.condition_after is not None:
        rinfo["condition_after"] = payload.condition_after
    if payload.photo_url is not None:
        rinfo["photo_url"] = payload.photo_url
    if payload.damage_notes is not None:
        rinfo["damage_notes"] = payload.damage_notes
    if payload.signature_data is not None:
        rinfo["admin_signature_data"] = payload.signature_data
    if payload.photos:
        existing = rinfo.get("photos") or []
        rinfo["photos"] = existing + payload.photos
    await db.vehicle_bookings.update_one(
        {"id": booking_id}, {"$set": {"return_info": rinfo, "status": "completed"}}
    )
    bk["return_info"] = rinfo
    bk["status"] = "completed"
    if bk.get("vehicle_id"):
        await db.vehicles.update_one({"id": bk["vehicle_id"]}, {"$set": {"status": "available"}})
    if bk.get("driver_id"):
        await db.drivers.update_one({"id": bk["driver_id"]}, {"$set": {"status": "available"}})
    return VehicleBooking(**_public_booking(bk))


# ---------- Car admin stats ----------
@api.get("/vehicle-admin/stats")
async def vehicle_admin_stats(admin: dict = Depends(require_car_admin)):
    total_vehicles = await db.vehicles.count_documents({})
    available_vehicles = await db.vehicles.count_documents({"status": "available"})
    in_use = await db.vehicles.count_documents({"status": "in_use"})
    booked = await db.vehicles.count_documents({"status": "booked"})
    maintenance = await db.vehicles.count_documents({"status": "maintenance"})
    pending = await db.vehicle_bookings.count_documents({"status": "pending"})
    approved = await db.vehicle_bookings.count_documents({"status": "approved"})
    in_use_bk = await db.vehicle_bookings.count_documents({"status": "in_use"})
    drivers_total = await db.drivers.count_documents({})
    return {
        "total_vehicles": total_vehicles,
        "available_vehicles": available_vehicles,
        "in_use_vehicles": in_use,
        "booked_vehicles": booked,
        "maintenance_vehicles": maintenance,
        "pending_bookings": pending,
        "approved_bookings": approved,
        "in_use_bookings": in_use_bk,
        "total_drivers": drivers_total,
    }


# ---------- Seed sample fleet ----------
SAMPLE_VEHICLES = [
    {"plate_number": "B 1234 ABC", "name": "Toyota Innova Zenix", "type": "MPV", "capacity": 7, "year": 2023, "notes": "Premium executive MPV", "status": "available", "image_url": "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=800"},
    {"plate_number": "B 5678 DEF", "name": "Toyota Camry Hybrid", "type": "Sedan", "capacity": 4, "year": 2024, "notes": "Executive sedan", "status": "available", "image_url": "https://images.unsplash.com/photo-1555215695-3004980ad54e?w=800"},
    {"plate_number": "B 9012 GHI", "name": "Toyota Hiace Premio", "type": "Van", "capacity": 14, "year": 2022, "notes": "Group transport, long trips", "status": "available", "image_url": "https://images.unsplash.com/photo-1570125909232-eb263c188f7e?w=800"},
    {"plate_number": "B 3456 JKL", "name": "Honda Brio", "type": "Hatchback", "capacity": 4, "year": 2023, "notes": "City runabout", "status": "available", "image_url": "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800"},
    {"plate_number": "B 7890 MNO", "name": "Mitsubishi Pajero Sport", "type": "SUV", "capacity": 7, "year": 2023, "notes": "Long-distance & off-road", "status": "available", "image_url": "https://images.unsplash.com/photo-1502877338535-766e1452684a?w=800"},
    {"plate_number": "B 2468 PQR", "name": "Toyota Avanza", "type": "MPV", "capacity": 7, "year": 2021, "notes": "Daily ops", "status": "maintenance", "image_url": "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=800"},
]

SAMPLE_DRIVERS = [
    {"name": "Budi Santoso", "phone": "+62 812-1111-2222", "license_number": "SIM-A-001", "notes": "Senior driver, 12 years experience", "status": "available"},
    {"name": "Adi Pratama", "phone": "+62 812-2222-3333", "license_number": "SIM-A-002", "notes": "Long-distance specialist", "status": "available"},
    {"name": "Rini Hartati", "phone": "+62 812-3333-4444", "license_number": "SIM-A-003", "notes": "Executive transport", "status": "available"},
    {"name": "Joko Widodo", "phone": "+62 812-4444-5555", "license_number": "SIM-A-004", "notes": "City and airport runs", "status": "off_duty"},
]


async def seed_fleet():
    if await db.vehicles.count_documents({}) == 0:
        now = _now_iso()
        docs = [{"id": str(uuid.uuid4()), **v, "created_at": now} for v in SAMPLE_VEHICLES]
        await db.vehicles.insert_many(docs)
        logger.info(f"Seeded {len(docs)} vehicles")
    if await db.drivers.count_documents({}) == 0:
        now = _now_iso()
        docs = [{"id": str(uuid.uuid4()), **d, "created_at": now} for d in SAMPLE_DRIVERS]
        await db.drivers.insert_many(docs)
        logger.info(f"Seeded {len(docs)} drivers")


@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.rooms.create_index("name")
    await db.rooms.create_index("building")
    await db.bookings.create_index([("room_id", 1), ("date", 1)])
    await db.bookings.create_index("room_building")
    await db.bookings.create_index("fnb_status")
    await db.bookings.create_index("user_id")
    await db.vehicles.create_index("plate_number", unique=True)
    await db.vehicle_bookings.create_index([("vehicle_id", 1), ("start_date", 1)])
    await db.vehicle_bookings.create_index("user_id")
    await db.password_resets.create_index("token_hash", unique=True)
    await db.password_resets.create_index("expires_at", expireAfterSeconds=0)
    await seed_admin()
    await migrate_legacy_roles()
    await seed_rooms()
    await seed_fleet()


@app.on_event("shutdown")
async def on_shutdown():
    client.close()


app.include_router(api)

cors_origins = [origin.strip() for origin in os.environ.get("CORS_ORIGINS", "*").split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("server:app", host=APP_HOST, port=APP_PORT, reload=UVICORN_RELOAD)
