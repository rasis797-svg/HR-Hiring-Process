const ANTHROPIC_API_KEY = process.env.Claude_AP_KEY || process.env.CLAUDE_API_KEY;
const SITE_URL = process.env.SITE_URL || 'https://hr-hiring-process-lac.vercel.app';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', SITE_URL);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  res.status(200).json({ available: !!ANTHROPIC_API_KEY });
};
