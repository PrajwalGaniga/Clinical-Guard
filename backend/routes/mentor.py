from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
import google.generativeai as genai
from ..config import get_settings
from .auth import get_current_user
from ..database import get_database

router = APIRouter(prefix="/mentor", tags=["Mentor AI"])
settings = get_settings()

# Configure Gemini
genai.configure(api_key=settings.GEMINI_API_KEY)
model = genai.GenerativeModel('gemini-2.5-flash')

class ChatPayload(BaseModel):
    message: str
    record_id: Optional[str] = None

@router.post("/chat")
async def mentor_chat(payload: ChatPayload, current_user: dict = Depends(get_current_user)):
    db = get_database()
    context_text = ""
    
    # 1. Gather context if record_id is provided
    if payload.record_id:
        record = await db.trial_records.find_one({"blockchain.data_hash": payload.record_id}) # search by hash
        if record:
            context_text = f"\nRelevant Record Context:\n{record['ml_result']}\n"

    # 2. System Prompt
    system_prompt = (
        "You are ClinicalGuard Mentor AI, a world-class expert in clinical trial data integrity, "
        "medical fraud detection, and regulatory compliance (FDA/EMA). "
        "Your goal is to help investigators understand ML verdicts and identify patterns of fraud. "
        f"The user ({current_user['email']}) is a {current_user['role']} at {current_user['hospital']}. "
        "Always be professional, precise, and medical-grade. "
        "If the data looks suspicious (e.g., SFO pattern where health_risk_score is 0), explain why it's a red flag."
        "Keep responses concise (max 200 words) but deeply analytical."
        + context_text
    )

    try:
        response = model.generate_content(f"{system_prompt}\n\nUser Question: {payload.message}")
        return {"response": response.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini API Error: {str(e)}")
