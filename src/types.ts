export type Theme = 'light' | 'dark' | 'steel';

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

export interface ConsumerOperation {
  id: string;
  representation_id: string;
  consumer_name: string;
  operation: string;
  notes?: string;
  created_at?: string;
  expired_at: string | null;
  superseded_id?: string;
}

export interface IdentityStrategy {
  id: string;
  concept_id: string;
  canonical_key_description: string;
  notes?: string;
  created_at?: string;
  expired_at: string | null;
  superseded_id?: string;
}

export interface RepresentationIdentity {
  id: string;
  representation_id: string;
  identity_strategy_id: string;
  identity_expression: string;
  notes?: string;
  created_at?: string;
  expired_at: string | null;
  superseded_id?: string;
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

export interface ConceptRelationship {
  id: string;
  from_concept_id: string;
  to_concept_id: string;
  relationship_type: string;
  path?: 'green' | 'red' | string | null;
  notes?: string;
  evidence_source?: string;
  evidence_type?: string;
  confidence?: number;
  evidence_notes?: string;
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

export type TableName =
  | 'owning_subsystem'
  | 'concept'
  | 'representation'
  | 'representation_relationship'
  | 'consumer_operation'
  | 'identity_strategy'
  | 'representation_identity'
  | 'snapshot'
  | 'snapshot_observation'
  | 'drift_finding'
  | 'concept_relationship'
  | 'relationship_type';

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
  pathFilter: 'all' | 'green' | 'red';
  driftSeverityFilter: 'all' | 'low' | 'medium' | 'high' | 'critical';
}

export type ActiveTab =
  | 'graph'
  | 'tables'
  | 'snapshots_drift'
  | 'schema_meta'
  | 'api_sandbox';

export type GraphViewMode = 'concept' | 'representation' | 'subsystem_map';
