-- ============================================================================
-- 기존 app_data(key,value JSON) → 정규화 테이블 마이그레이션 (002)
--
-- 안전장치:
--   * app_data 는 읽기만 한다. DELETE/DROP 없음. 롤백용 원본으로 그대로 남는다.
--   * 각 블록은 대상 테이블이 비어 있을 때만 실행된다 → 몇 번을 다시 돌려도
--     중복 적재가 없다. 중간에 실패하면 그대로 다시 실행하면 된다.
--
-- 구현 메모:
--   임시 테이블(temp table)을 쓰지 않는다. Supabase SQL Editor 는 문장을 각각
--   별도 트랜잭션으로 실행할 수 있어서, 앞 문장에서 만든 임시 테이블이 뒤 문장
--   에서는 사라진다("relation _src does not exist").
--   대신 설계시트 id 를 배열 순서로부터 결정적으로 만들어(md5), 여러 문장이
--   각자 같은 값을 다시 계산하게 했다. 문장 사이에 남길 상태가 아예 없다.
--
-- 실행: 001_schema.sql 적용 후 Supabase SQL Editor 에서 이 파일 전체를 실행.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. 사용자  (wm_users)
-- ---------------------------------------------------------------------------
insert into app_users (id, email, name, role, status, last_login, permissions)
select
  coalesce(nullif(u->>'id',''), md5('wm_users:' || ord::text)::uuid::text),
  u->>'email',
  coalesce(u->>'name',''),
  coalesce(nullif(u->>'role',''), 'HR 담당자'),
  coalesce(nullif(u->>'status',''), '초대됨'),
  coalesce(nullif(u->>'lastLogin',''), '—'),
  coalesce(u->'permissions', '{}'::jsonb)
from app_data s, jsonb_array_elements(s.value) with ordinality as t(u, ord)
where s.key = 'wm_users'
  and jsonb_typeof(s.value) = 'array'
  and coalesce(u->>'email','') <> ''
  and not exists (select 1 from app_users)
on conflict (email) do nothing;

-- ---------------------------------------------------------------------------
-- 2. 설계시트  (wm_sheets)
--    기존 데이터에는 id 가 없다. 배열 순서(ordinality)로 결정적 id 를 만들어
--    아래 자식 테이블 4개가 모두 같은 값을 재계산해 쓰도록 한다.
-- ---------------------------------------------------------------------------
insert into positions (
  id, name, team, report_to, headcount, status, version,
  created_date, modified_date, completed_date, f1, f2, f3, f4, f5, f6
)
select
  md5('wm_sheets:' || ord::text)::uuid::text,
  coalesce(sheet->>'name',''),
  coalesce(nullif(sheet->>'team',''), '—'),
  coalesce(nullif(sheet->>'reportTo',''), '—'),
  coalesce(nullif(sheet->>'headcount',''), '1'),
  coalesce(sheet->>'status',''),
  coalesce((sheet->>'version')::int, 1),
  coalesce(sheet->>'created',''),
  coalesce(sheet->>'modified',''),
  coalesce(sheet->>'completedDate',''),
  coalesce(sheet->>'f1',''), coalesce(sheet->>'f2',''), coalesce(sheet->>'f3',''),
  coalesce(sheet->>'f4',''), coalesce(sheet->>'f5',''), coalesce(sheet->>'f6','')
from app_data s, jsonb_array_elements(s.value) with ordinality as t(sheet, ord)
where s.key = 'wm_sheets'
  and jsonb_typeof(s.value) = 'array'
  and not exists (select 1 from positions)
on conflict (id) do nothing;

-- 2-1. 레벨
insert into position_levels (position_id, sort_order, code, name, min_years, max_years, note)
select
  md5('wm_sheets:' || ord::text)::uuid::text,
  (lv_ord - 1)::int,
  coalesce(lv->>'code',''), coalesce(lv->>'name',''),
  coalesce(lv->>'minYears',''), coalesce(lv->>'maxYears',''), coalesce(lv->>'note','')
from app_data s,
     jsonb_array_elements(s.value) with ordinality as t(sheet, ord),
     jsonb_array_elements(case when jsonb_typeof(sheet->'levels') = 'array'
                               then sheet->'levels' else '[]'::jsonb end)
       with ordinality as l(lv, lv_ord)
where s.key = 'wm_sheets'
  and jsonb_typeof(s.value) = 'array'
  and not exists (select 1 from position_levels);

-- 2-2. 개정 이력
insert into position_history (position_id, version, changed_at, note, f1, f2, f3, f4, f5, f6)
select
  md5('wm_sheets:' || ord::text)::uuid::text,
  coalesce((h->>'version')::int, 1),
  coalesce(h->>'time',''),
  coalesce(h->>'note',''),
  coalesce(h->>'f1',''), coalesce(h->>'f2',''), coalesce(h->>'f3',''),
  coalesce(h->>'f4',''), coalesce(h->>'f5',''), coalesce(h->>'f6','')
from app_data s,
     jsonb_array_elements(s.value) with ordinality as t(sheet, ord),
     jsonb_array_elements(case when jsonb_typeof(sheet->'history') = 'array'
                               then sheet->'history' else '[]'::jsonb end) h
where s.key = 'wm_sheets'
  and jsonb_typeof(s.value) = 'array'
  and not exists (select 1 from position_history);

-- 2-3. 과제
insert into position_assignments (
  id, position_id, title, content, file_name, file_type, file_data, created_date, modified_date
)
select
  coalesce(nullif(a->>'id',''), md5('wm_assign:' || ord::text || ':' || a_ord::text)::uuid::text),
  md5('wm_sheets:' || ord::text)::uuid::text,
  coalesce(a->>'title',''), coalesce(a->>'content',''),
  coalesce(a->>'fileName',''), coalesce(a->>'fileType',''), coalesce(a->>'fileData',''),
  coalesce(a->>'created',''), coalesce(a->>'modified','')
from app_data s,
     jsonb_array_elements(s.value) with ordinality as t(sheet, ord),
     jsonb_array_elements(case when jsonb_typeof(sheet->'assignments') = 'array'
                               then sheet->'assignments' else '[]'::jsonb end)
       with ordinality as x(a, a_ord)
where s.key = 'wm_sheets'
  and jsonb_typeof(s.value) = 'array'
  and not exists (select 1 from position_assignments)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 3. 지원자  (wm_matching)  — position_name 으로 positions 를 역참조해 FK 연결
--    지원자는 대부분 이미 id 를 갖고 있고, 없으면 순서로 결정적 id 를 만든다.
-- ---------------------------------------------------------------------------
insert into candidates (
  id, applicant, position_name, position_id, apply_date, source, channel,
  proc_status, rejected, final_pass_date, score, sub1, sub2, sub3
)
select
  coalesce(nullif(c->>'id',''), md5('wm_matching:' || ord::text)::uuid::text),
  coalesce(c->>'applicant',''),
  coalesce(c->>'position',''),
  (select p.id from positions p where p.name = c->>'position' order by p.created_at limit 1),
  coalesce(c->>'date',''),
  coalesce(c->>'source',''),
  coalesce(c->>'channel',''),
  coalesce(c->>'procStatus',''),
  coalesce((c->>'rejected')::boolean, false),
  coalesce(c->>'finalPassDate',''),
  coalesce(nullif(c->>'score',''), '—'),
  coalesce(nullif(c->>'sub1',''), '—'),
  coalesce(nullif(c->>'sub2',''), '—'),
  coalesce(nullif(c->>'sub3',''), '—')
from app_data s, jsonb_array_elements(s.value) with ordinality as t(c, ord)
where s.key = 'wm_matching'
  and jsonb_typeof(s.value) = 'array'
  and not exists (select 1 from candidates)
on conflict (id) do nothing;

-- 3-1. 이력서 원문
insert into candidate_resumes (candidate_id, extracted_text)
select
  coalesce(nullif(c->>'id',''), md5('wm_matching:' || ord::text)::uuid::text),
  c->>'extractedText'
from app_data s, jsonb_array_elements(s.value) with ordinality as t(c, ord)
where s.key = 'wm_matching'
  and jsonb_typeof(s.value) = 'array'
  and coalesce(c->>'extractedText','') <> ''
  and not exists (select 1 from candidate_resumes)
on conflict (candidate_id) do nothing;

-- 3-2. 분석 결과
insert into candidate_analyses (
  candidate_id, overall, exp_years, from_ai, item_scores, field_labels,
  feedback_pos, feedback_neg, strength_chips, missing_chips
)
select
  coalesce(nullif(c->>'id',''), md5('wm_matching:' || ord::text)::uuid::text),
  case when (c->'analysis'->>'overall') ~ '^-?[0-9]+(\.[0-9]+)?$'
       then (c->'analysis'->>'overall')::numeric end,
  case when (c->'analysis'->>'expYears') ~ '^-?[0-9]+(\.[0-9]+)?$'
       then (c->'analysis'->>'expYears')::numeric end,
  coalesce((c->'analysis'->>'fromAI')::boolean, false),
  coalesce(c->'analysis'->'itemScores',    '[]'::jsonb),
  coalesce(c->'analysis'->'fieldLabels',   '[]'::jsonb),
  coalesce(c->'analysis'->'feedbackPos',   '[]'::jsonb),
  coalesce(c->'analysis'->'feedbackNeg',   '[]'::jsonb),
  coalesce(c->'analysis'->'strengthChips', '[]'::jsonb),
  coalesce(c->'analysis'->'missingChips',  '[]'::jsonb)
from app_data s, jsonb_array_elements(s.value) with ordinality as t(c, ord)
where s.key = 'wm_matching'
  and jsonb_typeof(s.value) = 'array'
  and jsonb_typeof(coalesce(c->'analysis','null'::jsonb)) = 'object'
  and not exists (select 1 from candidate_analyses)
on conflict (candidate_id) do nothing;

-- 3-3. 면접 질문 리포트
insert into candidate_reports (candidate_id, interview, resume_questions)
select
  coalesce(nullif(c->>'id',''), md5('wm_matching:' || ord::text)::uuid::text),
  coalesce(c->'reportData'->'interview',       '{}'::jsonb),
  coalesce(c->'reportData'->'resumeQuestions', '[]'::jsonb)
from app_data s, jsonb_array_elements(s.value) with ordinality as t(c, ord)
where s.key = 'wm_matching'
  and jsonb_typeof(s.value) = 'array'
  and jsonb_typeof(coalesce(c->'reportData','null'::jsonb)) = 'object'
  and not exists (select 1 from candidate_reports)
on conflict (candidate_id) do nothing;

-- ---------------------------------------------------------------------------
-- 4. 면접 운영
-- ---------------------------------------------------------------------------

-- 4-1. 면접관 풀  (wm_interviewers)
insert into interviewers (name, positions)
select distinct on (iv->>'name')
  iv->>'name',
  coalesce(iv->'positions', '[]'::jsonb)
from app_data s, jsonb_array_elements(s.value) iv
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
from app_data s, jsonb_array_elements(s.value) e
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
from app_data s,
     jsonb_array_elements(case when jsonb_typeof(s.value->'types') = 'array'
                               then s.value->'types' else '[]'::jsonb end)
       with ordinality as x(t, t_ord)
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
from app_data s, jsonb_array_elements(s.value) a
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
from app_data s, jsonb_array_elements(s.value) r
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
from app_data s, jsonb_array_elements(s.value) r
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
from app_data s, jsonb_array_elements(s.value) a
where s.key = 'wm_audit'
  and jsonb_typeof(s.value) = 'array'
  and not exists (select 1 from audit_log);

insert into backup_snapshots (label, counts, payload, created_at)
select
  coalesce(b->>'label',''),
  coalesce(b->'counts', '{}'::jsonb),
  coalesce(b->'data',   '{}'::jsonb),
  coalesce((b->>'time')::timestamptz, now())
from app_data s, jsonb_array_elements(s.value) b
where s.key = 'wm_backup_history'
  and jsonb_typeof(s.value) = 'array'
  and not exists (select 1 from backup_snapshots);

-- ---------------------------------------------------------------------------
-- 검증: 원본 JSON 배열 길이와 적재된 행 수를 비교한다. 모두 일치해야 한다.
-- ---------------------------------------------------------------------------
select
  t.label,
  t.migrated,
  coalesce(t.source, 0) as source,
  case when t.migrated = coalesce(t.source, 0) then 'OK' else '확인 필요' end as 결과
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
