import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type EmailAttachment = {
  name: string;
  path: string;
  mime_type: string;
};

type ProspectionEmail = {
  id: string;
  recipient_email: string;
  subject: string;
  body: string;
  statut: string;
  attachments: EmailAttachment[] | null;
};

const ATTACHMENT_BUCKET = 'prospection-attachments';

type GmailSendResult = {
  id: string | null;
  threadId: string | null;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: 'Missing Supabase environment variables' }, 500);
    }

    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.replace('Bearer ', '').trim();
    if (!jwt) return json({ error: 'Missing Authorization header' }, 401);
    requireAuthenticatedJwt(jwt);

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const emailId = body.email_id as string | undefined;
    if (!emailId) return json({ error: 'Missing email_id' }, 400);

    const { data: email, error: emailError } = await supabase
      .from('prospection_emails')
      .select('*')
      .eq('id', emailId)
      .single();
    if (emailError || !email) return json({ error: emailError?.message || 'Email not found' }, 404);

    const sentMessage = await sendWithGmail(supabase, email as ProspectionEmail);

    const { error: updateError } = await supabase
      .from('prospection_emails')
      .update({
        statut: 'sent',
        sent_at: new Date().toISOString(),
        provider: 'gmail_api',
        provider_message_id: sentMessage.id,
        provider_thread_id: sentMessage.threadId,
        error_message: null,
      })
      .eq('id', emailId);
    if (updateError) throw updateError;

    return json({ message_id: sentMessage.id, thread_id: sentMessage.threadId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error('send-prospection-email failed', { message, stack });
    return json({ error: message }, 500);
  }
});

async function sendWithGmail(
  supabase: ReturnType<typeof createClient>,
  email: ProspectionEmail,
): Promise<GmailSendResult> {
  const accessToken = await getGmailAccessToken();
  const fromEmail = requiredEnv('GMAIL_FROM_EMAIL');
  const fromName = Deno.env.get('GMAIL_FROM_NAME') || 'Chez Armand';

  const attachments = Array.isArray(email.attachments) ? email.attachments : [];
  const downloadedAttachments = await downloadAttachments(supabase, attachments);

  const mime = downloadedAttachments.length
    ? buildMultipartMime({
        fromName,
        fromEmail,
        recipient: email.recipient_email,
        subject: email.subject,
        body: email.body,
        attachments: downloadedAttachments,
      })
    : [
        `From: ${encodeAddress(fromName, fromEmail)}`,
        `To: ${email.recipient_email}`,
        `Subject: ${encodeHeader(email.subject)}`,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset="UTF-8"',
        '',
        email.body,
      ].join('\r\n');

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: base64UrlEncode(mime) }),
  });

  const text = await response.text();
  let payload: { id?: string; threadId?: string; error?: { message?: string } } = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = {};
  }

  if (!response.ok) {
    console.error('Gmail send failed', {
      status: response.status,
      statusText: response.statusText,
      body: text,
      parsed: payload,
    });
    throw new Error(payload.error?.message || text || `Gmail HTTP ${response.status}`);
  }

  return {
    id: payload.id || null,
    threadId: payload.threadId || null,
  };
}

type DownloadedAttachment = EmailAttachment & { base64: string };

async function downloadAttachments(
  supabase: ReturnType<typeof createClient>,
  attachments: EmailAttachment[],
): Promise<DownloadedAttachment[]> {
  if (!attachments.length) return [];
  const results: DownloadedAttachment[] = [];
  for (const att of attachments) {
    if (!att?.path || !att?.name || !att?.mime_type) {
      console.warn('Skipping malformed attachment', att);
      continue;
    }
    const { data, error } = await supabase.storage.from(ATTACHMENT_BUCKET).download(att.path);
    if (error || !data) {
      throw new Error(`Pièce jointe introuvable: ${att.name} (${att.path})`);
    }
    const buffer = await data.arrayBuffer();
    results.push({ ...att, base64: base64FromBytes(new Uint8Array(buffer)) });
  }
  return results;
}

function buildMultipartMime(params: {
  fromName: string;
  fromEmail: string;
  recipient: string;
  subject: string;
  body: string;
  attachments: DownloadedAttachment[];
}): string {
  const boundary = `=_chez_armand_${crypto.randomUUID().replace(/-/g, '')}`;
  const lines: string[] = [
    `From: ${encodeAddress(params.fromName, params.fromEmail)}`,
    `To: ${params.recipient}`,
    `Subject: ${encodeHeader(params.subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    params.body,
  ];

  for (const att of params.attachments) {
    lines.push(
      `--${boundary}`,
      `Content-Type: ${att.mime_type}; name="${encodeHeader(att.name)}"`,
      `Content-Disposition: attachment; filename="${encodeHeader(att.name)}"`,
      'Content-Transfer-Encoding: base64',
      '',
      chunkBase64(att.base64),
    );
  }
  lines.push(`--${boundary}--`, '');
  return lines.join('\r\n');
}

function base64FromBytes(bytes: Uint8Array) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function chunkBase64(value: string, width = 76) {
  const parts: string[] = [];
  for (let i = 0; i < value.length; i += width) {
    parts.push(value.slice(i, i + width));
  }
  return parts.join('\r\n');
}

async function getGmailAccessToken() {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: requiredEnv('GMAIL_CLIENT_ID'),
      client_secret: requiredEnv('GMAIL_CLIENT_SECRET'),
      refresh_token: requiredEnv('GMAIL_REFRESH_TOKEN'),
      grant_type: 'refresh_token',
    }),
  });

  const data = await response.json();
  if (!response.ok || !data.access_token) {
    console.error('Gmail token refresh failed', { status: response.status, data });
    throw new Error(data.error_description || data.error || 'Unable to refresh Gmail access token');
  }
  console.log('Gmail token refresh ok', { scope: data.scope, expires_in: data.expires_in });
  return data.access_token as string;
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function requireAuthenticatedJwt(jwt: string) {
  const [, payloadPart] = jwt.split('.');
  if (!payloadPart) throw new Error('Invalid session token');

  const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadPart))) as {
    exp?: number;
    role?: string;
    sub?: string;
  };

  if (!payload.sub || payload.role !== 'authenticated') {
    throw new Error('Admin session required');
  }
  if (payload.exp && payload.exp * 1000 < Date.now()) {
    throw new Error('Admin session expired');
  }
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function encodeHeader(value: string) {
  return /[^\x00-\x7F]/.test(value)
    ? `=?UTF-8?B?${base64Encode(value)}?=`
    : value;
}

function encodeAddress(name: string, email: string) {
  return `${encodeHeader(name)} <${email}>`;
}

function base64Encode(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64UrlEncode(value: string) {
  return base64Encode(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}
