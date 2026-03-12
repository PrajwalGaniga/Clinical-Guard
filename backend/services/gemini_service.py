import google.generativeai as genai
from ..config import get_settings

settings = get_settings()

# Diagnosis mapping for human-readable prompt
_DIAGNOSIS_MAP = {
    0: "COPD",
    1: "Diabetes",
    2: "Hypertension",
    3: "Tachycardia",
    4: "None / Healthy",
}

# Fallback API keys — tries primary first, then backup
_PRIMARY_KEY  = settings.GEMINI_API_KEY
_FALLBACK_KEY = "AIzaSyCKGK8IwzbpkCLyPOjsd80Py0Va5CdqXXo"


def _build_prompt(record: dict, ml_result: dict) -> str:
    """Build a fully dynamic prompt using the ACTUAL record values."""
    diagnosis_text = _DIAGNOSIS_MAP.get(
        int(record.get("diagnosis_encoded", 4)), "Unknown"
    )
    sfo_flag = ml_result.get("sfo_detected", False)

    return f"""You are a clinical data integrity expert assisting a hospital doctor.
A machine learning model has analyzed the following clinical trial patient record and returned a verdict.

IMPORTANT INSTRUCTION: You MUST reference the SPECIFIC numerical values provided below.
Do NOT give generic explanations. Mention the actual bp_systolic ({record.get('bp_systolic')}),
bp_diastolic ({record.get('bp_diastolic')}), glucose ({record.get('glucose')}),
heart rate ({record.get('hr')}), SpO2 ({record.get('spo2')}), and
health_risk_score ({record.get('health_risk_score')}) numbers in your response.
If all vitals are within normal ranges and the ML model determined AUTHENTIC, say so clearly
and explain why the record passes integrity checks.

=== PATIENT RECORD ===
Age: {record.get('age')} years
Systolic BP: {record.get('bp_systolic')} mmHg
Diastolic BP: {record.get('bp_diastolic')} mmHg  [Top predictive feature — 38.96% importance]
Blood Glucose: {record.get('glucose')} mg/dL
Heart Rate: {record.get('hr')} bpm
Oxygen Saturation (SpO2): {record.get('spo2')}%
Diagnosis: {diagnosis_text}
Previous Trials: {record.get('previous_trials')}
Product Experience Score: {record.get('product_experience')}
Last Trial Outcome: {record.get('last_trial_outcome')}
Health Risk Score (composite): {record.get('health_risk_score')} (0.05–1.00 scale)
Age Group — Adult (18–60): {record.get('age_grp_adult')}
Age Group — Elderly (>60): {record.get('age_grp_elderly')}

=== ML VERDICT ===
Decision: {ml_result.get('decision')}
Confidence AUTHENTIC: {ml_result.get('confidence_authentic')}%
Confidence MANIPULATED: {ml_result.get('confidence_manipulated')}%
Risk Level: {ml_result.get('risk_level')}
Blockchain Action: {ml_result.get('blockchain_action')}
SFO Override Triggered: {sfo_flag}

=== YOUR TASK ===
Write exactly 3–4 sentences in plain English:
1. Clearly state whether this record appears authentic or manipulated, referencing the ML confidence.
2. Identify WHICH specific values (using the actual numbers above) are anomalous or normal, and WHY.
   If vitals are all normal, state that explicitly.
3. If SFO Override was True, specifically mention that the health_risk_score was suspiciously low
   despite abnormal vitals, which triggered the Selective Field Omission detection.
4. State the risk level and what the clinical team or regulator should do next.
Write for a hospital doctor. Be precise, clinical, and actionable.
"""


def generate_reasoning(record: dict, ml_result: dict) -> str:
    """
    Use Gemini 2.5 Flash to generate a dynamic, contextual explanation
    of the ML verdict for a hospital physician.
    This function intentionally has NO caching — every call generates fresh output.
    """
    prompt = _build_prompt(record, ml_result)

    # Print full prompt to terminal for verification / debugging
    print("\n" + "="*60)
    print("[GEMINI] Sending prompt:")
    print(prompt[:500] + "..." if len(prompt) > 500 else prompt)
    print("="*60 + "\n")

    def _try_key(api_key: str) -> str | None:
        try:
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel("gemini-2.5-flash")
            response = model.generate_content(prompt)
            return response.text.strip()
        except Exception:
            try:
                model = genai.GenerativeModel("gemini-1.5-flash")
                response = model.generate_content(prompt)
                return response.text.strip()
            except Exception as e:
                print(f"[GEMINI] Key failed: {e}")
                return None

    # Try primary key
    if _PRIMARY_KEY:
        result = _try_key(_PRIMARY_KEY)
        if result:
            return result

    # Try fallback key
    result = _try_key(_FALLBACK_KEY)
    if result:
        return result

    return "AI reasoning temporarily unavailable."
