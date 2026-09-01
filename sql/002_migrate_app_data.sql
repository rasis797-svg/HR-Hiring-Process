-- ============================================================================
-- 기존 app_data(key,value JSON) → 정규화 테이블 마이그레이션 (002)
--
-- 안전장치:
--   * app_data 는 읽기만 한다. DELETE/DROP 없음. 롤백용 원본으로 그대로 남는다.
--   * 각 블록은 대상 테이블이 비어 있을 때만 실행된다 (재실행해도 중복 적재 없음).
--   * 실패 시 트랜잭션 전체가 롤백되도록 begin/commit 으로 감쌌다.
--
-- 실행: 001_schema.sql 적용 후 Supabase SQL Editor 에서 이 파일 전체를 실행.
-- ============================================================================

begin;

-- 원본 JSON을 한 번만 읽어 재사용
create temp table _src on commit drop as
  select key, value from app_data;

-- ---------------------------------------------------------------------------
-- 1. 사용자  (wm_users)
-- ---------------------------------------------------------------------------
insert into app_users (id, email, name, role, status, last_login, permissions)
select
  coalesce(nullif(u->>'id',''), new_id()),
  u->>'email',
  coalesce(u->>'name',''),
  coalesce(nullif(u->>'role',''), 'HR 담당자'),
  coalesce(nullif(u->>'status',''), '초대됨'),
  coalesce(nullif(u->>'lastLogin',''), '—'),
  coalesce(u->'permissions', '{}'::jsonb)
from _src s, jsonb_array_elements(s.value) u
where s.key = 'wm_users'
  and jsonb_typeof(s.value) = 'array'
  and coalesce(u->>'email','') <> ''
  and not exists (select 1 from app_users)
on conflict (email) do nothing;

-- ---------------------------------------------------------------------------
-- 2. 설계시트  (wm_sheets)
--    기존 데이터에 id가 없다 → 배열 순서(ordinality)를 기준으로 id를 새로 부여하고
--    그 매핑을 임시 테이블에 남겨 자식 테이블(레벨/이력/과제) 연결에 사용한다.
-- ---------------------------------------------------------------------------
create temp table _sheet_map on commit drop as
select
  ord,
  new_id() as position_id,
  sheet
from _src s, jsonb_array_elements(s.value) with ordinality as t(sheet, ord)
where s.key = 'wm_sheets'
  and jsonb_typeof(s.value) = 'array'
  and not exists (select 1 from positions);

insert into positions (
  id, name, team, report_to, headcount, status, version,
  created_date, modified_date, completed_date, f1, f2, f3, f4, f5, f6
)
select
  m.position_id,
  coalesce(m.sheet->>'name',''),
  coalesce(nullif(m.sheet->>'team',''), '—'),
  coalesce(nullif(m.sheet->>'reportTo',''), '—'),
  coalesce(nullif(m.sheet->>'headcount',''), '1'),
  coalesce(m.sheet->>'status',''),
  coalesce((m.sheet->>'version')::int, 1),
  coalesce(m.sheet->>'created',''),
  coalesce(m.sheet->>'modified',''),
  coalesce(m.sheet->>'completedDate',''),
  coalesce(m.sheet->>'f1',''), coalesce(m.sheet->>'f2',''), coalesce(m.sheet->>'f3',''),
  coalesce(m.sheet->>'f4',''), coalesce(m.sheet->>'f5',''), coalesce(m.sheet->>'f6','')
from _sheet_map m;

-- 2-1. 레벨
insert into position_levels (position_id, sort_order, code, name, min_years, max_years, note)
select
  m.position_id,
  (lv_ord - 1)::int,
  coalesce(lv->>'code',''), coalesce(lv->>'name',''),
  coalesce(lv->>'minYears',''), coalesce(lv->>'maxYears',''), coalesce(lv->>'note','')
from _sheet_map m,
     jsonb_array_elements(coalesce(m.sheet->'levels','[]'::jsonb)) with ordinality as t(lv, lv_ord)
where jsonb_typeof(coalesce(m.sheet->'levels','[]'::jsonb)) = 'array';

-- 2-2. 개정 이력
insert into position_history (position_id, version, changed_at, note, f1, f2, f3, f4, f5, f6)
select
  m.position_id,
  coalesce((h->>'version')::int, 1),
  coalesce(h->>'time',''),
  coalesce(h->>'note',''),
  coalesce(h->>'f1',''), coalesce(h->>'f2',''), coalesce(h->>'f3',''),
  coalesce(h->>'f4',''), coalesce(h->>'f5',''), coalesce(h->>'f6','')
from _sheet_map m,
     jsonb_array_elements(coalesce(m.sheet->'history','[]'::jsonb)) h
where jsonb_typeof(coalesce(m.sheet->'history','[]'::jsonb)) = 'array';

-- 2-3. 과제
insert into position_assignments (
  id, position_id, title, content, file_name, file_type, file_data, created_date, modified_date
)
select
  coalesce(nullif(a->>'id',''), new_id()),
  m.position_id,
  coalesce(a->>'title',''), coalesce(a->>'content',''),
  coalesce(a->>'fileName',''), coalesce(a->>'fileType',''), coalesce(a->>'fileData',''),
  coalesce(a->>'created',''), coalesce(a->>'modified','')
from _sheet_map m,
     jsonb_array_elements(coalesce(m.sheet->'assignments','[]'::jsonb)) a
where jsonb_typeof(coalesce(m.sheet->'assignments','[]'::jsonb)) = 'array'
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 3. 지원자  (wm_matching)  — position_name 으로 positions 를 역참조해 FK 연결
-- ---------------------------------------------------------------------------
create temp table _cand on commit drop as
select
  coalesce(nullif(c->>'id',''), new_id()) as id,
  c as doc
from _src s, jsonb_array_elements(s.value) c
where s.key = 'wm_matching'
  and jsonb_typeof(s.value) = 'array'
  and not exists (select 1 from candidates);

insert into candidates (
  id, applicant, position_name, position_id, apply_date, source, channel,
  proc_status, rejected, final_pass_date, score, sub1, sub2, sub3
)
select
  c.id,
  coalesce(c.doc->>'applicant',''),
  coalesce(c.doc->>'position',''),
  (select p.id from positions p where p.name = c.doc->>'position' order by p.created_at limit 1),
  coalesce(c.doc->>'date',''),
  coalesce(c.doc->>'source',''),
  coalesce(c.doc->>'channel',''),
  coalesce(c.doc->>'procStatus',''),
  coalesce((c.doc->>'rejected')::boolean, false),
  coalesce(c.doc->>'finalPassDate',''),
  coalesce(nullif(c.doc->>'score',''), '—'),
  coalesce(nullif(c.doc->>'sub1',''), '—'),
  coalesce(nullif(c.doc->>'sub2',''), '—'),
  coalesce(nullif(c.doc->>'sub3',''), '—')
from _cand c
on conflict (id) do nothing;

-- 3-1. 이력서 원문
insert into candidate_resumes (candidate_id, extracted_text)
select c.id, c.doc->>'extractedText'
from _cand c
where coalesce(c.doc->>'extractedText','') <> ''
on conflict (candidate_id) do nothing;

-- 3-2. 분석 결과
insert into candidate_analyses (
  candidate_id, overall, exp_years, from_ai, item_scores, field_labels,
  feedback_pos, feedback_neg, strength_chips, missing_chips
)
select
  c.id,
  case when (c.doc->'analysis'->>'overall') ~ '^-?[0-9]+(\.[0-9]+)?$'
       then (c.doc->'analysis'->>'overall')::numeric end,
  case when (c.doc->'analysis'->>'expYears') ~ '^-?[0-9]+(\.[0-9]+)?$'
       then (c.doc->'analysis'->>'expYears')::numeric end,
  coalesce((c.doc->'analysis'->>'fromAI')::boolean, false),
  coalesce(c.doc->'analysis'->'itemScores',    '[]'::jsonb),
  coalesce(c.doc->'analysis'->'fieldLabels',   '[]'::jsonb),
  coalesce(c.doc->'analysis'->'feedbackPos',   '[]'::jsonb),
  coalesce(c.doc->'analysis'->'feedbackNeg',   '[]'::jsonb),
  coalesce(c.doc->'analysis'->'strengthChips', '[]'::jsonb),
  coalesce(c.doc->'analysis'->'missingChips',  '[]'::jsonb)
from _cand c
where jsonb_typeof(coalesce(c.doc->'analysis','null'::jsonb)) = 'object'
on conflict (candidate_id) do nothing;

-- 3-3. 면접 질문 리포트
insert into candidate_reports (candidate_id, interview, resume_questions)
select
  c.id,
  coalesce(c.doc->'reportData'->'interview',       '{}'::jsonb),
  coalesce(c.doc->'reportData'->'resumeQuestions', '[]'::jsonb)
from _cand c
where jsonb_typeof(coalesce(c.doc->'reportData','null'::jsonb)) = 'object'
on conflict (candidate_id) do nothing;

-- ---------------------------------------------------------------------------
-- 4. 면접 운영
-- ---------------------------------------------------------------------------

-- 4-1. 면접관 풀  (wm_interviewers)
insert into interviewers (name, positions)
select distinct on (iv->>'name')
  iv->>'name',
  coalesce(iv->'positions', '[]'::jsonb)
from _src s, jsonb_array_elements(s.value) iv
where s.key = 'wm_interviewers'
  and jsonb_typeof(s.value) = 'array'
  and coalesce(iv->>'name','') <> ''
  and not exists (select 1 from interviewers)
on conflict (name) do nothing;

-- 4-2. 면접관 가용 일정  (wm_schedule)
insert into interviewer_availability (interviewer_name, avail_date, status, block_time)
select distinct on (e->>'date', e->>'interviewer')
  e->>'interviewer',
  e->>'date',
  coalesce(nullif(e->>'status',''), 'available'),
  coalesce(e->>'blockTime','')
from _src s, jsonb_array_elements(s.value) e
where s.key = 'wm_schedule'
  and jsonb_typeof(s.value) = 'array'
  and coalesce(e->>'date','') <> ''
  and coalesce(e->>'interviewer','') <> ''
  and not exists (select 1 from interviewer_availability)
on conflict (avail_date, interviewer_name) do nothing;

-- 4-3. 면접 유형 설정  (wm_iv_settings → {types:[...]})
insert into interview_types (key, label, duration, buffer, sort_order)
select
  t->>'key',
  coalesce(t->>'label',''),
  coalesce((t->>'duration')::int, 60),
  coalesce((t->>'buffer')::int, 15),
  (t_ord - 1)::int
from _src s, jsonb_array_elements(coalesce(s.value->'types','[]'::jsonb)) with ordinality as x(t, t_ord)
where s.key = 'wm_iv_settings'
  and coalesce(t->>'key','') <> ''
  and not exists (select 1 from interview_types)
on conflict (key) do nothing;

-- 4-4. 면접 일정 배정  (wm_iv_appts)
--      기존 candidateId 가 있으면 그것으로, 없으면 이름+포지션으로 지원자를 연결한다.
insert into interview_appointments (
  candidate_id, candidate_name, candidate_position, proc_status,
  interviewers, appt_date, appt_time, type
)
select
  coalesce(
    (select c.id from candidates c where c.id = nullif(a->>'candidateId','')),
    (select c.id from candidates c
      where c.applicant = a->>'candidateName'
        and c.position_name = coalesce(a->>'candidatePosition','')
      order by c.created_at limit 1)
  ),
  coalesce(a->>'candidateName',''),
  coalesce(a->>'candidatePosition',''),
  coalesce(a->>'procStatus',''),
  coalesce(a->'interviewers', '[]'::jsonb),
  coalesce(a->>'date',''),
  coalesce(a->>'time',''),
  coalesce(a->>'type','')
from _src s, jsonb_array_elements(s.value) a
where s.key = 'wm_iv_appts'
  and jsonb_typeof(s.value) = 'array'
  and not exists (select 1 from interview_appointments);

-- ---------------------------------------------------------------------------
-- 5. 면접 평가 결과
-- ---------------------------------------------------------------------------

-- 5-1. 코어 면접  (wm_ci_results)
insert into core_interview_results (
  candidate_id, candidate_name, position_name, track, status, verdict,
  is_fail, red_flag_count, red_flags, results, opinion, star_level, star_memo, ci_state, saved_at
)
select
  (select c.id from candidates c
    where c.applicant = r->>'name' and c.position_name = coalesce(r->>'pos','')
    order by c.created_at limit 1),
  coalesce(r->>'name',''),
  coalesce(r->>'pos',''),
  coalesce(r->>'track',''),
  coalesce(nullif(r->>'status',''), 'done'),
  coalesce(r->>'verdict',''),
  coalesce((r->>'isFail')::boolean, false),
  coalesce((r->>'redFlagCount')::int, 0),
  coalesce(r->'redFlags', '[]'::jsonb),
  coalesce(r->'results',  '{}'::jsonb),
  coalesce(r->>'opinion',''),
  nullif(r->>'starLevel',''),
  coalesce(r->>'starMemo',''),
  r->'ciState',
  coalesce(r->>'savedAt','')
from _src s, jsonb_array_elements(s.value) r
where s.key = 'wm_ci_results'
  and jsonb_typeof(s.value) = 'array'
  and not exists (select 1 from core_interview_results);

-- 5-2. 과제 면접  (wm_qq_results)
insert into assignment_interview_results (
  candidate_id, candidate_name, position_name, phase, decision_rule, verdict,
  is_fail, fail_q, fail_type, questions, results, opinion, star_level, star_memo, saved_at
)
select
  (select c.id from candidates c
    where c.applicant = r->>'name' and c.position_name = coalesce(r->>'pos','')
    order by c.created_at limit 1),
  coalesce(r->>'name',''),
  coalesce(r->>'pos',''),
  coalesce((r->>'phase')::int, 5),
  coalesce(nullif(r->>'decisionRule',''), 'ANY_RED_FLAG_FAIL'),
  coalesce(r->>'verdict',''),
  coalesce((r->>'isFail')::boolean, false),
  coalesce(r->>'failQ',''),
  coalesce(r->>'failType',''),
  coalesce(r->'questions', '[]'::jsonb),
  coalesce(r->'results',   '{}'::jsonb),
  coalesce(r->>'opinion',''),
  nullif(r->>'starLevel',''),
  coalesce(r->>'starMemo',''),
  coalesce(r->>'savedAt','')
from _src s, jsonb_array_elements(s.value) r
where s.key = 'wm_qq_results'
  and jsonb_typeof(s.value) = 'array'
  and not exists (select 1 from assignment_interview_results);

-- ---------------------------------------------------------------------------
-- 6. 감사 로그 / 백업 히스토리
-- ---------------------------------------------------------------------------
insert into audit_log (logged_at, user_name, action, target, ip)
select
  coalesce(a->>'time',''),
  coalesce(a->>'user',''),
  coalesce(a->>'action',''),
  coalesce(a->>'target',''),
  coalesce(nullif(a->>'ip',''), '—')
from _src s, jsonb_array_elements(s.value) a
where s.key = 'wm_audit'
  and jsonb_typeof(s.value) = 'array'
  and not exists (select 1 from audit_log);

insert into backup_snapshots (label, counts, payload, created_at)
select
  coalesce(b->>'label',''),
  coalesce(b->'counts', '{}'::jsonb),
  coalesce(b->'payload', '{}'::jsonb),
  coalesce((b->>'at')::timestamptz, now())
from _src s, jsonb_array_elements(s.value) b
where s.key = 'wm_backup_history'
  and jsonb_typeof(s.value) = 'array'
  and not exists (select 1 from backup_snapshots);

commit;

-- ---------------------------------------------------------------------------
-- 검증: 원본 JSON 배열 길이와 적재된 행 수를 비교한다. 모두 일치해야 한다.
-- ---------------------------------------------------------------------------
select
  t.label,
  t.migrated,
  coalesce(t.source, 0) as source
from (
  select '설계시트' as label, (select count(*) from positions) as migrated,
         (select jsonb_array_length(value) from app_data where key = 'wm_sheets') as source
  union all
  select '지원자', (select count(*) from candidates),
         (select jsonb_array_length(value) from app_data where key = 'wm_matching')
  union all
  select '사용자', (select count(*) from app_users),
         (select jsonb_array_length(value) from app_data where key = 'wm_users')
  union all
  select '면접관', (select count(*) from interviewers),
         (select jsonb_array_length(value) from app_data where key = 'wm_interviewers')
  union all
  select '가용일정', (select count(*) from interviewer_availability),
         (select jsonb_array_length(value) from app_data where key = 'wm_schedule')
  union all
  select '면접배정', (select count(*) from interview_appointments),
         (select jsonb_array_length(value) from app_data where key = 'wm_iv_appts')
  union all
  select '코어면접결과', (select count(*) from core_interview_results),
         (select jsonb_array_length(value) from app_data where key = 'wm_ci_results')
  union all
  select '과제면접결과', (select count(*) from assignment_interview_results),
         (select jsonb_array_length(value) from app_data where key = 'wm_qq_results')
  union all
  select '감사로그', (select count(*) from audit_log),
         (select jsonb_array_length(value) from app_data where key = 'wm_audit')
) t;
