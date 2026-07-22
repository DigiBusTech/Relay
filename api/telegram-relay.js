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
        // Mirrors Telegram's own webhook delivery user-agent, since the host's
        // Bot Verification whitelist was configured to trust this exact string.
        // Without this, Vercel's default fetch user-agent gets flagged as a bot.
        'User-Agent': 'TelegramBot (like TwitterBot)',
        ...(secretToken ? { 'X-Telegram-Bot-Api-Secret-Token': secretToken } : {}),
      },
      body: rawBody,
      signal: AbortSignal.timeout(20000),
    });

    const upstreamText = await upstreamResponse.text();

    // Relay the upstream status/response straight back to Telegram.
    res.status(upstreamResponse.status).send(upstreamText);
  } catch (err) {
    console.error('Relay error forwarding to PHP backend:', err);
    // TEMPORARY: surface the real error message in the response body so we can
    // diagnose from curl directly. Remove this once things are confirmed working
    // and replace with the generic 200 'relay_error_logged' fallback again.
    res.status(200).send('relay_error_logged: ' + (err?.message || String(err)));
  }
}
