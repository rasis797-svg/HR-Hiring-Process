const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wrxizpoptgpzmotgnajg.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SITE_URL = process.env.SITE_URL || 'https://hr-hiring-process-lac.vercel.app';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', SITE_URL);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: { message: 'Method not allowed' } }); return; }

  if (!SERVICE_ROLE_KEY) {
    res.status(500).json({ error: { message: 'SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.' } });
    return;
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // app_users 가 완전히 비어 있으면(=아직 아무도 없으면) 부트스트랩을 허용한다.
  // sql/003_rls.sql 의 link_current_user() 도 이 최초 1회에 한해 자동으로
  // 시스템 관리자를 만든다 — 그 규칙과 동일한 경계다. 이 앱에는 별도 회원가입
  // 화면이 없어서, 이 부트스트랩 경로가 없으면 첫 관리자 계정을 만들 방법이 없다.
  const { count: userCount, error: countErr } = await admin
    .from('app_users')
    .select('id', { count: 'exact', head: true });
  const isBootstrap = !countErr && (userCount || 0) === 0;

  if (!isBootstrap) {
    // 호출자를 확인한다. 이 검증이 없으면 로그인하지 않은 누구나 이 엔드포인트를
    // 직접 호출해 임의 이메일을 원하는 role(시스템 관리자 포함)로 초대할 수 있다.
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) {
      res.status(401).json({ error: { message: '로그인이 필요합니다.' } });
      return;
    }

    const { data: callerAuth, error: callerErr } = await admin.auth.getUser(token);
    if (callerErr || !callerAuth?.user) {
      res.status(401).json({ error: { message: '세션이 만료되었습니다. 다시 로그인하세요.' } });
      return;
    }

    const { data: callerRow, error: callerRowErr } = await admin
      .from('app_users')
      .select('role, status')
      .eq('auth_uid', callerAuth.user.id)
      .maybeSingle();

    if (callerRowErr || !callerRow || callerRow.status === '비활성' || callerRow.role !== '시스템 관리자') {
      res.status(403).json({ error: { message: '사용자 초대는 시스템 관리자만 할 수 있습니다.' } });
      return;
    }
  }

  const { name, email } = req.body || {};
  if (!name || !email) {
    res.status(400).json({ error: { message: '이름과 이메일을 입력하세요.' } });
    return;
  }
  // 부트스트랩 상황에서는 role을 클라이언트 입력과 무관하게 시스템 관리자로 고정한다.
  // 그러지 않으면 첫 계정이 관리자가 아닌 role로 만들어져 이후 아무도 초대할 수 없게 될 수 있다.
  const role = isBootstrap ? '시스템 관리자' : (req.body || {}).role;

  try {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { name, role },
      redirectTo: SITE_URL,
    });
    if (error) {
      res.status(400).json({ error: { message: error.message } });
      return;
    }
    res.status(200).json({ user: data.user });
  } catch (e) {
    res.status(502).json({ error: { message: e.message } });
  }
};
