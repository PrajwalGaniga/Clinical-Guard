import google.generativeai as genai
from ..config import get_settings

settings = get_settings()

# Configure once on import
if settings.GEMINI_API_KEY:
    genai.configure(api_key=settings.GEMINI_API_KEY)

# Diagnosis mapping for human-readable prompt
_DIAGNOSIS_MAP = {
    0: "COPD",
    1: "Diabetes",
    2: "Hypertension",
    3: "Tachycardia",
    4: "None / Healthy",
}


def generate_reasoning(record: dict, ml_result: dict) -> str:
    """
    Use Gemini 2.5 Flash to generate a plain-English explanation
    of the ML verdict for a hospital physician.
    """
    if not settings.GEMINI_API_KEY:
        return "AI reasoning unavailable — GEMINI_API_KEY not configured."

    diagnosis_text = _DIAGNOSIS_MAP.get(
        int(record.get("diagnosis_encoded", 4)), "Unknown"
    )

    prompt = f"""You are a clinical data integrity expert assisting a hospital doctor.
A machine learning model has analyzed the following clinical trial patient record and returned a verdict.

=== PATIENT RECORD ===
Age: {record.get('age')} years
Systolic BP: {record.get('bp_systolic')} mmHg
Diastolic BP: {record.get('bp_diastolic')} mmHg  [Top predictive feature — 38.96% importance]
Blood Glucose: {record.get('glucose')} mg/dL
Heart Rate: {record.get('hr')} bpm
Oxygen Saturation (SpO₂): {record.get('spo2')}%
Diagnosis: {diagnosis_text}
Previous Trials: {record.get('previous_trials')}
Product Experience Score: {record.get('product_experience')}
Last Trial Outcome: {record.get('last_trial_outcome')}
Health Risk Score (composite): {record.get('health_risk_score')} (0.0–1.0 scale)
Age Group — Adult (18–60): {record.get('age_grp_adult')}
Age Group — Elderly (>60): {record.get('age_grp_elderly')}

=== ML VERDICT ===
Decision: {ml_result.get('decision')}
Confidence AUTHENTIC: {ml_result.get('confidence_authentic')}%
Confidence MANIPULATED: {ml_result.get('confidence_manipulated')}%
Risk Level: {ml_result.get('risk_level')}
Blockchain Action: {ml_result.get('blockchain_action')}

=== YOUR TASK ===
Write exactly 3–4 sentences in plain English:
1. Clearly state whether this record appears authentic or manipulated.
2. Identify WHICH specific values are anomalous and WHY they raise a red flag (reference clinical norms).
3. State the risk level and what the clinical team or regulator should do next.
Write for a hospital doctor. Be precise, clinical, and actionable.
"""

    try:
        model = genai.GenerativeModel("gemini-2.5-flash")
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception:
        try:
            model = genai.GenerativeModel("gemini-1.5-flash")
            response = model.generate_content(prompt)
            return response.text.strip()
        except Exception as e:
            print(f"[GEMINI] Error: {e}")
            return "AI reasoning temporarily unavailable."
