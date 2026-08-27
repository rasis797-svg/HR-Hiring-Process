/* =============================================================================
 * app.js — 복지기금 운영 효율화 프로그램 UI
 * 저장소: localStorage('wf_<연도>')  ·  계산: WFEngine.compute()
 * ========================================================================== */
(function (global) {
  'use strict';

  var K = global.WFRules.KINDS;
  var ENGINE = global.WFEngine;
  var MONTH_NAMES = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

  var S = null;        /* 현재 연도 상태 */
  var C = null;        /* 계산 결과 */
  var page = 'dashboard';
  var curMonth = new Date().getMonth() + 1;
  var curLedger = 'bank';

  /* ── 유틸 ───────────────────────────────────────────────────────────── */
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
    });
  };
  var num = function (v) { var x = Number(String(v).replace(/[^0-9.\-]/g, '')); return isFinite(x) ? Math.round(x) : 0; };
  var fmt = function (v) { return v === 0 || v == null ? '' : Number(v).toLocaleString('ko-KR'); };
  var fmt0 = function (v) { return Number(v || 0).toLocaleString('ko-KR'); };
  var uid = function () { return 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); };

  function toast(msg) {
    var t = document.createElement('div');
    t.className = 'toast'; t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2200);
  }

  /* ── 상태 ───────────────────────────────────────────────────────────── */
  function blank(year) {
    return {
      year: year,
      info: {
        name: '', license: '', regDate: '', tel: '', addr: '',
        ceo: '', industry: '', workers: 0, partnerWorkers: 0, capitalPaid: 0,
        basicAssetPrev: 0, basicAssetIncOwner: 0, basicAssetIncProfit: 0,
        basicAssetIncOther: 0, basicAssetIncMerge: 0, basicAssetUse: 0, basicAssetSplit: 0
      },
      opening: ENGINE.emptyOpening(),
      entries: [], loans: []
    };
  }
  var keyOf = function (y) { return 'wf_' + y; };

  function load(year) {
    try {
      var raw = localStorage.getItem(keyOf(year));
      if (raw) {
        var o = JSON.parse(raw);
        o.year = year;
        o.info = Object.assign(blank(year).info, o.info || {});
        o.opening = Object.assign(ENGINE.emptyOpening(), o.opening || {});
        o.entries = o.entries || []; o.loans = o.loans || [];
        return o;
      }
    } catch (e) { /* 손상된 데이터는 무시하고 새로 시작 */ }
    return blank(year);
  }
  function save() {
    try { localStorage.setItem(keyOf(S.year), JSON.stringify(S)); }
    catch (e) { toast('저장 실패: 브라우저 저장공간을 확인하세요'); }
  }
  function years() {
    var set = {}, now = new Date().getFullYear();
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (/^wf_\d{4}$/.test(k)) set[k.slice(3)] = 1;
    }
    for (var y = now - 2; y <= now + 1; y++) set[y] = 1;
    return Object.keys(set).map(Number).sort(function (a, b) { return b - a; });
  }

  /* ── 렌더 진입점 ────────────────────────────────────────────────────── */
  function render() {
    C = ENGINE.compute(S);
    ({ dashboard: renderDash, cashbook: renderCashbook, loans: renderLoans,
       settings: renderSettings, ledger: renderLedger, closing: renderClosing,
       report: renderReport, verify: renderVerify, help: renderHelp }[page] || function () {})();
  }

  function nav(p) {
    page = p;
    Array.prototype.forEach.call(document.querySelectorAll('.page'), function (el) { el.classList.remove('on'); });
    Array.prototype.forEach.call(document.querySelectorAll('.side a'), function (el) {
      el.classList.toggle('on', el.getAttribute('data-page') === p);
    });
    $('pg-' + p).classList.add('on');
    render();
  }

  /* ── 대시보드 ───────────────────────────────────────────────────────── */
  function renderDash() {
    var bs = C.bs.cur, R = C.report;
    $('dash-sub').textContent =
      (S.info.name || '기금법인명 미입력') + ' · ' + S.year + '회계연도 (' + S.year + '. 1. 1. ~ ' + S.year + '. 12. 31.) · 거래 ' + C.entries.length + '건';

    $('dash-stats').innerHTML = [
      ['자산총계', fmt0(bs.totalAssets) + '원', '보통예금 + 대출금', 'b'],
      ['대출금 잔액', fmt0(C.loan.closing) + '원', C.loanRoster.count + '명 대부 중', 'g'],
      ['보통예금 잔액', fmt0(C.bank.closing) + '원', '기말 현재', 'b'],
      ['지급준비금', fmt0(C.reserve.closing) + '원', '전기 ' + fmt0(S.opening.reserve) + '원', 'o'],
      ['당기 사업수익', fmt0(C.revenue.total) + '원', '대출이자 + 예금이자', 'g'],
      ['당기 기금사용액', fmt0(C.reserve.totalDr) + '원', '목적사업비 + 운영비', 'r']
    ].map(function (s) {
      return '<div class="stat ' + s[3] + '"><div class="k">' + s[0] + '</div><div class="v">' + s[1] + '</div><div class="d">' + s[2] + '</div></div>';
    }).join('');

    var flow = '<table class="tbl"><thead><tr><th>월</th><th class="num">수입</th><th class="num">지출</th><th class="num">보통예금 잔액</th></tr></thead><tbody>';
    C.cashBook.months.forEach(function (mm, i) {
      var bank = C.bank.months[i];
      flow += '<tr><td>' + MONTH_NAMES[i] + '</td><td class="num">' + fmt(mm.sumIn) + '</td><td class="num">' + fmt(mm.sumOut) +
              '</td><td class="num">' + fmt0(bank.cumBalance) + '</td></tr>';
    });
    flow += '<tr class="tot"><td>누계</td><td class="num">' + fmt0(C.cashBook.totalIn) + '</td><td class="num">' + fmt0(C.cashBook.totalOut) +
            '</td><td class="num">' + fmt0(C.bank.closing) + '</td></tr></tbody></table>';
    $('dash-flow').innerHTML = flow;

    var uses = [[56,'근로자의 날 행사 등'],[57,'근로복지시설'],[58,'그 밖의 복지비'],[51,'생활안정자금'],[52,'장학금']];
    var use = '<table class="tbl"><thead><tr><th>구분</th><th class="num">금액(원)</th><th class="num">수혜자</th></tr></thead><tbody>';
    uses.forEach(function (u) {
      var row = R.rows[u[0]];
      if (!row.amount && !row.people) return;
      use += '<tr><td>' + u[1] + '</td><td class="num">' + fmt0(row.amount * 1000) + '</td><td class="num">' + row.people + '명</td></tr>';
    });
    use += '<tr><td>기금 운영비</td><td class="num">' + fmt0(R.c60 * 1000) + '</td><td class="num">-</td></tr>';
    use += '<tr class="sum"><td>합계</td><td class="num">' + fmt0(C.reserve.totalDr) + '</td><td class="num">' + R.c59.purposePeople + '명</td></tr>';
    use += '</tbody></table><div style="margin-top:12px"><table class="tbl"><tbody>' +
      '<tr><td>대부사업 (주택구입·임차자금)</td><td class="num">' + fmt0(C.loan.closing) + '원</td><td class="num">' + C.loanRoster.count + '명</td></tr>' +
      '</tbody></table></div>';
    $('dash-use').innerHTML = use;

    $('dash-check').innerHTML = checkHtml(C.validation);
  }

  function checkHtml(list) {
    var ic = { ok: '✓', warn: '!', error: '✕', info: 'i' };
    return list.map(function (v) {
      return '<div class="chk ' + v.level + '"><span class="ic">' + ic[v.level] + '</span><div><b>' + esc(v.title) + '</b><span>' + esc(v.detail) + '</span></div></div>';
    }).join('');
  }

  /* ── 금전출납부 ─────────────────────────────────────────────────────── */
  function renderCashbook() {
    var counts = {};
    C.entries.forEach(function (e) { counts[e.m] = (counts[e.m] || 0) + 1; });
    $('cb-months').innerHTML = MONTH_NAMES.map(function (nm, i) {
      var m = i + 1;
      return '<button class="' + (m === curMonth ? 'on' : '') + '" onclick="WF.setMonth(' + m + ')">' + nm +
             (counts[m] ? '<span class="n">' + counts[m] + '</span>' : '') + '</button>';
    }).join('');

    if ($('cb-preview').checked) { renderCashbookPreview(); return; }

    var rows = S.entries.filter(function (e) { return Number(e.m) === curMonth; });
    if (!rows.length) {
      $('cb-body').innerHTML = '<div class="empty"><div class="big">＋</div>' + curMonth +
        '월 거래가 없습니다.<br />「거래 추가」 또는 「여러 줄 붙여넣기」로 입력하세요.</div>';
      return;
    }
    var kindOpts = Object.keys(K).map(function (k) { return { v: k, t: K[k].label }; });
    var orgOpts = [''].concat(global.WFRules.ORGS);

    var h = '<table class="tbl etbl"><thead><tr>' +
      '<th style="width:52px">일</th><th style="width:30%">적요</th><th style="width:110px" class="num">금액</th>' +
      '<th style="width:170px">거래유형</th><th style="width:96px">소속</th><th style="width:74px" class="num">수혜자수</th>' +
      '<th style="width:56px">구분</th><th style="width:40px"></th></tr></thead><tbody>';

    rows.forEach(function (e) {
      var kd = K[e.kind] || K.OTHER_OUT;
      var low = e.kind === 'OTHER_IN' || e.kind === 'OTHER_OUT';
      var needB = kd.group === '목적사업' && !num(e.beneficiaries);
      h += '<tr class="' + (low ? 'lowconf' : '') + '">' +
        '<td><input class="num" value="' + esc(e.d || '') + '" onchange="WF.setEntry(\'' + e.id + '\',\'d\',this.value)" /></td>' +
        '<td><input value="' + esc(e.desc) + '" onchange="WF.setDesc(\'' + e.id + '\',this.value)" placeholder="예) 홍길동 외 대출원금 상환" /></td>' +
        '<td><input class="num" value="' + fmt(e.amount) + '" onchange="WF.setEntry(\'' + e.id + '\',\'amount\',this.value)" /></td>' +
        '<td><select onchange="WF.setEntry(\'' + e.id + '\',\'kind\',this.value)">' +
          kindOpts.map(function (o) { return '<option value="' + o.v + '"' + (o.v === e.kind ? ' selected' : '') + '>' + o.t + '</option>'; }).join('') +
        '</select></td>' +
        '<td><select onchange="WF.setEntry(\'' + e.id + '\',\'org\',this.value)">' +
          orgOpts.map(function (o) { return '<option value="' + o + '"' + (o === (e.org || '') ? ' selected' : '') + '>' + (o || '—') + '</option>'; }).join('') +
        '</select></td>' +
        '<td><input class="num" style="' + (needB ? 'background:#fff3e0' : '') + '" value="' + (e.beneficiaries || '') +
          '" onchange="WF.setEntry(\'' + e.id + '\',\'beneficiaries\',this.value)" /></td>' +
        '<td><span class="bdg ' + kd.color + '">' + (kd.sign > 0 ? '수입' : '지출') + '</span></td>' +
        '<td><button class="btn sm danger" onclick="WF.delEntry(\'' + e.id + '\')">×</button></td></tr>';
      if (e.kind === 'ADJ_REFUND') {
        h += '<tr class="head"><td></td><td colspan="7" style="font-size:11.5px;color:#666;padding:4px 8px">' +
          '↳ 반환액 구성 &nbsp; 원금 <input class="num" style="width:110px;border:1px solid #ddd" value="' + fmt(e.refundPrincipal) +
          '" onchange="WF.setEntry(\'' + e.id + '\',\'refundPrincipal\',this.value)" /> 원 &nbsp; 이자 <input class="num" style="width:100px;border:1px solid #ddd" value="' +
          fmt(e.refundInterest) + '" onchange="WF.setEntry(\'' + e.id + '\',\'refundInterest\',this.value)" /> 원 ' +
          '&nbsp;— 같은 달 같은 소속의 상환액에서 차감됩니다.</td></tr>';
      }
    });

    var mm = C.cashBook.months[curMonth - 1];
    h += '<tr class="sum"><td colspan="2">월 계 (수입 = 지출)</td><td class="num">' + fmt0(mm.sumIn) +
         '</td><td colspan="5">' + (mm.sumIn === mm.sumOut ? '<span class="bdg green">일치</span>' :
         '<span class="bdg red">불일치 ' + fmt0(mm.sumIn - mm.sumOut) + '원</span>') + '</td></tr>';
    h += '</tbody></table>';
    $('cb-body').innerHTML = h;
  }

  function renderCashbookPreview() {
    var mm = C.cashBook.months[curMonth - 1];
    var h = '<table class="tbl"><thead><tr><th style="width:54px">연</th><th style="width:44px">월</th><th style="width:44px">일</th>' +
      '<th>적　요</th><th class="num" style="width:120px">수입금액</th><th class="num" style="width:120px">지출금액</th>' +
      '<th class="num" style="width:110px">차인잔액</th></tr></thead><tbody>';
    if (!mm.rows.length) h += '<tr><td colspan="7" class="empty">거래 없음</td></tr>';
    mm.rows.forEach(function (r, i) {
      h += '<tr class="' + (r.header ? 'head' : '') + '">' +
        '<td>' + (i === 0 ? S.year : '') + '</td><td>' + (i === 0 ? curMonth : '') + '</td><td>' + (r.d || '') + '</td>' +
        '<td class="' + (r.header ? '' : 'ind') + '">' + esc(r.desc) + '</td>' +
        '<td class="num">' + fmt(r.income) + '</td><td class="num">' + fmt(r.expense) + '</td><td></td></tr>';
    });
    h += '<tr class="sum"><td colspan="3"></td><td>월　　계</td><td class="num">' + fmt0(mm.sumIn) +
         '</td><td class="num">' + fmt0(mm.sumOut) + '</td><td class="num">' + fmt0(mm.balance) + '</td></tr>';
    h += '<tr class="sum2"><td colspan="3"></td><td>누　　계</td><td class="num">' + fmt0(mm.cumIn) +
         '</td><td class="num">' + fmt0(mm.cumOut) + '</td><td class="num">' + fmt0(mm.cumIn - mm.cumOut) + '</td></tr>';
    h += '</tbody></table>';
    $('cb-body').innerHTML = h;
  }

  /* ── 대출 내역서 ────────────────────────────────────────────────────── */
  function renderLoans() {
    var L = C.loanRoster, ok = L.totalBalance === C.loan.closing;
    $('loan-match').innerHTML = '<span class="bdg ' + (ok ? 'green' : 'red') + '">' +
      (ok ? '원장 잔액과 일치' : '원장 대비 ' + fmt0(L.totalBalance - C.loan.closing) + '원 차이') + '</span>';

    if (!S.loans.length) {
      $('loan-body').innerHTML = '<div class="empty"><div class="big">＋</div>등록된 대출이 없습니다.<br />「차주 추가」 또는 「출납부에서 신규 대출 반영」을 사용하세요.</div>';
      return;
    }
    var orgOpts = [''].concat(global.WFRules.ORGS.concat(['본사','논산1본부','경산2본부','아산3본부'])
      .filter(function (v, i, a) { return a.indexOf(v) === i; }));

    var h = '<table class="tbl etbl"><thead><tr><th style="width:130px">사업장</th><th style="width:130px">성명</th>' +
      '<th class="num" style="width:130px">대출금</th><th class="num" style="width:130px">잔액</th><th>비고</th><th style="width:40px"></th></tr></thead><tbody>';
    L.groups.forEach(function (g) {
      g.items.forEach(function (l) {
        h += '<tr>' +
          '<td><select onchange="WF.setLoan(\'' + l.id + '\',\'org\',this.value)">' +
            orgOpts.map(function (o) { return '<option value="' + o + '"' + (o === (l.org || '') ? ' selected' : '') + '>' + (o || '—') + '</option>'; }).join('') +
          '</select></td>' +
          '<td><input value="' + esc(l.name) + '" onchange="WF.setLoan(\'' + l.id + '\',\'name\',this.value)" /></td>' +
          '<td><input class="num" value="' + fmt(l.principal) + '" onchange="WF.setLoan(\'' + l.id + '\',\'principal\',this.value)" /></td>' +
          '<td><input class="num" value="' + fmt(l.balance) + '" onchange="WF.setLoan(\'' + l.id + '\',\'balance\',this.value)" /></td>' +
          '<td><input value="' + esc(l.note || '') + '" onchange="WF.setLoan(\'' + l.id + '\',\'note\',this.value)" placeholder="휴직(일시정지) 등" /></td>' +
          '<td><button class="btn sm danger" onclick="WF.delLoan(\'' + l.id + '\')">×</button></td></tr>';
      });
      h += '<tr class="sum"><td colspan="2">' + esc(g.org) + ' 소계</td><td class="num">' + fmt0(g.principal) +
           '</td><td class="num">' + fmt0(g.balance) + '</td><td colspan="2">' + g.items.length + '명</td></tr>';
    });
    h += '<tr class="tot"><td colspan="2">합　계</td><td class="num">' + fmt0(L.totalPrincipal) +
         '</td><td class="num">' + fmt0(L.totalBalance) + '</td><td colspan="2">' + L.count + '명</td></tr></tbody></table>';
    $('loan-body').innerHTML = h;
  }

  /* ── 설정 ───────────────────────────────────────────────────────────── */
  function field(label, path, type, hint) {
    var obj = path[0] === 'info' ? S.info : S.opening;
    var v = obj[path[1]];
    return '<div class="fg"><label class="f">' + label + (hint ? ' <span style="font-weight:400;color:#999">' + hint + '</span>' : '') + '</label>' +
      '<input class="f ' + (type === 'n' ? 'num' : '') + '" value="' + esc(type === 'n' ? fmt(v) : (v || '')) +
      '" onchange="WF.setField(\'' + path[0] + '\',\'' + path[1] + '\',this.value,\'' + type + '\')" /></div>';
  }

  function renderSettings() {
    $('set-info').innerHTML =
      field('① 기금법인명', ['info','name'], 't') +
      field('② 인가번호', ['info','license'], 't') +
      field('③ 설립등기일', ['info','regDate'], 't', '예) 1992. 10. 29.') +
      field('④ 전화번호', ['info','tel'], 't') +
      field('⑤ 소재지', ['info','addr'], 't') +
      field('⑦ 대표자', ['info','ceo'], 't') +
      field('⑧ 업종', ['info','industry'], 't') +
      field('⑨ 근로자 수(명)', ['info','workers'], 'n') +
      field('⑩ 협력업체 근로자 수(명)', ['info','partnerWorkers'], 'n') +
      field('⑪ 납입자본금(백만원)', ['info','capitalPaid'], 'n');

    $('set-open').innerHTML =
      field('보통예금', ['opening','bank'], 'n', '원 · 보고서 ㉞ 이월금') +
      field('대출금', ['opening','loan'], 'n', '원') +
      field('지급준비금', ['opening','reserve'], 'n', '원') +
      field('자본금', ['opening','capital'], 'n', '원') +
      field('이월이익잉여금', ['opening','retained'], 'n', '원') +
      field('선급법인세', ['opening','prepaidTax'], 'n', '원');

    $('set-basic').innerHTML =
      field('⑫ 직전 회계연도말 기본재산 총액', ['info','basicAssetPrev'], 'n', '천원') +
      '<div class="row">' +
        '<div>' + field('⑬ 사업주 출연', ['info','basicAssetIncOwner'], 'n', '천원') + '</div>' +
        '<div>' + field('⑭ 수익금·이월금 전입', ['info','basicAssetIncProfit'], 'n', '천원') + '</div>' +
      '</div><div class="row">' +
        '<div>' + field('⑮ 사업주 외의 자 출연', ['info','basicAssetIncOther'], 'n', '천원') + '</div>' +
        '<div>' + field('⑯ 기금법인 합병', ['info','basicAssetIncMerge'], 'n', '천원') + '</div>' +
      '</div><div class="row">' +
        '<div>' + field('⑰ 기본재산 사용', ['info','basicAssetUse'], 'n', '천원') + '</div>' +
        '<div>' + field('⑱ 기금법인 분할 등', ['info','basicAssetSplit'], 'n', '천원') + '</div>' +
      '</div>' +
      '<div class="fg"><label class="f">⑲ 소계 / ⑳ 해당 회계연도말 총액 <span style="font-weight:400;color:#999">자동</span></label>' +
      '<input class="f num" readonly value="' + fmt0(C.report.c19) + ' / ' + fmt0(C.report.c20) + '" /></div>' +
      '<p class="hint">㉑ 금융회사 예입·예탁은 <b>⑳ − ㉗(대출금 잔액)</b>으로 자동 산출됩니다.</p>';
  }

  /* ── 원장 ───────────────────────────────────────────────────────────── */
  var LEDGERS = [
    { k: 'bank',    t: '보통예금',  d: 'D' },
    { k: 'loan',    t: '대출금',    d: 'D' },
    { k: 'reserve', t: '지급준비금', d: 'C' },
    { k: 'revenue', t: '사업수익',  d: 'C' }
  ];

  function renderLedger() {
    $('lg-tabs').innerHTML = LEDGERS.map(function (l) {
      return '<button class="btn ' + (curLedger === l.k ? 'dark' : '') + '" onclick="WF.setLedger(\'' + l.k + '\')">' + l.t + '</button>';
    }).join('') + '<span class="sp"></span><span class="bdg gray">기말잔액 ' +
      fmt0(C[curLedger].closing != null ? C[curLedger].closing : C.revenue.total) + '원</span>';

    var L = C[curLedger], def = LEDGERS.filter(function (x) { return x.k === curLedger; })[0];
    var h = '<table class="tbl"><thead><tr><th style="width:52px">연</th><th style="width:40px">월</th><th style="width:40px">일</th>' +
      '<th>적　요</th><th class="num" style="width:125px">차　변</th><th class="num" style="width:125px">대　변</th>' +
      '<th class="num" style="width:125px">차인잔액</th></tr></thead><tbody>';
    var first = true, any = false;
    L.months.forEach(function (mm) {
      if (!mm.rows.length) return;
      any = true;
      mm.rows.forEach(function (r, i) {
        h += '<tr><td>' + (first && i === 0 ? S.year : '') + '</td><td>' + (i === 0 ? mm.m : '') + '</td><td>' + (r.d || '') + '</td>' +
             '<td>' + esc(r.desc) + '</td><td class="num">' + fmt(r.dr) + '</td><td class="num">' + fmt(r.cr) + '</td><td></td></tr>';
      });
      first = false;
      var bal = def.d === 'D' ? mm.dr - mm.cr : mm.cr - mm.dr;
      h += '<tr class="sum"><td colspan="3"></td><td>월　　계</td><td class="num">' + fmt0(mm.dr) +
           '</td><td class="num">' + fmt0(mm.cr) + '</td><td class="num">' + fmt0(bal) + '</td></tr>';
      var cbal = def.d === 'D' ? mm.cumDr - mm.cumCr : mm.cumCr - mm.cumDr;
      h += '<tr class="sum2"><td colspan="3"></td><td>누　　계</td><td class="num">' + fmt0(mm.cumDr) +
           '</td><td class="num">' + fmt0(mm.cumCr) + '</td><td class="num">' + fmt0(cbal) + '</td></tr>';
    });
    if (!any) h += '<tr><td colspan="7" class="empty">전기(轉記)할 거래가 없습니다.</td></tr>';
    h += '</tbody></table>';
    $('lg-body').innerHTML = h;
  }

  /* ── 결산서 ─────────────────────────────────────────────────────────── */
  function renderClosing() {
    var T = C.trial;
    var h = '<table class="tbl"><thead><tr><th class="num">잔　액</th><th class="num">합　계</th><th style="text-align:center">계 정 과 목</th>' +
      '<th class="num">합　계</th><th class="num">잔　액</th></tr></thead><tbody>';
    T.accounts.forEach(function (a) {
      h += '<tr><td class="num">' + fmt(a.drBal) + '</td><td class="num">' + fmt(a.drSum) +
           '</td><td style="text-align:center">' + esc(a.name) + '</td><td class="num">' + fmt(a.crSum) +
           '</td><td class="num">' + fmt(a.crBal) + '</td></tr>';
    });
    h += '<tr class="tot"><td class="num">' + fmt0(T.total.drBal) + '</td><td class="num">' + fmt0(T.total.drSum) +
         '</td><td style="text-align:center">합　　계</td><td class="num">' + fmt0(T.total.crSum) +
         '</td><td class="num">' + fmt0(T.total.crBal) + '</td></tr>';
    h += '<tr class="head"><td colspan="5" style="padding:8px">' +
      '<span class="bdg ' + (T.okBalance ? 'green' : 'red') + '">잔액 차 − 대 = ' + fmt0(T.total.drBal - T.total.crBal) + '</span> ' +
      '<span class="bdg ' + (T.okSum ? 'green' : 'red') + '">합계 차 − 대 = ' + fmt0(T.total.drSum - T.total.crSum) + '</span>' +
      ' &nbsp;<span style="color:#999;font-size:11.5px">두 값 모두 0이어야 합니다.</span></td></tr>';
    h += '</tbody></table>';
    $('cl-trial').innerHTML = h;

    var b = C.bs.cur, p = C.bs.prev;
    var bsRows = [
      ['자　　　산', null, null, 'head'],
      ['I. 유 동 자 산', b.currentAssets, p.currentAssets, 'sum'],
      ['　1. 현　　금', b.cash, p.cash],
      ['　2. 보통예금', b.bank, p.bank],
      ['　3. 대 출 금', b.loan, p.loan],
      ['　4. 선납 법인세', b.prepaidTax, p.prepaidTax],
      ['자 산 총 계', b.totalAssets, p.totalAssets, 'tot'],
      ['부　　　채', null, null, 'head'],
      ['I. 유 동 부 채', b.payable, 0, 'sum'],
      ['　1. 미지급금', b.payable, 0],
      ['II. 고 정 부 채', b.reserve, p.reserve, 'sum'],
      ['　1. 지급 준비금', b.reserve, p.reserve],
      ['부 채 총 계', b.totalLiab, p.totalLiab, 'tot'],
      ['자　　　본', null, null, 'head'],
      ['I. 자 본 금', b.capital, p.capital, 'sum'],
      ['II. 이익 잉여금', b.retained, p.retained, 'sum'],
      ['　1. 미처분 이익잉여금', b.retained, p.retained],
      ['　　1) 이월이익 잉여금', b.retained, p.retained],
      ['　　2) 당 기 순 이 익', b.netIncome, 0],
      ['자 본 총 계', b.totalEquity, p.totalEquity, 'tot'],
      ['부채 및 자본 총계', b.totalLiabEquity, p.totalLiabEquity, 'tot']
    ];
    var bh = '<table class="tbl"><thead><tr><th>계 정 과 목</th><th class="num" style="width:130px">당　기</th><th class="num" style="width:130px">전　기</th></tr></thead><tbody>';
    bsRows.forEach(function (r) {
      bh += '<tr class="' + (r[3] || '') + '"><td>' + esc(r[0]) + '</td><td class="num">' +
        (r[1] == null ? '' : fmt0(r[1])) + '</td><td class="num">' + (r[2] == null ? '' : fmt0(r[2])) + '</td></tr>';
    });
    bh += '<tr class="head"><td colspan="3" style="padding:8px"><span class="bdg ' + (C.bs.ok ? 'green' : 'red') +
      '">자산 − (부채+자본) = ' + fmt0(b.diff) + '</span></td></tr></tbody></table>';
    $('cl-bs').innerHTML = bh;

    var L = C.pl;
    var plRows = [
      ['I. 사 업 수 익', L.revenueTotal, 'sum'],
      ['　1. 대 출 금 이 자', L.loanInterest],
      ['　2. 예　금　이　자', L.depositInterest],
      ['II. 사 업 비 용', L.expenseTotal, 'sum'],
      ['　1. 지급준비금 전입액', L.reserveTransfer],
      ['III. 사 업 총 이 익', L.grossProfit, 'tot'],
      ['IV. 당 기 순 이 익', L.netIncome, 'tot']
    ];
    var ph = '<table class="tbl"><thead><tr><th>계 정 과 목</th><th class="num" style="width:140px">당　기</th></tr></thead><tbody>';
    plRows.forEach(function (r) { ph += '<tr class="' + (r[2] || '') + '"><td>' + esc(r[0]) + '</td><td class="num">' + fmt0(r[1]) + '</td></tr>'; });
    ph += '</tbody></table><p class="hint">사업수익 전액이 지급준비금으로 전입되므로 당기순이익은 항상 0입니다.</p>';
    $('cl-pl').innerHTML = ph;
  }

  /* ── 운영상황 보고서 (별지 제15호서식) ──────────────────────────────── */
  function renderReport() {
    var R = C.report, I = S.info;
    var v = function (x) { return x ? fmt0(x) : ''; };
    var h = '';

    h += '<table class="tbl form15"><tbody>' +
      '<tr><td class="side" rowspan="4">기금법인</td><td class="lbl"><span class="no">①</span>기금법인명</td><td>' + esc(I.name) +
        '</td><td class="lbl"><span class="no">②</span>인가번호</td><td>' + esc(I.license) + '</td></tr>' +
      '<tr><td class="lbl"><span class="no">③</span>설립등기일</td><td>' + esc(I.regDate) +
        '</td><td class="lbl"><span class="no">④</span>전화번호</td><td>' + esc(I.tel) + '</td></tr>' +
      '<tr><td class="lbl"><span class="no">⑤</span>소재지</td><td colspan="3">' + esc(I.addr) + '</td></tr>' +
      '<tr><td class="lbl"><span class="no">⑥</span>회계연도</td><td colspan="3">' + S.year + '년 1월 1일 ~ ' + S.year + '년 12월 31일</td></tr>' +
      '<tr><td class="side" rowspan="2">사업체</td><td class="lbl"><span class="no">⑦</span>대표자</td><td>' + esc(I.ceo) +
        '</td><td class="lbl"><span class="no">⑧</span>업종</td><td>' + esc(I.industry) + '</td></tr>' +
      '<tr><td class="lbl"><span class="no">⑨</span>근로자 수(명)</td><td>' + v(I.workers) +
        '</td><td class="lbl"><span class="no">⑩</span>협력업체 근로자 수(명)</td><td>' + v(I.partnerWorkers) + '</td></tr>' +
      '<tr><td class="side">-</td><td class="lbl"><span class="no">⑪</span>납입자본금</td><td colspan="3">' + v(I.capitalPaid) + ' 백만원</td></tr>' +
      '</tbody></table>';

    h += '<h2 style="margin:18px 0 8px">기본재산 현황 <span style="font-weight:400;color:#999;font-size:11.5px">(천원)</span></h2>' +
      '<table class="tbl form15"><tbody>' +
      '<tr class="hi"><td class="lbl" colspan="2"><span class="no">⑫</span>직전 회계연도 마지막 날 기준 기본재산 총액</td><td class="val" colspan="2">' + v(R.c12) + '</td></tr>' +
      '<tr><td class="lbl"><span class="no">⑬</span>사업주 출연</td><td class="val">' + v(R.c13) +
        '</td><td class="lbl"><span class="no">⑭</span>수익금·이월금 전입</td><td class="val">' + v(R.c14) + '</td></tr>' +
      '<tr><td class="lbl"><span class="no">⑮</span>사업주 외의 자 출연</td><td class="val">' + v(R.c15) +
        '</td><td class="lbl"><span class="no">⑯</span>기금법인 합병</td><td class="val">' + v(R.c16) + '</td></tr>' +
      '<tr><td class="lbl"><span class="no">⑰</span>기본재산 사용</td><td class="val">' + v(R.c17) +
        '</td><td class="lbl"><span class="no">⑱</span>기금법인 분할 등</td><td class="val">' + v(R.c18) + '</td></tr>' +
      '<tr><td class="lbl" colspan="2"><span class="no">⑲</span>소계</td><td class="val" colspan="2">' + v(R.c19) + '</td></tr>' +
      '<tr class="hi"><td class="lbl" colspan="2"><span class="no">⑳</span>해당 회계연도 마지막 날 기준 기본재산 총액</td><td class="val" colspan="2">' + v(R.c20) + '</td></tr>' +
      '</tbody></table>';

    h += '<h2 style="margin:18px 0 8px">기금 운용 및 관리 <span style="font-weight:400;color:#999;font-size:11.5px">(천원)</span></h2>' +
      '<table class="tbl form15"><tbody>' +
      '<tr><td class="side" rowspan="3">운용방법</td><td class="lbl"><span class="no">㉑</span>금융회사 예입·예탁</td><td class="val">' + v(R.c21) +
        '</td><td class="lbl"><span class="no">㉒</span>투자신탁 수익증권 매입</td><td class="val"></td></tr>' +
      '<tr><td class="lbl"><span class="no">㉓</span>유가증권 매입</td><td class="val"></td>' +
        '<td class="lbl"><span class="no">㉔</span>보유 자사주 유상증자 참여</td><td class="val"></td></tr>' +
      '<tr><td class="lbl"><span class="no">㉕</span>(부동산)투자회사 주식 매입</td><td class="val"></td>' +
        '<td class="lbl"><span class="no">㉖</span>기타</td><td class="val"></td></tr>' +
      '<tr class="hi"><td class="side">-</td><td class="lbl" colspan="2"><span class="no">㉗</span>근로자 대부</td><td class="val" colspan="2">' + v(R.c27) + '</td></tr>' +
      '<tr class="hi"><td class="side">-</td><td class="lbl" colspan="2"><span class="no">㉘</span>합계</td><td class="val" colspan="2">' + v(R.c28) + '</td></tr>' +
      '</tbody></table>';

    h += '<h2 style="margin:18px 0 8px">기금사업 재원 <span style="font-weight:400;color:#999;font-size:11.5px">(천원)</span></h2>' +
      '<table class="tbl form15"><tbody>' +
      '<tr class="hi"><td class="lbl"><span class="no">㉙</span>해당 회계연도 기금운용 수익금</td><td class="val">' + v(R.c29) + '</td></tr>' +
      '<tr><td class="lbl"><span class="no">㉚</span>해당 회계연도 출연금액의 100분의 50 또는 100분의 80 범위</td><td class="val"></td></tr>' +
      '<tr><td class="lbl"><span class="no">㉛</span>해당 사업(장) 자본금 100분의 50 초과액</td><td class="val"></td></tr>' +
      '<tr><td class="lbl"><span class="no">㉜</span>기본재산 100분의 20 또는 100분의 30 범위</td><td class="val"></td></tr>' +
      '<tr><td class="lbl"><span class="no">㉝</span>공동근로복지기금 지원액 및 그 지원액의 100분의 50 범위</td><td class="val"></td></tr>' +
      '<tr class="hi"><td class="lbl"><span class="no">㉞</span>이월금 등</td><td class="val">' + v(R.c34) + '</td></tr>' +
      '<tr class="hi"><td class="lbl"><span class="no">㉟</span>합계</td><td class="val">' + v(R.c35) + '</td></tr>' +
      '</tbody></table>';

    var order = [49,50,51,52,53,54,55,56,57,58];
    h += '<h2 style="margin:18px 0 8px">사업 실적 <span style="font-weight:400;color:#999;font-size:11.5px">(천원, 명)</span></h2>' +
      '<table class="tbl form15"><thead><tr>' +
      '<th rowspan="2" style="width:230px">구분</th><th colspan="2">계</th><th colspan="2">목적사업</th><th colspan="2">대부사업</th></tr>' +
      '<tr><th class="num">금액</th><th class="num">수혜자수</th><th class="num">금액</th><th class="num">수혜자수</th><th class="num">금액</th><th class="num">수혜자수</th></tr>' +
      '</thead><tbody>';
    order.forEach(function (k) {
      var row = R.rows[k], on = row.amount || row.people;
      h += '<tr class="' + (on ? 'hi' : '') + '"><td class="lbl"><span class="no">' + circled(k) + '</span>' + esc(row.label) + '</td>' +
        '<td class="val">' + v(row.amount) + '</td><td class="val">' + v(row.people) + '</td>' +
        '<td class="val">' + (row.loanBiz ? '' : v(row.amount)) + '</td><td class="val">' + (row.loanBiz ? '' : v(row.people)) + '</td>' +
        '<td class="val">' + (row.loanBiz ? v(row.amount) : '') + '</td><td class="val">' + (row.loanBiz ? v(row.people) : '') + '</td></tr>';
    });
    h += '<tr class="sum"><td class="lbl"><span class="no">' + circled(59) + '</span>소계</td>' +
      '<td class="val">' + v(R.c59.amount) + '</td><td class="val">' + v(R.c59.people) + '</td>' +
      '<td class="val">' + v(R.c59.purposeAmount) + '</td><td class="val">' + v(R.c59.purposePeople) + '</td>' +
      '<td class="val">' + v(R.c59.loanAmount) + '</td><td class="val">' + v(R.c59.loanPeople) + '</td></tr>';
    h += '<tr class="hi"><td class="lbl"><span class="no">' + circled(60) + '</span>기금 운영비</td><td class="val" colspan="6">' + v(R.c60) + '</td></tr>' +
      '<tr class="hi"><td class="lbl"><span class="no">' + circled(61) + '</span>잔액</td><td class="val" colspan="6">' + v(R.c61) + '</td></tr>' +
      '<tr class="hi"><td class="lbl"><span class="no">' + circled(62) + '</span>합계</td><td class="val" colspan="6">' + v(R.c62) + '</td></tr>' +
      '</tbody></table>';

    h += '<p class="hint" style="margin-top:14px">' +
      '㉑ = ⑳ − ㉗ &nbsp;·&nbsp; ㉟ = ㉗ + ㉙ + ㉞ &nbsp;·&nbsp; ' + circled(61) + ' = ' + circled(62) + ' − ' + circled(59) + ' − ' + circled(60) + '<br />' +
      '금액은 원 단위를 천원으로 절사하여 표기합니다. 제출 전 「검증 결과」 탭이 모두 통과인지 확인하세요.</p>';

    $('rp-body').innerHTML = h;
  }

  var CIRCLED = { 49:'㊾',50:'㊿',51:'(51)',52:'(52)',53:'(53)',54:'(54)',55:'(55)',56:'(56)',57:'(57)',58:'(58)',59:'(59)',60:'(60)',61:'(61)',62:'(62)' };
  function circled(n) { return CIRCLED[n] || ('(' + n + ')'); }

  /* ── 검증 ───────────────────────────────────────────────────────────── */
  function renderVerify() {
    $('vf-body').innerHTML = checkHtml(C.validation);
    var h = '<table class="tbl"><thead><tr><th>월</th><th class="num">출납부 수입</th><th class="num">출납부 지출</th>' +
      '<th class="num">보통예금 잔액</th><th class="num">대출금 잔액</th><th class="num">지급준비금 잔액</th><th>상태</th></tr></thead><tbody>';
    C.cashBook.months.forEach(function (mm, i) {
      var ok = mm.sumIn === mm.sumOut;
      h += '<tr><td>' + MONTH_NAMES[i] + '</td><td class="num">' + fmt(mm.sumIn) + '</td><td class="num">' + fmt(mm.sumOut) +
        '</td><td class="num">' + fmt0(C.bank.months[i].cumBalance) + '</td><td class="num">' + fmt0(C.loan.months[i].cumBalance) +
        '</td><td class="num">' + fmt0(C.reserve.months[i].cumBalance) + '</td>' +
        '<td><span class="bdg ' + (ok ? 'green' : 'red') + '">' + (ok ? '일치' : '불일치') + '</span></td></tr>';
    });
    h += '</tbody></table>';
    $('vf-months').innerHTML = h;
  }

  /* ── 도움말 ─────────────────────────────────────────────────────────── */
  function renderHelp() {
    var kinds = Object.keys(K).map(function (k) {
      return '<tr><td><span class="bdg ' + K[k].color + '">' + K[k].label + '</span></td><td>' + esc(K[k].desc) + '</td></tr>';
    }).join('');
    $('help-body').innerHTML =
      '<h2>1. 이 프로그램이 하는 일</h2>' +
      '<p style="margin-bottom:14px">매월 작성하는 <b>금전출납부 거래 명세</b>만 입력하면 다음이 전부 자동으로 만들어집니다.</p>' +
      '<table class="tbl" style="margin-bottom:20px"><tbody>' +
      '<tr><td style="width:180px"><b>원장 4종</b></td><td>보통예금 · 대출금 · 지급준비금 · 사업수익 (월계·누계 포함)</td></tr>' +
      '<tr><td><b>결산서 3종</b></td><td>합계잔액시산표 · 재무상태표 · 손익계산서</td></tr>' +
      '<tr><td><b>운영상황 보고서</b></td><td>근로복지기본법 시행규칙 별지 제15호서식 ①~(62) 전 항목</td></tr>' +
      '<tr><td><b>검증</b></td><td>월별 수입=지출, 시산표 대차, 자산=부채+자본, 지급준비금 검산, 대출 내역 대사</td></tr>' +
      '</tbody></table>' +

      '<h2>2. 작업 순서</h2>' +
      '<ol style="margin:0 0 20px 18px;line-height:2">' +
      '<li><b>기금 정보 · 이월</b>에서 법인 정보와 전기이월 잔액을 입력합니다 (연 1회).</li>' +
      '<li><b>금전출납부</b>에서 매월 거래를 입력합니다. 적요를 쓰면 유형이 자동 분류됩니다.</li>' +
      '<li>목적사업비는 <b>수혜자수</b>를 반드시 채웁니다 (보고서 인원란의 근거).</li>' +
      '<li><b>대출 내역서</b>에서 연말 기준 차주별 잔액을 정리합니다.</li>' +
      '<li><b>검증 결과</b>가 모두 통과인지 확인한 뒤 <b>엑셀 내보내기</b> 또는 인쇄합니다.</li>' +
      '</ol>' +

      '<h2>3. 회계 처리 규칙</h2>' +
      '<table class="tbl" style="margin-bottom:20px"><tbody>' +
      '<tr><td style="width:180px">현금</td><td>잔액은 항상 0. 수입은 즉시 보통예금 예입, 지출은 즉시 인출로 처리됩니다.</td></tr>' +
      '<tr><td>대출이자 · 예금이자</td><td>사업수익 대변에 계상함과 동시에 전액 지급준비금으로 전입됩니다. 그래서 당기순이익은 항상 0입니다.</td></tr>' +
      '<tr><td>지급준비금 전입 시점</td><td>정기 그룹이자는 <b>월말</b>, 결산이자·개별 전액상환이자는 <b>발생일</b>에 전입합니다.</td></tr>' +
      '<tr><td>목적사업비 · 운영비</td><td>지급준비금 차변(사용)으로 처리됩니다.</td></tr>' +
      '<tr><td>미상환액 반환</td><td>금전출납부에는 총액 그대로, 대출금·사업수익 원장에는 같은 달 상환액에서 차감한 순액으로 기록됩니다.</td></tr>' +
      '<tr><td>기말 지급준비금</td><td>전기이월 + 당기 수익 총액 − (목적사업비 + 운영비)</td></tr>' +
      '</tbody></table>' +

      '<h2>4. 거래유형</h2>' +
      '<table class="tbl" style="margin-bottom:20px"><thead><tr><th style="width:190px">유형</th><th>처리</th></tr></thead><tbody>' + kinds + '</tbody></table>' +

      '<h2>5. 엑셀 가져오기</h2>' +
      '<p>기존 결산자료 엑셀 파일(.xlsx)을 그대로 올리면 <b>금전출납부</b> 시트를 읽어 거래를 불러옵니다. ' +
      '「연 / 월 / 일 / 적요 / 수입금액 / 지출금액」 열 구조를 인식하며, 예입·인출 행과 월계·누계 행은 자동으로 걸러냅니다.</p>' +
      '<p class="hint">불러온 뒤에는 자동 분류 결과와 수혜자수를 반드시 확인하세요.</p>';
  }

  /* ── 편집 핸들러 ────────────────────────────────────────────────────── */
  function findEntry(id) { return S.entries.filter(function (e) { return e.id === id; })[0]; }

  function setEntry(id, f, v) {
    var e = findEntry(id); if (!e) return;
    e[f] = (f === 'desc' || f === 'kind' || f === 'org' || f === 'note') ? v : num(v);
    save(); render();
  }
  function setDesc(id, v) {
    var e = findEntry(id); if (!e) return;
    e.desc = v;
    var wasAuto = !e.manualKind;
    if (wasAuto) {
      var c = global.WFRules.classify(v, K[e.kind] ? K[e.kind].sign : -1);
      if (!c.skip) {
        e.kind = c.kind;
        if (c.org) e.org = c.org;
        e.persons = c.persons; e.grouped = c.grouped;
        if (!e.beneficiaries) e.beneficiaries = c.beneficiaries;
      }
    }
    save(); render();
  }
  function addEntry() {
    S.entries.push({ id: uid(), m: curMonth, d: '', desc: '', amount: 0, kind: 'OTHER_OUT', org: '', persons: [], beneficiaries: 0 });
    save(); render();
  }
  function delEntry(id) {
    S.entries = S.entries.filter(function (e) { return e.id !== id; });
    save(); render();
  }
  function setMonth(m) { curMonth = m; render(); }
  function setLedger(k) { curLedger = k; render(); }

  function setField(scope, f, v, type) {
    (scope === 'info' ? S.info : S.opening)[f] = type === 'n' ? num(v) : v;
    save(); render();
  }
  function findLoan(id) { return S.loans.filter(function (l) { return l.id === id; })[0]; }
  function setLoan(id, f, v) {
    var l = findLoan(id); if (!l) return;
    l[f] = (f === 'principal' || f === 'balance') ? num(v) : v;
    save(); render();
  }
  function addLoan() { S.loans.push({ id: uid(), org: '', name: '', principal: 0, balance: 0, note: '' }); save(); render(); }
  function delLoan(id) { S.loans = S.loans.filter(function (l) { return l.id !== id; }); save(); render(); }

  function syncLoansFromEntries() {
    var added = 0;
    C.entries.filter(function (e) { return e.kind === 'LOAN_OUT'; }).forEach(function (e) {
      var nm = e.persons[0]; if (!nm) return;
      if (S.loans.some(function (l) { return l.name === nm; })) return;
      S.loans.push({ id: uid(), org: e.org || '', name: nm, principal: e.amount, balance: e.amount, note: e.m + '월 신규' });
      added++;
    });
    save(); render();
    toast(added ? added + '명을 추가했습니다. 연말 잔액을 확인하세요.' : '추가할 신규 대출이 없습니다.');
  }

  /* ── 여러 줄 붙여넣기 ───────────────────────────────────────────────── */
  function bulkPaste() {
    modal('여러 줄 붙여넣기 — ' + curMonth + '월',
      '<p class="hint" style="margin:0 0 10px">엑셀에서 <b>일 / 적요 / 금액</b> 열을 복사해 붙여넣으세요. ' +
      '탭 또는 쉼표로 구분합니다. 예입·인출·월계·누계 행은 자동으로 걸러집니다.</p>' +
      '<textarea id="bulk-ta" style="width:100%;height:210px;border:1px solid #ddd;border-radius:6px;padding:9px;font-family:monospace;font-size:12px" ' +
      'placeholder="10\t홍길동 외 대출원금 상환\t3,670,000&#10;10\t홍길동 외 대출이자 상환\t331,490"></textarea>',
      function () {
        var txt = $('bulk-ta').value, lastDay = '', added = 0;
        txt.split(/\r?\n/).forEach(function (line) {
          if (!line.trim()) return;
          var cols = line.split(/\t|,(?=\s*[^\d])|\s{2,}/).map(function (s) { return s.trim(); }).filter(function (s) { return s !== ''; });
          if (cols.length < 2) return;
          var d = '', desc = '', amt = 0;
          if (/^\d{1,2}$/.test(cols[0])) { d = cols[0]; cols.shift(); }
          desc = cols[0] || '';
          amt = num(cols[cols.length - 1]);
          if (!desc || !amt) return;
          var c = global.WFRules.classify(desc, 1);
          if (c.skip) return;
          if (d) lastDay = d;
          S.entries.push({ id: uid(), m: curMonth, d: num(lastDay), desc: desc, amount: amt,
            kind: c.kind, org: c.org, persons: c.persons, beneficiaries: c.beneficiaries, grouped: c.grouped });
          added++;
        });
        save(); render(); toast(added + '건을 추가했습니다.');
      });
  }

  function copyPrevMonth() {
    var prev = curMonth - 1;
    if (prev < 1) { toast('전월이 없습니다.'); return; }
    var src = S.entries.filter(function (e) {
      return Number(e.m) === prev && ['LOAN_PRINCIPAL_IN','LOAN_INTEREST_IN','ADMIN_EXPENSE'].indexOf(e.kind) >= 0;
    });
    if (!src.length) { toast(prev + '월에 복사할 정기항목이 없습니다.'); return; }
    src.forEach(function (e) {
      S.entries.push(Object.assign({}, e, { id: uid(), m: curMonth, amount: 0,
        desc: e.desc.replace(new RegExp('\\(' + prev + '월\\)'), '(' + curMonth + '월)') }));
    });
    save(); render();
    toast(src.length + '건을 복사했습니다. 금액을 입력하세요.');
  }

  /* ── 모달 ───────────────────────────────────────────────────────────── */
  function modal(title, body, onOk) {
    var bg = document.createElement('div');
    bg.className = 'modal-bg';
    bg.innerHTML = '<div class="modal"><h2 style="font-size:15px;margin-bottom:12px">' + esc(title) + '</h2>' + body +
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">' +
      '<button class="btn" data-x>취소</button><button class="btn pri" data-ok>확인</button></div></div>';
    bg.addEventListener('click', function (ev) {
      if (ev.target === bg || ev.target.hasAttribute('data-x')) bg.remove();
      if (ev.target.hasAttribute('data-ok')) { onOk(); bg.remove(); }
    });
    $('modal-root').appendChild(bg);
  }

  /* ── 파일 입출력 ────────────────────────────────────────────────────── */
  function pickFile(accept, cb) {
    var inp = $('file-input');
    inp.value = ''; inp.accept = accept;
    inp.onchange = function () { if (inp.files[0]) cb(inp.files[0]); };
    inp.click();
  }
  function download(blob, name) {
    var a = document.createElement('a'), url = URL.createObjectURL(blob);
    a.href = url; a.download = name; a.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  function exportJson() {
    download(new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' }), '복지기금_' + S.year + '.json');
  }
  function importJson() {
    pickFile('.json', function (f) {
      var fr = new FileReader();
      fr.onload = function () {
        try {
          var o = JSON.parse(fr.result);
          if (!o.year) throw 0;
          S = o; S.year = Number(o.year) || S.year;
          save(); fillYears(); render(); toast('불러왔습니다.');
        } catch (e) { toast('올바른 백업 파일이 아닙니다.'); }
      };
      fr.readAsText(f);
    });
  }

  /* 기존 결산자료 엑셀의 「금전출납부」 시트를 읽어들인다. */
  function importXlsx() {
    if (typeof XLSX === 'undefined') {
      toast('엑셀 모듈을 불러오지 못했습니다. 「여러 줄 붙여넣기」를 사용하세요.');
      return;
    }
    pickFile('.xlsx,.xls', function (f) {
      var fr = new FileReader();
      fr.onload = function () {
        try {
          var wb = XLSX.read(new Uint8Array(fr.result), { type: 'array' });
          var name = wb.SheetNames.filter(function (s) { return /금전출납부|출납/.test(s); })[0] || wb.SheetNames[0];
          var aoa = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true });
          var res = parseCashbookAoa(aoa);
          if (!res.entries.length) { toast('거래를 찾지 못했습니다. 시트 구조를 확인하세요.'); return; }
          modal('엑셀 가져오기',
            '<p>시트 <b>' + esc(name) + '</b>에서 <b>' + res.entries.length + '건</b>의 거래를 찾았습니다.' +
            (res.unclassified ? ' (자동 분류 실패 ' + res.unclassified + '건)' : '') + '</p>' +
            '<p class="hint">확인을 누르면 ' + S.year + '년도의 기존 거래를 <b>모두 대체</b>합니다.</p>',
            function () {
              S.entries = res.entries;
              if (res.opening != null && !S.opening.bank) S.opening.bank = res.opening;
              save(); render(); toast(res.entries.length + '건을 불러왔습니다.');
            });
        } catch (e) { toast('엑셀을 읽지 못했습니다: ' + e.message); }
      };
      fr.readAsArrayBuffer(f);
    });
  }

  /** 금전출납부 시트(2차원 배열) → 거래 목록 */
  function parseCashbookAoa(aoa) {
    var entries = [], curM = 0, curD = 0, unclassified = 0, opening = null, curOrg = '';
    /* 헤더 행에서 열 위치를 찾는다 */
    var ci = { m: 1, d: 2, desc: 3, income: 4, expense: 5 };
    for (var r = 0; r < Math.min(aoa.length, 15); r++) {
      var row = aoa[r] || [];
      for (var c = 0; c < row.length; c++) {
        var t = String(row[c] == null ? '' : row[c]).replace(/\s/g, '');
        if (t === '월') ci.m = c;
        else if (t === '일') ci.d = c;
        else if (/^적요$/.test(t)) ci.desc = c;
        else if (/수입금액|수입/.test(t)) ci.income = c;
        else if (/지출금액|지출/.test(t)) ci.expense = c;
      }
    }
    aoa.forEach(function (row) {
      if (!row) return;
      var m = Number(row[ci.m]), d = Number(row[ci.d]);
      if (m >= 1 && m <= 12) curM = m;
      if (d >= 1 && d <= 31) curD = d;
      var desc = String(row[ci.desc] == null ? '' : row[ci.desc]).trim();
      if (!desc || !curM) return;
      var inc = Number(String(row[ci.income] == null ? 0 : row[ci.income]).replace(/[^0-9.\-]/g, '')) || 0;
      var exp = Number(String(row[ci.expense] == null ? 0 : row[ci.expense]).replace(/[^0-9.\-]/g, '')) || 0;
      if (/전기\s*이월/.test(desc)) { opening = inc || exp; return; }
      var sign = inc ? 1 : -1;
      var c = global.WFRules.classify(desc, sign);
      if (c.skip) {
        /* "보통예금 예입 (우성)" 같은 묶음 머리행에서 소속을 읽어 뒤따르는 명세에 물려준다 */
        if (/보통예금\s*(예입|인출)/.test(desc)) {
          var om = desc.match(/[\(（]\s*([^)）]+?)\s*[\)）]/);
          curOrg = om ? om[1].trim() : '';
        }
        return;
      }
      var amt = inc || exp;
      if (!amt && !/이자|상환/.test(desc)) return;
      if (c.kind === 'OTHER_IN' || c.kind === 'OTHER_OUT') unclassified++;
      var org = c.org || curOrg;
      entries.push({
        id: uid(), m: curM, d: curD, desc: desc, amount: amt,
        kind: c.kind, org: org, persons: c.persons, beneficiaries: c.beneficiaries, grouped: c.grouped
      });
    });
    return { entries: entries, unclassified: unclassified, opening: opening };
  }

  /* ── 엑셀 내보내기 ──────────────────────────────────────────────────── */
  function exportXlsx() {
    if (typeof XLSX === 'undefined') { exportCsv(); return; }
    var wb = XLSX.utils.book_new();
    var add = function (name, aoa, widths) {
      var ws = XLSX.utils.aoa_to_sheet(aoa);
      if (widths) ws['!cols'] = widths.map(function (w) { return { wch: w }; });
      XLSX.utils.book_append_sheet(wb, ws, name);
    };
    var b = C.bs.cur, p = C.bs.prev, L = C.pl, T = C.trial, R = C.report;
    var period = '(' + S.year + '. 1. 1. ~ ' + S.year + '. 12. 31.)';

    add('재무상태표', [
      ['재  무  상  태  표'], [period], [], [S.info.name || '', '', '(단위 : 원)'],
      ['계   정   과   목', '당       기', '전       기'],
      ['자          산'],
      ['I. 유 동 자 산', b.currentAssets, p.currentAssets],
      [' 1. 현    금', b.cash, p.cash],
      [' 2. 보통예금', b.bank, p.bank],
      [' 3. 대 출 금', b.loan, p.loan],
      ['    4. 선납 법인세', b.prepaidTax, p.prepaidTax],
      ['자   산   총   계', b.totalAssets, p.totalAssets],
      ['부          채'],
      ['I. 유 동 부 채', b.payable, 0],
      [' 1. 미지급금', b.payable, 0],
      ['II. 고  정 부 채', b.reserve, p.reserve],
      ['    1. 지급 준비금', b.reserve, p.reserve],
      ['부   채   총   계', b.totalLiab, p.totalLiab],
      ['자          본'],
      ['I. 자   본   금', b.capital, p.capital],
      ['II. 이익 잉여금', b.retained, p.retained],
      ['1. 미처분 이익 잉여금', b.retained, p.retained],
      ['  1) 이월이익 잉여금', b.retained, p.retained],
      [' 2) 당 기 순 이 익', b.netIncome, 0],
      ['자   본   총   계', b.totalEquity, p.totalEquity],
      ['부채 및 자본 총계', b.totalLiabEquity, p.totalLiabEquity],
      [], ['검산 (0이어야 함)', b.diff]
    ], [26, 16, 16]);

    add('손익계산서', [
      ['손  익  계  산  서'], [period], [], [S.info.name || '', '', '(단위 : 원)'],
      ['계   정   과   목', '당      기'], [],
      ['I. 사   업   수   익', L.revenueTotal],
      ['     1. 대 출 금 이 자', L.loanInterest],
      ['     2. 예  금  이  자', L.depositInterest],
      ['II. 사   업   비   용', L.expenseTotal],
      ['      1. 지급준비금 전입액', L.reserveTransfer], [],
      ['III. 사  업  총  이  익', L.grossProfit],
      ['IV.  당  기  순  이  익', L.netIncome]
    ], [26, 16]);

    var tb = [['합  계  잔  액  시  산  표'], [period], [], [S.info.name || '', '', '', '', '(단위 : 원)'],
      ['잔    액', '합    계', '계 정 과 목', '합    계', '잔    액']];
    T.accounts.forEach(function (a) { tb.push([a.drBal || '', a.drSum || '', a.name, a.crSum || '', a.crBal || '']); });
    tb.push([T.total.drBal, T.total.drSum, '합       계', T.total.crSum, T.total.crBal]);
    tb.push([], ['검산 (0이어야 함)', T.total.drBal - T.total.crBal, '', T.total.drSum - T.total.crSum]);
    add('합계잔액시산표', tb, [16, 16, 18, 16, 16]);

    var cb = [['♣ 금  전  출  납  부 ♣'], [], ['년','월','일','적        요','수입금액','지출금액','차인잔액']];
    C.cashBook.months.forEach(function (mm, i) {
      if (!mm.rows.length) return;
      mm.rows.forEach(function (r, j) {
        cb.push([j === 0 && i === 0 ? S.year : '', j === 0 ? mm.m : '', r.d || '', r.desc, r.income || '', r.expense || '', '']);
      });
      cb.push(['', '', '', '월       계', mm.sumIn, mm.sumOut, mm.balance]);
    });
    cb.push(['', '', '', '누       계', C.cashBook.totalIn, C.cashBook.totalOut, '']);
    add('금전출납부', cb, [7, 5, 5, 34, 15, 15, 15]);

    LEDGERS.forEach(function (def) {
      var Lg = C[def.k];
      var rows = [['♣ ' + def.t + ' ♣'], [], ['연','월','일','적  요','정수','차  변','대  변','차감대','차인잔액']];
      var first = true;
      Lg.months.forEach(function (mm) {
        if (!mm.rows.length) return;
        mm.rows.forEach(function (r, j) {
          rows.push([first && j === 0 ? S.year : '', j === 0 ? mm.m : '', r.d || '', r.desc, '', r.dr || '', r.cr || '', '', '']);
        });
        first = false;
        var bal = def.d === 'D' ? mm.dr - mm.cr : mm.cr - mm.dr;
        var cbal = def.d === 'D' ? mm.cumDr - mm.cumCr : mm.cumCr - mm.cumDr;
        rows.push(['', '', '', '월       계', '', mm.dr, mm.cr, '', bal]);
        rows.push(['', '', '', '누       계', '', mm.cumDr, mm.cumCr, '', cbal]);
      });
      add(def.t, rows, [7, 5, 5, 32, 6, 15, 15, 10, 15]);
    });

    var rp = [['사내근로복지기금법인 운영상황 보고서 (' + S.year + '년도분)'],
      ['근로복지기본법 시행규칙 별지 제15호서식'], [], ['항목', '내용'],
      ['① 기금법인명', S.info.name], ['② 인가번호', S.info.license], ['③ 설립등기일', S.info.regDate],
      ['④ 전화번호', S.info.tel], ['⑤ 소재지', S.info.addr],
      ['⑥ 회계연도', S.year + '. 1. 1. ~ ' + S.year + '. 12. 31.'],
      ['⑦ 대표자', S.info.ceo], ['⑧ 업종', S.info.industry],
      ['⑨ 근로자 수(명)', S.info.workers], ['⑩ 협력업체 근로자 수(명)', S.info.partnerWorkers],
      ['⑪ 납입자본금(백만원)', S.info.capitalPaid], [],
      ['[기본재산 현황] (천원)'],
      ['⑫ 직전 회계연도말 기본재산 총액', R.c12], ['⑬ 사업주 출연', R.c13], ['⑭ 수익금·이월금 전입', R.c14],
      ['⑮ 사업주 외의 자 출연', R.c15], ['⑯ 기금법인 합병', R.c16], ['⑰ 기본재산 사용', R.c17],
      ['⑱ 기금법인 분할 등', R.c18], ['⑲ 소계', R.c19], ['⑳ 해당 회계연도말 기본재산 총액', R.c20], [],
      ['[기금 운용 및 관리] (천원)'],
      ['㉑ 금융회사 예입·예탁', R.c21], ['㉗ 근로자 대부', R.c27], ['㉘ 합계', R.c28], [],
      ['[기금사업 재원] (천원)'],
      ['㉙ 해당 회계연도 기금운용 수익금', R.c29], ['㉞ 이월금 등', R.c34], ['㉟ 합계', R.c35], [],
      ['[사업 실적] (천원, 명)'],
      ['구분', '계-금액', '계-수혜자수', '목적사업-금액', '목적사업-수혜자수', '대부사업-금액', '대부사업-수혜자수']];
    [49,50,51,52,53,54,55,56,57,58].forEach(function (k) {
      var row = R.rows[k];
      rp.push([circled(k) + ' ' + row.label, row.amount || '', row.people || '',
        row.loanBiz ? '' : (row.amount || ''), row.loanBiz ? '' : (row.people || ''),
        row.loanBiz ? (row.amount || '') : '', row.loanBiz ? (row.people || '') : '']);
    });
    rp.push(['(59) 소계', R.c59.amount, R.c59.people, R.c59.purposeAmount, R.c59.purposePeople, R.c59.loanAmount, R.c59.loanPeople]);
    rp.push(['(60) 기금 운영비', R.c60]); rp.push(['(61) 잔액', R.c61]); rp.push(['(62) 합계', R.c62]);
    add('운영상황보고서', rp, [34, 14, 14, 14, 14, 14, 14]);

    var lr = [['복지기금 대출 내역서'], [S.year + '. 12. 31. 현재'], [], ['사업장', '성    명', '대 출 금', '잔    액', '비    고']];
    C.loanRoster.groups.forEach(function (g) {
      g.items.forEach(function (l) { lr.push([g.org, l.name, l.principal, l.balance, l.note || '']); });
      lr.push([g.org + ' 소계', g.items.length + '명', g.principal, g.balance, '']);
    });
    lr.push(['합    계', C.loanRoster.count + '명', C.loanRoster.totalPrincipal, C.loanRoster.totalBalance, '']);
    add('대출내역서', lr, [14, 14, 16, 16, 20]);

    XLSX.writeFile(wb, '복지기금_결산자료_' + S.year + '.xlsx');
    toast('엑셀 파일을 저장했습니다.');
  }

  /** SheetJS(CDN)를 쓸 수 없는 환경에서의 대체 출력 — 전 표를 하나의 CSV로 저장 */
  function exportCsv() {
    var q = function (v) {
      var t = v == null ? '' : String(v);
      return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
    };
    var out = [], sec = function (t) { out.push('', '### ' + t); };
    var put = function (arr) { out.push(arr.map(q).join(',')); };
    var b = C.bs.cur, p = C.bs.prev, L = C.pl, T = C.trial, R = C.report;

    sec('재무상태표 (' + S.year + ')');
    put(['계정과목', '당기', '전기']);
    [['I. 유동자산', b.currentAssets, p.currentAssets], [' 1. 현금', b.cash, p.cash],
     [' 2. 보통예금', b.bank, p.bank], [' 3. 대출금', b.loan, p.loan],
     [' 4. 선납법인세', b.prepaidTax, p.prepaidTax], ['자산총계', b.totalAssets, p.totalAssets],
     ['지급준비금', b.reserve, p.reserve], ['부채총계', b.totalLiab, p.totalLiab],
     ['자본금', b.capital, p.capital], ['이월이익잉여금', b.retained, p.retained],
     ['당기순이익', b.netIncome, 0], ['자본총계', b.totalEquity, p.totalEquity],
     ['부채 및 자본 총계', b.totalLiabEquity, p.totalLiabEquity]].forEach(put);

    sec('손익계산서');
    put(['계정과목', '당기']);
    [['I. 사업수익', L.revenueTotal], [' 1. 대출금이자', L.loanInterest], [' 2. 예금이자', L.depositInterest],
     ['II. 사업비용', L.expenseTotal], [' 1. 지급준비금 전입액', L.reserveTransfer],
     ['III. 사업총이익', L.grossProfit], ['IV. 당기순이익', L.netIncome]].forEach(put);

    sec('합계잔액시산표');
    put(['잔액(차)', '합계(차)', '계정과목', '합계(대)', '잔액(대)']);
    T.accounts.forEach(function (a) { put([a.drBal, a.drSum, a.name, a.crSum, a.crBal]); });
    put([T.total.drBal, T.total.drSum, '합계', T.total.crSum, T.total.crBal]);

    sec('금전출납부');
    put(['연', '월', '일', '적요', '수입금액', '지출금액']);
    C.cashBook.months.forEach(function (mm, i) {
      mm.rows.forEach(function (r, j) { put([j === 0 && i === 0 ? S.year : '', j === 0 ? mm.m : '', r.d || '', r.desc, r.income || '', r.expense || '']); });
      if (mm.rows.length) put(['', '', '', '월 계', mm.sumIn, mm.sumOut]);
    });
    put(['', '', '', '누 계', C.cashBook.totalIn, C.cashBook.totalOut]);

    LEDGERS.forEach(function (def) {
      sec(def.t + ' 원장');
      put(['월', '일', '적요', '차변', '대변']);
      C[def.k].months.forEach(function (mm) {
        if (!mm.rows.length) return;
        mm.rows.forEach(function (r, j) { put([j === 0 ? mm.m : '', r.d || '', r.desc, r.dr || '', r.cr || '']); });
        put(['', '', '월 계', mm.dr, mm.cr]);
        put(['', '', '누 계', mm.cumDr, mm.cumCr]);
      });
    });

    sec('운영상황 보고서 (천원, 명)');
    put(['항목', '금액', '수혜자수']);
    [['⑳ 기본재산 총액', R.c20], ['㉑ 금융회사 예입·예탁', R.c21], ['㉗ 근로자 대부', R.c27],
     ['㉘ 합계', R.c28], ['㉙ 기금운용 수익금', R.c29], ['㉞ 이월금 등', R.c34], ['㉟ 합계', R.c35]].forEach(put);
    [49,50,51,52,53,54,55,56,57,58].forEach(function (k) {
      put([circled(k) + ' ' + R.rows[k].label, R.rows[k].amount, R.rows[k].people]);
    });
    put(['(59) 소계', R.c59.amount, R.c59.people]);
    put(['(60) 기금 운영비', R.c60]); put(['(61) 잔액', R.c61]); put(['(62) 합계', R.c62]);

    sec('대출 내역서');
    put(['사업장', '성명', '대출금', '잔액', '비고']);
    C.loanRoster.groups.forEach(function (g) {
      g.items.forEach(function (l) { put([g.org, l.name, l.principal, l.balance, l.note || '']); });
      put([g.org + ' 소계', g.items.length + '명', g.principal, g.balance, '']);
    });
    put(['합계', C.loanRoster.count + '명', C.loanRoster.totalPrincipal, C.loanRoster.totalBalance, '']);

    /* 엑셀에서 한글이 깨지지 않도록 BOM을 붙인다 */
    download(new Blob(['\ufeff' + out.join('\n')], { type: 'text/csv;charset=utf-8' }),
      '복지기금_결산자료_' + S.year + '.csv');
    toast('엑셀 모듈이 없어 CSV로 저장했습니다.');
  }

  function copyReport() {
    var R = C.report;
    var lines = [
      ['⑳ 기본재산 총액', R.c20], ['㉑ 금융회사 예입·예탁', R.c21], ['㉗ 근로자 대부', R.c27],
      ['㉘ 합계', R.c28], ['㉙ 기금운용 수익금', R.c29], ['㉞ 이월금 등', R.c34], ['㉟ 합계', R.c35]
    ];
    [49,51,52,56,57,58].forEach(function (k) {
      var r = R.rows[k];
      if (r.amount || r.people) lines.push([circled(k) + ' ' + r.label, r.amount, r.people + '명']);
    });
    lines.push(['(59) 소계', R.c59.amount, R.c59.people + '명']);
    lines.push(['(60) 기금 운영비', R.c60]); lines.push(['(61) 잔액', R.c61]); lines.push(['(62) 합계', R.c62]);
    var txt = lines.map(function (l) { return l.join('\t'); }).join('\n');
    if (navigator.clipboard) navigator.clipboard.writeText(txt).then(function () { toast('클립보드에 복사했습니다.'); });
    else { modal('보고서 항목값', '<textarea style="width:100%;height:260px">' + esc(txt) + '</textarea>', function () {}); }
  }

  /* ── 연도 / 초기화 / 예시 ───────────────────────────────────────────── */
  function fillYears() {
    $('year-sel').innerHTML = years().map(function (y) {
      return '<option value="' + y + '"' + (y === S.year ? ' selected' : '') + '>' + y + '년도</option>';
    }).join('');
  }
  function changeYear(y) { save(); S = load(Number(y)); curMonth = 1; fillYears(); render(); }
  function resetYear() {
    modal('초기화', '<p>' + S.year + '년도 데이터를 모두 삭제합니다. 되돌릴 수 없습니다.</p>', function () {
      localStorage.removeItem(keyOf(S.year)); S = blank(S.year); render(); toast('초기화했습니다.');
    });
  }
  function loadDemo() {
    if (!global.WFDemo) { toast('예시 데이터 파일(demo.js)을 찾을 수 없습니다.'); return; }
    modal('예시 데이터', '<p>2025년도 예시 데이터를 불러옵니다. 현재 ' + S.year + '년도 데이터는 대체됩니다.</p>', function () {
      var d = JSON.parse(JSON.stringify(global.WFDemo));
      S = d; save(); fillYears(); curMonth = 1; render(); toast('예시 데이터를 불러왔습니다.');
    });
  }

  /* ── 시작 ───────────────────────────────────────────────────────────── */
  function boot() {
    var last = Number(localStorage.getItem('wf_last_year')) || new Date().getFullYear();
    S = load(last);
    fillYears();
    nav('dashboard');
    window.addEventListener('beforeunload', function () {
      localStorage.setItem('wf_last_year', String(S.year)); save();
    });
  }

  global.WF = {
    nav: nav, render: render, setMonth: setMonth, setLedger: setLedger,
    addEntry: addEntry, delEntry: delEntry, setEntry: setEntry, setDesc: setDesc,
    addLoan: addLoan, delLoan: delLoan, setLoan: setLoan, syncLoansFromEntries: syncLoansFromEntries,
    setField: setField, bulkPaste: bulkPaste, copyPrevMonth: copyPrevMonth,
    importXlsx: importXlsx, exportXlsx: exportXlsx, exportJson: exportJson, importJson: importJson,
    copyReport: copyReport, exportCsv: exportCsv, changeYear: changeYear, resetYear: resetYear, loadDemo: loadDemo,
    parseCashbookAoa: parseCashbookAoa
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(typeof window !== 'undefined' ? window : globalThis);
