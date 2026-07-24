// api/telegram-relay.js

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const secretToken = req.headers['x-telegram-bot-api-secret-token'] || 'sabiaitech_tg_secret_2026';
    
    // Safely format payload regardless of how Vercel parsed it
    const payload = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});

    console.log('Forwarding payload to Asura Hosting...');

    // Forward to Asura
    const upstream = await fetch('https://sabiaitech.com/whaai/php/telegram_webhook.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Bot-Api-Secret-Token': secretToken
      },
      body: payload
    });

    const responseText = await upstream.text();
    console.log(`[Asura Response Code]: ${upstream.status}`);
    console.log(`[Asura Response Body]: ${responseText}`);

    return res.status(200).json({ 
      ok: true, 
      asura_status: upstream.status, 
      asura_body: responseText 
    });

  } catch (err) {
    console.error('[Vercel Forwarding Error]:', err.message);
    return res.status(200).json({ ok: false, error: err.message });
  }
}
