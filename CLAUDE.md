# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

채용매칭 (Recruitment Matching) — a Korean HR tool for matching resumes against job design sheets, running interview evaluations, and scheduling. It started as a single-file, zero-dependency prototype but has since grown into a small multi-user web app backed by **Supabase** (Postgres + Auth + Row Level Security) and a few **Vercel serverless functions**. There is still no build step or bundler — the frontend is plain HTML/CSS/JS loaded directly by the browser — but it is no longer a fully static, offline, single-user tool.

## Running the App

The app now depends on `/api/*` serverless functions and a live Supabase project, so opening `index.html` via `file://` will not exercise the full app (auth, AI calls, and user invites all go through `/api/*` or Supabase, which require an HTTP origin). Deploy/serve it (e.g. `vercel dev`, or the actual Vercel deployment) rather than double-clicking the file.

## File Structure

| File | Purpose |
|------|---------|
| `index.html` | Page shell — CSS + HTML markup only (~1765 lines). Loads `mammoth.js`, the Supabase JS SDK, Google Identity Services, then `db.js` and `app.js`. |
| `app.js` | All application logic (~7200 lines): auth, page routing/rendering, resume matching, interview flows, admin, AI calls. |
| `db.js` | Supabase data layer — maps the app's in-memory arrays to normalized Postgres tables (see below). |
| `api/claude.js` | Serverless proxy to the Anthropic API (server holds the key). Requires a valid Supabase session (`Authorization: Bearer <access_token>`). |
| `api/invite-user.js` | Serverless function that invites a new user via Supabase Auth admin API (service role key). Requires the caller to be an authenticated **시스템 관리자** (checked server-side against `app_users`). |
| `api/ai-status.js` | Reports whether a server-side Claude API key is configured. |
| `sql/001_schema.sql`, `002_migrate_app_data.sql`, `003_rls.sql` | Postgres schema, one-time migration off the old `app_data` JSON blob, and RLS policies. See `sql/README.md`. |

## Architecture

### Frontend (`index.html` + `app.js`)

Single-page app. Login screen (`#auth-screen`) and main app (`#app-screen`) are toggled via `display:none`. Pages inside `.main` are shown/hidden by `nav(pageId)` which toggles `.active` class.

**Pages (nav IDs):** `dashboard`, `positions`, `sheets` / `sheets-new` / `sheet-detail` / `sheet-history`, `matching` / `matching-upload` / `match-result`, `reports` / `report-detail`, `admin` / `account`, plus interview scheduling/evaluation pages (core interview, assignment interview results).

**In-memory data stores** (mirrored to Supabase via `db.js`):
```js
let sheetsData    = [];  // job design sheets (→ positions table + children)
let matchingData  = [];  // uploaded resumes + analysis results (→ candidates table + sidecars)
let usersData     = [];  // app_users
let auditData     = [];  // audit_log (append-only)
```

**Auth:** Real auth via Supabase Auth (`sbClient.auth.signInWithPassword`, magic links via `signInWithOtp`). No hardcoded demo credentials. After login, `link_current_user()` (a Postgres RPC, see `sql/003_rls.sql`) links the `auth.users` row to an `app_users` row by email — this must succeed before RLS policies allow any data access.

**Design sheet fields (f1–f6):**
- f1: 역량 레벨 (competency level)
- f2: 역할 범위 (role scope)
- f3: 필수 지식/기술 (required skills)
- f4: 폐기/자동화 업무 (deprecated tasks)
- f5: 효율 증대 업무 (efficiency tasks)
- f6: 결정적 무기 (decisive weapon — 2× weighting in the overall AI score)

**AI integration:** The frontend calls `/api/claude` (not the Gemini/Anthropic API directly), which proxies to Anthropic using a server-side key. Every call must include the caller's Supabase `access_token` in the `Authorization` header — `api/claude.js` rejects requests without a valid session.

**DOCX parsing:** Uses `mammoth.js` (CDN) to extract text from `.docx` uploads. Both design sheets and resumes support file upload.

### Data layer (`db.js`)

Older versions stored everything as one JSON blob per key in an `app_data(key, value)` table, so any two concurrent saves would clobber each other. `db.js` now diffs each in-memory array against a last-known-server snapshot and writes only the rows that actually changed (`DB.sync(key, value)`), against per-entity normalized tables (`positions`, `candidates`, `interview_appointments`, etc. — see `sql/README.md` for the full table map). Child collections tied to one parent (e.g. `position_levels` for one position) are still replaced wholesale when that parent changes, so two people editing the *same* parent's child list concurrently can still overwrite each other — only cross-parent edits are guaranteed conflict-free.

### Security model

- **RLS** (`sql/003_rls.sql`): `anon` has no table grants at all; `authenticated` users can read/write business tables only while `is_active_member()` is true. Role/status/permission changes on `app_users` require `is_system_admin()`, enforced both by policy and by a trigger that blocks self-escalation.
- **Serverless functions** (`api/*.js`) run with a service-role key or a server-held Anthropic key, so each one must independently verify the caller's Supabase `access_token` (and, for `invite-user`, the caller's `시스템 관리자` role) before doing anything privileged — Vercel does not do this for you. If you add a new `/api/*` endpoint that touches privileged data or a paid API, copy the auth-check pattern from `api/invite-user.js` / `api/claude.js` rather than trusting `Access-Control-Allow-Origin` or client-side checks alone.
