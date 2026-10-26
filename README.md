# ContextGuard — Context-Aware Data Privacy MVP

> **Hackathon prototype** built for demo evaluation. Not a production security platform.
> All detection uses deterministic heuristics clearly labelled in the UI.

## Quick start

### 1. Backend (FastAPI + Python 3.10+)

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Health check: http://localhost:8000/api/health  
API docs: http://localhost:8000/docs

### 2. Frontend (React + Vite)

```bash
cd frontend
npm install        # or: pnpm install
npm run dev
```

App: http://localhost:5173

### 3. Run backend tests

```bash
cd backend
python -m pytest tests/ -v
```

---

## Project structure

```
context_Shield/
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI app + API endpoints
│   │   ├── schemas.py        # Pydantic request/response models
│   │   └── services/
│   │       ├── detection.py      # PII / entity detection (regex heuristics)
│   │       ├── classification.py # Context classification (rule-based)
│   │       ├── policy.py         # Role-aware policy engine
│   │       ├── redaction.py      # Span-safe text sanitization
│   │       └── evaluation.py     # Test suite + metric calculation
│   ├── tests/
│   │   └── test_contextguard.py  # 53 pytest tests
│   └── requirements.txt
└── frontend/
    └── src/
        ├── App.tsx           # Main application (all pages)
        ├── services/api.ts   # Backend API client
        └── types/index.ts    # TypeScript type definitions
```

## API surface

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/health | Service health |
| GET | /api/policies | List policy rules |
| PUT | /api/policies/{rule_id} | Update a rule's default action |
| POST | /api/scan | Scan and protect a prompt |
| GET | /api/audit | In-memory audit log |
| POST | /api/evaluate | Run evaluation suite |

## Known limitations

- Detection uses rule-based heuristics, not a trained ML classifier. Clearly labelled in the UI.
- Audit log is in-memory; restarts clear all records.
- Person name detection relies on title-cased patterns and will have false positives on proper nouns.
- The ambiguous scenario ("compensation was revised upward") is correctly detected via contextual keyword matching, not semantic NLP.

## Next three improvements for production

1. **Integrate a real NLP model** (spaCy NER or a fine-tuned transformer) for robust person-name and contextual compensation detection — replace heuristic rules with a trained classifier.
2. **Persistent SQLite audit store** with proper schema migrations, so audit records survive restarts and can be queried with date ranges, exported, and retained per compliance policy.
3. **Real authentication and RBAC** — replace the simulated role dropdown with an identity provider (OIDC/OAuth2), issue signed JWTs, and validate role claims server-side before applying policy decisions.

