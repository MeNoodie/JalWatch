# JalWatch Delhi — Citizen-Powered Water Intelligence

**Track 02 — Heat and Water**

Turn scattered citizen water complaints into a live geographic picture of emerging problems in Delhi, enabling response teams to visualize clusters and prioritize investigations with evidence-backed AI.

---

## Architecture & Technology Stack

- **Frontend:** React + Vite + TypeScript, Leaflet + React-Leaflet, modern responsive styling.
- **Backend:** Python + FastAPI + Pydantic + SQLAlchemy.
- **Analytics:** scikit-learn DBSCAN (Haversine metric) for deterministic spatial-temporal clustering.
- **AI Agent:** AWS Strands Agents SDK (`strands-agents`) & LangChain with narrow, read-only tools.
- **Storage:** Local SQLite (development) / RDS PostgreSQL (cloud deployment).

---

## Local Development Quickstart

### Prerequisites
- Python 3.10+
- Node.js LTS (v18+)

### 1. Backend Setup
```bash
cd backend
# Using uv or python venv:
d:\hackathon\JalWatch\Scripts\activate
uvicorn app.main:app --reload --port 8000
```
API Documentation will be live at `http://localhost:8000/docs` and Health Check at `http://localhost:8000/health`.

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Frontend will be live at `http://localhost:5173`.

---

## Phased Build Status
- [x] **Phase 0: Bootstrap & Architecture Skeleton**
- [x] **Phase 1: Complaint Vertical Slice & Citizen Portal**
- [ ] **Phase 2 & 3: Government Operations Dashboard & Master Map**
- [ ] **Phase 4: Spatial Analytics & DBSCAN Hotspot Engine**
- [ ] **Phase 5: Strands / LangChain AI Investigation Agent**
- [ ] **Phase 6: Incident Management Loop & Demo Hardening**
- [ ] **Phase 7: AWS Cloud Deployment & Live Verification**
