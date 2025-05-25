0. Meta  
• Status: Draft – May 2025  
• Author: Daniel (single-developer)  
• Target runtime: local dev box, calls out to Vertex-AI & Gemini APIs on GCP credits  
• Deployment: Docker-compose → Cloud Run via GitHub Actions (future)


1. Purpose
Build a local web application that lets a clinician / researcher upload a patient’s medical-imaging studies over time and receive AI-generated insights.  
Core idea:  
IMG ➜ MedGemma-4B-IT → raw slice captions  
CAPTIONS ➜ MedGemma-27B-Text-IT → per-study summary  
ALL SUMMARIES (+ patient demo + chronology) ➜ Gemini-2.5-Pro-Preview → holistic report `{findings, impression, next_steps}` (+ optional codes).  
Focus = working demo for PhD proposal; no external users, no formal compliance yet.


2. In / Out of Scope
IN  
• Single-tenant dashboard  
• CRUD: patient, study, image  
• Image preprocessing to 896² JPEG  
• Automatic captioning + summaries + report  
• Horizontal timeline UI  
• Hard-delete data  
OUT  
• Multi-tenant, auth, billing  
• PACS / FHIR integration  
• Fine-tuning models  
• Mobile app  
• Real-time SLA / scaling


3. Personas
• Clinician / Researcher (role = “user”, full rights)  
  – Create patient, upload imaging, read & copy report, delete patient.  
• *Admin* == same user for MVP.


4. User Flows (happy path)

UF-1  “Add Patient”  
 1. Click “New Patient” → modal  
 2. Enter Name, Age, Sex, optional MRN & ReasonForImaging  
 3. Save → lands on empty Patient Timeline

UF-2  “Upload Study”  
 1. From patient page click “Upload Imaging”  
 2. Drag-drop files (supports multi-frame DICOM or JPEG)  
 3. Enter: Title/Caption (string), Imaging-DateTime (default = now, user-editable)  
 4. Click “Process”  
    a. Back-end converts each file → 896×896 centre-crop JPEG  
    b. Each slice -> MedGemma-4B-IT → sliceCaption  
    c. Slice captions aggregated → seriesCaption (string list)  
    d. seriesCaption → MedGemma-27B-Text-IT → seriesSummary (concise paragraph)  
    e. Persist: JPEG(s), seriesSummary, raw JSON  
 5. Timeline card appears (thumbnail + date)

UF-3  “Generate / Refresh Report”  
 1. Click “Generate Report” (patient page)  
 2. Back-end collects patient demo + ordered seriesSummaries  
 3. Build prompt → Gemini-2.5-Pro-Preview  
 4. Store full Gemini response JSON  
 5. Render:  
     • Findings  
     • Impression  
     • Next Steps  
     • (checkbox “include codes” → adds `icd10_codes`, `snomed_codes` arrays)  

UF-4  “Delete Patient”  
 1. Click “Delete” → confirm modal  
 2. Hard-delete DB rows + GCS objects + cached LLM output


5. Functional Requirements

FR-1 Patient CRUD  
FR-2 Study upload (supports N files; keeps only series-level summary)  
FR-3 Automatic image processing (resize, centre-crop)  
FR-4 MedGemma-4B captioning per slice  
FR-5 MedGemma-27B summarisation per study  
FR-6 Gemini holistic report generation  
FR-7 Timeline UI, horizontal scroll, newest → rightmost  
FR-8 Optional checkbox “Return ICD-10 / SNOMED codes”  
FR-9 Hard delete capability  
FR-10 Local run script + .env for keys


6. Non-Functional Requirements

NFR-1 Latency ≤ 30 s for “Upload → Study ready” (dev target)  
NFR-2 No concurrency expectation (>1 user)  
NFR-3 Store only 896² JPEG & JSON (no raw DICOM)  
NFR-4 All secrets via .env; no keys committed  
NFR-5 Basic error handling: retry LLM call 1×, surface toast on fail


7. Data Model (Postgres)

patient  
• id UUID PK  
• name TEXT  
• age INT  
• sex ENUM(‘M’,’F’,’Other’)  
• mrn TEXT NULL  
• reason TEXT NULL  
• created_at TIMESTAMP  

study  
• id UUID PK  
• patient_id FK  
• title TEXT              -- user-entered caption  
• modality TEXT NULL      -- optional (“CT”, “MRI”, …)  
• imaging_datetime TIMESTAMP  
• series_summary TEXT     -- output of 27B  
• include_codes BOOL  
• gemini_json JSONB NULL  -- last holistic roll-up snapshot if generated at study level  
• created_at TIMESTAMP  

image  
• id UUID PK  
• study_id FK  
• gcs_url TEXT  
• slice_index INT  
• slice_caption TEXT       -- raw 4B caption  
• created_at TIMESTAMP  

report  
• id UUID PK  
• patient_id FK  
• gemini_json JSONB        -- {findings, impression, next_steps, codes?}  
• created_at TIMESTAMP  


8. Model Pipeline Specs

STEP-0 preprocessing  
```
ffmpeg/dcm2jpeg → pillow → centre-crop → 896×896 PNG/JPEG
```

STEP-1 slice_caption  
```
POST /v1/projects/…/locations/…/publishers/google/models/medgemma-4b-it:predict
input = base64(image)
```

STEP-2 series_summary  
```
Prompt template to 27B:
"Given the following slice descriptions, produce a concise
study-level summary …"
max_tokens=512
```

STEP-3 holistic_report  
```
Prompt ⬇︎
SYSTEM: You are an expert radiologist…
USER: 
{
  patient_demo: {name, age, sex, reason},
  studies: [
    {title, date, summary},
    …
  ],
  requested_schema: {
     findings: string,
     impression: string,
     next_steps: string,
     icd10_codes?: string[],
     snomed_codes?: string[]
  }
}
Return JSON exactly in requested_schema.
```
Call model `gemini-2.5-pro-preview-05-06`.


9. API / Service Boundaries

frontend  (Next.js + shadcn/ui)  
backend   (Next.js API-routes or tRPC)  
└─ GCS Bucket  `gs://patient-timeline-dev`  
└─ Vertex Invoke 4B & 27B  
└─ GenerativeAI REST (Gemini)  
DB       Cloud SQL Postgres (or local Docker Postgres)  


10. UI Wireframe (ASCII)

[Dashboard] ───────────────────────────────────────────
| + New Patient | Search 🔍                       |
| Recent (last 6)                                 |
|  [Card] [Card] [Card] …                         |
───────────────────────────────────────────────────────

[Patient: John D] ────────────────────────────────────
| Demo | Age 65 M  | Reason: “poss lung ca” |
| Upload Imaging 📤 | Generate Report 📝 |
───────── horizontal timeline (scroll L⇄R) ───────────
| ◀─  Jan | 10 Feb | 22 Feb | 05 Mar | ➜         |
--------------------------------──┘ click card → drawer
Drawer:  
[image gallery]      |  Study Summary (27B)           |
                     |  ICD/SNOMED (if asked)         |
————————————————————————————————————————————
Holistic Report (Gemini JSON rendered) below timeline.


11. Tech Stack

Frontend   Next.js 15 + shadcn/ui + Tailwind  
Backend    Next.js route handlers (tRPC ready)  
DB         Postgres (local docker or Cloud SQL)  
Storage    Google Cloud Storage  
CI/CD      GitHub Actions → `docker build` → Cloud Run  
LLMs       Vertex AI: medgemma-4b-it, medgemma-27b-text-it  
           Generative AI: gemini-2.5-pro-preview-05-06  


12. Acceptance Criteria (MVP)

AC-1 Create ≥1 patient without error  
AC-2 Upload CT series (multi-frame DICOM) → study card appears within 30 s with summary  
AC-3 Deleting patient removes DB rows & GCS objects  
AC-4 “Generate Report” returns valid JSON & renders to UI  
AC-5 Optional checkbox toggles presence of `icd10_codes` in JSON  
AC-6 Timeline scroll works; clicking card reveals drawer  
AC-7 No uncaught exceptions in dev console  

13. Open / Future Items

• Authentication / RBAC  
• PACS query-retrieve, FHIR-export  
• Multi-tenant & GDPR consent flows  
• Performance tuning (batch slice captions)  
• Fine-tune models on private dataset  
• External clinical validation / IRB  

