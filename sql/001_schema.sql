-- ============================================================================
-- 채용매칭 정규화 스키마 (001)
-- app_data(key,value JSON) 통짜 저장 → 엔티티별 테이블 / 행 단위 저장으로 전환
--
-- 실행 순서: 001_schema.sql → 002_migrate_app_data.sql → 003_rls.sql
-- 기존 app_data 테이블은 이 스크립트에서 건드리지 않는다 (보존).
-- ============================================================================

create extension if not exists "pgcrypto";

-- id는 text로 둔다. 기존 클라이언트가 생성한 base36 id(generateId())와
-- 신규 uuid를 함께 수용하기 위함이다.
create or replace function new_id() returns text
  language sql volatile as $$ select gen_random_uuid()::text $$;

-- updated_at 자동 갱신 (동시 편집 감지의 기준값)
create or replace function touch_updated_at() returns trigger
  language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- 1. 사용자
-- ---------------------------------------------------------------------------
create table if not exists app_users (
  id           text primary key default new_id(),
  auth_uid     uuid unique references auth.users(id) on delete set null,
  email        text not null unique,
  name         text not null default '',
  role         text not null default 'HR 담당자',
  status       text not null default '초대됨',      -- 초대됨 | 활성 | 비활성
  last_login   text not null default '—',
  permissions  jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists app_users_email_idx on app_users (lower(email));

drop trigger if exists app_users_touch on app_users;
create trigger app_users_touch before update on app_users
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------------
-- 2. 채용 포지션 = 설계시트
-- ---------------------------------------------------------------------------
create table if not exists positions (
  id             text primary key default new_id(),
  name           text not null,
  team           text not null default '—',
  report_to      text not null default '—',
  headcount      text not null default '1',
  status         text not null default '',          -- '' = 자동, '채용완료' = 수동 override
  version        integer not null default 1,
  created_date   text not null default '',          -- 화면 표기용 YYYY-MM-DD (기존 포맷 유지)
  modified_date  text not null default '',
  completed_date text not null default '',
  f1 text not null default '',   -- 역량 레벨
  f2 text not null default '',   -- 역할 범위
  f3 text not null default '',   -- 필수 지식/기술
  f4 text not null default '',   -- 폐기/자동화 업무
  f5 text not null default '',   -- 효율 증대 업무
  f6 text not null default '',   -- 결정적 무기 (가중치 2배)
  created_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists positions_name_idx on positions (name);

drop trigger if exists positions_touch on positions;
create trigger positions_touch before update on positions
  for each row execute function touch_updated_at();

-- 2-1. 포지션 레벨 (신입/주니어/시니어 등)
create table if not exists position_levels (
  id          text primary key default new_id(),
  position_id text not null references positions(id) on delete cascade,
  sort_order  integer not null default 0,
  code        text not null default '',
  name        text not null default '',
  min_years   text not null default '',
  max_years   text not null default '',
  note        text not null default ''
);
create index if not exists position_levels_pos_idx on position_levels (position_id, sort_order);

-- 2-2. 설계시트 개정 이력
create table if not exists position_history (
  id          text primary key default new_id(),
  position_id text not null references positions(id) on delete cascade,
  version     integer not null default 1,
  changed_at  text not null default '',
  note        text not null default '',
  f1 text default '', f2 text default '', f3 text default '',
  f4 text default '', f5 text default '', f6 text default '',
  created_at  timestamptz not null default now()
);
create index if not exists position_history_pos_idx on position_history (position_id, version);

-- 2-3. 포지션별 과제
create table if not exists position_assignments (
  id            text primary key default new_id(),
  position_id   text not null references positions(id) on delete cascade,
  title         text not null default '',
  content       text not null default '',
  file_name     text not null default '',
  file_type     text not null default '',
  file_data     text not null default '',           -- data URL (대용량 → 별도 컬럼)
  created_date  text not null default '',
  modified_date text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists position_assignments_pos_idx on position_assignments (position_id);

drop trigger if exists position_assignments_touch on position_assignments;
create trigger position_assignments_touch before update on position_assignments
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------------
-- 3. 지원자
-- ---------------------------------------------------------------------------
create table if not exists candidates (
  id              text primary key default new_id(),
  applicant       text not null default '',
  position_name   text not null default '',         -- 화면이 포지션명 문자열로 매칭하므로 유지
  position_id     text references positions(id) on delete set null,
  apply_date      text not null default '',
  source          text not null default '',         -- 파일명 또는 '텍스트 붙여넣기'
  channel         text not null default '',         -- 온라인 | 헤드헌터 | 추천채용 | 기타
  proc_status     text not null default '',         -- '' | 과제/공통면접 | 최종면접 | 최종합격
  rejected        boolean not null default false,
  final_pass_date text not null default '',
  score           text not null default '—',
  sub1            text not null default '—',
  sub2            text not null default '—',
  sub3            text not null default '—',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists candidates_position_idx on candidates (position_name);
create index if not exists candidates_status_idx   on candidates (proc_status) where rejected = false;

drop trigger if exists candidates_touch on candidates;
create trigger candidates_touch before update on candidates
  for each row execute function touch_updated_at();

-- 3-1. 이력서 원문 (용량이 크고 조회 빈도가 낮아 분리 — 목록 조회가 가벼워진다)
create table if not exists candidate_resumes (
  candidate_id   text primary key references candidates(id) on delete cascade,
  extracted_text text not null default '',
  updated_at     timestamptz not null default now()
);

drop trigger if exists candidate_resumes_touch on candidate_resumes;
create trigger candidate_resumes_touch before update on candidate_resumes
  for each row execute function touch_updated_at();

-- 3-2. AI/키워드 매칭 분석 결과
create table if not exists candidate_analyses (
  candidate_id   text primary key references candidates(id) on delete cascade,
  overall        numeric,
  exp_years      numeric,
  from_ai        boolean not null default false,
  item_scores    jsonb not null default '[]'::jsonb,   -- f1~f6 점수 배열
  field_labels   jsonb not null default '[]'::jsonb,
  feedback_pos   jsonb not null default '[]'::jsonb,
  feedback_neg   jsonb not null default '[]'::jsonb,
  strength_chips jsonb not null default '[]'::jsonb,
  missing_chips  jsonb not null default '[]'::jsonb,
  updated_at     timestamptz not null default now()
);

drop trigger if exists candidate_analyses_touch on candidate_analyses;
create trigger candidate_analyses_touch before update on candidate_analyses
  for each row execute function touch_updated_at();

-- 3-3. 면접 질문 리포트
create table if not exists candidate_reports (
  candidate_id     text primary key references candidates(id) on delete cascade,
  interview        jsonb not null default '{}'::jsonb,
  resume_questions jsonb not null default '[]'::jsonb,
  updated_at       timestamptz not null default now()
);

drop trigger if exists candidate_reports_touch on candidate_reports;
create trigger candidate_reports_touch before update on candidate_reports
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------------
-- 4. 면접 운영
-- ---------------------------------------------------------------------------
create table if not exists interviewers (
  id         text primary key default new_id(),
  name       text not null unique,
  positions  jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- 면접관 가용 일정 (하루 1행)
create table if not exists interviewer_availability (
  id               text primary key default new_id(),
  interviewer_name text not null,
  avail_date       text not null,                   -- YYYY-MM-DD
  status           text not null default 'available', -- available | partial | unavailable
  block_time       text not null default '',
  updated_at       timestamptz not null default now(),
  unique (avail_date, interviewer_name)
);
create index if not exists interviewer_availability_date_idx on interviewer_availability (avail_date);

drop trigger if exists interviewer_availability_touch on interviewer_availability;
create trigger interviewer_availability_touch before update on interviewer_availability
  for each row execute function touch_updated_at();

-- 면접 유형 설정 (과제면접/공통면접/최종면접 · 소요시간 · 버퍼)
create table if not exists interview_types (
  key        text primary key,
  label      text not null default '',
  duration   integer not null default 60,
  buffer     integer not null default 15,
  sort_order integer not null default 0
);

-- 면접 일정 배정
create table if not exists interview_appointments (
  id                text primary key default new_id(),
  candidate_id      text references candidates(id) on delete cascade,
  candidate_name    text not null default '',
  candidate_position text not null default '',
  proc_status       text not null default '',
  interviewers      jsonb not null default '[]'::jsonb,
  appt_date         text not null default '',
  appt_time         text not null default '',
  type              text not null default '',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists interview_appointments_date_idx on interview_appointments (appt_date);
create index if not exists interview_appointments_cand_idx on interview_appointments (candidate_id);

drop trigger if exists interview_appointments_touch on interview_appointments;
create trigger interview_appointments_touch before update on interview_appointments
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------------
-- 5. 면접 평가 결과
-- ---------------------------------------------------------------------------

-- 5-1. 코어 면접 (구조화 면접)
create table if not exists core_interview_results (
  id              text primary key default new_id(),
  candidate_id    text references candidates(id) on delete set null,
  candidate_name  text not null default '',
  position_name   text not null default '',
  track           text not null default '',          -- member | leader
  status          text not null default 'done',      -- draft | done
  verdict         text not null default '',
  is_fail         boolean not null default false,
  red_flag_count  integer not null default 0,
  red_flags       jsonb not null default '[]'::jsonb,
  results         jsonb not null default '{}'::jsonb,
  opinion         text not null default '',
  star_level      text,
  star_memo       text not null default '',
  ci_state        jsonb,                             -- 임시저장(draft) 재개용 세션 상태
  saved_at        text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists core_interview_results_cand_idx on core_interview_results (candidate_id);

drop trigger if exists core_interview_results_touch on core_interview_results;
create trigger core_interview_results_touch before update on core_interview_results
  for each row execute function touch_updated_at();

-- 5-2. 과제 면접 (Phase 5 / ANY_RED_FLAG_FAIL)
create table if not exists assignment_interview_results (
  id             text primary key default new_id(),
  candidate_id   text references candidates(id) on delete set null,
  candidate_name text not null default '',
  position_name  text not null default '',
  phase          integer not null default 5,
  decision_rule  text not null default 'ANY_RED_FLAG_FAIL',
  verdict        text not null default '',
  is_fail        boolean not null default false,
  fail_q         text not null default '',
  fail_type      text not null default '',
  questions      jsonb not null default '[]'::jsonb,
  results        jsonb not null default '{}'::jsonb,
  opinion        text not null default '',
  star_level     text,
  star_memo      text not null default '',
  saved_at       text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists assignment_interview_results_cand_idx on assignment_interview_results (candidate_id);

drop trigger if exists assignment_interview_results_touch on assignment_interview_results;
create trigger assignment_interview_results_touch before update on assignment_interview_results
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------------
-- 6. 감사 로그 / 백업 (append-only)
-- ---------------------------------------------------------------------------
create table if not exists audit_log (
  id          text primary key default new_id(),
  logged_at   text not null default '',              -- 화면 표기용 문자열 (기존 포맷 유지)
  user_name   text not null default '',
  action      text not null default '',
  target      text not null default '',
  ip          text not null default '—',
  created_at  timestamptz not null default now()
);
create index if not exists audit_log_created_idx on audit_log (created_at desc);

create table if not exists backup_snapshots (
  id         text primary key default new_id(),
  label      text not null default '',
  counts     jsonb not null default '{}'::jsonb,
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists backup_snapshots_created_idx on backup_snapshots (created_at desc);
