from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from bson import ObjectId
from ..database import get_database
from ..auth_utils import hash_password, verify_password, create_access_token, get_current_user, require_roles

router = APIRouter(prefix="/auth", tags=["Auth"])


class RegisterRequest(BaseModel):
    email: str
    password: str
    role: str = "investigator"
    hospital: str = "General Hospital"
    site_id: str = "SITE_001"


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    email: str
    hospital: str


@router.post("/register", status_code=201)
async def register(req: RegisterRequest):
    db = get_database()
    existing = await db.users.find_one({"email": req.email})
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered.")

    allowed_roles = {"admin", "investigator", "monitor", "regulator"}
    if req.role not in allowed_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role. Choose from: {allowed_roles}")

    user_doc = {
        "email":           req.email,
        "hashed_password": hash_password(req.password),
        "role":            req.role,
        "hospital":        req.hospital,
        "site_id":         req.site_id,
        "created_at":      datetime.utcnow(),
    }
    result = await db.users.insert_one(user_doc)
    return {"message": "User created successfully", "id": str(result.inserted_id)}


@router.post("/login", response_model=LoginResponse)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    db = get_database()
    user = await db.users.find_one({"email": form_data.username})
    if not user or not verify_password(form_data.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token_data = {
        "sub":      str(user["_id"]),
        "email":    user["email"],
        "role":     user["role"],
        "hospital": user["hospital"],
        "site_id":  user["site_id"],
    }
    token = create_access_token(token_data, expires_delta=timedelta(hours=24))
    return LoginResponse(
        access_token=token,
        role=user["role"],
        email=user["email"],
        hospital=user["hospital"],
    )

@router.get("/demo", response_model=LoginResponse)
async def demo_login():
    token_data = {
        "sub":      "000000000000000000000000",
        "email":    "demo@sahyadri.edu",
        "role":     "investigator",
        "hospital": "ClinicalGuard Demo Facility",
        "site_id":  "SITE_001",
    }
    token = create_access_token(token_data, expires_delta=timedelta(hours=2))
    return LoginResponse(
        access_token=token,
        role="investigator",
        email="demo@sahyadri.edu",
        hospital="ClinicalGuard Demo Facility",
    )
@router.get("/me")
async def me(current_user: dict = Depends(get_current_user)):
    return current_user
