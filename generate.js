const https = require('https');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET = health check — visit /api/generate in browser to test
  if (req.method === 'GET') {
    const hasKey = !!process.env.ANTHROPIC_API_KEY;
    return res.status(200).json({
      status: 'ok',
      hasApiKey: hasKey,
      keyPrefix: hasKey ? process.env.ANTHROPIC_API_KEY.substring(0, 10) + '...' : 'MISSING',
    });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' });

  try {
    const { system, messages } = req.body;

    const postData = JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      system: system,
      messages: messages,
    });

    const result = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(postData),
        },
      };

      const request = https.request(options, (response) => {
        let data = '';
        response.on('data', (chunk) => { data += chunk; });
        response.on('end', () => {
          resolve({ statusCode: response.statusCode, body: data });
        });
      });

      request.on('error', (e) => reject(e));
      request.write(postData);
      request.end();
    });

    if (result.statusCode !== 200) {
      console.error('Anthropic API error:', result.statusCode, result.body);
      return res.status(result.statusCode).json({ error: result.body });
    }

    const data = JSON.parse(result.body);
    return res.status(200).json({ response: data.content[0].text });

  } catch (err) {
    console.error('Proxy error:', err);
    return res.status(500).json({ error: err.message });
  }
};
