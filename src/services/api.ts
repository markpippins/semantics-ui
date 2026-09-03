import {
  ListResponse,
  MetaResponse,
  TableName,
  ErrorEnvelope,
} from '../types';

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({ error: 'invalid_json', message: 'Failed to parse JSON response' }));
  if (!res.ok) {
    const errData = data as ErrorEnvelope;
    throw new ApiError(errData.error || 'unknown_error', errData.message || res.statusText, res.status);
  }
  return data as T;
}

export async function fetchMeta(): Promise<MetaResponse> {
  const res = await fetch('/api/meta');
  return handleResponse<MetaResponse>(res);
}

export async function fetchTableList<T>(
  tableName: TableName,
  limit = 100,
  offset = 0,
  includeExpired = false
): Promise<ListResponse<T>> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
    includeExpired: includeExpired ? 'true' : 'false',
  });
  const res = await fetch(`/api/${tableName}?${params.toString()}`);
  return handleResponse<ListResponse<T>>(res);
}

export async function fetchTableRow<T>(tableName: TableName, id: string | number): Promise<T> {
  const res = await fetch(`/api/${tableName}/${encodeURIComponent(String(id))}`);
  return handleResponse<T>(res);
}

export async function createTableRow<T>(tableName: TableName, procParams: Record<string, any>): Promise<T> {
  const res = await fetch(`/api/${tableName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(procParams),
  });
  return handleResponse<T>(res);
}

export async function updateTableRowSupersede<T>(
  tableName: TableName,
  id: string | number,
  procParams: Record<string, any>
): Promise<T & { superseded_id: string | number }> {
  const res = await fetch(`/api/${tableName}/${encodeURIComponent(String(id))}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(procParams),
  });
  return handleResponse<T & { superseded_id: string | number }>(res);
}

export async function softDeleteTableRow(
  tableName: TableName,
  id: string | number
): Promise<{ table: string; id: string; deleted: number }> {
  const res = await fetch(`/api/${tableName}/${encodeURIComponent(String(id))}`, {
    method: 'DELETE',
  });
  return handleResponse<{ table: string; id: string; deleted: number }>(res);
}

export async function resolveDriftFinding(
  id: string,
  resolvedAt?: string
): Promise<{ id: string; resolved: number }> {
  const res = await fetch(`/api/drift_finding/${encodeURIComponent(id)}/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(resolvedAt ? { p_resolved_at: resolvedAt } : {}),
  });
  return handleResponse<{ id: string; resolved: number }>(res);
}

export async function fetchConceptRelationshipEvidence(id: string) {
  const res = await fetch(`/api/concept-relationship/${encodeURIComponent(id)}/evidence`);
  return handleResponse<import('../types').RelationshipEvidenceResponse>(res);
}

export async function fetchRepresentationRelationshipEvidence(id: string) {
  const res = await fetch(`/api/representation-relationship/${encodeURIComponent(id)}/evidence`);
  return handleResponse<import('../types').RelationshipEvidenceResponse>(res);
}

export async function fetchEvidenceItems(paramsObj: {
  evidenceType?: string;
  origin?: string;
  sourceHash?: string;
  uri?: string;
  includeExpired?: boolean;
  limit?: number;
  offset?: number;
}): Promise<{ items: import('../types').FormattedEvidenceItem[]; total: number; page: number; pageSize: number }> {
  const query = new URLSearchParams();
  if (paramsObj.evidenceType) query.set('evidenceType', paramsObj.evidenceType);
  if (paramsObj.origin) query.set('origin', paramsObj.origin);
  if (paramsObj.sourceHash) query.set('sourceHash', paramsObj.sourceHash);
  if (paramsObj.uri) query.set('uri', paramsObj.uri);
  if (paramsObj.includeExpired) query.set('includeExpired', 'true');
  if (paramsObj.limit) query.set('limit', String(paramsObj.limit));
  if (paramsObj.offset) query.set('offset', String(paramsObj.offset));

  const res = await fetch(`/api/evidence-item?${query.toString()}`);
  return handleResponse<{ items: import('../types').FormattedEvidenceItem[]; total: number; page: number; pageSize: number }>(res);
}

export async function fetchEvidenceTypes(includeExpired = false) {
  const query = new URLSearchParams();
  if (includeExpired) query.set('includeExpired', 'true');
  const res = await fetch(`/api/evidence-type?${query.toString()}`);
  return handleResponse<{ items: any[]; total: number }>(res);
}
