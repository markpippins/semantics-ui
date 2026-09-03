export type Theme = 'light' | 'dark' | 'steel';

// Retired with the ontology tables (cutover reconciliation, record
// f3320458): owning_subsystem, concept, representation,
// representation_relationship, consumer_operation, identity_strategy,
// representation_identity, concept_relationship, execution_claim —
// owned by resolution.* as the evaluation model. The UI now serves the
// converged sol.semantics shape (+ canonical_asset pending the ownership
// decision). The Graph Explorer types below are restored because the
// backend (semantics-srv) serves the ontology tables from resolution.*
// via the same per-table REST endpoints.

export interface OwningSubsystem {
  id: number;
  name: string;
  description: string;
  path?: string;
  created_at?: string;
  expired_at: string | null;
  superseded_id?: number | string;
}

export interface Concept {
  id: string;
  name: string;
  description: string;
  created_at?: string;
  expired_at: string | null;
  superseded_id?: string;
}

export interface Representation {
  id: string;
  concept_id: string;
  label: string;
  schema_name?: string;
  table_name?: string;
  owning_subsystem_id: number;
  owner?: string;
  raw_metadata?: Record<string, any>;
  created_at?: string;
  expired_at: string | null;
  superseded_id?: string;
}

export interface RepresentationRelationship {
  id: string;
  from_representation_id: string;
  to_representation_id: string;
  relationship_type: string;
  notes?: string;
  evidence_source?: string;
  evidence_type?: string;
  confidence?: number;
  evidence_notes?: string;
  created_at?: string;
  expired_at: string | null;
  superseded_id?: string;
}

export interface ConceptRelationship {
  id: string;
  from_concept_id: string;
  to_concept_id: string;
  relationship_type: string;
  path?: 'green' | 'red' | 'orange' | string | null;
  notes?: string;
  evidence_source?: string;
  evidence_type?: string;
  confidence?: number;
  evidence_notes?: string;
  created_at?: string;
  expired_at: string | null;
  superseded_id?: string;
}

export interface RelationshipEvidenceResponse {
  relationship: {
    id: string;
    fromConceptId?: string;
    toConceptId?: string;
    fromRepresentationId?: string;
    toRepresentationId?: string;
    relationshipType: string;
    path?: string;
    notes?: string;
  };
  evidence: Array<{
    statementEvidenceId: string;
    role: string;
    strength?: number | null;
    comment?: string | null;
    evidenceItem: FormattedEvidenceItem;
  }>;
}

export interface Snapshot {
  id: string;
  label: string;
  version: string;
  parent_id: string | null;
  status: 'draft' | 'published' | 'archived' | string;
  created_by: string;
  notes?: string;
  created_at?: string;
  expired_at: string | null;
  superseded_id?: string;
}

export interface SnapshotObservation {
  id: string;
  snapshot_id: string;
  representation_id: string;
  lifecycle_state: 'active' | 'deprecated' | 'flagged_drift' | 'retired' | string;
  is_completed_fix?: boolean;
  completed_fix_ref?: string | null;
  audit_reason?: string;
  safe_to_retire?: boolean;
  created_at?: string;
  expired_at: string | null;
  superseded_id?: string;
}

export interface DriftFinding {
  id: string;
  observation_id: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical' | string;
  resolved_at: string | null;
  created_at?: string;
  expired_at: string | null;
  superseded_id?: string;
}

export interface RelationshipType {
  id: string;
  name: string;
  description: string;
  scope?: 'concept' | 'representation' | 'both' | string;
  notes?: string;
  created_at?: string;
  expired_at: string | null;
  superseded_id?: string;
}

export interface EvidenceType {
  id: string;
  name: string;
  description: string;
  origin_category?: string;
  notes?: string;
  created_at?: string;
  expired_at: string | null;
  superseded_id?: string;
}

export interface EvidenceItem {
  id: string;
  evidence_type_id: string;
  uri?: string;
  excerpt?: string;
  note?: string;
  origin?: string;
  captured_at?: number | string;
  source_hash?: string;
  metadata?: Record<string, any>;
  valid_from?: string;
  valid_to?: string | null;
  created_at?: string;
  expired_at: string | null;
}

export interface StatementEvidence {
  id: string;
  evidence_item_id: string;
  statement_type:
    | 'source_observation'
    | 'concept_relationship'
    | 'representation_relationship'
    | 'execution_claim'
    | 'resolution_proposition'
    | string;
  statement_id: string;
  role: string;
  strength?: number;
  comment?: string;
  created_at?: string;
  expired_at: string | null;
  superseded_id?: string;
}

export interface FormattedEvidenceItem {
  id: string;
  evidenceTypeId: string;
  evidenceType: string;
  uri: string | null;
  excerpt: string | null;
  note: string | null;
  origin: string | null;
  capturedAt: number | null;
  sourceHash: string | null;
  metadata: Record<string, any> | null;
  validFrom: string | null;
  validTo: string | null;
  createdAt: string | null;
  expiredAt: string | null;
}

export type TableName =
  | 'concept'
  | 'concept_relationship'
  | 'representation'
  | 'representation_relationship'
  | 'owning_subsystem'
  | 'snapshot'
  | 'snapshot_observation'
  | 'drift_finding'
  | 'relationship_type'
  | 'evidence_type'
  | 'evidence_item'
  | 'statement_evidence'
  | 'canonical_asset'
  | 'asset_revision'
  | 'source_observation'
  | 'asset_identity_claim'
  | 'asset_relation';

export interface ListResponse<T> {
  table: string;
  count: number;
  items: T[];
}

export interface ErrorEnvelope {
  error: string;
  message: string;
}

export interface TableMetaItem {
  table: TableName;
  label: string;
  idType: 'smallint' | 'uuid';
  idAuto: boolean;
  active: number;
  total: number;
}

export interface MetaResponse {
  service: string;
  schema: string;
  tables: TableMetaItem[];
  procs: number;
  writableParams: Record<TableName, string[]>;
}

export interface FilterState {
  searchQuery: string;
  selectedSubsystemId: number | 'all';
  selectedRelType: string | 'all';
  includeExpired: boolean;
  minConfidence: number;
  pathFilter: 'all' | 'green' | 'red' | 'orange';
  driftSeverityFilter: 'all' | 'low' | 'medium' | 'high' | 'critical';
}

export type ActiveTab =
  | 'graph'
  | 'tables'
  | 'evidence'
  | 'snapshots_drift'
  | 'schema_meta'
  | 'api_sandbox';

export type GraphViewMode = 'concept' | 'representation' | 'subsystem_map';
