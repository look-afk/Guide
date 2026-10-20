# SamduProgress — AI Problem Solving & Life Predictive Analytics Platform

An intelligent, high-performance web platform for competitive programmers, lyceum/university students (inspired by samdu2al.uz exact sciences), and self-directed learners to import problem banks, log daily progress journals, and leverage AI predictive analytics to forecast goal completion and sustain peak consistency.

### User Review & Critical Decisions

> [!IMPORTANT]
> Please review the confirmed choices and architecture below before proceeding to implementation:

- **Confirmed Decision 1 (Problem Ingestion)**: The AI problem scraper/importer allows users to enter any website URL (such as `samdu2al.uz`, LeetCode, Codeforces, or university contest links) or paste text problem sets; Gemini parses, categorizes, tags, and registers them directly into the personal Firestore problem bank. A rich initial bank of SamDU-style exact science problems (Informatics, Algorithms, Math) is pre-seeded for immediate use.
- **Confirmed Decision 2 (Daily Check-in & AI Reflection)**: Every day, the user marks completed/attempted problems and writes an open-ended reflection ("what I did, what I couldn't do, how my day went"). Gemini analyzes the reflection to evaluate learning velocity, identify blockers, update predictive life metrics, and deliver actionable coaching advice.
- **Confirmed Decision 3 (Full-Spectrum Predictive Analytics)**: The dashboard features a multi-tiered predictive analytics engine—starting with accessible circular radial gauges (Goal Completion Rate, Velocity Pacing, Streak Momentum) and advancing to deep statistical projections (Monte Carlo target date forecast, burnout risk meter, concept memory retention decay curve, and weekly problem velocity trend).
- **Confirmed Decision 4 (Google Calendar & Firebase Integrations)**: Built-in 1-click scheduling for study blocks on Google Calendar via the Google Workspace API and secure Google Sign-in with Firestore persistence.

---

### 1. Overview & Core Concept

- **What It Does**: SamduProgress transforms unstructured problem-solving into a data-driven personal development trajectory. Users define long-term goals (e.g., "Solve 150 Exact Science & Algorithm problems before finals/olympiads"), load problem banks from target websites via Gemini AI extraction, perform daily check-ins with natural-language journals, and view predictive forecasts of when they will hit their targets.
- **Target Audience / Persona**: Students of academic lyceums (such as SamDU 2-Academic Lyceum), competitive programming enthusiasts, STEM scholars, and autodidacts who want accountability, gamification, and statistical forecasting for their daily grind.
- **Key Value**: Bridges the gap between passive problem lists and active execution by combining AI journaling feedback, predictive completion modeling, and real calendar scheduling to eliminate burnout and maintain motivation.

---

### 2. User Experience & Visual Design

Following the **SaaS & Dashboard Design Guidelines**:

- **Key User Flows**:
  1. *Onboarding & Goal Initialization*: User defines target goal (problem count, target deadline, daily study target in problems & hours, primary track: Algorithms, Math, Informatics, or Custom).
  2. *Problem Bank & AI Ingestion*: User browses preloaded problems or clicks "Import via AI" to provide a source URL (e.g. `samdu2al.uz/problems`) or raw contest text; Gemini extracts structured problem cards with difficulty, topics, constraints, and sample tests.
  3. *Daily Check-In & Journal*: User opens the daily modal/drawer, ticks problems solved/attempted today, logs time spent, and types natural reflections. One click submits to Gemini for real-time analysis, extracting sentiment, productivity rating, and recommendations.
  4. *Predictive Analytics Dashboard*: High-level visual telemetry with circular SVG rings and detailed projection cards (Monte Carlo completion date probability, burnout risk index, memory retention decay curve).
  5. *Calendar & Routine Sync*: User clicks "Schedule Study Block in Google Calendar" to insert a dedicated problem-solving focus block into their Google Calendar with user confirmation.
  6. *Achievements & Streaks*: Users unlock real-time achievement badges ("First Blood", "Streak Master", "Algorithm Titan", "Centurion") with celebratory visual feedback.

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Dark slate technical dashboard with crisp typography, restrained emerald and amber status accents, and zero AI-slop (no pill sandwiches, no arbitrary scoreboards, no floating cards inside cards).
  - *Color Palette*:
    - Canvas: Deep Slate (`#0B0F17`) and Dark Surface (`#111827`)
    - Hairline Borders: Neutral Dark Border (`#1F2937`)
    - Typography: Crisp Light Text (`#F9FAFB`) and Secondary Muted (`#9CA3AF`)
    - Accents: Emerald (`#10B981`) for active/completed, Cyan (`#06B6D4`) for AI insights, Amber (`#F59E0B`) for deadlines/warnings, Indigo (`#6366F1`) for calendar events.
  - *Typography*: Clean contemporary sans (`Plus Jakarta Sans` / `DM Sans`) paired with monospace tabular figures (`font-mono tabular-nums`) for all counts, percentages, and dates.
  - *Top Bar Contract*: 3-zone header: Brand Wordmark (`SamduProgress`) — Navigation tabs (`Dashboard`, `Problem Bank`, `Daily Journal`, `Analytics`, `Achievements`) — 1 Primary Action (`Log Today` / Google Auth Profile).

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: AI Problem Ingestion via Server-Side Gemini 3.8 Flash**
  - *Chosen Approach*: Server route `/api/ai/import-problems` accepts URLs or raw problem text, and uses `gemini-3.8-flash` with structured JSON schema (`responseSchema`) to output normalized problem objects.
  - *Why*: Allows seamless import from arbitrary competitive programming links or lyceum problem sheets without brittle static HTML parsers.
  - *Fallback*: If external fetch is restricted or offline, user can paste problem text/HTML directly, and a built-in pre-populated catalog of 30+ curated SamDU exact science problems is always accessible.

- **Decision 2: Dual-Persistence Architecture (Firestore + Offline Resilient Store)**
  - *Chosen Approach*: Firestore with Google Sign-in as the primary collaborative/synced cloud store, backed by an immediate reactive local cache so the app is instantly usable both before and after signing in.
  - *Why*: Guarantees zero friction for instant testing, while fully meeting the requirement for Firebase Auth and persistent cloud data.

- **Decision 3: Multi-Tiered Predictive Engine**
  - *Chosen Approach*:
    - *Tier 1 (Radial Visuals)*: Radial SVG meters for Daily Target completion %, Streak Health index, and Overall Goal Completion.
    - *Tier 2 (Statistical Forecasting)*: Linear & Monte Carlo simulation predicting Estimated Finish Date under optimistic, realistic, and conservative velocities.
    - *Tier 3 (Burnout & Retention)*: Moving 7-day cognitive load vs. rest ratio calculation + Ebbinghaus-inspired retention decay alerts for solved concepts.
  - *Why*: Fulfills the user's specific request for "starting with some round one and ending with kind of hard one".

---

### 4. Technical Architecture & Data Strategy *(Technical Reference)*

```
┌────────────────────────────────────────────────────────────────────────┐
│                          SamduProgress Client                          │
├────────────────────────────────────────────────────────────────────────┤
│  Top Navigation (Brand · Nav Tabs · Auth Status & "Log Today" CTA)     │
├───────────────────┬────────────────────────────────────────────────────┤
│ Left Control Bar  │ Main Content Area                                  │
│ · Active Goal     │ ┌────────────────────────────────────────────────┐ │
│ · Streak Counter  │ │ View: Dashboard / Problems / Journal / Stats   │ │
│ · Pacing Tracker  │ ├────────────────────────────────────────────────┤ │
│ · Calendar Sync   │ │ Predictive Gauges · Monte Carlo Projections   │ │
│ · Quick Stats     │ │ Problem Bank (Filters, Topics, Solve Toggles)  │ │
│                   │ │ AI Journaling Drawer & Feedback Stream         │ │
│                   │ └────────────────────────────────────────────────┘ │
└───────────────────┴────────────────────────────────────────────────────┘
         │                                       │
         ▼                                       ▼
 ┌─────────────────────────┐           ┌──────────────────────────────┐
 │ Express Server API      │           │ Client Google Workspace Flow │
 │ · /api/ai/import        │           │ · Firebase Auth Popup        │
 │ · /api/ai/analyze-log   │           │ · Google Calendar API        │
 │ · /api/ai/predictions   │           │   (Insert Study Block)       │
 └─────────────────────────┘           └──────────────────────────────┘
         │                                       │
         ▼                                       ▼
 ┌─────────────────────────┐           ┌──────────────────────────────┐
 │ Gemini 3.8 Flash SDK    │           │ Firestore Database           │
 │ (Server-Side GenAI)     │           │ · /users/{uid}/goals         │
 │                         │           │ · /users/{uid}/problems      │
 │                         │           │ · /users/{uid}/daily_logs    │
 │                         │           │ · /users/{uid}/achievements  │
 └─────────────────────────┘           └──────────────────────────────┘
```

#### Data Entities & Collections

- `Goal`: `{ id, title, targetProblems, targetDate, dailyTargetProblems, dailyTargetHours, primaryTrack, createdAt }`
- `Problem`: `{ id, source, problemCode, title, category, difficulty, statement, tags, solved, solvedAt, notes }`
- `DailyLog`: `{ id, date, reflectionText, solvedProblemIds, hoursSpent, aiFeedback, sentiment, velocityScore, createdAt }`
- `Achievement`: `{ id, title, description, icon, unlocked, unlockedAt, progress, maxProgress }`
- `PredictiveStats`: `{ projectedCompletionDate, daysRemaining, requiredDailyVelocity, burnoutRiskScore, retentionAlerts, confidenceInterval }`
