# CLINICALGUARD_TEST_SUMMARY

## 1. System Overview
- **Stack:** Backend is FastAPI + MongoDB (Motor) + Scikit-learn + Gemini Flash + Web3.py. Frontend is Next.js 14 App Router + pure CSS Modules.
- **Data Flow:** Clinical trial data passes through local client-side validation → `/predict/single` or `/predict/batch` → SHA-256 Hash Pre-check (SFO Detection) → ML Decision Tree Prediction → Gemini Prompting → Polygon Smart Contract anchor → MongoDB `trial_records`.
- **RBAC Matrix:** 4 Roles (`admin`, `investigator`, `monitor`, `regulator`). Admins/Investigators can upload records. Monitors/Regulators have strict read-only audit access. Enforced via JWT claims and Next.js middleware routing overrides.
- **Proxy Architecture:** Local CORS issues (due to LRU cached config) have been entirely bypassed. The frontend now exclusively utilizes a Next.js `rewrites()` proxy mapping `/api/*` → `http://127.0.0.1:8000/*` eliminating cross-origin browser network errors natively.

## 2. Route-by-Route Status (Backend)
| Method | Path | Status | Notes | Collections Used |
|---|---|---|---|---|
| POST | `/auth/register` | PASS | Handled duplicate emails with 409 natively. Hashes w/ bcrypt. | `users` |
| POST | `/auth/login` | PASS | Returns JWT strictly. Handled false payloads via 401 correctly. | `users` |
| GET | `/dashboard/stats` | PASS | Correctly aggregates ML integrity decisions globally. | `trial_records` |
| POST | `/predict/single` | PASS | Pipeline: SFO -> ML -> Gemini -> Web3 -> MongoDB | `trial_records`, `audit_logs` |
| POST | `/predict/batch` | PASS* | **FIXED:** Changed to accept `multipart/form-data` (CSV via UploadFile). Replaced legacy JSON array schema. | `trial_records`, `audit_logs` |
| GET | `/records` | PASS | Standard pagination filtering by ML verdict/risk logic intact. | `trial_records` |
| GET | `/audit` | PASS | Working effectively filtering `HIGH` risk flags and SFO overrides. | `audit_logs` |
| POST | `/mentor/chat` | PASS* | **FIXED:** Corrected MongoDB query path from `result.data_hash` to `blockchain.data_hash` for context loads. | `trial_records` |

## 3. Page-by-Page Status (Frontend)
| URL Path | Status | Notes | Main APIs |
|---|---|---|---|
| `/login` | PASS* | **FIXED:** Bypassed Axios interceptor race condition using native fetch. | `/api/auth/login` |
| `/register` | PASS | Standard React-controlled component validation intact. Success redirects. | `/api/auth/register` |
| `/dashboard` | PASS | Renders dynamic cards based on `/dashboard/stats` properly. | `/api/dashboard/stats` |
| `/check` | PASS | Generates ResultCard successfully. | `/api/predict/single` |
| `/upload` | PASS* | **FIXED:** Stripped broken React array rendering of FastAPI 422 HTTP exceptions, preventing the app crash. | `/api/predict/batch` |
| `/results` | PASS | Lists transactions and hash keys cleanly. | `/api/records` |
| `/audit` | PASS | Table displays blockchain tx anchor points consistently. | `/api/audit` |
| `Mentor API` | PASS* | **FIXED:** Linked `ResultCard` to global floating `MentorAI` using Window Events to pass record context. | `/api/mentor/chat` |

## 4. Auth & Security
- **What works:** The JWT Token is strictly stored in `sessionStorage` mitigating broad XSS leakage vs local storage. Roles are extracted globally on App context and strictly route guard protected.
- **What is risky:** Secret Keys (`JWT_SECRET`) remain in a plaintext `.env` fallback and need to be strictly mapped to secret managers prior to real-world deployment.  
- **Changes Made:** Hard-rerouted frontend network structure to use native NextJS SSR API rewrites. The system is inherently safer as the Node.js server executes requests silently. 

## 5. Data Integrity & Blockchain
- **Flow Synthesis:** Single requests verify logic, immediately override with `"SFO_DETECTED"` if a `0.00` health risk score occurs alongside raised vitals, compute a SHA-256 local fingerprint, and submit the ML logic + Fingerprint to the Blockchain. 
- **Edge cases:** The Blockchain stub works natively without crashing the app, gracefully storing mock transactions when the EVM node goes offline.

## 6. Bugs Fixed
- **`backend/routes/predict.py`:** `/predict/batch` expected a Pydantic Array of instances but received a `multipart/form-data` payload containing a CSV from the frontend. Rewrote the endpoint using FastAPI `UploadFile` to parse the raw CSV bytes via `pandas` and process each row through the full single-record pipeline. This completely eliminated the `422 Unprocessable Content`.
- **`frontend-v2/src/app/upload/page.js`:** When a 422 hit, FastAPI returned a detailed dict array list. React attempted to render this Object as a child JSX node, natively crashing the core app process. Fixed by flattening the error tree to a string prior to `setError` updates. 
- **`frontend-v2/next.config.mjs`:** Backend CORS `lru_cache` was aggressively locking domain responses so the Next.js port was being blocked. Completely circumvented the problem utilizing an `async rewrites()` directive forcing all `/api/` traffic natively to 8000 via a proxy. 
- **`backend/routes/mentor.py`:** Standardized `.find_one()` MongoDB lookup filter switching from generic `result.data_hash` to the correct `blockchain.data_hash` path guaranteeing AI context loads successfully. 
- **`frontend-v2/src/components/ResultCard.js`:** Added a specific Event Listener custom event dispatch pushing `record_id` strings to the global AI Mentor context automatically upon clicking "✦ Ask AI" on a generated report card.

## 7. Known Limitations & Next Steps
- **Rate Limiting (Throttle):** The NextJS `rewrites` logic masks user IPs as `127.0.0.1` locally, which limits our ability to do endpoint throttling natively on FastAPI via client IP. Consider passing `X-Forwarded-For` headers locally or within the production reverse proxy.
- **Background processing:** Wait times on single blockchain transactions currently block the HTTP thread. In the future, shift transaction minting directly to a Celery queue asynchronously ensuring 200 responses hit the client almost natively under 50ms instead of waiting for the EVM receipt.
