export type MetricKey = "responses" | "minutes" | "invites" | "connections";

const NS = "campaign_metrics";

function read(campaignId: string) {
  const raw = localStorage.getItem(`${NS}:${campaignId}`);
  return raw ? JSON.parse(raw) as Record<MetricKey, number> : { responses: 0, minutes: 0, invites: 0, connections: 0 };
}

function write(campaignId: string, data: Record<MetricKey, number>) {
  localStorage.setItem(`${NS}:${campaignId}`, JSON.stringify(data));
}

export function inc(campaignId: string, key: MetricKey, by = 1) {
  const d = read(campaignId); 
  d[key] = (d[key] ?? 0) + by; 
  write(campaignId, d);
}

export function getAll(campaignId: string) { 
  return read(campaignId); 
}

export function setInvites(campaignId: string, count: number) {
  const d = read(campaignId); 
  d.invites = count; 
  write(campaignId, d);
}

export function addSessionMinutes(campaignId: string, ms: number) {
  const d = read(campaignId); 
  d.minutes += Math.round(ms / 60000); 
  write(campaignId, d);
}
