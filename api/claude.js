const { createClient } = require('@supabase/supabase-js');

const ANTHROPIC_API_KEY = process.env.Claude_AP_KEY || process.env.CLAUDE_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wrxizpoptgpzmotgnajg.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable__WUC-nsBd0dX1KrQlGLc2g_D-f0R6fb';
const SITE_URL = process.env.SITE_URL || 'https://hr-hiring-process-lac.vercel.app';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', SITE_URL);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: { message: 'Method not allowed' } }); return; }

  if (!ANTHROPIC_API_KEY) {
    res.status(500).json({ error: { message: '서버에 Claude API 키가 설정되지 않았습니다. 관리자에게 문의하세요.' } });
    return;
  }

  // 로그인한 사용자만 이 프록시를 쓸 수 있게 한다. 이 검증이 없으면 누구나
  // 이 엔드포인트를 직접 호출해 서버에 저장된 Anthropic API 키를 무제한으로
  // 소모시킬 수 있다.
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) {
    res.status(401).json({ error: { message: '로그인이 필요합니다.' } });
    return;
  }

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: userData, error: userErr } = await sb.auth.getUser(token);
    if (userErr || !userData?.user) {
      res.status(401).json({ error: { message: '세션이 만료되었습니다. 다시 로그인하세요.' } });
      return;
    }
  } catch (e) {
    res.status(401).json({ error: { message: '세션을 확인할 수 없습니다.' } });
    return;
  }

  try {
    const { model, max_tokens, messages } = req.body;
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ model, max_tokens, messages }),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (e) {
    res.status(502).json({ error: { message: e.message } });
  }
};
