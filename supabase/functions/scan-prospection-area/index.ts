import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  type AreaConfig,
  type GeoCommune,
  countCommuneCommerces,
  isCommuneInArea,
  loadCommunes,
  loadMairieContact,
} from './scan_sources.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type ScanJob = {
  id: string;
  area_id: string;
  candidate_codes: string[];
  candidate_communes: GeoCommune[];
  total_candidates: number;
  processed_candidates: number;
  saved_count: number;
  skipped_count: number;
  error_count: number;
};

type DbClient = ReturnType<typeof createClient<any, 'public', any>>;

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
    const areaId = body.area_id as string | undefined;
    const jobId = body.job_id as string | undefined;
    const batchSize = clampNumber(body.batch_size, 1, 25, 8);
    if (!areaId && !jobId) return json({ error: 'Missing area_id or job_id' }, 400);

    console.info('scan-prospection-area:start', { areaId, jobId, batchSize });
    const job = jobId
      ? await loadJob(supabase, jobId)
      : await createJob(supabase, areaId!, userData.user.id);
    console.info('scan-prospection-area:job-loaded', {
      jobId: job.id,
      areaId: job.area_id,
      totalCandidates: job.total_candidates,
      processedCandidates: job.processed_candidates,
    });

    const { data: area, error: areaError } = await supabase
      .from('prospection_areas')
      .select('*')
      .eq('id', job.area_id)
      .single();
    if (areaError || !area) return json({ error: areaError?.message || 'Area not found' }, 404);

    await supabase
      .from('prospection_areas')
      .update({ statut: 'scanning', last_scan_error: null, updated_at: new Date().toISOString() })
      .eq('id', job.area_id);

    const nextCommunes = job.candidate_communes.slice(
      job.processed_candidates,
      job.processed_candidates + batchSize,
    );
    console.info('scan-prospection-area:batch-start', {
      jobId: job.id,
      count: nextCommunes.length,
      codes: nextCommunes.map((commune) => commune.code),
    });

    if (nextCommunes.length === 0) {
      await completeJob(supabase, job, job.area_id);
      return json(jobResponse({ ...job, processed_candidates: job.total_candidates }, false));
    }

    const config = (area.config || {}) as AreaConfig;
    const commerceMax = config.commerce_max ?? 2;

    let saved = 0;
    let skipped = 0;
    let errored = 0;
    const errors: Array<{ code: string; error: string }> = [];

    for (const commune of nextCommunes) {
      try {
        console.info('scan-prospection-area:commune-start', {
          jobId: job.id,
          code: commune.code,
          nom: commune.nom,
        });
        const commerceCount = await countCommuneCommerces(commune.code);
        if (commerceCount > commerceMax) {
          console.info('scan-prospection-area:commune-skipped', {
            jobId: job.id,
            code: commune.code,
            commerceCount,
          });
          skipped += 1;
          continue;
        }

        await saveCommuneProspection(supabase, {
          areaId: job.area_id,
          commune,
          commerceCount,
          mairieSources: config.mairie_sources,
        });
        console.info('scan-prospection-area:commune-saved', {
          jobId: job.id,
          code: commune.code,
          commerceCount,
        });
        saved += 1;
      } catch (err) {
        console.warn('scan-prospection-area:commune-error', {
          jobId: job.id,
          code: commune.code,
          error: err instanceof Error ? err.message : String(err),
        });
        errored += 1;
        errors.push({ code: commune.code, error: err instanceof Error ? err.message : String(err) });
      }
    }

    const processedCandidates = Math.min(job.processed_candidates + nextCommunes.length, job.total_candidates);
    const updatedJob = {
      ...job,
      processed_candidates: processedCandidates,
      saved_count: job.saved_count + saved,
      skipped_count: job.skipped_count + skipped,
      error_count: job.error_count + errored,
    };
    const completed = processedCandidates >= job.total_candidates;
    const now = new Date().toISOString();

    const { error: updateJobError } = await supabase
      .from('prospection_scan_jobs')
      .update({
        statut: completed ? 'completed' : 'running',
        processed_candidates: updatedJob.processed_candidates,
        saved_count: updatedJob.saved_count,
        skipped_count: updatedJob.skipped_count,
        error_count: updatedJob.error_count,
        last_error: errors.length ? JSON.stringify(errors.slice(0, 5)) : null,
        completed_at: completed ? now : null,
        updated_at: now,
      })
      .eq('id', job.id);
    if (updateJobError) throw updateJobError;

    if (completed) await completeJob(supabase, updatedJob, job.area_id);

    return json({
      ...jobResponse(updatedJob, !completed),
      batch: {
        processed: nextCommunes.length,
        saved,
        skipped,
        errors,
      },
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

async function createJob(supabase: DbClient, areaId: string, userId: string): Promise<ScanJob> {
  const { data: area, error: areaError } = await supabase
    .from('prospection_areas')
    .select('*')
    .eq('id', areaId)
    .single();
  if (areaError || !area) throw new Error(areaError?.message || 'Area not found');

  const config = (area.config || {}) as AreaConfig;
  const populationMax = config.population_max ?? 500;
  const maxCandidates = config.max_candidates ?? 300;
  console.info('scan-prospection-area:create-job:load-communes', {
    areaId,
    type: area.type,
    populationMax,
    maxCandidates,
  });
  const communes = await loadCommunes(area.type, config);
  console.info('scan-prospection-area:create-job:communes-loaded', {
    areaId,
    count: communes.length,
  });
  const candidates = communes
    .filter((commune) => typeof commune.population === 'number' && commune.population < populationMax)
    .filter((commune) => isCommuneInArea(commune, area.type, config))
    .sort((a, b) => (a.population ?? 0) - (b.population ?? 0))
    .slice(0, maxCandidates);
  const candidateCodes = candidates.map((commune) => commune.code);
  console.info('scan-prospection-area:create-job:candidates-ready', {
    areaId,
    count: candidateCodes.length,
  });

  const now = new Date().toISOString();
  const { data: jobRows, error: jobError } = await supabase
    .from('prospection_scan_jobs')
    .insert([{
      area_id: areaId,
      statut: 'running',
      candidate_codes: candidateCodes,
      candidate_communes: candidates,
      total_candidates: candidateCodes.length,
      processed_candidates: 0,
      created_by: userId,
      started_at: now,
      updated_at: now,
    }])
    .select('*')
    .limit(1);
  if (jobError) throw jobError;

  const job = jobRows?.[0];
  if (!job) throw new Error('Scan job was not created');
  return normalizeJob(job);
}

async function loadJob(supabase: DbClient, jobId: string): Promise<ScanJob> {
  const { data: job, error } = await supabase
    .from('prospection_scan_jobs')
    .select('*')
    .eq('id', jobId)
    .single();
  if (error || !job) throw new Error(error?.message || 'Scan job not found');
  return normalizeJob(job);
}

function normalizeJob(job: Record<string, unknown>): ScanJob {
  return {
    id: String(job.id),
    area_id: String(job.area_id),
    candidate_codes: Array.isArray(job.candidate_codes) ? job.candidate_codes.map(String) : [],
    candidate_communes: Array.isArray(job.candidate_communes) ? job.candidate_communes as GeoCommune[] : [],
    total_candidates: Number(job.total_candidates || 0),
    processed_candidates: Number(job.processed_candidates || 0),
    saved_count: Number(job.saved_count || 0),
    skipped_count: Number(job.skipped_count || 0),
    error_count: Number(job.error_count || 0),
  };
}

async function completeJob(supabase: DbClient, job: ScanJob, areaId: string) {
  const now = new Date().toISOString();
  const failed = job.total_candidates > 0 && job.error_count >= job.total_candidates;
  await Promise.all([
    supabase
      .from('prospection_scan_jobs')
      .update({
        statut: failed ? 'failed' : 'completed',
        completed_at: now,
        updated_at: now,
      })
      .eq('id', job.id),
    supabase
      .from('prospection_areas')
      .update({
        statut: failed ? 'failed' : 'completed',
        last_scan_at: now,
        last_scan_error: failed ? 'All candidates failed during scan' : null,
        updated_at: now,
      })
      .eq('id', areaId),
  ]);
}

async function saveCommuneProspection(
  supabase: DbClient,
  input: { areaId: string; commune: GeoCommune; commerceCount: number; mairieSources?: AreaConfig['mairie_sources'] },
) {
  const mairie = await loadMairieContact(input.commune.code, input.mairieSources);
  const center = input.commune.centre?.coordinates;
  const departmentCode = input.commune.code.slice(0, 2);
  const now = new Date().toISOString();

  const { data: municipalityRows, error: municipalityError } = await supabase
    .from('municipalities')
    .upsert([{
      insee_code: input.commune.code,
      nom: input.commune.nom,
      code_postal: input.commune.codesPostaux?.[0] || null,
      department_code: departmentCode,
      population: input.commune.population ?? null,
      latitude: center ? center[1] : null,
      longitude: center ? center[0] : null,
      population_source: 'geo.api.gouv.fr',
      updated_at: now,
    }], { onConflict: 'insee_code' })
    .select('*')
    .limit(1);
  if (municipalityError) throw municipalityError;

  const municipality = municipalityRows?.[0];
  if (!municipality) throw new Error('Municipality upsert returned no row');

  const { error: enrichmentError } = await supabase
    .from('municipality_enrichments')
    .upsert([{
      municipality_id: municipality.id,
      mairie_email: mairie.email,
      mairie_phone: mairie.phone,
      mairie_opening_hours: mairie.openingHours,
      mairie_website: mairie.website,
      contact_source: mairie.source,
      contact_checked_at: now,
      commerce_count: input.commerceCount,
      commerce_source: 'openstreetmap',
      commerce_checked_at: now,
      commerce_confidence: 'estimated',
      updated_at: now,
    }], { onConflict: 'municipality_id' });
  if (enrichmentError) throw enrichmentError;

  const { data: existingRecord, error: existingError } = await supabase
    .from('prospection_records')
    .select('id')
    .eq('municipality_id', municipality.id)
    .maybeSingle();
  if (existingError) throw existingError;

  const recordRequest = existingRecord
    ? supabase
      .from('prospection_records')
      .update({ area_id: input.areaId, updated_at: now })
      .eq('id', existingRecord.id)
    : supabase
      .from('prospection_records')
      .insert([{
        municipality_id: municipality.id,
        area_id: input.areaId,
        statut: mairie.email ? 'ready_to_contact' : 'to_review',
        updated_at: now,
      }]);

  const { error: recordError } = await recordRequest;
  if (recordError) throw recordError;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function jobResponse(job: ScanJob, hasMore: boolean) {
  const progress = job.total_candidates === 0
    ? 100
    : Math.round((job.processed_candidates / job.total_candidates) * 100);

  return {
    job_id: job.id,
    status: hasMore ? 'running' : 'completed',
    has_more: hasMore,
    progress,
    total_candidates: job.total_candidates,
    processed_candidates: job.processed_candidates,
    saved_count: job.saved_count,
    skipped_count: job.skipped_count,
    error_count: job.error_count,
  };
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
