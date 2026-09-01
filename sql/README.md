# Supabase 스키마 · 마이그레이션

`app_data(key, value JSON)` 한 테이블에 배열 전체를 JSON으로 저장하던 방식을
엔티티별 테이블 · 행 단위 저장으로 옮기는 스크립트입니다.

## 왜 바꾸나

기존 저장 경로는 `app_data` 의 한 행(예: `wm_matching`)에 지원자 **전체 배열**을
통째로 덮어썼습니다. A가 3번 지원자를, B가 7번 지원자를 같은 시간에 고치면
나중에 저장한 쪽이 상대 작업까지 통으로 되돌려버렸습니다. 경고도 없었습니다.

이제는 바뀐 행만 `insert / update / delete` 합니다. 서로 다른 행을 고치는 한
충돌하지 않습니다.

## 실행 순서

Supabase 대시보드 → SQL Editor 에서 **순서대로** 실행합니다.

| 파일 | 내용 |
|---|---|
| `001_schema.sql` | 정규화 테이블 17개 + 인덱스 + `updated_at` 트리거 생성 |
| `002_migrate_app_data.sql` | 기존 `app_data` JSON → 새 테이블로 행 단위 적재 |
| `003_rls.sql` | RLS 정책, 계정 연결 함수, Realtime 발행 설정 |

세 스크립트 모두 **여러 번 실행해도 안전합니다**(멱등). `002` 는 대상 테이블이
비어 있을 때만 적재하므로 재실행해도 중복이 생기지 않습니다.

## 안전장치

- **`app_data` 는 삭제하지 않습니다.** 읽기만 하고 원본 그대로 남겨 둡니다.
  롤백이 필요하면 이 테이블이 기준입니다. 정리는 충분히 검증한 뒤 별도로
  판단하세요 (`003` 적용 후에는 읽기 전용이 됩니다).
- `002` 는 전체가 하나의 트랜잭션이라, 중간에 실패하면 아무것도 반영되지 않습니다.
- `002` 마지막에 검증 쿼리가 나옵니다. **`migrated` 와 `source` 가 모두 같아야**
  정상입니다. 다르면 `commit` 된 데이터를 지우지 말고 원인을 먼저 확인하세요.

## 적용 후 확인할 것

1. `003` 을 적용하면 **로그인 전에는 데이터가 조회되지 않습니다.** `app.js` 도
   "로그인 → 계정 연결 → 데이터 조회" 순서로 함께 바뀌어 있어야 합니다.
2. 첫 로그인 때 `link_current_user()` 가 기존 `app_users` 행에 `auth_uid` 를
   연결합니다. 이게 되어야 RLS 정책을 통과합니다.
3. `app_users` 가 완전히 비어 있는 상태에서 처음 로그인한 계정은 자동으로
   `시스템 관리자` 가 됩니다. 그 이후 로그인은 `HR 관리자` 입니다.

## 테이블 구성

```
positions ──┬── position_levels        (레벨: 신입/주니어/시니어…)
            ├── position_history       (설계시트 개정 이력)
            └── position_assignments   (포지션별 과제)

candidates ─┬── candidate_resumes      (이력서 원문 — 용량이 커서 분리)
            ├── candidate_analyses     (f1~f6 점수 · 피드백)
            └── candidate_reports      (면접 질문 리포트)

interviewers · interviewer_availability · interview_types · interview_appointments
core_interview_results        (코어 면접 평가)
assignment_interview_results  (과제 면접 평가)
app_users · audit_log · backup_snapshots
```

`candidates` 에서 이력서 원문을 떼어낸 이유는 지원자 목록 조회가 매번 원문
전체를 끌고 오지 않게 하기 위해서입니다.

## 권한 요약

| 대상 | 권한 |
|---|---|
| 비로그인(anon) | 접근 불가 (테이블 권한 자체를 회수) |
| 활성 구성원 | 업무 데이터 읽기/쓰기 |
| 비활성 계정 | 로그인은 되지만 데이터는 보이지 않음 |
| 감사 로그 | 읽기 + 추가만. 수정·삭제 불가 |
| 역할/상태/권한 변경 | 시스템 관리자만 (트리거로 자기 승격 차단) |
| `app_data` (레거시) | 읽기 전용 |
