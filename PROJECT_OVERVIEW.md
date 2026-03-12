# PROJECT_OVERVIEW.md | ClinicalGuard System Architecture

**ClinicalGuard** is an end-to-end clinical trial data integrity platform that uses Machine Learning to detect manipulation, Gemini AI for reasoning, and Polygon Blockchain for immutable anchoring.

---

## 🏗️ High-Level Architecture
ClinicalGuard follows a modern decoupled architecture:
1.  **Frontend**: Next.js 14 (App Router) with CSS Modules.
2.  **Backend**: FastAPI (Python) serving a RESTful API.
3.  **Database**: MongoDB for document storage.
4.  **AI Layer**: local Scikit-learn models + Google Gemini 2.0 Flash.
5.  **Blockchain**: Polygon (Amoy Testnet) for data hash anchoring.

---

## 🛠️ Backend Structure & Routes

### Main Modules
- `/backend/main.py`: Application entry point and router inclusion.
- `/backend/auth_utils.py`: JWT, Hashing, and Role-Based Access Control logic.
- `/backend/services/`: Core logic for ML, Blockchain, and Gemini integration.
- `/backend/routes/`: API endpoint definitions grouped by resource.

### API Route Reference

| Method | Path | Controller | Request Body | Response JSON | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **POST** | `/auth/register` | `auth.register` | `{email, password, role, hospital}` | `{message, id}` | Creates a new user. |
| **POST** | `/auth/login` | `auth.login` | Form Data: `username, password` | `{access_token, role, email}` | Issues a 24h JWT token. |
| **GET** | `/dashboard/stats` | `dashboard.get_stats` | None | `{total, manipulated, daily_data, ...}` | Aggregated stats for the UI charts. |
| **POST** | `/predict/single` | `predict.predict_single` | `TrialRecord` (13 features) | `{verdict, reasoning, data_hash, tx_hash}` | Runs ML + Gemini + Blockchain on one record. |
| **POST** | `/predict/batch` | `predict.predict_batch` | `List[TrialRecord]` | `{batch_count, results: []}` | Bulk processing for CSV uploads. |
| **GET** | `/records` | `records.list_records` | Query: `page, decision, risk` | `{total, records: []}` | Paginated list of trial submissions. |
| **GET** | `/audit` | `audit.get_audit` | Query: `page` | `{total, logs: []}` | Immutable trail of system actions. |
| **POST** | `/mentor/chat` | `mentor.chat` | `{message, context_record?}` | `{answer}` | Conversational AI for clinical guidance. |

---

## 🌐 Frontend Structure & Pages

The frontend is located in `/frontend-v2`. It uses **CSS Modules** for styling and **Axios** with interceptors for auth.

### Pages Reference

| URL Path | File Path | API Dependencies | Visibility / Purpose |
| :--- | :--- | :--- | :--- |
| `/login` | `src/app/login/page.js` | `POST /auth/login` | Entry point. Handles JWT storage in sessionStorage. |
| `/register` | `src/app/register/page.js` | `POST /auth/register` | Account creation for admins/investigators. |
| `/dashboard` | `src/app/dashboard/page.js` | `GET /dashboard/stats` | Main landing. Shows ApexCharts and alert cards. |
| `/check` | `src/app/check/page.js` | `POST /predict/single` | Manual entry form with live vitals preview. |
| `/upload` | `src/app/upload/page.js` | `POST /predict/batch` | Drag & drop CSV uploader for large datasets. |
| `/results` | `src/app/results/page.js` | `GET /records` | Unified database view with expanding details. |
| `/audit` | `src/app/audit/page.js` | `GET /audit` | Admin-only trail with PolygonScan verify links. |

---

## 💾 MongoDB Schemas

ClinicalGuard uses three core collections in MongoDB:

### 1. `users`
Stores authenticated users and roles.
- `email`: (String, unique)
- `hashed_password`: (String)
- `role`: (Enum: admin, investigator, monitor, regulator)
- `hospital`: (String)
- `site_id`: (String)
- `created_at`: (DateTime)

### 2. `trial_records`
Stores every prediction outcome and blockchain reference.
- `trial_id`: (String)
- `site_id`: (String)
- `record`: (Nested object with 13 physiological features)
- `ml_result`: `{verdict, decision, confidence_authentic, risk_level}`
- `gemini_reasoning`: (Long string for UI display)
- `blockchain`: `{data_hash, tx_hash, network, committed: bool}`
- `status`: (String: COMMITTED | REJECTED | PENDING_REVIEW)

### 3. `audit_logs`
Automated trail of critical events.
- `action`: (Enum: MANIPULATION_DETECTED, SFO_AUTO_DETECTED, COMMIT)
- `record_id`: (ObjectId reference)
- `risk_level`: (Enum: HIGH, MEDIUM, LOW)
- `timestamp`: (DateTime)
- `tx_hash`: (String, Polygon Transaction ID)

---

## 🔄 End-to-End Data Flow Example

**Scenario: Investigator submits a suspicious record via `/check` page.**

1.  **Frontend**: User fills form. `SingleCheckPage` calculates `health_risk_score` live. On submit, it calls `api.post('/predict/single', data)`.
2.  **Backend (Auth)**: JWT interceptor verifies token and extracts `user_id`.
3.  **Backend (Logic)**:
    - `hash_service` generates a unique SHA-256 fingerprint of the raw vitals.
    - `ml_service` predicts `Manipulated` with 88% confidence.
    - `gemini_service` generates a natural language explanation of *why* it was flagged.
    - `blockchain_service` anchors the SHA-256 hash to Polygon for immutability.
4.  **Database**:
    - Record is saved to `trial_records`.
    - A corresponding entry is created in `audit_logs` because it's high risk.
5.  **Response**: Frontend receives the full result and `ResultCard` displays a pulsing red alert and a "Download PDF" button.
