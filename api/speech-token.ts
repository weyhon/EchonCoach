import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Azure Speech token proxy — exchanges the server-side API key for a
 * short-lived (~10 min) auth token that the browser can use directly.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Basic origin check — reject requests without a matching origin/referer
  const origin = req.headers.origin || req.headers.referer || '';
  const host = req.headers.host || '';
  if (origin && !origin.includes(host)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

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
