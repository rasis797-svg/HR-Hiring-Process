# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

채용매칭 (Recruitment Matching) — a single-file, zero-dependency Korean HR tool for matching resumes against job design sheets using Google Gemini AI. There is no build step, no package manager, and no server. Open `index.html` directly in a browser.

## Running the App

```powershell
Start-Process "C:\Users\WS\Desktop\이력서 검토\index.html"
```

Or double-click `index.html`. No localhost server needed.

## File Structure

| File | Purpose |
|------|---------|
| `index.html` | Primary file — all CSS, HTML, and JS in one file (~2300 lines). Active development version. Default model: `gemini-2.5-flash`. |
| `gemini (1).html` | Earlier version. Default model: `gemini-2.0-flash`. JSON parsing differs slightly. |
| `index - 복사본.html` | Backup copy. |

All state is in-memory (JavaScript arrays). There is no persistence — data resets on page reload.

## Architecture

The app is a single HTML file with three logical sections:

### 1. CSS (lines 8–174)
Utility-first inline styles. Color palette: `#333` (primary), `#2a9a50` (green/success), `#e07000` (orange/warning), `#cc3333` (red/danger). Score coloring uses `.high/.mid/.low` classes on `.score-bar-fill`.

### 2. HTML (lines 176–1680 approx.)
Single-page app structure. Login screen (`#auth-screen`) and main app (`#app-screen`) are toggled via `display:none`. Pages inside `.main` are shown/hidden by `nav(pageId)` which toggles `.active` class.

**Pages (nav IDs):**
- `dashboard` — stat cards + recent activity
- `positions` — table of positions derived from `sheetsData`
- `sheets` / `sheets-new` / `sheet-detail` / `sheet-history` — CRUD for design sheets
- `matching` / `matching-upload` / `match-result` — resume upload and scoring
- `reports` / `report-detail` — interview question reports
- `admin` / `account` — user management and settings

### 3. JavaScript (lines ~1680–2302)

**In-memory data stores:**
```js
let sheetsData   = [];  // job design sheets
let matchingData = [];  // uploaded resumes + analysis results
let reportsData  = [];  // (reserved)
let auditData    = [];  // audit log entries
```

**Key global state:**
```js
let apiKey    // Gemini API key (persisted in localStorage: 'wm_api_key')
let aiModel   // Model name (persisted in localStorage: 'wm_ai_model')
let currentSheetIdx   // index into sheetsData for the open sheet
let currentMatchIdx   // index into matchingData for the open match result
```

**Core flow — resume analysis:**
1. `submitResumeUpload()` — collects applicant name, position, resume text/file → pushes to `matchingData`
2. `openMatchResult(idx)` — decides analysis path:
   - If `apiKey` + sheet + text → `analyzeWithAI()` → `convertAiResult()`
   - Else → `analyzeResumeAgainstSheet()` (keyword matching)
   - Falls back to `fallbackAnalysis()` when either is missing
3. `renderMatchResultBody()` — injects HTML into `#mr-body`

**AI integration (`callGeminiAPI`):**
- Calls `https://generativelanguage.googleapis.com/v1beta/models/${aiModel}:generateContent?key=${apiKey}`
- Always requests `responseMimeType: "application/json"` and `temperature: 0.2`
- `analyzeWithAI()` returns a structured JSON with `scores.f1–f6`, `overall`, `feedback_positive/negative`, `strengths`, `gaps`, `interview_questions`
- F6 (결정적 무기 / "decisive weapon") has **2× weighting** in the overall score

**Design sheet fields (f1–f6):**
- f1: 역량 레벨 (competency level)
- f2: 역할 범위 (role scope)
- f3: 필수 지식/기술 (required skills)
- f4: 폐기/자동화 업무 (deprecated tasks)
- f5: 효율 증대 업무 (efficiency tasks)
- f6: 결정적 무기 (decisive weapon — highest weight)

**DOCX parsing:** Uses `mammoth.js` (CDN) to extract text from `.docx` uploads. Both design sheets and resumes support file upload.

**Login:** `doLogin()` accepts hardcoded demo credentials (`admin@company.com / admin123`) or any non-empty input depending on the version. No real auth.

## What `gemini (1).html` Fixes

Compared to `index.html`, `gemini (1).html` has more robust JSON parsing in `analyzeWithAI()` — it strips markdown code fences before `JSON.parse`, whereas `index.html` uses a simpler `/\{[\s\S]*\}/` regex match.
