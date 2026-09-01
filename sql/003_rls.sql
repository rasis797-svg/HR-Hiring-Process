-- ============================================================================
-- Row Level Security (003)
--
-- 전제: 클라이언트는 publishable(anon) 키로 접속하고, 로그인은 Supabase Auth 로만
--       이루어진다. 따라서 anon 에게는 아무 권한도 주지 않고, authenticated 에게만
--       업무 데이터 접근을 허용한다.
--
-- 주의: 이 파일을 적용하면 로그인 전에는 데이터가 조회되지 않는다.
--       app.js 도 "로그인 성공 후 데이터 로드" 순서로 함께 변경되어 있어야 한다.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 로그인 계정 연결
--
-- 기존 app_users 행에는 auth_uid 가 없다(마이그레이션된 데이터). 로그인 직후
-- 이 함수를 호출해 이메일로 본인 행을 찾아 auth_uid 를 채운다. 행이 아예 없으면
-- (초대 수락 직후) 새로 만든다. 이 연결이 끝나야 아래 정책들이 통과한다.
--
-- app_users 가 완전히 비어 있는 최초 1회에 한해 시스템 관리자로 생성된다.
-- ---------------------------------------------------------------------------
create or replace function link_current_user()
  returns app_users
  language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_email text := auth.email();
  v_meta  jsonb;
  rec     app_users;
begin
  if v_uid is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;

  -- 1) 이미 연결된 행
  select * into rec from app_users where auth_uid = v_uid;
  if found then
    update app_users set status = case when status = '초대됨' then '활성' else status end
     where id = rec.id returning * into rec;
    return rec;
  end if;

  -- 2) 이메일이 같은 미연결 행에 auth_uid 를 채운다
  update app_users
     set auth_uid = v_uid,
         status   = case when status = '초대됨' then '활성' else status end
   where lower(email) = lower(v_email)
     and auth_uid is null
  returning * into rec;
  if found then
    return rec;
  end if;

  -- 3) 그래도 없으면 새로 만든다
  select raw_user_meta_data into v_meta from auth.users where id = v_uid;

  insert into app_users (auth_uid, email, name, role, status, last_login)
  values (
    v_uid,
    v_email,
    coalesce(nullif(v_meta->>'name', ''), v_email),
    coalesce(
      nullif(v_meta->>'role', ''),
      case when not exists (select 1 from app_users) then '시스템 관리자' else 'HR 담당자' end
    ),
    '활성',
    '—'
  )
  returning * into rec;

  return rec;
end $$;

revoke execute on function link_current_user() from anon, public;
grant  execute on function link_current_user() to authenticated;

-- 현재 접속자가 시스템 관리자인지 판정.
-- 정책 안에서 app_users 를 다시 읽으므로 재귀를 피하려 security definer 로 둔다.
create or replace function is_system_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from app_users
     where auth_uid = auth.uid()
       and role = '시스템 관리자'
       and status = '활성'
  )
$$;

-- 로그인한 사용자가 비활성 처리되지 않았는지 확인.
-- 비활성 계정은 로그인에 성공하더라도 업무 데이터에 접근할 수 없다.
create or replace function is_active_member() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from app_users
     where auth_uid = auth.uid()
       and status <> '비활성'
  )
$$;

-- ---------------------------------------------------------------------------
-- 업무 테이블: 활성 구성원이면 읽기/쓰기 모두 허용
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'positions', 'position_levels', 'position_history', 'position_assignments',
    'candidates', 'candidate_resumes', 'candidate_analyses', 'candidate_reports',
    'interviewers', 'interviewer_availability', 'interview_types',
    'interview_appointments', 'core_interview_results',
    'assignment_interview_results', 'backup_snapshots'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_member_all', t);
    execute format($f$
      create policy %I on %I
        for all to authenticated
        using (is_active_member())
        with check (is_active_member())
    $f$, t || '_member_all', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 감사 로그: 활성 구성원은 읽기 + 추가만. 수정/삭제는 누구에게도 허용하지 않는다.
-- ---------------------------------------------------------------------------
alter table audit_log enable row level security;

drop policy if exists audit_log_read   on audit_log;
drop policy if exists audit_log_append on audit_log;

create policy audit_log_read on audit_log
  for select to authenticated using (is_active_member());

create policy audit_log_append on audit_log
  for insert to authenticated with check (is_active_member());

-- ---------------------------------------------------------------------------
-- 사용자 테이블
--   * 조회: 활성 구성원 전체 (사용자 관리 화면)
--   * 본인 행 수정: 허용 (last_login 갱신 등)
--   * 타인 행 추가/수정/삭제: 시스템 관리자만
-- ---------------------------------------------------------------------------
alter table app_users enable row level security;

drop policy if exists app_users_read        on app_users;
drop policy if exists app_users_self_update on app_users;
drop policy if exists app_users_admin_write on app_users;
drop policy if exists app_users_bootstrap   on app_users;

create policy app_users_read on app_users
  for select to authenticated using (true);

-- 본인 행은 고칠 수 있지만, 바꿀 수 있는 것은 이름/최종 로그인 정도다.
-- 역할·상태·권한·이메일은 아래 트리거가 막는다 (스스로 관리자로 승격하는 것을 방지).
create policy app_users_self_update on app_users
  for update to authenticated
  using (auth_uid = auth.uid())
  with check (auth_uid = auth.uid());

-- 주의: 이 함수는 반드시 security INVOKER (기본값) 여야 한다.
-- security definer 로 두면 함수 안의 current_user 가 항상 소유자가 되어
-- 아래 검사가 스스로 무력화된다.
create or replace function guard_app_users_privileged_columns() returns trigger
  language plpgsql set search_path = public as $$
begin
  -- PostgREST 는 요청을 처리할 때 role 을 authenticated 로 바꾼다.
  -- link_current_user() 같은 security definer 함수 안에서는 current_user 가
  -- 함수 소유자이므로 이 검사를 건너뛴다.
  if current_user <> 'authenticated' then
    return new;
  end if;

  if is_system_admin() then
    return new;
  end if;

  if new.role       is distinct from old.role
     or new.status      is distinct from old.status
     or new.permissions is distinct from old.permissions
     or new.auth_uid    is distinct from old.auth_uid
     or lower(new.email) is distinct from lower(old.email)
     or new.id          is distinct from old.id
  then
    raise exception '역할·상태·권한·이메일은 시스템 관리자만 변경할 수 있습니다.'
      using errcode = '42501';
  end if;

  return new;
end $$;

drop trigger if exists app_users_guard on app_users;
create trigger app_users_guard before update on app_users
  for each row execute function guard_app_users_privileged_columns();

create policy app_users_admin_write on app_users
  for all to authenticated
  using (is_system_admin())
  with check (is_system_admin());

-- 최초 로그인 시 auth.users 에는 있으나 app_users 에 행이 없는 경우,
-- 본인 행을 스스로 한 번 만들 수 있게 한다 (초대 수락 직후 상황).
create policy app_users_bootstrap on app_users
  for insert to authenticated
  with check (auth_uid = auth.uid());

-- ---------------------------------------------------------------------------
-- 레거시 app_data: 롤백용 원본이므로 읽기만 남기고 쓰기는 차단한다.
--                 (테이블 자체는 삭제하지 않는다 — 관리자 승인 후 별도 정리)
-- ---------------------------------------------------------------------------
alter table app_data enable row level security;

drop policy if exists app_data_read_only on app_data;
drop policy if exists app_data_no_write  on app_data;

create policy app_data_read_only on app_data
  for select to authenticated using (is_active_member());

-- ---------------------------------------------------------------------------
-- 비로그인(anon) 권한 회수
--
-- RLS 만으로도 행은 걸러지지만, 테이블 권한 자체를 빼 두면 정책을 하나 잘못
-- 쓰더라도 로그인하지 않은 요청이 데이터에 닿지 않는다.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  for t in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

revoke execute on function is_system_admin(), is_active_member() from anon, public;
grant  execute on function is_system_admin(), is_active_member() to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: 다른 사용자의 변경을 즉시 반영하기 위한 발행 설정
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  -- Supabase 프로젝트가 아니면 이 publication 이 없다. 그럴 땐 조용히 건너뛴다.
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'supabase_realtime publication 없음 — Realtime 등록을 건너뜁니다.';
    return;
  end if;

  foreach t in array array[
    'positions', 'position_levels', 'position_history', 'position_assignments',
    'candidates', 'candidate_analyses', 'candidate_reports',
    'interviewers', 'interviewer_availability', 'interview_types',
    'interview_appointments', 'core_interview_results',
    'assignment_interview_results', 'app_users', 'audit_log'
  ]
  loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;
