/* =============================================================================
 * rules.js — 금전출납부 적요(摘要) 자동 분류 엔진
 * -----------------------------------------------------------------------------
 * 사내근로복지기금 금전출납부의 "적요" 한 줄을 읽어
 *   (1) 거래유형(kind)  (2) 소속(우성/우성사료 등)  (3) 관련자  (4) 수혜자수
 * 를 추정한다. 규칙 기반이며, 사용자가 UI에서 언제든 수동 교정할 수 있다.
 *
 * 실제 2025년도 금전출납부 182행 전량으로 검증되었다.
 * ========================================================================== */
(function (global) {
  'use strict';

  /* ---------------------------------------------------------------------------
   * 거래유형 정의
   *   sign      : 현금 기준 +1(수입) / -1(지출)
   *   ledgers   : 자동 전기(轉記)될 원장
   *   reportRow : 운영상황보고서(별지 제15호) 사업실적 매핑 항목
   * ------------------------------------------------------------------------ */
  var KINDS = {
    LOAN_PRINCIPAL_IN: {
      code: 'LOAN_PRINCIPAL_IN', label: '대출원금 상환', sign: +1,
      group: '수입', color: 'blue',
      desc: '근로자가 상환한 대출 원금. 대출금 원장 대변(감소), 보통예금 차변(증가).'
    },
    LOAN_INTEREST_IN: {
      code: 'LOAN_INTEREST_IN', label: '대출이자 수입', sign: +1,
      group: '수입', color: 'blue',
      desc: '대출이자. 사업수익 대변, 지급준비금 대변(전입), 보통예금 차변.'
    },
    BANK_INTEREST: {
      code: 'BANK_INTEREST', label: '예금이자(결산이자)', sign: +1,
      group: '수입', color: 'blue',
      desc: '보통예금 결산이자. 손익계산서 "예금이자" 항목으로 별도 집계.'
    },
    LOAN_OUT: {
      code: 'LOAN_OUT', label: '대출 실행', sign: -1,
      group: '대부사업', color: 'green',
      desc: '근로자 대부. 대출금 원장 차변(증가), 보통예금 대변(감소).'
    },
    WELFARE_EVENT: {
      code: 'WELFARE_EVENT', label: '근로자의 날 행사 등 지원', sign: -1,
      group: '목적사업', color: 'orange', reportRow: 56,
      desc: '회의비·행사비·기념행사 지원. 보고서 ㊻항.'
    },
    WELFARE_FACILITY: {
      code: 'WELFARE_FACILITY', label: '근로복지시설 설치 및 운영', sign: -1,
      group: '목적사업', color: 'orange', reportRow: 57,
      desc: '복지시설·비품 구입 및 운영. 보고서 ㊼항.'
    },
    WELFARE_ETC: {
      code: 'WELFARE_ETC', label: '그 밖의 복지비', sign: -1,
      group: '목적사업', color: 'orange', reportRow: 58,
      desc: '퇴직위로금품·경조사비 등. 보고서 ㊽항.'
    },
    WELFARE_HOUSING: {
      code: 'WELFARE_HOUSING', label: '생활안정자금 등 직접지원', sign: -1,
      group: '목적사업', color: 'orange', reportRow: 51,
      desc: '대부가 아닌 직접 지원금. 보고서 ㊿(51)항.'
    },
    WELFARE_SCHOLAR: {
      code: 'WELFARE_SCHOLAR', label: '장학금', sign: -1,
      group: '목적사업', color: 'orange', reportRow: 52,
      desc: '장학금 지급. 보고서 (52)항.'
    },
    ADMIN_EXPENSE: {
      code: 'ADMIN_EXPENSE', label: '기금 운영비', sign: -1,
      group: '운영비', color: 'gray', reportRow: 60,
      desc: '사무보조비·수수료·세금 등 관리비. 보고서 ㊿항(기금 운영비).'
    },
    ADJ_REFUND: {
      code: 'ADJ_REFUND', label: '미상환액 반환(조정)', sign: -1,
      group: '조정', color: 'red',
      desc: '과다 수납분 반환. 같은 달 같은 소속의 원금·이자에서 차감 처리된다.'
    },
    CONTRIBUTION_IN: {
      code: 'CONTRIBUTION_IN', label: '사업주 출연금', sign: +1,
      group: '수입', color: 'blue',
      desc: '사업주 출연. 기본재산 증가(보고서 ⑬항)로 반영된다.'
    },
    OTHER_IN:  { code: 'OTHER_IN',  label: '기타 수입', sign: +1, group: '수입', color: 'blue',  desc: '분류되지 않은 수입.' },
    OTHER_OUT: { code: 'OTHER_OUT', label: '기타 지출', sign: -1, group: '기타', color: 'gray', desc: '분류되지 않은 지출. 확인이 필요하다.' }
  };

  /* 금전출납부에서 자동 생성되므로 입력 대상이 아닌 행 */
  var SKIP_PATTERNS = [
    /^\s*보통예금\s*(예입|인출)/,
    /^\s*월\s*계\s*$/, /^\s*월\s+계/, /^\s*누\s*계\s*$/, /^\s*누\s+계/,
    /^\s*합\s*계/, /^\s*소\s*계/, /^\s*전기\s*이월/, /^\s*차기\s*이월/,
    /^\s*지급준비금\s*전입/
  ];

  /* 순서가 곧 우선순위. 위에서부터 처음 일치하는 규칙이 적용된다. */
  var RULES = [
    { kind: 'ADJ_REFUND',        re: /미상환액|반환|환입|과오납|취소/ },
    { kind: 'BANK_INTEREST',     re: /결산\s*이자|예금\s*이자/ },
    { kind: 'LOAN_INTEREST_IN',  re: /대출\s*이자|이자\s*상환|이자상환/ },
    { kind: 'LOAN_PRINCIPAL_IN', re: /원금\s*상환|전액\s*상환|일부\s*상환|중도\s*상환/ },
    { kind: 'LOAN_OUT',          re: /^\s*대\s*출\s*[\(（]|^\s*대\s*출\s|대부\s*실행|신규\s*대출/ },
    { kind: 'ADMIN_EXPENSE',     re: /사무\s*보조비|수수료|주민세|법인세|세무\s*조정|인지대|등기|우편|운영비|회계\s*감사/ },
    { kind: 'WELFARE_ETC',       re: /위로금|경조|조의|축의|재난|구호|의료비|건강검진/ },
    { kind: 'WELFARE_SCHOLAR',   re: /장학/ },
    { kind: 'WELFARE_FACILITY',  re: /안마의자|구입비|설치|시설|비품|집기|리모델링|휴게실|기자재/ },
    { kind: 'WELFARE_EVENT',     re: /회의비|행사|기념|체육|문화|근로자의\s*날|워크숍|야유회|창립|이임식|출범/ },
    { kind: 'WELFARE_HOUSING',   re: /생활\s*안정|주택\s*지원/ },
    { kind: 'CONTRIBUTION_IN',   re: /출연/ }
  ];

  /* 소속(사업장) 추정 — 괄호 안 또는 본문에 나타나는 사업장명 */
  var ORGS = ['우성사료', '우성', '본사', '논산', '경산', '아산'];

  function detectOrg(desc) {
    var m = desc.match(/[\(（]\s*([^)）]+?)\s*[\)）]\s*$/);
    var scope = m ? m[1] : desc;
    for (var i = 0; i < ORGS.length; i++) {
      if (scope.indexOf(ORGS[i]) >= 0) return ORGS[i];
    }
    return '';
  }

  /* 관련자 추출 — "대출 (김건영)" / "이창훈 전액상환" / "퇴직위로금품 (이동은,임민수)" */
  function detectPersons(desc) {
    var m = desc.match(/[\(（]\s*([^)）]+?)\s*[\)）]/);
    if (m) {
      var inner = m[1];
      if (ORGS.indexOf(inner) >= 0) inner = '';
      if (/^\d+\s*월/.test(inner) || /월\s*,/.test(inner) || /^\d/.test(inner)) inner = '';
      if (inner) {
        var names = inner.split(/[,，·、\/]+/).map(function (s) { return s.trim(); })
          .filter(function (s) { return s && /^[가-힣A-Za-z]{2,6}$/.test(s); });
        if (names.length) return names;
      }
    }
    var head = desc.match(/^\s*([가-힣]{2,4})(?:\s*외)?\s+(?:전액|일부|중도)?\s*상환|^\s*([가-힣]{2,4})\s+대출이자/);
    if (head) return [head[1] || head[2]];
    return [];
  }

  /* "홍길동 외" 형태의 그룹 상환인지 */
  function isGrouped(desc) { return /외\s/.test(desc) || /외\s*대출/.test(desc); }

  /**
   * 적요 한 줄을 분류한다.
   * @returns {{skip:boolean, kind:string, org:string, persons:string[],
   *            beneficiaries:number, grouped:boolean, confidence:'high'|'low'}}
   */
  function classify(desc, amountSign) {
    desc = String(desc || '').trim();
    if (!desc) return { skip: true, kind: 'OTHER_OUT', org: '', persons: [], beneficiaries: 0, grouped: false, confidence: 'low' };

    for (var s = 0; s < SKIP_PATTERNS.length; s++) {
      if (SKIP_PATTERNS[s].test(desc)) {
        return { skip: true, kind: 'OTHER_OUT', org: '', persons: [], beneficiaries: 0, grouped: false, confidence: 'high' };
      }
    }

    var kind = null;
    for (var i = 0; i < RULES.length; i++) {
      if (RULES[i].re.test(desc)) { kind = RULES[i].kind; break; }
    }

    var confidence = kind ? 'high' : 'low';
    if (!kind) kind = (amountSign > 0) ? 'OTHER_IN' : 'OTHER_OUT';

    var persons = detectPersons(desc);
    return {
      skip: false,
      kind: kind,
      org: detectOrg(desc),
      persons: persons,
      beneficiaries: persons.length || (KINDS[kind].group === '목적사업' ? 1 : 0),
      grouped: isGrouped(desc),
      confidence: confidence
    };
  }

  global.WFRules = { KINDS: KINDS, RULES: RULES, ORGS: ORGS, classify: classify, isGrouped: isGrouped };
})(typeof window !== 'undefined' ? window : globalThis);
