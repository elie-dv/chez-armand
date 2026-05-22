import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type ProspectionEmail = {
  id: string;
  prospection_record_id: string | null;
  provider_message_id: string | null;
  provider_thread_id: string | null;
  sent_at: string | null;
};

type GmailHeader = {
  name: string;
  value: string;
};

type GmailMessage = {
  id?: string;
  threadId?: string;
  internalDate?: string;
  snippet?: string;
  payload?: {
    headers?: GmailHeader[];
  };
};

type GmailThread = {
  id?: string;
  messages?: GmailMessage[];
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

    const input = await readJson(req);
    const limit = Math.max(1, Math.min(Number(input.limit || 50), 100));

    const { data: emails, error: emailError } = await supabase
      .from('prospection_emails')
      .select('id, prospection_record_id, provider_message_id, provider_thread_id, sent_at')
      .eq('statut', 'sent')
      .not('provider_message_id', 'is', null)
      .is('reply_detected_at', null)
      .order('sent_at', { ascending: false })
      .limit(limit);
    if (emailError) throw emailError;

    const accessToken = await getGmailAccessToken();
    const fromEmail = requiredEnv('GMAIL_FROM_EMAIL').toLowerCase();
    let checked = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const email of (emails || []) as ProspectionEmail[]) {
      checked += 1;
      try {
        const threadId = email.provider_thread_id || await getThreadId(accessToken, email.provider_message_id);
        if (!threadId) continue;

        const reply = await findReplyInThread(accessToken, threadId, email, fromEmail);
        if (!reply) {
          if (!email.provider_thread_id) {
            await supabase.from('prospection_emails').update({ provider_thread_id: threadId }).eq('id', email.id);
          }
          continue;
        }

        const replyAt = reply.internalDate ? new Date(Number(reply.internalDate)).toISOString() : new Date().toISOString();
        const headers = reply.payload?.headers || [];
        const replyFrom = headerValue(headers, 'From');
        const replySubject = headerValue(headers, 'Subject');

        const { error: updateEmailError } = await supabase
          .from('prospection_emails')
          .update({
            provider_thread_id: threadId,
            reply_message_id: reply.id || null,
            reply_detected_at: replyAt,
            reply_from: replyFrom,
            reply_subject: replySubject,
            reply_snippet: reply.snippet || null,
          })
          .eq('id', email.id);
        if (updateEmailError) throw updateEmailError;

        if (email.prospection_record_id) {
          const { error: updateRecordError } = await supabase
            .from('prospection_records')
            .update({
              statut: 'replied',
              updated_at: new Date().toISOString(),
            })
            .eq('id', email.prospection_record_id);
          if (updateRecordError) throw updateRecordError;
        }

        updated += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`${email.id}: ${message}`);
      }
    }

    return json({ checked, updated, errors });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 500);
  }
});

async function readJson(req: Request) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

async function getThreadId(accessToken: string, messageId: string | null) {
  if (!messageId) return null;
  const message = await gmailFetch<GmailMessage>(
    accessToken,
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}?format=metadata`,
  );
  return message.threadId || null;
}

async function findReplyInThread(accessToken: string, threadId: string, email: ProspectionEmail, fromEmail: string) {
  const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(threadId)}`);
  url.searchParams.set('format', 'metadata');
  for (const header of ['From', 'Subject', 'Date']) url.searchParams.append('metadataHeaders', header);

  const thread = await gmailFetch<GmailThread>(accessToken, url.toString());
  const sentAt = email.sent_at ? Date.parse(email.sent_at) : 0;
  const messages = (thread.messages || [])
    .filter((message) => message.id && message.id !== email.provider_message_id)
    .filter((message) => {
      const internalDate = message.internalDate ? Number(message.internalDate) : 0;
      return !sentAt || internalDate > sentAt;
    })
    .filter((message) => {
      const from = headerValue(message.payload?.headers || [], 'From').toLowerCase();
      return !from.includes(fromEmail);
    })
    .sort((a, b) => Number(a.internalDate || 0) - Number(b.internalDate || 0));

  return messages[0] || null;
}

async function gmailFetch<T>(accessToken: string, url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const text = await response.text();
  let payload: { error?: { message?: string } } = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = {};
  }
  if (!response.ok) {
    throw new Error(payload.error?.message || text || `Gmail HTTP ${response.status}`);
  }
  return payload as T;
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

function headerValue(headers: GmailHeader[], name: string) {
  return headers.find((header) => header.name.toLowerCase() === name.toLowerCase())?.value || '';
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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}
