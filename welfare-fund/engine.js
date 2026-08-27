/* =============================================================================
 * engine.js — 복지기금 결산 자동화 계산 엔진 (순수 함수, DOM 비의존)
 * -----------------------------------------------------------------------------
 * 입력  : 월별 금전출납부 명세(거래 1건 = 1행) + 전기이월 잔액 + 기금법인 정보
 * 출력  : 금전출납부 / 보통예금 / 대출금 / 지급준비금 / 사업수익 원장,
 *         합계잔액시산표, 재무상태표, 손익계산서,
 *         근로복지기본법 시행규칙 별지 제15호서식 「운영상황 보고서」 항목값,
 *         그리고 전 구간 자기검증(cross-check) 결과.
 *
 * 회계 구조(2025년도 실제 장부에서 도출):
 *   현금은 항상 잔액 0 — 모든 수입은 즉시 보통예금 예입, 지출은 즉시 인출.
 *   대출이자·예금이자는 사업수익(대변) 계상과 동시에 지급준비금으로 전입(대변).
 *   목적사업비·운영비는 지급준비금 차변으로 사용.
 *   따라서  기말 지급준비금 = 전기이월 + 당기 수익 총액 − (목적사업비 + 운영비)
 * ========================================================================== */
(function (global) {
  'use strict';

  var K = global.WFRules.KINDS;

  /* ── 유틸 ───────────────────────────────────────────────────────────────── */
  var n = function (v) { var x = Number(v); return isFinite(x) ? Math.round(x) : 0; };
  var lastDay = function (y, m) { return new Date(y, m, 0).getDate(); };
  /** 보고서는 천원 단위. 실제 제출본과 동일하게 절사(버림)한다. */
  var toK = function (v) { return Math.floor(n(v) / 1000); };

  function emptyOpening() {
    return { bank: 0, loan: 0, reserve: 0, capital: 0, retained: 0, prepaidTax: 0 };
  }

  /* ── 1. 거래 정규화 ─────────────────────────────────────────────────────── */
  function normalize(entries) {
    return (entries || []).map(function (e, i) {
      var kind = e.kind && K[e.kind] ? e.kind : 'OTHER_OUT';
      return {
        id: e.id != null ? e.id : 'e' + i,
        m: n(e.m), d: n(e.d),
        desc: String(e.desc || '').trim(),
        amount: n(e.amount),
        kind: kind,
        sign: K[kind].sign,
        org: e.org || '',
        persons: e.persons || [],
        beneficiaries: n(e.beneficiaries),
        grouped: !!e.grouped,
        /* ADJ_REFUND 전용 — 반환액의 원금/이자 구성 */
        refundPrincipal: n(e.refundPrincipal),
        refundInterest: n(e.refundInterest),
        adjOrg: e.adjOrg || '',
        note: e.note || ''
      };
    }).filter(function (e) { return e.m >= 1 && e.m <= 12 && e.amount !== 0; })
      .sort(function (a, b) { return a.m - b.m || a.d - b.d; });
  }

  /* ── 2. 조정(미상환액 반환) 차감 적용 ──────────────────────────────────────
   * 실제 장부는 반환액을 별도 행으로 세우지 않고, 같은 달·같은 소속의
   * 원금상환액과 이자수입액에서 직접 차감한다. 그 관행을 그대로 재현한다.
   * 차감 대상을 찾지 못하면 별도 역분개 행으로 남겨 금액 정합성을 유지한다.
   * -------------------------------------------------------------------- */
  function applyAdjustments(entries) {
    var unmatched = [];
    entries.forEach(function (adj) {
      if (adj.kind !== 'ADJ_REFUND') return;
      var org = adj.adjOrg || adj.org;
      var wantP = adj.refundPrincipal, wantI = adj.refundInterest;
      if (!wantP && !wantI) { wantP = adj.amount; }

      var pool = entries.filter(function (e) {
        return e.m === adj.m && e.kind !== 'ADJ_REFUND' && (!org || e.org === org);
      });
      var hitP = pool.filter(function (e) { return e.kind === 'LOAN_PRINCIPAL_IN'; })[0];
      var hitI = pool.filter(function (e) { return e.kind === 'LOAN_INTEREST_IN'; })[0];

      var leftover = 0;
      if (wantP) {
        if (hitP && hitP.amount >= wantP) { hitP.netted = (hitP.netted || 0) + wantP; }
        else leftover += wantP;
      }
      if (wantI) {
        if (hitI && hitI.amount >= wantI) { hitI.netted = (hitI.netted || 0) + wantI; }
        else leftover += wantI;
      }
      adj.nettedInto = { principal: wantP, interest: wantI, org: org };
      adj.leftover = leftover;
      if (leftover > 0) unmatched.push(adj);
    });
    /* 금액의 두 얼굴:
     *   eff — 총액. 금전출납부·보통예금은 실제로 오간 돈 그대로를 적는다.
     *   net — 상계 후 순액. 대출금·사업수익·지급준비금 원장은 반환분을 차감한 뒤 적는다.
     * 실제 장부의 처리 방식과 동일하다. */
    entries.forEach(function (e) {
      e.eff = e.amount;
      e.net = e.amount - (e.netted || 0);
    });
    return unmatched;
  }

  /* ── 3. 금전출납부(현금) 재구성 ────────────────────────────────────────────
   * 수입은 (일자 + 소속 또는 개인)별로 1건의 "보통예금 예입"으로,
   * 지출은 (일자)별로 1건의 "보통예금 인출"로 묶인다.
   * -------------------------------------------------------------------- */
  function incomeKey(e) {
    if (e.kind === 'BANK_INTEREST') return '결산이자';
    return e.org || (e.persons[0] || '기타');
  }

  function buildCashBook(year, entries) {
    var months = [];
    var cumIn = 0, cumOut = 0;

    for (var m = 1; m <= 12; m++) {
      var me = entries.filter(function (e) { return e.m === m; });
      var groups = [];

      /* 수입 그룹 → 보통예금 예입 */
      var inMap = {};
      me.filter(function (e) { return e.sign > 0; }).forEach(function (e) {
        var k = e.d + '|' + incomeKey(e);
        (inMap[k] = inMap[k] || { d: e.d, key: incomeKey(e), type: 'in', items: [] }).items.push(e);
      });
      /* 지출 그룹 → 보통예금 인출 (일자별 1건) */
      var outMap = {};
      me.filter(function (e) { return e.sign < 0; }).forEach(function (e) {
        var k = String(e.d);
        (outMap[k] = outMap[k] || { d: e.d, key: '', type: 'out', items: [] }).items.push(e);
      });

      Object.keys(inMap).forEach(function (k) { groups.push(inMap[k]); });
      Object.keys(outMap).forEach(function (k) { groups.push(outMap[k]); });
      groups.sort(function (a, b) {
        return a.d - b.d || (a.type === b.type ? 0 : a.type === 'in' ? -1 : 1);
      });

      var rows = [], mIn = 0, mOut = 0;
      groups.forEach(function (g) {
        var total = g.items.reduce(function (s, e) { return s + e.eff; }, 0);
        if (total === 0 && g.items.every(function (e) { return e.eff === 0; })) {
          /* 전액 상계된 그룹은 표기만 남긴다 */
        }
        var isIn = g.type === 'in';
        var org = g.items[0].org;
        rows.push({
          d: g.d,
          desc: isIn ? ('보통예금 예입' + (org ? ' (' + org + ')' : '')) : '보통예금 인출',
          income: isIn ? 0 : total,
          expense: isIn ? total : 0,
          header: true
        });
        g.items.forEach(function (e) {
          rows.push({
            d: null, desc: e.desc,
            income: isIn ? e.eff : 0,
            expense: isIn ? 0 : e.eff,
            entryId: e.id, kind: e.kind
          });
        });
        if (isIn) { mIn += total; mOut += total; } else { mIn += total; mOut += total; }
      });

      /* 현금은 즉시 예입/인출되므로 월 수입 합계 = 월 지출 합계 */
      var sumIn = rows.reduce(function (s, r) { return s + r.income; }, 0);
      var sumOut = rows.reduce(function (s, r) { return s + r.expense; }, 0);
      cumIn += sumIn; cumOut += sumOut;
      months.push({ m: m, rows: rows, sumIn: sumIn, sumOut: sumOut, balance: sumIn - sumOut, cumIn: cumIn, cumOut: cumOut });
    }
    return { year: year, months: months, totalIn: cumIn, totalOut: cumOut };
  }

  /* ── 4. 보통예금 원장 ──────────────────────────────────────────────────── */
  function buildBankLedger(year, cashBook, opening) {
    var months = [], cumDr = 0, cumCr = 0;
    cashBook.months.forEach(function (mm, idx) {
      var rows = [];
      if (idx === 0) rows.push({ d: 1, desc: '전기이월', dr: n(opening.bank), cr: 0 });
      mm.rows.filter(function (r) { return r.header; }).forEach(function (r) {
        var isIn = r.expense > 0; /* 현금 지출 = 은행 예입 */
        rows.push({ d: r.d, desc: isIn ? '예입' : '인출', dr: isIn ? r.expense : 0, cr: isIn ? 0 : r.income });
      });
      var dr = rows.reduce(function (s, r) { return s + r.dr; }, 0);
      var cr = rows.reduce(function (s, r) { return s + r.cr; }, 0);
      cumDr += dr; cumCr += cr;
      months.push({ m: mm.m, rows: rows, dr: dr, cr: cr, balance: dr - cr, cumDr: cumDr, cumCr: cumCr, cumBalance: cumDr - cumCr });
    });
    return { months: months, totalDr: cumDr, totalCr: cumCr, closing: cumDr - cumCr };
  }

  /* ── 5. 대출금 원장 ───────────────────────────────────────────────────── */
  function buildLoanLedger(year, entries, opening) {
    var months = [], cumDr = 0, cumCr = 0;
    for (var m = 1; m <= 12; m++) {
      var rows = [];
      if (m === 1) rows.push({ d: 1, desc: '전기이월', dr: n(opening.loan), cr: 0 });
      entries.filter(function (e) {
        return e.m === m && (e.kind === 'LOAN_OUT' || e.kind === 'LOAN_PRINCIPAL_IN');
      }).forEach(function (e) {
        rows.push({
          d: e.d, desc: e.desc,
          dr: e.kind === 'LOAN_OUT' ? e.net : 0,
          cr: e.kind === 'LOAN_PRINCIPAL_IN' ? e.net : 0
        });
      });
      /* 상계되지 않은 반환액은 대출금 차변(재계상)으로 남긴다 */
      entries.filter(function (e) { return e.m === m && e.kind === 'ADJ_REFUND' && e.leftover > 0; })
        .forEach(function (e) { rows.push({ d: e.d, desc: e.desc + ' (조정)', dr: e.leftover, cr: 0 }); });

      var dr = rows.reduce(function (s, r) { return s + r.dr; }, 0);
      var cr = rows.reduce(function (s, r) { return s + r.cr; }, 0);
      cumDr += dr; cumCr += cr;
      months.push({ m: m, rows: rows, dr: dr, cr: cr, balance: dr - cr, cumDr: cumDr, cumCr: cumCr, cumBalance: cumDr - cumCr });
    }
    return { months: months, totalDr: cumDr, totalCr: cumCr, closing: cumDr - cumCr };
  }

  /* ── 6. 사업수익 원장 ─────────────────────────────────────────────────── */
  function isRevenue(e) { return e.kind === 'LOAN_INTEREST_IN' || e.kind === 'BANK_INTEREST'; }

  function buildRevenueLedger(year, entries) {
    var months = [], cumDr = 0, cumCr = 0;
    for (var m = 1; m <= 12; m++) {
      var rows = [], items = entries.filter(function (e) { return e.m === m && isRevenue(e); });
      items.forEach(function (e) { rows.push({ d: e.d, desc: e.desc, dr: 0, cr: e.net }); });
      var monthRev = items.reduce(function (s, e) { return s + e.net; }, 0);
      if (monthRev !== 0 || items.length) {
        rows.push({ d: lastDay(year, m), desc: '지급준비금 전입액', dr: monthRev, cr: 0 });
      }
      var dr = rows.reduce(function (s, r) { return s + r.dr; }, 0);
      var cr = rows.reduce(function (s, r) { return s + r.cr; }, 0);
      cumDr += dr; cumCr += cr;
      months.push({ m: m, rows: rows, dr: dr, cr: cr, cumDr: cumDr, cumCr: cumCr, monthRev: monthRev });
    }
    return { months: months, total: cumCr, totalDr: cumDr };
  }

  /* ── 7. 지급준비금 원장 ───────────────────────────────────────────────────
   * 대변(전입) : 정기 그룹이자는 월말 합산, 결산이자·개별 전액상환이자는 발생일
   * 차변(사용) : 목적사업비 + 기금운영비 (지출일)
   * -------------------------------------------------------------------- */
  function isReserveUse(e) {
    var g = K[e.kind].group;
    return g === '목적사업' || g === '운영비';
  }

  function buildReserveLedger(year, entries, opening) {
    var months = [], cumDr = 0, cumCr = 0;
    for (var m = 1; m <= 12; m++) {
      var rows = [];
      if (m === 1) rows.push({ d: 1, desc: '전기이월', dr: 0, cr: n(opening.reserve) });

      /* 차변 — 사용 */
      entries.filter(function (e) { return e.m === m && isReserveUse(e); })
        .forEach(function (e) { rows.push({ d: e.d, desc: e.desc, dr: e.net, cr: 0 }); });

      /* 대변 — 전입 */
      var mRev = entries.filter(function (e) { return e.m === m && isRevenue(e); });
      var byOrg = {};
      mRev.forEach(function (e) {
        if (e.kind === 'LOAN_INTEREST_IN' && e.grouped && e.org) {
          byOrg[e.org] = (byOrg[e.org] || 0) + e.net;                 /* 월말 합산 */
        } else if (e.kind === 'BANK_INTEREST') {
          rows.push({ d: e.d, desc: '지급준비금 전입 (결산이자)', dr: 0, cr: e.net });
        } else {
          rows.push({ d: e.d, desc: e.desc, dr: 0, cr: e.net });      /* 개별 상환이자 */
        }
      });
      Object.keys(byOrg).forEach(function (org) {
        rows.push({ d: lastDay(year, m), desc: '지급준비금 전입 (' + org + ')', dr: 0, cr: byOrg[org] });
      });

      rows.sort(function (a, b) { return a.d - b.d; });
      var dr = rows.reduce(function (s, r) { return s + r.dr; }, 0);
      var cr = rows.reduce(function (s, r) { return s + r.cr; }, 0);
      cumDr += dr; cumCr += cr;
      months.push({ m: m, rows: rows, dr: dr, cr: cr, cumDr: cumDr, cumCr: cumCr, cumBalance: cumCr - cumDr });
    }
    return { months: months, totalDr: cumDr, totalCr: cumCr, closing: cumCr - cumDr };
  }

  /* ── 8. 합계잔액시산표 ────────────────────────────────────────────────── */
  function buildTrialBalance(bank, loan, reserve, revenue, opening) {
    var acc = [
      { name: '현       금', drSum: 0, crSum: 0, side: 'D' },
      { name: '보 통 예 금', drSum: bank.totalDr, crSum: bank.totalCr, side: 'D' },
      { name: '대  출  금', drSum: loan.totalDr, crSum: loan.totalCr, side: 'D' },
      { name: '선급법인세', drSum: n(opening.prepaidTax), crSum: 0, side: 'D' },
      { name: '지급준비금', drSum: reserve.totalDr, crSum: reserve.totalCr, side: 'C' },
      { name: '자  본  금', drSum: 0, crSum: n(opening.capital), side: 'C' },
      { name: '이월이익잉여금', drSum: 0, crSum: n(opening.retained), side: 'C' },
      { name: '사 업 수 익', drSum: revenue.totalDr, crSum: revenue.total, side: 'C' }
    ];
    acc.forEach(function (a) {
      var d = a.drSum - a.crSum;
      a.drBal = a.side === 'D' ? Math.max(d, 0) : 0;
      a.crBal = a.side === 'C' ? Math.max(-d, 0) : 0;
    });
    var t = acc.reduce(function (s, a) {
      s.drBal += a.drBal; s.drSum += a.drSum; s.crSum += a.crSum; s.crBal += a.crBal; return s;
    }, { drBal: 0, drSum: 0, crSum: 0, crBal: 0 });
    return { accounts: acc, total: t, okBalance: t.drBal === t.crBal, okSum: t.drSum === t.crSum };
  }

  /* ── 9. 재무상태표 / 손익계산서 ───────────────────────────────────────── */
  function buildBalanceSheet(bank, loan, reserve, opening, prevYear) {
    var cur = {
      cash: 0, bank: bank.closing, loan: loan.closing, prepaidTax: n(opening.prepaidTax)
    };
    cur.currentAssets = cur.cash + cur.bank + cur.loan + cur.prepaidTax;
    cur.totalAssets = cur.currentAssets;
    cur.payable = 0;
    cur.reserve = reserve.closing;
    cur.totalLiab = cur.payable + cur.reserve;
    cur.capital = n(opening.capital);
    cur.retained = n(opening.retained);
    cur.netIncome = 0;
    cur.totalEquity = cur.capital + cur.retained;
    cur.totalLiabEquity = cur.totalLiab + cur.totalEquity;
    cur.diff = cur.totalAssets - cur.totalLiabEquity;

    var prev = prevYear || {
      cash: 0, bank: n(opening.bank), loan: n(opening.loan), prepaidTax: n(opening.prepaidTax),
      reserve: n(opening.reserve), capital: n(opening.capital), retained: n(opening.retained)
    };
    prev.currentAssets = prev.cash + prev.bank + prev.loan + prev.prepaidTax;
    prev.totalAssets = prev.currentAssets;
    prev.totalLiab = prev.reserve;
    prev.totalEquity = prev.capital + prev.retained;
    prev.totalLiabEquity = prev.totalLiab + prev.totalEquity;
    return { cur: cur, prev: prev, ok: cur.diff === 0 };
  }

  function buildIncomeStatement(entries, revenue) {
    var deposit = entries.filter(function (e) { return e.kind === 'BANK_INTEREST'; })
      .reduce(function (s, e) { return s + e.net; }, 0);
    var total = revenue.total;
    return {
      revenueTotal: total,
      loanInterest: total - deposit,
      depositInterest: deposit,
      expenseTotal: total,
      reserveTransfer: total,
      grossProfit: 0,
      netIncome: 0
    };
  }

  /* ── 10. 운영상황 보고서 (별지 제15호서식) ─────────────────────────────── */
  function sumKind(entries, kinds) {
    return entries.filter(function (e) { return kinds.indexOf(e.kind) >= 0; })
      .reduce(function (s, e) { return s + e.net; }, 0);
  }
  function sumBenef(entries, kinds) {
    return entries.filter(function (e) { return kinds.indexOf(e.kind) >= 0; })
      .reduce(function (s, e) { return s + n(e.beneficiaries); }, 0);
  }

  function buildReport(state, ctx) {
    var info = state.info || {}, opening = state.opening || emptyOpening();
    var E = ctx.entries, loanRoster = ctx.loanRoster;

    var inc = n(info.basicAssetIncOwner) + n(info.basicAssetIncProfit) +
              n(info.basicAssetIncOther) + n(info.basicAssetIncMerge);
    var dec = n(info.basicAssetUse) + n(info.basicAssetSplit);
    var r = {};
    r.c12 = n(info.basicAssetPrev);              /* ⑫ 직전 회계연도말 기본재산 총액 */
    r.c13 = n(info.basicAssetIncOwner);
    r.c14 = n(info.basicAssetIncProfit);
    r.c15 = n(info.basicAssetIncOther);
    r.c16 = n(info.basicAssetIncMerge);
    r.c17 = n(info.basicAssetUse);
    r.c18 = n(info.basicAssetSplit);
    r.c19 = inc - dec;                            /* ⑲ 소계 */
    r.c20 = r.c12 + r.c19;                        /* ⑳ 해당 회계연도말 기본재산 총액 */

    r.c27 = toK(ctx.loan.closing);                /* ㉗ 근로자 대부 = 기말 대출금 잔액 */
    r.c21 = r.c20 - r.c27;                        /* ㉑ 금융회사 예입·예탁 = ⑳ − ㉗ */
    r.c28 = r.c21 + r.c27;                        /* ㉘ 합계 */

    r.c29 = toK(ctx.revenue.total);               /* ㉙ 해당 회계연도 기금운용 수익금 */
    r.c34 = toK(opening.bank);                    /* ㉞ 이월금 등 = 전기이월 보통예금 */
    r.c35 = r.c27 + r.c29 + r.c34;                /* ㉟ 기금사업 재원 합계 */

    /* 사업실적 */
    var rows = {
      49: { label: '주택구입·임차자금', amount: toK(ctx.loan.closing), people: loanRoster.count, loanBiz: true },
      50: { label: '우리사주 구입자금', amount: 0, people: 0 },
      51: { label: '생활안정자금', amount: toK(sumKind(E, ['WELFARE_HOUSING'])), people: sumBenef(E, ['WELFARE_HOUSING']) },
      52: { label: '장학금', amount: toK(sumKind(E, ['WELFARE_SCHOLAR'])), people: sumBenef(E, ['WELFARE_SCHOLAR']) },
      53: { label: '재난구호금', amount: 0, people: 0 },
      54: { label: '체육·문화활동 지원', amount: 0, people: 0 },
      55: { label: '모성보호, 일·가정 양립 비용 지원', amount: 0, people: 0 },
      56: { label: '근로자의 날 행사 등 지원', amount: toK(sumKind(E, ['WELFARE_EVENT'])), people: sumBenef(E, ['WELFARE_EVENT']) },
      57: { label: '근로복지시설 설치 및 운영', amount: toK(sumKind(E, ['WELFARE_FACILITY'])), people: sumBenef(E, ['WELFARE_FACILITY']) },
      58: { label: '그 밖의 복지비', amount: toK(sumKind(E, ['WELFARE_ETC'])), people: sumBenef(E, ['WELFARE_ETC']) }
    };
    var subAmt = 0, subPpl = 0, purposeAmt = 0, purposePpl = 0, loanAmt = 0, loanPpl = 0;
    Object.keys(rows).forEach(function (k) {
      var row = rows[k];
      subAmt += row.amount; subPpl += row.people;
      if (row.loanBiz) { loanAmt += row.amount; loanPpl += row.people; }
      else { purposeAmt += row.amount; purposePpl += row.people; }
    });
    r.rows = rows;
    r.c59 = { amount: subAmt, people: subPpl, purposeAmount: purposeAmt, purposePeople: purposePpl, loanAmount: loanAmt, loanPeople: loanPpl };
    r.c60 = toK(sumKind(E, ['ADMIN_EXPENSE']));   /* ㊿ 기금 운영비 */
    r.c62 = r.c35;                                /* (62) 합계 = ㉟ */
    r.c61 = r.c62 - r.c59.amount - r.c60;         /* (61) 잔액 */
    return r;
  }

  /* ── 11. 대출 내역서 (사업장별) ───────────────────────────────────────── */
  function buildLoanRoster(loans) {
    var byOrg = {}, order = [];
    (loans || []).forEach(function (l) {
      var org = l.org || '미지정';
      if (!byOrg[org]) { byOrg[org] = { org: org, items: [], principal: 0, balance: 0 }; order.push(org); }
      byOrg[org].items.push(l);
      byOrg[org].principal += n(l.principal);
      byOrg[org].balance += n(l.balance);
    });
    var groups = order.map(function (o) { return byOrg[o]; });
    return {
      groups: groups,
      count: (loans || []).filter(function (l) { return n(l.balance) > 0; }).length,
      totalPrincipal: groups.reduce(function (s, g) { return s + g.principal; }, 0),
      totalBalance: groups.reduce(function (s, g) { return s + g.balance; }, 0)
    };
  }

  /* ── 12. 검증 ─────────────────────────────────────────────────────────── */
  function validate(ctx, unmatched) {
    var v = [];
    var push = function (ok, level, title, detail) { v.push({ ok: ok, level: level, title: title, detail: detail }); };

    ctx.cashBook.months.forEach(function (mm) {
      if (mm.sumIn !== mm.sumOut) {
        push(false, 'error', mm.m + '월 금전출납부 불일치',
          '수입 ' + mm.sumIn.toLocaleString() + '원 ≠ 지출 ' + mm.sumOut.toLocaleString() + '원 (차액 ' + (mm.sumIn - mm.sumOut).toLocaleString() + '원)');
      }
    });
    push(ctx.trial.okSum, ctx.trial.okSum ? 'ok' : 'error', '시산표 차·대변 합계 일치',
      ctx.trial.total.drSum.toLocaleString() + ' / ' + ctx.trial.total.crSum.toLocaleString());
    push(ctx.trial.okBalance, ctx.trial.okBalance ? 'ok' : 'error', '시산표 차·대변 잔액 일치',
      ctx.trial.total.drBal.toLocaleString() + ' / ' + ctx.trial.total.crBal.toLocaleString());
    push(ctx.bs.ok, ctx.bs.ok ? 'ok' : 'error', '재무상태표 자산 = 부채+자본',
      '차액 ' + ctx.bs.cur.diff.toLocaleString() + '원');

    var expectReserve = n(ctx.opening.reserve) + ctx.revenue.total - ctx.reserve.totalDr;
    push(expectReserve === ctx.reserve.closing, expectReserve === ctx.reserve.closing ? 'ok' : 'error',
      '지급준비금 기말잔액 검산',
      '전기이월 + 당기수익 − 사용액 = ' + expectReserve.toLocaleString() + '원');

    var rosterOk = ctx.loanRoster.totalBalance === ctx.loan.closing;
    push(rosterOk, rosterOk ? 'ok' : (ctx.loanRoster.totalBalance ? 'warn' : 'info'),
      '대출 내역서 합계 = 대출금 원장 잔액',
      '내역서 ' + ctx.loanRoster.totalBalance.toLocaleString() + '원 / 원장 ' + ctx.loan.closing.toLocaleString() + '원');

    var lowConf = ctx.entries.filter(function (e) { return e.kind === 'OTHER_IN' || e.kind === 'OTHER_OUT'; });
    push(lowConf.length === 0, lowConf.length ? 'warn' : 'ok', '미분류 거래',
      lowConf.length ? lowConf.length + '건의 적요가 자동 분류되지 않았습니다. 유형을 지정해 주세요.' : '전 건 분류 완료');

    var noBenef = ctx.entries.filter(function (e) {
      return K[e.kind].group === '목적사업' && n(e.beneficiaries) === 0;
    });
    push(noBenef.length === 0, noBenef.length ? 'warn' : 'ok', '목적사업 수혜자수 입력',
      noBenef.length ? noBenef.length + '건의 수혜자수가 비어 있어 보고서 인원란이 과소 집계됩니다.' : '전 건 입력 완료');

    if (unmatched.length) {
      push(false, 'warn', '조정(반환) 차감 대상 미확인',
        unmatched.length + '건은 같은 달 상환액에서 차감하지 못해 별도 행으로 계상했습니다.');
    }
    return v;
  }

  /* ── 진입점 ───────────────────────────────────────────────────────────── */
  function compute(state) {
    var year = n(state.year) || new Date().getFullYear();
    var opening = Object.assign(emptyOpening(), state.opening || {});
    var entries = normalize(state.entries);
    var unmatched = applyAdjustments(entries);

    var cashBook = buildCashBook(year, entries);
    var bank = buildBankLedger(year, cashBook, opening);
    var loan = buildLoanLedger(year, entries, opening);
    var revenue = buildRevenueLedger(year, entries);
    var reserve = buildReserveLedger(year, entries, opening);
    var trial = buildTrialBalance(bank, loan, reserve, revenue, opening);
    var bs = buildBalanceSheet(bank, loan, reserve, opening, state.prevYear);
    var pl = buildIncomeStatement(entries, revenue);
    var loanRoster = buildLoanRoster(state.loans);

    var ctx = {
      year: year, opening: opening, entries: entries, cashBook: cashBook,
      bank: bank, loan: loan, revenue: revenue, reserve: reserve,
      trial: trial, bs: bs, pl: pl, loanRoster: loanRoster
    };
    ctx.report = buildReport(state, ctx);
    ctx.validation = validate(ctx, unmatched);
    ctx.hasError = ctx.validation.some(function (x) { return x.level === 'error'; });
    return ctx;
  }

  global.WFEngine = {
    compute: compute, normalize: normalize, emptyOpening: emptyOpening,
    toK: toK, lastDay: lastDay, isRevenue: isRevenue, isReserveUse: isReserveUse
  };
})(typeof window !== 'undefined' ? window : globalThis);
