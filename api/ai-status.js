const ANTHROPIC_API_KEY = process.env.Claude_AP_KEY || process.env.CLAUDE_API_KEY;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  res.status(200).json({ available: !!ANTHROPIC_API_KEY });
};
