/* 회귀 검증 — 2025년도 실제 금전출납부 106건을 엔진에 투입하여
 * 원본 결산자료(재무상태표/손익계산서/시산표) 및 제출된 운영상황 보고서와
 * 전 항목이 원 단위까지 일치하는지 확인한다.  실행:  node test/verify.js      */
global.window = global;
require('../rules.js'); require('../engine.js');
var raw = require('./fixture-2025.json');

/* 소속 태그가 적요에 없는 정기 상환분 보정 (원장상 우성/우성사료 구분) */
var entries = raw.map(function (e, i) {
  var c = window.WFRules.classify(e.desc, /상환|이자/.test(e.desc) ? 1 : -1);
  var org = c.org;
  if (!org && /박준서 외/.test(e.desc)) org = '우성';
  if (!org && /(오미르|안동현) 외/.test(e.desc)) org = '우성사료';
  var b = c.beneficiaries;
  if (/안마의자/.test(e.desc)) b = 35;                       // 이용 인원(사업장 신고치)
  if (/회의비/.test(e.desc)) b = 8;
  if (/40주년 행사비/.test(e.desc)) b = 8;
  if (/이임식/.test(e.desc)) b = 4;
  var out = { id: 'e' + i, m: e.m, d: e.d, desc: e.desc, amount: e.amount,
              kind: c.kind, org: org, persons: c.persons, beneficiaries: b, grouped: c.grouped };
  if (c.kind === 'ADJ_REFUND') { out.adjOrg = '우성'; out.refundPrincipal = 500000; out.refundInterest = 7640; }
  return out;
});

var loans = [
  ['우성',20000000,17900000],['우성',23000000,15500000],['우성',30000000,30000000],['우성',30000000,21500000],
  ['우성',30000000,2000000],['우성',20000000,15520000],['우성',30000000,15000000],['우성',30000000,28760000],
  ['본사',30000000,20000000],['본사',30000000,25500000],['본사',30000000,3500000],['본사',30000000,30000000],
  ['본사',30000000,13500000],['본사',20000000,18320000],
  ['논산1본부',30000000,12500000],['논산1본부',20000000,2360000],['논산1본부',30000000,24000000],
  ['논산1본부',20000000,4460000],['논산1본부',30000000,28500000],['논산1본부',20000000,17060000],
  ['논산1본부',10000000,1600000],['논산1본부',30000000,11500000],['논산1본부',20000000,1100000],
  ['경산2본부',30000000,13000000],['경산2본부',20000000,12160000],['경산2본부',30000000,6500000],
  ['경산2본부',30000000,1000000],['경산2본부',30000000,29170000],['경산2본부',20000000,16220000],
  ['아산3본부',24000000,16500000],['아산3본부',30000000,19500000],['아산3본부',30000000,19500000],
  ['아산3본부',30000000,18000000],['아산3본부',30000000,12500000],['아산3본부',30000000,23180000],
  ['아산3본부',30000000,27500000],['아산3본부',30000000,7500000],['아산3본부',20000000,14960000],
  ['아산3본부',30000000,16500000],['아산3본부',20000000,5300000],['아산3본부',30000000,22000000],
  ['아산3본부',30000000,21000000]
].map(function (x, i) { return { org: x[0], name: '차주' + (i + 1), principal: x[1], balance: x[2] }; });

var r = window.WFEngine.compute({
  year: 2025,
  info: { basicAssetPrev: 701963 },
  opening: { bank: 15352579, loan: 662950000, reserve: 78302579, capital: 600000000, retained: 0, prepaidTax: 0 },
  entries: entries, loans: loans
});

var pass = 0, fail = 0;
function eq(label, got, want) {
  var ok = got === want;
  ok ? pass++ : fail++;
  console.log((ok ? '  ✓ ' : '  ✗ ') + label.padEnd(42) +
    String(got).padStart(15) + (ok ? '' : '   (기대: ' + want + ')'));
}
var g = function (s) { console.log('\n' + s); };

g('── 원장 기말잔액 ───────────────────────────────────');
eq('보통예금 잔액', r.bank.closing, 5006982);
eq('대출금 잔액', r.loan.closing, 662070000);
eq('지급준비금 잔액', r.reserve.closing, 67076982);
eq('사업수익 누계', r.revenue.total, 19409813);

g('── 합계잔액시산표 ─────────────────────────────────');
eq('보통예금 차변합계', r.trial.accounts[1].drSum, 376150032);
eq('보통예금 대변합계', r.trial.accounts[1].crSum, 371143050);
eq('대출금 차변합계', r.trial.accounts[2].drSum, 1002950000);
eq('대출금 대변합계', r.trial.accounts[2].crSum, 340880000);
eq('지급준비금 차변합계', r.trial.accounts[4].drSum, 30635410);
eq('지급준비금 대변합계', r.trial.accounts[4].crSum, 97712392);
eq('차변합계 총계', r.trial.total.drSum, 1429145255);
eq('대변합계 총계', r.trial.total.crSum, 1429145255);
eq('차변잔액 총계', r.trial.total.drBal, 667076982);
eq('대변잔액 총계', r.trial.total.crBal, 667076982);

g('── 재무상태표 ─────────────────────────────────────');
eq('유동자산', r.bs.cur.currentAssets, 667076982);
eq('자산총계', r.bs.cur.totalAssets, 667076982);
eq('부채총계(지급준비금)', r.bs.cur.totalLiab, 67076982);
eq('자본총계', r.bs.cur.totalEquity, 600000000);
eq('대차 차액(0이어야 함)', r.bs.cur.diff, 0);

g('── 손익계산서 ─────────────────────────────────────');
eq('사업수익', r.pl.revenueTotal, 19409813);
eq('  대출금이자', r.pl.loanInterest, 19392050);
eq('  예금이자', r.pl.depositInterest, 17763);
eq('사업비용(지급준비금 전입액)', r.pl.expenseTotal, 19409813);
eq('당기순이익', r.pl.netIncome, 0);

g('── 운영상황 보고서 (별지 제15호, 천원) ──────────────');
var R = r.report;
eq('⑳ 기본재산 총액', R.c20, 701963);
eq('㉑ 금융회사 예입·예탁', R.c21, 39893);
eq('㉗ 근로자 대부', R.c27, 662070);
eq('㉘ 합계', R.c28, 701963);
eq('㉙ 기금운용 수익금', R.c29, 19409);
eq('㉞ 이월금 등', R.c34, 15352);
eq('㉟ 재원 합계', R.c35, 696831);
eq('㊾ 주택구입·임차자금 금액', R.rows[49].amount, 662070);
eq('㊾ 주택구입·임차자금 인원', R.rows[49].people, 42);
eq('㊻ 근로자의 날 행사 등', R.rows[56].amount, 5631);
eq('㊼ 근로복지시설', R.rows[57].amount, 19206);
eq('㊽ 그 밖의 복지비', R.rows[58].amount, 5000);
eq('㊽ 그 밖의 복지비 인원', R.rows[58].people, 5);
eq('(59) 소계 금액', R.c59.amount, 691907);
eq('(59) 소계 인원', R.c59.people, 137);
eq('(59) 목적사업 금액', R.c59.purposeAmount, 29837);
eq('(59) 목적사업 인원', R.c59.purposePeople, 95);
eq('(59) 대부사업 금액', R.c59.loanAmount, 662070);
eq('㊿ 기금 운영비', R.c60, 798);
eq('(61) 잔액', R.c61, 4126);
eq('(62) 합계', R.c62, 696831);

g('── 월별 금전출납부 수입=지출 ────────────────────────');
var expect = [50999190,44253620,80965245,41702560,43776740,23873280,98859750,61358380,66380122,61187250,51287600,107296766];
r.cashBook.months.forEach(function (mm, i) { eq(mm.m + '월 월계', mm.sumIn, expect[i]); });
eq('누계', r.cashBook.totalIn, 731940503);

g('── 검증 항목 ──────────────────────────────────────');
r.validation.forEach(function (v) {
  console.log('  [' + v.level.toUpperCase().padEnd(5) + '] ' + v.title + ' — ' + v.detail);
});

console.log('\n═════════════════════════════════════════════════════');
console.log(' 결과:  통과 ' + pass + '건 / 실패 ' + fail + '건');
console.log('═════════════════════════════════════════════════════');
process.exit(fail ? 1 : 0);
