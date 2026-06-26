    // ── State ──
    let currentPage = '';
    let currentUserRole = '';

    // ── 사이드바 그룹 접기/펼치기 ──
    function toggleNavGroup(name) {
      const wrap = document.getElementById(`nav-group-${name}`);
      const toggle = document.querySelector(`.nav-group-toggle[onclick="toggleNavGroup('${name}')"]`);
      if (!wrap) return;
      const collapsed = wrap.style.display === 'none';
      wrap.style.display = collapsed ? '' : 'none';
      if (toggle) toggle.classList.toggle('collapsed', !collapsed);
      localStorage.setItem(`wm_navgroup_${name}`, collapsed ? 'open' : 'collapsed');
    }

    function initNavGroups() {
      ['interview'].forEach(name => {
        if (localStorage.getItem(`wm_navgroup_${name}`) === 'collapsed') {
          const wrap = document.getElementById(`nav-group-${name}`);
          const toggle = document.querySelector(`.nav-group-toggle[onclick="toggleNavGroup('${name}')"]`);
          if (wrap) wrap.style.display = 'none';
          if (toggle) toggle.classList.add('collapsed');
        }
      });
    }

    // ── Navigation ──
    function nav(page) {
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

      const el = document.getElementById('page-' + page);
      if (el) {
        el.classList.add('active');
        currentPage = page;
      }

      if (page === 'matching' || page === 'matching-upload') syncPositionDropdowns();
      if (page === 'core-interview') setTimeout(renderCI, 0);
      if (page === 'mini-quest') setTimeout(renderQQ, 0);
      if (page === 'qq-results') setTimeout(renderQQResults, 0);
      if (page === 'reports') setTimeout(renderReports, 0);
      if (page === 'dashboard') setTimeout(renderDashboard, 0);
      if (page === 'positions') setTimeout(renderPositions, 0);
      if (page === 'ci-results') setTimeout(renderCIResults, 0);
      if (page === 'schedule') setTimeout(initSchedulePage, 0);

      const navMap = {
        dashboard: 'dashboard', positions: 'positions',
        sheets: 'sheets', 'sheets-new': 'sheets', 'sheet-detail': 'sheets', 'sheet-history': 'sheets',
        matching: 'matching', 'matching-upload': 'matching', 'match-result': 'matching',
        reports: 'reports', 'report-detail': 'reports',
        admin: 'admin', account: 'account',
        'mini-quest': 'mini-quest',
        'qq-results': 'qq-results', 'qq-result-detail': 'qq-results',
        'core-interview': 'core-interview',
        'ci-results': 'ci-results', 'ci-result-detail': 'ci-results',
        schedule: 'schedule'
      };
      const activeNav = navMap[page];
      if (activeNav) {
        const navEl = document.querySelector(`[data-nav="${activeNav}"]`);
        if (navEl) navEl.classList.add('active');
      }
    }

    // ── Auth ──
    function showPanel(id) {
      document.querySelectorAll('#login-panel, #forgot-panel').forEach(p => p.style.display = 'none');
      document.getElementById(id).style.display = '';
    }

    // 관리자 계정 설정
    const ADMIN_ACCOUNTS = [
      { email: 'wshr@woosung.kr', pw: 'wsfeed1101!', name: '우성 관리자', role: '시스템 관리자', initials: 'WS' }
    ];

    async function doLogin() {
      const email = document.getElementById('login-email').value.trim();
      const pw = document.getElementById('login-pw').value;
      if (!email || !pw) { showToast('이메일과 비밀번호를 입력하세요.', 'error'); return; }

      const user = ADMIN_ACCOUNTS.find(a => a.email === email && a.pw === pw);
      if (user) {
        localStorage.setItem('wm_logged_in', user.email);
        applyLogin(user);
        showToast(`${user.name}님, 환영합니다.`, 'success');
        return;
      }

      if (!sbReady) { showToast('이메일 또는 비밀번호가 올바르지 않습니다.', 'error'); return; }
      try {
        const { data, error } = await sbClient.auth.signInWithPassword({ email, password: pw });
        if (error || !data.user) { showToast('이메일 또는 비밀번호가 올바르지 않습니다.', 'error'); return; }

        let u = usersData.find(x => x.email.toLowerCase() === email.toLowerCase());
        if (!u) {
          const meta = data.user.user_metadata || {};
          u = { id: data.user.id, name: meta.name || email, email, role: meta.role || 'HR 관리자', status: '활성', lastLogin: '—' };
          usersData.push(u);
        }
        if (u.status === '비활성') {
          showToast('비활성화된 계정입니다. 관리자에게 문의하세요.', 'error');
          await sbClient.auth.signOut();
          return;
        }
        u.status = '활성';
        u.lastLogin = new Date().toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
        saveData();
        applyLoginAsUser(u);
        showToast(`${u.name}님, 환영합니다.`, 'success');
      } catch (e) {
        showToast('이메일 또는 비밀번호가 올바르지 않습니다.', 'error');
      }
    }

    function applyLogin(user) {
      document.getElementById('auth-screen').style.display = 'none';
      document.getElementById('app-screen').style.display = 'flex';
      document.getElementById('header-avatar').textContent = user.initials;
      document.getElementById('account-name').value = user.name;
      document.getElementById('account-email').value = user.email;
      const now = new Date().toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
      document.getElementById('admin-last-login').textContent = now;
      currentUserRole = user.role || '';
      updateAdminTabVisibility();
      addAuditLog(user.name, '로그인', '—');
      nav('dashboard');
    }

    function updateAdminTabVisibility() {
      const aiTab = document.getElementById('atab-ai');
      if (!aiTab) return;
      const allowed = currentUserRole === '시스템 관리자';
      aiTab.style.display = allowed ? '' : 'none';
      if (!allowed && aiTab.classList.contains('active')) switchAdminTab('users');
    }

    function doLogout() {
      localStorage.removeItem('wm_logged_in');
      localStorage.removeItem('wm_invited_user');
      document.getElementById('app-screen').style.display = 'none';
      document.getElementById('auth-screen').style.display = '';
      showToast('로그아웃되었습니다.', 'info');
    }

    function applyLoginAsUser(u) {
      const initials = (u.name || u.email).slice(0, 2).toUpperCase();
      applyLogin({ email: u.email, name: u.name, role: u.role, initials });
      localStorage.setItem('wm_invited_user', u.email);
    }

    async function changePassword() {
      const pw = document.getElementById('new-pw').value;
      const pwConfirm = document.getElementById('new-pw-confirm').value;
      if (!pw || pw.length < 8) { showToast('비밀번호는 최소 8자 이상이어야 합니다.', 'error'); return; }
      if (pw !== pwConfirm) { showToast('새 비밀번호가 일치하지 않습니다.', 'error'); return; }
      if (!sbReady) { showToast('서버 연결을 확인할 수 없습니다.', 'error'); return; }
      try {
        const { data: sessionData } = await sbClient.auth.getSession();
        if (!sessionData.session) {
          showToast('이 계정은 비밀번호 변경을 지원하지 않습니다.', 'error');
          return;
        }
        const { error } = await sbClient.auth.updateUser({ password: pw });
        if (error) { showToast(`비밀번호 변경 실패: ${error.message}`, 'error'); return; }
        document.getElementById('new-pw').value = '';
        document.getElementById('new-pw-confirm').value = '';
        showToast('비밀번호가 변경되었습니다. 다음부터 이메일/비밀번호로 로그인할 수 있습니다.', 'success');
      } catch (e) {
        showToast(`비밀번호 변경 실패: ${e.message}`, 'error');
      }
    }

    async function sendLoginLink() {
      const email = (document.getElementById('forgot-email').value || '').trim();
      if (!email) { showToast('이메일을 입력하세요.', 'error'); return; }
      if (!sbReady) { showToast('서버 연결을 확인할 수 없습니다.', 'error'); return; }
      try {
        const { error } = await sbClient.auth.signInWithOtp({
          email,
          options: { shouldCreateUser: false, emailRedirectTo: window.location.origin },
        });
        if (error) {
          showToast(`발송 실패: ${error.message}`, 'error');
          return;
        }
        showToast('로그인 링크가 발송되었습니다. 메일을 확인하세요.', 'success');
        showPanel('login-panel');
      } catch (e) {
        showToast(`발송 실패: ${e.message}`, 'error');
      }
    }

    async function handleAuthRedirect() {
      if (!sbReady) return false;
      if (!window.location.hash.includes('access_token')) return false;
      const params = new URLSearchParams(window.location.hash.slice(1));
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');
      if (!access_token || !refresh_token) return false;

      try {
        const { data, error } = await sbClient.auth.setSession({ access_token, refresh_token });
        history.replaceState(null, '', window.location.pathname);
        if (error || !data.user) { showToast('로그인 링크가 만료되었거나 올바르지 않습니다.', 'error'); return false; }

        const email = data.user.email;
        let u = usersData.find(x => x.email.toLowerCase() === email.toLowerCase());
        if (!u) {
          const meta = data.user.user_metadata || {};
          u = { id: data.user.id, name: meta.name || email, email, role: meta.role || 'HR 관리자', status: '활성', lastLogin: '—' };
          usersData.push(u);
        }
        u.status = '활성';
        u.lastLogin = new Date().toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
        saveData();
        applyLoginAsUser(u);
        showToast(`${u.name}님, 환영합니다.`, 'success');
        return true;
      } catch (e) {
        showToast(`로그인 처리 실패: ${e.message}`, 'error');
        return false;
      }
    }

    // ── Tabs ──
    function switchTab(t) {
      document.getElementById('tab-direct').classList.toggle('active', t === 'direct');
      document.getElementById('tab-upload').classList.toggle('active', t === 'upload');
      document.getElementById('tab-content-direct').style.display = t === 'direct' ? '' : 'none';
      document.getElementById('tab-content-upload').style.display = t === 'upload' ? '' : 'none';
    }

    function switchReportTab(t) {
      document.getElementById('rtab-structured').classList.toggle('active', t === 'structured');
      document.getElementById('rtab-career').classList.toggle('active', t === 'career');
      document.getElementById('report-tab-structured').style.display = t === 'structured' ? '' : 'none';
      document.getElementById('report-tab-career').style.display = t === 'career' ? '' : 'none';
    }

    function switchAdminTab(t) {
      ['users', 'ai', 'gs', 'ivset', 'security', 'audit', 'data'].forEach(tab => {
        document.getElementById('atab-' + tab).classList.toggle('active', tab === t);
        document.getElementById('admin-tab-' + tab).style.display = tab === t ? '' : 'none';
      });
      if (t === 'ai') loadApiKeyUI();
      if (t === 'gs') loadGsheetsConfigUI();
      if (t === 'ivset') renderInterviewSettingsUI();
      if (t === 'data') renderBackupHistoryUI();
    }

    // ── 백업 대상 localStorage 키 전체 ──
    const BACKUP_KEYS = ['wm_sheets', 'wm_matching', 'wm_audit', 'wm_users', 'wm_schedule', 'wm_interviewers', 'wm_iv_appts', 'wm_iv_settings', 'wm_ci_results', 'wm_ai_model'];

    function collectBackupPayload() {
      const payload = { version: 2, exportedAt: new Date().toISOString() };
      BACKUP_KEYS.forEach(k => { payload[k] = localStorage.getItem(k) || (k === 'wm_iv_settings' ? '{}' : k === 'wm_ai_model' ? '' : '[]'); });
      return payload;
    }

    function applyBackupPayload(payload) {
      BACKUP_KEYS.forEach(k => { if (payload[k] !== undefined) localStorage.setItem(k, payload[k]); });
      loadData();
      loadScheduleData();
      loadInterviewSettings();
      loadInterviewAppointments();
      aiModel = localStorage.getItem('wm_ai_model') || 'claude-sonnet-4-6';
      renderDashboard(); renderSheets(); renderMatching(); renderPositions();
      renderReports(); renderAuditLog(); renderUsers(); syncPositionDropdowns();
    }

    function backupCounts(payload) {
      const safeLen = (k, fallback) => { try { return JSON.parse(payload[k] || fallback).length; } catch (e) { return 0; } };
      return { sheets: safeLen('wm_sheets', '[]'), matches: safeLen('wm_matching', '[]'), users: safeLen('wm_users', '[]') };
    }

    // ── 데이터 내보내기 (수동, 파일로 저장) ──
    function exportAllData() {
      const payload = collectBackupPayload();
      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      const dateStr = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '-').replace('.', '');
      a.download = `채용매칭_백업_${dateStr}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      const c = backupCounts(payload);
      document.getElementById('export-status').textContent = `완료 — 설계시트 ${c.sheets}개, 매칭 ${c.matches}건, 사용자 ${c.users}명 내보냄`;
      showToast('데이터가 JSON 파일로 저장되었습니다.', 'success');
    }

    // ── 데이터 가져오기 (수동, 파일에서 복원) ──
    function importAllData(input) {
      if (!input.files.length) return;
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = function (e) {
        try {
          const payload = JSON.parse(e.target.result);
          if (!payload.version || !payload.wm_sheets) {
            showToast('올바른 백업 파일이 아닙니다.', 'error');
            return;
          }
          if (!confirm(`백업 파일을 가져오면 현재 데이터가 덮어씌워집니다.\n\n내보낸 일시: ${payload.exportedAt || '알 수 없음'}\n\n계속하시겠습니까?`)) {
            input.value = '';
            return;
          }
          takeLocalBackup('가져오기 직전 자동 백업');
          applyBackupPayload(payload);
          const c = backupCounts(payload);
          const statusEl = document.getElementById('import-status');
          statusEl.style.display = '';
          statusEl.className = 'text-sm text-green';
          statusEl.textContent = `✅ 가져오기 완료 — 설계시트 ${c.sheets}개, 매칭 ${c.matches}건, 사용자 ${c.users}명 복원됨`;
          input.value = '';
          showToast(`데이터를 성공적으로 가져왔습니다. (설계시트 ${c.sheets}개, 매칭 ${c.matches}건)`, 'success');
          saveData();
        } catch (err) {
          showToast('파일 파싱 오류: ' + err.message, 'error');
        }
      };
      reader.readAsText(file, 'UTF-8');
    }

    // ══════════════════════════════════════════════════
    //  로컬 자동 백업 (최근 N개 스냅샷을 브라우저에 보관)
    // ══════════════════════════════════════════════════
    const BACKUP_HISTORY_KEY = 'wm_backup_history';
    const BACKUP_HISTORY_MAX = 15;
    const BACKUP_MIN_INTERVAL_MS = 60 * 1000; // 같은 사유 없는 호출은 1분에 한 번만 스냅샷

    function loadBackupHistory() {
      try { return JSON.parse(localStorage.getItem(BACKUP_HISTORY_KEY) || '[]'); } catch (e) { return []; }
    }

    function takeLocalBackup(label) {
      try {
        const history = loadBackupHistory();
        const isThrottled = !label && history[0] && (Date.now() - new Date(history[0].time).getTime()) < BACKUP_MIN_INTERVAL_MS;
        if (isThrottled) return false;
        const snapshot = { time: new Date().toISOString(), label: label || '자동 백업', data: collectBackupPayload() };
        history.unshift(snapshot);
        while (history.length > BACKUP_HISTORY_MAX) history.pop();
        localStorage.setItem(BACKUP_HISTORY_KEY, JSON.stringify(history));
        return true;
      } catch (e) {
        console.warn('로컬 백업 실패:', e);
        return false;
      }
    }

    function manualBackupNow() {
      takeLocalBackup('수동 백업');
      renderBackupHistoryUI();
      showToast('현재 상태를 로컬 백업에 저장했습니다.', 'success');
    }

    function restoreLocalBackup(idx) {
      const history = loadBackupHistory();
      const snap = history[idx];
      if (!snap) return;
      const timeTx = new Date(snap.time).toLocaleString('ko-KR');
      if (!confirm(`"${snap.label}" (${timeTx}) 백업으로 복원하시겠습니까?\n현재 데이터는 덮어씌워집니다.`)) return;
      takeLocalBackup('복원 직전 자동 백업');
      applyBackupPayload(snap.data);
      renderBackupHistoryUI();
      showToast('백업으로 복원되었습니다.', 'success');
      saveData();
    }

    function downloadLocalBackup(idx) {
      const history = loadBackupHistory();
      const snap = history[idx];
      if (!snap) return;
      const json = JSON.stringify(snap.data, null, 2);
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      const dateStr = new Date(snap.time).toISOString().slice(0, 19).replace(/[:T]/g, '-');
      a.download = `채용매칭_백업_${dateStr}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    }

    function deleteLocalBackup(idx) {
      const history = loadBackupHistory();
      if (!history[idx]) return;
      history.splice(idx, 1);
      localStorage.setItem(BACKUP_HISTORY_KEY, JSON.stringify(history));
      renderBackupHistoryUI();
    }

    function renderBackupHistoryUI() {
      const list = document.getElementById('backup-history-list');
      if (!list) return;
      const history = loadBackupHistory();
      if (history.length === 0) {
        list.innerHTML = '<div class="text-sm text-gray" style="padding:12px 0">저장된 자동 백업이 없습니다.</div>';
        return;
      }
      list.innerHTML = history.map((snap, i) => {
        const c = backupCounts(snap.data);
        const timeTx = new Date(snap.time).toLocaleString('ko-KR');
        return `<div class="flex items-center justify-between" style="padding:10px 0;border-bottom:1px solid #f0f0f0">
      <div>
        <div style="font-size:13px;font-weight:600">${escHtml(snap.label)}</div>
        <div class="text-sm text-gray">${timeTx} · 설계시트 ${c.sheets}개 · 매칭 ${c.matches}건 · 사용자 ${c.users}명</div>
      </div>
      <div class="flex gap-8">
        <button class="btn btn-secondary btn-sm" onclick="downloadLocalBackup(${i})">⬇️ 다운로드</button>
        <button class="btn btn-primary btn-sm" onclick="restoreLocalBackup(${i})">복원</button>
        <button class="btn btn-danger btn-sm" onclick="deleteLocalBackup(${i})">삭제</button>
      </div>
    </div>`;
      }).join('');
    }

    // ── Sheet actions ──
    // ── 현재 열린 시트 인덱스 ──
    let currentSheetIdx = -1;

    // ── Level management ──
    function addLevelRow(prefix) {
      const tbody = document.getElementById(`${prefix}-levels-body`);
      const empty = document.getElementById(`${prefix}-levels-empty`);
      if (empty) empty.remove();
      const tr = document.createElement('tr');
      tr.className = 'level-row';
      tr.innerHTML = `
    <td><input class="level-input" placeholder="L1" style="width:64px" /></td>
    <td><input class="level-input" placeholder="신입" /></td>
    <td><input class="level-input" placeholder="0년" style="width:60px" /></td>
    <td><input class="level-input" placeholder="2년" style="width:60px" /></td>
    <td><input class="level-input" placeholder="비고" /></td>
    <td><button class="btn btn-danger btn-sm" style="padding:3px 8px" onclick="this.closest('tr').remove();checkLevelEmpty('${prefix}')">×</button></td>`;
      tbody.appendChild(tr);
    }

    function checkLevelEmpty(prefix) {
      const tbody = document.getElementById(`${prefix}-levels-body`);
      if (!tbody) return;
      if (tbody.querySelectorAll('tr.level-row').length === 0) {
        tbody.innerHTML = `<tr id="${prefix}-levels-empty"><td colspan="6" style="text-align:center;color:#bbb;font-size:12px;padding:16px">레벨을 추가하세요</td></tr>`;
      }
    }

    function getLevelsFromForm(prefix) {
      const rows = document.querySelectorAll(`#${prefix}-levels-body tr.level-row`);
      const levels = [];
      rows.forEach(row => {
        const inputs = row.querySelectorAll('input.level-input');
        const code = inputs[0]?.value.trim() || '';
        const name = inputs[1]?.value.trim() || '';
        if (code || name) {
          levels.push({ code: code || '—', name: name || '—', minYears: inputs[2]?.value.trim() || '', maxYears: inputs[3]?.value.trim() || '', note: inputs[4]?.value.trim() || '' });
        }
      });
      return levels;
    }

    function renderLevelsEdit(prefix, levels) {
      const tbody = document.getElementById(`${prefix}-levels-body`);
      if (!tbody) return;
      if (!levels || levels.length === 0) {
        tbody.innerHTML = `<tr id="${prefix}-levels-empty"><td colspan="6" style="text-align:center;color:#bbb;font-size:12px;padding:16px">레벨을 추가하세요</td></tr>`;
        return;
      }
      tbody.innerHTML = levels.map(lv => `
    <tr class="level-row">
      <td><input class="level-input" value="${escHtml(lv.code)}" placeholder="L1" style="width:64px" /></td>
      <td><input class="level-input" value="${escHtml(lv.name)}" placeholder="신입" /></td>
      <td><input class="level-input" value="${escHtml(lv.minYears)}" placeholder="0년" style="width:60px" /></td>
      <td><input class="level-input" value="${escHtml(lv.maxYears)}" placeholder="2년" style="width:60px" /></td>
      <td><input class="level-input" value="${escHtml(lv.note)}" placeholder="비고" /></td>
      <td><button class="btn btn-danger btn-sm" style="padding:3px 8px" onclick="this.closest('tr').remove();checkLevelEmpty('edit')">×</button></td>
    </tr>`).join('');
    }

    function saveSheet() {
      const positionName = document.getElementById('new-position').value.trim();
      const team = document.getElementById('new-team').value.trim();
      const reportTo = document.getElementById('new-report-to').value.trim();
      const headcount = document.getElementById('new-headcount').value.trim();
      const f1 = document.getElementById('new-f1').value.trim();
      const f2 = document.getElementById('new-f2').value.trim();
      const f3 = document.getElementById('new-f3').value.trim();
      const f4 = document.getElementById('new-f4').value.trim();
      const f5 = document.getElementById('new-f5').value.trim();
      const f6 = document.getElementById('new-f6').value.trim();

      if (!positionName) { showToast('포지션명을 입력하세요.', 'error'); return; }
      if (!f1 || !f2 || !f3 || !f6) { showToast('역량 레벨, 역할 범위, 필수 기술, 결정적 무기는 필수 항목입니다.', 'error'); return; }

      const now = new Date();
      const today = now.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '-').replace('.', '');
      const timeStr = now.toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

      const levels = getLevelsFromForm('new');
      const sheet = {
        name: positionName, team: team || '—', reportTo: reportTo || '—',
        headcount: headcount || '1',
        created: today, modified: today, version: 1,
        status: '',  // 수동 상태 override: '' = 자동, '채용완료'
        levels,
        f1, f2, f3, f4, f5, f6,
        history: [{ version: 1, time: timeStr, note: '최초 설계시트 생성', f1, f2, f3, f4, f5, f6 }]
      };
      sheetsData.push(sheet);
      currentSheetIdx = sheetsData.length - 1;
      saveData();
      renderSheets();
      renderPositions();
      syncPositionDropdowns();
      renderDashboard();

      // 폼 초기화
      ['new-position', 'new-team', 'new-report-to', 'new-headcount', 'new-f1', 'new-f2', 'new-f3', 'new-f4', 'new-f5', 'new-f6'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      checkLevelEmpty('new');
      switchTab('direct');

      addAuditLog('우성 관리자', '설계시트 생성', positionName);
      showToast(`"${positionName}" 설계시트가 저장되었습니다.`, 'success');
      setTimeout(() => nav('sheets'), 600);
    }

    function renderSheets() {
      const tbody = document.getElementById('sheets-tbody');
      if (sheetsData.length === 0) {
        tbody.innerHTML = '<tr id="sheets-empty"><td colspan="6"><div class="empty-state"><div class="empty-icon">📄</div><div class="empty-text">생성된 설계 시트가 없습니다. 설계시트를 생성해보세요.</div></div></td></tr>';
        return;
      }
      tbody.innerHTML = sheetsData.map((s, i) => `
    <tr>
      <td><strong>${escHtml(s.name)}</strong></td>
      <td>${escHtml(s.team)}</td>
      <td class="text-gray text-sm">${s.created}</td>
      <td class="text-gray text-sm">${s.modified}</td>
      <td class="text-gray text-sm">v${s.version}</td>
      <td class="flex gap-8">
        <button class="btn btn-secondary btn-sm" onclick="openSheetDetail(${i})">상세 보기</button>
        <button class="btn btn-secondary btn-sm" onclick="openSheetHistory(${i})">이력</button>
      </td>
    </tr>`).join('');
    }

    function escHtml(s) {
      return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function openSheetDetail(idx) {
      currentSheetIdx = idx;
      const s = sheetsData[idx];
      document.getElementById('detail-title').textContent = s.name;
      document.getElementById('detail-subtitle').textContent =
        `${s.team} · 보고대상: ${s.reportTo} · v${s.version} · 최종 수정: ${s.modified}`;
      renderSheetViewGrid(s);
      // 수정 모드 초기화
      document.getElementById('sheet-view-mode').style.display = '';
      document.getElementById('sheet-edit-mode').style.display = 'none';
      document.getElementById('sheet-edit-toggle').textContent = '수정';
      nav('sheet-detail');
    }

    function renderSheetViewGrid(s) {
      const labels = ['① 역량 레벨', '② 역할 범위', '③ 필수 지식 / 기술', '④ 폐기 / 자동화 업무', '⑤ 효율 증대 업무', '⑥ 결정적 무기 ⭐'];
      const fields = [s.f1, s.f2, s.f3, s.f4, s.f5, s.f6];
      const levelsHtml = (s.levels && s.levels.length > 0) ? `
    <div class="card" style="grid-column:1/-1">
      <div class="text-sm text-gray mb-12">직무 레벨</div>
      <table class="level-table">
        <thead><tr><th style="width:80px">레벨코드</th><th style="width:110px">레벨명</th><th style="width:80px">최소경력</th><th style="width:80px">최대경력</th><th>비고</th></tr></thead>
        <tbody>${s.levels.map(lv => `
          <tr>
            <td><span class="level-badge">${escHtml(lv.code)}</span></td>
            <td style="font-weight:600">${escHtml(lv.name)}</td>
            <td class="text-gray text-sm">${escHtml(lv.minYears) || '—'}</td>
            <td class="text-gray text-sm">${escHtml(lv.maxYears) || '—'}</td>
            <td class="text-gray text-sm">${escHtml(lv.note) || '—'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>` : '';

      document.getElementById('sheet-view-grid').innerHTML = levelsHtml + fields.map((v, i) => `
    <div class="card${i === 5 ? '" style="border-left:3px solid #333' : ''}">
      <div class="text-sm text-gray mb-8">${labels[i]}</div>
      <p style="line-height:1.7;font-size:14px;white-space:pre-wrap">${escHtml(v) || '<span class="text-gray">내용 없음</span>'}</p>
    </div>`).join('');
    }

    function openSheetHistory(idx) {
      currentSheetIdx = idx;
      const s = sheetsData[idx];
      document.getElementById('history-subtitle').textContent = `${s.name} · 설계시트 버전 관리`;
      const list = document.getElementById('history-list');
      list.innerHTML = s.history.slice().reverse().map((h, ri) => {
        const isLatest = ri === 0;
        return `<div class="history-row">
      <div class="history-dot${isLatest ? ' latest' : ''}"></div>
      <div style="flex:1">
        <div class="flex items-center gap-8 mb-4">
          <strong>v${h.version}${isLatest ? ' (현재)' : ''}</strong>
          ${isLatest ? '<span class="badge badge-blue">최신</span>' : ''}
          <span class="text-gray text-sm">${h.time}</span>
        </div>
        <p class="text-sm text-gray">${escHtml(h.note)}</p>
        <div class="flex gap-8 mt-8">
          ${!isLatest ? `<button class="btn btn-secondary btn-sm" onclick="restoreSheetVersion(${idx},${h.version})">이 버전으로 복원</button>` : ''}
        </div>
      </div>
    </div>`;
      }).join('');
      nav('sheet-history');
    }

    function restoreSheetVersion(idx, ver) {
      const s = sheetsData[idx];
      const h = s.history.find(x => x.version === ver);
      if (!h) return;
      s.f1 = h.f1; s.f2 = h.f2; s.f3 = h.f3;
      s.f4 = h.f4; s.f5 = h.f5; s.f6 = h.f6;
      const now = new Date().toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
      s.version++;
      s.modified = now.split(' ')[0];
      s.history.push({ version: s.version, time: now, note: `v${ver} 버전으로 복원`, f1: s.f1, f2: s.f2, f3: s.f3, f4: s.f4, f5: s.f5, f6: s.f6 });
      renderSheets();
      showToast(`v${ver} 버전으로 복원되었습니다.`, 'success');
      openSheetHistory(idx);
    }

    function toggleSheetEdit() {
      const viewMode = document.getElementById('sheet-view-mode');
      const editMode = document.getElementById('sheet-edit-mode');
      const btn = document.getElementById('sheet-edit-toggle');
      const isEdit = editMode.style.display !== 'none';
      if (!isEdit && currentSheetIdx >= 0) {
        // 수정 모드 진입: 현재 값 채우기
        const s = sheetsData[currentSheetIdx];
        document.getElementById('edit-f1').value = s.f1 || '';
        document.getElementById('edit-f2').value = s.f2 || '';
        document.getElementById('edit-f3').value = s.f3 || '';
        document.getElementById('edit-f4').value = s.f4 || '';
        document.getElementById('edit-f5').value = s.f5 || '';
        document.getElementById('edit-f6').value = s.f6 || '';
        renderLevelsEdit('edit', s.levels || []);
      }
      viewMode.style.display = isEdit ? '' : 'none';
      editMode.style.display = isEdit ? 'none' : '';
      btn.textContent = isEdit ? '수정' : '취소';
    }

    function saveSheetEdit() {
      if (currentSheetIdx < 0) return;
      const s = sheetsData[currentSheetIdx];
      const f1 = document.getElementById('edit-f1').value.trim();
      const f2 = document.getElementById('edit-f2').value.trim();
      const f3 = document.getElementById('edit-f3').value.trim();
      const f4 = document.getElementById('edit-f4').value.trim();
      const f5 = document.getElementById('edit-f5').value.trim();
      const f6 = document.getElementById('edit-f6').value.trim();
      if (!f1 || !f2 || !f3 || !f6) { showToast('역량 레벨, 역할 범위, 필수 기술, 결정적 무기는 필수 항목입니다.', 'error'); return; }
      s.levels = getLevelsFromForm('edit');
      s.f1 = f1; s.f2 = f2; s.f3 = f3; s.f4 = f4; s.f5 = f5; s.f6 = f6;
      s.version++;
      const now = new Date().toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
      s.modified = now.split(' ')[0];
      s.history.push({ version: s.version, time: now, note: '내용 수정', f1, f2, f3, f4, f5, f6 });
      document.getElementById('detail-subtitle').textContent =
        `${s.team} · 보고대상: ${s.reportTo} · v${s.version} · 최종 수정: ${s.modified}`;
      renderSheetViewGrid(s);
      renderSheets();
      saveData();
      addAuditLog('우성 관리자', '설계시트 수정', s.name + ` v${s.version}`);
      showToast(`변경 사항이 저장되었습니다. (v${s.version} 생성)`, 'success');
      toggleSheetEdit();
    }

    function confirmDeleteSheet() {
      if (currentSheetIdx < 0) return;
      const name = sheetsData[currentSheetIdx].name;
      showConfirm('설계시트 삭제', `"${name}" 설계시트를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`, () => {
        sheetsData.splice(currentSheetIdx, 1);
        currentSheetIdx = -1;
        saveData();
        renderSheets();
        renderPositions();
        syncPositionDropdowns();
        renderDashboard();
        addAuditLog('우성 관리자', '설계시트 삭제', name);
        showToast(`"${name}" 설계시트가 삭제되었습니다.`, 'success');
        nav('sheets');
      });
    }

    // ── File upload ──
    function handleDocxUpload(input) {
      if (!input.files.length) return;
      const file = input.files[0];
      if (!file.name.toLowerCase().endsWith('.docx')) {
        showToast('.docx 형식의 파일만 업로드 가능합니다.', 'error');
        return;
      }
      showToast(`"${file.name}" 파일을 파싱 중입니다...`, 'info');

      const reader = new FileReader();
      reader.onload = function (e) {
        const arrayBuffer = e.target.result;
        if (typeof mammoth === 'undefined') {
          showToast('라이브러리 로딩 실패. 직접 입력 방식을 사용해 주세요.', 'error');
          return;
        }
        mammoth.extractRawText({ arrayBuffer })
          .then(function (result) {
            const text = result.value || '';
            const fields = parseDocxFields(text);
            // 파싱된 내용을 직접입력 탭 필드에 채우기
            document.getElementById('new-f1').value = fields.f1;
            document.getElementById('new-f2').value = fields.f2;
            document.getElementById('new-f3').value = fields.f3;
            document.getElementById('new-f4').value = fields.f4;
            document.getElementById('new-f5').value = fields.f5;
            document.getElementById('new-f6').value = fields.f6;
            switchTab('direct');
            input.value = '';
            showToast('파일 파싱 완료! 내용을 확인하고 필요시 수정 후 저장하세요.', 'success');
          })
          .catch(function (err) {
            showToast('파일 파싱 중 오류가 발생했습니다. 직접 입력을 사용해 주세요.', 'error');
            console.error(err);
          });
      };
      reader.readAsArrayBuffer(file);
    }

    // 워드 문서 텍스트에서 6가지 항목 자동 파싱
    function parseDocxFields(text) {
      const fields = { f1: '', f2: '', f3: '', f4: '', f5: '', f6: '' };
      // 키워드 패턴: 번호나 키워드로 섹션 감지
      const patterns = [
        { key: 'f1', kw: ['역량 레벨', '역량레벨', 'competency level', '①', '1.', '(1)'] },
        { key: 'f2', kw: ['역할 범위', '역할범위', 'role scope', '②', '2.', '(2)'] },
        { key: 'f3', kw: ['필수 지식', '필수기술', '필수 기술', 'required skill', '③', '3.', '(3)'] },
        { key: 'f4', kw: ['폐기', '자동화 업무', '자동화업무', '④', '4.', '(4)'] },
        { key: 'f5', kw: ['효율', '업무 조정', '업무조정', '⑤', '5.', '(5)'] },
        { key: 'f6', kw: ['결정적 무기', '결정적무기', 'decisive weapon', '⑥', '6.', '(6)'] },
      ];

      const lines = text.split('\n').map(l => l.trim()).filter(l => l);
      let currentField = null;
      const fieldContent = { f1: [], f2: [], f3: [], f4: [], f5: [], f6: [] };

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lLower = line.toLowerCase();
        let matched = false;
        for (const p of patterns) {
          if (p.kw.some(k => lLower.includes(k.toLowerCase()))) {
            currentField = p.key;
            // 헤더 줄은 내용에 포함하지 않음 (짧으면 제목으로 판단)
            if (line.length > 30) fieldContent[p.key].push(line);
            matched = true;
            break;
          }
        }
        if (!matched && currentField) {
          fieldContent[currentField].push(line);
        }
      }

      // 빈 섹션이면 전체 텍스트를 f1에 넣고 사용자가 직접 분류하도록 안내
      const hasAnyContent = Object.values(fieldContent).some(v => v.length > 0);
      if (!hasAnyContent) {
        fields.f1 = text.trim();
        showToast('항목을 자동으로 구분하지 못했습니다. 내용을 직접 분류해 주세요.', 'info');
      } else {
        Object.keys(fields).forEach(k => {
          fields[k] = fieldContent[k].join('\n').trim();
        });
      }
      return fields;
    }

    // ── 이력서 입력 탭 전환 ──
    let resumeInputMode = 'file'; // 'file' | 'paste'
    let resumeExtractedText = '';

    function switchResumeTab(tab) {
      resumeInputMode = tab;
      document.getElementById('rtab-file').classList.toggle('active', tab === 'file');
      document.getElementById('rtab-paste').classList.toggle('active', tab === 'paste');
      document.getElementById('resume-tab-file').style.display = tab === 'file' ? '' : 'none';
      document.getElementById('resume-tab-paste').style.display = tab === 'paste' ? '' : 'none';
    }

    // ── 파일 업로드 ──
    function handleResumeFile(input) {
      const files = input.files || input;
      if (!files.length) return;
      const f = files[0];

      // 용량 체크 (20MB)
      if (f.size > 20 * 1024 * 1024) {
        showToast('파일 크기는 20MB 이하만 가능합니다.', 'error');
        return;
      }

      document.getElementById('resume-file-name').textContent = f.name;
      document.getElementById('resume-file-size').textContent = (f.size / 1024).toFixed(1) + ' KB';
      document.getElementById('resume-file-info').style.display = '';
      const statusEl = document.getElementById('resume-extract-status');
      statusEl.style.display = '';
      statusEl.textContent = '텍스트 추출 중...';
      resumeExtractedText = '';

      const ext = f.name.split('.').pop().toLowerCase();

      if (ext === 'docx' && typeof mammoth !== 'undefined') {
        // DOCX → mammoth 텍스트 추출
        const reader = new FileReader();
        reader.onload = e => {
          mammoth.extractRawText({ arrayBuffer: e.target.result })
            .then(r => {
              resumeExtractedText = r.value.trim();
              statusEl.textContent = `텍스트 추출 완료 (${resumeExtractedText.length.toLocaleString()}자)`;
            })
            .catch(() => {
              resumeExtractedText = f.name;
              statusEl.textContent = '텍스트 추출 실패 — 파일명으로 분석합니다.';
            });
        };
        reader.readAsArrayBuffer(f);
      } else if (ext === 'txt') {
        // TXT → 직접 읽기
        const reader = new FileReader();
        reader.onload = e => {
          resumeExtractedText = e.target.result.trim();
          statusEl.textContent = `텍스트 추출 완료 (${resumeExtractedText.length.toLocaleString()}자)`;
        };
        reader.readAsText(f, 'UTF-8');
      } else {
        // PDF, DOC 등 → 파일명/메타 정보 사용
        resumeExtractedText = f.name;
        statusEl.textContent = 'PDF/DOC 형식은 파일 기반으로 분석합니다.';
      }
    }

    function handleResumeDrop(e) {
      e.preventDefault();
      document.getElementById('resume-drop-zone').classList.remove('dragover');
      const files = e.dataTransfer.files;
      if (files.length) {
        document.getElementById('resume-file-input').files; // reset
        handleResumeFile(files);
      }
    }

    function clearResumeFile() {
      const inp = document.getElementById('resume-file-input');
      if (inp) inp.value = '';
      document.getElementById('resume-file-info').style.display = 'none';
      document.getElementById('resume-file-name').textContent = '';
      document.getElementById('resume-file-size').textContent = '';
      document.getElementById('resume-extract-status').style.display = 'none';
      resumeExtractedText = '';
    }

    function updatePasteCount() {
      const txt = document.getElementById('resume-paste-text');
      const cnt = document.getElementById('paste-char-count');
      if (txt && cnt) cnt.textContent = txt.value.length.toLocaleString();
    }

    // ════════════════════════════════════════
    //  키워드 기반 매칭 분석 엔진
    // ════════════════════════════════════════

    /**
     * 텍스트에서 의미 있는 키워드 토큰 추출
     * 쉼표/슬래시/점/괄호 등 구분자로 분리, 2자 이상
     */
    function extractKeywords(text) {
      if (!text) return [];
      return text
        .split(/[\s,\/\.\(\)\[\]\-·•→|]+/)
        .map(t => t.trim().toLowerCase())
        .filter(t => t.length >= 2);
    }

    /**
     * 이력서 텍스트에서 특정 키워드가 언급되는지 확인 (부분 매칭 포함)
     */
    function keywordInResume(keyword, resumeLower) {
      if (!keyword || keyword.length < 2) return false;
      return resumeLower.includes(keyword.toLowerCase());
    }

    /**
     * 단일 항목 점수 계산 (1.0~5.0)
     * sheetField: 설계시트 항목 텍스트
     * resumeText: 이력서 전체 텍스트 (소문자화)
     * weight: 가중치 배수
     */
    function scoreField(sheetField, resumeLower) {
      if (!sheetField || sheetField.trim() === '—') return 3.0; // 해당 없음 → 중립
      const keywords = extractKeywords(sheetField);
      if (keywords.length === 0) return 3.0;

      let hits = 0;
      keywords.forEach(kw => { if (keywordInResume(kw, resumeLower)) hits++; });
      const ratio = hits / keywords.length;

      // ratio 0→1 을 1.0~5.0 구간에 매핑 (최소 1.0, 최대 5.0)
      const raw = 1.0 + ratio * 4.0;
      return Math.round(raw * 10) / 10;
    }

    /**
     * 매칭된/미매칭 키워드 목록 반환
     */
    function getMatchedKeywords(sheetField, resumeLower) {
      if (!sheetField || sheetField.trim() === '—') return { matched: [], missing: [] };
      const keywords = [...new Set(extractKeywords(sheetField))]; // 중복 제거
      const matched = keywords.filter(k => keywordInResume(k, resumeLower));
      const missing = keywords.filter(k => !keywordInResume(k, resumeLower));
      return { matched, missing };
    }

    /**
     * 경력 연수 추출 (이력서 텍스트에서 "N년" 패턴)
     */
    function extractYearsExp(resumeText) {
      const m = resumeText.match(/경력\s*(\d+)년|(\d+)년\s*경력|(\d+)년차/);
      if (m) return parseInt(m[1] || m[2] || m[3]);
      return null;
    }

    /**
     * 핵심 분석 함수: 이력서 텍스트 vs 설계시트 → 항목별 점수·피드백 생성
     */
    function analyzeResumeAgainstSheet(resumeText, sheet) {
      const rLow = resumeText.toLowerCase();
      const fieldLabels = ['역량 레벨', '역할 범위', '필수 지식/기술', '폐기/자동화 이해', '효율 증대 업무', '결정적 무기'];
      const fields = [sheet.f1, sheet.f2, sheet.f3, sheet.f4, sheet.f5, sheet.f6];
      // 결정적 무기(f6)는 가중치 2배
      const weights = [1, 1, 1.5, 0.7, 0.8, 2];

      const itemScores = fields.map((f, i) => scoreField(f, rLow));

      // 가중 평균으로 종합점수
      let weightedSum = 0, totalW = 0;
      itemScores.forEach((s, i) => { weightedSum += s * weights[i]; totalW += weights[i]; });
      const overall = Math.round((weightedSum / totalW) * 10) / 10;

      // 항목별 매칭 키워드
      const itemMatches = fields.map((f, i) => getMatchedKeywords(f, rLow));

      // 경력 연수 체크 (역량 레벨 보정)
      const expYears = extractYearsExp(resumeText);

      // 피드백 생성
      const feedbackPos = [];
      const feedbackNeg = [];
      const strengthChips = [];
      const missingChips = [];

      fields.forEach((f, i) => {
        const { matched, missing } = itemMatches[i];
        const s = itemScores[i];
        if (s >= 3.5 && matched.length > 0) {
          feedbackPos.push(`✅ ${fieldLabels[i]} 적합 — "${matched.slice(0, 3).join('", "')}" 등 확인됨`);
          matched.slice(0, 3).forEach(k => strengthChips.push(k));
        } else if (s < 3.0 && missing.length > 0) {
          feedbackNeg.push(`⚠️ ${fieldLabels[i]} 미흡 — "${missing.slice(0, 3).join('", "')}" 등 언급 없음`);
          missing.slice(0, 3).forEach(k => missingChips.push(k));
        }
        if (missing.length > 0) {
          missing.slice(0, 2).forEach(k => { if (!missingChips.includes(k)) missingChips.push(k); });
        }
      });

      // 경력 연수 기반 추가 피드백
      if (expYears !== null) {
        const note = expYears >= 5
          ? `✅ 경력 ${expYears}년 확인 — 시니어 수준 충족`
          : `⚠️ 경력 ${expYears}년 — 요구 수준 검토 필요`;
        expYears >= 5 ? feedbackPos.unshift(note) : feedbackNeg.unshift(note);
      }

      // 피드백이 전혀 없으면 기본 메시지
      if (feedbackPos.length === 0 && feedbackNeg.length === 0) {
        feedbackNeg.push('⚠️ 이력서 텍스트에서 설계시트 키워드를 충분히 감지하지 못했습니다. 이력서 내용을 보완하거나 파일을 다시 업로드하세요.');
      }

      return {
        overall,
        itemScores,   // [f1~f6 점수]
        fieldLabels,
        feedbackPos,
        feedbackNeg,
        strengthChips: [...new Set(strengthChips)].slice(0, 6),
        missingChips: [...new Set(missingChips)].slice(0, 6),
        expYears,
      };
    }

    // ── 현재 열람 중인 매칭 인덱스 (새 openMatchResult는 위 AI 섹션에 정의) ──
    let currentMatchIdx = -1;

    // ── 분석 실행 ──
    function runAnalysis() {
      const position = document.getElementById('upload-position-select').value;
      const applicant = document.getElementById('upload-applicant-name').value.trim();
      const channel = document.getElementById('upload-channel-select')?.value || '';
      if (!position) { showToast('대상 포지션을 선택하세요.', 'error'); return; }
      if (!applicant) { showToast('지원자명을 입력하세요.', 'error'); return; }
      if (!channel) { showToast('소싱 채널을 선택하세요.', 'error'); return; }

      let sourceLabel = '';
      if (resumeInputMode === 'file') {
        const fileName = document.getElementById('resume-file-name').textContent.trim();
        if (!fileName) { showToast('이력서 파일을 선택하세요.', 'error'); return; }
        sourceLabel = fileName;
      } else {
        const pasteText = document.getElementById('resume-paste-text').value.trim();
        if (!pasteText) { showToast('이력서 내용을 붙여넣으세요.', 'error'); return; }
        if (pasteText.length < 50) { showToast('이력서 내용이 너무 짧습니다.', 'error'); return; }
        resumeExtractedText = pasteText;
        sourceLabel = '텍스트 붙여넣기';
      }

      const today = new Date().toLocaleDateString('ko-KR',
        { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '-').replace('.', '');
      const entry = {
        id: generateId(),
        applicant, position, date: today, source: sourceLabel, channel,
        extractedText: resumeExtractedText || '',
        score: '—', sub1: '—', sub2: '—', sub3: '—',
        analysis: null, reportData: null,
      };
      matchingData.push(entry);
      const idx = matchingData.length - 1;
      saveData();
      document.getElementById('stat-resumes').textContent = matchingData.length;
      addAuditLog('우성 관리자', '매칭 분석 실행', `${applicant} (${position})`);

      // 폼 초기화
      clearResumeFile(); resumeExtractedText = '';
      document.getElementById('resume-paste-text').value = ''; updatePasteCount();
      document.getElementById('upload-position-select').value = '';
      document.getElementById('upload-applicant-name').value = '';
      document.getElementById('upload-channel-select').value = '';
      switchResumeTab('file');

      openMatchResult(idx); // async — AI 또는 키워드 분석
      renderMatching(); renderPositions(); renderDashboard();
    }

    function syncPositionDropdowns() {
      const positions = sheetsData.map(s => s.name);
      const filterSel = document.getElementById('matching-filter-position');
      const uploadSel = document.getElementById('upload-position-select');
      if (filterSel) {
        const cur = filterSel.value;
        filterSel.innerHTML = '<option value="">전체 포지션</option>' +
          positions.map(p => `<option value="${escHtml(p)}"${cur === p ? ' selected' : ''}>${escHtml(p)}</option>`).join('');
      }
      if (uploadSel) {
        const cur = uploadSel.value;
        uploadSel.innerHTML = '<option value="">포지션을 선택하세요</option>' +
          positions.map(p => `<option value="${escHtml(p)}"${cur === p ? ' selected' : ''}>${escHtml(p)}</option>`).join('');
      }
    }

    function renderMatching(data) {
      const tbody = document.getElementById('matching-tbody');
      const rows = data !== undefined ? data : matchingData;
      if (rows.length === 0) {
        tbody.innerHTML = '<tr id="matching-empty"><td colspan="8"><div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-text">분석된 이력서가 없습니다. 이력서를 업로드해보세요.</div></div></td></tr>';
        return;
      }
      tbody.innerHTML = rows.map((m) => {
        const realIdx = matchingData.indexOf(m);
        const scoreNum = parseFloat(m.score);
        const cls = scoreNum >= 4 ? 'text-green' : scoreNum >= 3 ? '' : 'text-red';
        const sub1 = m.sub1 || (scoreNum * 0.9 + 0.1).toFixed(1);
        const sub2 = m.sub2 || (scoreNum * 0.95 + 0.05).toFixed(1);
        const sub3 = m.sub3 || (scoreNum * 0.85 + 0.1).toFixed(1);
        const isRejected = !!m.rejected;
        const ps = m.procStatus || '';
        let statusBadge;
        if (isRejected) statusBadge = `<span class="badge badge-red" style="font-size:11px">불합격</span>`;
        else if (ps === '과제/공통면접') statusBadge = `<span class="badge badge-orange" style="font-size:11px">과제/공통면접 진행</span>`;
        else if (ps === '최종면접') statusBadge = `<span class="badge badge-blue2" style="font-size:11px">최종면접 진행</span>`;
        else if (ps === '최종합격') statusBadge = `<span class="badge badge-green" style="font-size:11px">최종합격</span>`;
        else statusBadge = `<span class="badge badge-gray" style="font-size:11px">검토중</span>`;
        const rowStyle = isRejected ? ' style="opacity:0.6;background:#fff8f8"' : (ps === '최종합격' ? ' style="background:#f5fff8"' : '');
        return `<tr${rowStyle}>
      <td id="mname-${realIdx}">
        <div style="display:flex;align-items:center;gap:5px">
          <strong>${escHtml(m.applicant)}</strong>
          <button class="btn btn-secondary btn-sm" style="padding:1px 6px;font-size:11px;flex-shrink:0" onclick="editApplicantName(${realIdx})" title="이름 수정">✏️</button>
        </div>
      </td>
      <td>${escHtml(m.position)}</td>
      <td>
        <div style="display:flex;flex-direction:column;gap:4px">
          ${statusBadge}
          ${!isRejected ? `<select class="form-control" style="font-size:11px;padding:2px 6px;height:auto" onchange="changeProcStatus(${realIdx},this.value)">
            <option value="" ${!ps ? 'selected' : ''}>검토중</option>
            <option value="과제/공통면접" ${ps === '과제/공통면접' ? 'selected' : ''}>과제/공통면접 진행</option>
            <option value="최종면접" ${ps === '최종면접' ? 'selected' : ''}>최종면접 진행</option>
            <option value="최종합격" ${ps === '최종합격' ? 'selected' : ''}>최종합격</option>
          </select>` : ''}
        </div>
      </td>
      <td><span class="font-bold ${cls}">${m.score}</span>/5</td>
      <td>${sub1}</td><td>${sub2}</td><td>${sub3}</td>
      <td>
        <select class="form-control" style="font-size:11px;padding:2px 6px;height:auto;min-width:90px" onchange="changeChannel(${realIdx},this.value)">
          <option value="" ${!m.channel ? 'selected' : ''}>미지정</option>
          <option value="온라인" ${m.channel === '온라인' ? 'selected' : ''}>온라인</option>
          <option value="헤드헌터" ${m.channel === '헤드헌터' ? 'selected' : ''}>헤드헌터</option>
          <option value="추천채용" ${m.channel === '추천채용' ? 'selected' : ''}>추천채용</option>
          ${m.channel && !['온라인','헤드헌터','추천채용'].includes(m.channel) ? `<option value="${escHtml(m.channel)}" selected>${escHtml(m.channel)}</option>` : ''}
        </select>
      </td>
      <td class="text-gray text-sm">${m.date}</td>
      <td>
        <div style="display:flex;flex-direction:row;gap:6px;align-items:center;white-space:nowrap">
          <button class="btn btn-secondary btn-sm" onclick="openMatchResult(${realIdx})">결과 보기</button>
          <button class="btn ${isRejected ? 'btn-secondary' : 'btn-danger'} btn-sm" onclick="toggleRejected(${realIdx})">${isRejected ? '취소' : '불합격'}</button>
          <button class="btn btn-secondary btn-sm" style="color:#cc3333;border-color:#cc3333" onclick="deleteApplicant(${realIdx})">삭제</button>
        </div>
      </td>
    </tr>`;
      }).join('');
    }

    function editApplicantName(idx) {
      const cell = document.getElementById(`mname-${idx}`);
      if (!cell) return;
      const m = matchingData[idx];
      if (!m) return;
      cell.innerHTML = `
        <div style="display:flex;align-items:center;gap:4px">
          <input id="mname-input-${idx}" class="form-control" style="width:110px;padding:2px 6px;font-size:13px;height:auto" value="${escHtml(m.applicant)}" onkeydown="if(event.key==='Enter')saveApplicantName(${idx});if(event.key==='Escape')filterMatching()" />
          <button class="btn btn-primary btn-sm" style="padding:2px 8px;font-size:11px" onclick="saveApplicantName(${idx})">저장</button>
          <button class="btn btn-secondary btn-sm" style="padding:2px 8px;font-size:11px" onclick="filterMatching()">취소</button>
        </div>`;
      document.getElementById(`mname-input-${idx}`)?.focus();
    }

    function saveApplicantName(idx) {
      const m = matchingData[idx];
      if (!m) return;
      const input = document.getElementById(`mname-input-${idx}`);
      const val = input?.value.trim();
      if (!val) { showToast('이름을 입력하세요.', 'error'); return; }
      const old = m.applicant;
      if (old === val) { filterMatching(); return; }
      m.applicant = val;
      saveData();
      addAuditLog('우성 관리자', '지원자 이름 수정', `${old} → ${val}`);
      showToast(`이름이 "${val}"(으)로 수정되었습니다.`, 'success');
      filterMatching();
    }

    function changeChannel(idx, value) {
      const m = matchingData[idx];
      if (!m) return;
      const old = m.channel || '미지정';
      m.channel = value;
      saveData();
      addAuditLog('우성 관리자', '유입채널 수정', `${m.applicant} · ${old} → ${value || '미지정'}`);
    }

    function deleteApplicant(idx) {
      const m = matchingData[idx];
      if (!m) return;
      showConfirm(
        '지원자 삭제',
        `"${m.applicant}" (${m.position}) 분석 데이터를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`,
        () => {
          matchingData.splice(idx, 1);
          if (currentMatchIdx === idx) currentMatchIdx = -1;
          else if (currentMatchIdx > idx) currentMatchIdx--;
          saveData();
          filterMatching(); renderDashboard(); renderPositions(); renderReports(); syncPositionDropdowns();
          addAuditLog('우성 관리자', '지원자 삭제', `${m.applicant} (${m.position})`);
          showToast(`"${m.applicant}" 분석 데이터가 삭제되었습니다.`, 'success');
        }
      );
    }

    function toggleRejected(idx) {
      const m = matchingData[idx];
      if (!m) return;
      m.rejected = !m.rejected;
      saveData();
      filterMatching();
      showToast(m.rejected ? `"${m.applicant}" 불합격 처리되었습니다.` : `"${m.applicant}" 불합격이 취소되었습니다.`, m.rejected ? 'error' : 'success');
    }

    function filterMatching() {
      const pos = document.getElementById('matching-filter-position').value;
      const sort = document.getElementById('matching-filter-sort').value;
      const exclDone = document.getElementById('matching-exclude-completed')?.checked;
      const rejFilter = document.getElementById('matching-filter-rejected')?.value || '';
      let rows = matchingData.slice();
      if (pos) rows = rows.filter(m => m.position === pos);
      if (exclDone) {
        const completedPos = sheetsData.filter(s => s.status === '채용완료').map(s => s.name);
        rows = rows.filter(m => !completedPos.includes(m.position));
      }
      if (rejFilter === 'rejected') rows = rows.filter(m => m.rejected);
      else if (rejFilter === 'normal') rows = rows.filter(m => !m.rejected && !m.procStatus);
      else if (rejFilter === '과제/공통면접') rows = rows.filter(m => m.procStatus === '과제/공통면접');
      else if (rejFilter === '최종면접') rows = rows.filter(m => m.procStatus === '최종면접');
      else if (rejFilter === '최종합격') rows = rows.filter(m => m.procStatus === '최종합격');
      if (sort === 'score-desc') rows.sort((a, b) => parseFloat(b.score) - parseFloat(a.score));
      else if (sort === 'score-asc') rows.sort((a, b) => parseFloat(a.score) - parseFloat(b.score));
      renderMatching(rows);
    }

    // ══════════════════════════════════════════════════
    //  Claude API 연동 (Anthropic) 관리
    // ══════════════════════════════════════════════════

    let aiModel = localStorage.getItem('wm_ai_model') || 'claude-sonnet-4-6';
    let aiAvailable = false; // 서버에 Claude API 키가 설정되어 있는지 여부 (키 자체는 클라이언트에 절대 전달되지 않음)

    async function checkAiStatus() {
      try {
        const res = await fetch('/api/ai-status');
        const data = await res.json();
        aiAvailable = !!data.available;
      } catch (e) {
        aiAvailable = false;
      }
      updateAiStatus();
    }

    function loadApiKeyUI() {
      const sel = document.getElementById('ai-model-select');
      if (sel) sel.value = aiModel;
      updateAiStatus();
    }

    function updateAiStatus() {
      const el = document.getElementById('ai-key-status');
      if (!el) return;
      if (aiAvailable) {
        el.innerHTML = '<span class="badge badge-green">🚨 서버 API 키 연결됨 · AI 분석 활성</span>';
      } else {
        el.innerHTML = '<span class="badge badge-gray">⚪ 서버에 API 키 미설정 · 키워드 분석 모드</span>';
      }
    }

    function saveAiModel() {
      const sel = document.getElementById('ai-model-select');
      aiModel = sel.value;
      localStorage.setItem('wm_ai_model', aiModel);
      showToast('AI 모델 설정이 저장되었습니다.', 'success');
    }

    async function testApiKey() {
      if (!aiAvailable) { showToast('서버에 Claude API 키가 설정되어 있지 않습니다.', 'error'); return; }
      showToast('연결 테스트 중...', 'info');
      try {
        const res = await callClaudeAPI('안녕하세요. 연결 테스트입니다. "OK"라고만 답하세요. 응답은 {"status": "OK"} 형태의 JSON으로 주세요.', 50);
        showToast('✅ 연결 성공: ' + res.substring(0, 40), 'success');
      } catch (e) {
        showToast('❌ 연결 실패: ' + e.message.substring(0, 60), 'error');
      }
    }

    // Claude API 호출 (재시도 + 모델 폴백)
    async function callClaudeAPI(prompt, maxTokens = 4000) {
      const FALLBACK_MODELS = [
        'claude-sonnet-4-6',
        'claude-haiku-4-5-20251001',
      ];
      const modelsToTry = [aiModel, ...FALLBACK_MODELS.filter(m => m !== aiModel)];
      const MAX_RETRIES = 2;
      const RETRY_DELAYS = [3000, 6000];
      let lastError;

      for (const model of modelsToTry) {
        let skipToNextModel = false;

        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
          if (attempt > 0) {
            const delay = RETRY_DELAYS[attempt - 1];
            showToast(`⏳ 재시도 중... ${delay / 1000}초 대기 (${attempt}/${MAX_RETRIES})`, 'info');
            await new Promise(r => setTimeout(r, delay));
          }

          try {
            const resp = await fetch('/api/claude', {
              method: 'POST',

              headers: {
                'content-type': 'application/json'
              },

              body: JSON.stringify({
                model,
                max_tokens: maxTokens,
                messages: [{ role: 'user', content: prompt }]
              })
            });

            if (!resp.ok) {
              const err = await resp.json().catch(() => ({}));
              const msg = err?.error?.message || `HTTP ${resp.status}`;
              lastError = new Error(`[${model}] ${msg}`);
              const isRetryable = resp.status === 503 || resp.status === 529 || resp.status === 429 ||
                msg.toLowerCase().includes('overloaded') ||
                msg.toLowerCase().includes('rate limit');
              if (isRetryable) continue;
              skipToNextModel = true; break;
            }

            const data = await resp.json();
            const text = data.content?.[0]?.text || '';
            if (!text) { lastError = new Error(`[${model}] 빈 응답`); skipToNextModel = true; break; }

            if (model !== aiModel) showToast(`ℹ️ ${model} 모델로 대체 분석`, 'info');
            return text;

          } catch (e) {
            if (e instanceof TypeError) { lastError = new Error(`[${model}] 네트워크 오류: ${e.message}`); continue; }
            lastError = e;
            skipToNextModel = true; break;
          }
        }
        if (skipToNextModel) continue;
      }

      throw lastError || new Error('모든 모델에서 응답을 받지 못했습니다.');
    }

    // ══════════════════════════════════════════════════
    //  AI 매칭 분석 (Claude)
    // ══════════════════════════════════════════════════

    async function analyzeWithAI(resumeText, sheet) {
      const prompt = `당신은 채용 전문가입니다. 아래 채용 역할 설계시트와 지원자 이력서를 비교 분석해주세요.

## 채용 역할 설계시트 (포지션: ${sheet.name})
① 역량 레벨: ${sheet.f1}
② 역할 범위: ${sheet.f2}
③ 필수 지식/기술: ${sheet.f3}
④ 폐기/자동화 업무: ${sheet.f4}
⑤ 효율 증대 업무: ${sheet.f5}
⑥ 결정적 무기: ${sheet.f6}

## 지원자 이력서
${resumeText}

## 출력 규칙
반드시 아래 JSON 구조만 출력하세요. 마크다운 코드블록, 설명 텍스트, 주석 없이 순수 JSON만 출력하세요.
scores의 각 값은 1.0~5.0 사이 숫자, overall은 f6에 2배 가중한 종합 점수입니다.
interview_questions.role_based는 6~10개, career_issues는 경력 이슈가 없으면 빈 배열로 출력하세요.

{"scores":{"f1":0,"f2":0,"f3":0,"f4":0,"f5":0,"f6":0},"overall":0,"feedback_positive":["문장1","문장2"],"feedback_negative":["문장1","문장2"],"strengths":["키워드1","키워드2"],"gaps":["키워드1","키워드2"],"interview_questions":{"role_based":[{"category":"항목명","intent":"gap","question":"질문"}],"career_issues":[{"issue":"이슈제목","question":"질문"}]}}`;

      const raw = await callClaudeAPI(prompt, 4000);
      return parseAIJson(raw);
    }

    function parseAIJson(raw) {
      let str = raw.trim();

      // 1. 마크다운 코드블록 제거
      str = str.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

      // 2. 첫 { 부터 마지막 } 까지만 추출
      const start = str.indexOf('{');
      const end = str.lastIndexOf('}');
      if (start === -1 || end === -1) throw new Error('AI 응답에서 JSON을 찾을 수 없습니다. 응답: ' + raw.substring(0, 120));
      str = str.slice(start, end + 1);

      // 3. // 한 줄 주석 제거 (문자열 안 // 는 오탐 가능성 낮음)
      str = str.replace(/\/\/[^\n\r]*/g, '');

      // 4. /* */ 블록 주석 제거
      str = str.replace(/\/\*[\s\S]*?\*\//g, '');

      // 5. 후행 쉼표 제거 (trailing comma) — , 뒤에 } 또는 ] 가 오는 경우
      str = str.replace(/,(\s*[}\]])/g, '$1');

      // 6. 파싱 시도
      try {
        return JSON.parse(str);
      } catch (e) {
        throw new Error('JSON 파싱 오류: ' + e.message + ' | 원문(앞150자): ' + raw.substring(0, 150));
      }
    }

    // ══════════════════════════════════════════════════
    //  이력서 수정 · 재분석
    // ══════════════════════════════════════════════════

    function openResumeEditModal() {
      if (currentMatchIdx < 0) return;
      const m = matchingData[currentMatchIdx];
      const ta = document.getElementById('edit-resume-textarea');
      ta.value = m.extractedText || '';
      document.getElementById('edit-resume-char-count').textContent = ta.value.length.toLocaleString();
      openModal('modal-resume-edit');
    }

    async function reAnalyzeResume() {
      if (currentMatchIdx < 0) return;
      const newText = document.getElementById('edit-resume-textarea').value.trim();
      if (!newText || newText.length < 30) { showToast('이력서 내용을 더 자세히 입력해주세요.', 'error'); return; }

      const m = matchingData[currentMatchIdx];
      m.extractedText = newText;
      m.analysis = null;       // 캐시 초기화
      m.reportData = null;     // 리포트 캐시 초기화

      closeModal('modal-resume-edit');
      showToast('이력서 내용을 반영하여 재분석 중입니다...', 'info');
      await openMatchResult(currentMatchIdx);
    }

    // ══════════════════════════════════════════════════
    //  openMatchResult — AI 또는 키워드 분석 분기
    // ══════════════════════════════════════════════════

    async function openMatchResult(idx) {
      currentMatchIdx = idx;
      const m = matchingData[idx];
      if (!m) return;

      document.getElementById('mr-title').textContent = `매칭 결과 — ${m.applicant}`;
      document.getElementById('mr-subtitle').textContent = `${m.position} · 분석일: ${m.date} · 입력방식: ${m.source || '파일'}`;

      // 로딩 표시
      document.getElementById('mr-body').innerHTML =
        '<div class="card" style="text-align:center;padding:40px"><div style="font-size:28px;margin-bottom:12px">🚨</div><div class="text-gray">분석 중입니다...</div></div>';
      nav('match-result');

      const sheet = sheetsData.find(s => s.name === m.position);
      const hasText = m.extractedText && m.extractedText.length > 20;
      let analysis;

      if (m.analysis) {
        // 캐시 사용
        analysis = m.analysis;
      } else if (aiAvailable && sheet && hasText) {
        // AI 분석
        try {
          showToast('Claude AI로 분석 중입니다...', 'info');
          const aiResult = await analyzeWithAI(m.extractedText, sheet);
          analysis = convertAiResult(aiResult);
          m.analysis = analysis;
          m.reportData = aiResult; // 면접 질문도 저장
        } catch (e) {
          console.error('[AI 분석 오류]', e.message);
          showToast('AI 오류: ' + e.message.substring(0, 100) + ' — 키워드 분석으로 대체합니다.', 'error');
          analysis = sheet && hasText ? analyzeResumeAgainstSheet(m.extractedText, sheet) : fallbackAnalysis(m);
          m.analysis = analysis;
        }
      } else if (sheet && hasText) {
        // 키워드 분석
        analysis = analyzeResumeAgainstSheet(m.extractedText, sheet);
        m.analysis = analysis;
      } else {
        analysis = fallbackAnalysis(m);
        m.analysis = analysis;
      }

      // 점수 업데이트
      m.score = String(analysis.overall);
      m.sub1 = String(analysis.itemScores[0]);
      m.sub2 = String(analysis.itemScores[2]);
      m.sub3 = String(analysis.itemScores[5]);
      saveData();


      renderMatchResultBody(m, analysis, sheet);
      renderMatching(); renderDashboard();
    }

    function printMatchResult() {
      const m = matchingData[currentMatchIdx];
      if (!m) return;
      // 인쇄 헤더 채우기
      document.getElementById('pdf-title-text').textContent =
        `매칭 분석 결과 — ${m.applicant}`;
      document.getElementById('pdf-meta-text').textContent =
        `${m.position}  ·  분석일: ${m.date}  ·  출력일: ${new Date().toLocaleDateString('ko-KR')}`;
      const prevTitle = document.title;
      document.title = `매칭결과_${m.applicant}_${m.position}`;
      window.print();
      document.title = prevTitle;
    }

    function renderMatchResultBody(m, analysis, sheet) {
      const scNum = analysis.overall;
      const barClass = scNum >= 4.0 ? 'high' : scNum >= 3.0 ? 'mid' : 'low';
      const strengths = analysis.strengthChips || [];
      const gaps = analysis.missingChips || [];

      const strengthChipsHtml = strengths.length
        ? strengths.map(k => `<span class="chip" style="background:#e8f8ee;color:#2a9a50;font-weight:500">${escHtml(k)}</span>`).join('')
        : '<span class="text-gray text-sm">감지된 강점 키워드 없음</span>';

      const gapChipsHtml = gaps.length
        ? gaps.map(k => `<span class="chip" style="background:#ffeaea;color:#cc3333;font-weight:500">${escHtml(k)}</span>`).join('')
        : '<span class="text-gray text-sm">보완 키워드 없음</span>';

      const labels = analysis.fieldLabels || ['역량 레벨', '역할 범위', '필수 지식/기술', '폐기/자동화 이해', '효율 증대 업무', '결정적 무기'];
      const scores = analysis.itemScores || [];
      const itemBarsHtml = labels.map((label, i) => {
        const s = parseFloat(scores[i]) || 0;
        const bc = s >= 4.0 ? 'high' : s >= 3.0 ? 'mid' : 'low';
        return `<div class="score-row mb-8">
        <div class="score-label">${escHtml(label)}</div>
        <div class="score-bar-wrap"><div class="score-bar-fill ${bc}" style="width:${(s / 5) * 100}%"></div></div>
        <div class="score-num">${s.toFixed(1)}</div>
      </div>`;
      }).join('');

      let html = `
    <div class="card mb-16">
      <div class="flex items-center justify-between mb-16">
        <div class="section-title">종합 매칭 점수</div>
        <div class="flex gap-8 items-center">
          ${analysis.fromAI ? '<span class="badge badge-blue">🚨 AI 분석</span>' : '<span class="badge badge-gray">키워드 분석</span>'}
          <span style="font-size:24px;font-weight:700" class="text-${barClass === 'high' ? 'green' : barClass === 'mid' ? 'orange' : 'red'}">${analysis.overall.toFixed(1)}<span class="text-gray" style="font-size:16px">/5</span></span>
        </div>
      </div>
      <div class="score-bar-wrap mb-20"><div class="score-bar-fill ${barClass}" style="width:${(scNum / 5) * 100}%"></div></div>
      <div class="grid-2 mb-20">
        <div style="background:#fafafa;padding:12px;border-radius:6px">
          <div class="font-bold mb-8">긍정 피드백</div>
          ${(analysis.feedbackPos || []).map(p => `<div class="text-sm mb-4" style="line-height:1.4">${escHtml(p)}</div>`).join('') || '<div class="text-gray text-sm">해당 없음</div>'}
        </div>
        <div style="background:#fff5f5;padding:12px;border-radius:6px">
          <div class="font-bold mb-8" style="color:#c33">보완 필요</div>
          ${(analysis.feedbackNeg || []).map(p => `<div class="text-sm mb-4" style="line-height:1.4">${escHtml(p)}</div>`).join('') || '<div class="text-gray text-sm">해당 없음</div>'}
        </div>
      </div>
      <hr class="divider">
      <div class="grid-2 mt-16">
        <div>
          <div class="font-bold mb-8" style="font-size:13px">✅ 강점 키워드</div>
          <div>${strengthChipsHtml}</div>
        </div>
        <div>
          <div class="font-bold mb-8" style="font-size:13px;color:#cc3333">⚠️ 보완 키워드</div>
          <div>${gapChipsHtml}</div>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="section-title mb-16">항목별 매칭 점수</div>
      ${itemBarsHtml}
    </div>
  `;

      document.getElementById('mr-body').innerHTML = html;
    }

    // AI 결과 → 공통 analysis 구조로 변환
    function convertAiResult(ai) {
      const sc = ai.scores || {};
      const itemScores = [sc.f1, sc.f2, sc.f3, sc.f4, sc.f5, sc.f6].map(v => parseFloat(v) || 3.0);
      return {
        overall: parseFloat(ai.overall) || 3.0,
        itemScores,
        fieldLabels: ['역량 레벨', '역할 범위', '필수 지식/기술', '폐기/자동화 이해', '효율 증대 업무', '결정적 무기'],
        feedbackPos: Array.isArray(ai.feedback_positive) ? ai.feedback_positive : [],
        feedbackNeg: Array.isArray(ai.feedback_negative) ? ai.feedback_negative : [],
        strengthChips: Array.isArray(ai.strengths) ? ai.strengths : [],
        missingChips: Array.isArray(ai.gaps) ? ai.gaps : [],
        expYears: null,
        fromAI: true,
      };
    }

    function fallbackAnalysis(m) {
      const s = parseFloat(m.score) || 3.0;
      const analysis = {
        overall: s,
        itemScores: [s, s, s, s, s, s],
        fieldLabels: ['역량 레벨', '역할 범위', '필수 지식/기술', '폐기/자동화 이해', '효율 증대 업무', '결정적 무기'],
        feedbackPos: [], feedbackNeg: [], strengthChips: [], missingChips: [], expYears: null,
      };
      const sheet = sheetsData.find(s => s.name === m.position);
      if (!sheet) analysis.feedbackNeg.push('⚠️ 연결된 설계시트가 없습니다. 설계시트를 먼저 생성하세요.');
      if (!m.extractedText || m.extractedText.length < 20)
        analysis.feedbackNeg.push('⚠️ 분석 가능한 텍스트가 없습니다. 텍스트 붙여넣기로 이력서를 입력하거나 DOCX 파일을 업로드하세요.');
      return analysis;
    }

    // ══════════════════════════════════════════════════
    //  면접 질문 리포트 — 동적 생성
    // ══════════════════════════════════════════════════

    async function openReportDetail() {
      if (currentMatchIdx < 0) { showToast('먼저 매칭 분석을 실행하세요.', 'error'); return; }
      const m = matchingData[currentMatchIdx];
      const sheet = sheetsData.find(s => s.name === m.position);

      document.getElementById('rd-title').textContent = `면접 질문 리포트 — ${m.applicant}`;
      document.getElementById('rd-subtitle').textContent = `${m.position} · 종합 매칭: ${parseFloat(m.score).toFixed(1)}/5 · 분석일: ${m.date}`;
      document.getElementById('rd-body').innerHTML = '';
      nav('report-detail');

      // 이미 AI로 생성된 리포트 캐시가 있으면 바로 렌더
      if (m.reportData && m.reportData.interview_questions) {
        renderReportBody(m, m.reportData.interview_questions, sheet);
        return;
      }

      // AI로 질문 생성
      if (aiAvailable && sheet && m.extractedText?.length > 20) {
        document.getElementById('rd-generating').style.display = '';
        try {
          // analyzeWithAI가 이미 실행됐으면 결과 재사용, 아니면 재호출
          let aiResult = m.reportData;
          if (!aiResult) {
            document.getElementById('rd-gen-label').textContent = 'Claude AI가 면접 질문을 생성 중...';
            document.getElementById('rd-gen-sub').textContent = '설계시트와 이력서를 분석하고 있습니다.';
            aiResult = await analyzeWithAI(m.extractedText, sheet);
            m.reportData = aiResult;
            // 분석 결과도 업데이트
            if (!m.analysis) {
              m.analysis = convertAiResult(aiResult);
              m.score = String(m.analysis.overall);
              renderMatching();
            }
          }
          document.getElementById('rd-generating').style.display = 'none';
          renderReportBody(m, aiResult.interview_questions, sheet);
          renderReports();
          addAuditLog('우성 관리자', '면접 리포트 생성 (AI)', `${m.applicant} (${m.position})`);
          return;
        } catch (e) {
          document.getElementById('rd-generating').style.display = 'none';
          showToast('AI 질문 생성 실패 — 분석 기반 질문을 생성합니다.', 'error');
        }
      }

      // AI 없음 → 분석 결과 기반 템플릿 생성
      const analysis = m.analysis || (sheet && m.extractedText?.length > 20 ? analyzeResumeAgainstSheet(m.extractedText, sheet) : null);
      const questions = generateQuestionsFromAnalysis(analysis, sheet, m);
      m.reportData = { interview_questions: questions };
      saveData();
      renderReportBody(m, questions, sheet);
      renderReports();
      addAuditLog('우성 관리자', '면접 리포트 생성 (키워드)', `${m.applicant} (${m.position})`);
    }

    // 분석 결과 기반 질문 생성 (AI 없을 때)
    function generateQuestionsFromAnalysis(analysis, sheet, m) {
      const role_based = [];
      const career_issues = [];
      if (!analysis || !sheet) {
        role_based.push({ category: '기본 역량', intent: 'verify', question: '지원하신 포지션에 가장 자신 있는 역량을 구체적인 경험을 들어 설명해 주세요.' });
        role_based.push({ category: '직무 이해', intent: 'verify', question: '해당 포지션에서 가장 중요하게 생각하는 역할은 무엇인가요?' });
        return { role_based, career_issues };
      }

      const labels = analysis.fieldLabels;
      const scores = analysis.itemScores;
      const fields = [sheet.f1, sheet.f2, sheet.f3, sheet.f4, sheet.f5, sheet.f6];

      // 점수 낮은 항목 우선 질문
      scores.forEach((sc, i) => {
        const intent = sc < 3.0 ? 'gap' : sc >= 4.0 ? 'strength' : 'verify';
        const fieldKw = extractKeywords(fields[i]).slice(0, 3).join(', ');
        let q = '';
        if (intent === 'gap') {
          q = `${labels[i]} 관련하여 "${fieldKw}" 등의 경험이 이력서에서 확인되지 않았습니다. 해당 역량에 대해 설명해 주시겠어요?`;
        } else if (intent === 'strength') {
          q = `이력서에서 ${labels[i]}가 우수하게 확인되었습니다. "${fieldKw}" 관련 구체적인 성과를 말씀해 주세요.`;
        } else {
          q = `${labels[i]}에서 "${fieldKw}"를 다룬 경험 중 가장 도전적이었던 사례를 말씀해 주세요.`;
        }
        role_based.push({ category: labels[i], intent, question: q });
      });

      // 경력 이슈 감지
      if (m.extractedText) {
        const txt = m.extractedText.toLowerCase();
        const yrs = extractYearsExp(m.extractedText);
        if (yrs !== null && yrs < 3)
          career_issues.push({ issue: `경력 ${yrs}년 — 요구 수준 검토 필요`, question: `현재 경력 ${yrs}년이신데, 짧은 기간 동안 어떤 방식으로 빠르게 성장해 오셨나요?` });
        if (/공백|휴직|휴식/.test(txt))
          career_issues.push({ issue: '경력 공백 감지', question: '이력서에 경력 공백 기간이 있는 것 같습니다. 해당 기간 동안 어떤 활동을 하셨나요?' });
        if (/프리랜서|freelance|계약직/.test(txt))
          career_issues.push({ issue: '프리랜서/계약직 경력', question: '프리랜서/계약직으로 일하신 경험이 있는데, 정규직 포지션을 선택하신 이유가 무엇인가요?' });
      }

      return { role_based, career_issues };
    }

    function renderReportBody(m, questions, sheet) {
      const roleQs = questions?.role_based || [];
      const careerQs = questions?.career_issues || [];
      const aiLabel = m.reportData?.fromAI !== false && aiAvailable
        ? '<span class="badge badge-blue">🤖 AI 생성</span>'
        : '<span class="badge badge-gray">키워드 기반 생성</span>';

      // ── 탭 1: 코어 면접 구조화 질문 ──
      const coreHtml = buildCoreQHtml(m, sheet);

      // ── 탭 2: 역할 기반 질문 ──
      const grouped = {};
      roleQs.forEach(q => { if (!grouped[q.category]) grouped[q.category] = []; grouped[q.category].push(q); });
      const roleHtml = Object.entries(grouped).map(([cat, qs]) => `
    <div class="card mb-12">
      <div class="section-title mb-10">${escHtml(cat)}</div>
      ${qs.map(q => {
        const bc = q.intent === 'gap' ? '#e07000' : q.intent === 'strength' ? '#2a9a50' : '#333';
        return `<div class="interview-q" style="border-left-color:${bc}">${escHtml(q.question)}</div>`;
      }).join('')}
    </div>`).join('') || '<div class="card"><p class="text-gray text-sm">생성된 역할 기반 질문이 없습니다.</p></div>';

      // ── 탭 3: 경력 이슈 ──
      const careerHtml = careerQs.length
        ? careerQs.map(q => `
      <div class="card mb-12">
        <div class="section-title mb-10" style="color:#e07000">⚠️ ${escHtml(q.issue)}</div>
        <div class="interview-q issue">${escHtml(q.question)}</div>
      </div>`).join('')
        : '<div class="card"><p class="text-gray text-sm">감지된 경력 이슈가 없습니다.</p></div>';

      // ── 탭 4: 이력서 기반 AI 추가 질문 ──
      const resumeQs = m.reportData?.resumeQuestions || [];
      const resumeHtml = buildResumeQHtml(m, resumeQs);

      const totalCore = CORE_QB.filter(q => !q.leaderOnly).reduce((s, q) => s + 1 + q.subs.length, 0);

      document.getElementById('rd-body').innerHTML = `
    <div class="flex items-center gap-8 mb-16" style="flex-wrap:wrap">
      ${sheet ? `<span class="badge badge-green">설계시트 연결 · ${escHtml(sheet.name)}</span>` : '<span class="badge badge-orange">설계시트 미연결</span>'}
      ${aiLabel}
      <span class="text-sm text-gray" style="margin-left:auto">코어 ${totalCore}문항 · 역할기반 ${roleQs.length} · 경력이슈 ${careerQs.length} · 이력서심화 ${resumeQs.length}</span>
    </div>
    <div class="tabs" id="rd-tabs-wrap">
      <div class="tab active" id="rdtab-core"   onclick="switchRdTab('core')">📋 코어 면접 질문</div>
      <div class="tab"        id="rdtab-role"   onclick="switchRdTab('role')">역할 기반 (${roleQs.length})</div>
      <div class="tab"        id="rdtab-career" onclick="switchRdTab('career')">경력 이슈 (${careerQs.length})</div>
      <div class="tab"        id="rdtab-resume" onclick="switchRdTab('resume')">🤖 이력서 심화 (${resumeQs.length})</div>
    </div>
    <div id="rd-tab-core">${coreHtml}</div>
    <div id="rd-tab-role"   style="display:none">${roleHtml}</div>
    <div id="rd-tab-career" style="display:none">${careerHtml}</div>
    <div id="rd-tab-resume" style="display:none">${resumeHtml}</div>`;
    }

    // ── 코어 면접 구조화 질문 HTML 빌드 ──
    function buildCoreQHtml(m, sheet) {
      return CORE_QB.map(q => {
        if (q.leaderOnly) return ''; // 팀원급 리포트에서는 리더 전용 숨김 (나중에 track 연동 가능)
        const subRows = q.subs.map((s, i) => `
      <div style="padding:10px 14px;border-top:1px solid #f0f0f0">
        <div style="display:flex;align-items:flex-start;gap:10px">
          <span style="flex-shrink:0;background:#f0f0f0;color:#555;font-size:11px;font-weight:700;padding:2px 7px;border-radius:4px;margin-top:2px">${escHtml(s.id)}</span>
          <div style="flex:1">
            <div style="font-size:13px;line-height:1.7;color:#333;margin-bottom:6px">${escHtml(s.q.replace(/\n/g, ' / '))}</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <span style="font-size:11px;background:#e8f8ee;color:#1e7a3c;padding:2px 8px;border-radius:4px">✅ ${escHtml(s.green)}</span>
              <span style="font-size:11px;background:#fff0f0;color:#bb2222;padding:2px 8px;border-radius:4px">🚨 ${escHtml(s.red)}</span>
              ${s.branch ? s.branch.map(b => `<span style="font-size:11px;background:#f0f0f0;color:#555;padding:2px 8px;border-radius:4px">분기: ${escHtml(b)}</span>`).join('') : ''}
            </div>
          </div>
        </div>
      </div>`).join('');

        return `
    <div class="card mb-12" style="padding:0;overflow:hidden">
      <div style="background:#1a1a1a;color:#fff;padding:12px 18px;display:flex;align-items:center;gap:10px">
        <span style="background:#555;color:#fff;font-size:11px;font-weight:700;padding:3px 9px;border-radius:4px">${q.id}</span>
        <span style="font-weight:600;font-size:14px">${q.cat}</span>
        ${q.instantFail ? '<span style="font-size:11px;background:#cc3333;color:#fff;padding:2px 8px;border-radius:4px;margin-left:auto">즉시 불합격 판별</span>' : ''}
      </div>
      <div style="padding:14px 18px;background:#fafafa;border-bottom:1px solid #eee">
        <div style="font-size:13px;font-weight:600;color:#555;margin-bottom:6px">메인 질문</div>
        <div style="font-size:14px;line-height:1.75;color:#222">${escHtml(q.main)}</div>
        ${q.failNote ? `<div style="font-size:12px;color:#cc3333;margin-top:8px">${escHtml(q.failNote)}</div>` : ''}
      </div>
      ${subRows}
    </div>`;
      }).join('');
    }

    // ── 이력서 기반 AI 추가 질문 HTML 빌드 ──
    function buildResumeQHtml(m, resumeQs) {
      const hasResume = m.extractedText && m.extractedText.length > 50;
      const genBtn = `
    <div class="flex items-center gap-12 mb-16">
      ${aiAvailable && hasResume
          ? `<button class="btn btn-primary" onclick="generateResumeQuestions()">🚨 이력서 기반 AI 질문 생성</button>`
          : `<button class="btn btn-secondary" disabled title="${!aiAvailable ? '서버 API 키 미설정' : !hasResume ? '이력서 텍스트 없음' : ''}">🚨 AI 질문 생성 (${!aiAvailable ? 'API 키 필요' : '이력서 없음'})</button>`}
      ${resumeQs.length ? '<span class="text-gray text-sm">재생성하면 기존 질문이 교체됩니다.</span>' : ''}
    </div>`;

      if (!resumeQs.length) {
        return genBtn + '<div class="card"><div class="empty-state"><div class="empty-icon">🤖</div><div class="empty-text">AI 질문 생성 버튼을 클릭하면 이력서를 분석하여 지원자 맞춤 심화 질문을 생성합니다.</div></div></div>';
      }

      const grouped = {};
      resumeQs.forEach(q => {
        const cat = q.category || '기타';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(q);
      });

      const qHtml = Object.entries(grouped).map(([cat, qs]) => `
    <div class="card mb-12">
      <div class="section-title mb-10" style="color:#3366dd">🚨 ${escHtml(cat)}</div>
      ${qs.map((q, i) => `
        <div class="interview-q" style="border-left-color:#3366dd;margin-bottom:${i < qs.length - 1 ? '10px' : '0'}">
          ${escHtml(q.question)}
          ${q.intent ? `<div style="font-size:11px;color:#888;margin-top:4px">검증 포인트: ${escHtml(q.intent)}</div>` : ''}
        </div>`).join('')}
    </div>`).join('');

      return genBtn + qHtml;
    }

    async function generateResumeQuestions() {
      if (currentMatchIdx < 0) return;
      const m = matchingData[currentMatchIdx];
      const sheet = sheetsData.find(s => s.name === m.position);
      if (!m.extractedText || m.extractedText.length < 50) { showToast('이력서 텍스트가 없습니다.', 'error'); return; }

      showToast('🚨 이력서 분석 중 — AI 심화 질문 생성 중...', 'info');
      document.getElementById('rd-generating').style.display = '';
      document.getElementById('rd-gen-label').textContent = '이력서 기반 심화 질문 생성 중...';
      document.getElementById('rd-gen-sub').textContent = '지원자의 이력서를 분석하여 맞춤 질문을 작성하고 있습니다.';

      const prompt = `당신은 시니어 채용 면접관입니다. 아래 지원자의 이력서와 채용 포지션 정보를 바탕으로, 코어 면접에서 활용할 심화 질문을 생성하세요.

## 포지션: ${sheet?.name || m.position}
${sheet ? `설계시트 요약:
- 역량 레벨: ${sheet.f1}
- 필수 기술: ${sheet.f3}
- 결정적 무기: ${sheet.f6}` : ''}

## 지원자 이력서
${m.extractedText.substring(0, 3000)}

## 출력 규칙
이력서에서 발견한 구체적 경험·기술·이력을 근거로 6~10개의 심화 질문을 생성하세요.
각 질문은 지원자의 실제 이력을 언급하며 진위와 깊이를 검증해야 합니다.
반드시 아래 JSON만 출력하세요.

{"questions":[{"category":"카테고리명","question":"질문 내용","intent":"검증하려는 포인트"}]}`;

      try {
        const raw = await callClaudeAPI(prompt, 3000);
        const data = parseAIJson(raw);
        const qs = Array.isArray(data.questions) ? data.questions : [];
        if (!qs.length) throw new Error('질문을 생성하지 못했습니다.');

        if (!m.reportData) m.reportData = { interview_questions: generateQuestionsFromAnalysis(null, sheet, m) };
        m.reportData.resumeQuestions = qs;
        saveData();
        showToast(`✅ 이력서 기반 질문 ${qs.length}개 생성 완료`, 'success');
        renderReportBody(m, m.reportData.interview_questions, sheet);
        switchRdTab('resume');
      } catch (e) {
        showToast('AI 질문 생성 실패: ' + e.message.substring(0, 80), 'error');
      } finally {
        document.getElementById('rd-generating').style.display = 'none';
      }
    }

    function switchRdTab(t) {
      ['core', 'role', 'career', 'resume'].forEach(id => {
        const tab = document.getElementById('rdtab-' + id);
        const pane = document.getElementById('rd-tab-' + id);
        if (tab) tab.classList.toggle('active', id === t);
        if (pane) pane.style.display = id === t ? '' : 'none';
      });
    }

    function daysBetween(startStr, endStr) {
      const start = new Date((startStr || '').replace(/\./g, '-'));
      const end = new Date((endStr || '').replace(/\./g, '-'));
      if (isNaN(start) || isNaN(end)) return null;
      return Math.max(0, Math.round((end - start) / 86400000));
    }

    function renderDashboard() {
      const posCount = sheetsData.length;
      const resCount = matchingData.length;
      const scored = matchingData.filter(m => parseFloat(m.score) > 0);
      const avgScore = scored.length ? scored.reduce((s, m) => s + parseFloat(m.score), 0) / scored.length : null;
      const reportCount = matchingData.filter(m => m.reportData?.interview_questions).length;
      const el = id => document.getElementById(id);

      // stat 수치
      if (el('stat-positions')) el('stat-positions').textContent = posCount;
      if (el('stat-resumes')) el('stat-resumes').textContent = resCount;
      if (el('stat-reports')) el('stat-reports').textContent = reportCount;
      if (el('stat-score')) el('stat-score').innerHTML = avgScore != null
        ? `${avgScore.toFixed(1)}<span style="font-size:16px;color:#888">/5</span>`
        : `—<span style="font-size:16px;color:#888">/5</span>`;

      // stat 부제
      if (el('stat-change-positions')) el('stat-change-positions').textContent =
        posCount ? `${posCount}개 포지션 운영 중` : '등록된 포지션 없음';
      if (el('stat-change-resumes')) el('stat-change-resumes').textContent =
        resCount ? `총 ${resCount}명 검토 중` : '업로드된 이력서 없음';
      if (el('stat-change-score')) el('stat-change-score').textContent =
        avgScore != null ? `${scored.length}명 분석 기준` : '분석 데이터 없음';
      if (el('stat-change-reports')) el('stat-change-reports').textContent =
        reportCount ? `${reportCount}개 리포트 완료` : '생성된 리포트 없음';

      // 최근 이력서 분석 (최신 5건)
      const recentEl = el('dash-recent');
      if (recentEl) {
        if (matchingData.length === 0) {
          recentEl.innerHTML = '<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-text">분석된 이력서가 없습니다</div></div>';
        } else {
          const recent = matchingData.slice().reverse().slice(0, 5);
          recentEl.innerHTML = recent.map((m, i) => {
            const idx = matchingData.indexOf(m);
            const scoreNum = parseFloat(m.score);
            const cls = scoreNum >= 4 ? 'text-green' : scoreNum >= 3 ? '' : isNaN(scoreNum) ? 'text-gray' : 'text-red';
            const barClass = scoreNum >= 4 ? 'high' : scoreNum >= 3 ? 'mid' : 'low';
            const barW = isNaN(scoreNum) ? 0 : (scoreNum / 5) * 100;
            return `<div style="padding:10px 0;${i < recent.length - 1 ? 'border-bottom:1px solid #f0f0f0' : ''}">
          <div class="flex items-center justify-between mb-4">
            <div>
              <strong style="font-size:13px">${escHtml(m.applicant)}</strong>
              <span class="text-gray text-sm" style="margin-left:6px">${escHtml(m.position)}</span>
            </div>
            <div class="flex items-center gap-8">
              <span class="font-bold text-sm ${cls}">${isNaN(scoreNum) ? '—' : scoreNum.toFixed(1)}/5</span>
              <button class="btn btn-secondary btn-sm" style="padding:3px 8px;font-size:11px" onclick="openMatchResult(${idx})">보기</button>
            </div>
          </div>
          <div class="score-bar-wrap" style="height:4px"><div class="score-bar-fill ${barClass}" style="width:${barW}%;height:4px"></div></div>
          <div class="text-gray text-sm" style="margin-top:4px">${m.date} · ${m.source || '파일'}</div>
        </div>`;
          }).join('');
        }
      }

      // 포지션별 진행 현황
      const posEl = el('dash-positions');
      if (posEl) {
        const dashPosFilter = el('dash-pos-filter')?.value || '';
        let posRows = sheetsData;
        if (dashPosFilter) posRows = posRows.filter(s => getPosStatus(s) === dashPosFilter);

        if (sheetsData.length === 0) {
          posEl.innerHTML = '<div class="empty-state"><div class="empty-icon">💼</div><div class="empty-text">등록된 포지션이 없습니다</div></div>';
        } else if (posRows.length === 0) {
          posEl.innerHTML = '<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-text">해당 상태의 포지션이 없습니다</div></div>';
        } else {
          posEl.innerHTML = posRows.map((s, i) => {
            const applicants = matchingData.filter(m => m.position === s.name);
            const withScore = applicants.filter(m => parseFloat(m.score) > 0);
            const avg = withScore.length ? withScore.reduce((sum, m) => sum + parseFloat(m.score), 0) / withScore.length : null;
            const hasReport = applicants.filter(m => m.reportData?.interview_questions).length;
            const status = getPosStatus(s);
            const badgeCls = status === '채용중' ? 'badge-blue' : status === '채용완료' ? 'badge-purple' : 'badge-gray';
            const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '-').replace('.', '');
            const elapsed = daysBetween(s.created, s.completedDate || today);
            return `<div style="padding:10px 0;${i < posRows.length - 1 ? 'border-bottom:1px solid #f0f0f0' : ''}">
          <div class="flex items-center justify-between mb-6">
            <div class="flex items-center gap-8">
              <strong style="font-size:13px">${escHtml(s.name)}</strong>
              <span class="badge ${badgeCls}" style="font-size:11px">${status}</span>
            </div>
            <button class="btn btn-secondary btn-sm" style="padding:3px 8px;font-size:11px" onclick="nav('positions')">상세</button>
          </div>
          <div class="flex gap-16 text-sm text-gray">
            <span>지원자 ${applicants.length}명</span>
            <span>평균 ${avg != null ? avg.toFixed(1) + '/5' : '—'}</span>
            <span>리포트 ${hasReport}건</span>
            <span>경과 ${elapsed != null ? elapsed + '일' : '—'}</span>
            <span>${escHtml(s.team)}</span>
          </div>
        </div>`;
          }).join('');
        }
      }

      renderDashStageSummary();
      renderDashMonthlyHires();
      renderDashFunnel();
      renderDashChannelHires();
    }

    // ── 진행 단계별 현황 ──
    function renderDashStageSummary() {
      const wrap = document.getElementById('dash-stage-summary');
      if (!wrap) return;
      const active = matchingData.filter(m => !m.rejected);
      const reviewing = active.filter(m => !m.procStatus).length;
      const assignment = active.filter(m => m.procStatus === '과제/공통면접').length;
      const finalInterview = active.filter(m => m.procStatus === '최종면접').length;
      wrap.innerHTML = `
    <div class="grid-3 gap-16">
      <div class="stat-card">
        <div class="stat-label">검토중</div>
        <div class="stat-value">${reviewing}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">과제/공통면접</div>
        <div class="stat-value">${assignment}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">최종면접</div>
        <div class="stat-value">${finalInterview}</div>
      </div>
    </div>`;
    }

    // ── 월별 최종합격 현황 ──
    function renderDashMonthlyHires() {
      const wrap = document.getElementById('dash-monthly-hires');
      if (!wrap) return;
      const hires = matchingData.filter(m => m.procStatus === '최종합격');
      if (!hires.length) {
        wrap.innerHTML = '<div class="empty-state"><div class="empty-icon">🎉</div><div class="empty-text">최종합격자가 없습니다</div></div>';
        return;
      }
      const byMonth = {};
      hires.forEach(m => {
        const ref = m.finalPassDate || m.date || '';
        const ym = ref.slice(0, 7);
        if (!ym) return;
        if (!byMonth[ym]) byMonth[ym] = { count: 0, totalDays: 0, withDays: 0 };
        byMonth[ym].count++;
        const d = daysBetween(m.date, m.finalPassDate);
        if (d != null) { byMonth[ym].totalDays += d; byMonth[ym].withDays++; }
      });
      const months = Object.keys(byMonth).sort().reverse().slice(0, 6);
      wrap.innerHTML = months.map(ym => {
        const v = byMonth[ym];
        const avgDays = v.withDays ? Math.round(v.totalDays / v.withDays) : null;
        return `<div class="flex items-center justify-between" style="padding:8px 0;border-bottom:1px solid #f0f0f0">
      <span class="font-bold" style="font-size:13px">${ym}</span>
      <div class="flex gap-16 text-sm text-gray">
        <span>합격 ${v.count}명</span>
        <span>평균 소요 ${avgDays != null ? avgDays + '일' : '—'}</span>
      </div>
    </div>`;
      }).join('');
    }

    // ── Recruitment Funnel (역삼각형) ──
    function renderDashFunnel() {
      const wrap = document.getElementById('dash-funnel');
      if (!wrap) return;
      const stages = [
        { label: '검토', count: matchingData.length },
        { label: '과제/공통면접', count: matchingData.filter(m => ['과제/공통면접', '최종면접', '최종합격'].includes(m.procStatus)).length },
        { label: '최종면접', count: matchingData.filter(m => ['최종면접', '최종합격'].includes(m.procStatus)).length },
        { label: '최종합격', count: matchingData.filter(m => m.procStatus === '최종합격').length },
      ];
      const max = stages[0].count || 1;
      const colors = ['#333', '#555', '#777', '#2a9a50'];
      wrap.innerHTML = stages.map((s, i) => {
        const widthPct = Math.max(10, Math.round((s.count / max) * 100));
        const pct = max ? Math.round((s.count / max) * 100) : 0;
        return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
      <div style="flex:1;display:flex;justify-content:center">
        <div style="width:${widthPct}%;background:${colors[i]};color:#fff;border-radius:6px;padding:6px 10px;text-align:center;transition:width 0.2s">
          <div style="font-size:11px;opacity:0.85">${escHtml(s.label)}</div>
          <div style="font-size:14px;font-weight:700">${s.count}명</div>
        </div>
      </div>
      <div style="width:42px;flex-shrink:0;text-align:right;font-size:12px;color:#888">${pct}%</div>
    </div>`;
      }).join('');
    }

    // ── 소싱채널별 채용인원 ──
    function renderDashChannelHires() {
      const wrap = document.getElementById('dash-channel-hires');
      if (!wrap) return;
      const hires = matchingData.filter(m => m.procStatus === '최종합격');
      const channels = ['온라인', '헤드헌터', '추천채용'];
      const counts = channels.map(c => hires.filter(m => m.channel === c).length);
      const unassigned = hires.filter(m => !channels.includes(m.channel)).length;
      const rows = channels.map((c, i) => ({ label: c, count: counts[i] }));
      if (unassigned) rows.push({ label: '미지정', count: unassigned });
      if (!hires.length) {
        wrap.innerHTML = '<div class="empty-state"><div class="empty-icon">📊</div><div class="empty-text">최종합격자가 없습니다</div></div>';
        return;
      }
      wrap.innerHTML = rows.map(r => `
    <div class="flex items-center justify-between" style="padding:8px 0;border-bottom:1px solid #f0f0f0">
      <span class="font-bold" style="font-size:13px">${escHtml(r.label)}</span>
      <span class="text-sm text-gray">${r.count}명</span>
    </div>`).join('');
    }

    let rptViewMode = 'list';
    let rptExcludeDone = false;

    function toggleRptExclude() {
      rptExcludeDone = !rptExcludeDone;
      const btn = document.getElementById('rpt-exclude-btn');
      if (btn) btn.classList.toggle('btn-primary', rptExcludeDone);
      renderReports();
    }

    function setRptView(mode) {
      rptViewMode = mode;
      ['list', 'pos', 'period'].forEach(m => {
        document.getElementById(`rpt-tab-${m}`)?.classList.toggle('active', m === mode);
      });
      renderReports();
    }

    function resetRptFilters() {
      const p = document.getElementById('rpt-filter-pos');
      const y = document.getElementById('rpt-filter-year');
      const mo = document.getElementById('rpt-filter-month');
      if (p) p.value = '';
      if (y) y.value = '';
      if (mo) { mo.value = ''; mo.disabled = true; }
      renderReports();
    }

    function renderReports() {
      const allRows = matchingData.filter(m => m.reportData?.interview_questions);

      // 포지션 필터 옵션 동기화
      const posSel = document.getElementById('rpt-filter-pos');
      if (posSel) {
        const cur = posSel.value;
        const positions = [...new Set(allRows.map(m => m.position))].sort();
        posSel.innerHTML = '<option value="">전체 포지션</option>' +
          positions.map(p => `<option value="${escHtml(p)}" ${p === cur ? 'selected' : ''}>${escHtml(p)}</option>`).join('');
      }

      // 연도 필터 옵션 동기화
      const yearSel = document.getElementById('rpt-filter-year');
      if (yearSel) {
        const cur = yearSel.value;
        const years = [...new Set(allRows.map(m => (m.date || '').slice(0, 4)).filter(Boolean))].sort().reverse();
        yearSel.innerHTML = '<option value="">전체 연도</option>' +
          years.map(y => `<option value="${y}" ${y === cur ? 'selected' : ''}>${y}년</option>`).join('');
      }

      // 월 필터 옵션 (연도 선택 시만 활성)
      const curYear = yearSel?.value || '';
      const monthSel = document.getElementById('rpt-filter-month');
      if (monthSel) {
        const cur = monthSel.value;
        if (curYear) {
          const months = [...new Set(
            allRows.filter(m => (m.date || '').startsWith(curYear)).map(m => (m.date || '').slice(5, 7)).filter(Boolean)
          )].sort();
          monthSel.innerHTML = '<option value="">전체 월</option>' +
            months.map(mo => `<option value="${mo}" ${mo === cur ? 'selected' : ''}>${parseInt(mo)}월</option>`).join('');
          monthSel.disabled = false;
        } else {
          monthSel.innerHTML = '<option value="">전체 월</option>';
          monthSel.disabled = true;
        }
      }

      // 필터 적용
      const filterPos = posSel?.value || '';
      const filterYear = yearSel?.value || '';
      const filterMonth = monthSel?.value || '';
      let rows = allRows;
      if (filterPos) rows = rows.filter(m => m.position === filterPos);
      if (filterYear) rows = rows.filter(m => (m.date || '').startsWith(filterYear));
      if (filterMonth) rows = rows.filter(m => (m.date || '').slice(5, 7) === filterMonth);
      if (rptExcludeDone) {
        const completedPos = new Set(sheetsData.filter(s => s.status === '채용완료').map(s => s.name));
        rows = rows.filter(m => !m.rejected && !completedPos.has(m.position));
      }

      // 카운트 배지
      const badge = document.getElementById('rpt-count-badge');
      if (badge) badge.textContent = rows.length ? `총 ${rows.length}건` : '';

      // 뷰 전환
      const listView = document.getElementById('rpt-view-list');
      const groupedView = document.getElementById('rpt-view-grouped');
      if (rptViewMode === 'list') {
        if (listView) listView.style.display = '';
        if (groupedView) groupedView.style.display = 'none';
        renderRptTable(rows);
      } else {
        if (listView) listView.style.display = 'none';
        if (groupedView) groupedView.style.display = '';
        if (rptViewMode === 'pos') renderRptGroupedByPos(rows);
        else renderRptGroupedByPeriod(rows);
      }
    }

    // 공통 테이블 행 HTML
    function rptRowHtml(m) {
      const idx = matchingData.indexOf(m);
      const qs = m.reportData.interview_questions;
      const qCount = (qs.role_based?.length || 0) + (qs.career_issues?.length || 0);
      const scoreNum = parseFloat(m.score);
      const cls = scoreNum >= 4 ? 'text-green' : scoreNum >= 3 ? '' : 'text-red';
      return `<tr>
    <td><strong>${escHtml(m.applicant)}</strong></td>
    <td>${escHtml(m.position)}</td>
    <td><span class="font-bold ${cls}">${m.score}</span>/5</td>
    <td>${qCount}문항</td>
    <td class="text-gray text-sm">${m.date}</td>
    <td class="flex gap-8">
      <button class="btn btn-secondary btn-sm" onclick="viewReportDirect(${idx})">보기</button>
      <button class="btn btn-secondary btn-sm" onclick="regenReportFor(${idx})">재생성</button>
    </td>
  </tr>`;
    }

    // 공통 미니 테이블 (그룹 내부)
    function rptMiniTable(rows) {
      if (!rows.length) return '<p class="text-gray text-sm">해당 항목이 없습니다.</p>';
      return `<div class="table-wrap" style="margin-bottom:0">
    <table>
      <thead><tr><th>지원자명</th><th>포지션</th><th>매칭점수</th><th>질문 수</th><th>생성일</th><th></th></tr></thead>
      <tbody>${rows.map(rptRowHtml).join('')}</tbody>
    </table>
  </div>`;
    }

    const RPT_EMPTY = `<div class="empty-state"><div class="empty-icon">📝</div><div class="empty-text">조건에 맞는 리포트가 없습니다.</div></div>`;

    // 전체 목록 테이블 렌더
    function renderRptTable(rows) {
      const tbody = document.getElementById('reports-tbody');
      if (!tbody) return;
      if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="6">${RPT_EMPTY}</td></tr>`;
        return;
      }
      tbody.innerHTML = rows.map(rptRowHtml).join('');
    }

    // 포지션별 그룹 렌더
    function renderRptGroupedByPos(rows) {
      const wrap = document.getElementById('rpt-view-grouped');
      if (!rows.length) { wrap.innerHTML = RPT_EMPTY; return; }
      const groups = {};
      rows.forEach(m => { if (!groups[m.position]) groups[m.position] = []; groups[m.position].push(m); });
      wrap.innerHTML = Object.entries(groups)
        .sort(([a], [b]) => a.localeCompare(b, 'ko'))
        .map(([pos, items]) => `
      <div class="card mb-12">
        <div class="rpt-group-header">
          <div class="section-title" style="margin-bottom:0">💼 ${escHtml(pos)}</div>
          <span class="badge badge-gray">${items.length}건</span>
        </div>
        ${rptMiniTable(items)}
      </div>`).join('');
    }

    // 연도/월별 그룹 렌더 (연/월 단위로 좌우 이동)
    let rptPeriodYear = null;
    let rptPeriodMonth = null;

    function renderRptGroupedByPeriod(rows) {
      const wrap = document.getElementById('rpt-view-grouped');
      if (!rows.length) { wrap.innerHTML = RPT_EMPTY; return; }
      const byYear = {};
      rows.forEach(m => {
        const y = (m.date || '').slice(0, 4) || '미상';
        const mo = (m.date || '').slice(5, 7) || '00';
        if (!byYear[y]) byYear[y] = {};
        if (!byYear[y][mo]) byYear[y][mo] = [];
        byYear[y][mo].push(m);
      });

      const years = Object.keys(byYear).sort();
      if (!rptPeriodYear || !byYear[rptPeriodYear]) rptPeriodYear = years[years.length - 1];
      const months = Object.keys(byYear[rptPeriodYear]).sort();
      if (!rptPeriodMonth || !byYear[rptPeriodYear][rptPeriodMonth]) rptPeriodMonth = months[months.length - 1];

      const yearIdx = years.indexOf(rptPeriodYear);
      const monthIdx = months.indexOf(rptPeriodMonth);
      const items = byYear[rptPeriodYear][rptPeriodMonth] || [];

      wrap.innerHTML = `
      <div class="card mb-12">
        <div class="rpt-group-header">
          <div class="section-title" style="margin-bottom:0">📆 ${rptPeriodYear}년 📅 ${parseInt(rptPeriodMonth)}월</div>
          <span class="badge badge-gray">${items.length}건</span>
        </div>
        ${rptMiniTable(items)}
        <div class="flex items-center justify-between mt-16" style="margin-top:16px">
          <div class="flex gap-8">
            <button class="btn btn-secondary btn-sm" ${yearIdx <= 0 ? 'disabled' : ''} onclick="rptNavPeriod('year',-1)">◀ 이전 연도</button>
            <button class="btn btn-secondary btn-sm" ${yearIdx >= years.length - 1 ? 'disabled' : ''} onclick="rptNavPeriod('year',1)">다음 연도 ▶</button>
          </div>
          <div class="flex gap-8">
            <button class="btn btn-secondary btn-sm" ${monthIdx <= 0 ? 'disabled' : ''} onclick="rptNavPeriod('month',-1)">◀ 이전 월</button>
            <button class="btn btn-secondary btn-sm" ${monthIdx >= months.length - 1 ? 'disabled' : ''} onclick="rptNavPeriod('month',1)">다음 월 ▶</button>
          </div>
        </div>
      </div>`;
    }

    function rptNavPeriod(unit, dir) {
      const allRows = matchingData.filter(m => m.reportData?.interview_questions);
      const byYear = {};
      allRows.forEach(m => {
        const y = (m.date || '').slice(0, 4) || '미상';
        const mo = (m.date || '').slice(5, 7) || '00';
        if (!byYear[y]) byYear[y] = {};
        if (!byYear[y][mo]) byYear[y][mo] = [];
        byYear[y][mo].push(m);
      });
      const years = Object.keys(byYear).sort();
      if (unit === 'year') {
        const idx = years.indexOf(rptPeriodYear) + dir;
        if (idx < 0 || idx >= years.length) return;
        rptPeriodYear = years[idx];
        const months = Object.keys(byYear[rptPeriodYear]).sort();
        rptPeriodMonth = months[months.length - 1];
      } else {
        const months = Object.keys(byYear[rptPeriodYear] || {}).sort();
        const idx = months.indexOf(rptPeriodMonth) + dir;
        if (idx < 0 || idx >= months.length) return;
        rptPeriodMonth = months[idx];
      }
      renderReports();
    }

    async function regenReport() {
      if (currentMatchIdx < 0) return;
      await regenReportFor(currentMatchIdx);
    }

    async function regenReportFor(idx) {
      const m = matchingData[idx];
      if (!m) return;
      m.reportData = null;
      currentMatchIdx = idx;
      showToast('리포트를 재생성합니다...', 'info');
      await openReportDetail();
      renderReports();
    }

    function downloadPDF() {
      if (currentMatchIdx < 0) { showToast('리포트를 먼저 생성하세요.', 'error'); return; }
      const m = matchingData[currentMatchIdx];
      const qs = m.reportData?.interview_questions;
      if (!qs) { showToast('리포트 데이터가 없습니다.', 'error'); return; }
      const sheet = sheetsData.find(s => s.name === m.position);
      const now = new Date().toLocaleString('ko-KR');
      const score = parseFloat(m.score).toFixed(1);
      const esc = s => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

      // ── 코어 면접 질문 ──
      const coreRows = CORE_QB.filter(q => !q.leaderOnly).map(q => {
        const subHtml = q.subs.map(s => `
      <tr>
        <td style="padding:6px 10px;border:1px solid #e8e8e8;font-size:11px;font-weight:700;color:#555;white-space:nowrap;vertical-align:top">${esc(s.id)}</td>
        <td style="padding:6px 10px;border:1px solid #e8e8e8;font-size:12px;color:#333;line-height:1.7">${esc(s.q.replace(/\n/g, ' / '))}</td>
        <td style="padding:6px 10px;border:1px solid #e8e8e8;font-size:11px;color:#1e7a3c">✅ ${esc(s.green)}</td>
        <td style="padding:6px 10px;border:1px solid #e8e8e8;font-size:11px;color:#bb2222">🚨 ${esc(s.red)}</td>
      </tr>`).join('');
        return `
      <div style="margin-bottom:20px;border:1px solid #ddd;border-radius:6px;overflow:hidden;page-break-inside:avoid">
        <div style="background:#1a1a1a;color:#fff;padding:10px 16px;display:flex;align-items:center;gap:10px">
          <span style="background:#555;color:#fff;font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px">${q.id}</span>
          <span style="font-weight:600;font-size:13px">${esc(q.cat)}</span>
          ${q.instantFail ? '<span style="font-size:11px;background:#cc3333;color:#fff;padding:2px 8px;border-radius:4px;margin-left:auto">즉시 불합격 판별</span>' : ''}
        </div>
        <div style="padding:12px 16px;background:#fafafa;border-bottom:1px solid #eee">
          <div style="font-size:11px;font-weight:700;color:#888;margin-bottom:4px">메인 질문</div>
          <div style="font-size:13px;line-height:1.75;color:#222">${esc(q.main)}</div>
          ${q.failNote ? `<div style="font-size:11px;color:#cc3333;margin-top:6px">${esc(q.failNote)}</div>` : ''}
        </div>
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="background:#f5f5f5">
            <th style="padding:6px 10px;border:1px solid #e0e0e0;font-size:11px;color:#666;width:60px">ID</th>
            <th style="padding:6px 10px;border:1px solid #e0e0e0;font-size:11px;color:#666">서브 질문</th>
            <th style="padding:6px 10px;border:1px solid #e0e0e0;font-size:11px;color:#1e7a3c;width:150px">Green 기준</th>
            <th style="padding:6px 10px;border:1px solid #e0e0e0;font-size:11px;color:#bb2222;width:150px">Red 기준</th>
          </tr></thead>
          <tbody>${subHtml}</tbody>
        </table>
      </div>`;
      }).join('');

      // ── 역할 기반 질문 ──
      const roleQs = qs.role_based || [];
      const roleGrouped = {};
      roleQs.forEach(q => { if (!roleGrouped[q.category]) roleGrouped[q.category] = []; roleGrouped[q.category].push(q); });
      const roleHtml = Object.entries(roleGrouped).map(([cat, qs2]) => `
    <div style="margin-bottom:16px;page-break-inside:avoid">
      <div style="font-size:12px;font-weight:700;color:#333;background:#f0f0f0;padding:8px 12px;border-left:3px solid #333;margin-bottom:8px">${esc(cat)}</div>
      ${qs2.map((q, i) => `
        <div style="padding:10px 14px;border-left:3px solid ${q.intent === 'gap' ? '#e07000' : q.intent === 'strength' ? '#2a9a50' : '#333'};background:#fafafa;margin-bottom:6px;font-size:13px;line-height:1.7;border-radius:0 4px 4px 0">
          ${i + 1}. ${esc(q.question)}
        </div>`).join('')}
    </div>`).join('') || '<p style="color:#aaa;font-size:13px">생성된 역할 기반 질문이 없습니다.</p>';

      // ── 경력 이슈 질문 ──
      const careerQs = qs.career_issues || [];
      const careerHtml = careerQs.map((q, i) => `
    <div style="margin-bottom:12px;border:1px solid #ffe0b0;border-radius:6px;overflow:hidden;page-break-inside:avoid">
      <div style="background:#fff8ee;padding:8px 14px;font-size:12px;font-weight:700;color:#c06000">⚠️ ${esc(q.issue)}</div>
      <div style="padding:10px 14px;font-size:13px;line-height:1.7;color:#333">${i + 1}. ${esc(q.question)}</div>
    </div>`).join('') || '<p style="color:#aaa;font-size:13px">감지된 경력 이슈가 없습니다.</p>';

      // ── 이력서 심화 질문 (있을 때만 섹션 포함) ──
      const resumeQs = m.reportData?.resumeQuestions || [];
      const resumeSection = resumeQs.length ? (() => {
        const rGrouped = {};
        resumeQs.forEach(q => { const cat = q.category || '기타'; if (!rGrouped[cat]) rGrouped[cat] = []; rGrouped[cat].push(q); });
        const rHtml = Object.entries(rGrouped).map(([cat, qs2]) => `
      <div style="margin-bottom:16px;page-break-inside:avoid">
        <div style="font-size:12px;font-weight:700;color:#3366dd;background:#f0f4ff;padding:8px 12px;border-left:3px solid #3366dd;margin-bottom:8px">🤖 ${esc(cat)}</div>
        ${qs2.map((q, i) => `
          <div style="padding:10px 14px;border-left:3px solid #3366dd;background:#fafcff;margin-bottom:6px;border-radius:0 4px 4px 0">
            <div style="font-size:13px;line-height:1.7;color:#333">${i + 1}. ${esc(q.question)}</div>
            ${q.intent ? `<div style="font-size:11px;color:#888;margin-top:4px">검증 포인트: ${esc(q.intent)}</div>` : ''}
          </div>`).join('')}
      </div>`).join('');
        return `
      <div style="margin-top:32px">
        <h2 style="font-size:15px;font-weight:700;margin:0 0 8px;padding-bottom:6px;border-bottom:2px solid #3366dd;color:#3366dd">
          🤖 이력서 기반 심화 질문 (${resumeQs.length}개)
        </h2>
        <p style="font-size:12px;color:#888;margin:0 0 16px">AI가 지원자의 이력서를 분석하여 생성한 맞춤 심화 질문입니다.</p>
        ${rHtml}
      </div>`;
      })() : '';

      const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
  <title>면접질문리포트 — ${m.applicant}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,'Malgun Gothic','Apple SD Gothic Neo',sans-serif;font-size:13px;color:#333;padding:32px;max-width:960px;margin:0 auto;line-height:1.6}
    h1{font-size:22px;font-weight:700;margin-bottom:6px}
    h2{font-size:15px;font-weight:700;margin:32px 0 10px;padding-bottom:6px;border-bottom:2px solid #333}
    .meta{background:#f8f8f8;border:1px solid #e0e0e0;border-radius:6px;padding:14px 18px;margin-bottom:28px;display:flex;flex-wrap:wrap;gap:16px}
    .meta-item{display:flex;flex-direction:column;gap:2px}
    .meta-label{font-size:11px;color:#888;font-weight:600}
    .meta-value{font-size:13px;font-weight:700;color:#222}
    .score-badge{display:inline-block;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:700}
    .footer{text-align:center;color:#aaa;font-size:11px;margin-top:40px;padding-top:14px;border-top:1px solid #eee}
    @media print{
      body{padding:16px}
      h2{page-break-after:avoid}
      @page{margin:15mm}
    }
  </style></head><body>
  <h1>면접 질문 리포트</h1>
  <div class="meta">
    <div class="meta-item"><span class="meta-label">지원자</span><span class="meta-value">${esc(m.applicant)}</span></div>
    <div class="meta-item"><span class="meta-label">포지션</span><span class="meta-value">${esc(m.position)}</span></div>
    <div class="meta-item"><span class="meta-label">종합 점수</span><span class="meta-value">${score}/5</span></div>
    ${sheet ? `<div class="meta-item"><span class="meta-label">팀</span><span class="meta-value">${esc(sheet.team)}</span></div>` : ''}
    <div class="meta-item"><span class="meta-label">분석일</span><span class="meta-value">${esc(m.date)}</span></div>
    <div class="meta-item"><span class="meta-label">출력일시</span><span class="meta-value">${now}</span></div>
    <div class="meta-item"><span class="meta-label">이력서 심화</span><span class="meta-value">${resumeQs.length ? resumeQs.length + '개 포함' : '없음'}</span></div>
  </div>

  <h2>📋 코어 면접 질문 (${CORE_QB.filter(q => !q.leaderOnly).length}개)</h2>
  ${coreRows}

  <h2>역할 기반 질문 (${roleQs.length}개)</h2>
  ${roleHtml}

  <h2>경력 이슈 질문 (${careerQs.length}개)</h2>
  ${careerHtml}

  ${resumeSection}

  <div class="footer">채용매칭 시스템 · 면접질문리포트 · ${now}</div>
  <script>window.onload=function(){window.print();}<\/script>
  </body></html>`;

      const win = window.open('', '_blank');
      if (!win) { showToast('팝업이 차단되었습니다. 팝업 허용 후 다시 시도하세요.', 'error'); return; }
      win.document.write(html);
      win.document.close();
    }

    // ── 데이터 저장소 ──
    let sheetsData = [];
    let matchingData = [];
    let reportsData = [];
    let auditData = [];
    let usersData = [];

    // ── Supabase ──
    const SB_URL = 'https://wrxizpoptgpzmotgnajg.supabase.co';
    const SB_KEY = 'sb_publishable__WUC-nsBd0dX1KrQlGLc2g_D-f0R6fb';
    let sbClient = null;
    let sbReady = false;
    let cloudSyncDone = false; // true only after the initial cloud→local pull finishes (success or no-op) — blocks premature pushes of empty local state

    function initSupabase() {
      if (typeof supabase === 'undefined') { console.warn('Supabase SDK 로드 안 됨'); return; }
      try {
        sbClient = supabase.createClient(SB_URL, SB_KEY);
        sbReady = true;
      } catch (e) { console.warn('Supabase 초기화 실패:', e); }
    }

    async function sbSave(key, data) {
      if (!sbReady) return;
      try {
        await sbClient.from('app_data').upsert({ key, value: data, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      } catch (e) { console.warn('Supabase 저장 오류:', key, e); }
    }

    async function loadFromSupabase() {
      if (!sbReady) { cloudSyncDone = true; return; }
      try {
        const { data, error } = await sbClient.from('app_data').select('key, value');
        if (error) { console.warn('Supabase 로드 오류:', error); cloudSyncDone = true; return; }
        if (!data || data.length === 0) {
          // 첫 실행: 현재 localStorage 데이터를 Supabase로 업로드
          await sbSave('wm_sheets', sheetsData);
          await sbSave('wm_matching', matchingData);
          await sbSave('wm_audit', auditData);
          await sbSave('wm_users', usersData);
          await sbSave('wm_schedule', scheduleData);
          await sbSave('wm_interviewers', interviewersPool);
          await sbSave('wm_iv_appts', interviewAppointments);
          await sbSave('wm_iv_settings', interviewSettings);
          await sbSave('wm_ci_results', loadCIResults());
          showToast('클라우드 초기 업로드 완료', 'success');
          cloudSyncDone = true;
          return;
        }
        const map = {};
        data.forEach(row => { map[row.key] = row.value; });

        // 클라우드 값으로 덮어쓰기 전, 현재 로컬 상태를 백업 (클라우드 데이터가 비정상적으로 비어있는 경우를 위한 안전장치)
        takeLocalBackup('클라우드 동기화 전 자동 백업');

        if (map['wm_sheets'])       { sheetsData = map['wm_sheets'];             localStorage.setItem('wm_sheets', JSON.stringify(sheetsData)); }
        if (map['wm_matching'])     {
          matchingData = map['wm_matching'];
          // 클라우드에서 내려온 데이터도 id 마이그레이션
          let migrated = false;
          matchingData = matchingData.map(m => { if (!m.id) { migrated = true; return { ...m, id: generateId() }; } return m; });
          localStorage.setItem('wm_matching', JSON.stringify(matchingData));
          if (migrated) sbSave('wm_matching', matchingData);
        }
        if (map['wm_audit'])        { auditData = map['wm_audit'];                localStorage.setItem('wm_audit', JSON.stringify(auditData)); }
        if (map['wm_users'])        { usersData = map['wm_users'];                localStorage.setItem('wm_users', JSON.stringify(usersData)); }
        if (map['wm_schedule'])     { scheduleData = map['wm_schedule'];          localStorage.setItem('wm_schedule', JSON.stringify(scheduleData)); }
        if (map['wm_interviewers']) { interviewersPool = map['wm_interviewers'];  localStorage.setItem('wm_interviewers', JSON.stringify(interviewersPool)); }
        if (map['wm_iv_appts'])     { interviewAppointments = map['wm_iv_appts']; localStorage.setItem('wm_iv_appts', JSON.stringify(interviewAppointments)); }
        if (map['wm_iv_settings'])  { interviewSettings = map['wm_iv_settings'];  localStorage.setItem('wm_iv_settings', JSON.stringify(interviewSettings)); }
        if (map['wm_ci_results'])   { localStorage.setItem('wm_ci_results', JSON.stringify(map['wm_ci_results'])); }

        renderDashboard(); renderSheets(); renderMatching(); renderPositions();
        renderReports(); renderAuditLog(); renderUsers(); syncPositionDropdowns();
        showToast('클라우드 데이터 동기화 완료', 'success');
      } catch (e) {
        console.warn('Supabase 로드 실패:', e);
      } finally {
        cloudSyncDone = true;
      }
    }

    function saveData() {
      localStorage.setItem('wm_sheets', JSON.stringify(sheetsData));
      localStorage.setItem('wm_matching', JSON.stringify(matchingData));
      localStorage.setItem('wm_audit', JSON.stringify(auditData));
      localStorage.setItem('wm_users', JSON.stringify(usersData));
      takeLocalBackup();
      if (!cloudSyncDone) return; // 초기 클라우드 동기화가 끝나기 전에는 클라우드에 쓰지 않음 (빈 데이터로 덮어쓰는 사고 방지)
      sbSave('wm_sheets', sheetsData);
      sbSave('wm_matching', matchingData);
      sbSave('wm_audit', auditData);
      sbSave('wm_users', usersData);
    }

    function generateId() {
      return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }

    function loadData() {
      try { sheetsData = JSON.parse(localStorage.getItem('wm_sheets')) || []; } catch (e) { sheetsData = []; }
      try {
        matchingData = JSON.parse(localStorage.getItem('wm_matching')) || [];
        // 기존 데이터에 id 없으면 마이그레이션
        let migrated = false;
        matchingData = matchingData.map(m => {
          if (!m.id) { migrated = true; return { ...m, id: generateId() }; }
          return m;
        });
        if (migrated) localStorage.setItem('wm_matching', JSON.stringify(matchingData));
      } catch (e) { matchingData = []; }
      try { auditData = JSON.parse(localStorage.getItem('wm_audit')) || []; } catch (e) { auditData = []; }
      try { usersData = JSON.parse(localStorage.getItem('wm_users')) || []; } catch (e) { usersData = []; }
    }

    const USER_ROLES = ['HR 관리자', '채용 관리자 (현업 팀장)', '시스템 관리자'];

    function renderUsers() {
      const tbody = document.getElementById('users-tbody');
      if (!tbody) return;
      while (tbody.rows.length > 1) tbody.deleteRow(1);
      usersData.forEach(u => {
        const statusClass = u.status === '활성' ? 'badge-green' : u.status === '초대됨' ? 'badge-blue' : 'badge-gray';
        const roleSelect = `<select class="form-control form-control-sm" style="font-size:12px;padding:4px 6px" onchange="changeUserRole('${u.id}', this.value)">
      ${USER_ROLES.map(r => `<option value="${escHtml(r)}" ${r === u.role ? 'selected' : ''}>${escHtml(r)}</option>`).join('')}
    </select>`;
        const tr = document.createElement('tr');
        tr.innerHTML = `
    <td><strong>${escHtml(u.name)}</strong></td>
    <td class="text-gray">${escHtml(u.email)}</td>
    <td>${roleSelect}</td>
    <td><span class="badge ${statusClass}">${escHtml(u.status)}</span></td>
    <td class="text-gray text-sm">${escHtml(u.lastLogin || '—')}</td>
    <td class="flex gap-8">
      ${u.status === '초대됨' ? `<button class="btn btn-secondary btn-sm" onclick="resendInvite('${u.id}')">초대 재전송</button>` : ''}
      ${u.status === '활성' ? `<button class="btn btn-secondary btn-sm" onclick="resendLoginEmail('${u.id}')">로그인 메일 재전송</button>` : ''}
      <button class="btn btn-secondary btn-sm" onclick="openUserPerms('${u.id}')">권한 설정</button>
      ${u.status === '비활성'
        ? `<button class="btn btn-secondary btn-sm" onclick="reactivateUser('${u.id}')">활성화</button>`
        : `<button class="btn btn-secondary btn-sm" onclick="deactivateUser('${u.id}')">비활성화</button>`}
      <button class="btn btn-danger btn-sm" onclick="deleteUser('${u.id}')">삭제</button>
    </td>`;
        tbody.appendChild(tr);
      });
    }

    function changeUserRole(id, role) {
      const u = usersData.find(x => x.id === id);
      if (!u) return;
      u.role = role;
      saveData();
      addAuditLog('우성 관리자', '역할 변경', `${u.email} → ${role}`);
      showToast(`${u.name}님의 역할이 "${role}"로 변경되었습니다.`, 'success');
    }

    function deactivateUser(id) {
      const u = usersData.find(x => x.id === id);
      if (!u) return;
      u.status = '비활성';
      saveData();
      renderUsers();
      addAuditLog('우성 관리자', '계정 비활성화', u.email);
      showToast('계정이 비활성화되었습니다.', 'success');
    }

    function reactivateUser(id) {
      const u = usersData.find(x => x.id === id);
      if (!u) return;
      u.status = '활성';
      saveData();
      renderUsers();
      addAuditLog('우성 관리자', '계정 활성화', u.email);
      showToast('계정이 활성화되었습니다.', 'success');
    }

    function deleteUser(id) {
      const u = usersData.find(x => x.id === id);
      if (!u) return;
      showConfirm('사용자 삭제', `${u.name}(${u.email}) 계정을 완전히 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`, () => {
        usersData = usersData.filter(x => x.id !== id);
        saveData();
        renderUsers();
        addAuditLog('우성 관리자', '사용자 삭제', u.email);
        showToast('사용자가 삭제되었습니다.', 'success');
      });
    }

    async function resendInvite(id) {
      const u = usersData.find(x => x.id === id);
      if (!u) return;
      try {
        const res = await fetch('/api/invite-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: u.name, email: u.email, role: u.role }),
        });
        const result = await res.json();
        if (!res.ok) {
          showToast(`초대 재전송 실패: ${result.error?.message || '알 수 없는 오류'}`, 'error');
          return;
        }
        addAuditLog('우성 관리자', '초대 재전송', u.email);
        showToast(`${u.name}(${u.email})에게 초대 메일을 재전송했습니다.`, 'success');
      } catch (e) {
        showToast(`초대 재전송 실패: ${e.message}`, 'error');
      }
    }

    async function resendLoginEmail(id) {
      const u = usersData.find(x => x.id === id);
      if (!u || !sbReady) return;
      try {
        const { error } = await sbClient.auth.signInWithOtp({
          email: u.email,
          options: { shouldCreateUser: false, emailRedirectTo: window.location.origin },
        });
        if (error) {
          showToast(`로그인 메일 재전송 실패: ${error.message}`, 'error');
          return;
        }
        addAuditLog('우성 관리자', '로그인 메일 재전송', u.email);
        showToast(`${u.name}(${u.email})에게 로그인 메일을 재전송했습니다.`, 'success');
      } catch (e) {
        showToast(`로그인 메일 재전송 실패: ${e.message}`, 'error');
      }
    }

    function addAuditLog(user, action, target) {
      const now = new Date().toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
      const ip = '—';
      auditData.unshift({ time: now, user, action, target, ip });
      saveData();
      renderAuditLog();
    }

    function renderAuditLog() {
      const tbody = document.getElementById('audit-tbody');
      if (auditData.length === 0) {
        tbody.innerHTML = '<tr id="audit-empty"><td colspan="5"><div class="empty-state"><div class="empty-icon">🔒</div><div class="empty-text">기록된 감사 로그가 없습니다.</div></div></td></tr>';
        return;
      }
      tbody.innerHTML = auditData.map(r =>
        `<tr><td class="text-sm text-gray">${r.time}</td><td>${r.user}</td><td>${r.action}</td><td>${r.target}</td><td>${r.ip}</td></tr>`
      ).join('');
    }

    // ── Admin actions ──
    function getPosStatus(s) {
      if (s.status === '채용완료') return '채용완료';
      const applicants = matchingData.filter(m => m.position === s.name).length;
      return applicants > 0 ? '채용중' : '준비중';
    }

    function setPositionStatus(idx, status) {
      sheetsData[idx].status = status;
      if (status === '채용완료') {
        sheetsData[idx].completedDate = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '-').replace('.', '');
      } else {
        sheetsData[idx].completedDate = '';
      }
      saveData();
      renderPositions();
      renderDashboard();
      showToast(`포지션 상태가 "${status || '자동'}"으로 변경되었습니다.`, 'success');
    }

    function resetPosFilters() {
      ['pos-filter-status', 'pos-filter-team', 'pos-filter-year', 'pos-filter-month'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      renderPositions();
    }

    function renderPositions() {
      // 연도 필터 옵션 동적 생성
      const yearSel = document.getElementById('pos-filter-year');
      if (yearSel && sheetsData.length > 0) {
        const years = [...new Set(sheetsData.map(s => (s.created || '').substring(0, 4)).filter(Boolean))].sort().reverse();
        const curY = yearSel.value;
        yearSel.innerHTML = '<option value="">전체 연도</option>' + years.map(y => `<option value="${y}"${curY === y ? ' selected' : ''}>${y}년</option>`).join('');
      }

      // 팀 필터 옵션 동적 생성
      const teamSel = document.getElementById('pos-filter-team');
      if (teamSel && sheetsData.length > 0) {
        const teams = [...new Set(sheetsData.map(s => s.team).filter(t => t && t !== '—'))].sort();
        const curT = teamSel.value;
        teamSel.innerHTML = '<option value="">전체 팀</option>' + teams.map(t => `<option value="${escHtml(t)}"${curT === t ? ' selected' : ''}>${escHtml(t)}</option>`).join('');
      }

      const filterStatus = document.getElementById('pos-filter-status')?.value || '';
      const filterTeam = document.getElementById('pos-filter-team')?.value || '';
      const filterYear = document.getElementById('pos-filter-year')?.value || '';
      const filterMonth = document.getElementById('pos-filter-month')?.value || '';

      const tbody = document.getElementById('positions-tbody');
      if (sheetsData.length === 0) {
        tbody.innerHTML = '<tr id="positions-empty"><td colspan="9"><div class="empty-state"><div class="empty-icon">💼</div><div class="empty-text">등록된 포지션이 없습니다. 설계시트를 생성하면 자동으로 포지션이 등록됩니다.</div></div></td></tr>';
        return;
      }

      let rows = sheetsData.map((s, i) => ({ s, i }));

      // 필터 적용
      if (filterStatus) rows = rows.filter(({ s }) => getPosStatus(s) === filterStatus);
      if (filterTeam) rows = rows.filter(({ s }) => s.team === filterTeam);
      if (filterYear) rows = rows.filter(({ s }) => (s.created || '').startsWith(filterYear));
      if (filterMonth) rows = rows.filter(({ s }) => {
        const d = s.created || '';
        // "2026-06-15" or "2026-06-15" format
        const parts = d.replace(/\./g, '-').split('-');
        return parts[1] === filterMonth;
      });

      if (rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9"><div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-text">조건에 맞는 포지션이 없습니다.</div></div></td></tr>';
        return;
      }

      tbody.innerHTML = rows.map(({ s, i }) => {
        const applicants = matchingData.filter(m => m.position === s.name).length;
        const status = getPosStatus(s);
        const badgeCls = status === '채용중' ? 'badge-blue' : status === '채용완료' ? 'badge-purple' : 'badge-gray';
        const nextStatus = status === '채용완료' ? '채용중으로 변경' : '채용완료로 변경';
        const nextVal = status === '채용완료' ? '' : '채용완료';
        const levelBadges = (s.levels && s.levels.length > 0)
          ? s.levels.map(lv => `<span class="level-badge" style="margin-right:4px;margin-bottom:2px">${escHtml(lv.code)}</span>`).join('')
          : '<span class="text-gray text-sm">—</span>';
        return `<tr>
      <td><strong>${escHtml(s.name)}</strong></td>
      <td>${escHtml(s.team)}</td>
      <td style="white-space:nowrap">${levelBadges}</td>
      <td>${applicants}명</td>
      <td>
        <span class="badge ${badgeCls}">${status}</span>
        <button class="btn btn-secondary btn-sm" style="margin-left:6px;font-size:11px;padding:2px 8px" onclick="setPositionStatus(${i},'${nextVal}')">${nextStatus}</button>
      </td>
      <td class="text-gray text-sm">${s.created}</td>
      <td class="text-gray text-sm">${escHtml(s.completedDate || '')}</td>
      <td>
        <input class="form-control form-control-sm" style="font-size:12px;padding:4px 6px;width:120px" value="${escHtml(s.storageLocation || '')}" placeholder="예: 인사팀 서버 3층" onchange="updatePositionStorage(${i}, this.value)" />
      </td>
      <td class="flex gap-8">
        <button class="btn btn-secondary btn-sm" onclick="openSheetDetail(${i})">설계시트</button>
        <button class="btn btn-secondary btn-sm" onclick="openAssignments(${i})">과제</button>
        <button class="btn btn-secondary btn-sm" onclick="nav('matching')">분석 보기</button>
      </td>
    </tr>`;
      }).join('');
    }

    function updatePositionStorage(idx, value) {
      const s = sheetsData[idx];
      if (!s) return;
      s.storageLocation = value.trim();
      saveData();
    }

    // ── 포지션별 과제(Assignment) 관리 ──
    let currentAssignmentPosIdx = null;
    let currentAssignmentEditId = null;
    let pendingAssignmentFile = null; // { name, type, dataUrl }

    function openAssignments(idx) {
      currentAssignmentPosIdx = idx;
      const s = sheetsData[idx];
      if (!s) return;
      if (!s.assignments) s.assignments = [];
      document.getElementById('assignment-modal-title').textContent = `${s.name} · 과제 관리`;
      closeAssignmentForm();
      renderAssignmentList();
      openModal('modal-assignments');
    }

    function renderAssignmentList() {
      const s = sheetsData[currentAssignmentPosIdx];
      const wrap = document.getElementById('assignment-list');
      if (!s || !s.assignments || s.assignments.length === 0) {
        wrap.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">등록된 과제가 없습니다.</div></div>';
        return;
      }
      wrap.innerHTML = s.assignments.map(a => `
        <div class="flex items-center justify-between" style="padding:10px 0;border-bottom:1px solid #eee">
          <div>
            <div><strong class="link" style="cursor:pointer" onclick="viewAssignment('${a.id}')">${escHtml(a.title)}</strong></div>
            <div class="text-gray text-sm">${a.fileName ? '첨부파일: ' + escHtml(a.fileName) : '첨부파일 없음'} · 수정일 ${a.modified}</div>
          </div>
          <div class="flex gap-8">
            <button class="btn btn-secondary btn-sm" onclick="openAssignmentForm('${a.id}')">불러오기/수정</button>
            <button class="btn btn-secondary btn-sm" onclick="exportAssignment('${a.id}')">내보내기</button>
            <button class="btn btn-secondary btn-sm" onclick="exportAssignmentPdf('${a.id}')">PDF로 내보내기</button>
            <button class="btn btn-danger btn-sm" onclick="deleteAssignment('${a.id}')">삭제</button>
          </div>
        </div>`).join('');
    }

    function viewAssignment(id) {
      const s = sheetsData[currentAssignmentPosIdx];
      const a = s && (s.assignments || []).find(x => x.id === id);
      if (!a) return;

      const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
  <title>과제 — ${escHtml(a.title)}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,'Malgun Gothic','Apple SD Gothic Neo',sans-serif;font-size:14px;color:#333;padding:32px;max-width:800px;margin:0 auto;line-height:1.7}
    h1{font-size:20px;font-weight:700;margin-bottom:14px}
    .meta{color:#888;font-size:12px;margin-bottom:24px;padding-bottom:14px;border-bottom:1px solid #eee}
    .content{white-space:pre-wrap;font-size:14px}
    .file-box{margin-top:24px;padding:14px 18px;background:#f8f8f8;border:1px solid #e0e0e0;border-radius:6px}
    .file-box a{color:#3366dd;text-decoration:none;font-weight:600}
  </style></head><body>
  <h1>${escHtml(a.title)}</h1>
  <div class="meta">포지션: ${escHtml(s.name)} · 생성일 ${a.created} · 수정일 ${a.modified}</div>
  <div class="content">${escHtml(a.content || '(등록된 내용 없음)')}</div>
  ${a.fileData ? `<div class="file-box">📎 첨부파일: <a href="${a.fileData}" download="${escHtml(a.fileName)}">${escHtml(a.fileName)}</a></div>` : ''}
  </body></html>`;

      const win = window.open('', '_blank');
      if (!win) { showToast('팝업이 차단되었습니다. 팝업 허용 후 다시 시도하세요.', 'error'); return; }
      win.document.write(html);
      win.document.close();
    }

    function exportAssignmentPdf(id) {
      const s = sheetsData[currentAssignmentPosIdx];
      const a = s && (s.assignments || []).find(x => x.id === id);
      if (!a) return;

      const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
  <title>과제 — ${escHtml(a.title)}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,'Malgun Gothic','Apple SD Gothic Neo',sans-serif;font-size:14px;color:#333;padding:32px;max-width:800px;margin:0 auto;line-height:1.7}
    h1{font-size:20px;font-weight:700;margin-bottom:14px}
    .meta{color:#888;font-size:12px;margin-bottom:24px;padding-bottom:14px;border-bottom:1px solid #eee}
    .content{white-space:pre-wrap;font-size:14px}
    .footer{text-align:center;color:#aaa;font-size:11px;margin-top:40px;padding-top:14px;border-top:1px solid #eee}
    @media print{
      body{padding:16px}
      @page{margin:15mm}
    }
  </style></head><body>
  <h1>${escHtml(a.title)}</h1>
  <div class="meta">포지션: ${escHtml(s.name)} · 생성일 ${a.created} · 수정일 ${a.modified}</div>
  <div class="content">${escHtml(a.content || '(등록된 내용 없음)')}</div>
  <div class="footer">채용매칭 시스템 · 과제 · ${new Date().toLocaleString('ko-KR')}</div>
  <script>window.onload=function(){window.print();}<\/script>
  </body></html>`;

      const win = window.open('', '_blank');
      if (!win) { showToast('팝업이 차단되었습니다. 팝업 허용 후 다시 시도하세요.', 'error'); return; }
      win.document.write(html);
      win.document.close();
    }

    function openAssignmentForm(editId) {
      currentAssignmentEditId = editId || null;
      pendingAssignmentFile = null;
      document.getElementById('assignment-form').style.display = '';
      document.getElementById('assignment-file-info').textContent = '';
      const titleEl = document.getElementById('assignment-title');
      const contentEl = document.getElementById('assignment-content');
      if (editId) {
        const s = sheetsData[currentAssignmentPosIdx];
        const a = (s.assignments || []).find(x => x.id === editId);
        if (a) {
          titleEl.value = a.title;
          contentEl.value = a.content || '';
          if (a.fileName) {
            document.getElementById('assignment-file-info').textContent = `현재 첨부파일: ${a.fileName}`;
            pendingAssignmentFile = { name: a.fileName, type: a.fileType, dataUrl: a.fileData };
          }
        }
      } else {
        titleEl.value = '';
        contentEl.value = '';
      }
      document.getElementById('assignment-file-input').value = '';
    }

    function closeAssignmentForm() {
      currentAssignmentEditId = null;
      pendingAssignmentFile = null;
      const form = document.getElementById('assignment-form');
      if (form) form.style.display = 'none';
    }

    function handleAssignmentFileUpload(input) {
      if (!input.files.length) return;
      const file = input.files[0];
      if (file.size > 20 * 1024 * 1024) {
        showToast('파일 크기는 20MB 이하만 가능합니다.', 'error');
        return;
      }
      const infoEl = document.getElementById('assignment-file-info');
      infoEl.textContent = `"${file.name}" 불러오는 중...`;
      const reader = new FileReader();
      reader.onload = e => {
        pendingAssignmentFile = { name: file.name, type: file.type, dataUrl: e.target.result };
        infoEl.textContent = `첨부됨: ${file.name}`;
      };
      reader.readAsDataURL(file);

      // .docx 파일은 텍스트도 함께 추출하여 본문에 불러오기
      if (file.name.toLowerCase().endsWith('.docx') && typeof mammoth !== 'undefined') {
        const textReader = new FileReader();
        textReader.onload = e2 => {
          mammoth.extractRawText({ arrayBuffer: e2.target.result })
            .then(r => {
              const contentEl = document.getElementById('assignment-content');
              if (r.value && !contentEl.value.trim()) contentEl.value = r.value.trim();
            })
            .catch(() => {});
        };
        textReader.readAsArrayBuffer(file);
      } else if (file.name.toLowerCase().endsWith('.txt')) {
        const textReader = new FileReader();
        textReader.onload = e2 => {
          const contentEl = document.getElementById('assignment-content');
          if (!contentEl.value.trim()) contentEl.value = (e2.target.result || '').trim();
        };
        textReader.readAsText(file, 'UTF-8');
      }
    }

    function saveAssignment() {
      const s = sheetsData[currentAssignmentPosIdx];
      if (!s) return;
      const title = document.getElementById('assignment-title').value.trim();
      const content = document.getElementById('assignment-content').value.trim();
      if (!title) { showToast('과제 제목을 입력하세요.', 'error'); return; }

      const now = new Date();
      const today = now.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '-').replace('.', '');

      if (!s.assignments) s.assignments = [];

      if (currentAssignmentEditId) {
        const a = s.assignments.find(x => x.id === currentAssignmentEditId);
        if (a) {
          a.title = title;
          a.content = content;
          a.modified = today;
          if (pendingAssignmentFile) {
            a.fileName = pendingAssignmentFile.name;
            a.fileType = pendingAssignmentFile.type;
            a.fileData = pendingAssignmentFile.dataUrl;
          }
        }
      } else {
        s.assignments.push({
          id: 'as_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
          title, content,
          fileName: pendingAssignmentFile ? pendingAssignmentFile.name : '',
          fileType: pendingAssignmentFile ? pendingAssignmentFile.type : '',
          fileData: pendingAssignmentFile ? pendingAssignmentFile.dataUrl : '',
          created: today, modified: today
        });
      }
      saveData();
      closeAssignmentForm();
      renderAssignmentList();
      addAuditLog('우성 관리자', '과제 등록/수정', `${s.name} · ${title}`);
      showToast('과제가 저장되었습니다.', 'success');
    }

    function deleteAssignment(id) {
      const s = sheetsData[currentAssignmentPosIdx];
      if (!s || !s.assignments) return;
      showConfirm('과제 삭제', '이 과제를 삭제하시겠습니까?', () => {
        s.assignments = s.assignments.filter(a => a.id !== id);
        saveData();
        renderAssignmentList();
        showToast('과제가 삭제되었습니다.', 'success');
      });
    }

    function exportAssignment(id) {
      const s = sheetsData[currentAssignmentPosIdx];
      const a = s && (s.assignments || []).find(x => x.id === id);
      if (!a) return;

      if (a.fileData) {
        const link = document.createElement('a');
        link.href = a.fileData;
        link.download = a.fileName || `${a.title}.txt`;
        document.body.appendChild(link);
        link.click();
        link.remove();
      } else {
        const blob = new Blob([`${a.title}\n\n${a.content || ''}`], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${a.title}.txt`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      }
      showToast('과제를 다운로드했습니다.', 'success');
    }

    async function addUser() {
      const modal = document.getElementById('modal-add-user');
      const inputs = modal.querySelectorAll('input');
      const select = modal.querySelector('select');
      const name = inputs[0].value.trim();
      const email = inputs[1].value.trim();
      const role = select.value;
      if (!name || !email) { showToast('이름과 이메일을 입력하세요.', 'error'); return; }

      const existing = usersData.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (existing) {
        if (existing.status === '비활성') {
          existing.status = '활성';
          existing.name = name;
          existing.role = role;
          saveData();
          renderUsers();
          inputs.forEach(i => i.value = '');
          closeModal('modal-add-user');
          addAuditLog('우성 관리자', '계정 재활성화', email);
          showToast(`${name}(${email}) 계정을 다시 활성화했습니다.`, 'success');
        } else {
          showToast(`${email}은 이미 등록된 계정입니다. 사용자 관리 목록에서 확인하세요.`, 'error');
        }
        return;
      }

      const submitBtn = modal.querySelector('.btn-primary');
      if (submitBtn) submitBtn.disabled = true;
      try {
        const res = await fetch('/api/invite-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, role }),
        });
        const result = await res.json();
        if (!res.ok) {
          const msg = result.error?.message || '알 수 없는 오류';
          if (/already.*registered/i.test(msg)) {
            showToast(`${email}은 이미 가입된 이메일입니다.`, 'error');
          } else {
            showToast(`초대 메일 발송 실패: ${msg}`, 'error');
          }
          return;
        }

        usersData.push({ id: String(Date.now()), name, email, role, status: '초대됨', lastLogin: '—' });
        saveData();
        renderUsers();
        inputs.forEach(i => i.value = '');
        closeModal('modal-add-user');
        addAuditLog('우성 관리자', '사용자 등록', email);
        showToast(`${name}(${email})에게 초대 메일이 발송되었습니다.`, 'success');
      } catch (e) {
        showToast(`초대 메일 발송 실패: ${e.message}`, 'error');
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    }

    const DEFAULT_PERMS = { sheet_edit: true, sheet_delete: false, resume_analyze: true, match_view: true, report_view: true, user_manage: false };
    let currentPermUserId = null;

    function openUserPerms(id) {
      const u = usersData.find(x => x.id === id);
      if (!u) return;
      currentPermUserId = id;
      document.getElementById('perm-modal-title').textContent = `권한 설정 — ${u.name}`;
      const perms = Object.assign({}, DEFAULT_PERMS, u.permissions || {});
      document.querySelectorAll('#modal-user-perms input[data-perm]').forEach(cb => {
        cb.checked = !!perms[cb.dataset.perm];
      });
      openModal('modal-user-perms');
    }

    function savePerms() {
      const u = usersData.find(x => x.id === currentPermUserId);
      if (!u) { closeModal('modal-user-perms'); return; }
      const perms = {};
      document.querySelectorAll('#modal-user-perms input[data-perm]').forEach(cb => {
        perms[cb.dataset.perm] = cb.checked;
      });
      u.permissions = perms;
      saveData();
      closeModal('modal-user-perms');
      addAuditLog('우성 관리자', '권한 변경', u.email);
      showToast(`${u.name}님의 권한이 저장되었습니다.`, 'success');
    }

    function confirmDeactivate() {
      showConfirm('계정 비활성화', '해당 사용자의 계정을 비활성화하시겠습니까?', () => {
        addAuditLog('우성 관리자', '계정 비활성화', '사용자');
        showToast('계정이 비활성화되었습니다.', 'success');
      });
    }

    function confirmDeleteUser() {
      showConfirm('사용자 삭제', '해당 사용자를 완전히 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.', () => {
        addAuditLog('우성 관리자', '사용자 삭제', '사용자');
        showToast('사용자가 삭제되었습니다.', 'success');
      });
    }

    // ── Password strength ──
    function checkPwStrength(pw) {
      const el = document.getElementById('pw-strength');
      if (!pw) { el.style.display = 'none'; return; }
      el.style.display = '';
      let score = 0;
      if (pw.length >= 8) score++;
      if (/[A-Za-z]/.test(pw) && /[0-9]/.test(pw)) score++;
      if (/[^A-Za-z0-9]/.test(pw)) score++;
      const colors = ['#cc3333', '#e07000', '#2a9a50'];
      const labels = ['약함', '보통', '강함'];
      for (let i = 1; i <= 3; i++) {
        document.getElementById('ps' + i).style.background = i <= score ? colors[score - 1] : '#eee';
      }
      document.getElementById('pw-strength-label').textContent = labels[score - 1] || '';
      document.getElementById('pw-strength-label').style.color = colors[score - 1] || '#888';
    }

    // ── Modals ──
    function openModal(id) { document.getElementById(id).classList.add('open'); }
    function closeModal(id) { document.getElementById(id).classList.remove('open'); }
    function closeModalOut(e, id) { if (e.target.id === id) closeModal(id); }

    let confirmCallback = null;
    function showConfirm(title, msg, cb) {
      document.getElementById('confirm-title').textContent = title;
      document.getElementById('confirm-msg').textContent = msg;
      confirmCallback = cb;
      openModal('modal-confirm');
    }
    document.getElementById('confirm-ok-btn').onclick = () => {
      closeModal('modal-confirm');
      if (confirmCallback) confirmCallback();
    };

    // ── Toasts ──
    function showToast(msg, type = 'info') {
      const wrap = document.getElementById('toast-wrap');
      const t = document.createElement('div');
      t.className = `toast toast-${type}`;
      t.textContent = msg;
      wrap.appendChild(t);
      setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(120%)'; t.style.transition = 'all 0.3s'; setTimeout(() => t.remove(), 300); }, 3000);
    }

    // ══════════════════════════════════════════════════
    //  WOS 코어 면접 평가 시스템
    // ══════════════════════════════════════════════════

    const CORE_QB = [
      {
        id: 'Q1', cat: '문제해결', leaderOnly: false, instantFail: true,
        main: '과거 업무를 수행하면서 가장 비효율적이라고 느꼈던 운영 이슈와 그것을 개선한 사례를 구체적으로 말씀해 주세요.',
        failNote: '※ 개선 경험 자체가 없는 경우 즉시 불합격 처리 및 1-1~1-6 전체 스킵',
        subs: [
          {
            id: '1-1', q: '그 문제는 처음에 어떤 계기로 인식하셨나요? 그 문제가 시급하다고 공감하게 된 이유는 무엇이었나요?', green: '내재 동기 / 스스로 이유 찾음', red: '지시받아서 함 / 이유 모름 (수동성)',
            detail: {
              green: [
                { tag: '내재 동기', desc: '업무 중 병목/비효율을 직접 발견, 비용/시간 낭비가 심각하다고 데이터로 판단해 자발적으로 시작' },
                { tag: "시작은 지시였으나 '이유'를 찾음", examples: ['처음엔 팀장님 지시로 시작했지만, 데이터를 뜯어보니 매달 3천만 원씩 누수되고 있어서 바로 수행했습니다.'] },
              ],
              red: [
                { tag: '이유 부재', examples: ['올해 KPI로 잡혀 있어서 했습니다', '지시가 있어서 수행했습니다'] },
              ],
            },
          },
          {
            id: '1-2', q: '그 문제를 해결하기 위해 어떤 방식으로 접근하셨나요? 솔루션을 선택한 논리를 설명해 주세요.', green: '가설 검증 기반 접근', red: '맥락 없는 방법론 / 몸빵', branch: ['덧셈형', '뺄셈형'],
            detail: {
              green: [
                { tag: '가설-검증', desc: '문제의 근본 원인에 맞춰 최적의 수단을 선택' },
                { tag: '시스템 도입', examples: ['엑셀 양식을 통일/자동화했습니다', '프로세스 단계를 삭제했습니다', '전산 툴을 도입해 원천 봉쇄했습니다', '자동화는 못 해서 파일 제목 양식을 통일하고 폴더 구조를 바꿨습니다'] },
              ],
              red: [
                { tag: '맥락 없는 방법론', examples: ['요즘 AI가 트렌드라서', '전 직장에서 썼던 거라 그냥 가져왔습니다'] },
                { tag: '몸으로 때우기', examples: ['제가 일찍 출근해서 처리했습니다', '담당자들을 교육하고 꼼꼼히 크로스 체크했습니다'] },
              ],
            },
          },
          {
            id: '1-3', q: '실행 단계에서 어떤 구체적인 조치를 취하셨나요? 숫자나 수치로 설명해 주시겠어요?', green: '6하원칙 + 수치 기반', red: '디테일 없음 / 수치 부재',
            detail: {
              green: [
                { tag: '디테일', desc: '장애물(반발, 시스템 오류 등)을 6하원칙으로 생생하게 묘사' },
                { tag: '숫자', examples: ['소요 시간이 3일에서 3시간으로 줄었습니다', '불량률이 0%가 됐습니다'] },
              ],
              red: [
                { tag: '디테일 부재', desc: '질문에 멈칫하거나 "전반적으로 힘들었습니다"로 얼버무림' },
                { tag: '숫자 부재', examples: ['좋아졌습니다', '편해졌습니다', '효율화됐습니다 (구체적 증거 없음)'] },
              ],
            },
          },
          {
            id: '1-4', q: '[덧셈형] 이 솔루션이 문제의 본질을 파악한 것인지, 표면적 증상만 건드린 건 아닌지 어떻게 확인하셨나요?\n[뺄셈형] 이 솔루션을 선택하지 않았을 때 어떤 리스크가 있었는지 어떻게 분석하셨나요?', green: '문제 본질 파악 / 득실 분석', red: '무논리 / 시켜서 함', dynamic: true, branch: ['덧셈형', '뺄셈형'],
            cases: [
              {
                name: 'CASE 1. 덧셈형 솔루션', desc: '검수 단계 추가, 인력 투입, 보고서 양식 신설 등',
                green: [
                  { tag: '재해석', examples: ['그땐 급해서 인력을 늘렸지만, A단계 승인 절차 자체가 무의미했습니다. 없앴다면 인력 추가 없이도 해결됐을 겁니다'] },
                  { tag: '본질 파악', examples: ['그 보고서는 팀장님 불안감 때문에 만든 거지 실무엔 불필요했습니다. 없애고 데이터 대시보드로 대체하겠습니다'] },
                ],
                red: [
                  { tag: '방어', examples: ['안전을 위해 무조건 더블 체크가 필요합니다. 단순화할 건 없습니다'] },
                  { tag: '외재론/완벽주의 포장', examples: ['회사 룰이라서', '그때 솔루션이 최적이었습니다', '지시가 그렇게 와서 바꿀 수 없습니다'] },
                ],
              },
              {
                name: 'CASE 2. 뺄셈형 솔루션', desc: '보고서 제거, 중간 단계 생략, 통합 축소 등',
                green: [
                  { tag: '득실 분석', examples: ['리스크는 1% 미만인데 유지 비용은 연간 1억이었습니다. 사고 나면 제가 책임진다고 설득하고 없앴습니다'] },
                  { tag: '본질 집중', examples: ['고객이 원하는 건 빠른 배송이지 예쁜 포장이 아니라 판단해 포장 단계를 뺐습니다'] },
                  { tag: '시스템적 사고', examples: ['더블체크는 사람이 하는 거라 지속가능성이 없다고 판단했습니다', '복잡성을 더하면 속도가 느려져 단순한 쪽을 택했습니다'] },
                ],
                red: [
                  { tag: "무논리('왜'가 없음)", examples: ['그냥 너무 복잡했습니다. 없애니까 효율화됐습니다', '그게 최적이라고 판단했습니다'] },
                  { tag: '시켜서', examples: ['팀장님/본부장님이 그 솔루션이 맞다고 해서 그렇게 개선했습니다'] },
                ],
              },
            ],
          },
          {
            id: '1-5', q: '그 개선이 지금도 유지되고 있나요? 담당자가 바뀌어도 유지되도록 어떤 장치를 만드셨나요?', green: '시스템화 / 강제화', red: '사람 의존 / 개인 노트 수준', tier: 'three',
            detail: {
              green: [
                { tag: '자동화/강제화', examples: ['전산상 입력값이 안 맞으면 저장이 안 되게 막아둬서 누가 와도 결과가 같습니다', '매일 새벽 서버에서 스크립트가 자동으로 돕니다', '프로세스와 전산을 같이 바꿔 입력 단계부터 오류 여지가 없습니다'] },
                { tag: '공식 기록', examples: ['Post-Mortem(사후 회고) 문서를 작성해 전사에 공유했습니다'] },
                { tag: '재발 방지', examples: ["신규 입사자 온보딩 가이드에 '절대 하지 말 것' 리스트를 추가했습니다"] },
                { tag: '툴/프로세스 개선', examples: ['프로세스상 그 단계가 생략되도록 툴을 바꿨습니다'] },
                { tag: '기초적 변경', examples: ['엑셀 서식 자체를 수정해 필수 값을 안 넣으면 빨간불이 들어오게 했습니다', '공용 폴더 쓰기 권한을 막고 읽기만 줬습니다'] },
              ],
              hold: [
                { tag: '사람 의존', examples: ['담당자가 체크리스트를 안 보면 실수가 날 수 있습니다', '인수인계는 했지만 사람이 바뀌면 흔들릴 수 있습니다', '안내서·알림은 있지만 입력값을 잘못하면 오류가 날 수 있습니다'] },
                { tag: '시스템화 부재', examples: ['제 업무 노트에 적어두고 항상 되새깁니다'] },
              ],
            },
          },
          {
            id: '1-6', q: '지금 그 시점으로 돌아간다면 어떻게 다르게 접근하시겠어요? 그 해결책의 구조적 한계는 무엇이었나요?', green: '구조적 개선 방향 제시', red: '대안 없음 / 교육 타령',
            detail: {
              green: [
                { tag: '구조적 개선', examples: ['지금이라면 노코드 툴(Zapier 등)로 이메일 접수부터 자동화하겠습니다', '사람 검수 단계를 없애고 양식을 객관식으로 바꿔 오입력을 막겠습니다'] },
              ],
              red: [
                { tag: '대안 부재/사람 의존', examples: ['교육을 강화하겠습니다', '휴먼에러를 100% 막긴 어렵습니다', '체크리스트를 더 강화하겠습니다'] },
              ],
            },
          },
        ]
      },
      {
        id: 'Q2', cat: '성과정의', leaderOnly: false,
        main: '이 포지션에서 "성과를 낸다"는 것이 무엇을 의미한다고 생각하시나요?',
        mainSummary: { green: "'숫자' 위주, 개선·개척 등 부가가치 창출", red: '처리·수행=성과 / 답변 미흡' },
        mainDetail: {
          green: [
            { tag: "'숫자' 위주, 부가가치 창출", examples: ['기존 비효율을 00% 줄인 것', '새 구조를 만든 것', '문제를 해결해 비용을 아낀 것'] },
          ],
          red: [
            { tag: '처리·수행=성과', examples: ['납기일 준수', '시킨 일을 실수 없이 처리', '야근하며 성실히 수행', '문제가 안 생기게 하는 것'] },
            { tag: '답변 미흡', desc: "대답 못 함 / 애매함 / '성과'를 정의하지 못함" },
          ],
        },
        subs: [
          {
            id: '2-1', q: '방금 말씀하신 성과를 왜 성과라고 부를 수 있나요? 그 지표가 의미 있는 이유는 무엇인가요?', green: '사업적 연결 설명', red: '왜(Why) 설명 불가',
            detail: {
              green: [
                { tag: '사업/직군 목표와 연결', examples: ['이 지표는 근본적으로 불량률을 낮추는 데 있고, 불량률이 낮아지면 AS 비용이 줄어 비용 절감으로 이어지므로 이 포지션의 성과입니다'] },
              ],
              red: [
                { tag: "'왜'의 부재", examples: ['그렇게 설정해 관리해왔다', '해보니 유효한 것 같다', '불량률을 줄이는 건 중요하다', '대부분 회사도 이 지표를 중요하게 관리한다'] },
                { tag: '답변 미흡', desc: '대답 못 함 / 애매함' },
              ],
            },
          },
          {
            id: '2-2', q: '리소스가 부족한 상황에서도 그 성과를 달성하신 경험이 있으신가요? 어떻게 극복하셨나요?', green: '전략적 실행 / 창의적 극복', red: '수동적 / 포기 / 타협', noExpPopup: true,
            detail: {
              green: [
                { tag: '스스로 실행', examples: ['유사 사례를 검색했습니다', '목표·계획부터 정의했습니다', '작게라도 일단 실행했습니다'] },
                { tag: '창의적/학습으로 해결', examples: ['무료 툴 3개를 조합했습니다', '인력이 없어 파이썬을 배워 직접 자동화했습니다', '데이터가 없어 경쟁사 리뷰 1,000개를 긁어 분석했습니다'] },
                { tag: '전략적 헌신', examples: ['당장은 야근했지만 동시에 루틴 업무는 윗선에 말해 잠시 중단시켰습니다', '몸으로 때우면서 다음엔 안 그러려고 매뉴얼을 만들었습니다'] },
                { tag: '선택과 집중', examples: ['10개를 다 못 하니 매출에 직결되는 핵심 2개에 자원을 쏟고 나머지는 버렸습니다'] },
                { tag: '하이브리드(실행 병행/선행)', examples: ['목표·계획을 세운 뒤 리소스 할당을 논리적으로 제안하는 동시에, 결과와 무관하게 실행할 수 있는 것부터 해보겠습니다'] },
              ],
              red: [
                { tag: '수동적 실행', examples: ['인사팀·본부장께 인력 충원을 계속 요청했습니다 (결국 안 됨)'] },
                { tag: '단순 반복', examples: ['팀원 힘들까 봐 말 안 하고 혼자 풀로 야근했습니다'] },
                { tag: '단순 버림·타협', examples: ['예산·기일에 맞춰 퀄리티를 전반적으로 낮췄습니다'] },
                { tag: '무조건 갖춰져야 함', examples: ['최소 예산은 확보해야 하니 예산 확보 기획안부터 다시 올리겠습니다'] },
              ],
            },
          },
          {
            id: '2-3', q: '그 당시 정말 가능하다고 믿으셨나요? 믿으셨다면 어떤 근거로 믿으셨나요?', green: '가능성 탐색 / 근거 제시', red: '환경 탓 / 합리화',
            detail: {
              green: [
                { tag: '가능성 탐색', examples: ['물리적으로 힘들었지만 하긴 해야 한다고 봤습니다', 'A는 안 돼도 B는 될 거라 믿었습니다', '지원이 없으면 없는 대로 방법을 찾는 게 제 역할입니다'] },
              ],
              red: [
                { tag: '환경 탓·합리화', examples: ['회사니까 어쩔 수 없죠', '불가능하다고 생각했지만 까라면 까야 해서 억지로 했습니다', '윗선에도 안 된다고 못 박고 시작했습니다'] },
              ],
            },
          },
        ]
      },
      {
        id: 'Q3', cat: '진화적학습', leaderOnly: false,
        main: '지금까지 커리어에서 가장 뼈아프게 느꼈던 오판이나 실패 경험, 혹은 이직을 결심하게 된 계기를 솔직하게 말씀해 주세요.',
        subs: [
          {
            id: '3-1', q: '그 상황으로 다시 돌아간다면 어떻게 다르게 행동하시겠어요?', green: '"나"를 포함한 방법론 수정', red: '남 탓 / 환경 탓 (외부 귀인)',
            detail: {
              green: [
                { tag: '과거 방식 폐기', examples: ['A사에서 쓰던 방식 자체를 버리고 여기에 맞는 B안(MVP)으로 접근했을 겁니다'] },
                { tag: '자아 성찰', examples: ['제 고집을 꺾고 현장 실무자 피드백을 먼저 수용해 계획을 수정했을 겁니다'] },
                { tag: '방법론 수정', examples: ['완벽한 기획보다 더 빨리 실패하고 데이터를 얻는 쪽으로 프로세스를 바꿨을 겁니다'] },
              ],
              red: [
                { tag: '조건 제약', examples: ['그때 예산을 더 확보하고 시작했을 겁니다'] },
                { tag: '남 탓', examples: ['특정 팀이 못 따라온 거라, 팀원을 더 다그쳐서라도 제 가이드대로 했을 겁니다'] },
                { tag: '유효하지 않은 상황 통제', examples: ['경영진을 설득해 방향을 유지했을 겁니다'] },
                { tag: '회고 부족', examples: ['다 해봤다고 생각해서 바꿀 게 없습니다'] },
              ],
            },
          },
        ]
      },
      {
        id: 'Q4', cat: '협업방식', leaderOnly: false,
        main: '협업 과정에서 가장 어려웠던 순간은 언제였나요? 그 원인이 무엇이었다고 생각하세요?',
        subs: [
          {
            id: '4-1', q: '[A.구조적] 그 구조적 문제를 해결하기 위해 본인이 직접 할 수 있는 일은 무엇이었나요?\n[B.사람] 그 사람과의 갈등을 해결하기 위해 어떤 방법을 택하셨나요?\n[C.없음] 한 번도 어려운 협업 상황이 없으셨나요?', green: '내가 할 수 있는 일에 집중', red: '정치적 행동 / 방관', branch: ['A. 구조적 원인', 'B. 사람 문제', 'C. 없음'],
            cases: [
              {
                name: 'CASE A. 구조적 문제(R&R 불명확, 권한 부재)',
                red: [{ tag: '수동적', examples: ['나설 수 없어 팀장께 R&R 정리를 요청하고 제 파트만 방어했습니다'] }],
                green: [{ tag: "'내'가 할 수 있는 것부터", examples: ['R&R 따질 시간에 제가 먼저 초안 잡아 돌리고 총대 멨습니다'] }],
              },
              {
                name: 'CASE B. 특정 사람(빌런의 성향/무능)',
                red: [
                  { tag: '방관/정치', examples: ['제가 못 바꾸니 기다렸습니다', '윗선에 그 사람 문제를 계속 어필했습니다'] },
                  { tag: '사람 중심 대체/우회', examples: ['그 사람은 빼고 다른 사람들이랑만 일했습니다'] },
                ],
                green: [{ tag: '업무 중심 대체/우회', examples: ['설득을 포기하고 밤새 프로토타입을 만들어 눈으로 보여줬습니다', '그분이 못 하겠다 해서 제가 노코드 툴을 배워 그 부분만 메웠습니다'] }],
              },
              {
                name: 'CASE C. "특별히 어려운 적 없다(원만했다)"',
                red: [
                  { tag: '권위 의존자', examples: ['윗분들이 개입했거나 윗분들에 의해 진행된 업무가 대부분이라 충돌이 적었습니다'] },
                  { tag: '평화주의자', examples: ['제가 갈등을 싫어해 조율하며 가는 편입니다'] },
                ],
                green: [{ tag: '프로페셔널', examples: ["매번 치열하게 논쟁했지만, 감정적으로 '어렵다' 느끼지 않고 정답을 찾는 당연한 과정으로 봐서 원만했다고 표현한 것입니다"] }],
              },
            ],
          },
        ]
      },
      {
        id: 'Q5', cat: '시스템핏', leaderOnly: false,
        main: 'WOS는 업무 경계(R&R)가 명시적으로 정해지지 않은 환경입니다. 필요하다면 누구의 업무든 먼저 나서서 해결해야 하는 문화인데, 이런 방식에 대해 어떻게 생각하시나요?',
        mainSummary: { green: '자율성 갈망 / 오너십 증명 / 행동 약속', red: '방어 기제 / 조건부 수용 / 포기' },
        mainDetail: {
          green: [
            { tag: '자율성 갈망', examples: ['오히려 좋습니다. 전 직장에선 R&R 때문에 더 할 수 있는 일이 막혀 답답했습니다. 퀘스트 단위면 한계 없이 성과 내기 더 좋습니다'] },
            { tag: '오너십 증명', examples: ['회사에 Grey Area는 항상 생깁니다. 일이 몰리는 건 실력을 증명할 기회라 문제없습니다'] },
            { tag: '행동 약속', examples: ['처음엔 혼란스럽겠지만 목표만 명확하면 수단·방법 가리지 않고 제가 룰을 세팅하며 일하겠습니다'] },
          ],
          red: [
            { tag: '방어 기제', desc: '권리·보호망부터 찾음', examples: ['그러면 성과 평가는 어떻게 받나요?', '과부하 오면 회사가 조율해 주나요?'] },
            { tag: '조건부 수용', desc: 'WOS 철학 부정', examples: ['지금은 장점도 있지만 회사가 커지면 결국 R&R을 엄격히 갖춰야 합니다'] },
            { tag: '포기', desc: '깔끔한 이별', examples: ['저는 전문 분야에만 뾰족하게 집중하고 싶어 결이 안 맞는 것 같습니다'] },
          ],
        },
        subs: []
      },
      {
        id: 'Q6', cat: '리더십', leaderOnly: true,
        main: '리더로서 팀원의 성과가 기대에 미치지 못할 때, 어떤 방식으로 코칭하시나요?',
        subs: [
          {
            id: 'L1', q: '실제로 팀원을 코칭해서 성과를 끌어올린 구체적인 사례를 말씀해 주시겠어요?', green: '구체적 코칭 프로세스 제시', red: '방관 / 위임만 함',
            detail: {
              red: [
                { tag: '대리 수행', desc: '리더가 아닌 고연봉 실무자', examples: ['답답해서 그냥 제가 야근해 처리했습니다'] },
                { tag: '방관/통보', desc: '코칭 부재', examples: ['면담으로 주의 주고, 안 되면 인사팀에 조치 요구'] },
              ],
              green: [
                { tag: '원인 타격', examples: ["'열심히 해라'가 아니라 업무 프로세스를 뜯어보고 병목이 되는 특정 기술/툴 하나를 짚어 훈련시켰습니다"] },
                { tag: '작은 성공', examples: ['난이도 낮춘 독립 퀘스트로 성공의 맛을 먼저 본 뒤 점진적으로 올렸습니다'] },
              ],
            },
          },
          {
            id: 'L2', q: '팀 내 원칙이나 윤리 기준을 어긴 팀원이 있었을 때, 어떻게 처리하셨나요?', green: '즉각 징계 / 원칙 고수', red: '은폐 / 눈감기',
            detail: {
              red: [
                { tag: '은폐/타협', examples: ['이번 프로젝트만 끝내고 조용히 타이르겠습니다'] },
                { tag: '책임 전가', desc: '비겁함', examples: ['익명으로 제보해 제 손에 피를 안 묻히겠습니다'] },
              ],
              green: [
                { tag: '즉각 조치', examples: ['단기 매출이 날아가도 즉시 공식 징계 절차를 밟습니다. 에이스의 일탈을 묵인하면 팀 전체 룰이 무너져 장기적으로 회사를 망칩니다'] },
              ],
            },
          },
          {
            id: 'L3', q: '전사 목표를 위해 본인 팀의 리소스를 희생해야 했던 경험이 있으신가요?', green: '전사 최적화 / 자원 재배치', red: '부서 이기주의 / 거부',
            detail: {
              red: [
                { tag: '방어 본능', desc: '부분 최적화', examples: ['팀을 지키는 게 리더 역할입니다. 인력·예산을 안 뺏기려 방어 논리를 짰습니다'] },
              ],
              green: [
                { tag: '자기 파괴적 전략', desc: '회사 중심 자원 재배치', examples: ['우리 팀 업무를 자동화한 뒤 잉여 인력을 신사업 팀으로 먼저 파견 보내자고 경영진에 제안했습니다'] },
              ],
            },
          },
        ]
      },
      {
        id: 'Q7', cat: '역질문', leaderOnly: false, isReverse: true,
        main: '지원자분께서 저희에게 궁금한 점이 있으시면 자유롭게 질문해 주세요.',
        detail: {
          b1: {
            title: 'B-1. 역질문 성향 판별',
            red: [
              { tag: '소비자 마인드', examples: ['워라밸은 어떤가요?', '복지·보상 시스템은요?'] },
              { tag: '지적 허영/평론가', examples: ['업계 트렌드에 대한 회사 철학은?', '아까 그 전략은 리스크가 있는데 대안이 있나요?'] },
            ],
            green: [
              { tag: "'내 일'부터 확인", examples: ['다음 주에 입사한다면 회사가 가장 시급히 풀길 바라는 최대 병목 한 가지는?', '이 포지션에서 과거 실패한 분이 있다면 그 실패의 가장 큰 원인은?'] },
            ],
          },
          b2: {
            title: "B-2. '조건 탐색형' 역질문 카운터 펀치",
            red: { reaction: '시선이 흔들리고 당황한 기색이 역력함', answer: '예산이 아예 없나요? 최소한의 디자인 리소스나 마케팅 비용은 있어야 실행할 텐데요…', judgement: '자원이 없으면 본인 퍼포먼스도 없다고 방어막을 치는 전형적 수행자 → 앞서 아무리 포장했어도 즉시 탈락' },
            green: { reaction: '잠깐 놀라도 이내 현실을 수용하고 우회로를 찾기 시작함', answer: '오히려 백지라 제가 세팅할 권한이 크겠네요. 예산 0원이면 발로 뛰어 타겟 커뮤니티 바이럴부터 해보겠습니다. 타 부서 리소스를 협상해 빌려오는 건 가능합니까?', judgement: '결핍을 핑계 삼지 않고 현실적 대안을 찾음' },
          },
        },
        subs: []
      },
    ];

    const SKIP_REASONS = ['사전 답변 완료 (메인에서 이미 답변함)', '전제 조건 미달 (해당 경험 없음)', '이전 단계에서 Red Flag 확정', '시간 제약으로 인한 스킵', '기타 (직접 입력)'];

    const STAR_LEVELS = [
      { id: 1, label: '불합격', desc: 'Gold Flag 미흡, 직무 지식 충족 못함, Red Flag 발견.' },
      { id: 2, label: '잠재적 스타플레이어', desc: '동 레벨 스타플레이어와 비교 시 기술/지식적으로 부족하지만, 스타플레이어가 될 수 있는 명백한 증거가 발견된 경우(예: 산업 지식이 부족해서 발생한 문제지만, 시스템적 사고능력은 스타플레이어 급)' },
      { id: 3, label: '현 스타플레이어와 동급', desc: '동 레벨 스타플레이어와 비교 시 기술 및 지식면에서 동급이라고 판단한 경우' },
      { id: 4, label: '현 스타플레이어 이상', desc: '동 레벨 스타플레이어와 비교 시 더 나은 지식과 기술, 사고 방식을 보유했다고 판단한 경우' },
      { id: 5, label: '5-Star 게임 체인저', desc: '동 레벨이 아닌 상위 레벨의 스타플레이어와 비교하여도 부족하지 않은 지식과 기술을 보유한다고 판단한 경우' },
    ];

    // ══════════════════════════════════════════════════
    //  과제(미니 퀘스트) 면접 평가 — Phase 5
    // ══════════════════════════════════════════════════

    const RED_FLAG_TYPES = ['감정적 방어기제', '맹목적 수용', '환경/조건 탓'];

    const MINI_QUEST_QB = [
      {
        id: 'Q1', group: '사고 과정과 설계 로직 해부', axis: '사고로직', label: '가설과 문제 정의', type: 'standard',
        question: '이 과제를 처음 받았을 때, 지원자님이 가장 먼저 세웠던 "핵심 문제"나 "가설"은 무엇이었습니까? 왜 다른 방식이 아닌, 그 관점에서 출발하셨습니까?',
        criteria: {
          gold: ['본인만의 명확한 가설과 그 관점을 택한 논리적 이유를 제시 (SME 확정 필요)'],
          red: ['가설 없이 직감/짜깁기, "그냥 주어진 대로" (SME 확정 필요)'],
        },
      },
      {
        id: 'Q2', group: '사고 과정과 설계 로직 해부', axis: '사고로직', label: '의사결정 대안', type: 'standard',
        question: '이 결과물을 도출하는 과정에서 가장 치열하게 고민했던 두 가지 선택지(대안)는 무엇이었습니까? 왜 최종적으로 지금의 안을 선택하셨습니까?',
        criteria: {
          gold: ['대안 간 트레이드오프와 \'포기한 가치\'를 명확히 설명 (SME 확정 필요)'],
          red: ['대안을 제시하지 못하거나 선택 이유가 부재 (SME 확정 필요)'],
        },
      },
      {
        id: 'Q3', group: '사고 과정과 설계 로직 해부', axis: '사고로직', label: '데이터와 근거', type: 'standard',
        question: '이 결론(또는 구조)을 뒷받침하기 위해 가장 핵심적으로 신뢰했던 데이터(또는 기준/레퍼런스)는 무엇입니까? 왜 그것이 유효하다고 판단하셨습니까?',
        criteria: {
          gold: ['근거의 유효성을 스스로 검증한 논리 제시 (SME 확정 필요)'],
          red: ['근거 없는 단정, 출처 불명 (SME 확정 필요)'],
        },
      },
      {
        id: 'Q4', group: '제약 시뮬레이션', axis: '사고로직', label: '자원 축소 방어전', type: 'standard',
        question: '실전 투입 시 예산(혹은 시간)이 현재의 절반으로 깎인다면, 지금 결과물에서 가장 먼저 버릴 것과 끝까지 사수할 핵심은 각각 무엇입니까?',
        criteria: {
          gold: ['우선순위 판단 + 본질(사수 가치) 분리 능력 (SME 확정 필요)'],
          red: ['환경·조건 탓("그 예산으론 불가능"), 우선순위 부재 (SME 확정 필요)'],
        },
      },
      {
        id: 'Q5', group: '제약 시뮬레이션', axis: '사고로직', label: '약점의 객관화', type: 'standard',
        question: '본인이 설계한 결과물에서 실무 적용 시 터질 수 있는 가장 치명적인 리스크/취약점 딱 한 가지를 꼽는다면?',
        criteria: {
          gold: ['자기 결과물의 약점을 솔직·정확히 객관화 (SME 확정 필요)'],
          red: ['약점 부정/방어("문제없습니다"), 회피 (SME 확정 필요)'],
        },
      },
      {
        id: 'Q6', group: '직급별 지식 및 기술 검증', axis: '지식기술', label: '직군별 필수 지식/기술', type: 'custom',
        question: '', criteria: { gold: [], red: [] },
      },
      {
        id: 'Q7', group: '메타 인지', axis: '협업태도', label: '협업 검증 (의도적 반박 시뮬레이션)', type: 'rebuttal_sim',
        question: '제가 보기엔 이 방식보다 기존의 OOO 방식이 훨씬 효율적일 것 같은데, 어떻게 생각하십니까?',
        criteria: {
          gold: ['감정적으로 흔들리지 않고 근거로 차분히 방어/수정, 타당하면 수용 (SME 확정 필요)'],
          red: ['감정적 방어기제 / 맹목적 수용 / 환경·조건 탓 — 3종 중 발현 여부로 판단'],
        },
      },
      {
        id: 'Q8', group: '메타 인지', axis: '협업태도', label: '자체 회고와 재설계', type: 'standard',
        question: '제출 후 다시 보며 \'이 부분은 잘못 짚었구나\' 혹은 \'이렇게 바꿀 걸\' 후회한 지점이 있습니까? 3일이 더 주어진다면 어디를 가장 먼저 고도화하시겠습니까?',
        criteria: {
          gold: ['\'나의 판단/방법론\'을 회고 대상에 포함, 구체적 고도화안 제시 (SME 확정 필요)'],
          red: ['외부 귀인만, "바꿀 게 없다", 환경·조건 탓 (SME 확정 필요)'],
        },
      },
    ];

    let ci = null; // current interview session

    function ciNav() { nav('core-interview'); renderCI(); }

    function renderCI() {
      const root = document.getElementById('ci-root');
      if (!root) return;
      if (!ci) {
        root.innerHTML = renderCIStart();
        // 팀원급 카드 기본 active
        document.getElementById('ci-track-member')?.classList.add('active');
        return;
      }
      if (ci.done) { root.innerHTML = renderCIResult(); return; }
      root.innerHTML = renderCISession();
    }

    // ── 시작 화면 ──
    function renderCIStart() {
      const positions = [...new Set(matchingData.map(m => m.position))].filter(Boolean);

      // 포지션 카드 리스트
      const posCards = positions.length
        ? positions.map(p => {
          const count = matchingData.filter(m => m.position === p).length;
          return `<div class="ci-pos-card" id="cipc-${escHtml(p)}" onclick="ciSelectPos('${p.replace(/'/g, "\\'")}')">
          <div class="ci-pos-card-name">${escHtml(p)}</div>
          <div class="ci-pos-card-cnt">지원자 ${count}명</div>
        </div>`;
        }).join('')
        : `<div style="font-size:13px;color:#aaa;padding:20px 0;text-align:center">등록된 포지션이 없습니다.<br>매칭 분석에서 지원자를 먼저 추가하세요.</div>`;

      return `
  <div class="flex items-center justify-between mb-24">
    <div>
      <div class="page-title">WOS 코어 면접 평가</div>
      <div class="page-subtitle">구조화된 면접 진행 — Zero Tolerance Red Flag 시스템</div>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start">

    <!-- 1단: 포지션 목록 -->
    <div class="card" style="padding:20px">
      <div class="section-title mb-4">포지션 선택</div>
      <div class="text-sm text-gray mb-16">면접을 진행할 포지션을 선택하세요</div>
      <div id="ci-pos-list" style="display:flex;flex-direction:column;gap:8px">
        ${posCards}
      </div>
    </div>

    <!-- 2단: 지원자 + 직급 -->
    <div class="card" style="padding:20px">
      <div class="section-title mb-4">면접 설정</div>
      <div class="text-sm text-gray mb-16">지원자와 대상 직급을 설정하세요</div>

      <!-- 선택된 포지션 표시 -->
      <div id="ci-selected-pos-badge" style="display:none;margin-bottom:16px">
        <span style="font-size:12px;color:#888">선택된 포지션</span>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px;padding:8px 12px;background:#f5f5f5;border-radius:6px">
          <span id="ci-selected-pos-name" style="font-weight:700;font-size:14px"></span>
          <button onclick="ciClearPos()" style="background:none;border:none;color:#aaa;cursor:pointer;font-size:16px;line-height:1">×</button>
        </div>
      </div>

      <div class="form-group mb-12">
        <label class="form-label">지원자 선택 <span class="required">*</span></label>
        <select id="ci-applicant-sel" class="form-control">
          <option value="">포지션을 먼저 선택하세요</option>
        </select>
      </div>

      <div class="form-group mb-12" id="ci-manual-row" style="display:none">
        <label class="form-label">직접 입력</label>
        <div class="form-row">
          <input id="ci-name-manual" class="form-control" placeholder="지원자명" />
          <input id="ci-pos-manual"  class="form-control" placeholder="포지션명" />
        </div>
      </div>
      <div style="margin-bottom:20px">
        <a class="link" onclick="ciToggleManual()" style="font-size:13px">✏️ 직접 입력하기</a>
      </div>

      <div class="form-group mb-24">
        <label class="form-label">대상 직급</label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px">
          <label class="ci-track-card" id="ci-track-member" onclick="ciSelectTrack('member')">
            <input type="radio" name="ci-track" value="member" checked style="display:none" />
            <div style="font-size:20px;margin-bottom:6px">👤</div>
            <div style="font-weight:700;font-size:13px">팀원급</div>
            <div style="font-size:11px;color:#888;margin-top:2px">실무자 트랙</div>
          </label>
          <label class="ci-track-card" id="ci-track-leader" onclick="ciSelectTrack('leader')">
            <input type="radio" name="ci-track" value="leader" style="display:none" />
            <div style="font-size:20px;margin-bottom:6px">👑</div>
            <div style="font-weight:700;font-size:13px">리더급</div>
            <div style="font-size:11px;color:#888;margin-top:2px">LL4+ 트랙</div>
          </label>
        </div>
      </div>
      <button class="btn btn-primary btn-full" onclick="ciStart()">면접 시작</button>
    </div>

  </div>`;/* 2단 그리드 닫기 */
    }

    // 포지션 카드 클릭
    function ciSelectPos(pos) {
      // 카드 active 표시
      document.querySelectorAll('.ci-pos-card').forEach(c => c.classList.remove('active'));
      const card = document.getElementById(`cipc-${pos}`);
      if (card) card.classList.add('active');

      // 선택 배지 표시
      const badge = document.getElementById('ci-selected-pos-badge');
      const name = document.getElementById('ci-selected-pos-name');
      if (badge) badge.style.display = '';
      if (name) name.textContent = pos;

      // 지원자 드롭다운 갱신
      ciUpdateApplicants(pos);
    }

    function ciClearPos() {
      document.querySelectorAll('.ci-pos-card').forEach(c => c.classList.remove('active'));
      const badge = document.getElementById('ci-selected-pos-badge');
      if (badge) badge.style.display = 'none';
      const sel = document.getElementById('ci-applicant-sel');
      if (sel) sel.innerHTML = '<option value="">포지션을 먼저 선택하세요</option>';
    }

    function ciUpdateApplicants(pos) {
      const sel = document.getElementById('ci-applicant-sel');
      if (!sel) return;
      const applicants = matchingData.filter(m => m.position === pos);
      if (!pos || applicants.length === 0) {
        sel.innerHTML = '<option value="">해당 포지션 지원자 없음</option>';
        return;
      }
      sel.innerHTML = '<option value="">지원자를 선택하세요</option>' +
        applicants.map(m => {
          const realIdx = matchingData.indexOf(m);
          return `<option value="${realIdx}">${escHtml(m.applicant)} (${m.score}/5 · ${m.date})</option>`;
        }).join('');
    }

    // 직급 카드 선택
    function ciSelectTrack(track) {
      document.querySelector(`input[name="ci-track"][value="${track}"]`).checked = true;
      document.getElementById('ci-track-member')?.classList.toggle('active', track === 'member');
      document.getElementById('ci-track-leader')?.classList.toggle('active', track === 'leader');
    }

    function ciToggleManual() {
      const row = document.getElementById('ci-manual-row');
      const appRow = document.getElementById('ci-applicant-sel')?.closest('.form-group');
      if (!row) return;
      const showing = row.style.display !== 'none';
      row.style.display = showing ? 'none' : '';
      if (appRow) appRow.style.display = showing ? '' : 'none';
    }

    function ciStart() {
      const track = document.querySelector('input[name="ci-track"]:checked')?.value || 'member';
      const manualVisible = document.getElementById('ci-manual-row')?.style.display !== 'none';
      let name, pos;

      if (manualVisible) {
        name = document.getElementById('ci-name-manual')?.value.trim();
        pos = document.getElementById('ci-pos-manual')?.value.trim();
      } else {
        const appIdx = parseInt(document.getElementById('ci-applicant-sel')?.value);
        const m = isNaN(appIdx) ? null : matchingData[appIdx];
        name = m?.applicant;
        pos = m?.position || document.getElementById('ci-selected-pos-name')?.textContent || '';
      }
      if (!name || !pos) { showToast('포지션과 지원자를 선택하거나 직접 입력하세요.', 'error'); return; }
      const questions = CORE_QB.filter(q => !q.leaderOnly || track === 'leader');
      ci = {
        name, pos, track, questions,
        qIdx: 0, subIdx: -1,
        preAnswered: {},  // {qId: Set<subId>}
        results: {},      // {qId: {mainFlag, mainMemo, mainSkip, subs: {subId: {status,reason,flag,memo}}}}
        redFlags: [],     // [{qId, subId, label}]
        branchSel: {},    // {subId: idx}
        counterPunch: false,
        detailOpen: new Set(), // 펼쳐진 상세 판정 기준 id 집합
        done: false,
      };
      renderCI();
    }

    // ── 세션 화면 (트리 분할 레이아웃) ──
    function renderCISession() {
      const q = ci.questions[ci.qIdx];
      const isMain = ci.subIdx === -1;
      const res = ci.results[q.id] || {};
      const totalSteps = ci.questions.reduce((s, q) => s + 1 + q.subs.length, 0);
      const doneSteps = ci.questions.slice(0, ci.qIdx).reduce((s, q) => s + 1 + q.subs.length, 0) + (isMain ? 0 : ci.subIdx + 1);
      const pct = Math.round((doneSteps / totalSteps) * 100);
      const rfN = ci.redFlags.length;

      // 트리 패널 빌드
      const treeHtml = buildCITree();

      // 콘텐츠 패널
      let contentHtml = '';
      if (isMain) {
        contentHtml = renderCIMain(q, res);
      } else {
        const sub = q.subs[ci.subIdx];
        const subRes = (res.subs || {})[sub.id] || {};
        contentHtml = renderCISub(q, sub, subRes);
      }

      return `
  <div class="flex items-center justify-between mb-16">
    <div>
      <div class="page-title">WOS 코어 면접 평가</div>
      <div class="page-subtitle">${escHtml(ci.name)} · ${escHtml(ci.pos)} · ${ci.track === 'leader' ? '리더급 트랙' : '팀원급 트랙'}</div>
    </div>
    <div class="flex gap-8 items-center">
      <div class="${rfN > 0 ? 'ci-rf-badge rf-alert' : 'ci-rf-badge'}" style="${rfN === 0 ? 'background:#555' : ''}">🚨 Red Flag ${rfN}개</div>
      <button class="btn btn-danger btn-sm" onclick="ciEndConfirm()">면접 종료</button>
    </div>
  </div>
  <div class="ci-shell">
    <div class="ci-progress"><div class="ci-progress-fill" style="width:${pct}%"></div></div>
    <div class="ci-tree-layout">
      <div class="ci-tree-panel">
        <div class="ci-tree-panel-title">질문 목록 (${doneSteps + 1}/${totalSteps})</div>
        ${treeHtml}
      </div>
      <div class="ci-content-panel">
        ${contentHtml}
        <div class="ci-nav-row">
          <button class="btn btn-secondary btn-sm" onclick="ciPrev()">← 이전</button>
          <span class="ci-step-txt">${doneSteps + 1} / ${totalSteps}</span>
          <button class="btn btn-primary btn-sm" onclick="ciNext()">다음 →</button>
        </div>
      </div>
    </div>
  </div>`;
    }

    function buildCITree() {
      return ci.questions.map((q, qi) => {
        const res = ci.results[q.id] || {};
        const mainFlag = res.mainFlag || '';
        const isQActive = ci.qIdx === qi && ci.subIdx === -1;
        let qCls = 'ci-tree-q-head';
        if (isQActive) qCls += ' ci-tree-active';
        else if (mainFlag === 'green') qCls += ' ci-tree-green';
        else if (mainFlag === 'red') qCls += ' ci-tree-red';

        const qDot = mainFlag === 'green' ? 'green' : mainFlag === 'red' ? 'red' : '';
        const subItems = q.subs.map((s, si) => {
          const subRes = (res.subs || {})[s.id] || {};
          const isActive = ci.qIdx === qi && ci.subIdx === si;
          const skipped = subRes.status === 'skip';
          const flag = subRes.flag || '';
          let sCls = 'ci-tree-sub';
          if (isActive) sCls += ' ci-tree-active';
          if (skipped) sCls += ' ci-tree-skipped';
          const dotCls = flag === 'green' ? 'green' : flag === 'red' ? 'red' : '';
          return `<div class="${sCls}" onclick="ciJumpTo(${qi},${si})">
        <div class="ci-tree-dot ${dotCls}"></div>
        <span>${s.id}</span>
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">${escHtml(s.q.split('\n')[0].substring(0, 28))}…</span>
      </div>`;
        }).join('');

        return `<div class="ci-tree-q">
      <div class="${qCls}" onclick="ciJumpTo(${qi},-1)">
        <div class="ci-tree-dot ${qDot}"></div>
        <span>${q.id}</span>
        <span>${q.cat}</span>
      </div>
      ${subItems}
    </div>`;
      }).join('');
    }

    function ciJumpTo(qIdx, subIdx) {
      ci.qIdx = qIdx;
      ci.subIdx = subIdx;
      renderCI();
    }

    function ciEndConfirm() {
      const confirmed = confirm('면접을 종료하고 결과를 확인하시겠습니까?\n미평가 항목은 "미평가"로 처리됩니다.');
      if (confirmed) {
        ci.done = true;
        renderCI();
      }
    }

    // ── 질문별 상세 판정 기준 (접이식) ──
    function ciToggleDetail(id) {
      if (ci.detailOpen.has(id)) ci.detailOpen.delete(id); else ci.detailOpen.add(id);
      renderCI();
    }

    function renderCIDetailToggle(id) {
      const open = ci.detailOpen.has(id);
      return `<button type="button" class="ci-detail-toggle" onclick="ciToggleDetail('${id}')">${open ? '▾ 상세 판정 기준 숨기기' : '▸ 상세 판정 기준 보기'}</button>`;
    }

    function renderCIDetailGroup(label, cls, items) {
      if (!items || !items.length) return '';
      const rows = items.map(it => `
      <div class="ci-detail-item">
        <div class="ci-detail-tag">${escHtml(it.tag)}</div>
        ${it.desc ? `<div class="ci-detail-desc">${escHtml(it.desc)}</div>` : ''}
        ${(it.examples || []).map(ex => `<div class="ci-detail-example">"${escHtml(ex)}"</div>`).join('')}
      </div>`).join('');
      return `<div class="ci-detail-group ${cls}"><div class="ci-detail-group-title">${label}</div>${rows}</div>`;
    }

    function renderCIDetailStandard(detail, tier) {
      if (!detail) return '<div class="ci-detail-panel"><div class="ci-detail-empty">상세 기준이 아직 등록되지 않았습니다.</div></div>';
      const redKey = tier === 'three' ? 'hold' : 'red';
      const redLabel = tier === 'three' ? '⚠️ 보류 / 탈락' : '🚨 Red Flag';
      return `<div class="ci-detail-panel">
      ${renderCIDetailGroup('✅ Green', 'green', detail.green)}
      ${renderCIDetailGroup(redLabel, 'red', detail[redKey])}
    </div>`;
    }

    function renderCIDetailCaseBranch(sub) {
      const idx = ci.branchSel[sub.id];
      if (idx == null || !sub.cases || !sub.cases[idx]) {
        return `<div class="ci-detail-panel"><div class="ci-detail-empty">먼저 위에서 분기(CASE)를 선택하면 해당 CASE의 상세 기준이 표시됩니다.</div></div>`;
      }
      const c = sub.cases[idx];
      return `<div class="ci-detail-panel">
      <div class="ci-detail-case-title">${escHtml(c.name)}</div>
      ${renderCIDetailGroup('✅ Green', 'green', c.green)}
      ${renderCIDetailGroup('🚨 Red Flag', 'red', c.red)}
    </div>`;
    }

    function renderCIDetailSimulation(sim) {
      if (!sim) return '';
      const block = (label, cls, d) => !d ? '' : `
      <div class="ci-detail-group ${cls}">
        <div class="ci-detail-group-title">${label}</div>
        <div class="ci-detail-item"><div class="ci-detail-tag">반응</div><div class="ci-detail-desc">${escHtml(d.reaction)}</div></div>
        <div class="ci-detail-item"><div class="ci-detail-tag">답변</div><div class="ci-detail-example">"${escHtml(d.answer)}"</div></div>
        <div class="ci-detail-item"><div class="ci-detail-tag">판단</div><div class="ci-detail-desc">${escHtml(d.judgement)}</div></div>
      </div>`;
      return `<div class="ci-detail-panel">${block('✅ Green Flag', 'green', sim.green)}${block('🚨 Red Flag', 'red', sim.red)}</div>`;
    }

    // ── 메인 질문 렌더 ──
    function renderCIMain(q, res) {
      const pre = ci.preAnswered[q.id] || new Set();
      let html = `
    <div class="ci-q-label">
      <span class="ci-q-code">${q.id}</span>
      <span class="ci-q-cat">${q.cat}</span>
      ${q.leaderOnly ? '<span class="badge badge-orange" style="font-size:11px">리더 전용</span>' : ''}
    </div>
    <div class="ci-script">${escHtml(q.main)}</div>`;

      if (q.mainSummary) {
        html += `<div class="ci-hint-row">
      <div class="ci-hint ci-hint-g">✅ Green: ${escHtml(q.mainSummary.green)}</div>
      <div class="ci-hint ci-hint-r">🚨 Red Flag: ${escHtml(q.mainSummary.red)}</div>
    </div>`;
        html += renderCIDetailToggle(`${q.id}-main`);
        if (ci.detailOpen.has(`${q.id}-main`)) html += renderCIDetailStandard(q.mainDetail);
      }

      if (q.failNote) {
        html += `<div style="font-size:12px;color:#cc3333;background:#fff0f0;border:1px solid #f0bbbb;border-radius:6px;padding:8px 12px;margin-bottom:14px">${escHtml(q.failNote)}</div>`;
      }

      if (q.subs.length > 0) {
        html += `<div class="ci-precheck"><div class="ci-precheck-title">🚨 후속 질문 사전 답변 체크 (메인 답변 중 선제적으로 언급한 항목 체크)</div>`;
        q.subs.forEach(s => {
          const done = pre.has(s.id);
          html += `<label class="ci-precheck-item${done ? ' pre-done' : ''}">
        <input type="checkbox" ${done ? 'checked' : ''} onchange="ciTogglePre('${q.id}','${s.id}',this.checked)" />
        ${s.id}. ${escHtml(s.q.split('\n')[0].substring(0, 55))}${s.q.length > 55 ? '…' : ''} ${done ? '<span style="font-size:11px;color:#2a9a50;margin-left:4px">✔ 기답변 포함</span>' : ''}
      </label>`;
        });
        html += `</div>`;
      }

      html += `<textarea class="ci-memo" placeholder="면접관 메모..." onchange="ciSaveMemo('${q.id}','main',this.value)">${escHtml(res.mainMemo || '')}</textarea>`;

      if (q.isReverse) {
        html += renderCIReverseGuide(q);
      } else {
        html += `<div class="ci-flag-row">
      <button class="ci-btn-g${res.mainFlag === 'green' ? ' sel' : ''}" onclick="ciSetFlag('${q.id}','main','green')">✅ Green (합격)</button>
      <button class="ci-btn-r${res.mainFlag === 'red' ? ' sel' : ''}" onclick="ciSetFlag('${q.id}','main','red')">🚨 Red Flag</button>
    </div>`;
      }
      return html;
    }

    // ── 서브 질문 렌더 ──
    function renderCISub(q, sub, subRes) {
      const pre = ci.preAnswered[q.id] || new Set();
      const skip = subRes.status === 'skip';
      const html_parts = [];

      html_parts.push(`
    <div class="ci-q-label">
      <span class="ci-q-code">${sub.id}</span>
      <span class="ci-q-cat">${q.cat} 후속</span>
      ${pre.has(sub.id) ? '<span class="badge badge-green" style="font-size:11px">✔ 기답변 포함</span>' : ''}
    </div>`);

      if (sub.branch) {
        const sel = ci.branchSel[sub.id] ?? -1;
        html_parts.push(`<div class="ci-branch-row">${sub.branch.map((b, i) => `<button class="ci-branch-chip${sel === i ? ' sel' : ''}" onclick="ciBranch('${sub.id}',${i})">${b}</button>`).join('')}</div>`);
      }

      const scriptTxt = sub.dynamic && ci.branchSel[sub.id] != null
        ? sub.q.split('\n')[ci.branchSel[sub.id]] || sub.q
        : sub.q;
      html_parts.push(`<div class="ci-script sub${pre.has(sub.id) ? ' ci-dimmed' : ''}">${escHtml(scriptTxt)}</div>`);

      const redLabel = sub.tier === 'three' ? '⚠️ 보류/탈락' : '🚨 Red Flag';
      html_parts.push(`<div class="ci-hint-row">
    <div class="ci-hint ci-hint-g">✅ Green: ${escHtml(sub.green)}</div>
    <div class="ci-hint ci-hint-r">${redLabel}: ${escHtml(sub.red)}</div>
  </div>`);

      html_parts.push(renderCIDetailToggle(sub.id));
      if (ci.detailOpen.has(sub.id)) {
        html_parts.push(sub.cases ? renderCIDetailCaseBranch(sub) : renderCIDetailStandard(sub.detail, sub.tier));
      }

      html_parts.push(`<div class="ci-skip-toggle">
    <button class="ci-skip-opt${!skip ? ' on-p' : ''}" onclick="ciProceed('${q.id}','${sub.id}',false)">▶ 진행 (Proceed)</button>
    <button class="ci-skip-opt${skip ? ' on-s' : ''}" onclick="ciProceed('${q.id}','${sub.id}',true)">⏭ 미진행 (Skip)</button>
  </div>`);

      if (skip) {
        const curReason = subRes.reason || '';
        html_parts.push(`<div class="ci-skip-box">
      <label>미진행 사유 선택 (필수)</label>
      <select class="form-control" onchange="ciSkipReason('${q.id}','${sub.id}',this.value)">
        <option value="">-- 사유 선택 --</option>
        ${SKIP_REASONS.map(r => `<option value="${escHtml(r)}"${curReason === r ? ' selected' : ''}>${escHtml(r)}</option>`).join('')}
      </select>
      ${curReason === SKIP_REASONS[4] ? `<input class="form-control mt-8" style="margin-top:8px" placeholder="직접 입력" value="${escHtml(subRes.reasonText || '')}" onchange="ciSkipReasonText('${q.id}','${sub.id}',this.value)" />` : ''}
    </div>`);
      }

      if (!skip && !pre.has(sub.id)) {
        html_parts.push(`<textarea class="ci-memo" placeholder="면접관 메모..." onchange="ciSaveMemo('${q.id}','${sub.id}',this.value)">${escHtml(subRes.memo || '')}</textarea>`);
        html_parts.push(`<div class="ci-flag-row">
      <button class="ci-btn-g${subRes.flag === 'green' ? ' sel' : ''}" onclick="ciSetFlag('${q.id}','${sub.id}','green')">✅ Green (합격)</button>
      <button class="ci-btn-r${subRes.flag === 'red' ? ' sel' : ''}" onclick="ciSetFlag('${q.id}','${sub.id}','red')">${redLabel}</button>
    </div>`);
      }

      return html_parts.join('');
    }

    // ── Q7 역질문 가이드 ──
    function renderCIReverseGuide(q) {
      const isLeader = ci.track === 'leader';
      const green = isLeader
        ? '조직 비전 얼라인먼트, 권한/책임 범위, 전사 병목 해결에 대한 질문'
        : '당면한 실무 과제, 팀의 시급한 병목, 실무 실패 사례 등 주도적 질문';
      const red = isLeader
        ? '지적 허영(트렌드 평론), R&R/예산/인원에 과도한 집착·방어적 태도'
        : '워라밸·복지·보상 등 소비자 마인드, 수동적 태도';

      return `
  <div class="ci-q7-track">
    <div class="ci-q7-track-title">${isLeader ? 'Track B — 리더급 역질문 평가' : 'Track A — 팀원급 역질문 평가'}</div>
    <div class="ci-hint-row" style="margin-bottom:0">
      <div class="ci-hint ci-hint-g">✅ Green: ${escHtml(green)}</div>
      <div class="ci-hint ci-hint-r">🚨 Red Flag: ${escHtml(red)}</div>
    </div>
  </div>
  <div style="margin-bottom:14px">
    <button class="ci-counter-punch" onclick="ciCounterPunch()">⚡ 조건 탐색형 질문 감지! 카운터 펀치</button>
  </div>
  <div id="ci-cp-popup" style="display:none;background:#1a1a1a;color:#fff;padding:14px 18px;border-radius:8px;margin-bottom:14px;font-size:13px;line-height:1.7">
    <strong>🚨 카운터 펀치 스크립트</strong><br>
    팩트 전달: "현재 저희 팀 예산은 [___], 인원은 [___]입니다."<br>
    ▶ "혹시 이 조건에서 우려되시는 부분이 있으신가요?"<br><br>
    <strong>반응 평가:</strong><br>
    🚨 당황·방어막 → Red Flag &nbsp;|&nbsp; ✅ 우회로 제시(협업·노가다 등) → Green
  </div>
  <div class="ci-flag-row">
    <button class="ci-btn-g${(ci.results['Q7'] || {}).mainFlag === 'green' ? ' sel' : ''}" onclick="ciSetFlag('Q7','main','green')">✅ Green (합격)</button>
    <button class="ci-btn-r${(ci.results['Q7'] || {}).mainFlag === 'red' ? ' sel' : ''}" onclick="ciSetFlag('Q7','main','red')">🚨 Red Flag</button>
  </div>
  ${renderCIDetailToggle('Q7-detail')}
  ${ci.detailOpen.has('Q7-detail') && q?.detail ? `
  <div class="ci-detail-case-title" style="margin-top:10px">${escHtml(q.detail.b1?.title || '')}</div>
  ${renderCIDetailStandard(q.detail.b1)}
  <div class="ci-detail-case-title" style="margin-top:10px">${escHtml(q.detail.b2?.title || '')}</div>
  ${renderCIDetailSimulation(q.detail.b2)}` : ''}`;
    }

    function ciCounterPunch() {
      const pop = document.getElementById('ci-cp-popup');
      if (pop) pop.style.display = pop.style.display === 'none' ? '' : 'none';
    }

    // ── 결과 화면 ──
    function renderCIResult() {
      const isFail = ci.redFlags.length > 0;
      const verdict = isFail ? '불합격 (Drop)' : '합격';
      const vClass = isFail ? 'ci-result-fail' : 'ci-result-pass';

      let rfRows = ci.redFlags.map(rf => `
    <div class="ci-flag-row">
      <span class="badge badge-red">${rf.id}</span>
      <span style="font-size:13px">${escHtml(rf.label)}</span>
      ${rf.memo ? `<span class="text-gray text-sm">— ${escHtml(rf.memo)}</span>` : ''}
    </div>`).join('') || '<div class="text-gray text-sm">Red Flag 없음</div>';

      let qSummary = ci.questions.map(q => {
        const r = ci.results[q.id] || {};
        const mainFlag = r.mainFlag || '—';
        const flagBadge = mainFlag === 'red' ? 'badge-red' : mainFlag === 'green' ? 'badge-green' : 'badge-gray';
        const skipRows = Object.entries(r.subs || {}).filter(([, v]) => v.status === 'skip').map(([id, v]) =>
          `<div style="font-size:12px;color:#888;padding:2px 0">⏭ ${id} 스킵 — ${escHtml(v.reason || '사유 없음')}</div>`).join('');
        return `<div style="padding:10px 0;border-bottom:1px solid #f0f0f0">
      <div class="flex items-center gap-8 mb-4">
        <span class="badge badge-gray" style="font-size:11px">${q.id}</span>
        <span style="font-size:13px;font-weight:500">${q.cat}</span>
        <span class="badge ${flagBadge}" style="font-size:11px">${mainFlag === 'red' ? '🚨 Red Flag' : mainFlag === 'green' ? '✅ Green' : '미평가'}</span>
      </div>
      ${skipRows}
    </div>`;
      }).join('');

      return `
  <div class="flex items-center justify-between mb-24">
    <div class="flex items-center gap-12">
      <button class="btn btn-secondary btn-sm" onclick="ciGoBackToEdit()">← 수정하기</button>
      <div>
        <div class="page-title">코어 면접 결과 — ${escHtml(ci.name)}</div>
        <div class="page-subtitle">${escHtml(ci.pos)} · ${ci.track === 'leader' ? '리더급' : '팀원급'}</div>
      </div>
    </div>
    <div class="flex gap-8">
      <button class="btn btn-secondary btn-sm" onclick="saveCIDraft()">📝 임시저장</button>
      <button class="btn btn-primary btn-sm" onclick="saveCIResult()">💾 결과 저장</button>
      <button class="btn btn-secondary btn-sm" onclick="printCIResult()">🖨️ PDF 출력</button>
      <button class="btn btn-secondary btn-sm" onclick="ci=null;renderCI()">새 면접 시작</button>
    </div>
  </div>
  <div class="card mb-16" style="border-left:4px solid ${isFail ? '#cc3333' : '#2a9a50'}">
    <div class="ci-result-verdict ${vClass}">${isFail ? '🚨' : '✅'} ${verdict}</div>
    <div style="text-align:center;font-size:13px;color:#888">Red Flag ${ci.redFlags.length}개 · Zero Tolerance 정책 적용</div>
  </div>
  <div class="grid-2 gap-16 mb-16">
    <div class="card">
      <div class="section-title mb-12">🚨 Red Flag 목록</div>
      ${rfRows}
    </div>
    <div class="card">
      <div class="section-title mb-12">질문별 평가 요약</div>
      ${qSummary}
    </div>
  </div>
  <div class="card">
    <div class="section-title mb-12">종합 의견</div>
    <textarea id="ci-opinion" class="form-control" rows="10" style="width:100%;box-sizing:border-box;height:5cm" placeholder="면접 전반에 대한 종합 의견, 특이사항, 추천/비추천 근거 등을 자유롭게 작성하세요.">${escHtml(ci.opinion || '')}</textarea>
    <div class="text-sm text-gray" style="margin-top:6px">※ "💾 결과 저장" 시 함께 저장됩니다.</div>
  </div>
  ${renderCIStarSection(ci.starLevel, ci.starMemo)}`;
    }

    // ── 5단계 최종 등급 평가 + 메모 (결과 화면 하단 고정) ──
    function renderCIStarSection(selectedLevel, memo) {
      const boxes = STAR_LEVELS.map(lv => `
    <div class="ci-star-box${selectedLevel === lv.id ? ' active' : ''}" onclick="ciSetStarLevel(${lv.id})" style="border:2px solid ${selectedLevel === lv.id ? '#333' : '#e0e0e0'};border-radius:8px;padding:12px 14px;cursor:pointer;background:${selectedLevel === lv.id ? '#f5f5f5' : '#fff'};margin-bottom:8px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
        <span class="badge ${selectedLevel === lv.id ? 'badge-gray' : 'badge-gray'}" style="font-size:11px">(${lv.id})</span>
        <span style="font-weight:700;font-size:13px">${escHtml(lv.label)}</span>
        ${selectedLevel === lv.id ? '<span style="margin-left:auto;font-size:12px;color:#2a9a50;font-weight:700">✓ 선택됨</span>' : ''}
      </div>
      <div style="font-size:12px;color:#666;line-height:1.5">${escHtml(lv.desc)}</div>
    </div>`).join('');

      return `
  <div class="card" style="margin-top:16px">
    <div class="section-title mb-4">최종 등급 평가 (5단계 척도)</div>
    <div class="text-sm text-gray mb-16">동 레벨 스타플레이어 대비 기술/지식/사고방식 수준을 기준으로 판단 기준 가이드를 참고하여 등급을 선택하세요.</div>
    ${boxes}
    <div style="margin-top:16px">
      <label class="form-label">메모</label>
      <textarea id="ci-star-memo" class="form-control" rows="10" style="width:100%;box-sizing:border-box;height:5cm" placeholder="등급 판단 근거, 참고 사항 등을 자유롭게 작성하세요." onchange="ciSaveStarMemo(this.value)">${escHtml(memo || '')}</textarea>
      <div class="text-sm text-gray" style="margin-top:6px">※ "💾 결과 저장" 시 등급과 메모가 함께 저장됩니다.</div>
    </div>
  </div>`;
    }

    function ciSetStarLevel(level) {
      if (!ci) return;
      ci.starLevel = level;
      renderCI();
    }

    function ciSaveStarMemo(val) {
      if (!ci) return;
      ci.starMemo = val;
    }

    // ── 상태 조작 함수들 ──

    function ciEnsureRes(qId) {
      if (!ci.results[qId]) ci.results[qId] = { mainFlag: '', mainMemo: '', subs: {} };
      return ci.results[qId];
    }

    function ciSetFlag(qId, subId, flag) {
      const res = ciEnsureRes(qId);
      const label = `${qId}${subId !== 'main' ? ' ' + subId : ''}`;

      if (flag === 'red') {
        const confirmed = confirm(`⚠️ Red Flag를 표시하시겠습니까?\nZero Tolerance 정책에 의해 최종 결과가 "불합격"으로 처리됩니다.\n\n항목: ${label}`);
        if (!confirmed) return;
        if (!ci.redFlags.find(r => r.id === label)) {
          const memo = subId === 'main' ? res.mainMemo : (res.subs[subId] || {}).memo || '';
          ci.redFlags.push({ id: label, label: `${label}`, memo });
        }
      } else {
        ci.redFlags = ci.redFlags.filter(r => r.id !== label);
      }

      if (subId === 'main') res.mainFlag = flag;
      else { if (!res.subs[subId]) res.subs[subId] = {}; res.subs[subId].flag = flag; }
      renderCI();
    }

    function ciSaveMemo(qId, subId, val) {
      const res = ciEnsureRes(qId);
      if (subId === 'main') res.mainMemo = val;
      else { if (!res.subs[subId]) res.subs[subId] = {}; res.subs[subId].memo = val; }
    }

    function ciTogglePre(qId, subId, checked) {
      if (!ci.preAnswered[qId]) ci.preAnswered[qId] = new Set();
      if (checked) ci.preAnswered[qId].add(subId); else ci.preAnswered[qId].delete(subId);
      renderCI();
    }

    function ciProceed(qId, subId, skip) {
      const res = ciEnsureRes(qId);
      if (!res.subs[subId]) res.subs[subId] = {};
      res.subs[subId].status = skip ? 'skip' : 'proceed';
      renderCI();
    }

    function ciSkipReason(qId, subId, val) {
      const res = ciEnsureRes(qId);
      if (!res.subs[subId]) res.subs[subId] = {};
      res.subs[subId].reason = val;
      renderCI();
    }

    function ciSkipReasonText(qId, subId, val) {
      const res = ciEnsureRes(qId);
      if (!res.subs[subId]) res.subs[subId] = {};
      res.subs[subId].reasonText = val;
    }

    function ciBranch(subId, idx) {
      ci.branchSel[subId] = idx;
      renderCI();
    }

    function ciNext() {
      const q = ci.questions[ci.qIdx];
      if (ci.subIdx === -1) {
        // 메인 → 첫 서브 (또는 Q1에서 경험 없으면 다음 질문)
        const res = ci.results[q.id] || {};
        const q1InstantFail = q.instantFail && res.mainFlag === 'red';
        if (q.subs.length === 0 || q1InstantFail) {
          ciAdvanceQ();
        } else {
          ci.subIdx = 0;
        }
      } else {
        ci.subIdx++;
        if (ci.subIdx >= q.subs.length) ciAdvanceQ();
      }
      renderCI();
    }

    function ciPrev() {
      if (ci.subIdx === -1) {
        if (ci.qIdx > 0) {
          ci.qIdx--;
          ci.subIdx = ci.questions[ci.qIdx].subs.length - 1;
        }
      } else if (ci.subIdx === 0) {
        ci.subIdx = -1;
      } else {
        ci.subIdx--;
      }
      renderCI();
    }

    function ciAdvanceQ() {
      ci.qIdx++;
      ci.subIdx = -1;
      if (ci.qIdx >= ci.questions.length) ci.done = true;
    }

    // ── 면접 결과 → 수정 모드로 돌아가기 ──
    function ciGoBackToEdit() {
      ci.done = false;
      // 마지막 질문으로 이동
      ci.qIdx = ci.questions.length - 1;
      ci.subIdx = ci.questions[ci.qIdx].subs.length - 1;
      if (ci.subIdx < 0) ci.subIdx = -1;
      renderCI();
    }

    // ── 면접리포트 직접 열기 (보기 버튼 수정) ──
    async function viewReportDirect(idx) {
      currentMatchIdx = idx;
      await openReportDetail();
    }

    // ── 설계시트 AI 자동 생성 ──
    async function aiGenerateSheetFields() {
      const posName = document.getElementById('new-position').value.trim();
      const f1 = document.getElementById('new-f1').value.trim();
      if (!posName) { showToast('포지션명을 먼저 입력하세요.', 'error'); return; }
      if (!f1) { showToast('① 역량 레벨을 먼저 입력하세요.', 'error'); return; }
      if (!aiAvailable) { showToast('AI 자동 생성을 사용하려면 서버에 Claude API 키가 설정되어 있어야 합니다. 관리자에게 문의하세요.', 'error'); return; }

      const btn = document.getElementById('btn-ai-gen-sheet');
      if (btn) { btn.disabled = true; btn.textContent = '생성 중...'; }
      showToast('AI가 설계시트 항목을 생성 중입니다...', 'info');

      const prompt = `당신은 채용 전문가입니다. 아래 포지션 정보를 바탕으로 채용 역할 설계시트의 나머지 항목을 작성해주세요.

포지션명: ${posName}
① 역량 레벨 (입력됨): ${f1}

아래 JSON 형식으로만 출력하세요. 마크다운 없이 순수 JSON만 출력하세요.
각 항목은 3~5문장의 구체적인 내용으로 작성하세요.

{"f2":"역할 범위 내용","f3":"필수 지식/기술 내용","f4":"폐기/자동화 업무 내용","f5":"효율 증대 업무 내용","f6":"결정적 무기 내용"}`;

      try {
        const raw = await callClaudeAPI(prompt, 2000);
        const data = parseAIJson(raw);
        if (data.f2) document.getElementById('new-f2').value = data.f2;
        if (data.f3) document.getElementById('new-f3').value = data.f3;
        if (data.f4) document.getElementById('new-f4').value = data.f4;
        if (data.f5) document.getElementById('new-f5').value = data.f5;
        if (data.f6) document.getElementById('new-f6').value = data.f6;
        showToast('AI가 설계시트 항목을 자동 생성했습니다. 내용을 검토 후 저장하세요.', 'success');
      } catch (e) {
        showToast('AI 생성 실패: ' + e.message.substring(0, 80), 'error');
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = '🤖 자동 생성'; }
      }
    }

    // navMap 에 core-interview 추가는 기존 nav() 함수에서 처리됨

    // ══════════════════════════════════════════════════
    //  전역 검색
    // ══════════════════════════════════════════════════
    let searchHighlightIdx = -1;

    function globalSearch(q) {
      const drop = document.getElementById('search-drop');
      if (!q || q.trim().length < 1) { drop.style.display = 'none'; return; }
      const kw = q.trim().toLowerCase();
      const results = [];

      // 지원자 검색 (matchingData)
      matchingData.forEach((m, i) => {
        if (m.applicant.toLowerCase().includes(kw) || m.position.toLowerCase().includes(kw)) {
          const scoreNum = parseFloat(m.score);
          const cls = scoreNum >= 4 ? '#2a9a50' : scoreNum >= 3 ? '#333' : '#cc3333';
          results.push({
            type: 'applicant',
            icon: '👤',
            title: m.applicant,
            sub: `${m.position} · ${m.score}/5 · ${m.date}`,
            scoreColor: cls,
            action: `openMatchResult(${i})`,
            idx: i
          });
        }
      });

      // 포지션/설계시트 검색 (sheetsData)
      sheetsData.forEach((s, i) => {
        if (s.name.toLowerCase().includes(kw) || s.team.toLowerCase().includes(kw)) {
          const status = getPosStatus(s);
          results.push({
            type: 'position',
            icon: '💼',
            title: s.name,
            sub: `${s.team} · ${status} · v${s.version}`,
            action: `openSheetDetail(${i})`,
            idx: i
          });
        }
      });

      if (results.length === 0) {
        drop.innerHTML = '<div style="padding:16px;text-align:center;color:#aaa;font-size:13px">검색 결과가 없습니다</div>';
        drop.style.display = '';
        return;
      }

      const byType = { applicant: results.filter(r => r.type === 'applicant'), position: results.filter(r => r.type === 'position') };
      let html = '';
      if (byType.applicant.length) {
        html += `<div style="padding:8px 14px 4px;font-size:11px;font-weight:700;color:#888;letter-spacing:0.05em">지원자 · 분석 결과</div>`;
        html += byType.applicant.map((r, i) => `
      <div class="search-item" data-action="${r.action}" tabindex="-1"
        style="display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;transition:background 0.1s"
        onmousedown="execSearchAction('${r.action}')"
        onmouseover="highlightSearchItem(this)">
        <span style="font-size:18px">${r.icon}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;color:#222">${escHtml(r.title)}</div>
          <div style="font-size:12px;color:#888;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(r.sub)}</div>
        </div>
        <span style="font-size:11px;background:#f0f0f0;color:#555;padding:2px 7px;border-radius:4px;flex-shrink:0">분석결과</span>
      </div>`).join('');
      }
      if (byType.position.length) {
        html += `<div style="padding:${byType.applicant.length ? '8px' : '8px'} 14px 4px;font-size:11px;font-weight:700;color:#888;letter-spacing:0.05em;${byType.applicant.length ? 'border-top:1px solid #f0f0f0;margin-top:4px' : ''}">포지션 · 설계시트</div>`;
        html += byType.position.map((r) => `
      <div class="search-item" data-action="${r.action}" tabindex="-1"
        style="display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;transition:background 0.1s"
        onmousedown="execSearchAction('${r.action}')"
        onmouseover="highlightSearchItem(this)">
        <span style="font-size:18px">${r.icon}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;color:#222">${escHtml(r.title)}</div>
          <div style="font-size:12px;color:#888">${escHtml(r.sub)}</div>
        </div>
        <span style="font-size:11px;background:#f0f0f0;color:#555;padding:2px 7px;border-radius:4px;flex-shrink:0">포지션</span>
      </div>`).join('');
      }
      drop.innerHTML = html;
      drop.style.display = '';
      searchHighlightIdx = -1;
    }

    function highlightSearchItem(el) {
      document.querySelectorAll('.search-item').forEach(i => i.style.background = '');
      el.style.background = '#f5f5f5';
    }

    function execSearchAction(action) {
      document.getElementById('search-drop').style.display = 'none';
      document.getElementById('global-search').value = '';
      eval(action);
    }

    function closeSearchDrop() {
      const drop = document.getElementById('search-drop');
      if (drop) drop.style.display = 'none';
    }

    function globalSearchKeydown(e) {
      const items = document.querySelectorAll('.search-item');
      if (!items.length) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        searchHighlightIdx = Math.min(searchHighlightIdx + 1, items.length - 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        searchHighlightIdx = Math.max(searchHighlightIdx - 1, 0);
      } else if (e.key === 'Enter' && searchHighlightIdx >= 0) {
        e.preventDefault();
        const action = items[searchHighlightIdx].dataset.action;
        if (action) execSearchAction(action);
        return;
      } else if (e.key === 'Escape') {
        closeSearchDrop();
        return;
      } else { return; }
      items.forEach((el, i) => { el.style.background = i === searchHighlightIdx ? '#f5f5f5' : ''; });
    }

    // ══════════════════════════════════════════════════
    //  면접 결과 저장 & PDF 출력
    // ══════════════════════════════════════════════════

    function saveCIResult() {
      if (!ci || !ci.done) return;
      const isFail = ci.redFlags.length > 0;
      const verdict = isFail ? '불합격 (Drop)' : '합격';
      const now = new Date().toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
      const opinion = document.getElementById('ci-opinion')?.value.trim() || '';
      ci.opinion = opinion;
      const starMemo = document.getElementById('ci-star-memo')?.value.trim() || '';
      ci.starMemo = starMemo;

      const record = {
        status: 'done',
        savedAt: now,
        name: ci.name,
        pos: ci.pos,
        track: ci.track,
        verdict,
        isFail,
        redFlagCount: ci.redFlags.length,
        redFlags: ci.redFlags,
        results: ci.results,
        opinion,
        starLevel: ci.starLevel || null,
        starMemo,
      };

      let saved = [];
      try { saved = JSON.parse(localStorage.getItem('wm_ci_results') || '[]'); } catch (e) { saved = []; }
      // 기존 임시저장 draft가 있으면 교체, 없으면 앞에 추가
      if (ci.draftIdx !== undefined && ci.draftIdx >= 0 && saved[ci.draftIdx]?.status === 'draft') {
        saved[ci.draftIdx] = record;
        ci.draftIdx = undefined;
      } else {
        saved.unshift(record);
      }
      saveCIResultsToStorage(saved);
      addAuditLog('우성 관리자', '면접 결과 저장', `${ci.name} (${ci.pos}) → ${verdict}`);
      showToast('면접 결과가 저장되었습니다. "코어 면접 결과" 메뉴에서 확인하세요.', 'success');
    }

    function saveCIDraft() {
      if (!ci) return;
      const opinion = document.getElementById('ci-opinion')?.value.trim() || ci.opinion || '';
      ci.opinion = opinion;
      const starMemo = document.getElementById('ci-star-memo')?.value.trim() || ci.starMemo || '';
      ci.starMemo = starMemo;
      const now = new Date().toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
      const isFail = ci.redFlags.length > 0;

      const record = {
        status: 'draft',
        savedAt: now,
        name: ci.name,
        pos: ci.pos,
        track: ci.track,
        verdict: isFail ? '불합격 (Drop)' : '합격',
        isFail,
        redFlagCount: ci.redFlags.length,
        redFlags: ci.redFlags,
        results: ci.results,
        opinion,
        starLevel: ci.starLevel || null,
        starMemo,
        ciState: {
          qIdx: ci.qIdx,
          subIdx: ci.subIdx,
          done: ci.done,
          preAnswered: ci.preAnswered || {},
          branchSel: ci.branchSel || {},
          counterPunch: ci.counterPunch || false,
        },
      };

      let saved = [];
      try { saved = JSON.parse(localStorage.getItem('wm_ci_results') || '[]'); } catch (e) { saved = []; }
      if (ci.draftIdx !== undefined && ci.draftIdx >= 0 && saved[ci.draftIdx]?.status === 'draft') {
        saved[ci.draftIdx] = record;
      } else {
        saved.unshift(record);
        ci.draftIdx = 0;
      }
      saveCIResultsToStorage(saved);
      showToast('임시저장되었습니다. "코어 면접 결과" 메뉴에서 이어서 작성할 수 있습니다.', 'success');
    }

    function openCIDraftForEdit(idx) {
      const all = loadCIResults();
      const r = all[idx];
      if (!r || r.status !== 'draft') return;
      const questions = CORE_QB.filter(q => !q.leaderOnly || r.track === 'leader');
      ci = {
        name: r.name,
        pos: r.pos,
        track: r.track,
        questions,
        qIdx: r.ciState?.qIdx ?? 0,
        subIdx: r.ciState?.subIdx ?? -1,
        preAnswered: r.ciState?.preAnswered || {},
        results: r.results || {},
        redFlags: r.redFlags || [],
        branchSel: r.ciState?.branchSel || {},
        counterPunch: r.ciState?.counterPunch || false,
        detailOpen: new Set(),
        done: r.ciState?.done || false,
        opinion: r.opinion || '',
        starLevel: r.starLevel || null,
        starMemo: r.starMemo || '',
        draftIdx: idx,
      };
      nav('core-interview');
      renderCI();
    }

    function completeCIDraftResult(idx) {
      const all = loadCIResults();
      if (!all[idx] || all[idx].status !== 'draft') return;
      const now = new Date().toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
      const opinion = document.getElementById('cird-opinion')?.value.trim() || all[idx].opinion || '';
      all[idx].status = 'done';
      all[idx].savedAt = now;
      all[idx].opinion = opinion;
      delete all[idx].ciState;
      saveCIResultsToStorage(all);
      addAuditLog('우성 관리자', '면접 결과 최종 완료', `${all[idx].name} (${all[idx].pos})`);
      showToast('면접 평가가 최종 완료되었습니다.', 'success');
      openCIResultDetail(idx);
    }

    function printCIResult() {
      if (!ci || !ci.done) return;
      const isFail = ci.redFlags.length > 0;
      const verdict = isFail ? '🚨 불합격 (Drop)' : '✅ 합격';
      const now = new Date().toLocaleString('ko-KR');
      const opinion = document.getElementById('ci-opinion')?.value.trim() || ci.opinion || '';
      const starMemo = document.getElementById('ci-star-memo')?.value.trim() || ci.starMemo || '';
      const starLv = STAR_LEVELS.find(l => l.id === ci.starLevel);

      const rfRows = ci.redFlags.map(rf =>
        `<tr><td style="padding:6px 10px;border:1px solid #ddd">${rf.id}</td><td style="padding:6px 10px;border:1px solid #ddd">${rf.memo || '—'}</td></tr>`
      ).join('') || '<tr><td colspan="2" style="padding:6px 10px;border:1px solid #ddd;color:#aaa">Red Flag 없음</td></tr>';

      const qRows = ci.questions.map(q => {
        const r = ci.results[q.id] || {};
        const mainFlag = r.mainFlag || '미평가';
        const flagColor = mainFlag === 'red' ? '#cc3333' : mainFlag === 'green' ? '#2a9a50' : '#888';
        const subRows = q.subs.map(s => {
          const sr = (r.subs || {})[s.id] || {};
          const sf = sr.status === 'skip' ? '스킵' : sr.flag || '미평가';
          return `<tr style="font-size:12px">
        <td style="padding:4px 8px;border:1px solid #eee;color:#666">${s.id}</td>
        <td style="padding:4px 8px;border:1px solid #eee;color:#555">${escHtml(s.q.split('\n')[0].substring(0, 60))}</td>
        <td style="padding:4px 8px;border:1px solid #eee;font-weight:600;color:${sf === 'green' ? '#2a9a50' : sf === 'red' ? '#cc3333' : '#888'}">${sf === 'green' ? '✅ Green' : sf === 'red' ? '🚨 Red' : sf}</td>
        <td style="padding:4px 8px;border:1px solid #eee;color:#666;font-size:11px">${escHtml(sr.memo || '')}</td>
      </tr>`;
        }).join('');
        return `<tr style="background:#f8f8f8">
      <td style="padding:8px 10px;border:1px solid #ddd;font-weight:700">${q.id}</td>
      <td style="padding:8px 10px;border:1px solid #ddd;font-weight:600">${q.cat}</td>
      <td style="padding:8px 10px;border:1px solid #ddd;font-weight:700;color:${flagColor}">${mainFlag === 'green' ? '✅ Green' : mainFlag === 'red' ? '🚨 Red Flag' : '미평가'}</td>
      <td style="padding:8px 10px;border:1px solid #ddd;font-size:12px;color:#555">${escHtml((r.mainMemo || '').substring(0, 60))}</td>
    </tr>${subRows}`;
      }).join('');

      const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
  <title>코어 면접 결과 — ${ci.name}</title>
  <style>
    body { font-family: -apple-system, 'Malgun Gothic', sans-serif; font-size: 13px; color: #333; padding: 32px; max-width: 900px; margin: 0 auto; }
    h1 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
    .meta { color: #666; font-size: 13px; margin-bottom: 24px; }
    .verdict { font-size: 28px; font-weight: 700; padding: 16px 24px; border-radius: 8px; margin-bottom: 24px; text-align: center; background: ${isFail ? '#fff0f0' : '#f0fff4'}; color: ${isFail ? '#cc3333' : '#2a9a50'}; border: 2px solid ${isFail ? '#f0c0c0' : '#b0e8c0'}; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    th { background: #333; color: #fff; padding: 8px 10px; text-align: left; font-size: 12px; }
    h2 { font-size: 15px; font-weight: 700; margin: 24px 0 8px; border-bottom: 2px solid #333; padding-bottom: 6px; }
    @media print { body { padding: 16px; } }
  </style></head><body>
  <h1>WOS 코어 면접 평가 리포트</h1>
  <div class="meta">지원자: <strong>${ci.name}</strong> &nbsp;|&nbsp; 포지션: <strong>${ci.pos}</strong> &nbsp;|&nbsp; 트랙: ${ci.track === 'leader' ? '리더급' : '팀원급'} &nbsp;|&nbsp; 평가일: ${now}</div>
  <div class="verdict">${verdict} &nbsp;·&nbsp; Red Flag ${ci.redFlags.length}개</div>
  <h2>🚨 Red Flag 목록</h2>
  <table><thead><tr><th>항목</th><th>메모</th></tr></thead><tbody>${rfRows}</tbody></table>
  <h2>질문별 평가 상세</h2>
  <table><thead><tr><th style="width:50px">Q</th><th style="width:100px">카테고리</th><th style="width:100px">판정</th><th>메모</th></tr></thead><tbody>${qRows}</tbody></table>
  ${opinion ? `<h2>종합 의견</h2><div style="border:1px solid #e0e0e0;border-radius:6px;padding:14px 16px;font-size:13px;line-height:1.8;white-space:pre-wrap">${opinion.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>` : ''}
  ${starLv ? `<h2>최종 등급 평가</h2><div style="border:1px solid #e0e0e0;border-radius:6px;padding:14px 16px;font-size:13px;line-height:1.8"><strong>(${starLv.id}) ${starLv.label}</strong>${starMemo ? `<div style="white-space:pre-wrap;margin-top:8px;color:#555">${starMemo.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>` : ''}</div>` : ''}
  <div style="text-align:center;color:#aaa;font-size:11px;margin-top:32px;border-top:1px solid #eee;padding-top:12px">채용매칭 시스템 · WOS 코어 면접 평가 · ${now}</div>
  <script>window.onload=function(){window.print();}<\/script>
  </body></html>`;

      const win = window.open('', '_blank');
      win.document.write(html);
      win.document.close();
    }

    // ══════════════════════════════════════════════════
    //  면접 결과 목록 페이지
    // ══════════════════════════════════════════════════

    let currentCIResultIdx = -1;
    let cirdAccordionOpen = new Set(); // 아코디언 펼쳐진 질문 ID 집합
    let cirdQTextOpen = new Set();     // 메인 질문 텍스트 표시 중인 ID 집합
    let assignShowRejected = false;    // 불합격 포함 여부

    function loadCIResults() {
      try { return JSON.parse(localStorage.getItem('wm_ci_results') || '[]'); } catch (e) { return []; }
    }

    function saveCIResultsToStorage(arr) {
      localStorage.setItem('wm_ci_results', JSON.stringify(arr));
      if (cloudSyncDone) sbSave('wm_ci_results', arr);
    }

    function renderCIResults() {
      const all = loadCIResults();
      const statusFilter = document.getElementById('cir-filter-status')?.value || '';
      const verdictFilter = document.getElementById('cir-filter-verdict')?.value || '';
      let rows = all;
      if (statusFilter === 'draft') rows = rows.filter(r => r.status === 'draft');
      else if (statusFilter === 'done') rows = rows.filter(r => !r.status || r.status === 'done');
      if (verdictFilter) rows = rows.filter(r => r.verdict && r.verdict.includes(verdictFilter));

      // 통계 카드 (완료 기준)
      const doneAll = all.filter(r => !r.status || r.status === 'done');
      const total = doneAll.length;
      const passed = doneAll.filter(r => !r.isFail).length;
      const failed = doneAll.filter(r => r.isFail).length;
      const passRate = total ? Math.round((passed / total) * 100) : 0;
      const drafts = all.filter(r => r.status === 'draft').length;
      const statsEl = document.getElementById('cir-stats');
      if (statsEl) {
        statsEl.innerHTML = `
      <div class="stat-card"><div class="stat-label">전체 완료</div><div class="stat-value">${total}</div><div class="stat-change text-gray">저장된 면접 결과</div></div>
      <div class="stat-card"><div class="stat-label">합격</div><div class="stat-value text-green">${passed}</div><div class="stat-change text-gray">Green 판정</div></div>
      <div class="stat-card"><div class="stat-label">불합격</div><div class="stat-value text-red">${failed}</div><div class="stat-change text-gray">Red Flag 판정</div></div>
      <div class="stat-card"><div class="stat-label">작성중</div><div class="stat-value" style="color:#e07000">${drafts}</div><div class="stat-change text-gray">임시저장 건수</div></div>
    `;
      }

      const tbody = document.getElementById('cir-tbody');
      if (!tbody) return;
      if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">${(statusFilter || verdictFilter) ? '해당 조건의 결과가 없습니다' : '저장된 면접 결과가 없습니다'}</div></div></td></tr>`;
        return;
      }
      tbody.innerHTML = rows.map((r) => {
        const realIdx = all.indexOf(r);
        const isDraft = r.status === 'draft';
        const isFail = r.isFail;
        const badgeCls = isFail ? 'badge-red' : 'badge-green';
        const verdictTx = isFail ? '🚨 불합격' : '✅ 합격';
        const trackTx = r.track === 'leader' ? '리더급' : '팀원급';
        const statusBadge = isDraft
          ? `<span class="badge badge-orange" style="font-size:11px">작성중</span>`
          : `<span class="badge badge-green" style="font-size:11px">완료</span>`;
        const detailBtn = isDraft
          ? `<button class="btn btn-secondary btn-sm" onclick="openCIDraftForEdit(${realIdx})">이어 작성</button>`
          : `<button class="btn btn-secondary btn-sm" onclick="openCIResultDetail(${realIdx})">상세 보기</button>`;
        return `<tr>
      <td><strong>${escHtml(r.name)}</strong></td>
      <td>${escHtml(r.pos)}</td>
      <td><span class="badge badge-gray">${trackTx}</span></td>
      <td>${statusBadge}</td>
      <td>${isDraft ? '<span class="text-gray text-sm">—</span>' : `<span class="badge ${badgeCls}">${verdictTx}</span>`}</td>
      <td>
        ${r.redFlagCount > 0
            ? `<span class="badge badge-red">${r.redFlagCount}개</span>`
            : '<span class="text-gray text-sm">없음</span>'}
      </td>
      <td class="text-gray text-sm">${r.savedAt || '—'}</td>
      <td class="flex gap-8">
        ${detailBtn}
        <button class="btn btn-danger btn-sm" onclick="deleteCIResultAt(${realIdx})">삭제</button>
      </td>
    </tr>`;
      }).join('');
    }

    function cirdToggleQText(qId) {
      if (cirdQTextOpen.has(qId)) cirdQTextOpen.delete(qId);
      else cirdQTextOpen.add(qId);
      openCIResultDetail(currentCIResultIdx);
    }

    function cirdToggleAccordion(qId) {
      if (cirdAccordionOpen.has(qId)) cirdAccordionOpen.delete(qId);
      else cirdAccordionOpen.add(qId);
      openCIResultDetail(currentCIResultIdx);
    }

    function openCIResultDetail(idx) {
      const all = loadCIResults();
      const r = all[idx];
      if (!r) return;
      currentCIResultIdx = idx;
      const isDraft = r.status === 'draft';

      document.getElementById('cird-title').textContent = `코어 면접 결과 — ${r.name}`;
      document.getElementById('cird-subtitle').textContent =
        `${r.pos} · ${r.track === 'leader' ? '리더급' : '팀원급'} · ${r.savedAt}${isDraft ? ' ·  임시저장' : ''}`;

      // 상세보기 헤더의 버튼 영역 업데이트
      const headerBtns = document.querySelector('#page-ci-result-detail .flex.gap-8');
      if (headerBtns && isDraft) {
        headerBtns.innerHTML = `
          <button class="btn btn-primary btn-sm" onclick="completeCIDraftResult(${idx})">✅ 최종 완료</button>
          <button class="btn btn-secondary" onclick="printSavedCIResult()">🖨️ PDF 출력</button>
          <button class="btn btn-danger btn-sm" onclick="deleteSavedCIResult()">삭제</button>`;
      } else if (headerBtns) {
        headerBtns.innerHTML = `
          <button class="btn btn-secondary" onclick="printSavedCIResult()">🖨️ PDF 출력</button>
          <button class="btn btn-danger btn-sm" onclick="deleteSavedCIResult()">삭제</button>`;
      }

      const isFail = r.isFail;
      const vClass = isFail ? 'ci-result-fail' : 'ci-result-pass';
      const verdict = isDraft ? '(임시저장 — 판정 미확정)' : (isFail ? '🚨 불합격 (Drop)' : '✅ 합격');

      // Red Flag 목록
      const rfRows = (r.redFlags || []).map(rf => `
    <div class="flex items-center gap-8 mb-8">
      <span class="badge badge-red">${escHtml(rf.id)}</span>
      <span class="text-sm">${escHtml(rf.label || rf.id)}</span>
      ${rf.memo ? `<span class="text-gray text-sm">— ${escHtml(rf.memo)}</span>` : ''}
    </div>`).join('') || '<p class="text-gray text-sm">Red Flag 없음</p>';

      // 질문별 평가 상세 — 아코디언
      const results = r.results || {};
      const qKeys = Object.keys(results);
      const qSummary = qKeys.length
        ? qKeys.map(qId => {
          const res = results[qId];
          const mFlag = res.mainFlag || '';
          const isOpen = cirdAccordionOpen.has(qId);
          const chevron = isOpen ? '▼' : '▶';
          const isQTextOpen = cirdQTextOpen.has(qId);
          const qDef = CORE_QB.find(q => q.id === qId);
          const qTextHtml = qDef?.main
            ? `<div style="display:${isQTextOpen ? 'block' : 'none'};margin:8px 0 4px;padding:10px 14px;background:#f0f8ff;border-left:3px solid #4a9edd;border-radius:0 6px 6px 0;font-size:13px;color:#2c5f8a;line-height:1.7;white-space:pre-wrap">${escHtml(qDef.main)}</div>`
            : '';
          const subItems = Object.entries(res.subs || {}).map(([sid, sv]) => {
            const skip = sv.status === 'skip';
            const sf = sv.flag || '';
            return `<div class="cird-q-sub-item" style="padding:8px 0 8px 16px;border-bottom:1px solid #f8f8f8;display:flex;flex-direction:column;gap:6px">
            <div class="flex items-center gap-8">
              <span style="font-size:11px;background:#f0f0f0;color:#555;padding:1px 6px;border-radius:3px;flex-shrink:0">${sid}</span>
              ${skip ? '<span class="badge badge-gray" style="font-size:11px">스킵</span>' : `
              <button class="ci-btn-g${sf === 'green' ? ' sel' : ''}" style="padding:2px 10px;font-size:11px" onclick="cirdSetFlag(${idx},'${qId}','${sid}','green')">✅ Green</button>
              <button class="ci-btn-r${sf === 'red' ? ' sel' : ''}" style="padding:2px 10px;font-size:11px" onclick="cirdSetFlag(${idx},'${qId}','${sid}','red')">🚨 Red</button>`}
              ${sv.reason ? `<span style="font-size:11px;color:#aaa">스킵 사유: ${escHtml(sv.reason)}</span>` : ''}
            </div>
            ${!skip ? `<textarea class="form-control" style="font-size:12px;width:100%;box-sizing:border-box" rows="2" placeholder="메모..." onchange="cirdSaveMemo(${idx},'${qId}','${sid}',this.value)">${escHtml(sv.memo || '')}</textarea>` : ''}
          </div>`;
          }).join('');
          const mFlagBadge = mFlag === 'red'
            ? '<span class="badge badge-red" style="font-size:11px">🚨 Red Flag</span>'
            : mFlag === 'green'
              ? '<span class="badge badge-green" style="font-size:11px">✅ Green</span>'
              : '<span class="badge badge-gray" style="font-size:11px">미평가</span>';
          return `<div class="card mb-8" style="padding:0;overflow:hidden">
          <div style="background:#f8f8f8;padding:10px 16px;border-bottom:1px solid #eee">
            <div class="flex items-center gap-8 mb-4" style="flex-wrap:wrap">
              <div class="flex items-center gap-8" style="cursor:pointer;flex:1;min-width:0" onclick="cirdToggleAccordion('${qId}')">
                <span style="font-size:13px;color:#888;width:16px;flex-shrink:0">${chevron}</span>
                <span class="badge badge-gray" style="font-size:11px">${qId}</span>
                <span class="font-bold" style="font-size:13px">메인 질문</span>
                ${mFlagBadge}
              </div>
              <div class="flex gap-6" style="flex-shrink:0">
                ${qDef?.main ? `<button class="btn btn-secondary btn-sm" style="font-size:11px;padding:2px 10px" onclick="cirdToggleQText('${qId}')">${isQTextOpen ? '질문 숨기기' : '자세히 보기'}</button>` : ''}
                <span style="font-size:11px;color:#aaa;cursor:pointer" onclick="cirdToggleAccordion('${qId}')">${isOpen ? '평가 숨기기' : '평가 보기'}</span>
              </div>
            </div>
            ${qTextHtml}
            <div class="cird-q-detail" style="${isOpen ? '' : 'display:none'}">
              <div class="flex items-center gap-8 mb-8">
                <button class="ci-btn-g${mFlag === 'green' ? ' sel' : ''}" style="padding:2px 10px;font-size:11px" onclick="cirdSetFlag(${idx},'${qId}','main','green')">✅ Green</button>
                <button class="ci-btn-r${mFlag === 'red' ? ' sel' : ''}" style="padding:2px 10px;font-size:11px" onclick="cirdSetFlag(${idx},'${qId}','main','red')">🚨 Red Flag</button>
              </div>
              <textarea class="form-control" style="font-size:12px;width:100%;box-sizing:border-box" rows="2" placeholder="메모..." onchange="cirdSaveMemo(${idx},'${qId}','main',this.value)">${escHtml(res.mainMemo || '')}</textarea>
            </div>
          </div>
          <div class="cird-q-subs" style="${isOpen ? '' : 'display:none'}">${subItems}</div>
        </div>`;
        }).join('')
        : '<p class="text-gray text-sm">저장된 평가 상세가 없습니다.</p>';

      document.getElementById('cird-body').innerHTML = `
    <div class="card mb-16" style="border-left:4px solid ${isFail ? '#cc3333' : (isDraft ? '#e07000' : '#2a9a50')}">
      <div class="ci-result-verdict ${isDraft ? '' : vClass}" style="font-size:28px;${isDraft ? 'color:#e07000' : ''}">${verdict}</div>
      <div style="text-align:center;font-size:13px;color:#888">${isDraft ? '작성중 — 임시저장된 평가입니다' : `Red Flag ${r.redFlagCount}개 · Zero Tolerance 정책 적용`}</div>
    </div>
    <div class="grid-2 gap-16 mb-16">
      <div class="card">
        <div class="section-title mb-12">🚨 Red Flag 목록</div>
        ${rfRows}
      </div>
      <div class="card">
        <div class="section-title mb-12">기본 정보</div>
        <div class="flex flex-col gap-8" style="font-size:13px">
          <div class="flex justify-between"><span class="text-gray">지원자</span><strong>${escHtml(r.name)}</strong></div>
          <div class="flex justify-between"><span class="text-gray">포지션</span><span>${escHtml(r.pos)}</span></div>
          <div class="flex justify-between"><span class="text-gray">트랙</span><span>${r.track === 'leader' ? '리더급' : '팀원급'}</span></div>
          <div class="flex justify-between"><span class="text-gray">판정</span><span class="font-bold ${isFail ? 'text-red' : 'text-green'}">${isDraft ? '—' : (isFail ? '불합격' : '합격')}</span></div>
          <div class="flex justify-between"><span class="text-gray">평가일시</span><span>${escHtml(r.savedAt || '—')}</span></div>
        </div>
      </div>
    </div>
    <div class="flex items-center justify-between mb-12">
      <div class="section-title">질문별 평가 상세</div>
      <div class="flex gap-8">
        <button class="btn btn-secondary btn-sm" onclick="cirdExpandAll(${JSON.stringify(qKeys)})">전체 펼치기</button>
        <button class="btn btn-secondary btn-sm" onclick="cirdCollapseAll()">전체 접기</button>
      </div>
    </div>
    ${qSummary}
    <div class="card mt-16" style="margin-top:16px">
      <div class="flex items-center justify-between mb-12">
        <div class="section-title">종합 의견</div>
        <button class="btn btn-primary btn-sm" onclick="saveCIOpinion(${idx})">저장</button>
      </div>
      <textarea id="cird-opinion" class="form-control" rows="10" style="width:100%;box-sizing:border-box;height:5cm" placeholder="면접 전반에 대한 종합 의견, 특이사항, 추천/비추천 근거 등을 자유롭게 작성하세요.">${escHtml(r.opinion || '')}</textarea>
    </div>
    <div class="card mt-16" style="margin-top:16px">
      <div class="flex items-center justify-between mb-12">
        <div class="section-title">최종 등급 평가 (5단계 척도)</div>
        <button class="btn btn-primary btn-sm" onclick="saveCIStarDetail(${idx})">저장</button>
      </div>
      ${STAR_LEVELS.map(lv => `
      <div class="ci-star-box${r.starLevel === lv.id ? ' active' : ''}" onclick="cirdSetStarLevel(${idx},${lv.id})" style="border:2px solid ${r.starLevel === lv.id ? '#333' : '#e0e0e0'};border-radius:8px;padding:12px 14px;cursor:pointer;background:${r.starLevel === lv.id ? '#f5f5f5' : '#fff'};margin-bottom:8px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
          <span class="badge badge-gray" style="font-size:11px">(${lv.id})</span>
          <span style="font-weight:700;font-size:13px">${escHtml(lv.label)}</span>
          ${r.starLevel === lv.id ? '<span style="margin-left:auto;font-size:12px;color:#2a9a50;font-weight:700">✓ 선택됨</span>' : ''}
        </div>
        <div style="font-size:12px;color:#666;line-height:1.5">${escHtml(lv.desc)}</div>
      </div>`).join('')}
      <div style="margin-top:16px">
        <label class="form-label">메모</label>
        <textarea id="cird-star-memo" class="form-control" rows="10" style="width:100%;box-sizing:border-box;height:5cm" placeholder="등급 판단 근거, 참고 사항 등을 자유롭게 작성하세요.">${escHtml(r.starMemo || '')}</textarea>
      </div>
    </div>
    ${isDraft ? `<div class="card mt-16" style="margin-top:16px;border:2px dashed #e07000;background:#fffbf5">
      <div style="font-size:13px;color:#e07000;font-weight:700;margin-bottom:8px">임시저장 상태</div>
      <div style="font-size:12px;color:#888;margin-bottom:12px">아직 완료되지 않은 면접 평가입니다. 이어서 작성하거나 최종 완료 처리할 수 있습니다.</div>
      <div class="flex gap-8">
        <button class="btn btn-secondary btn-sm" onclick="openCIDraftForEdit(${idx})">✏️ 이어서 작성</button>
        <button class="btn btn-primary btn-sm" onclick="completeCIDraftResult(${idx})">✅ 최종 완료</button>
      </div>
    </div>` : ''}
  `;
      nav('ci-result-detail');
    }

    function cirdExpandAll(qKeys) {
      qKeys.forEach(k => cirdAccordionOpen.add(k));
      openCIResultDetail(currentCIResultIdx);
    }

    function cirdCollapseAll() {
      cirdAccordionOpen.clear();
      openCIResultDetail(currentCIResultIdx);
    }

    function cirdSetFlag(idx, qId, subKey, flag) {
      const all = loadCIResults();
      const r = all[idx];
      if (!r) return;
      r.results = r.results || {};
      r.results[qId] = r.results[qId] || {};
      if (subKey === 'main') {
        r.results[qId].mainFlag = r.results[qId].mainFlag === flag ? '' : flag;
      } else {
        r.results[qId].subs = r.results[qId].subs || {};
        r.results[qId].subs[subKey] = r.results[qId].subs[subKey] || {};
        r.results[qId].subs[subKey].flag = r.results[qId].subs[subKey].flag === flag ? '' : flag;
      }
      saveCIResultsToStorage(all);
      openCIResultDetail(idx);
    }

    function cirdSaveMemo(idx, qId, subKey, value) {
      const all = loadCIResults();
      const r = all[idx];
      if (!r) return;
      r.results = r.results || {};
      r.results[qId] = r.results[qId] || {};
      if (subKey === 'main') {
        r.results[qId].mainMemo = value;
      } else {
        r.results[qId].subs = r.results[qId].subs || {};
        r.results[qId].subs[subKey] = r.results[qId].subs[subKey] || {};
        r.results[qId].subs[subKey].memo = value;
      }
      saveCIResultsToStorage(all);
    }

    function cirdSetStarLevel(idx, level) {
      const all = loadCIResults();
      if (!all[idx]) return;
      all[idx].starLevel = level;
      saveCIResultsToStorage(all);
      openCIResultDetail(idx);
    }

    function saveCIStarDetail(idx) {
      const all = loadCIResults();
      if (!all[idx]) return;
      all[idx].starMemo = document.getElementById('cird-star-memo')?.value.trim() || '';
      saveCIResultsToStorage(all);
      showToast('최종 등급 평가가 저장되었습니다.', 'success');
    }

    function saveCIOpinion(idx) {
      const all = loadCIResults();
      if (!all[idx]) return;
      const opinion = document.getElementById('cird-opinion')?.value.trim() || '';
      all[idx].opinion = opinion;
      saveCIResultsToStorage(all);
      showToast('종합 의견이 저장되었습니다.', 'success');
    }

    function deleteCIResultAt(idx) {
      const all = loadCIResults();
      const r = all[idx];
      if (!r) return;
      showConfirm('면접 결과 삭제', `"${r.name}" (${r.pos}) 면접 결과를 삭제하시겠습니까?`, () => {
        all.splice(idx, 1);
        saveCIResultsToStorage(all);
        showToast('면접 결과가 삭제되었습니다.', 'success');
        renderCIResults();
      });
    }

    function deleteSavedCIResult() {
      deleteCIResultAt(currentCIResultIdx);
      nav('ci-results');
    }

    function clearAllCIResults() {
      const all = loadCIResults();
      if (!all.length) { showToast('삭제할 결과가 없습니다.', 'info'); return; }
      showConfirm('전체 삭제', `저장된 면접 결과 ${all.length}건을 모두 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`, () => {
        saveCIResultsToStorage([]);
        showToast('전체 면접 결과가 삭제되었습니다.', 'success');
        renderCIResults();
      });
    }

    function printSavedCIResult() {
      const all = loadCIResults();
      const r = all[currentCIResultIdx];
      if (!r) return;

      const isFail = r.isFail;
      const verdict = isFail ? '🚨 불합격 (Drop)' : '✅ 합격';
      const rfRows = (r.redFlags || []).map(rf =>
        `<tr><td style="padding:6px 10px;border:1px solid #ddd">${rf.id}</td><td style="padding:6px 10px;border:1px solid #ddd">${rf.memo || '—'}</td></tr>`
      ).join('') || '<tr><td colspan="2" style="padding:6px 10px;border:1px solid #ddd;color:#aaa">Red Flag 없음</td></tr>';

      const results = r.results || {};
      const qRows = Object.keys(results).map(qId => {
        const res = results[qId];
        const mFlag = res.mainFlag || '미평가';
        const fc = mFlag === 'green' ? '#2a9a50' : mFlag === 'red' ? '#cc3333' : '#888';
        const subRows = Object.entries(res.subs || {}).map(([sid, sv]) => {
          const sf = sv.status === 'skip' ? '스킵' : sv.flag || '미평가';
          return `<tr style="font-size:12px">
        <td style="padding:4px 8px;border:1px solid #eee;color:#666">${sid}</td>
        <td style="padding:4px 8px;border:1px solid #eee;font-weight:600;color:${sf === 'green' ? '#2a9a50' : sf === 'red' ? '#cc3333' : '#888'}">${sf === 'green' ? '✅ Green' : sf === 'red' ? '🚨 Red' : sf}</td>
        <td style="padding:4px 8px;border:1px solid #eee;color:#555;font-size:11px">${escHtml(sv.memo || '')}</td>
        <td style="padding:4px 8px;border:1px solid #eee;color:#aaa;font-size:11px">${escHtml(sv.reason || '')}</td>
      </tr>`;
        }).join('');
        return `<tr style="background:#f8f8f8">
      <td style="padding:8px 10px;border:1px solid #ddd;font-weight:700">${qId}</td>
      <td style="padding:8px 10px;border:1px solid #ddd;font-weight:700;color:${fc}">${mFlag === 'green' ? '✅ Green' : mFlag === 'red' ? '🚨 Red Flag' : '미평가'}</td>
      <td style="padding:8px 10px;border:1px solid #ddd;font-size:12px;color:#555" colspan="2">${escHtml((res.mainMemo || '').substring(0, 80))}</td>
    </tr>${subRows}`;
      }).join('');

      const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
  <title>코어 면접 결과 — ${r.name}</title>
  <style>
    body{font-family:-apple-system,'Malgun Gothic',sans-serif;font-size:13px;color:#333;padding:32px;max-width:900px;margin:0 auto}
    h1{font-size:20px;font-weight:700;margin-bottom:4px}
    .meta{color:#666;font-size:13px;margin-bottom:24px}
    .verdict{font-size:26px;font-weight:700;padding:14px 24px;border-radius:8px;margin-bottom:24px;text-align:center;background:${isFail ? '#fff0f0' : '#f0fff4'};color:${isFail ? '#cc3333' : '#2a9a50'};border:2px solid ${isFail ? '#f0c0c0' : '#b0e8c0'}}
    table{width:100%;border-collapse:collapse;margin-bottom:24px}
    th{background:#333;color:#fff;padding:8px 10px;text-align:left;font-size:12px}
    h2{font-size:15px;font-weight:700;margin:24px 0 8px;border-bottom:2px solid #333;padding-bottom:6px}
    @media print{body{padding:12px}}
  </style></head><body>
  <h1>WOS 코어 면접 평가 리포트</h1>
  <div class="meta">지원자: <strong>${r.name}</strong> &nbsp;|&nbsp; 포지션: <strong>${r.pos}</strong> &nbsp;|&nbsp; 트랙: ${r.track === 'leader' ? '리더급' : '팀원급'} &nbsp;|&nbsp; 평가일: ${r.savedAt}</div>
  <div class="verdict">${verdict} &nbsp;·&nbsp; Red Flag ${r.redFlagCount}개</div>
  <h2>🚨 Red Flag 목록</h2>
  <table><thead><tr><th>항목</th><th>메모</th></tr></thead><tbody>${rfRows}</tbody></table>
  <h2>질문별 평가 상세</h2>
  <table><thead><tr><th style="width:50px">Q</th><th style="width:100px">판정</th><th>메모</th><th>비고</th></tr></thead><tbody>${qRows}</tbody></table>
  ${r.opinion ? `<h2>종합 의견</h2><div style="border:1px solid #e0e0e0;border-radius:6px;padding:14px 16px;font-size:13px;line-height:1.8;white-space:pre-wrap">${r.opinion.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>` : ''}
  ${(() => { const lv = STAR_LEVELS.find(l => l.id === r.starLevel); return lv ? `<h2>최종 등급 평가</h2><div style="border:1px solid #e0e0e0;border-radius:6px;padding:14px 16px;font-size:13px;line-height:1.8"><strong>(${lv.id}) ${lv.label}</strong>${r.starMemo ? `<div style="white-space:pre-wrap;margin-top:8px;color:#555">${r.starMemo.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>` : ''}</div>` : ''; })()}
  <div style="text-align:center;color:#aaa;font-size:11px;margin-top:32px;border-top:1px solid #eee;padding-top:12px">채용매칭 시스템 · WOS 코어 면접 평가 · ${r.savedAt}</div>
  <script>window.onload=function(){window.print();}<\/script>
  </body></html>`;

      const win = window.open('', '_blank');
      win.document.write(html);
      win.document.close();
    }

    // ══════════════════════════════════════════════════
    //  과제(미니 퀘스트) 면접 — 세션/판정/결과 로직
    // ══════════════════════════════════════════════════

    let qq = null; // current mini-quest session

    function renderQQ() {
      const root = document.getElementById('qq-root');
      if (!root) return;
      if (!qq) {
        root.innerHTML = renderQQStart();
        return;
      }
      if (qq.done) { root.innerHTML = renderQQResult(); return; }
      root.innerHTML = renderQQSession();
    }

    // ── 시작 화면 ──
    function renderQQStart() {
      const positions = [...new Set(matchingData.map(m => m.position))].filter(Boolean);
      const posCards = positions.length
        ? positions.map(p => {
          const count = matchingData.filter(m => m.position === p).length;
          return `<div class="ci-pos-card" id="qqpc-${escHtml(p)}" onclick="qqSelectPos('${p.replace(/'/g, "\\'")}')">
          <div class="ci-pos-card-name">${escHtml(p)}</div>
          <div class="ci-pos-card-cnt">지원자 ${count}명</div>
        </div>`;
        }).join('')
        : `<div style="font-size:13px;color:#aaa;padding:20px 0;text-align:center">등록된 포지션이 없습니다.<br>매칭 분석에서 지원자를 먼저 추가하세요.</div>`;

      return `
  <div class="flex items-center justify-between mb-24">
    <div>
      <div class="page-title">과제(미니 퀘스트) 면접 평가</div>
      <div class="page-subtitle">Phase 5 — Red Flag 1개 발생 시 즉시 불합격 (Hard Stop)</div>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start">
    <div class="card" style="padding:20px">
      <div class="section-title mb-4">포지션 선택</div>
      <div class="text-sm text-gray mb-16">면접을 진행할 포지션을 선택하세요</div>
      <div id="qq-pos-list" style="display:flex;flex-direction:column;gap:8px">
        ${posCards}
      </div>
    </div>
    <div class="card" style="padding:20px">
      <div class="section-title mb-4">면접 설정</div>
      <div class="text-sm text-gray mb-16">지원자를 설정하세요</div>
      <div id="qq-selected-pos-badge" style="display:none;margin-bottom:16px">
        <span style="font-size:12px;color:#888">선택된 포지션</span>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px;padding:8px 12px;background:#f5f5f5;border-radius:6px">
          <span id="qq-selected-pos-name" style="font-weight:700;font-size:14px"></span>
          <button onclick="qqClearPos()" style="background:none;border:none;color:#aaa;cursor:pointer;font-size:16px;line-height:1">×</button>
        </div>
      </div>
      <div class="form-group mb-12">
        <label class="form-label">지원자 선택 <span class="required">*</span></label>
        <select id="qq-applicant-sel" class="form-control">
          <option value="">포지션을 먼저 선택하세요</option>
        </select>
      </div>
      <div class="form-group mb-12" id="qq-manual-row" style="display:none">
        <label class="form-label">직접 입력</label>
        <div class="form-row">
          <input id="qq-name-manual" class="form-control" placeholder="지원자명" />
          <input id="qq-pos-manual"  class="form-control" placeholder="포지션명" />
        </div>
      </div>
      <div style="margin-bottom:20px">
        <a class="link" onclick="qqToggleManual()" style="font-size:13px">✏️ 직접 입력하기</a>
      </div>
      <button class="btn btn-primary btn-full" onclick="qqStart()">면접 시작</button>
    </div>
  </div>`;
    }

    function qqSelectPos(pos) {
      document.querySelectorAll('#qq-pos-list .ci-pos-card').forEach(c => c.classList.remove('active'));
      const card = document.getElementById(`qqpc-${pos}`);
      if (card) card.classList.add('active');
      const badge = document.getElementById('qq-selected-pos-badge');
      const name = document.getElementById('qq-selected-pos-name');
      if (badge) badge.style.display = '';
      if (name) name.textContent = pos;
      qqUpdateApplicants(pos);
    }

    function qqClearPos() {
      document.querySelectorAll('#qq-pos-list .ci-pos-card').forEach(c => c.classList.remove('active'));
      const badge = document.getElementById('qq-selected-pos-badge');
      if (badge) badge.style.display = 'none';
      const sel = document.getElementById('qq-applicant-sel');
      if (sel) sel.innerHTML = '<option value="">포지션을 먼저 선택하세요</option>';
    }

    function qqUpdateApplicants(pos) {
      const sel = document.getElementById('qq-applicant-sel');
      if (!sel) return;
      const applicants = matchingData.filter(m => m.position === pos);
      if (!pos || applicants.length === 0) {
        sel.innerHTML = '<option value="">해당 포지션 지원자 없음</option>';
        return;
      }
      sel.innerHTML = '<option value="">지원자를 선택하세요</option>' +
        applicants.map(m => {
          const realIdx = matchingData.indexOf(m);
          return `<option value="${realIdx}">${escHtml(m.applicant)} (${m.score}/5 · ${m.date})</option>`;
        }).join('');
    }

    function qqToggleManual() {
      const row = document.getElementById('qq-manual-row');
      const appRow = document.getElementById('qq-applicant-sel')?.closest('.form-group');
      if (!row) return;
      const showing = row.style.display !== 'none';
      row.style.display = showing ? 'none' : '';
      if (appRow) appRow.style.display = showing ? '' : 'none';
    }

    function qqStart() {
      const manualVisible = document.getElementById('qq-manual-row')?.style.display !== 'none';
      let name, pos;
      if (manualVisible) {
        name = document.getElementById('qq-name-manual')?.value.trim();
        pos = document.getElementById('qq-pos-manual')?.value.trim();
      } else {
        const appIdx = parseInt(document.getElementById('qq-applicant-sel')?.value);
        const m = isNaN(appIdx) ? null : matchingData[appIdx];
        name = m?.applicant;
        pos = m?.position || document.getElementById('qq-selected-pos-name')?.textContent || '';
      }
      if (!name || !pos) { showToast('포지션과 지원자를 선택하거나 직접 입력하세요.', 'error'); return; }
      qq = {
        name, pos,
        questions: JSON.parse(JSON.stringify(MINI_QUEST_QB)),
        qIdx: 0,
        results: {},   // {qId: {judgment, redFlagType, memo, status}}
        failed: false, failQ: null, failType: null,
        opinion: '',
        done: false,
      };
      renderQQ();
    }

    // ── 세션 화면 ──
    function renderQQSession() {
      const totalSteps = qq.questions.length;
      const pct = Math.round(((qq.qIdx) / totalSteps) * 100);
      const q = qq.questions[qq.qIdx];
      const res = qq.results[q.id] || {};

      const banner = qq.failed ? `
    <div class="qq-fail-banner">⛔ 불합격 확정 — Red Flag 발생 (${qq.failQ}${qq.failType ? ' · ' + qq.failType : ''})</div>` : '';

      const listHtml = buildQQList();

      return `
  <div class="flex items-center justify-between mb-8">
    <div>
      <div class="page-title">과제 면접 — ${escHtml(qq.name)}</div>
      <div class="page-subtitle">${escHtml(qq.pos)} · 과제 면접</div>
    </div>
    <button class="btn btn-danger btn-sm" onclick="qqEndConfirm()">면접 종료</button>
  </div>
  ${banner}
  <div class="ci-shell">
    <div class="ci-progress"><div class="ci-progress-fill" style="width:${pct}%"></div></div>
    <div class="ci-tree-layout">
      <div class="ci-tree-panel">
        <div class="ci-tree-panel-title">질문 목록 (${qq.qIdx + 1}/${totalSteps})</div>
        ${listHtml}
      </div>
      <div class="ci-content-panel">
        ${renderQQQuestion(q, res)}
        <div class="ci-nav-row">
          <button class="btn btn-secondary btn-sm" onclick="qqPrev()">← 이전</button>
          <span class="ci-step-txt">${qq.qIdx + 1} / ${totalSteps}</span>
          <button class="btn btn-primary btn-sm" onclick="qqNext()">다음 →</button>
        </div>
      </div>
    </div>
  </div>`;
    }

    function buildQQList() {
      return qq.questions.map((q, qi) => {
        const res = qq.results[q.id] || {};
        const j = res.judgment || '';
        const isActive = qq.qIdx === qi;
        let cls = 'ci-tree-q-head';
        if (isActive) cls += ' ci-tree-active';
        else if (j === 'gold') cls += ' ci-tree-gold';
        else if (j === 'ok') cls += ' ci-tree-green';
        else if (j === 'red') cls += ' ci-tree-red';
        const dot = j === 'gold' ? 'gold' : j === 'ok' ? 'green' : j === 'red' ? 'red' : '';
        return `<div class="ci-tree-q">
      <div class="${cls}" onclick="qqJumpTo(${qi})">
        <div class="ci-tree-dot ${dot}"></div>
        <span>${q.id}</span>
        <span>${escHtml(q.label)}</span>
      </div>
    </div>`;
      }).join('');
    }

    function qqJumpTo(qIdx) {
      qq.qIdx = qIdx;
      renderQQ();
    }

    function qqEndConfirm() {
      const q6 = qq.questions.find(x => x.id === 'Q6');
      if (q6 && !q6.question.trim()) {
        const proceed = confirm('Q6(직군별 필수 지식/기술) 질문이 입력되지 않았습니다.\n그대로 면접을 종료하시겠습니까?');
        if (!proceed) return;
      }
      const confirmed = confirm('면접을 종료하고 평가표를 확인하시겠습니까?\n미진행 항목은 "미진행"으로 처리됩니다.');
      if (confirmed) {
        qq.done = true;
        renderQQ();
      }
    }

    // ── 질문 화면 (메인 콘텐츠) ──
    function renderQQQuestion(q, res) {
      const skip = res.status === 'skip';
      const axisBadge = `<span class="badge badge-gray" style="font-size:11px">${escHtml(q.axis)}</span>`;
      let html = `
    <div class="ci-q-label">
      <span class="ci-q-code">${q.id}</span>
      <span class="ci-q-cat">${escHtml(q.group)}</span>
      ${axisBadge}
    </div>`;

      if (q.type === 'custom') {
        html += `
    <div class="form-group mb-12">
      <label class="form-label">질문 (직군별 직접 입력) <span class="required">*</span></label>
      <textarea class="form-control" rows="2" placeholder="이 포지션의 레벨별 필수 지식/기술을 검증할 질문을 입력하세요." onchange="qqSetQ6Field('question', this.value)">${escHtml(q.question || '')}</textarea>
    </div>
    <div class="form-row mb-12">
      <div class="form-group" style="flex:1">
        <label class="form-label">🏅 Gold Flag 기준</label>
        <textarea class="form-control" rows="2" placeholder="Gold Flag로 판단할 기준" onchange="qqSetQ6Field('goldCriteria', this.value)">${escHtml((q.criteria.gold || [])[0] || '')}</textarea>
      </div>
      <div class="form-group" style="flex:1">
        <label class="form-label">🚨 Red Flag 기준</label>
        <textarea class="form-control" rows="2" placeholder="Red Flag로 판단할 기준" onchange="qqSetQ6Field('redCriteria', this.value)">${escHtml((q.criteria.red || [])[0] || '')}</textarea>
      </div>
    </div>`;
      } else {
        html += `<div class="ci-script">${escHtml(q.question)}</div>`;
        if (q.type === 'rebuttal_sim') {
          html += `<div class="ci-q7-track">
        <div class="ci-q7-track-title">의도적 반박 시뮬레이션 — Red Flag 3종 중 택1 태깅</div>
        <div class="text-sm text-gray">감정적 방어기제 / 맹목적 수용 / 환경·조건 탓 중 어떤 반응이 나타나는지 관찰하세요.</div>
      </div>`;
        }
        html += `
    <div class="ci-hint-row">
      <div class="ci-hint ci-hint-g">🏅 Gold Flag: ${(q.criteria.gold || []).map(escHtml).join(' / ') || '—'}</div>
      <div class="ci-hint ci-hint-r">🚨 Red Flag: ${(q.criteria.red || []).map(escHtml).join(' / ') || '—'}</div>
    </div>`;
      }

      html += `<div class="ci-skip-toggle">
    <button class="ci-skip-opt${!skip ? ' on-p' : ''}" onclick="qqProceed('${q.id}',false)">▶ 진행 (Proceed)</button>
    <button class="ci-skip-opt${skip ? ' on-s' : ''}" onclick="qqProceed('${q.id}',true)">⏭ 미진행 (Skip)</button>
  </div>`;

      if (!skip) {
        html += `<textarea class="ci-memo" placeholder="면접관 메모..." onchange="qqSaveMemo('${q.id}',this.value)">${escHtml(res.memo || '')}</textarea>`;
        html += `<div class="ci-flag-row">
      <button class="ci-btn-gold${res.judgment === 'gold' ? ' sel' : ''}" onclick="qqSetJudgment('${q.id}','gold')">🏅 Gold Flag</button>
      <button class="ci-btn-g${res.judgment === 'ok' ? ' sel' : ''}" onclick="qqSetJudgment('${q.id}','ok')">✅ 양호</button>
      <button class="ci-btn-r${res.judgment === 'red' ? ' sel' : ''}" onclick="qqSetJudgment('${q.id}','red')">🚨 Red Flag</button>
    </div>`;
        if (res.judgment === 'red') {
          html += `<div class="ci-skip-box">
        <label>Red Flag 유형 선택 (필수)</label>
        <select class="form-control" onchange="qqSetRedFlagType('${q.id}', this.value)">
          <option value="">-- 유형 선택 --</option>
          ${RED_FLAG_TYPES.map(t => `<option value="${escHtml(t)}"${res.redFlagType === t ? ' selected' : ''}>${escHtml(t)}</option>`).join('')}
        </select>
      </div>`;
        }
      }

      return html;
    }

    function qqEnsureRes(qId) {
      if (!qq.results[qId]) qq.results[qId] = { judgment: '', redFlagType: '', memo: '', status: 'proceed' };
      return qq.results[qId];
    }

    function qqProceed(qId, skip) {
      const res = qqEnsureRes(qId);
      res.status = skip ? 'skip' : 'proceed';
      renderQQ();
    }

    function qqSaveMemo(qId, val) {
      const res = qqEnsureRes(qId);
      res.memo = val;
    }

    function qqSetQ6Field(field, val) {
      const q6 = qq.questions.find(x => x.id === 'Q6');
      if (!q6) return;
      if (field === 'question') q6.question = val;
      else if (field === 'goldCriteria') q6.criteria.gold = val ? [val] : [];
      else if (field === 'redCriteria') q6.criteria.red = val ? [val] : [];
    }

    function qqSetJudgment(qId, judgment) {
      const res = qqEnsureRes(qId);
      if (judgment === 'red') {
        const confirmed = confirm(`⚠️ Red Flag를 표시하시겠습니까?\nPhase 5는 Red Flag 1개 발생 시 즉시 불합격(Hard Stop) 처리됩니다.\n\n항목: ${qId}`);
        if (!confirmed) return;
        if (!qq.failed) {
          qq.failed = true;
          qq.failQ = qId;
          qq.failType = res.redFlagType || '';
        }
      } else if (res.judgment === 'red' && qq.failQ === qId) {
        // 이미 확정된 첫 Red Flag를 되돌리는 경우 — 다른 질문 중 Red가 남아있는지 재확인
        const stillRed = Object.entries(qq.results).find(([id, r]) => id !== qId && r.judgment === 'red');
        if (!stillRed) { qq.failed = false; qq.failQ = null; qq.failType = null; }
      }
      res.judgment = judgment;
      renderQQ();
    }

    function qqSetRedFlagType(qId, type) {
      const res = qqEnsureRes(qId);
      res.redFlagType = type;
      if (qq.failQ === qId) qq.failType = type;
      renderQQ();
    }

    function qqNext() {
      if (qq.qIdx < qq.questions.length - 1) qq.qIdx++;
      renderQQ();
    }

    function qqPrev() {
      if (qq.qIdx > 0) qq.qIdx--;
      renderQQ();
    }

    function qqGoBackToEdit() {
      qq.done = false;
      qq.qIdx = qq.questions.length - 1;
      renderQQ();
    }

    // ── 결과 화면 (평가표) ──
    function qqAxisSummary() {
      const axes = ['사고로직', '지식기술', '협업태도'];
      return axes.map(axis => {
        const qs = qq.questions.filter(q => q.axis === axis);
        const counts = { gold: 0, ok: 0, red: 0, skip: 0, none: 0 };
        qs.forEach(q => {
          const r = qq.results[q.id] || {};
          if (r.status === 'skip') counts.skip++;
          else if (r.judgment === 'gold') counts.gold++;
          else if (r.judgment === 'ok') counts.ok++;
          else if (r.judgment === 'red') counts.red++;
          else counts.none++;
        });
        return { axis, ...counts, total: qs.length };
      });
    }

    function renderQQResult() {
      const isFail = qq.failed;
      const verdict = isFail ? '불합격 (Drop)' : '합격 — Phase 6 이관 대상';
      const vClass = isFail ? 'ci-result-fail' : 'ci-result-pass';

      const axisRows = qqAxisSummary().map(a => `
    <div class="flex items-center justify-between" style="padding:8px 0;border-bottom:1px solid #f0f0f0">
      <span class="font-bold" style="font-size:13px">${escHtml(a.axis)}</span>
      <div class="flex gap-8" style="font-size:12px">
        <span style="color:#c98a00">🏅 ${a.gold}</span>
        <span class="text-green">✅ ${a.ok}</span>
        <span class="text-red">🚨 ${a.red}</span>
        <span class="text-gray">⏭ ${a.skip}</span>
      </div>
    </div>`).join('');

      const goldList = qq.questions.filter(q => (qq.results[q.id] || {}).judgment === 'gold');
      const goldHtml = goldList.length
        ? goldList.map(q => `<div class="flex items-center gap-8 mb-8"><span class="badge badge-gray" style="font-size:11px">${q.id}</span><span class="text-sm">${escHtml(q.label)}</span></div>`).join('')
        : '<div class="text-gray text-sm">Gold Flag 없음</div>';

      const redQ = qq.questions.find(q => q.id === qq.failQ);
      const redHtml = isFail
        ? `<div class="flex items-center gap-8 mb-8">
        <span class="badge badge-red">${escHtml(qq.failQ || '')}</span>
        <span class="text-sm">${escHtml(redQ?.label || '')}</span>
      </div>
      <div class="text-sm text-gray">유형: ${escHtml(qq.failType || '미지정')}</div>
      <div class="text-sm text-gray mt-4" style="margin-top:4px">메모: ${escHtml((qq.results[qq.failQ] || {}).memo || '—')}</div>`
        : '<div class="text-gray text-sm">Red Flag 없음</div>';

      const qSummary = qq.questions.map(q => {
        const r = qq.results[q.id] || {};
        const skip = r.status === 'skip';
        const j = r.judgment || '';
        const jTx = j === 'gold' ? '🏅 Gold Flag' : j === 'ok' ? '✅ 양호' : j === 'red' ? '🚨 Red Flag' : '미평가';
        const jCls = j === 'gold' ? 'badge-gray' : j === 'ok' ? 'badge-green' : j === 'red' ? 'badge-red' : 'badge-gray';
        return `<div style="padding:10px 0;border-bottom:1px solid #f0f0f0">
      <div class="flex items-center gap-8 mb-4">
        <span class="badge badge-gray" style="font-size:11px">${q.id}</span>
        <span style="font-size:13px;font-weight:500">${escHtml(q.label)}</span>
        <span class="badge ${jCls}" style="font-size:11px">${skip ? '⏭ 미진행' : jTx}</span>
      </div>
      ${!skip && r.memo ? `<div class="text-gray text-sm">${escHtml(r.memo)}</div>` : ''}
    </div>`;
      }).join('');

      return `
  <div class="flex items-center justify-between mb-24">
    <div class="flex items-center gap-12">
      <button class="btn btn-secondary btn-sm" onclick="qqGoBackToEdit()">← 수정하기</button>
      <div>
        <div class="page-title">과제 면접 평가표 — ${escHtml(qq.name)}</div>
        <div class="page-subtitle">${escHtml(qq.pos)} · 과제 면접</div>
      </div>
    </div>
    <div class="flex gap-8">
      <button class="btn btn-primary btn-sm" onclick="saveQQResult()">💾 결과 저장</button>
      <button class="btn btn-secondary btn-sm" onclick="printQQResult()">🖨️ PDF 출력</button>
      <button class="btn btn-secondary btn-sm" onclick="qq=null;renderQQ()">새 면접 시작</button>
    </div>
  </div>
  ${isFail ? `<div class="qq-fail-banner mb-16">⛔ 불합격 확정 — Red Flag 발생 (${escHtml(qq.failQ || '')}${qq.failType ? ' · ' + escHtml(qq.failType) : ''})</div>` : ''}
  <div class="card mb-16" style="border-left:4px solid ${isFail ? '#cc3333' : '#2a9a50'}">
    <div class="ci-result-verdict ${vClass}">${isFail ? '🚨' : '✅'} ${verdict}</div>
    <div style="text-align:center;font-size:13px;color:#888">결정 규칙: Red Flag 1개 발생 시 즉시 불합격 (Zero Tolerance)</div>
  </div>
  <div class="grid-2 gap-16 mb-16">
    <div class="card">
      <div class="section-title mb-12">🚨 Red Flag 상세</div>
      ${redHtml}
    </div>
    <div class="card">
      <div class="section-title mb-12">🏅 Gold Flag 목록</div>
      ${goldHtml}
    </div>
  </div>
  <div class="card mb-16">
    <div class="section-title mb-12">3대 검증 축 요약</div>
    ${axisRows}
  </div>
  <div class="card mb-16">
    <div class="section-title mb-12">질문별 평가 상세</div>
    ${qSummary}
  </div>
  <div class="card">
    <div class="section-title mb-12">종합 의견</div>
    <textarea id="qq-opinion" class="form-control" rows="10" style="width:100%;box-sizing:border-box;height:5cm" placeholder="면접 전반에 대한 종합 의견, 특이사항, 추천/비추천 근거 등을 자유롭게 작성하세요.">${escHtml(qq.opinion || '')}</textarea>
    <div class="text-sm text-gray" style="margin-top:6px">※ "💾 결과 저장" 시 함께 저장됩니다.</div>
  </div>
  ${renderQQStarSection(qq.starLevel, qq.starMemo)}`;
    }

    // ── 5단계 최종 등급 평가 + 메모 (과제 면접 결과 화면 하단) ──
    function renderQQStarSection(selectedLevel, memo) {
      const boxes = STAR_LEVELS.map(lv => `
    <div class="ci-star-box${selectedLevel === lv.id ? ' active' : ''}" onclick="qqSetStarLevel(${lv.id})" style="border:2px solid ${selectedLevel === lv.id ? '#333' : '#e0e0e0'};border-radius:8px;padding:12px 14px;cursor:pointer;background:${selectedLevel === lv.id ? '#f5f5f5' : '#fff'};margin-bottom:8px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
        <span class="badge badge-gray" style="font-size:11px">(${lv.id})</span>
        <span style="font-weight:700;font-size:13px">${escHtml(lv.label)}</span>
        ${selectedLevel === lv.id ? '<span style="margin-left:auto;font-size:12px;color:#2a9a50;font-weight:700">✓ 선택됨</span>' : ''}
      </div>
      <div style="font-size:12px;color:#666;line-height:1.5">${escHtml(lv.desc)}</div>
    </div>`).join('');

      return `
  <div class="card" style="margin-top:16px">
    <div class="section-title mb-4">최종 등급 평가 (5단계 척도)</div>
    <div class="text-sm text-gray mb-16">동 레벨 스타플레이어 대비 기술/지식/사고방식 수준을 기준으로 판단 기준 가이드를 참고하여 등급을 선택하세요.</div>
    ${boxes}
    <div style="margin-top:16px">
      <label class="form-label">메모</label>
      <textarea id="qq-star-memo" class="form-control" rows="10" style="width:100%;box-sizing:border-box;height:5cm" placeholder="등급 판단 근거, 참고 사항 등을 자유롭게 작성하세요." onchange="qqSaveStarMemo(this.value)">${escHtml(memo || '')}</textarea>
      <div class="text-sm text-gray" style="margin-top:6px">※ "💾 결과 저장" 시 등급과 메모가 함께 저장됩니다.</div>
    </div>
  </div>`;
    }

    function qqSetStarLevel(level) {
      if (!qq) return;
      qq.starLevel = level;
      renderQQ();
    }

    function qqSaveStarMemo(val) {
      if (!qq) return;
      qq.starMemo = val;
    }

    function saveQQResult() {
      if (!qq || !qq.done) return;
      const isFail = qq.failed;
      const verdict = isFail ? '불합격 (Drop)' : '합격';
      const now = new Date().toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
      const opinion = document.getElementById('qq-opinion')?.value.trim() || '';
      qq.opinion = opinion;
      const starMemo = document.getElementById('qq-star-memo')?.value.trim() || '';
      qq.starMemo = starMemo;

      const record = {
        phase: 5,
        decisionRule: 'ANY_RED_FLAG_FAIL',
        savedAt: now,
        name: qq.name,
        pos: qq.pos,
        verdict,
        isFail,
        failQ: qq.failQ,
        failType: qq.failType,
        questions: qq.questions.map(q => ({ id: q.id, label: q.label, axis: q.axis, group: q.group, question: q.question, criteria: q.criteria })),
        results: qq.results,
        opinion,
        starLevel: qq.starLevel || null,
        starMemo,
      };

      let saved = [];
      try { saved = JSON.parse(localStorage.getItem('wm_qq_results') || '[]'); } catch (e) { saved = []; }
      saved.unshift(record);
      localStorage.setItem('wm_qq_results', JSON.stringify(saved));
      addAuditLog('우성 관리자', '과제 면접 결과 저장', `${qq.name} (${qq.pos}) → ${verdict}`);
      showToast('과제 면접 결과가 저장되었습니다. "과제 면접 결과" 메뉴에서 확인하세요.', 'success');
    }

    function printQQResult() {
      if (!qq || !qq.done) return;
      const isFail = qq.failed;
      const verdict = isFail ? '🚨 불합격 (Drop)' : '✅ 합격';
      const now = new Date().toLocaleString('ko-KR');
      const opinion = document.getElementById('qq-opinion')?.value.trim() || qq.opinion || '';
      const starMemo = document.getElementById('qq-star-memo')?.value.trim() || qq.starMemo || '';
      const starLv = STAR_LEVELS.find(l => l.id === qq.starLevel);

      const qRows = qq.questions.map(q => {
        const r = qq.results[q.id] || {};
        const skip = r.status === 'skip';
        const j = r.judgment || '미평가';
        const jTx = skip ? '⏭ 미진행' : j === 'gold' ? '🏅 Gold' : j === 'ok' ? '✅ 양호' : j === 'red' ? '🚨 Red' : '미평가';
        return `<tr>
      <td style="padding:6px 10px;border:1px solid #ddd;font-weight:700">${q.id}</td>
      <td style="padding:6px 10px;border:1px solid #ddd">${escHtml(q.label)}</td>
      <td style="padding:6px 10px;border:1px solid #ddd">${jTx}${r.redFlagType ? ' (' + escHtml(r.redFlagType) + ')' : ''}</td>
      <td style="padding:6px 10px;border:1px solid #ddd;font-size:12px;color:#555">${escHtml(r.memo || '')}</td>
    </tr>`;
      }).join('');

      const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
  <title>과제 면접 평가표 — ${qq.name}</title>
  <style>
    body { font-family: -apple-system, 'Malgun Gothic', sans-serif; font-size: 13px; color: #333; padding: 32px; max-width: 900px; margin: 0 auto; }
    h1 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
    .meta { color: #666; font-size: 13px; margin-bottom: 24px; }
    .verdict { font-size: 28px; font-weight: 700; padding: 16px 24px; border-radius: 8px; margin-bottom: 24px; text-align: center; background: ${isFail ? '#fff0f0' : '#f0fff4'}; color: ${isFail ? '#cc3333' : '#2a9a50'}; border: 2px solid ${isFail ? '#f0c0c0' : '#b0e8c0'}; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    th { background: #333; color: #fff; padding: 8px 10px; text-align: left; font-size: 12px; }
    h2 { font-size: 15px; font-weight: 700; margin: 24px 0 8px; border-bottom: 2px solid #333; padding-bottom: 6px; }
    @media print { body { padding: 16px; } }
  </style></head><body>
  <h1>과제(미니 퀘스트) 면접 평가표</h1>
  <div class="meta">지원자: <strong>${qq.name}</strong> &nbsp;|&nbsp; 포지션: <strong>${qq.pos}</strong> &nbsp;|&nbsp; 평가일: ${now}</div>
  <div class="verdict">${verdict}${isFail ? ` · ${qq.failQ} (${qq.failType || '미지정'})` : ''}</div>
  <h2>질문별 평가 상세</h2>
  <table><thead><tr><th style="width:50px">Q</th><th>항목</th><th style="width:140px">판정</th><th>메모</th></tr></thead><tbody>${qRows}</tbody></table>
  ${opinion ? `<h2>종합 의견</h2><div style="border:1px solid #e0e0e0;border-radius:6px;padding:14px 16px;font-size:13px;line-height:1.8;white-space:pre-wrap">${opinion.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>` : ''}
  ${starLv ? `<h2>최종 등급 평가</h2><div style="border:1px solid #e0e0e0;border-radius:6px;padding:14px 16px;font-size:13px;line-height:1.8"><strong>(${starLv.id}) ${starLv.label}</strong>${starMemo ? `<div style="white-space:pre-wrap;margin-top:8px;color:#555">${starMemo.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>` : ''}</div>` : ''}
  <div style="text-align:center;color:#aaa;font-size:11px;margin-top:32px;border-top:1px solid #eee;padding-top:12px">채용매칭 시스템 · 과제 면접 평가 · ${now}</div>
  <script>window.onload=function(){window.print();}<\/script>
  </body></html>`;

      const win = window.open('', '_blank');
      win.document.write(html);
      win.document.close();
    }

    // ── 과제 면접 결과 목록/상세 ──
    let currentQQResultIdx = -1;

    function loadQQResults() {
      try { return JSON.parse(localStorage.getItem('wm_qq_results') || '[]'); } catch (e) { return []; }
    }

    function renderQQResults() {
      const all = loadQQResults();
      const filter = document.getElementById('qqr-filter-verdict')?.value || '';
      const rows = filter ? all.filter(r => r.verdict.includes(filter)) : all;

      const total = all.length;
      const passed = all.filter(r => !r.isFail).length;
      const failed = all.filter(r => r.isFail).length;
      const passRate = total ? Math.round((passed / total) * 100) : 0;
      const statsEl = document.getElementById('qqr-stats');
      if (statsEl) {
        statsEl.innerHTML = `
      <div class="stat-card"><div class="stat-label">전체 평가</div><div class="stat-value">${total}</div><div class="stat-change text-gray">저장된 과제 면접 결과</div></div>
      <div class="stat-card"><div class="stat-label">합격</div><div class="stat-value text-green">${passed}</div><div class="stat-change text-gray">Red Flag 없음</div></div>
      <div class="stat-card"><div class="stat-label">불합격</div><div class="stat-value text-red">${failed}</div><div class="stat-change text-gray">Red Flag 발생</div></div>
      <div class="stat-card"><div class="stat-label">합격률</div><div class="stat-value">${passRate}<span style="font-size:16px;color:#888">%</span></div><div class="stat-change text-gray">${total}건 기준</div></div>
    `;
      }

      const tbody = document.getElementById('qqr-tbody');
      if (!tbody) return;
      if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">${filter ? '해당 조건의 결과가 없습니다' : '저장된 과제 면접 결과가 없습니다'}</div></div></td></tr>`;
        return;
      }
      tbody.innerHTML = rows.map(r => {
        const realIdx = all.indexOf(r);
        const isFail = r.isFail;
        const badgeCls = isFail ? 'badge-red' : 'badge-green';
        const verdictTx = isFail ? '🚨 불합격' : '✅ 합격';
        return `<tr>
      <td><strong>${escHtml(r.name)}</strong></td>
      <td>${escHtml(r.pos)}</td>
      <td><span class="badge ${badgeCls}">${verdictTx}</span></td>
      <td>${isFail ? `<span class="badge badge-red">${escHtml(r.failQ || '')} · ${escHtml(r.failType || '미지정')}</span>` : '<span class="text-gray text-sm">없음</span>'}</td>
      <td class="text-gray text-sm">${r.savedAt || '—'}</td>
      <td class="flex gap-8">
        <button class="btn btn-secondary btn-sm" onclick="openQQResultDetail(${realIdx})">상세 보기</button>
        <button class="btn btn-danger btn-sm" onclick="deleteQQResultAt(${realIdx})">삭제</button>
      </td>
    </tr>`;
      }).join('');
    }

    function clearAllQQResults() {
      const all = loadQQResults();
      if (!all.length) { showToast('삭제할 결과가 없습니다.', 'info'); return; }
      showConfirm('전체 삭제', `저장된 과제 면접 결과 ${all.length}건을 모두 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`, () => {
        localStorage.removeItem('wm_qq_results');
        showToast('전체 과제 면접 결과가 삭제되었습니다.', 'success');
        renderQQResults();
      });
    }

    function deleteQQResultAt(idx) {
      const all = loadQQResults();
      const r = all[idx];
      if (!r) return;
      showConfirm('과제 면접 결과 삭제', `"${r.name}" (${r.pos}) 과제 면접 결과를 삭제하시겠습니까?`, () => {
        all.splice(idx, 1);
        localStorage.setItem('wm_qq_results', JSON.stringify(all));
        showToast('과제 면접 결과가 삭제되었습니다.', 'success');
        renderQQResults();
      });
    }

    function openQQResultDetail(idx) {
      const all = loadQQResults();
      const r = all[idx];
      if (!r) return;
      currentQQResultIdx = idx;

      document.getElementById('qqrd-title').textContent = `과제 면접 결과 — ${r.name}`;
      document.getElementById('qqrd-subtitle').textContent = `${r.pos} · ${r.savedAt}`;

      const isFail = r.isFail;
      const vClass = isFail ? 'ci-result-fail' : 'ci-result-pass';
      const verdict = isFail ? '🚨 불합격 (Drop)' : '✅ 합격';
      const questions = r.questions || [];
      const results = r.results || {};

      const qSummary = questions.length
        ? questions.map(q => {
          const res = results[q.id] || {};
          const skip = res.status === 'skip';
          const j = res.judgment || '';
          return `<div class="card mb-8" style="padding:0;overflow:hidden">
          <div style="background:#f8f8f8;padding:10px 16px;border-bottom:1px solid #eee">
            <div class="flex items-center gap-8 mb-8">
              <span class="badge badge-gray" style="font-size:11px">${q.id}</span>
              <span class="font-bold" style="font-size:13px">${escHtml(q.label)}</span>
              <span class="badge badge-gray" style="font-size:11px">${escHtml(q.axis)}</span>
              ${skip ? '<span class="badge badge-gray" style="font-size:11px">미진행</span>' : `
              <button class="ci-btn-gold${j === 'gold' ? ' sel' : ''}" style="padding:2px 10px;font-size:11px" onclick="qqrdSetJudgment(${idx},'${q.id}','gold')">🏅 Gold</button>
              <button class="ci-btn-g${j === 'ok' ? ' sel' : ''}" style="padding:2px 10px;font-size:11px" onclick="qqrdSetJudgment(${idx},'${q.id}','ok')">✅ 양호</button>
              <button class="ci-btn-r${j === 'red' ? ' sel' : ''}" style="padding:2px 10px;font-size:11px" onclick="qqrdSetJudgment(${idx},'${q.id}','red')">🚨 Red</button>`}
            </div>
            ${!skip && j === 'red' ? `
            <select class="form-control mb-8" style="margin-bottom:8px" onchange="qqrdSetRedFlagType(${idx},'${q.id}',this.value)">
              <option value="">-- Red Flag 유형 선택 --</option>
              ${RED_FLAG_TYPES.map(t => `<option value="${escHtml(t)}"${res.redFlagType === t ? ' selected' : ''}>${escHtml(t)}</option>`).join('')}
            </select>` : ''}
            ${!skip ? `<textarea class="form-control" style="font-size:12px;width:100%;box-sizing:border-box" rows="2" placeholder="메모..." onchange="qqrdSaveMemo(${idx},'${q.id}',this.value)">${escHtml(res.memo || '')}</textarea>` : ''}
          </div>
        </div>`;
        }).join('')
        : '<p class="text-gray text-sm">저장된 평가 상세가 없습니다.</p>';

      document.getElementById('qqrd-body').innerHTML = `
    <div class="card mb-16" style="border-left:4px solid ${isFail ? '#cc3333' : '#2a9a50'}">
      <div class="ci-result-verdict ${vClass}" style="font-size:28px">${verdict}</div>
      <div style="text-align:center;font-size:13px;color:#888">${isFail ? `Red Flag: ${escHtml(r.failQ || '')} · ${escHtml(r.failType || '미지정')}` : '결정 규칙: Red Flag 1개 발생 시 즉시 불합격'}</div>
    </div>
    <div class="section-title mb-12">질문별 평가 상세</div>
    ${qSummary}
    <div class="card mt-16" style="margin-top:16px">
      <div class="flex items-center justify-between mb-12">
        <div class="section-title">종합 의견</div>
        <button class="btn btn-primary btn-sm" onclick="saveQQOpinion(${idx})">저장</button>
      </div>
      <textarea id="qqrd-opinion" class="form-control" rows="10" style="width:100%;box-sizing:border-box;height:5cm" placeholder="면접 전반에 대한 종합 의견, 특이사항, 추천/비추천 근거 등을 자유롭게 작성하세요.">${escHtml(r.opinion || '')}</textarea>
    </div>
    <div class="card mt-16" style="margin-top:16px">
      <div class="flex items-center justify-between mb-12">
        <div class="section-title">최종 등급 평가 (5단계 척도)</div>
        <button class="btn btn-primary btn-sm" onclick="saveQQStarDetail(${idx})">저장</button>
      </div>
      ${STAR_LEVELS.map(lv => `
      <div class="ci-star-box${r.starLevel === lv.id ? ' active' : ''}" onclick="qqrdSetStarLevel(${idx},${lv.id})" style="border:2px solid ${r.starLevel === lv.id ? '#333' : '#e0e0e0'};border-radius:8px;padding:12px 14px;cursor:pointer;background:${r.starLevel === lv.id ? '#f5f5f5' : '#fff'};margin-bottom:8px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
          <span class="badge badge-gray" style="font-size:11px">(${lv.id})</span>
          <span style="font-weight:700;font-size:13px">${escHtml(lv.label)}</span>
          ${r.starLevel === lv.id ? '<span style="margin-left:auto;font-size:12px;color:#2a9a50;font-weight:700">✓ 선택됨</span>' : ''}
        </div>
        <div style="font-size:12px;color:#666;line-height:1.5">${escHtml(lv.desc)}</div>
      </div>`).join('')}
      <div style="margin-top:16px">
        <label class="form-label">메모</label>
        <textarea id="qqrd-star-memo" class="form-control" rows="10" style="width:100%;box-sizing:border-box;height:5cm" placeholder="등급 판단 근거, 참고 사항 등을 자유롭게 작성하세요.">${escHtml(r.starMemo || '')}</textarea>
      </div>
    </div>
  `;
      nav('qq-result-detail');
    }

    function qqrdSetStarLevel(idx, level) {
      const all = loadQQResults();
      if (!all[idx]) return;
      all[idx].starLevel = level;
      localStorage.setItem('wm_qq_results', JSON.stringify(all));
      openQQResultDetail(idx);
    }

    function saveQQStarDetail(idx) {
      const all = loadQQResults();
      if (!all[idx]) return;
      all[idx].starMemo = document.getElementById('qqrd-star-memo')?.value.trim() || '';
      localStorage.setItem('wm_qq_results', JSON.stringify(all));
      showToast('최종 등급 평가가 저장되었습니다.', 'success');
    }

    function qqrdRecomputeVerdict(r) {
      const anyRed = Object.entries(r.results || {}).find(([, v]) => v.judgment === 'red');
      r.isFail = !!anyRed;
      r.verdict = r.isFail ? '불합격 (Drop)' : '합격';
      r.failQ = anyRed ? anyRed[0] : null;
      r.failType = anyRed ? (anyRed[1].redFlagType || '') : null;
    }

    function qqrdSetJudgment(idx, qId, judgment) {
      const all = loadQQResults();
      const r = all[idx];
      if (!r) return;
      r.results = r.results || {};
      r.results[qId] = r.results[qId] || {};
      r.results[qId].judgment = r.results[qId].judgment === judgment ? '' : judgment;
      qqrdRecomputeVerdict(r);
      localStorage.setItem('wm_qq_results', JSON.stringify(all));
      openQQResultDetail(idx);
    }

    function qqrdSetRedFlagType(idx, qId, type) {
      const all = loadQQResults();
      const r = all[idx];
      if (!r) return;
      r.results = r.results || {};
      r.results[qId] = r.results[qId] || {};
      r.results[qId].redFlagType = type;
      qqrdRecomputeVerdict(r);
      localStorage.setItem('wm_qq_results', JSON.stringify(all));
    }

    function qqrdSaveMemo(idx, qId, val) {
      const all = loadQQResults();
      const r = all[idx];
      if (!r) return;
      r.results = r.results || {};
      r.results[qId] = r.results[qId] || {};
      r.results[qId].memo = val;
      localStorage.setItem('wm_qq_results', JSON.stringify(all));
    }

    function saveQQOpinion(idx) {
      const all = loadQQResults();
      if (!all[idx]) return;
      const opinion = document.getElementById('qqrd-opinion')?.value.trim() || '';
      all[idx].opinion = opinion;
      localStorage.setItem('wm_qq_results', JSON.stringify(all));
      showToast('종합 의견이 저장되었습니다.', 'success');
    }

    // ══════════════════════════════════════════════════
    //  면접 일정 수립 시스템
    // ══════════════════════════════════════════════════

    let scheduleData = [];
    let interviewersPool = [];
    let calYear = new Date().getFullYear();
    let calMonth = new Date().getMonth();

    function loadScheduleData() {
      try { scheduleData = JSON.parse(localStorage.getItem('wm_schedule') || '[]'); } catch (e) { scheduleData = []; }
      try { interviewersPool = JSON.parse(localStorage.getItem('wm_interviewers') || '[]'); } catch (e) { interviewersPool = []; }
    }

    function saveScheduleData() {
      localStorage.setItem('wm_schedule', JSON.stringify(scheduleData));
      localStorage.setItem('wm_interviewers', JSON.stringify(interviewersPool));
      sbSave('wm_schedule', scheduleData);
      sbSave('wm_interviewers', interviewersPool);
    }

    // ── 페이지 초기화 ──
    function initSchedulePage() {
      loadScheduleData();
      const yearSel = document.getElementById('cal-year');
      const monthSel = document.getElementById('cal-month');
      const curYear = new Date().getFullYear();
      yearSel.innerHTML = '';
      for (let y = curYear - 1; y <= curYear + 2; y++) {
        const opt = document.createElement('option');
        opt.value = y; opt.textContent = y + '년';
        if (y === calYear) opt.selected = true;
        yearSel.appendChild(opt);
      }
      monthSel.innerHTML = '';
      for (let m = 0; m < 12; m++) {
        const opt = document.createElement('option');
        opt.value = m; opt.textContent = (m + 1) + '월';
        if (m === calMonth) opt.selected = true;
        monthSel.appendChild(opt);
      }
      syncCalFilterDropdowns();
      renderCalendar();
    }

    // ── 달력 ──
    function calShiftMonth(delta) {
      calMonth += delta;
      if (calMonth < 0) { calMonth = 11; calYear--; }
      if (calMonth > 11) { calMonth = 0; calYear++; }
      const yearSel = document.getElementById('cal-year');
      const monthSel = document.getElementById('cal-month');
      if (yearSel) yearSel.value = calYear;
      if (monthSel) monthSel.value = calMonth;
      renderCalendar();
    }

    let calFilterIvs = [];   // 달력 면접관 멀티필터

    function addCalIvFilter() {
      const sel = document.getElementById('cal-iv-add-sel');
      const v = sel?.value;
      if (!v || calFilterIvs.includes(v)) { if (sel) sel.value = ''; return; }
      calFilterIvs.push(v);
      if (sel) sel.value = '';
      syncCalFilterDropdowns();
      renderCalIvTags();
      renderCalendar();
    }

    function removeCalIvFilter(name) {
      calFilterIvs = calFilterIvs.filter(n => n !== name);
      syncCalFilterDropdowns();
      renderCalIvTags();
      renderCalendar();
    }

    function renderCalIvTags() {
      const wrap = document.getElementById('cal-iv-filter-tags');
      if (!wrap) return;
      wrap.innerHTML = calFilterIvs.map(name =>
        `<span class="iv-filter-tag">${escHtml(name)}<button onclick="removeCalIvFilter('${name.replace(/'/g, "\\'")}')">×</button></span>`
      ).join('');
    }

    function resetCalFilters() {
      calFilterIvs = [];
      renderCalIvTags();
      syncCalFilterDropdowns();
      renderCalendar();
    }

    function syncCalFilterDropdowns() {
      const sel = document.getElementById('cal-iv-add-sel');
      if (!sel) return;
      const allNames = [...new Set(interviewersPool.map(iv => iv.name))];
      sel.innerHTML = '<option value="">면접관 추가</option>';
      allNames.filter(n => !calFilterIvs.includes(n)).forEach(name => {
        const o = document.createElement('option');
        o.value = name; o.textContent = name;
        sel.appendChild(o);
      });
    }

    function calDateStr(d) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    function renderCalendar() {
      const yearSel = document.getElementById('cal-year');
      const monthSel = document.getElementById('cal-month');
      if (yearSel) calYear = parseInt(yearSel.value);
      if (monthSel) calMonth = parseInt(monthSel.value);

      document.getElementById('cal-month-title').textContent = `${calYear}년 ${calMonth + 1}월`;

      const firstDay = new Date(calYear, calMonth, 1);
      const lastDay = new Date(calYear, calMonth + 1, 0);
      const startDow = firstDay.getDay();
      const today = new Date();
      const todayStr = calDateStr(today);
      const DOW_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
      const STATUS_LABEL = { allday: '종일', morning: '오전', afternoon: '오후', unavailable: '불가', partial: '부분불가' };

      let html = '<div class="cal-grid">';
      DOW_LABELS.forEach(d => { html += `<div class="cal-dow">${d}</div>`; });

      const renderCell = (date, isOtherMonth) => {
        const ds = calDateStr(date);
        const dow = date.getDay();
        const isToday = ds === todayStr;
        const dayClass = ['cal-cell', isOtherMonth ? 'other-month' : '', isToday ? 'today' : '', dow === 0 ? 'sun' : dow === 6 ? 'sat' : ''].filter(Boolean).join(' ');

        let entries = scheduleData.filter(e => e.date === ds);
        if (calFilterIvs.length) entries = entries.filter(e => calFilterIvs.includes(e.interviewer));
        const appts = interviewAppointments.filter(a => {
          if (!calFilterIvs.length) return a.date === ds;
          const ivs = Array.isArray(a.interviewers) ? a.interviewers : [a.interviewer];
          return a.date === ds && ivs.some(iv => calFilterIvs.includes(iv));
        });

        // 항상 표시: compact 칩 목록
        const apptCompact = appts.map(a => {
          const ivLabel = Array.isArray(a.interviewers) ? a.interviewers.join(', ') : (a.interviewer || '');
          return `<div class="appt-compact" title="${escHtml(a.candidateName)} · ${a.type} · ${escHtml(ivLabel)}">${escHtml(a.candidateName)} ${a.time}</div>`;
        }).join('');
        const availCompact = entries.map(e => {
          return `<div class="avail-compact ${e.status}" title="${e.interviewer} · ${STATUS_LABEL[e.status] || e.status}">${e.interviewer} ${STATUS_LABEL[e.status] || e.status}</div>`;
        }).join('');
        const compactListHtml = (apptCompact || availCompact)
          ? `<div class="cal-compact-list">${apptCompact}${availCompact}</div>` : '';

        const hasItems = appts.length || entries.length;
        const moreHint = hasItems ? `<div class="cal-more-hint">자세히 보기 ▾</div>` : '';
        const closeHint = `<div class="cal-close-hint">접기 ▴</div>`;

        // 확장 영역: 자세히 보기
        const apptChipsFull = appts.map((a, ai) => {
          const apptIdx = interviewAppointments.indexOf(a);
          const ivLabel = Array.isArray(a.interviewers) ? a.interviewers.join(', ') : (a.interviewer || '');
          return `<div class="appt-chip" onclick="event.stopPropagation()">
        <span><strong>${escHtml(a.candidateName)}</strong>&nbsp;${a.type}&nbsp;${a.time}<br><span style="font-size:9px;opacity:.7">${escHtml(ivLabel)}</span></span>
        <button class="appt-chip-edit" onclick="event.stopPropagation();openEditAppt(${apptIdx})" title="수정">✏️</button>
      </div>`;
        }).join('');

        const availChipsFull = entries.map(e => {
          const timeHint = (e.status === 'partial' && e.blockTime)
            ? `<span class="av-time"> (${e.blockTime} 불가)</span>` : '';
          const esc = e.interviewer.replace(/'/g, "\\'");
          return `<div class="av-chip ${e.status}" onclick="event.stopPropagation();openEditSchedule('${ds}','${esc}')">
        <span class="av-name">${e.interviewer}</span><span class="av-status">&nbsp;${STATUS_LABEL[e.status] || e.status}</span>${timeHint}
      </div>`;
        }).join('');

        const bodyHtml = `<div class="cal-cell-body">
      ${appts.length ? `<div class="cal-section-label">확정 면접</div>${apptChipsFull}` : ''}
      ${entries.length ? `<div class="cal-section-label">면접관 가용</div>${availChipsFull}` : ''}
      ${!isOtherMonth ? `<button class="cal-add-btn" onclick="event.stopPropagation();openAddSchedule('${ds}')">+ 일정 등록</button>` : ''}
      ${closeHint}
    </div>`;

        return `<div class="${dayClass}" data-date="${ds}" onclick="toggleCalCell('${ds}')">
      <div class="cal-day-num">${date.getDate()}</div>
      ${compactListHtml}
      ${moreHint}
      ${bodyHtml}
    </div>`;
      };

      for (let i = 0; i < startDow; i++) {
        html += renderCell(new Date(calYear, calMonth, i - startDow + 1), true);
      }
      for (let d = 1; d <= lastDay.getDate(); d++) {
        html += renderCell(new Date(calYear, calMonth, d), false);
      }
      const trailing = (7 - ((startDow + lastDay.getDate()) % 7)) % 7;
      for (let i = 1; i <= trailing; i++) {
        html += renderCell(new Date(calYear, calMonth + 1, i), true);
      }
      html += '</div>';
      document.getElementById('cal-grid-wrap').innerHTML = html;
      // 확장 상태 복원
      if (expandedCalDate) {
        const cell = document.querySelector(`.cal-cell[data-date="${expandedCalDate}"]`);
        if (cell) cell.classList.add('expanded');
      }
    }

    // ── 일정 모달 ──
    function openAddSchedule(dateStr) {
      document.getElementById('sch-modal-title').textContent = '일정 등록';
      document.getElementById('sch-edit-idx').value = '-1';
      document.getElementById('sch-date').value = dateStr || calDateStr(new Date());
      document.getElementById('sch-status').value = 'allday';
      document.getElementById('sch-blocktime').value = '';
      document.getElementById('sch-delete-btn').style.display = 'none';
      toggleBlockTime();
      // 필터에서 선택된 면접관이 1명이면 자동 선택
      const filterIv = calFilterIvs.length === 1 ? calFilterIvs[0] : '';
      syncSchModalInterviewers(filterIv);
      openModal('modal-schedule');
    }

    function openEditSchedule(date, interviewer) {
      const idx = scheduleData.findIndex(e => e.date === date && e.interviewer === interviewer);
      if (idx < 0) return;
      const e = scheduleData[idx];
      document.getElementById('sch-modal-title').textContent = '일정 수정';
      document.getElementById('sch-edit-idx').value = idx;
      document.getElementById('sch-date').value = e.date;
      syncSchModalInterviewers(e.interviewer);
      document.getElementById('sch-status').value = e.status;
      document.getElementById('sch-blocktime').value = e.blockTime || '';
      document.getElementById('sch-delete-btn').style.display = '';
      toggleBlockTime();
      openModal('modal-schedule');
    }

    function syncSchModalInterviewers(selIv) {
      loadScheduleData();
      const ivSel = document.getElementById('sch-interviewer');
      ivSel.innerHTML = '<option value="">-- 면접관 선택 --</option>';
      interviewersPool.forEach(iv => {
        const o = document.createElement('option');
        o.value = iv.name; o.textContent = iv.name;
        if (iv.name === selIv) o.selected = true;
        ivSel.appendChild(o);
      });
    }

    function toggleBlockTime() {
      const status = document.getElementById('sch-status').value;
      document.getElementById('sch-blocktime-wrap').style.display = status === 'partial' ? '' : 'none';
    }

    function saveScheduleEntry() {
      const date = document.getElementById('sch-date').value;
      const interviewer = document.getElementById('sch-interviewer').value;
      const status = document.getElementById('sch-status').value;
      const blockTime = document.getElementById('sch-blocktime').value.trim();

      if (!date || !interviewer) { showToast('날짜와 면접관은 필수입니다.', 'error'); return; }
      if (status === 'partial' && !blockTime) { showToast('불가 시간대를 입력하세요. (예: 14:00-16:00)', 'error'); return; }

      const entry = { date, interviewer, status, blockTime: status === 'partial' ? blockTime : '' };
      const editIdx = parseInt(document.getElementById('sch-edit-idx').value);

      if (editIdx >= 0) {
        scheduleData[editIdx] = entry;
      } else {
        const dupIdx = scheduleData.findIndex(e => e.date === date && e.interviewer === interviewer);
        if (dupIdx >= 0) scheduleData[dupIdx] = entry;
        else scheduleData.push(entry);
      }

      saveScheduleData();
      closeModal('modal-schedule');
      renderCalendar();
      addAuditLog('면접 일정', '일정 저장', `${interviewer} · ${date}`);
      showToast('일정이 저장되었습니다.', 'success');

      if (gsheetsToken && gsheetsConfig.spreadsheetId) {
        syncEntryToSheets(entry).catch(err => showToast('시트 동기화 실패: ' + err.message, 'error'));
      }
    }

    function deleteScheduleEntry() {
      const editIdx = parseInt(document.getElementById('sch-edit-idx').value);
      if (editIdx < 0) return;
      const entry = scheduleData[editIdx];
      scheduleData.splice(editIdx, 1);
      saveScheduleData();
      closeModal('modal-schedule');
      renderCalendar();
      showToast('일정이 삭제되었습니다.', 'info');
    }

    // ── 면접관 풀 ──
    function openInterviewerPool() {
      loadScheduleData();
      renderIVPool();
      openModal('modal-interviewer');
    }

    function renderIVPool() {
      const el = document.getElementById('iv-pool-list');
      if (!interviewersPool.length) {
        el.innerHTML = '<div class="text-gray text-sm" style="padding:12px 0">등록된 면접관이 없습니다.</div>';
        return;
      }
      el.innerHTML = interviewersPool.map((iv, i) => `
    <div class="iv-row">
      <div style="flex:1">
        <strong>${iv.name}</strong>
        <span class="text-gray text-sm" style="margin-left:8px">${iv.positions.length ? iv.positions.join(', ') : '직무 미지정'}</span>
      </div>
      <button class="btn btn-secondary btn-sm" onclick="removeInterviewer(${i})">삭제</button>
    </div>
  `).join('');
    }

    function addInterviewer() {
      const name = document.getElementById('iv-new-name').value.trim();
      const posRaw = document.getElementById('iv-new-positions').value.trim();
      if (!name) { showToast('면접관 이름을 입력하세요.', 'error'); return; }
      if (interviewersPool.find(iv => iv.name === name)) { showToast('이미 등록된 면접관입니다.', 'error'); return; }
      const positions = posRaw ? posRaw.split(',').map(p => p.trim()).filter(Boolean) : [];
      interviewersPool.push({ name, positions });
      saveScheduleData();
      document.getElementById('iv-new-name').value = '';
      document.getElementById('iv-new-positions').value = '';
      renderIVPool();
      syncCalFilterDropdowns();
      showToast(`${name} 면접관이 추가되었습니다.`, 'success');
    }

    function removeInterviewer(idx) {
      const name = interviewersPool[idx]?.name;
      interviewersPool.splice(idx, 1);
      saveScheduleData();
      renderIVPool();
      syncCalFilterDropdowns();
      if (name) showToast(`${name} 면접관이 삭제되었습니다.`, 'info');
    }

    // ══════════════════════════════════════════════════
    //  Google Sheets 연동
    // ══════════════════════════════════════════════════

    let gsheetsToken = null;
    const gsheetsConfig = {
      get clientId() { return localStorage.getItem('wm_gs_client_id') || ''; },
      get spreadsheetId() { return localStorage.getItem('wm_gs_sheet_id') || ''; },
    };
    const GS_RANGE = 'Sheet1!A:E';
    const GS_HEADERS = ['날짜', '면접관', '채용 직무', '가용 상태', '세부 제한 시간'];

    function loadGsheetsConfigUI() {
      const cidEl = document.getElementById('gs-client-id');
      const sidEl = document.getElementById('gs-sheet-id');
      if (cidEl) cidEl.value = gsheetsConfig.clientId;
      if (sidEl) sidEl.value = gsheetsConfig.spreadsheetId;
      updateGsSheetsStatus();
    }

    function saveGsheetsConfig() {
      const cid = document.getElementById('gs-client-id').value.trim();
      const sid = document.getElementById('gs-sheet-id').value.trim();
      localStorage.setItem('wm_gs_client_id', cid);
      localStorage.setItem('wm_gs_sheet_id', sid);
      showToast('구글 시트 설정이 저장되었습니다.', 'success');
      updateGsSheetsStatus();
    }

    function updateGsSheetsStatus() {
      const el = document.getElementById('gs-status');
      if (!el) return;
      if (gsheetsToken) {
        el.innerHTML = '<span class="badge badge-green">연결됨</span>';
      } else if (gsheetsConfig.clientId && gsheetsConfig.spreadsheetId) {
        el.innerHTML = '<span class="badge badge-gray">설정됨 · 미연결</span>';
      } else {
        el.innerHTML = '<span class="badge badge-gray">미설정</span>';
      }
    }

    function initGoogleAuth() {
      if (!gsheetsConfig.clientId) { showToast('OAuth Client ID를 먼저 입력하고 저장하세요.', 'error'); return; }
      if (!window.google?.accounts?.oauth2) { showToast('Google 라이브러리 로딩 중입니다. 잠시 후 다시 시도하세요.', 'error'); return; }
      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: gsheetsConfig.clientId,
        scope: 'https://www.googleapis.com/auth/spreadsheets',
        callback: resp => {
          if (resp.error) { showToast('구글 인증 실패: ' + resp.error, 'error'); return; }
          gsheetsToken = resp.access_token;
          updateGsSheetsStatus();
          showToast('구글 계정 연결 완료! 이제 일정 달력과 시트가 동기화됩니다.', 'success');
        }
      });
      tokenClient.requestAccessToken();
    }

    function gsFetch(url, opts = {}) {
      return fetch(url, {
        ...opts,
        headers: { 'Authorization': `Bearer ${gsheetsToken}`, 'Content-Type': 'application/json', ...(opts.headers || {}) }
      }).then(r => {
        if (!r.ok) return r.json().then(e => { throw new Error(e.error?.message || r.statusText); });
        return r.json();
      });
    }

    async function syncFromSheets() {
      if (!gsheetsToken) { showToast('구글 시트에 먼저 연결하세요. (설정 → 구글 시트 연동)', 'error'); return; }
      if (!gsheetsConfig.spreadsheetId) { showToast('스프레드시트 ID를 설정하세요.', 'error'); return; }
      try {
        showToast('구글 시트에서 불러오는 중...', 'info');
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${gsheetsConfig.spreadsheetId}/values/${encodeURIComponent(GS_RANGE)}`;
        const data = await gsFetch(url);
        const rows = (data.values || []).slice(1);
        loadScheduleData();
        scheduleData = rows
          .filter(r => r[0] && r[1] && r[2] && r[3])
          .map(r => ({ date: r[0].trim(), interviewer: r[1].trim(), position: r[2].trim(), status: r[3].trim(), blockTime: (r[4] || '').trim() }));
        saveScheduleData();
        renderCalendar();
        showToast(`구글 시트에서 ${scheduleData.length}건을 불러왔습니다.`, 'success');
      } catch (err) {
        showToast('동기화 실패: ' + err.message, 'error');
      }
    }

    async function syncEntryToSheets(entry) {
      if (!gsheetsToken || !gsheetsConfig.spreadsheetId) return;
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${gsheetsConfig.spreadsheetId}/values/${encodeURIComponent(GS_RANGE)}`;
      const data = await gsFetch(url);
      const rows = data.values || [];
      let rowIdx = -1;
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === entry.date && rows[i][1] === entry.interviewer && rows[i][2] === entry.position) { rowIdx = i; break; }
      }
      const rowData = [entry.date, entry.interviewer, entry.position, entry.status, entry.blockTime || ''];
      const sheetRow = rowIdx + 1;
      if (rowIdx >= 0) {
        await gsFetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${gsheetsConfig.spreadsheetId}/values/Sheet1!A${sheetRow}:E${sheetRow}?valueInputOption=RAW`,
          { method: 'PUT', body: JSON.stringify({ range: `Sheet1!A${sheetRow}:E${sheetRow}`, majorDimension: 'ROWS', values: [rowData] }) }
        );
      } else {
        await gsFetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${gsheetsConfig.spreadsheetId}/values/Sheet1!A:E:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
          { method: 'POST', body: JSON.stringify({ range: 'Sheet1!A:E', majorDimension: 'ROWS', values: [rowData] }) }
        );
      }
    }

    async function initSheetsHeader() {
      if (!gsheetsToken) { showToast('Google 계정을 먼저 연결하세요.', 'error'); return; }
      if (!gsheetsConfig.spreadsheetId) { showToast('스프레드시트 ID를 설정하세요.', 'error'); return; }
      try {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${gsheetsConfig.spreadsheetId}/values/${encodeURIComponent(GS_RANGE)}`;
        const data = await gsFetch(url);
        const rows = data.values || [];
        if (rows.length === 0) {
          await gsFetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${gsheetsConfig.spreadsheetId}/values/Sheet1!A1:E1?valueInputOption=RAW`,
            { method: 'PUT', body: JSON.stringify({ range: 'Sheet1!A1:E1', majorDimension: 'ROWS', values: [GS_HEADERS] }) }
          );
          showToast('구글 시트에 헤더 행이 초기화되었습니다.', 'success');
        } else {
          showToast('시트에 이미 데이터가 있습니다. 헤더 초기화를 건너뜁니다.', 'info');
        }
      } catch (err) {
        showToast('헤더 초기화 실패: ' + err.message, 'error');
      }
    }

    // ══════════════════════════════════════════════════
    //  면접 일정 탭 전환
    // ══════════════════════════════════════════════════
    function switchScheduleTab(t) {
      document.getElementById('schtab-cal').classList.toggle('active', t === 'cal');
      document.getElementById('schtab-assign').classList.toggle('active', t === 'assign');
      document.getElementById('schedule-tab-cal').style.display = t === 'cal' ? '' : 'none';
      document.getElementById('schedule-tab-assign').style.display = t === 'assign' ? '' : 'none';
      document.getElementById('sch-cal-btns').style.display = t === 'cal' ? '' : 'none';
      if (t === 'assign') renderAssignList();
    }

    // ══════════════════════════════════════════════════
    //  매칭분석 procStatus
    // ══════════════════════════════════════════════════
    function changeProcStatus(idx, status) {
      const m = matchingData[idx];
      if (!m) return;
      m.procStatus = status;
      if (status) m.rejected = false; // 상태 변경 시 불합격 해제
      if (status === '최종합격') {
        m.finalPassDate = new Date().toLocaleDateString('ko-KR',
          { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '-').replace('.', '');
      }
      saveData();
      filterMatching();
      renderDashboard();
      const label = { '': '검토중', '과제/공통면접': '과제/공통면접 진행', '최종면접': '최종면접 진행', '최종합격': '최종합격' }[status] || status;
      showToast(`"${m.applicant}" 상태가 [${label}]로 변경되었습니다.`, 'success');
      if (currentPage === 'schedule') renderAssignList();
    }

    // ══════════════════════════════════════════════════
    //  면접 설정 (시간/대기시간)
    // ══════════════════════════════════════════════════
    const DEFAULT_IV_TYPES = [
      { key: '과제면접', label: '과제 면접', duration: 60, buffer: 15 },
      { key: '공통면접', label: '공통 면접', duration: 45, buffer: 10 },
      { key: '최종면접', label: '최종 면접', duration: 60, buffer: 15 },
    ];

    let interviewSettings = { types: [] };

    function loadInterviewSettings() {
      try {
        const stored = JSON.parse(localStorage.getItem('wm_iv_settings') || 'null');
        interviewSettings = stored || { types: JSON.parse(JSON.stringify(DEFAULT_IV_TYPES)) };
      } catch (e) {
        interviewSettings = { types: JSON.parse(JSON.stringify(DEFAULT_IV_TYPES)) };
      }
    }

    function saveInterviewSettings() {
      const rows = document.querySelectorAll('#ivset-rows .ivset-row');
      interviewSettings.types.forEach((t, i) => {
        t.duration = parseInt(rows[i]?.querySelector('.ivset-dur')?.value) || t.duration;
        t.buffer = parseInt(rows[i]?.querySelector('.ivset-buf')?.value) || t.buffer;
      });
      localStorage.setItem('wm_iv_settings', JSON.stringify(interviewSettings));
      sbSave('wm_iv_settings', interviewSettings);
      showToast('면접 설정이 저장되었습니다.', 'success');
    }

    function resetInterviewSettings() {
      interviewSettings = { types: JSON.parse(JSON.stringify(DEFAULT_IV_TYPES)) };
      localStorage.setItem('wm_iv_settings', JSON.stringify(interviewSettings));
      sbSave('wm_iv_settings', interviewSettings);
      renderInterviewSettingsUI();
      showToast('초기값으로 재설정되었습니다.', 'info');
    }

    function renderInterviewSettingsUI() {
      const wrap = document.getElementById('ivset-rows');
      if (!wrap) return;
      wrap.innerHTML = interviewSettings.types.map((t, i) => `
    <div class="ivset-row">
      <span style="font-weight:600">${t.label}</span>
      <div style="display:flex;align-items:center;gap:6px">
        <input type="number" class="form-control ivset-dur" value="${t.duration}" min="15" max="240" step="15" style="width:80px" />
        <span class="text-gray text-sm">분</span>
      </div>
      <div style="display:flex;align-items:center;gap:6px">
        <input type="number" class="form-control ivset-buf" value="${t.buffer}" min="0" max="60" step="5" style="width:80px" />
        <span class="text-gray text-sm">분</span>
      </div>
    </div>
  `).join('');
    }

    // ══════════════════════════════════════════════════
    //  면접자 일정 배정
    // ══════════════════════════════════════════════════
    let interviewAppointments = [];
    let assignSelectedDate = '';
    let assignSelectedTime = '';

    function loadInterviewAppointments() {
      try { interviewAppointments = JSON.parse(localStorage.getItem('wm_iv_appts') || '[]'); } catch (e) { interviewAppointments = []; }
    }

    function saveInterviewAppointments() {
      localStorage.setItem('wm_iv_appts', JSON.stringify(interviewAppointments));
      sbSave('wm_iv_appts', interviewAppointments);
    }

    function toggleAssignRejected() {
      assignShowRejected = !assignShowRejected;
      const btn = document.getElementById('assign-rejected-btn');
      if (btn) {
        btn.textContent = assignShowRejected ? '불합격 제외' : '불합격 포함';
        btn.classList.toggle('btn-primary', assignShowRejected);
        btn.classList.toggle('btn-secondary', !assignShowRejected);
      }
      renderAssignList();
    }

    function renderAssignList() {
      loadInterviewAppointments();
      const filter = document.getElementById('assign-filter-status')?.value || '';
      const yearFilter = document.getElementById('assign-filter-year')?.value || '';
      const monthFilter = document.getElementById('assign-filter-month')?.value || '';
      const wrap = document.getElementById('assign-list-wrap');
      if (!wrap) return;

      // 연도/월 셀렉트 옵션 동적 생성
      const allDates = matchingData.map(m => m.date).filter(Boolean);
      const years = [...new Set(allDates.map(d => d.slice(0, 4)))].sort().reverse();
      const yearSel = document.getElementById('assign-filter-year');
      if (yearSel) {
        const curYear = yearSel.value;
        yearSel.innerHTML = '<option value="">전체 연도</option>';
        years.forEach(y => {
          const opt = document.createElement('option');
          opt.value = y; opt.textContent = y + '년';
          if (y === curYear) opt.selected = true;
          yearSel.appendChild(opt);
        });
      }
      const monthSel = document.getElementById('assign-filter-month');
      if (monthSel && monthSel.options.length <= 1) {
        for (let m = 1; m <= 12; m++) {
          const opt = document.createElement('option');
          opt.value = String(m).padStart(2, '0');
          opt.textContent = m + '월';
          monthSel.appendChild(opt);
        }
      }

      let candidates = matchingData.map((m, i) => ({ ...m, _idx: i }))
        .filter(m => (assignShowRejected ? true : !m.rejected) && (m.procStatus === '과제/공통면접' || m.procStatus === '최종면접'));

      if (filter) candidates = candidates.filter(m => m.procStatus === filter);
      if (yearFilter) candidates = candidates.filter(m => (m.date || '').startsWith(yearFilter));
      if (monthFilter) candidates = candidates.filter(m => {
        const d = m.date || '';
        return d.slice(5, 7) === monthFilter || d.slice(0, 7).endsWith('-' + monthFilter);
      });

      if (!candidates.length) {
        wrap.innerHTML = '<div class="empty-state"><div class="empty-icon">📅</div><div class="empty-text">과제/공통면접 또는 최종면접 진행 중인 지원자가 없습니다.</div></div>';
        return;
      }

      wrap.innerHTML = candidates.map(m => {
        const appts = interviewAppointments.filter(a =>
          a.candidateId ? a.candidateId === m.id : a.candidateIdx === m._idx
        );
        const apptHtml = appts.length
          ? appts.map(a => {
            const apptIdx = interviewAppointments.indexOf(a);
            const ivLabel = Array.isArray(a.interviewers) ? a.interviewers.join(', ') : (a.interviewer || '');
            return `<div class="ac-appt" style="display:flex;align-items:center;justify-content:space-between;gap:8px">
            <span>✅ ${a.type} · ${escHtml(ivLabel)} · ${a.date} ${a.time}</span>
            <button class="btn btn-secondary btn-sm" style="padding:2px 8px;font-size:11px;flex-shrink:0" onclick="openEditAppt(${apptIdx})">수정</button>
          </div>`;
          }).join('')
          : '<div style="font-size:12px;color:#aaa;margin-top:4px">미배정</div>';
        const procLabel = m.procStatus === '과제/공통면접' ? '과제/공통면접 진행' : '최종면접 진행';
        const badgeCls = m.procStatus === '과제/공통면접' ? 'badge-orange' : 'badge-blue2';
        const rejectedBadge = m.rejected ? '<span class="badge badge-red" style="font-size:11px;vertical-align:middle">불합격</span>' : '';
        return `<div class="assign-card" style="${m.rejected ? 'opacity:0.65;background:#fff8f8' : ''}">
      <div class="ac-info">
        <div class="ac-name">${escHtml(m.applicant)} <span class="badge ${badgeCls}" style="font-size:11px;vertical-align:middle">${procLabel}</span> ${rejectedBadge}</div>
        <div class="ac-meta">${escHtml(m.position)} · 분석점수 ${m.score}/5</div>
        ${apptHtml}
      </div>
      <button class="btn btn-primary btn-sm" onclick="openAssignModal(${m._idx})">일정 배정</button>
    </div>`;
      }).join('');
    }

    // ── 달력 셀 확장/축약 ──
    let expandedCalDate = null;

    function toggleCalCell(ds) {
      const cell = document.querySelector(`.cal-cell[data-date="${ds}"]`);
      if (!cell) return;
      const wasExpanded = cell.classList.contains('expanded');
      document.querySelectorAll('.cal-cell.expanded').forEach(c => c.classList.remove('expanded'));
      if (!wasExpanded) {
        cell.classList.add('expanded');
        expandedCalDate = ds;
      } else {
        expandedCalDate = null;
      }
    }

    // ── 면접자 일정 배정 모달 ──
    function openAssignModal(candidateIdx) {
      loadInterviewAppointments();
      loadInterviewSettings();
      const m = matchingData[candidateIdx];
      if (!m) return;
      assignSelectedDate = '';
      assignSelectedTime = '';
      document.getElementById('assign-candidate-idx').value = candidateIdx;
      document.getElementById('assign-modal-title').textContent = `면접 일정 배정 — ${m.applicant}`;
      document.getElementById('assign-candidate-info').textContent = `${m.position} · ${m.procStatus === '과제/공통면접' ? '과제/공통면접 진행' : '최종면접 진행'}`;
      document.getElementById('assign-type').value = '';
      document.getElementById('assign-date-section').style.display = 'none';
      document.getElementById('assign-time-section').style.display = 'none';
      document.getElementById('assign-selected-info').style.display = 'none';
      document.getElementById('assign-confirm-btn').style.display = 'none';

      // 면접관 체크박스 목록
      const ivList = document.getElementById('assign-interviewer-list');
      if (!interviewersPool.length) {
        ivList.innerHTML = '<span class="text-gray text-sm">면접관 풀을 먼저 등록하세요.</span>';
      } else {
        ivList.innerHTML = interviewersPool.map(iv => `
      <label class="iv-check-item">
        <input type="checkbox" value="${escHtml(iv.name)}" onchange="loadAvailableDates()" />
        ${escHtml(iv.name)}
      </label>
    `).join('');
      }
      openModal('modal-assign');
    }

    function getSelectedInterviewers() {
      return [...document.querySelectorAll('#assign-interviewer-list input[type=checkbox]:checked')]
        .map(cb => cb.value);
    }

    function loadAvailableDates() {
      assignSelectedDate = '';
      assignSelectedTime = '';
      document.getElementById('assign-time-section').style.display = 'none';
      document.getElementById('assign-selected-info').style.display = 'none';
      document.getElementById('assign-confirm-btn').style.display = 'none';

      const ivs = getSelectedInterviewers();
      const type = document.getElementById('assign-type').value;
      if (!ivs.length || !type) {
        document.getElementById('assign-date-section').style.display = 'none';
        return;
      }

      const todayStr = calDateStr(new Date());
      // 모든 선택 면접관이 가용한 날짜 교집합
      const perIvDates = ivs.map(iv =>
        new Set(scheduleData.filter(e => e.interviewer === iv && e.status !== 'unavailable' && e.date >= todayStr).map(e => e.date))
      );
      const availDates = [...(perIvDates[0] || new Set())]
        .filter(d => perIvDates.every(s => s.has(d)))
        .sort();

      document.getElementById('assign-date-section').style.display = '';
      if (!availDates.length) {
        document.getElementById('assign-date-list').innerHTML = '<span class="text-gray text-sm">선택한 면접관 모두가 가능한 날짜가 없습니다.</span>';
        return;
      }

      const SLABEL = { allday: '종일', morning: '오전', afternoon: '오후', partial: '부분가능' };
      document.getElementById('assign-date-list').innerHTML = availDates.map(d => {
        // 날짜별 면접관 가용 상태 요약
        const labels = ivs.map(iv => {
          const e = scheduleData.find(en => en.date === d && en.interviewer === iv);
          return `${iv}:${SLABEL[e?.status] || ''}`;
        }).join(' / ');
        return `<button class="avail-date-btn" onclick="selectAssignDate('${d}')" title="${labels}">${d.slice(5)}</button>`;
      }).join('');
    }

    function selectAssignDate(date) {
      assignSelectedDate = date;
      assignSelectedTime = '';
      document.getElementById('assign-selected-info').style.display = 'none';
      document.getElementById('assign-confirm-btn').style.display = 'none';

      document.querySelectorAll('.avail-date-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.textContent.startsWith(date.slice(5)));
      });

      const ivs = getSelectedInterviewers();
      const type = document.getElementById('assign-type').value;
      const slots = getCommonAvailableSlots(ivs, date, type);

      const settings = interviewSettings.types.find(t => t.key === type);
      document.getElementById('assign-time-hint').textContent =
        settings ? `(면접 ${settings.duration}분 + 대기 ${settings.buffer}분)` : '';

      document.getElementById('assign-time-section').style.display = '';
      if (!slots.length) {
        document.getElementById('assign-slot-list').innerHTML = '<span class="text-gray text-sm">해당 날짜에 가능한 공통 시간대가 없습니다.</span>';
        return;
      }
      document.getElementById('assign-slot-list').innerHTML = slots.map(s => {
        const booked = interviewAppointments.some(a =>
          a.date === date && a.time === s &&
          (Array.isArray(a.interviewers) ? a.interviewers.some(iv => ivs.includes(iv)) : ivs.includes(a.interviewer))
        );
        return `<button class="slot-btn${booked ? ' booked' : ''}" ${booked ? 'disabled' : ''} onclick="selectAssignTime('${s}')">${s}</button>`;
      }).join('');
    }

    function selectAssignTime(time) {
      assignSelectedTime = time;
      document.querySelectorAll('.slot-btn').forEach(btn => btn.classList.toggle('selected', btn.textContent === time));
      const ivs = getSelectedInterviewers();
      const type = document.getElementById('assign-type').value;
      const typeLabel = interviewSettings.types.find(t => t.key === type)?.label || type;
      document.getElementById('assign-summary').textContent =
        `${typeLabel} · ${ivs.join(', ')} · ${assignSelectedDate} ${time}`;
      document.getElementById('assign-selected-info').style.display = '';
      document.getElementById('assign-confirm-btn').style.display = '';
    }

    function confirmAssign() {
      const candidateIdx = parseInt(document.getElementById('assign-candidate-idx').value);
      const ivs = getSelectedInterviewers();
      const type = document.getElementById('assign-type').value;
      if (!assignSelectedDate || !assignSelectedTime || !ivs.length || !type) {
        showToast('날짜, 시간, 면접관(1명 이상), 유형을 모두 선택하세요.', 'error');
        return;
      }
      const m = matchingData[candidateIdx];
      interviewAppointments.push({
        candidateId: m?.id || '',      // 안정적 ID (배열 인덱스 대체)
        candidateIdx,                  // 구형 데이터 하위 호환용
        candidateName: m?.applicant || '',
        candidatePosition: m?.position || '',
        procStatus: m?.procStatus || '',
        interviewers: ivs,
        interviewer: ivs.join(', '),
        date: assignSelectedDate,
        time: assignSelectedTime,
        type,
        createdAt: new Date().toISOString()
      });
      saveInterviewAppointments();
      closeModal('modal-assign');
      renderAssignList();
      if (currentPage === 'schedule') renderCalendar();
      addAuditLog('면접 일정', '면접자 일정 배정', `${m?.applicant} · ${type} · ${assignSelectedDate} ${assignSelectedTime}`);
      showToast(`"${m?.applicant}" 면접이 ${assignSelectedDate} ${assignSelectedTime}으로 배정되었습니다.`, 'success');
    }

    // ── 확정 면접 일정 수정 ──
    function openEditAppt(apptIdx) {
      loadInterviewAppointments();
      loadInterviewSettings();
      const a = interviewAppointments[apptIdx];
      if (!a) return;
      document.getElementById('edit-appt-idx').value = apptIdx;
      document.getElementById('edit-appt-candidate').textContent =
        `${a.candidateName}  (${a.candidatePosition})`;
      // 유형 select
      const typeSel = document.getElementById('edit-appt-type');
      typeSel.innerHTML = interviewSettings.types.map(t =>
        `<option value="${t.key}" ${t.key === a.type ? 'selected' : ''}>${t.label}</option>`
      ).join('');
      // 면접관 체크박스
      const ivList = document.getElementById('edit-appt-iv-list');
      const curIvs = Array.isArray(a.interviewers) ? a.interviewers : (a.interviewer ? [a.interviewer] : []);
      if (!interviewersPool.length) {
        ivList.innerHTML = '<span class="text-gray text-sm">면접관 풀을 먼저 등록하세요.</span>';
      } else {
        ivList.innerHTML = interviewersPool.map(iv => `
      <label class="iv-check-item">
        <input type="checkbox" value="${escHtml(iv.name)}" ${curIvs.includes(iv.name) ? 'checked' : ''} />
        ${escHtml(iv.name)}
      </label>
    `).join('');
      }
      // 날짜 / 시간
      document.getElementById('edit-appt-date').value = a.date;
      document.getElementById('edit-appt-time').value = a.time;
      openModal('modal-edit-appt');
    }

    function saveEditAppt() {
      const apptIdx = parseInt(document.getElementById('edit-appt-idx').value);
      const type = document.getElementById('edit-appt-type').value;
      const ivs = [...document.querySelectorAll('#edit-appt-iv-list input[type=checkbox]:checked')].map(cb => cb.value);
      const date = document.getElementById('edit-appt-date').value;
      const time = document.getElementById('edit-appt-time').value.trim();
      if (!type || !ivs.length || !date || !time) {
        showToast('모든 필드를 입력하세요.', 'error'); return;
      }
      loadInterviewAppointments();
      if (!interviewAppointments[apptIdx]) { showToast('수정할 일정을 찾을 수 없습니다.', 'error'); return; }
      Object.assign(interviewAppointments[apptIdx], {
        type, interviewers: ivs, interviewer: ivs.join(', '), date, time
      });
      saveInterviewAppointments();
      closeModal('modal-edit-appt');
      renderAssignList();
      renderCalendar();
      addAuditLog('면접 일정', '일정 수정', `${interviewAppointments[apptIdx].candidateName} · ${type} · ${date} ${time}`);
      showToast('면접 일정이 수정되었습니다.', 'success');
    }

    function deleteAppt() {
      const apptIdx = parseInt(document.getElementById('edit-appt-idx').value);
      loadInterviewAppointments();
      const a = interviewAppointments[apptIdx];
      if (!a) return;
      if (!confirm(`"${a.candidateName}"의 면접 일정을 삭제하시겠습니까?`)) return;
      interviewAppointments.splice(apptIdx, 1);
      saveInterviewAppointments();
      closeModal('modal-edit-appt');
      renderAssignList();
      renderCalendar();
      addAuditLog('면접 일정', '일정 삭제', `${a.candidateName} · ${a.type} · ${a.date} ${a.time}`);
      showToast('면접 일정이 삭제되었습니다.', 'success');
    }

    // 복수 면접관 공통 가능 슬롯
    function getCommonAvailableSlots(interviewers, date, type) {
      if (!interviewers.length) return [];
      const perIv = interviewers.map(iv => new Set(getAvailableSlots(iv, date, type)));
      return [...(perIv[0] || new Set())].filter(s => perIv.every(set => set.has(s)));
    }

    // 시간대 → 가능 슬롯 계산
    function timeToMins(t) { const [h, m] = t.split(':').map(Number); return h * 60 + m; }
    function minsToTime(m) { return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }

    function getAvailableSlots(interviewer, date, type) {
      const entry = scheduleData.find(e => e.date === date && e.interviewer === interviewer);
      if (!entry || entry.status === 'unavailable') return [];

      const settings = interviewSettings.types.find(t => t.key === type);
      const duration = settings?.duration || 60;
      const buffer = settings?.buffer || 15;
      const slotStep = 30;

      let ranges = [];
      if (entry.status === 'allday') ranges = [[timeToMins('09:00'), timeToMins('18:00')]];
      if (entry.status === 'morning') ranges = [[timeToMins('09:00'), timeToMins('12:00')]];
      if (entry.status === 'afternoon') ranges = [[timeToMins('13:00'), timeToMins('18:00')]];
      if (entry.status === 'partial') ranges = [[timeToMins('09:00'), timeToMins('18:00')]];

      // partial: subtract blocked range
      if (entry.status === 'partial' && entry.blockTime) {
        const parts = entry.blockTime.split('-');
        if (parts.length === 2) {
          const bStart = timeToMins(parts[0].trim());
          const bEnd = timeToMins(parts[1].trim());
          ranges = [
            [timeToMins('09:00'), bStart],
            [bEnd, timeToMins('18:00')]
          ].filter(([s, e]) => e - s >= duration);
        }
      }

      const slots = [];
      ranges.forEach(([rangeStart, rangeEnd]) => {
        let cur = rangeStart;
        while (cur + duration <= rangeEnd) {
          slots.push(minsToTime(cur));
          cur += slotStep;
        }
      });

      // 이미 배정된 슬롯 제외
      const booked = interviewAppointments.filter(a => a.date === date && a.interviewer === interviewer);
      return slots.filter(slot => {
        const sStart = timeToMins(slot);
        const sEnd = sStart + duration + buffer;
        return !booked.some(a => {
          const aType = interviewSettings.types.find(t => t.key === a.type);
          const aDur = (aType?.duration || 60) + (aType?.buffer || 15);
          const aStart = timeToMins(a.time);
          const aEnd = aStart + aDur;
          return sStart < aEnd && sEnd > aStart;
        });
      });
    }

    // ── Init ──
    document.addEventListener('DOMContentLoaded', () => {
      initSupabase();
      checkAiStatus();

      loadData();
      loadScheduleData();
      loadInterviewSettings();
      loadInterviewAppointments();
      takeLocalBackup('앱 시작 시 자동 백업');
      renderDashboard();
      renderSheets();
      renderMatching();
      renderPositions();
      renderReports();
      renderAuditLog();
      renderUsers();
      syncPositionDropdowns();
      initNavGroups();

      const savedEmail = localStorage.getItem('wm_logged_in');
      if (savedEmail) {
        const user = ADMIN_ACCOUNTS.find(a => a.email === savedEmail);
        if (user) applyLogin(user);
      }
      const savedInvitedEmail = localStorage.getItem('wm_invited_user');
      if (savedInvitedEmail) {
        const u = usersData.find(x => x.email === savedInvitedEmail && x.status === '활성');
        if (u) applyLoginAsUser(u);
      }

      handleAuthRedirect();

      // Supabase에서 최신 데이터 풀기 (비동기)
      loadFromSupabase();
    });





