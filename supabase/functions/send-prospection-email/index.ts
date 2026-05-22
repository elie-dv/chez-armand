import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type ProspectionEmail = {
  id: string;
  recipient_email: string;
  subject: string;
  body: string;
  statut: string;
};

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

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: userData, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !userData.user) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json();
    const emailId = body.email_id as string | undefined;
    if (!emailId) return json({ error: 'Missing email_id' }, 400);

    const { data: email, error: emailError } = await supabase
      .from('prospection_emails')
      .select('*')
      .eq('id', emailId)
      .single();
    if (emailError || !email) return json({ error: emailError?.message || 'Email not found' }, 404);

    const sentMessage = await sendWithGmail(email as ProspectionEmail);

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
    return json({ error: message }, 500);
  }
});

async function sendWithGmail(email: ProspectionEmail): Promise<GmailSendResult> {
  const accessToken = await getGmailAccessToken();
  const fromEmail = requiredEnv('GMAIL_FROM_EMAIL');
  const fromName = Deno.env.get('GMAIL_FROM_NAME') || 'Chez Armand';

  const mime = [
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
    throw new Error(payload.error?.message || text || `Gmail HTTP ${response.status}`);
  }

  return {
    id: payload.id || null,
    threadId: payload.threadId || null,
  };
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
    throw new Error(data.error_description || data.error || 'Unable to refresh Gmail access token');
  }
  return data.access_token as string;
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
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
