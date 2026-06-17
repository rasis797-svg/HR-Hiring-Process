const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wrxizpoptgpzmotgnajg.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SITE_URL = process.env.SITE_URL || 'https://hr-hiring-process-lac.vercel.app';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: { message: 'Method not allowed' } }); return; }

  if (!SERVICE_ROLE_KEY) {
    res.status(500).json({ error: { message: 'SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.' } });
    return;
  }

  const { name, email, role } = req.body || {};
  if (!name || !email) {
    res.status(400).json({ error: { message: '이름과 이메일을 입력하세요.' } });
    return;
  }

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
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
