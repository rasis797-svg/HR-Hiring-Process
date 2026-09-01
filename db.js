/* ==========================================================================
 * db.js — Supabase 행 단위 데이터 레이어
 *
 * 기존에는 app_data(key, value) 한 테이블에 배열 전체를 JSON으로 upsert 했다.
 * 그래서 두 사람이 동시에 작업하면 나중에 저장한 쪽이 상대 작업을 통째로
 * 덮어썼다. 이 파일은 그 저장 경로를 엔티티별 테이블 · 행 단위 쿼리로 바꾼다.
 *
 * 핵심 아이디어
 *   - loadAll()  : 정규화 테이블을 조회해 화면이 기대하는 기존 객체 모양으로 복원
 *   - sync(k, v) : 마지막으로 서버에서 본 상태(snapshot)와 비교해
 *                  "실제로 바뀐 행"만 insert / update / delete
 *   - 결과적으로 A가 3번 지원자를, B가 7번 지원자를 고쳐도 서로 건드리지 않는다.
 *
 * app.js 는 sbSave(key, data) 한 곳만 이 레이어로 우회시키면 되므로
 * 29곳의 saveData() 호출부와 화면 렌더링 코드는 그대로 둔다.
 * ========================================================================== */
(function (global) {
  'use strict';

  var sb = null;
  var ready = false;

  /* 마지막으로 서버와 일치한다고 확인된 상태.
   * key → { id → 직렬화된 행 } 형태로 두고 diff 의 기준으로 쓴다. */
  var snapshot = {};

  var log = function () {
    console.warn.apply(console, ['[db]'].concat([].slice.call(arguments)));
  };

  function newId() {
    if (global.crypto && global.crypto.randomUUID) return global.crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
  }

  function stable(v) {
    // 키 순서에 흔들리지 않는 직렬화 — 변경 감지용
    return JSON.stringify(v, function (k, val) {
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        return Object.keys(val).sort().reduce(function (acc, kk) { acc[kk] = val[kk]; return acc; }, {});
      }
      return val;
    });
  }

  var num = function (v) { return (v === null || v === undefined || v === '') ? null : Number(v); };
  var str = function (v) { return v === null || v === undefined ? '' : String(v); };
  var arr = function (v) { return Array.isArray(v) ? v : []; };

  /* ------------------------------------------------------------------ *
   * 어댑터: 기존 localStorage 키 ↔ 정규화 테이블 매핑
   * ------------------------------------------------------------------ */

  var ADAPTERS = {

    /* ---- 설계시트(포지션) : 자식 테이블 3개를 함께 관리 ---- */
    wm_sheets: {
      table: 'positions',
      order: 'created_at',
      toRow: function (s) {
        return {
          id: s.id,
          name: str(s.name),
          team: str(s.team) || '—',
          report_to: str(s.reportTo) || '—',
          headcount: str(s.headcount) || '1',
          status: str(s.status),
          version: Number(s.version) || 1,
          created_date: str(s.created),
          modified_date: str(s.modified),
          completed_date: str(s.completedDate)
        };
      },
      fromRow: function (r) {
        return {
          id: r.id,
          name: r.name, team: r.team, reportTo: r.report_to,
          headcount: r.headcount, status: r.status, version: r.version,
          created: r.created_date, modified: r.modified_date,
          completedDate: r.completed_date,
          f1: r.f1, f2: r.f2, f3: r.f3, f4: r.f4, f5: r.f5, f6: r.f6,
          levels: [], history: [], assignments: []
        };
      },
      // f1~f6 은 컬럼명이 그대로라 별도 매핑 없이 복사
      copyFields: ['f1', 'f2', 'f3', 'f4', 'f5', 'f6'],

      /* 자식 목록은 순서가 의미를 가지므로, 바뀐 포지션에 한해 통째로 교체한다.
       * 교체 범위가 position_id 하나로 한정되므로 다른 포지션 작업과 충돌하지 않는다. */
      children: [
        {
          table: 'position_levels', fk: 'position_id', prop: 'levels', ordered: true,
          toRow: function (lv, i, pid) {
            return {
              position_id: pid, sort_order: i,
              code: str(lv.code), name: str(lv.name),
              min_years: str(lv.minYears), max_years: str(lv.maxYears), note: str(lv.note)
            };
          },
          fromRow: function (r) {
            return {
              code: r.code, name: r.name,
              minYears: r.min_years, maxYears: r.max_years, note: r.note
            };
          }
        },
        {
          table: 'position_history', fk: 'position_id', prop: 'history',
          toRow: function (h, i, pid) {
            return {
              position_id: pid, version: Number(h.version) || 1,
              changed_at: str(h.time), note: str(h.note),
              f1: str(h.f1), f2: str(h.f2), f3: str(h.f3),
              f4: str(h.f4), f5: str(h.f5), f6: str(h.f6)
            };
          },
          fromRow: function (r) {
            return {
              version: r.version, time: r.changed_at, note: r.note,
              f1: r.f1, f2: r.f2, f3: r.f3, f4: r.f4, f5: r.f5, f6: r.f6
            };
          }
        },
        {
          table: 'position_assignments', fk: 'position_id', prop: 'assignments', keepId: true,
          toRow: function (a, i, pid) {
            return {
              id: a.id || newId(), position_id: pid,
              title: str(a.title), content: str(a.content),
              file_name: str(a.fileName), file_type: str(a.fileType), file_data: str(a.fileData),
              created_date: str(a.created), modified_date: str(a.modified)
            };
          },
          fromRow: function (r) {
            return {
              id: r.id, title: r.title, content: r.content,
              fileName: r.file_name, fileType: r.file_type, fileData: r.file_data,
              created: r.created_date, modified: r.modified_date
            };
          }
        }
      ]
    },

    /* ---- 지원자 : 이력서 원문 / 분석 / 리포트를 1:1 사이드카 테이블로 분리 ---- */
    wm_matching: {
      table: 'candidates',
      order: 'created_at',
      toRow: function (m) {
        return {
          id: m.id,
          applicant: str(m.applicant),
          position_name: str(m.position),
          apply_date: str(m.date),
          source: str(m.source),
          channel: str(m.channel),
          proc_status: str(m.procStatus),
          rejected: !!m.rejected,
          final_pass_date: str(m.finalPassDate),
          score: str(m.score) || '—',
          sub1: str(m.sub1) || '—',
          sub2: str(m.sub2) || '—',
          sub3: str(m.sub3) || '—'
        };
      },
      fromRow: function (r) {
        return {
          id: r.id,
          applicant: r.applicant, position: r.position_name, date: r.apply_date,
          source: r.source, channel: r.channel, procStatus: r.proc_status,
          rejected: r.rejected, finalPassDate: r.final_pass_date,
          score: r.score, sub1: r.sub1, sub2: r.sub2, sub3: r.sub3,
          extractedText: '', analysis: null, reportData: null
        };
      },
      sidecars: [
        {
          table: 'candidate_resumes', fk: 'candidate_id',
          // 이력서 원문은 크기가 커서, 실제로 바뀌었을 때만 쓰기 위해 따로 뗀다
          get: function (m) { return m.extractedText ? { extracted_text: str(m.extractedText) } : null; },
          apply: function (m, r) { m.extractedText = r.extracted_text || ''; }
        },
        {
          table: 'candidate_analyses', fk: 'candidate_id',
          get: function (m) {
            var a = m.analysis;
            if (!a) return null;
            return {
              overall: num(a.overall),
              exp_years: num(a.expYears),
              from_ai: !!a.fromAI,
              item_scores: arr(a.itemScores),
              field_labels: arr(a.fieldLabels),
              feedback_pos: arr(a.feedbackPos),
              feedback_neg: arr(a.feedbackNeg),
              strength_chips: arr(a.strengthChips),
              missing_chips: arr(a.missingChips)
            };
          },
          apply: function (m, r) {
            m.analysis = {
              overall: r.overall === null ? null : Number(r.overall),
              expYears: r.exp_years === null ? null : Number(r.exp_years),
              fromAI: r.from_ai,
              itemScores: arr(r.item_scores),
              fieldLabels: arr(r.field_labels),
              feedbackPos: arr(r.feedback_pos),
              feedbackNeg: arr(r.feedback_neg),
              strengthChips: arr(r.strength_chips),
              missingChips: arr(r.missing_chips)
            };
          }
        },
        {
          table: 'candidate_reports', fk: 'candidate_id',
          get: function (m) {
            if (!m.reportData) return null;
            return {
              interview: m.reportData.interview || {},
              resume_questions: arr(m.reportData.resumeQuestions)
            };
          },
          apply: function (m, r) {
            m.reportData = { interview: r.interview, resumeQuestions: arr(r.resume_questions) };
          }
        }
      ]
    },

    /* ---- 사용자 ---- */
    wm_users: {
      table: 'app_users',
      order: 'created_at',
      toRow: function (u) {
        return {
          id: u.id, auth_uid: u.authUid || null,
          email: str(u.email), name: str(u.name),
          role: str(u.role) || 'HR 담당자',
          status: str(u.status) || '초대됨',
          last_login: str(u.lastLogin) || '—',
          permissions: u.permissions || {}
        };
      },
      fromRow: function (r) {
        return {
          id: r.id, authUid: r.auth_uid || null,
          email: r.email, name: r.name, role: r.role,
          status: r.status, lastLogin: r.last_login,
          permissions: r.permissions || {}
        };
      }
    },

    /* ---- 감사 로그: 추가 전용. 과거 기록은 수정/삭제하지 않는다 ---- */
    wm_audit: {
      table: 'audit_log',
      order: 'created_at',
      desc: true,
      appendOnly: true,
      toRow: function (a) {
        return {
          id: a.id, logged_at: str(a.time), user_name: str(a.user),
          action: str(a.action), target: str(a.target), ip: str(a.ip) || '—'
        };
      },
      fromRow: function (r) {
        return { id: r.id, time: r.logged_at, user: r.user_name, action: r.action, target: r.target, ip: r.ip };
      }
    },

    /* ---- 면접관 가용 일정 ---- */
    wm_schedule: {
      table: 'interviewer_availability',
      order: 'avail_date',
      toRow: function (e) {
        return {
          id: e.id, interviewer_name: str(e.interviewer), avail_date: str(e.date),
          status: str(e.status) || 'available', block_time: str(e.blockTime)
        };
      },
      fromRow: function (r) {
        return { id: r.id, interviewer: r.interviewer_name, date: r.avail_date, status: r.status, blockTime: r.block_time };
      }
    },

    /* ---- 면접관 풀 ---- */
    wm_interviewers: {
      table: 'interviewers',
      order: 'created_at',
      toRow: function (iv) { return { id: iv.id, name: str(iv.name), positions: arr(iv.positions) }; },
      fromRow: function (r) { return { id: r.id, name: r.name, positions: arr(r.positions) }; }
    },

    /* ---- 면접 일정 배정 ---- */
    wm_iv_appts: {
      table: 'interview_appointments',
      order: 'created_at',
      toRow: function (a) {
        return {
          id: a.id,
          candidate_id: a.candidateId || null,
          candidate_name: str(a.candidateName),
          candidate_position: str(a.candidatePosition),
          proc_status: str(a.procStatus),
          interviewers: arr(a.interviewers),
          appt_date: str(a.date), appt_time: str(a.time), type: str(a.type)
        };
      },
      fromRow: function (r) {
        var ivs = arr(r.interviewers);
        return {
          id: r.id, candidateId: r.candidate_id || '',
          candidateName: r.candidate_name, candidatePosition: r.candidate_position,
          procStatus: r.proc_status,
          interviewers: ivs, interviewer: ivs.join(', '),
          date: r.appt_date, time: r.appt_time, type: r.type,
          createdAt: r.created_at
        };
      }
    },

    /* ---- 면접 유형 설정: { types: [...] } 래퍼를 벗겨 행으로 저장 ---- */
    wm_iv_settings: {
      table: 'interview_types',
      order: 'sort_order',
      idField: 'key',
      unwrap: 'types',
      toRow: function (t, i) {
        return {
          key: str(t.key), label: str(t.label),
          duration: Number(t.duration) || 60, buffer: Number(t.buffer) || 15,
          sort_order: i
        };
      },
      fromRow: function (r) { return { key: r.key, label: r.label, duration: r.duration, buffer: r.buffer }; }
    },

    /* ---- 코어 면접 결과 ---- */
    wm_ci_results: {
      table: 'core_interview_results',
      order: 'created_at',
      desc: true,
      toRow: function (r) {
        return {
          id: r.id,
          candidate_id: r.candidateId || null,
          candidate_name: str(r.name), position_name: str(r.pos), track: str(r.track),
          status: str(r.status) || 'done', verdict: str(r.verdict), is_fail: !!r.isFail,
          red_flag_count: Number(r.redFlagCount) || 0,
          red_flags: arr(r.redFlags), results: r.results || {},
          opinion: str(r.opinion), star_level: r.starLevel || null,
          star_memo: str(r.starMemo), ci_state: r.ciState || null,
          saved_at: str(r.savedAt)
        };
      },
      fromRow: function (r) {
        var o = {
          id: r.id, candidateId: r.candidate_id || '', name: r.candidate_name, pos: r.position_name,
          track: r.track, status: r.status, verdict: r.verdict, isFail: r.is_fail,
          redFlagCount: r.red_flag_count, redFlags: arr(r.red_flags), results: r.results || {},
          opinion: r.opinion, starLevel: r.star_level, starMemo: r.star_memo, savedAt: r.saved_at
        };
        if (r.ci_state) o.ciState = r.ci_state;
        return o;
      }
    },

    /* ---- 과제 면접 결과 ---- */
    wm_qq_results: {
      table: 'assignment_interview_results',
      order: 'created_at',
      desc: true,
      toRow: function (r) {
        return {
          id: r.id,
          candidate_id: r.candidateId || null,
          candidate_name: str(r.name), position_name: str(r.pos),
          phase: Number(r.phase) || 5,
          decision_rule: str(r.decisionRule) || 'ANY_RED_FLAG_FAIL',
          verdict: str(r.verdict), is_fail: !!r.isFail,
          fail_q: str(r.failQ), fail_type: str(r.failType),
          questions: arr(r.questions), results: r.results || {},
          opinion: str(r.opinion), star_level: r.starLevel || null,
          star_memo: str(r.starMemo), saved_at: str(r.savedAt)
        };
      },
      fromRow: function (r) {
        return {
          id: r.id, candidateId: r.candidate_id || '', name: r.candidate_name, pos: r.position_name,
          phase: r.phase, decisionRule: r.decision_rule, verdict: r.verdict, isFail: r.is_fail,
          failQ: r.fail_q, failType: r.fail_type, questions: arr(r.questions),
          results: r.results || {}, opinion: r.opinion,
          starLevel: r.star_level, starMemo: r.star_memo, savedAt: r.saved_at
        };
      }
    },

    /* ---- 백업 스냅샷: 추가 전용 + 보존 개수 초과분만 삭제 ---- */
    wm_backup_history: {
      table: 'backup_snapshots',
      order: 'created_at',
      desc: true,
      toRow: function (b) {
        return {
          id: b.id, label: str(b.label),
          counts: b.counts || {}, payload: b.payload || {}
        };
      },
      fromRow: function (r) {
        // app.js 가 쓰는 스냅샷 모양: { time, label, data }
        return { id: r.id, label: r.label, counts: r.counts || {}, data: r.payload || {}, time: r.created_at };
      }
    }
  };

  /* ------------------------------------------------------------------ *
   * 조회
   * ------------------------------------------------------------------ */

  // Supabase 는 한 번에 최대 1000행을 돌려준다. 전부 받을 때까지 페이지를 넘긴다.
  function selectAll(table, orderCol, desc, columns) {
    var PAGE = 1000;
    var out = [];
    function page(from) {
      var q = sb.from(table).select(columns || '*');
      if (orderCol) q = q.order(orderCol, { ascending: !desc });
      return q.range(from, from + PAGE - 1).then(function (res) {
        if (res.error) throw res.error;
        var rows = res.data || [];
        out = out.concat(rows);
        if (rows.length === PAGE) return page(from + PAGE);
        return out;
      });
    }
    return page(0);
  }

  function loadKey(key) {
    var ad = ADAPTERS[key];
    if (!ad) return Promise.resolve(null);

    return selectAll(ad.table, ad.order, ad.desc).then(function (rows) {
      var items = rows.map(function (r) {
        var o = ad.fromRow(r);
        (ad.copyFields || []).forEach(function (f) { o[f] = r[f]; });
        return o;
      });

      var byId = {};
      items.forEach(function (o, i) { byId[rowKey(ad, o, rows[i])] = o; });

      // 자식 테이블 붙이기
      var jobs = (ad.children || []).map(function (ch) {
        return selectAll(ch.table, ch.ordered ? 'sort_order' : null).then(function (crows) {
          crows.forEach(function (cr) {
            var parent = byId[cr[ch.fk]];
            if (parent) parent[ch.prop].push(ch.fromRow(cr));
          });
        });
      });

      // 1:1 사이드카 붙이기
      (ad.sidecars || []).forEach(function (sc) {
        jobs.push(selectAll(sc.table, null).then(function (srows) {
          srows.forEach(function (sr) {
            var parent = byId[sr[sc.fk]];
            if (parent) sc.apply(parent, sr);
          });
        }));
      });

      return Promise.all(jobs).then(function () {
        takeSnapshot(key, items);
        return ad.unwrap ? wrap(ad.unwrap, items) : items;
      });
    });
  }

  function wrap(prop, items) { var o = {}; o[prop] = items; return o; }

  function rowKey(ad, item, row) {
    var f = ad.idField || 'id';
    if (row) return row[f];
    return item[f === 'key' ? 'key' : 'id'];
  }

  /* ------------------------------------------------------------------ *
   * 스냅샷 & diff
   * ------------------------------------------------------------------ */

  function takeSnapshot(key, items) {
    var ad = ADAPTERS[key];
    var snap = {};
    items.forEach(function (it, i) {
      var id = idOf(ad, it);
      snap[id] = stable(payloadOf(ad, it, i));
    });
    snapshot[key] = snap;
  }

  function idOf(ad, item) {
    return ad.idField === 'key' ? item.key : item.id;
  }

  // 변경 감지 대상 = 부모행 + 자식/사이드카 전체. 하나라도 바뀌면 그 행만 다시 쓴다.
  function payloadOf(ad, item, index) {
    var p = { row: ad.toRow(item, index) };
    (ad.copyFields || []).forEach(function (f) { p.row[f] = str(item[f]); });
    (ad.children || []).forEach(function (ch) {
      p[ch.prop] = arr(item[ch.prop]).map(function (c, i) { return ch.toRow(c, i, '_'); });
    });
    (ad.sidecars || []).forEach(function (sc) {
      p[sc.table] = sc.get(item);
    });
    return p;
  }

  /* ------------------------------------------------------------------ *
   * 저장 — 바뀐 행만 쓴다
   * ------------------------------------------------------------------ */

  function sync(key, value) {
    var ad = ADAPTERS[key];
    if (!ready || !ad) return Promise.resolve({ skipped: true });

    var items = ad.unwrap ? arr(value && value[ad.unwrap]) : arr(value);

    // id 가 없는 레코드에 id 를 부여한다. 이 객체는 app.js 의 메모리 배열과
    // 같은 참조이므로, 여기서 넣은 id 가 그대로 화면 쪽에도 남는다.
    items.forEach(function (it) {
      if (ad.idField !== 'key' && !it.id) it.id = newId();
    });

    var prev = snapshot[key] || {};
    var next = {};
    var changed = [];

    items.forEach(function (it, i) {
      var id = idOf(ad, it);
      var ser = stable(payloadOf(ad, it, i));
      next[id] = ser;
      if (prev[id] !== ser) changed.push({ item: it, index: i, id: id });
    });

    var removed = ad.appendOnly ? [] : Object.keys(prev).filter(function (id) {
      return !(id in next);
    });

    if (!changed.length && !removed.length) return Promise.resolve({ changed: 0, removed: 0 });

    var rows = changed.map(function (c) {
      var r = ad.toRow(c.item, c.index);
      (ad.copyFields || []).forEach(function (f) { r[f] = str(c.item[f]); });
      return r;
    });

    var work = Promise.resolve();

    if (rows.length) {
      work = work.then(function () {
        return sb.from(ad.table)
          .upsert(rows, { onConflict: ad.idField || 'id' })
          .then(throwOnError('upsert ' + ad.table));
      });
    }

    // 자식/사이드카는 바뀐 부모행에 한해서만 처리한다
    (ad.children || []).forEach(function (ch) {
      work = work.then(function () { return syncChildren(ch, changed); });
    });
    (ad.sidecars || []).forEach(function (sc) {
      work = work.then(function () { return syncSidecar(sc, changed); });
    });

    if (removed.length) {
      work = work.then(function () {
        return sb.from(ad.table).delete().in(ad.idField || 'id', removed)
          .then(throwOnError('delete ' + ad.table));
      });
    }

    return work.then(function () {
      snapshot[key] = next;
      return { changed: changed.length, removed: removed.length };
    }).catch(function (e) {
      // 스냅샷을 갱신하지 않고 남겨두면 다음 저장 때 자동으로 재시도된다
      log('sync 실패:', key, e.message || e);
      throw e;
    });
  }

  function throwOnError(what) {
    return function (res) {
      if (res && res.error) {
        var err = new Error(what + ': ' + (res.error.message || res.error.code || 'unknown'));
        err.cause = res.error;
        throw err;
      }
      return res;
    };
  }

  /* 자식 목록은 순서가 의미를 갖는다. 바뀐 부모의 자식만 지우고 다시 넣는다.
   * 삭제 범위가 해당 부모 하나로 한정되므로 동시 작업 충돌은 발생하지 않는다. */
  function syncChildren(ch, changed) {
    if (!changed.length) return Promise.resolve();
    var pids = changed.map(function (c) { return c.id; });

    return sb.from(ch.table).delete().in(ch.fk, pids)
      .then(throwOnError('delete ' + ch.table))
      .then(function () {
        var rows = [];
        changed.forEach(function (c) {
          arr(c.item[ch.prop]).forEach(function (child, i) {
            rows.push(ch.toRow(child, i, c.id));
          });
        });
        if (!rows.length) return null;
        return sb.from(ch.table).insert(rows).then(throwOnError('insert ' + ch.table));
      });
  }

  function syncSidecar(sc, changed) {
    var ups = [];
    var dels = [];
    changed.forEach(function (c) {
      var payload = sc.get(c.item);
      if (payload) {
        payload[sc.fk] = c.id;
        ups.push(payload);
      } else {
        dels.push(c.id);
      }
    });

    var work = Promise.resolve();
    if (ups.length) {
      work = work.then(function () {
        return sb.from(sc.table).upsert(ups, { onConflict: sc.fk })
          .then(throwOnError('upsert ' + sc.table));
      });
    }
    if (dels.length) {
      work = work.then(function () {
        return sb.from(sc.table).delete().in(sc.fk, dels)
          .then(throwOnError('delete ' + sc.table));
      });
    }
    return work;
  }

  /* ------------------------------------------------------------------ *
   * 공개 API
   * ------------------------------------------------------------------ */

  var KEYS = [
    'wm_sheets', 'wm_matching', 'wm_users', 'wm_audit', 'wm_schedule',
    'wm_interviewers', 'wm_iv_appts', 'wm_iv_settings',
    'wm_ci_results', 'wm_qq_results'
  ];

  var DB = {
    keys: KEYS,

    init: function (client) { sb = client; ready = !!client; return ready; },
    get ready() { return ready; },

    /* 전체 조회. 화면이 기대하는 기존 객체 모양 그대로 돌려준다. */
    loadAll: function () {
      if (!ready) return Promise.resolve(null);
      var out = {};
      return Promise.all(KEYS.map(function (k) {
        return loadKey(k).then(function (v) { out[k] = v; });
      })).then(function () { return out; });
    },

    load: loadKey,
    sync: sync,

    /* 저장 직전에 호출한다. id 가 없는 레코드에 id 를 부여해 localStorage 에도
     * 같은 id 가 남게 만든다. 이걸 빼먹으면 새로고침 때마다 id 가 새로 생겨
     * 같은 레코드가 서버에 중복 insert 된다. */
    ensureIds: function (key, value) {
      var ad = ADAPTERS[key];
      if (!ad || ad.idField === 'key') return value;
      var items = ad.unwrap ? arr(value && value[ad.unwrap]) : arr(value);
      items.forEach(function (it) {
        if (it && !it.id) it.id = newId();
        (ad.children || []).forEach(function (ch) {
          if (!ch.keepId) return;
          arr(it[ch.prop]).forEach(function (c) { if (c && !c.id) c.id = newId(); });
        });
      });
      return value;
    },

    /* 마이그레이션이 끝났는지(= 정규화 테이블에 데이터가 있는지) 확인 */
    hasNormalizedData: function () {
      if (!ready) return Promise.resolve(false);
      return Promise.all([
        sb.from('positions').select('id', { count: 'exact', head: true }),
        sb.from('candidates').select('id', { count: 'exact', head: true }),
        sb.from('app_users').select('id', { count: 'exact', head: true })
      ]).then(function (res) {
        return res.some(function (r) { return !r.error && (r.count || 0) > 0; });
      }).catch(function () { return false; });
    },

    /* 로컬에만 있는 데이터를 최초 1회 올린다 (테이블이 완전히 비어 있을 때만). */
    seed: function (data) {
      if (!ready) return Promise.resolve(false);
      KEYS.forEach(function (k) { snapshot[k] = {}; });
      return KEYS.reduce(function (p, k) {
        return p.then(function () { return sync(k, data[k]); });
      }, Promise.resolve()).then(function () { return true; });
    },

    /* 다른 사용자의 변경을 감지. 콜백은 디바운스되어 호출된다. */
    subscribe: function (onChange) {
      if (!ready) return null;
      var timer = null;
      var bump = function () {
        clearTimeout(timer);
        timer = setTimeout(onChange, 1200);
      };
      var ch = sb.channel('hr-app-changes');
      [
        'positions', 'position_levels', 'position_history', 'position_assignments',
        'candidates', 'candidate_analyses', 'candidate_reports',
        'interviewers', 'interviewer_availability', 'interview_types',
        'interview_appointments', 'core_interview_results',
        'assignment_interview_results', 'app_users'
      ].forEach(function (t) {
        ch = ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, bump);
      });
      ch.subscribe();
      return ch;
    },

    /* 백업 스냅샷은 별도 경로로 다룬다 (조회/추가/보존개수 정리) */
    loadBackups: function () {
      if (!ready) return Promise.resolve([]);
      return selectAll('backup_snapshots', 'created_at', true)
        .then(function (rows) { return rows.map(ADAPTERS.wm_backup_history.fromRow); })
        .catch(function () { return []; });
    },
    addBackup: function (snap, keepMax) {
      if (!ready) return Promise.resolve(false);
      return sb.from('backup_snapshots')
        .insert({ label: str(snap.label), counts: snap.counts || {}, payload: snap.data || {} })
        .then(throwOnError('insert backup_snapshots'))
        .then(function () { return DB.trimBackups(keepMax || 15); })
        .then(function () { return true; })
        .catch(function (e) { log('백업 저장 실패:', e.message || e); return false; });
    },
    trimBackups: function (keepMax) {
      return selectAll('backup_snapshots', 'created_at', true, 'id').then(function (rows) {
        var stale = rows.slice(keepMax).map(function (r) { return r.id; });
        if (!stale.length) return null;
        return sb.from('backup_snapshots').delete().in('id', stale);
      }).catch(function () { return null; });
    },
    deleteBackup: function (id) {
      if (!ready) return Promise.resolve(false);
      return sb.from('backup_snapshots').delete().eq('id', id)
        .then(function (res) { return !res.error; });
    },

    /* 감사 로그 1건 추가 — 배열 전체를 다시 쓰지 않는다 */
    appendAudit: function (entry) {
      if (!ready) return Promise.resolve(false);
      var row = ADAPTERS.wm_audit.toRow(entry);
      if (!row.id) row.id = entry.id = newId();
      return sb.from('audit_log').insert(row).then(function (res) {
        if (!res.error && snapshot.wm_audit) {
          snapshot.wm_audit[row.id] = stable(payloadOf(ADAPTERS.wm_audit, entry, 0));
        }
        return !res.error;
      }).catch(function () { return false; });
    },

    /* 로그인 직후 호출. 마이그레이션된 app_users 행에 auth_uid 를 연결하고,
     * 행이 없으면 만들어서 돌려준다. 이게 성공해야 RLS 정책이 통과한다. */
    linkCurrentUser: function () {
      if (!ready) return Promise.resolve(null);
      return sb.rpc('link_current_user').then(function (res) {
        if (res.error) throw res.error;
        var row = Array.isArray(res.data) ? res.data[0] : res.data;
        return row ? ADAPTERS.wm_users.fromRow(row) : null;
      });
    },

    newId: newId
  };

  global.DB = DB;
})(window);
