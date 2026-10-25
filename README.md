# Context_Aware_ai

# 🛡️ ContextShield

**Context-aware data privacy for AI systems.**
ContextShield detects sensitive information based on *context*, not keywords alone, and redacts, restricts or blocks it before it reaches an AI model.

> Hackathon project: **PS 2.2 | Context-Aware Data Privacy**

---

## 📌 Problem

AI systems increasingly process workplace and business data that contains information of different sensitivity levels. Simple keyword-based filtering can fail, because whether information is sensitive depends on its context.

| Same keyword | Text | Correct handling |
|---|---|---|
| password | "Passwords must be 12+ characters." | Allow |
| password | "Admin password is Mx7!qR2z." | Block |
| salary | "Engineer salary bands are on the careers page." | Allow |
| salary | "Anita's salary is being raised to ₹18 lakh." | Redact |

*(Illustrative examples written for this project.)*

## 💡 Solution

ContextShield is a privacy gateway that sits between workplace data and the AI model. It:

1. **Detects** candidate sensitive items (names, IDs, contacts, amounts).
2. **Understands** the surrounding context to decide if they are truly sensitive.
3. **Decides** an action using a risk score, user role and destination.
4. **Protects** the data by allowing, redacting, restricting or blocking it, and logs every decision.

Core idea: `Sensitivity = Entity + Context + Who is asking + Where the data is going`

## ✅ Features

- Context-based detection, not keyword matching alone
- Redaction, masking, role-based restriction and blocking
- Simple dashboard showing detected risks and the action taken
- Audit log of every detection, score and action
- Local models, so raw sensitive text is not sent to third-party services

## 🏗️ How it works

```
Ingest → Detect → Context analysis → Risk score + policy → Action → AI model
(docs,    (regex,    (classifier reads    (score + role +      (allow / redact   (receives
 chats,    validators, surrounding text)   destination)         / restrict /      sanitised
 prompts)  NER)                                                 block)            text only)
```

Every decision is saved to the audit log and shown on the dashboard.

### Risk score

```
Risk = 0.4 × Entity + 0.4 × Context + 0.2 × Exposure
```

Initial weights, to be tuned on validation data.

| Risk score | Action |
|---|---|
| < 0.30 | Allow |
| 0.30 – 0.80 | Redact / mask |
| > 0.80 | Block |

**Worked example:** "Anita's salary is being raised to ₹18 lakh."
Entity 0.7 · Context 0.9 · Exposure 0.5 → 0.4×0.7 + 0.4×0.9 + 0.2×0.5 = **0.74** → **Redact**

Text sent to the AI model: `"[PERSON_1]'s salary is being raised to [AMOUNT_REDACTED]."`

## 🧰 Tech stack

| Layer | Tool / technique |
|---|---|
| Pattern detection | Microsoft Presidio recognizers, regex, checksum validators |
| Entity recognition | spaCy NER, Hugging Face Transformers |
| Context classifier | Fine-tuned transformer (e.g. DistilBERT) |
| Policy engine | Python rules defined in YAML |
| Redaction | Presidio Anonymizer |
| API and interface | FastAPI, Streamlit |
| Audit store | SQLite / PostgreSQL |

## 📁 Project structure (proposed)

```
contextshield/
├── app/
│   ├── api/            # FastAPI endpoints
│   ├── detectors/      # Presidio recognizers, NER, validators
│   ├── context/        # context classifier
│   ├── policy/         # YAML policies + policy engine
│   ├── redaction/      # masking / anonymization
│   └── audit/          # audit log storage
├── dashboard/          # Streamlit UI
├── policies/           # example policy files
├── tests/
├── requirements.txt
└── README.md
```

## 🚀 Getting started

```bash
# 1. Create a virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt
python -m spacy download en_core_web_lg

# 3. Run the API
uvicorn app.api.main:app --reload

# 4. Run the dashboard
streamlit run dashboard/app.py
```

## 🔌 Example usage

```bash
curl -X POST http://localhost:8000/scan \
  -H "Content-Type: application/json" \
  -d '{"text": "Anita'\''s salary is being raised to ₹18 lakh.", "role": "employee", "destination": "ai_assistant"}'
```

Expected response shape (illustrative):

```json
{
  "risk_score": 0.74,
  "context": "Salary of a named person",
  "action": "redact",
  "sanitized_text": "[PERSON_1]'s salary is being raised to [AMOUNT_REDACTED]."
}
```

## 📊 Evaluation

Success is measured with precision, recall and F1 on a labelled test set.

Worked example (hypothetical numbers, to show the method): a test set of 1,000 messages, 200 truly sensitive.

| Metric | Keyword filter | Context-aware (target) |
|---|---|---|
| Flagged | 260 | 190 |
| Correctly flagged (TP) | 120 | 170 |
| False alarms (FP) | 140 | 20 |
| Precision = TP ÷ flagged | 46.2% | 89.5% |
| Recall = TP ÷ 200 | 60.0% | 85.0% |
| F1 score | 0.52 | 0.87 |

> These numbers are hypothetical and only demonstrate the evaluation method.

## 🌍 Why it matters

- IBM's Cost of a Data Breach Report puts the average breach cost in India at ₹19.5 crore (2024), ₹22 crore (2025) and ₹25.5 crore (2026).
- The 2026 report also found shadow AI adds about ₹1.79 crore to the average breach cost.
- India's DPDP Act, 2023 provides for a penalty of up to ₹250 crore for failing to take reasonable security safeguards (Section 8(5)).

## 📈 Scalability

- **Users:** stateless API behind a load balancer; batch scans through a job queue.
- **Locations:** deploy on-premise or in a regional cloud so data stays in region; load a policy pack per regulation.
- **Use cases:** chat assistants, document summaries, email and support logs via pluggable recognizers and policies.

## 🗺️ Roadmap

- [ ] Core detection (patterns + NER)
- [ ] Context classifier
- [ ] Policy engine and redaction
- [ ] Dashboard and audit log
- [ ] Evaluation on a labelled test set
- [ ] Tune risk weights and thresholds

## 📚 Sources

- IBM, *Cost of a Data Breach Report* (India figures, 2024–2026)
- Digital Personal Data Protection Act, 2023 (Schedule, Section 8(5))