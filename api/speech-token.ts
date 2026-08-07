import type { VercelRequest, VercelResponse } from '@vercel/node';
import { guard } from './_guard';

/**
 * Azure Speech token proxy — exchanges the server-side API key for a
 * short-lived (~10 min) auth token that the browser can use directly.
 *
 * The previous gate (`origin && !origin.includes(host)`) had two holes,
 * both verified against production: a request with no Origin header skipped
 * the check entirely, and `includes` accepted `https://<host>.evil.com`.
 * Any script could then mint live Azure tokens and spend the quota outside
 * this app. `guard` compares the parsed hostname exactly and requires it.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guard(req, res, { maxBodyBytes: 1_000 })) return;

  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION || 'eastasia';

  if (!key) {
    return res.status(500).json({ error: 'AZURE_SPEECH_KEY not configured' });
  }

  try {
    const tokenRes = await fetch(
      `https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`,
      {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': key,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    );

    if (!tokenRes.ok) {
      throw new Error(`Token fetch failed: ${tokenRes.status}`);
    }

    const token = await tokenRes.text();
    res.status(200).json({ token, region });
  } catch (error: any) {
    console.error('Speech token error:', error);
    res.status(500).json({ error: error.message || 'Failed to get speech token' });
  }
}
