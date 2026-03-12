# ClinicalGuard | Startup & Execution Guide

This document provides the exact steps to run the ClinicalGuard Data Integrity Platform.

## 📂 Project Structure
- **Root Directory**: `c:\Users\ASUS\Desktop\Projects\Sailesh SIr\ClinicalGuard`
- **Backend**: `/backend` (FastAPI)
- **Frontend**: `/frontend-v2` (Next.js 14)

---

## 🛠️ Prerequisites
1. **Python 3.10+** (Virtual environment recommended)
2. **Node.js 18+**
3. **MongoDB** (Running and accessible via the URI in `backend/.env`)

---

## 🚀 Running the Backend

### 1. Fix Port Conflict (If Error 10013 occurs)
If you see `[WinError 10013]`, it means port 8000 is likely blocked by a ghost process. Run this in PowerShell as Administrator to clear it:
```powershell
Stop-Process -Name python -Force -ErrorAction SilentlyContinue
Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

### 2. Start the Server
Navigate to the **root directory** and run:
```powershell
# 1. Activate venv
.\venv\Scripts\Activate.ps1

# 2. Start Uvicorn
uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```
> [!NOTE]
> The backend MUST be on port 8000 for the frontend to connect correctly.

---

## 🌐 Running the Frontend

Navigate to the `frontend-v2` directory in a **new terminal**:
```powershell
cd frontend-v2

# 1. Install dependencies (First time only)
npm install --legacy-peer-deps

# 2. Run in development mode
npm run dev
```
The application will be available at [http://localhost:3000](http://localhost:3000).

---

## 🧪 Testing Credentials
- **Default Email**: `praj@gmail.com`
- **Default Password**: `prajwal`
- **Demo Mode**: Click the **"Try Demo"** button on the login screen to explore with mock data.

## 📊 CSV Data Requirements (Batch Upload)

For the **Batch Upload** feature to work, your CSV file MUST contain the following 15 columns (Order does not matter, but names must match exactly):

| Column Name | Description | Example Value |
| :--- | :--- | :--- |
| `trial_id` | Metadata: Trial Identifier | `TR-104` |
| `site_id` | Metadata: Facility Identifier | `SITE_01` |
| `age` | Patient Age | `45` |
| `bp_systolic` | Systolic Blood Pressure | `120` |
| `bp_diastolic` | Diastolic Blood Pressure | `80` |
| `glucose` | Blood Glucose Levels | `105` |
| `hr` | Heart Rate (BPM) | `72` |
| `spo2` | Oxygen Saturation (%) | `98` |
| `diagnosis_encoded` | 0:COPD, 1:DM, 2:HTN, 3:Tachy, 4:None | `4` |
| `previous_trials` | Count of past trial participation | `1` |
| `product_experience` | 1 if Yes, 0 if No | `1` |
| `last_trial_outcome` | 1 if Success, 0 if Adverse | `1` |
| `health_risk_score` | Aggregated Risk (Calculated) | `0.35` |
| `age_grp_adult` | 1 if age 18-59, else 0 | `1` |
| `age_grp_elderly` | 1 if age 60+, else 0 | `0` |

> [!IMPORTANT]
> **SFO Detection Rule**: If `health_risk_score` is set to `0.00` while physiological data (BP, Glucose, HR) is high/normal, the system will flag the record as **MANIPULATED** (Selective Field Omission).

### 📁 Generated Sample
I have created a sample file for you here: [sample_batch_upload.csv](file:///c:/Users/ASUS/Desktop/Projects/Sailesh%20SIr/ClinicalGuard/sample_batch_upload.csv)
