// api/telegram-relay.js
// Vercel serverless relay for Telegram webhook delivery.
//
// WHY THIS EXISTS:
// Telegram's servers cannot reach sabiaitech.com directly (confirmed routing/peering
// issue between Asura Hosting's network and Telegram's IP ranges). Vercel's network is
// globally well-peered, so Telegram delivers here reliably, and this function simply
// forwards the exact same request straight through to the real PHP webhook untouched.
//
// SETUP:
// 1. Deploy this file to a Vercel project (see deployment steps provided separately).
// 2. Register THIS relay's URL as your Telegram webhook instead of the direct PHP URL:
//    https://api.telegram.org/bot<YOUR_TOKEN>/setWebhook?url=https://<your-vercel-project>.vercel.app/api/telegram-relay&secret_token=<TELEGRAM_VERIFY_SECRET>
// 3. Nothing in telegram_webhook.php changes — it still checks the same secret header,
//    since this relay forwards headers through untouched.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const TARGET_URL = 'https://sabiaitech.com/whaai/php/telegram_webhook.php';

  try {
    // Forward the raw body exactly as received.
    const rawBody = JSON.stringify(req.body ?? {});

    // Forward the secret token header through untouched so telegram_webhook.php's
    // existing validation logic keeps working with zero code changes on that end.
    const secretToken = req.headers['x-telegram-bot-api-secret-token'];

    const upstreamResponse = await fetch(TARGET_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(secretToken ? { 'X-Telegram-Bot-Api-Secret-Token': secretToken } : {}),
      },
      body: rawBody,
      // Vercel functions have their own execution timeout (10s on Hobby plan,
      // longer on Pro) — this is separate from that ceiling and just avoids a
      // hung upstream request stalling forever.
      signal: AbortSignal.timeout(20000),
    });

    const upstreamText = await upstreamResponse.text();

    // Relay the upstream status/response straight back to Telegram.
    res.status(upstreamResponse.status).send(upstreamText);
  } catch (err) {
    console.error('Relay error forwarding to PHP backend:', err);
    // Still respond 200 to Telegram so it doesn't endlessly retry a request
    // that did reach us — the real failure gets logged here for you to check
    // in the Vercel dashboard's function logs.
    res.status(200).send('relay_error_logged');
  }
}
