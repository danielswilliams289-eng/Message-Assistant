export default async function handler(req: any, res: any) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header.' });
    }
    const accessToken = authHeader.split(' ')[1];

    const { to, subject, bodyText, fromEmail, fromName, replyTo, includeUnsubscribe } = req.body || {};
    if (!to || !subject || !bodyText) {
      return res.status(400).json({ error: 'Missing required email fields (to, subject, bodyText).' });
    }

    // Construct raw MIME message (RFC 2822 compliant)
    const utf8Subject = `=?utf-8?B?${Buffer.from(subject, 'utf-8').toString('base64')}?=`;
    const senderHeader = fromName && fromEmail ? `"${fromName.replace(/"/g, '')}" <${fromEmail}>` : fromEmail || '';
    const senderDomain = fromEmail && fromEmail.includes('@') ? fromEmail.split('@')[1] : 'gmail.com';
    const messageId = `<${Date.now()}.${Math.random().toString(36).substring(2, 10)}@${senderDomain}>`;
    const dateHeader = new Date().toUTCString();

    const headers: string[] = [
      senderHeader ? `From: ${senderHeader}` : '',
      `To: ${to}`,
      replyTo ? `Reply-To: ${replyTo}` : (senderHeader ? `Reply-To: ${senderHeader}` : ''),
      `Subject: ${utf8Subject}`,
      `Date: ${dateHeader}`,
      `Message-ID: ${messageId}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
    ];

    if (includeUnsubscribe !== false && fromEmail) {
      headers.push(`List-Unsubscribe: <mailto:${fromEmail}?subject=Unsubscribe%20${encodeURIComponent(to)}>`);
    }

    const validHeaders = headers.filter(Boolean).join('\r\n');
    const bodyBase64 = Buffer.from(bodyText, 'utf-8').toString('base64');
    const bodyBase64Chunked = bodyBase64.match(/.{1,76}/g)?.join('\r\n') || bodyBase64;

    const fullMimeMessage = `${validHeaders}\r\n\r\n${bodyBase64Chunked}`;
    const rawEncoded = Buffer.from(fullMimeMessage)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const gmailRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: rawEncoded }),
    });

    const gmailData = await gmailRes.json();
    if (!gmailRes.ok) {
      return res.status(gmailRes.status).json({
        error: gmailData.error?.message || 'Google Workspace API rejected message transmission',
        details: gmailData,
      });
    }

    return res.status(200).json({
      success: true,
      id: gmailData.id,
      threadId: gmailData.threadId,
      message: 'Email delivered successfully via Gmail Workspace API',
    });
  } catch (err: any) {
    console.error('Vercel Gmail send error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error sending email' });
  }
}
