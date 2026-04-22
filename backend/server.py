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


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# ---------- Models ----------
class UserPublic(BaseModel):
    id: str
    email: EmailStr
    name: str
    company_name: str = ""
    role: Literal["user", "admin"]
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


# Admin: promote self to admin (only during initial setup or via admin)
class PromoteRequest(BaseModel):
    email: EmailStr


@api.post("/auth/promote", response_model=UserPublic)
async def promote_user(payload: PromoteRequest, admin: dict = Depends(require_admin)):
    target = await db.users.find_one({"email": payload.email.lower()})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    await db.users.update_one({"id": target["id"]}, {"$set": {"role": "admin"}})
    target["role"] = "admin"
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
    if user["role"] != "admin" and bk["user_id"] != user["id"]:
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


# ---------- Admin: Users management ----------
class AdminUserUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1)
    company_name: Optional[str] = Field(default=None, max_length=120)
    role: Optional[Literal["user", "admin"]] = None


class AdminPasswordReset(BaseModel):
    password: str = Field(min_length=6)


class AdminUserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1)
    company_name: str = ""
    role: Literal["user", "admin"] = "user"


@api.get("/users", response_model=List[UserPublic])
async def list_users(
    admin: dict = Depends(require_admin),
    q: Optional[str] = None,
    role: Optional[Literal["user", "admin"]] = None,
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
async def admin_create_user(payload: AdminUserCreate, admin: dict = Depends(require_admin)):
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
    user_id: str, payload: AdminUserUpdate, admin: dict = Depends(require_admin)
):
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    # Prevent self-demotion
    if user_id == admin["id"] and updates.get("role") == "user":
        raise HTTPException(status_code=400, detail="You cannot demote yourself")
    result = await db.users.update_one({"id": user_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    user.setdefault("company_name", "")
    return UserPublic(**user)


@api.post("/users/{user_id}/password", response_model=UserPublic)
async def admin_reset_password(
    user_id: str, payload: AdminPasswordReset, admin: dict = Depends(require_admin)
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
async def admin_delete_user(user_id: str, admin: dict = Depends(require_admin)):
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
async def admin_stats(admin: dict = Depends(require_admin)):
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
                "role": "admin",
                "created_at": _now_iso(),
            }
        )
        logger.info(f"Seeded admin user: {ADMIN_EMAIL}")
    elif not verify_password(ADMIN_PASSWORD, existing["password_hash"]):
        await db.users.update_one(
            {"email": ADMIN_EMAIL.lower()},
            {"$set": {"password_hash": hash_password(ADMIN_PASSWORD), "role": "admin"}},
        )
        logger.info(f"Updated admin password: {ADMIN_EMAIL}")


async def seed_rooms():
    count = await db.rooms.count_documents({})
    if count > 0:
        return
    now = _now_iso()
    docs = [{"id": str(uuid.uuid4()), **r, "created_at": now} for r in SAMPLE_ROOMS]
    await db.rooms.insert_many(docs)
    logger.info(f"Seeded {len(docs)} sample rooms")


@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.rooms.create_index("name")
    await db.bookings.create_index([("room_id", 1), ("date", 1)])
    await db.bookings.create_index("user_id")
    await seed_admin()
    await seed_rooms()


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
