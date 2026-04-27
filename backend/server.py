from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import uuid
import logging
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

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
    return user


ADMIN_ROLES = {"meeting_admin", "car_admin", "super_admin"}
MEETING_ADMIN_ROLES = {"meeting_admin", "super_admin"}
CAR_ADMIN_ROLES = {"car_admin", "super_admin"}


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


# Backward-compat alias — treat the old 'admin' name as meeting admin checker for existing routes.
require_admin = require_meeting_admin


# ---------- Models ----------
class UserPublic(BaseModel):
    id: str
    email: EmailStr
    name: str
    company_name: str = ""
    role: Literal["user", "meeting_admin", "car_admin", "super_admin"]
    created_at: str


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1)
    company_name: str = Field(min_length=1, max_length=120)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    user: UserPublic
    access_token: str
    token_type: str = "bearer"


class RoomBase(BaseModel):
    name: str
    location: str
    capacity: int = Field(ge=1)
    facilities: List[str] = []
    description: str = ""
    image_url: Optional[str] = None
    is_active: bool = True


class RoomCreate(RoomBase):
    pass


class RoomUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    capacity: Optional[int] = None
    facilities: Optional[List[str]] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    is_active: Optional[bool] = None


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
    notes: Optional[str] = ""


class BookingStatusUpdate(BaseModel):
    status: Literal["pending", "confirmed", "cancelled", "completed"]


class Booking(BaseModel):
    id: str
    room_id: str
    room_name: str
    user_id: str
    user_name: str
    user_email: str
    title: str
    date: str
    start_time: str
    end_time: str
    participants: int
    notes: str
    status: str
    created_at: str
    checked_in_at: Optional[str] = None
    checked_out_at: Optional[str] = None


# ---------- Util ----------
def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _overlap(a_start: str, a_end: str, b_start: str, b_end: str) -> bool:
    return a_start < b_end and b_start < a_end


async def _check_overlap(room_id: str, date: str, start: str, end: str, exclude_id: Optional[str] = None) -> bool:
    cursor = db.bookings.find(
        {
            "room_id": room_id,
            "date": date,
            "status": {"$in": ["pending", "confirmed"]},
        },
        {"_id": 0},
    )
    async for bk in cursor:
        if exclude_id and bk["id"] == exclude_id:
            continue
        if _overlap(start, end, bk["start_time"], bk["end_time"]):
            return True
    return False


# ---------- Auth Endpoints ----------
@api.post("/auth/register", response_model=AuthResponse)
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
        "password_hash": hash_password(payload.password),
        "role": "user",
        "created_at": _now_iso(),
    }
    await db.users.insert_one(doc)
    public = {k: v for k, v in doc.items() if k != "password_hash"}
    token = create_access_token(user_id, email, "user")
    return AuthResponse(user=UserPublic(**public), access_token=token)


@api.post("/auth/login", response_model=AuthResponse)
async def login(payload: LoginRequest):
    email = payload.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user["id"], user["email"], user["role"])
    user.setdefault("company_name", "")
    public = {k: v for k, v in user.items() if k not in ("password_hash", "_id")}
    return AuthResponse(user=UserPublic(**public), access_token=token)


@api.post("/auth/logout")
async def logout():
    return {"ok": True}


@api.get("/auth/me", response_model=UserPublic)
async def me(current_user: dict = Depends(get_current_user)):
    return UserPublic(**current_user)


# Admin: promote a user (super admin only)
class PromoteRequest(BaseModel):
    email: EmailStr
    role: Literal["user", "meeting_admin", "car_admin", "super_admin"] = "meeting_admin"


@api.post("/auth/promote", response_model=UserPublic)
async def promote_user(payload: PromoteRequest, admin: dict = Depends(require_super_admin)):
    target = await db.users.find_one({"email": payload.email.lower()})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    await db.users.update_one({"id": target["id"]}, {"$set": {"role": payload.role}})
    target["role"] = payload.role
    target.setdefault("company_name", "")
    return UserPublic(**{k: v for k, v in target.items() if k not in ("password_hash", "_id")})


# ---------- Rooms ----------
@api.get("/rooms", response_model=List[Room])
async def list_rooms(active_only: bool = False):
    query = {"is_active": True} if active_only else {}
    rooms = await db.rooms.find(query, {"_id": 0}).sort("name", 1).to_list(500)
    return [Room(**r) for r in rooms]


@api.get("/rooms/{room_id}", response_model=Room)
async def get_room(room_id: str):
    room = await db.rooms.find_one({"id": room_id}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return Room(**room)


@api.post("/rooms", response_model=Room)
async def create_room(payload: RoomCreate, admin: dict = Depends(require_admin)):
    room_id = str(uuid.uuid4())
    doc = {"id": room_id, **payload.model_dump(), "created_at": _now_iso()}
    await db.rooms.insert_one(doc)
    return Room(**{k: v for k, v in doc.items() if k != "_id"})


@api.put("/rooms/{room_id}", response_model=Room)
async def update_room(room_id: str, payload: RoomUpdate, admin: dict = Depends(require_admin)):
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items()}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = await db.rooms.update_one({"id": room_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Room not found")
    room = await db.rooms.find_one({"id": room_id}, {"_id": 0})
    return Room(**room)


@api.delete("/rooms/{room_id}")
async def delete_room(room_id: str, admin: dict = Depends(require_admin)):
    result = await db.rooms.delete_one({"id": room_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Room not found")
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
    bookings = await db.bookings.find(
        {
            "room_id": room_id,
            "date": {"$gte": start_date, "$lte": end_date},
            "status": {"$in": ["pending", "confirmed"]},
        },
        {"_id": 0},
    ).to_list(500)
    return {"room_id": room_id, "bookings": bookings}


# ---------- Bookings ----------
@api.post("/bookings", response_model=Booking)
async def create_booking(payload: BookingCreate, user: dict = Depends(get_current_user)):
    # Validate room
    room = await db.rooms.find_one({"id": payload.room_id}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if not room.get("is_active"):
        raise HTTPException(status_code=400, detail="Room is not active")
    # Validate times
    if payload.start_time >= payload.end_time:
        raise HTTPException(status_code=400, detail="End time must be after start time")
    # Validate date/time not in past
    try:
        booking_dt = datetime.fromisoformat(f"{payload.date}T{payload.start_time}")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid date/time format")
    if booking_dt < datetime.now().replace(second=0, microsecond=0):
        raise HTTPException(status_code=400, detail="Cannot book a time in the past")
    if payload.participants > room["capacity"]:
        raise HTTPException(status_code=400, detail=f"Participants exceed room capacity ({room['capacity']})")
    # Check overlap
    if await _check_overlap(payload.room_id, payload.date, payload.start_time, payload.end_time):
        raise HTTPException(status_code=409, detail="Room is already booked for this time slot")

    booking_id = str(uuid.uuid4())
    doc = {
        "id": booking_id,
        "room_id": payload.room_id,
        "room_name": room["name"],
        "user_id": user["id"],
        "user_name": user["name"],
        "user_email": user["email"],
        "title": payload.title,
        "date": payload.date,
        "start_time": payload.start_time,
        "end_time": payload.end_time,
        "participants": payload.participants,
        "notes": payload.notes or "",
        "status": "pending",
        "created_at": _now_iso(),
    }
    await db.bookings.insert_one(doc)
    return Booking(**{k: v for k, v in doc.items() if k != "_id"})


@api.get("/bookings/mine", response_model=List[Booking])
async def my_bookings(user: dict = Depends(get_current_user)):
    items = await db.bookings.find({"user_id": user["id"]}, {"_id": 0}).sort([("date", -1), ("start_time", -1)]).to_list(500)
    return [Booking(**b) for b in items]


@api.get("/bookings", response_model=List[Booking])
async def all_bookings(
    admin: dict = Depends(require_admin),
    status: Optional[str] = None,
    room_id: Optional[str] = None,
    user_query: Optional[str] = None,
    date: Optional[str] = None,
):
    q: dict = {}
    if status:
        q["status"] = status
    if room_id:
        q["room_id"] = room_id
    if date:
        q["date"] = date
    if user_query:
        q["$or"] = [
            {"user_name": {"$regex": user_query, "$options": "i"}},
            {"user_email": {"$regex": user_query, "$options": "i"}},
        ]
    items = await db.bookings.find(q, {"_id": 0}).sort([("date", -1), ("start_time", -1)]).to_list(1000)
    return [Booking(**b) for b in items]


@api.patch("/bookings/{booking_id}/status", response_model=Booking)
async def update_booking_status(
    booking_id: str,
    payload: BookingStatusUpdate,
    admin: dict = Depends(require_admin),
):
    result = await db.bookings.update_one({"id": booking_id}, {"$set": {"status": payload.status}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Booking not found")
    bk = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    return Booking(**bk)


@api.post("/bookings/{booking_id}/cancel", response_model=Booking)
async def cancel_booking(booking_id: str, user: dict = Depends(get_current_user)):
    bk = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not bk:
        raise HTTPException(status_code=404, detail="Booking not found")
    if user["role"] not in ADMIN_ROLES and bk["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to cancel this booking")
    if bk["status"] in ("cancelled", "completed"):
        raise HTTPException(status_code=400, detail=f"Cannot cancel a {bk['status']} booking")
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
    now = datetime.now()
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
    now = datetime.now()
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
    role: Optional[Literal["user", "meeting_admin", "car_admin", "super_admin"]] = None


class AdminPasswordReset(BaseModel):
    password: str = Field(min_length=6)


class AdminUserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1)
    company_name: str = ""
    role: Literal["user", "meeting_admin", "car_admin", "super_admin"] = "user"


@api.get("/users", response_model=List[UserPublic])
async def list_users(
    admin: dict = Depends(require_super_admin),
    q: Optional[str] = None,
    role: Optional[Literal["user", "meeting_admin", "car_admin", "super_admin"]] = None,
):
    query: dict = {}
    if role:
        query["role"] = role
    if q:
        query["$or"] = [
            {"email": {"$regex": q, "$options": "i"}},
            {"name": {"$regex": q, "$options": "i"}},
            {"company_name": {"$regex": q, "$options": "i"}},
        ]
    users = await db.users.find(query, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(1000)
    for u in users:
        u.setdefault("company_name", "")
    return [UserPublic(**u) for u in users]


@api.post("/users", response_model=UserPublic)
async def admin_create_user(payload: AdminUserCreate, admin: dict = Depends(require_super_admin)):
    email = payload.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    doc = {
        "id": str(uuid.uuid4()),
        "email": email,
        "name": payload.name.strip(),
        "company_name": payload.company_name.strip(),
        "password_hash": hash_password(payload.password),
        "role": payload.role,
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
    result = await db.users.update_one({"id": user_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    user.setdefault("company_name", "")
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
    user.setdefault("company_name", "")
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
    total_rooms = await db.rooms.count_documents({})
    active_rooms = await db.rooms.count_documents({"is_active": True})
    pending = await db.bookings.count_documents({"status": "pending"})
    confirmed = await db.bookings.count_documents({"status": "confirmed"})
    today_bookings = await db.bookings.count_documents({"date": today, "status": {"$in": ["pending", "confirmed"]}})
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
        "location": "Floor 12 · North Wing",
        "capacity": 16,
        "facilities": ["4K Display", "Video Conference", "Whiteboard", "Coffee Bar"],
        "description": "Executive boardroom with panoramic city views. Ideal for C-suite meetings and strategic reviews.",
        "image_url": "https://images.pexels.com/photos/260689/pexels-photo-260689.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
        "is_active": True,
    },
    {
        "name": "Helix Conference Room",
        "location": "Floor 8 · East Wing",
        "capacity": 10,
        "facilities": ["Dual Screens", "Polycom Phone", "Whiteboard"],
        "description": "Mid-sized conference room for team stand-ups, quarterly reviews, and client calls.",
        "image_url": "https://images.pexels.com/photos/8761299/pexels-photo-8761299.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
        "is_active": True,
    },
    {
        "name": "Nimbus Huddle Space",
        "location": "Floor 3 · Open Area",
        "capacity": 4,
        "facilities": ["Smart TV", "Wireless Cast"],
        "description": "Compact huddle space for quick syncs and 1-on-1 discussions.",
        "image_url": "https://images.pexels.com/photos/9300767/pexels-photo-9300767.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
        "is_active": True,
    },
    {
        "name": "Vertex Training Room",
        "location": "Floor 5 · Learning Center",
        "capacity": 24,
        "facilities": ["Projector", "Surround Sound", "Movable Tables", "Coffee Bar"],
        "description": "Large flexible training room with reconfigurable seating for workshops and onboarding.",
        "image_url": "https://images.unsplash.com/photo-1762176263996-a0713a49ee4d?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2OTF8MHwxfHNlYXJjaHw0fHxtb2Rlcm4lMjBjb3Jwb3JhdGUlMjBtZWV0aW5nJTIwcm9vbXxlbnwwfHx8fDE3NzY4MjQ3MDF8MA&ixlib=rb-4.1.0&q=85",
        "is_active": True,
    },
    {
        "name": "Quantum Focus Room",
        "location": "Floor 2 · Quiet Zone",
        "capacity": 2,
        "facilities": ["Acoustic Panels", "Video Conference"],
        "description": "Quiet focus room optimised for interviews and deep-work pairing sessions.",
        "image_url": "https://images.pexels.com/photos/37347/office-sitting-room-executive-sitting.jpg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
        "is_active": True,
    },
    {
        "name": "Orion Workshop Loft",
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
                "company_name": "RoomBook",
                "password_hash": hash_password(ADMIN_PASSWORD),
                "role": "super_admin",
                "created_at": _now_iso(),
            }
        )
        logger.info(f"Seeded super admin user: {ADMIN_EMAIL}")
    else:
        # Ensure the seeded admin always has super_admin role (backward-compat migration)
        if existing.get("role") != "super_admin":
            await db.users.update_one(
                {"email": ADMIN_EMAIL.lower()}, {"$set": {"role": "super_admin"}}
            )
            logger.info(f"Upgraded {ADMIN_EMAIL} to super_admin role")
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
    photo_url: Optional[str] = None
    user_signature_name: Optional[str] = None
    admin_signature_name: Optional[str] = None


class ReturnInfo(BaseModel):
    user_confirmed_at: Optional[str] = None
    admin_confirmed_at: Optional[str] = None
    odometer_end: Optional[int] = None
    fuel_level_end: Optional[str] = None
    condition_after: Optional[str] = None
    photo_url: Optional[str] = None
    damage_notes: Optional[str] = None
    user_signature_name: Optional[str] = None
    admin_signature_name: Optional[str] = None


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
    signature_name: str = Field(min_length=1)


class HandoverAdminConfirm(BaseModel):
    odometer_start: Optional[int] = None
    fuel_level_start: Optional[str] = None
    condition_before: Optional[str] = None
    photo_url: Optional[str] = None
    signature_name: str = Field(min_length=1)


class ReturnUserConfirm(BaseModel):
    odometer_end: int = Field(ge=0)
    fuel_level_end: str
    condition_after: str = ""
    photo_url: Optional[str] = None
    damage_notes: Optional[str] = None
    signature_name: str = Field(min_length=1)


class ReturnAdminConfirm(BaseModel):
    odometer_end: Optional[int] = None
    fuel_level_end: Optional[str] = None
    condition_after: Optional[str] = None
    photo_url: Optional[str] = None
    damage_notes: Optional[str] = None
    signature_name: str = Field(min_length=1)


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
    if user["role"] not in CAR_ADMIN_ROLES and bk["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    return VehicleBooking(**_public_booking(bk))


@api.get("/vehicle-bookings", response_model=List[VehicleBooking])
async def list_vehicle_bookings(
    admin: dict = Depends(require_car_admin),
    status: Optional[str] = None,
    vehicle_id: Optional[str] = None,
    user_query: Optional[str] = None,
    date: Optional[str] = None,
):
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
    await db.bookings.create_index([("room_id", 1), ("date", 1)])
    await db.bookings.create_index("user_id")
    await db.vehicles.create_index("plate_number", unique=True)
    await db.vehicle_bookings.create_index([("vehicle_id", 1), ("start_date", 1)])
    await db.vehicle_bookings.create_index("user_id")
    await seed_admin()
    await migrate_legacy_roles()
    await seed_rooms()
    await seed_fleet()


@app.on_event("shutdown")
async def on_shutdown():
    client.close()


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
