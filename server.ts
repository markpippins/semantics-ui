import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

app.use(express.json());

// Helper for generating UUIDs
function randomUUID() {
  return 'f' + Math.random().toString(36).substring(2, 11) + '-' +
         Math.random().toString(36).substring(2, 6) + '-4' +
         Math.random().toString(36).substring(2, 5) + '-a' +
         Math.random().toString(36).substring(2, 5) + '-' +
         Date.now().toString(36);
}

// Memory database tables
interface DbState {
  owning_subsystem: any[];
  concept: any[];
  representation: any[];
  representation_relationship: any[];
  consumer_operation: any[];
  identity_strategy: any[];
  representation_identity: any[];
  snapshot: any[];
  snapshot_observation: any[];
  drift_finding: any[];
  concept_relationship: any[];
  relationship_type: any[];
  evidence_type: any[];
  evidence_item: any[];
  statement_evidence: any[];
}

// Initial relationship types (31 active)
const INITIAL_REL_TYPES = [
  'basis_of', 'calls', 'constrains', 'consumes', 'defines',
  'depends_on_decision', 'derived', 'derives_from', 'emits', 'equivalent',
  'evidences', 'governs', 'implements', 'interprets', 'legacy', 'mediates',
  'member_of', 'observes', 'owns', 'partial', 'produces', 'projects',
  'provenance_of', 'questions', 'reads', 'spawns', 'supersedes',
  'transforms_into', 'uses', 'validates', 'writes'
];

const nowISO = new Date().toISOString();

// Seed data initialization
function seedDatabase(): DbState {
  const relationship_type = INITIAL_REL_TYPES.map((name, idx) => ({
    id: `rel-type-uuid-${idx + 1}`,
    name,
    description: `Defines semantic relationship mapping for ${name}`,
    scope: idx % 3 === 0 ? 'concept' : idx % 3 === 1 ? 'representation' : 'both',
    notes: 'System standard vocabulary term',
    created_at: nowISO,
    expired_at: null,
  }));

  const owning_subsystem = [
    { id: 1, name: 'core-auth', description: 'Core Identity & Access Management Subsystem', path: '/subsystems/core-auth', expired_at: null },
    { id: 2, name: 'payment-gateway', description: 'Payment Ingestion & Settlement Gateway', path: '/subsystems/payment-gateway', expired_at: null },
    { id: 3, name: 'order-mgmt', description: 'Order Processing & Lifecycle Engine', path: '/subsystems/order-mgmt', expired_at: null },
    { id: 4, name: 'user-identity', description: 'User Profile & Identity Record Vault', path: '/subsystems/user-identity', expired_at: null },
    { id: 5, name: 'telemetry-bus', description: 'Event Streaming & Metrics Ingestion Bus', path: '/subsystems/telemetry-bus', expired_at: null },
    { id: 6, name: 'compliance-vault', description: 'Audit Logging & Regulatory Data Storage', path: '/subsystems/compliance-vault', expired_at: null },
    { id: 7, name: 'notifier', description: 'Multi-channel Push & Email Notification Service', path: '/subsystems/notifier', expired_at: null },
    { id: 8, name: 'fraud-risk', description: 'Real-time Fraud & Risk Assessment Engine', path: '/subsystems/fraud-risk', expired_at: null },
  ];

  const concepts = [
    { id: 'c-101', name: 'User Account', description: 'Core entity representing an authenticated user profile and credentials', expired_at: null },
    { id: 'c-102', name: 'Payment Transaction', description: 'Financial transfer event recorded between buyer and seller', expired_at: null },
    { id: 'c-103', name: 'Authorization Policy', description: 'Set of security permissions governing resource access', expired_at: null },
    { id: 'c-104', name: 'Order Receipt', description: 'Proof of purchase containing line items and calculated totals', expired_at: null },
    { id: 'c-105', name: 'Financial Ledger Entry', description: 'Double-entry accounting journal record', expired_at: null },
    { id: 'c-106', name: 'Identity Token', description: 'Cryptographically signed JWT or session token', expired_at: null },
    { id: 'c-107', name: 'Risk Assessment Score', description: 'Evaluated fraud likelihood score for a transaction or IP', expired_at: null },
    { id: 'c-108', name: 'Audit Log Event', description: 'Immutable historical record of a system action or mutation', expired_at: null },
    { id: 'c-109', name: 'Notification Template', description: 'Formatted messaging blueprint for transactional emails/SMS', expired_at: null },
    { id: 'c-110', name: 'Customer Session', description: 'Active stateful user interaction window', expired_at: null },
  ];

  const representations = [
    { id: 'r-201', concept_id: 'c-101', label: 'Users Table', schema_name: 'auth_db', table_name: 'users', owning_subsystem_id: 1, owner: 'Auth Team', raw_metadata: { partitionKey: 'tenant_id', indices: ['email_idx'] }, expired_at: null },
    { id: 'r-202', concept_id: 'c-106', label: 'Tokens Cache', schema_name: 'auth_db', table_name: 'session_tokens', owning_subsystem_id: 1, owner: 'Auth Team', raw_metadata: { ttlSeconds: 86400, cacheEngine: 'Redis' }, expired_at: null },
    { id: 'r-203', concept_id: 'c-102', label: 'Transactions Table', schema_name: 'pay_db', table_name: 'transactions', owning_subsystem_id: 2, owner: 'Fintech Ops', raw_metadata: { retentionDays: 2555, pciCompliance: true }, expired_at: null },
    { id: 'r-204', concept_id: 'c-104', label: 'Orders Table', schema_name: 'orders_db', table_name: 'orders', owning_subsystem_id: 3, owner: 'Commerce Core', raw_metadata: { shardKey: 'order_id' }, expired_at: null },
    { id: 'r-205', concept_id: 'c-101', label: 'Profiles Document Store', schema_name: 'user_db', table_name: 'profiles', owning_subsystem_id: 4, owner: 'User Exp', raw_metadata: { storage: 'MongoDB' }, expired_at: null },
    { id: 'r-206', concept_id: 'c-108', label: 'Telemetry Stream Topic', schema_name: 'event_stream', table_name: 'telemetry_events', owning_subsystem_id: 5, owner: 'Data Infra', raw_metadata: { kafkaTopic: 'prod.telemetry.v1' }, expired_at: null },
    { id: 'r-207', concept_id: 'c-108', label: 'Compliance Records', schema_name: 'audit_db', table_name: 'compliance_records', owning_subsystem_id: 6, owner: 'Security Team', raw_metadata: { immutable: true, encryption: 'AES-256' }, expired_at: null },
    { id: 'r-208', concept_id: 'c-107', label: 'Risk Scores Cache', schema_name: 'fraud_db', table_name: 'risk_scores', owning_subsystem_id: 8, owner: 'Risk ML', raw_metadata: { modelVersion: '2.4.1' }, expired_at: null },
  ];

  const concept_relationship = [
    { id: 'cr-301', from_concept_id: 'c-101', to_concept_id: 'c-102', relationship_type: 'produces', path: 'green', notes: 'User accounts originate payment transactions', expired_at: null },
    { id: 'cr-302', from_concept_id: 'c-102', to_concept_id: 'c-105', relationship_type: 'transforms_into', path: 'green', notes: 'Settled payments transform into double-entry ledger items', expired_at: null },
    { id: 'cr-303', from_concept_id: 'c-103', to_concept_id: 'c-101', relationship_type: 'governs', path: 'green', notes: 'Authorization policies restrict user account actions', expired_at: null },
    { id: 'cr-304', from_concept_id: 'c-101', to_concept_id: 'c-106', relationship_type: 'spawns', path: 'green', notes: 'Successful authentication spawns identity tokens', expired_at: null },
    { id: 'cr-305', from_concept_id: 'c-102', to_concept_id: 'c-107', relationship_type: 'evidences', path: 'orange', notes: 'Unflagged transaction patterns evidence potential risk scores (under review)', expired_at: null },
    { id: 'cr-306', from_concept_id: 'c-106', to_concept_id: 'c-110', relationship_type: 'implements', path: 'green', notes: 'Identity token implements stateful user session', expired_at: null },
    { id: 'cr-307', from_concept_id: 'c-110', to_concept_id: 'c-108', relationship_type: 'emits', path: 'green', notes: 'Customer sessions emit audit log events', expired_at: null },
    { id: 'cr-308', from_concept_id: 'c-104', to_concept_id: 'c-102', relationship_type: 'derives_from', path: 'green', notes: 'Order receipt derives item breakdown from transaction', expired_at: null },
    { id: 'cr-309', from_concept_id: 'c-107', to_concept_id: 'c-103', relationship_type: 'constrains', path: 'red', notes: 'High risk scores dynamically constrain authorization policies', expired_at: null },
  ];

  const representation_relationship = [
    { id: 'rr-401', from_representation_id: 'r-201', to_representation_id: 'r-203', relationship_type: 'writes', notes: 'Auth users trigger write events into pay_db.transactions', expired_at: null },
    { id: 'rr-402', from_representation_id: 'r-203', to_representation_id: 'r-204', relationship_type: 'validates', notes: 'Payment transaction validates corresponding order row', expired_at: null },
    { id: 'rr-403', from_representation_id: 'r-205', to_representation_id: 'r-201', relationship_type: 'equivalent', notes: 'User profile document maps 1:1 to auth_db users row', expired_at: null },
    { id: 'rr-404', from_representation_id: 'r-203', to_representation_id: 'r-208', relationship_type: 'calls', notes: 'Payment gateway calls fraud risk evaluation score table', expired_at: null },
    { id: 'rr-405', from_representation_id: 'r-202', to_representation_id: 'r-207', relationship_type: 'emits', notes: 'Token invalidations emit compliance records', expired_at: null },
    { id: 'rr-406', from_representation_id: 'r-206', to_representation_id: 'r-207', relationship_type: 'projects', notes: 'Kafka telemetry projects compliance summaries to audit DB', expired_at: null },
  ];

  const evidence_type = [
    { id: 'et-1001', name: 'agent_record', description: 'Telemetry or diagnostic record produced by automated agent', origin_category: 'telemetry', notes: 'Vocabulary term', created_at: nowISO, expired_at: null },
    { id: 'et-1002', name: 'architecture_doc', description: 'System design or API architecture documentation reference', origin_category: 'documentation', notes: 'Vocabulary term', created_at: nowISO, expired_at: null },
    { id: 'et-1003', name: 'code_analysis', description: 'Automated AST or static code analysis output', origin_category: 'code', notes: 'Vocabulary term', created_at: nowISO, expired_at: null },
    { id: 'et-1004', name: 'event_schema', description: 'Schema declaration from event stream bus', origin_category: 'schema', notes: 'Vocabulary term', created_at: nowISO, expired_at: null },
    { id: 'et-1005', name: 'standard_reference', description: 'RFC or industry standard specification reference', origin_category: 'standards', notes: 'Vocabulary term', created_at: nowISO, expired_at: null },
  ];

  const evidence_item = [
    {
      id: 'ei-2001',
      evidence_type_id: 'et-1002',
      uri: 'doc:payment-spec-v3.1',
      excerpt: 'Payment Spec v3.1 section 4.2 defines checkout transaction creation',
      note: 'Verified in API contract docs',
      origin: 'harvested',
      captured_at: Date.now() - 86400000,
      source_hash: 'c61fe56f890a123b',
      metadata: { version: '3.1', author: 'Fintech Architecture' },
      valid_from: nowISO,
      valid_to: null,
      created_at: nowISO,
      expired_at: null,
    },
    {
      id: 'ei-2002',
      evidence_type_id: 'et-1003',
      uri: 'code:ledger-worker/src/processor.ts',
      excerpt: 'Confirmed via ledger-worker codebase AST parse',
      note: 'Double entry ledger transform function',
      origin: 'harvested',
      captured_at: Date.now() - 43200000,
      source_hash: 'd82ae1234567890f',
      metadata: { repo: 'ledger-worker', branch: 'main' },
      valid_from: nowISO,
      valid_to: null,
      created_at: nowISO,
      expired_at: null,
    },
    {
      id: 'ei-2003',
      evidence_type_id: 'et-1001',
      uri: 'agent-record:cc1bcfce-9a32-4112-a1',
      excerpt: 'T01 snapshot confirms payment transaction relationship claim',
      note: 'Harvested via automated agent run',
      origin: 'harvested',
      captured_at: Date.now() - 3600000,
      source_hash: 'a1b2c3d4e5f67890',
      metadata: { runId: 'run-9981' },
      valid_from: nowISO,
      valid_to: null,
      created_at: nowISO,
      expired_at: null,
    },
  ];

  const statement_evidence = [
    {
      id: 'se-3001',
      evidence_item_id: 'ei-2001',
      statement_type: 'concept_relationship',
      statement_id: 'cr-301',
      role: 'supports',
      strength: 0.98,
      comment: 'Payment Spec v3.1 confirms user accounts originate payment transactions',
      created_at: nowISO,
      expired_at: null,
    },
    {
      id: 'se-3002',
      evidence_item_id: 'ei-2003',
      statement_type: 'concept_relationship',
      statement_id: 'cr-301',
      role: 'supports',
      strength: 0.95,
      comment: 'T01 agent telemetry confirms active call chain',
      created_at: nowISO,
      expired_at: null,
    },
    {
      id: 'se-3003',
      evidence_item_id: 'ei-2002',
      statement_type: 'concept_relationship',
      statement_id: 'cr-302',
      role: 'supports',
      strength: 0.95,
      comment: 'Confirmed via ledger-worker codebase',
      created_at: nowISO,
      expired_at: null,
    },
    {
      id: 'se-3004',
      evidence_item_id: 'ei-2002',
      statement_type: 'representation_relationship',
      statement_id: 'rr-401',
      role: 'supports',
      strength: 0.92,
      comment: 'Direct SQL call chain verified in transaction controller',
      created_at: nowISO,
      expired_at: null,
    },
  ];

  const consumer_operation = [
    { id: 'co-501', representation_id: 'r-203', consumer_name: 'Billing Worker Service', operation: 'write', notes: 'Inserts transaction state changes', expired_at: null },
    { id: 'co-502', representation_id: 'r-201', consumer_name: 'Auth Gateway Middleware', operation: 'read', notes: 'Reads user credential hashes', expired_at: null },
    { id: 'co-503', representation_id: 'r-204', consumer_name: 'Order Fulfillment Daemon', operation: 'read_write', notes: 'Updates order status on dispatch', expired_at: null },
  ];

  const identity_strategy = [
    { id: 'is-601', concept_id: 'c-101', canonical_key_description: 'Tenant ID + User UUIDv4 composite primary key', notes: 'Ensures multi-tenant isolation', expired_at: null },
    { id: 'is-602', concept_id: 'c-102', canonical_key_description: 'SHA256 Idempotency Hash + Gateway Reference ID', notes: 'Prevents double-charging transactions', expired_at: null },
  ];

  const representation_identity = [
    { id: 'ri-701', representation_id: 'r-201', identity_strategy_id: 'is-601', identity_expression: 'concat(tenant_id, ":", user_id)', notes: 'Primary key index expression', expired_at: null },
    { id: 'ri-702', representation_id: 'r-203', identity_strategy_id: 'is-602', identity_expression: 'txn_hash_pci_v2(idempotency_key)', notes: 'Transaction identity lookup expression', expired_at: null },
  ];

  const snapshots = [
    { id: 'snap-801', label: 'Baseline Q2 System Architecture', version: '1.0.0', parent_id: null, status: 'published', created_by: 'lead_architect@company.com', notes: 'First formal baseline snapshot after Q2 migration', created_at: nowISO, expired_at: null },
    { id: 'snap-802', label: 'Q3 Audit & Compliance Baseline', version: '1.1.0', parent_id: 'snap-801', status: 'draft', created_by: 'security_lead@company.com', notes: 'Updated version adding compliance vault & risk scores', created_at: nowISO, expired_at: null },
  ];

  const snapshot_observations = [
    { id: 'so-901', snapshot_id: 'snap-801', representation_id: 'r-201', lifecycle_state: 'active', is_completed_fix: false, completed_fix_ref: null, audit_reason: 'Core auth database table baseline verified', safe_to_retire: false, expired_at: null },
    { id: 'so-902', snapshot_id: 'snap-801', representation_id: 'r-203', lifecycle_state: 'active', is_completed_fix: false, completed_fix_ref: null, audit_reason: 'Payment transaction store baseline verified', safe_to_retire: false, expired_at: null },
    { id: 'so-903', snapshot_id: 'snap-802', representation_id: 'r-208', lifecycle_state: 'flagged_drift', is_completed_fix: false, completed_fix_ref: null, audit_reason: 'Risk scores table missing formal FK verification to core auth', safe_to_retire: false, expired_at: null },
  ];

  const drift_findings = [
    { id: 'df-1001', observation_id: 'so-903', description: 'Unmapped representation field in fraud_db.risk_scores missing foreign key reference to core_auth.users', severity: 'high', resolved_at: null, expired_at: null },
    { id: 'df-1002', observation_id: 'so-901', description: 'Legacy read path bypasses identity token check in session cache', severity: 'critical', resolved_at: null, expired_at: null },
    { id: 'df-1003', observation_id: 'so-902', description: 'Deprecation notice for v1 transaction schema representation', severity: 'medium', resolved_at: '2026-08-01T12:00:00.000Z', expired_at: null },
  ];

  return {
    owning_subsystem,
    concept: concepts,
    representation: representations,
    representation_relationship,
    consumer_operation,
    identity_strategy,
    representation_identity,
    snapshot: snapshots,
    snapshot_observation: snapshot_observations,
    drift_finding: drift_findings,
    concept_relationship,
    relationship_type,
    evidence_type,
    evidence_item,
    statement_evidence,
  };
}

const db: DbState = seedDatabase();

// Writable params mapping according to §6
const WRITABLE_PARAMS: Record<string, { idType: string; idAuto: boolean; required: string[]; params: string[] }> = {
  owning_subsystem: {
    idType: 'smallint', idAuto: false, required: ['id', 'name'],
    params: ['p_id', 'p_name', 'p_description', 'p_path', 'p_expired_at']
  },
  concept: {
    idType: 'uuid', idAuto: true, required: ['name'],
    params: ['p_name', 'p_description', 'p_expired_at']
  },
  representation: {
    idType: 'uuid', idAuto: true, required: ['concept_id', 'label', 'owning_subsystem_id'],
    params: ['p_concept_id', 'p_label', 'p_schema_name', 'p_table_name', 'p_owning_subsystem_id', 'p_owner', 'p_raw_metadata', 'p_expired_at']
  },
  representation_relationship: {
    idType: 'uuid', idAuto: true, required: ['from_representation_id', 'to_representation_id', 'relationship_type'],
    params: ['p_from_representation_id', 'p_to_representation_id', 'p_relationship_type', 'p_notes', 'p_expired_at']
  },
  consumer_operation: {
    idType: 'uuid', idAuto: true, required: ['representation_id', 'consumer_name', 'operation'],
    params: ['p_representation_id', 'p_consumer_name', 'p_operation', 'p_notes', 'p_expired_at']
  },
  identity_strategy: {
    idType: 'uuid', idAuto: true, required: ['concept_id', 'canonical_key_description'],
    params: ['p_concept_id', 'p_canonical_key_description', 'p_notes', 'p_expired_at']
  },
  representation_identity: {
    idType: 'uuid', idAuto: true, required: ['representation_id', 'identity_strategy_id', 'identity_expression'],
    params: ['p_representation_id', 'p_identity_strategy_id', 'p_identity_expression', 'p_notes', 'p_expired_at']
  },
  snapshot: {
    idType: 'uuid', idAuto: true, required: ['label', 'version', 'created_by'],
    params: ['p_label', 'p_version', 'p_parent_id', 'p_status', 'p_created_by', 'p_notes', 'p_expired_at']
  },
  snapshot_observation: {
    idType: 'uuid', idAuto: true, required: ['snapshot_id', 'representation_id', 'lifecycle_state'],
    params: ['p_snapshot_id', 'p_representation_id', 'p_lifecycle_state', 'p_is_completed_fix', 'p_completed_fix_ref', 'p_audit_reason', 'p_safe_to_retire', 'p_expired_at']
  },
  drift_finding: {
    idType: 'uuid', idAuto: true, required: ['observation_id', 'description', 'severity'],
    params: ['p_observation_id', 'p_description', 'p_severity', 'p_resolved_at', 'p_expired_at']
  },
  concept_relationship: {
    idType: 'uuid', idAuto: true, required: ['from_concept_id', 'to_concept_id', 'relationship_type'],
    params: ['p_from_concept_id', 'p_to_concept_id', 'p_relationship_type', 'p_path', 'p_notes', 'p_expired_at']
  },
  relationship_type: {
    idType: 'uuid', idAuto: true, required: ['name', 'description'],
    params: ['p_name', 'p_description', 'p_scope', 'p_notes', 'p_expired_at']
  },
  evidence_type: {
    idType: 'uuid', idAuto: true, required: ['name', 'description'],
    params: ['p_name', 'p_description', 'p_origin_category', 'p_notes', 'p_expired_at']
  },
  evidence_item: {
    idType: 'uuid', idAuto: true, required: ['evidence_type_id'],
    params: ['p_evidence_type_id', 'p_uri', 'p_excerpt', 'p_note', 'p_origin', 'p_captured_at', 'p_source_hash', 'p_metadata', 'p_valid_from', 'p_valid_to', 'p_expired_at']
  },
  statement_evidence: {
    idType: 'uuid', idAuto: true, required: ['evidence_item_id', 'statement_type', 'statement_id', 'role'],
    params: ['p_evidence_item_id', 'p_statement_type', 'p_statement_id', 'p_role', 'p_strength', 'p_comment', 'p_expired_at']
  },
};

const TABLE_LABELS: Record<string, string> = {
  owning_subsystem: 'owning subsystem (fleet)',
  concept: 'concept (class)',
  representation: 'representation (physical form)',
  representation_relationship: 'representation relationship',
  consumer_operation: 'consumer operation',
  identity_strategy: 'identity strategy',
  representation_identity: 'representation identity',
  snapshot: 'snapshot (baseline)',
  snapshot_observation: 'snapshot observation',
  drift_finding: 'drift finding',
  concept_relationship: 'concept relationship',
  relationship_type: 'relationship type (vocabulary)',
  evidence_type: 'evidence type (vocabulary of evidence kinds)',
  evidence_item: 'evidence item (immutable, hash-deduplicated evidence record)',
  statement_evidence: 'statement evidence (evidence linked to a relationship claim)',
};

// ------------------- API ENDPOINTS ------------------- //

// Health Endpoint (§2.1)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'semantics-srv',
    port: PORT,
    pid: process.pid,
    timestamp: new Date().toISOString()
  });
});

// Meta Endpoint (§3)
app.get('/api/meta', (req, res) => {
  try {
    const tablesInfo = Object.keys(WRITABLE_PARAMS).map((tbl) => {
      const rows = (db as any)[tbl] || [];
      const activeCount = rows.filter((r: any) => r.expired_at === null).length;
      const totalCount = rows.length;
      const meta = WRITABLE_PARAMS[tbl];
      return {
        table: tbl,
        label: TABLE_LABELS[tbl] || tbl,
        idType: meta.idType,
        idAuto: meta.idAuto,
        active: activeCount,
        total: totalCount
      };
    });

    const writableParamsObj: Record<string, string[]> = {};
    Object.keys(WRITABLE_PARAMS).forEach(tbl => {
      writableParamsObj[tbl] = WRITABLE_PARAMS[tbl].params;
    });

    res.json({
      service: 'semantics-srv',
      schema: 'semantics',
      tables: tablesInfo,
      procs: 39,
      writableParams: writableParamsObj
    });
  } catch (err: any) {
    res.status(500).json({ error: 'meta_failed', message: err?.message || 'Meta query failed' });
  }
});

// ------------------- EVIDENCE ENDPOINTS ------------------- //

function toCamelCaseKey(key: string): string {
  return key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function objectToCamelCase(obj: any): any {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(objectToCamelCase);
  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    const camelKey = toCamelCaseKey(key);
    result[camelKey] = val;
  }
  return result;
}

function formatEvidenceItem(item: any) {
  if (!item) return null;
  const typeRow = db.evidence_type.find(t => t.id === item.evidence_type_id || t.name === item.evidence_type_id);
  const typeName = typeRow ? typeRow.name : item.evidence_type_id;

  return {
    id: item.id,
    evidenceTypeId: item.evidence_type_id,
    evidenceType: typeName,
    uri: item.uri || null,
    excerpt: item.excerpt || null,
    note: item.note || null,
    origin: item.origin || null,
    capturedAt: typeof item.captured_at === 'number' ? item.captured_at : (item.captured_at ? new Date(item.captured_at).getTime() : null),
    sourceHash: item.source_hash || null,
    metadata: item.metadata || null,
    validFrom: item.valid_from || null,
    validTo: item.valid_to || null,
    createdAt: item.created_at || null,
    expiredAt: item.expired_at || null,
  };
}

// 1. Concept Relationship Evidence Join
app.get('/api/concept-relationship/:id/evidence', (req, res) => {
  try {
    const relId = req.params.id;
    const rel = db.concept_relationship.find(r => String(r.id) === relId && r.expired_at === null);
    if (!rel) {
      return res.status(404).json({ error: 'Concept relationship not found', message: `No active concept_relationship found with id '${relId}'.` });
    }

    const statementLinks = db.statement_evidence.filter(se => se.expired_at === null && se.statement_type === 'concept_relationship' && String(se.statement_id) === relId);

    const evidenceList = statementLinks.map(se => {
      const itemRow = db.evidence_item.find(ei => ei.id === se.evidence_item_id && ei.expired_at === null);
      return {
        statementEvidenceId: se.id,
        role: se.role,
        strength: se.strength !== undefined && se.strength !== null ? parseFloat(se.strength) : null,
        comment: se.comment || null,
        evidenceItem: itemRow ? formatEvidenceItem(itemRow) : null,
      };
    }).filter(e => e.evidenceItem !== null);

    res.json({
      relationship: {
        id: rel.id,
        fromConceptId: rel.from_concept_id,
        toConceptId: rel.to_concept_id,
        relationshipType: rel.relationship_type,
        path: rel.path || null,
        notes: rel.notes || null,
      },
      evidence: evidenceList,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'get_relationship_evidence_failed', message: err?.message || 'Failed to fetch evidence for concept relationship' });
  }
});

// 2. Representation Relationship Evidence Join
app.get('/api/representation-relationship/:id/evidence', (req, res) => {
  try {
    const relId = req.params.id;
    const rel = db.representation_relationship.find(r => String(r.id) === relId && r.expired_at === null);
    if (!rel) {
      return res.status(404).json({ error: 'Representation relationship not found', message: `No active representation_relationship found with id '${relId}'.` });
    }

    const statementLinks = db.statement_evidence.filter(se => se.expired_at === null && se.statement_type === 'representation_relationship' && String(se.statement_id) === relId);

    const evidenceList = statementLinks.map(se => {
      const itemRow = db.evidence_item.find(ei => ei.id === se.evidence_item_id && ei.expired_at === null);
      return {
        statementEvidenceId: se.id,
        role: se.role,
        strength: se.strength !== undefined && se.strength !== null ? parseFloat(se.strength) : null,
        comment: se.comment || null,
        evidenceItem: itemRow ? formatEvidenceItem(itemRow) : null,
      };
    }).filter(e => e.evidenceItem !== null);

    res.json({
      relationship: {
        id: rel.id,
        fromRepresentationId: rel.from_representation_id,
        toRepresentationId: rel.to_representation_id,
        relationshipType: rel.relationship_type,
        notes: rel.notes || null,
      },
      evidence: evidenceList,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'get_relationship_evidence_failed', message: err?.message || 'Failed to fetch evidence for representation relationship' });
  }
});

// 3. Evidence Type Endpoints (idCol override on name)
app.get('/api/evidence-type', (req, res) => {
  try {
    const includeExpired = req.query.includeExpired === 'true' || req.query.includeExpired === '1';
    let limit = parseInt(req.query.limit as string) || 100;
    let offset = parseInt(req.query.offset as string) || 0;

    let rows = includeExpired ? db.evidence_type : db.evidence_type.filter(r => r.expired_at === null);
    const total = rows.length;
    const paginated = rows.slice(offset, offset + limit);

    res.json({
      items: paginated.map(objectToCamelCase),
      total,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
      table: 'evidence_type',
      count: total,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'list_failed', message: err?.message });
  }
});

app.get('/api/evidence-type/:name', (req, res) => {
  try {
    const param = req.params.name;
    const match = db.evidence_type.find(r => r.expired_at === null && (r.name === param || String(r.id) === param));
    if (!match) {
      return res.status(404).json({ error: 'not_found', message: `Evidence type '${param}' not found or is expired.` });
    }
    res.json(objectToCamelCase(match));
  } catch (err: any) {
    res.status(500).json({ error: 'get_failed', message: err?.message });
  }
});

app.post('/api/evidence-type', (req, res) => {
  try {
    const body = req.body || {};
    const name = body.p_name || body.name;
    const description = body.p_description || body.description;
    const originCategory = body.p_origin_category || body.origin_category || body.originCategory;
    const notes = body.p_notes || body.notes;

    if (!name || !description) {
      return res.status(400).json({ error: 'add_failed', message: 'Required parameters name and description missing.' });
    }

    if (db.evidence_type.some(r => r.expired_at === null && r.name.toLowerCase() === name.toLowerCase())) {
      return res.status(400).json({ error: 'duplicate_active_key', message: `Active evidence_type with name '${name}' already exists.` });
    }

    const newRow = {
      id: randomUUID(),
      name,
      description,
      origin_category: originCategory || null,
      notes: notes || null,
      created_at: new Date().toISOString(),
      expired_at: null,
    };

    db.evidence_type.push(newRow);
    res.status(201).json(objectToCamelCase(newRow));
  } catch (err: any) {
    res.status(400).json({ error: 'add_failed', message: err?.message });
  }
});

app.patch('/api/evidence-type/:name', (req, res) => {
  try {
    const param = req.params.name;
    const oldIndex = db.evidence_type.findIndex(r => r.expired_at === null && (r.name === param || String(r.id) === param));
    if (oldIndex === -1) {
      return res.status(404).json({ error: 'not_found', message: `Evidence type '${param}' not found or is expired.` });
    }

    const oldRow = db.evidence_type[oldIndex];
    const body = req.body || {};
    const newName = body.p_new_name || body.p_name || body.name || oldRow.name;
    const description = body.p_description !== undefined ? body.p_description : (body.description !== undefined ? body.description : oldRow.description);
    const originCategory = body.p_origin_category !== undefined ? body.p_origin_category : (body.origin_category !== undefined ? body.origin_category : oldRow.origin_category);
    const notes = body.p_notes !== undefined ? body.p_notes : (body.notes !== undefined ? body.notes : oldRow.notes);

    const newRow = {
      ...oldRow,
      id: randomUUID(),
      name: newName,
      description,
      origin_category: originCategory,
      notes,
      created_at: new Date().toISOString(),
      expired_at: null,
    };

    oldRow.expired_at = new Date().toISOString();
    db.evidence_type.push(newRow);

    res.json({
      ...objectToCamelCase(newRow),
      supersededId: oldRow.id,
    });
  } catch (err: any) {
    res.status(400).json({ error: 'update_failed', message: err?.message });
  }
});

app.delete('/api/evidence-type/:name', (req, res) => {
  try {
    const param = req.params.name;
    const target = db.evidence_type.find(r => r.expired_at === null && (r.name === param || String(r.id) === param));
    if (!target) {
      return res.json({ table: 'evidence_type', id: param, deleted: 0 });
    }
    target.expired_at = new Date().toISOString();
    res.json({ table: 'evidence_type', id: target.name, deleted: 1, expired: true });
  } catch (err: any) {
    res.status(500).json({ error: 'soft_delete_failed', message: err?.message });
  }
});

// 4. Evidence Item Endpoints
app.get('/api/evidence-item', (req, res) => {
  try {
    const includeExpired = req.query.includeExpired === 'true' || req.query.includeExpired === '1';
    let limit = parseInt(req.query.limit as string) || 100;
    let offset = parseInt(req.query.offset as string) || 0;

    let rows = includeExpired ? db.evidence_item : db.evidence_item.filter(r => r.expired_at === null);

    const typeFilter = (req.query.evidenceType || req.query.evidence_type || req.query.evidence_type_id) as string;
    if (typeFilter) {
      const typeMatch = db.evidence_type.find(t => t.name === typeFilter || t.id === typeFilter);
      const targetTypeId = typeMatch ? typeMatch.id : typeFilter;
      rows = rows.filter(r => r.evidence_type_id === targetTypeId || r.evidence_type_id === typeFilter);
    }

    if (req.query.origin) {
      rows = rows.filter(r => r.origin === req.query.origin);
    }

    const uriFilter = (req.query.uri || req.query.uriPrefix) as string;
    if (uriFilter) {
      rows = rows.filter(r => r.uri && r.uri.startsWith(uriFilter));
    }

    const hashFilter = (req.query.sourceHash || req.query.source_hash) as string;
    if (hashFilter) {
      rows = rows.filter(r => r.source_hash === hashFilter);
    }

    const total = rows.length;
    const paginated = rows.slice(offset, offset + limit);

    res.json({
      items: paginated.map(formatEvidenceItem),
      total,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'list_failed', message: err?.message });
  }
});

app.get('/api/evidence-item/:id', (req, res) => {
  try {
    const match = db.evidence_item.find(r => r.expired_at === null && String(r.id) === req.params.id);
    if (!match) {
      return res.status(404).json({ error: 'not_found', message: `Evidence item '${req.params.id}' not found or is expired.` });
    }
    res.json(formatEvidenceItem(match));
  } catch (err: any) {
    res.status(500).json({ error: 'get_failed', message: err?.message });
  }
});

app.post('/api/evidence-item', (req, res) => {
  try {
    const body = req.body || {};
    let typeId = body.p_evidence_type_id || body.evidence_type_id || body.evidenceTypeId || body.evidenceType;
    if (typeId) {
      const typeRow = db.evidence_type.find(t => t.name === typeId || t.id === typeId);
      if (typeRow) typeId = typeRow.id;
    }

    if (!typeId) {
      return res.status(400).json({ error: 'add_failed', message: 'Required parameter evidence_type_id missing.' });
    }

    const sourceHash = body.p_source_hash || body.source_hash || body.sourceHash || null;

    if (sourceHash && db.evidence_item.some(r => r.expired_at === null && r.evidence_type_id === typeId && r.source_hash === sourceHash)) {
      return res.status(400).json({ error: 'duplicate_evidence_item', message: 'An active evidence_item with this evidence_type_id and source_hash already exists.' });
    }

    const nowISO = new Date().toISOString();
    const newRow = {
      id: randomUUID(),
      evidence_type_id: typeId,
      uri: body.p_uri || body.uri || null,
      excerpt: body.p_excerpt || body.excerpt || null,
      note: body.p_note || body.note || null,
      origin: body.p_origin || body.origin || 'harvested',
      captured_at: body.p_captured_at || body.captured_at || body.capturedAt || Date.now(),
      source_hash: sourceHash,
      metadata: body.p_metadata || body.metadata || null,
      valid_from: body.p_valid_from || body.valid_from || body.validFrom || nowISO,
      valid_to: body.p_valid_to || body.valid_to || body.validTo || null,
      created_at: nowISO,
      expired_at: body.p_expired_at || body.expired_at || null,
    };

    db.evidence_item.push(newRow);
    res.status(201).json(formatEvidenceItem(newRow));
  } catch (err: any) {
    res.status(400).json({ error: 'add_failed', message: err?.message });
  }
});

app.patch('/api/evidence-item/:id', (req, res) => {
  res.status(400).json({
    error: 'immutable_entity',
    message: 'evidence_item is immutable and cannot be updated. Create a new evidence_item row instead.'
  });
});

app.delete('/api/evidence-item/:id', (req, res) => {
  try {
    const idParam = req.params.id;
    const target = db.evidence_item.find(r => r.expired_at === null && String(r.id) === idParam);
    if (!target) {
      return res.json({ table: 'evidence_item', id: idParam, deleted: 0 });
    }
    const nowISO = new Date().toISOString();
    target.expired_at = nowISO;
    if (!target.valid_to) target.valid_to = nowISO;
    res.json({ table: 'evidence_item', id: String(target.id), deleted: 1, expired: true });
  } catch (err: any) {
    res.status(500).json({ error: 'soft_delete_failed', message: err?.message });
  }
});

// 5. Statement Evidence Endpoints
app.get('/api/statement-evidence', (req, res) => {
  try {
    const includeExpired = req.query.includeExpired === 'true' || req.query.includeExpired === '1';
    let limit = parseInt(req.query.limit as string) || 100;
    let offset = parseInt(req.query.offset as string) || 0;

    let rows = includeExpired ? db.statement_evidence : db.statement_evidence.filter(r => r.expired_at === null);

    const stType = (req.query.statementType || req.query.statement_type) as string;
    if (stType) {
      rows = rows.filter(r => r.statement_type === stType);
    }

    const stId = (req.query.statementId || req.query.statement_id) as string;
    if (stId) {
      rows = rows.filter(r => String(r.statement_id) === stId);
    }

    const evItemId = (req.query.evidenceItemId || req.query.evidence_item_id) as string;
    if (evItemId) {
      rows = rows.filter(r => r.evidence_item_id === evItemId);
    }

    const total = rows.length;
    const paginated = rows.slice(offset, offset + limit);

    res.json({
      items: paginated.map(objectToCamelCase),
      total,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'list_failed', message: err?.message });
  }
});

app.get('/api/statement-evidence/:id', (req, res) => {
  try {
    const match = db.statement_evidence.find(r => r.expired_at === null && String(r.id) === req.params.id);
    if (!match) {
      return res.status(404).json({ error: 'not_found', message: `Statement evidence '${req.params.id}' not found or is expired.` });
    }
    res.json(objectToCamelCase(match));
  } catch (err: any) {
    res.status(500).json({ error: 'get_failed', message: err?.message });
  }
});

app.post('/api/statement-evidence', (req, res) => {
  try {
    const body = req.body || {};
    const evidenceItemId = body.p_evidence_item_id || body.evidence_item_id || body.evidenceItemId;
    const statementType = body.p_statement_type || body.statement_type || body.statementType;
    const statementId = body.p_statement_id || body.statement_id || body.statementId;
    const role = body.p_role || body.role;
    const strength = body.p_strength !== undefined ? body.p_strength : body.strength;
    const comment = body.p_comment !== undefined ? body.p_comment : body.comment;

    if (!evidenceItemId || !statementType || !statementId || !role) {
      return res.status(400).json({ error: 'add_failed', message: 'Required parameters evidence_item_id, statement_type, statement_id, role missing.' });
    }

    if (db.statement_evidence.some(r => r.expired_at === null && r.evidence_item_id === evidenceItemId && r.statement_type === statementType && String(r.statement_id) === String(statementId) && r.role === role)) {
      return res.status(400).json({ error: 'duplicate_statement_evidence', message: 'A statement_evidence link already exists for this evidence_item_id, statement_type, statement_id, and role.' });
    }

    const newRow = {
      id: randomUUID(),
      evidence_item_id: evidenceItemId,
      statement_type: statementType,
      statement_id: String(statementId),
      role,
      strength: strength !== undefined && strength !== null ? parseFloat(strength) : 0.9,
      comment: comment || null,
      created_at: new Date().toISOString(),
      expired_at: null,
    };

    db.statement_evidence.push(newRow);
    res.status(201).json(objectToCamelCase(newRow));
  } catch (err: any) {
    res.status(400).json({ error: 'add_failed', message: err?.message });
  }
});

app.patch('/api/statement-evidence/:id', (req, res) => {
  try {
    const idParam = req.params.id;
    const oldIndex = db.statement_evidence.findIndex(r => r.expired_at === null && String(r.id) === idParam);
    if (oldIndex === -1) {
      return res.status(404).json({ error: 'not_found', message: `Statement evidence link '${idParam}' not found or is expired.` });
    }

    const oldRow = db.statement_evidence[oldIndex];
    const body = req.body || {};
    const role = body.p_role !== undefined ? body.p_role : (body.role !== undefined ? body.role : oldRow.role);
    const strength = body.p_strength !== undefined ? body.p_strength : (body.strength !== undefined ? body.strength : oldRow.strength);
    const comment = body.p_comment !== undefined ? body.p_comment : (body.comment !== undefined ? body.comment : oldRow.comment);

    const newRow = {
      ...oldRow,
      id: randomUUID(),
      role,
      strength: strength !== undefined && strength !== null ? parseFloat(strength) : oldRow.strength,
      comment,
      created_at: new Date().toISOString(),
      expired_at: null,
    };

    oldRow.expired_at = new Date().toISOString();
    db.statement_evidence.push(newRow);

    res.json({
      ...objectToCamelCase(newRow),
      supersededId: oldRow.id,
    });
  } catch (err: any) {
    res.status(400).json({ error: 'update_failed', message: err?.message });
  }
});

app.delete('/api/statement-evidence/:id', (req, res) => {
  try {
    const idParam = req.params.id;
    const target = db.statement_evidence.find(r => r.expired_at === null && String(r.id) === idParam);
    if (!target) {
      return res.json({ table: 'statement_evidence', id: idParam, deleted: 0 });
    }
    target.expired_at = new Date().toISOString();
    res.json({ table: 'statement_evidence', id: String(target.id), deleted: 1, expired: true });
  } catch (err: any) {
    res.status(500).json({ error: 'soft_delete_failed', message: err?.message });
  }
});

// Generic Table LIST (§4.1)
app.get('/api/:table', (req, res, next) => {
  const tableName = req.params.table;
  if (!WRITABLE_PARAMS[tableName]) {
    return next(); // pass to Vite or 404
  }

  try {
    const includeExpired = req.query.includeExpired === 'true' || req.query.includeExpired === '1';
    let limit = parseInt(req.query.limit as string) || 100;
    let offset = parseInt(req.query.offset as string) || 0;

    if (limit > 500) limit = 500;
    if (limit < 1) limit = 100;
    if (offset < 0) offset = 0;

    const rows: any[] = (db as any)[tableName] || [];
    let filtered = includeExpired ? rows : rows.filter(r => r.expired_at === null);

    // Sort by id
    filtered.sort((a, b) => (String(a.id) > String(b.id) ? 1 : -1));

    const paginated = filtered.slice(offset, offset + limit);

    res.json({
      table: tableName,
      count: filtered.length,
      items: paginated
    });
  } catch (err: any) {
    res.status(500).json({ error: 'list_failed', message: err?.message || 'List query failed' });
  }
});

// Generic Table GET ONE (§4.2)
app.get('/api/:table/:id', (req, res, next) => {
  const tableName = req.params.table;
  if (!WRITABLE_PARAMS[tableName]) return next();

  try {
    const idParam = req.params.id;
    const rows: any[] = (db as any)[tableName] || [];

    let match: any = null;
    if (tableName === 'relationship_type') {
      // relationship_type special case: matches uuid PK or natural key name
      match = rows.find(r => r.expired_at === null && (String(r.id) === idParam || r.name === idParam));
    } else {
      match = rows.find(r => r.expired_at === null && String(r.id) === idParam);
    }

    if (!match) {
      return res.status(404).json({
        error: 'not_found',
        message: `Row with id '${idParam}' in table '${tableName}' was not found or is expired.`
      });
    }

    res.json(match);
  } catch (err: any) {
    res.status(500).json({ error: 'get_failed', message: err?.message || 'Get query failed' });
  }
});

// Helper to convert p_* parameters to row object keys
function parseProcParams(tableName: string, body: any) {
  const meta = WRITABLE_PARAMS[tableName];
  const rowData: Record<string, any> = {};

  meta.params.forEach((pParam) => {
    if (body[pParam] !== undefined) {
      const colName = pParam.replace(/^p_/, '');
      let val = body[pParam];

      // Parse JSONB if applicable (e.g. p_raw_metadata)
      if (colName === 'raw_metadata' && typeof val === 'string') {
        try {
          val = JSON.parse(val);
        } catch (e) {
          // keep as string
        }
      }
      // Parse numbers for smallint/integer or confidence
      if ((colName === 'owning_subsystem_id' || colName === 'id' && meta.idType === 'smallint') && val !== null) {
        val = parseInt(val, 10);
      }
      if (colName === 'confidence' && val !== null) {
        val = parseFloat(val);
      }

      rowData[colName] = val;
    }
  });

  return rowData;
}

// Check natural key uniqueness on active rows (§1 & §2.2 duplicate_active_key)
function checkNaturalKeyUniqueness(tableName: string, newRow: any, excludeId?: any): boolean {
  const rows: any[] = (db as any)[tableName] || [];
  const activeRows = rows.filter(r => r.expired_at === null && (excludeId === undefined || String(r.id) !== String(excludeId)));

  if (tableName === 'owning_subsystem') {
    return activeRows.some(r => r.id === newRow.id || r.name === newRow.name);
  }
  if (tableName === 'relationship_type') {
    return activeRows.some(r => r.name === newRow.name);
  }
  if (tableName === 'concept') {
    return activeRows.some(r => r.name?.toLowerCase() === newRow.name?.toLowerCase());
  }
  if (tableName === 'snapshot') {
    return activeRows.some(r => r.version === newRow.version);
  }
  if (tableName === 'evidence_type') {
    return activeRows.some(r => r.name?.toLowerCase() === newRow.name?.toLowerCase());
  }
  if (tableName === 'evidence_item') {
    if (newRow.evidence_type_id && newRow.source_hash) {
      return activeRows.some(r => r.evidence_type_id === newRow.evidence_type_id && r.source_hash === newRow.source_hash);
    }
  }
  if (tableName === 'statement_evidence') {
    return activeRows.some(
      r =>
        r.evidence_item_id === newRow.evidence_item_id &&
        r.statement_type === newRow.statement_type &&
        String(r.statement_id) === String(newRow.statement_id) &&
        r.role === newRow.role
    );
  }
  return false;
}

// Generic Table POST / Add (§4.3)
app.post('/api/:table', (req, res, next) => {
  const tableName = req.params.table;
  if (!WRITABLE_PARAMS[tableName]) return next();

  try {
    const meta = WRITABLE_PARAMS[tableName];
    const body = req.body || {};

    const newRowData = parseProcParams(tableName, body);

    // Validate required fields
    for (const reqCol of meta.required) {
      const pKey = `p_${reqCol}`;
      if (body[pKey] === undefined || body[pKey] === null || body[pKey] === '') {
        return res.status(400).json({
          error: 'add_failed',
          message: `Required parameter '${pKey}' missing for insert into ${tableName}.`
        });
      }
    }

    // Check id auto assignment vs caller supplied
    if (!meta.idAuto) {
      if (body.p_id === undefined) {
        return res.status(400).json({
          error: 'add_failed',
          message: `Table '${tableName}' requires caller-supplied 'p_id'.`
        });
      }
      newRowData.id = meta.idType === 'smallint' ? parseInt(body.p_id, 10) : body.p_id;
    } else {
      newRowData.id = randomUUID();
    }

    // Check duplicate active key
    if (checkNaturalKeyUniqueness(tableName, newRowData)) {
      return res.status(400).json({
        error: 'duplicate_active_key',
        message: `Duplicate active key constraint violation (SQLSTATE 23505) in '${tableName}'.`
      });
    }

    newRowData.created_at = new Date().toISOString();
    newRowData.expired_at = body.p_expired_at || null;

    ((db as any)[tableName] as any[]).push(newRowData);

    res.status(201).json(newRowData);
  } catch (err: any) {
    res.status(400).json({ error: 'add_failed', message: err?.message || 'Insert rejected by DB' });
  }
});

// Generic Table PATCH / Append-Only Update (Supersede) (§4.4)
app.patch('/api/:table/:id', (req, res, next) => {
  const tableName = req.params.table;
  if (!WRITABLE_PARAMS[tableName]) return next();

  try {
    const meta = WRITABLE_PARAMS[tableName];
    const oldId = req.params.id;
    const body = req.body || {};
    const rows: any[] = (db as any)[tableName] || [];

    // Find active row with oldId
    let oldRowIndex = -1;
    if (tableName === 'relationship_type') {
      oldRowIndex = rows.findIndex(r => r.expired_at === null && (String(r.id) === oldId || r.name === oldId));
    } else {
      oldRowIndex = rows.findIndex(r => r.expired_at === null && String(r.id) === oldId);
    }

    if (oldRowIndex === -1) {
      return res.status(404).json({
        error: 'not_found',
        message: `Cannot update. Active row with id '${oldId}' not found in '${tableName}'.`
      });
    }

    const oldRow = rows[oldRowIndex];

    // Table-specific extras check
    if (tableName === 'owning_subsystem' && body.p_new_id === undefined && body.p_id === undefined) {
      return res.status(400).json({
        error: 'update_failed',
        message: `Update on 'owning_subsystem' requires 'p_new_id' (or 'p_id').`
      });
    }

    if (tableName === 'relationship_type' && body.p_new_name === undefined && body.p_name === undefined) {
      return res.status(400).json({
        error: 'update_failed',
        message: `Update on 'relationship_type' requires 'p_new_name' (or 'p_name').`
      });
    }

    // Prepare new row data starting with copy of old row values
    const updatedFields = parseProcParams(tableName, body);

    const newRow: any = {
      ...oldRow,
      ...updatedFields,
    };

    // Assign new ID for supersession
    if (tableName === 'owning_subsystem') {
      newRow.id = parseInt(body.p_new_id || body.p_id, 10);
    } else if (tableName === 'relationship_type') {
      newRow.id = randomUUID();
      newRow.name = body.p_new_name || body.p_name || oldRow.name;
    } else {
      newRow.id = randomUUID(); // New version gets a brand new UUID
    }

    newRow.created_at = new Date().toISOString();
    newRow.expired_at = null;

    // Check duplicate active key for the new row excluding the old row that is about to expire
    if (checkNaturalKeyUniqueness(tableName, newRow, oldRow.id)) {
      return res.status(400).json({
        error: 'duplicate_active_key',
        message: `Duplicate active key constraint violation on update in '${tableName}'.`
      });
    }

    // 1. Expire old row (soft delete)
    oldRow.expired_at = new Date().toISOString();

    // 2. Insert new row version
    rows.push(newRow);

    // Return new row plus superseded_id = old row id
    res.json({
      ...newRow,
      superseded_id: oldRow.id
    });
  } catch (err: any) {
    res.status(400).json({ error: 'update_failed', message: err?.message || 'Update proc raised error' });
  }
});

// Generic Table DELETE / Soft-delete (§4.5)
app.delete('/api/:table/:id', (req, res, next) => {
  const tableName = req.params.table;
  if (!WRITABLE_PARAMS[tableName]) return next();

  try {
    const idParam = req.params.id;
    const rows: any[] = (db as any)[tableName] || [];

    let targetRow: any = null;
    if (tableName === 'relationship_type') {
      // relationship_type soft delete proc takes p_name (not p_id)
      targetRow = rows.find(r => r.expired_at === null && r.name === idParam);
    } else {
      targetRow = rows.find(r => r.expired_at === null && String(r.id) === idParam);
    }

    if (!targetRow) {
      // Idempotent: returns deleted: 0 if missing/already expired
      return res.json({ table: tableName, id: idParam, deleted: 0 });
    }

    targetRow.expired_at = new Date().toISOString();
    res.json({ table: tableName, id: String(targetRow.id), deleted: 1 });
  } catch (err: any) {
    res.status(500).json({ error: 'soft_delete_failed', message: err?.message || 'Soft delete query failed' });
  }
});

// Resolve Drift Finding Endpoint (§5)
app.post('/api/drift_finding/:id/resolve', (req, res) => {
  try {
    const driftId = req.params.id;
    const resolvedAt = req.body?.p_resolved_at || new Date().toISOString();
    const rows: any[] = db.drift_finding;

    const finding = rows.find(r => String(r.id) === driftId && r.expired_at === null);

    if (!finding || finding.resolved_at !== null) {
      // Idempotent: returns resolved: 0 if missing/expired/already resolved
      return res.json({ id: driftId, resolved: 0 });
    }

    finding.resolved_at = resolvedAt;
    res.json({ id: driftId, resolved: 1 });
  } catch (err: any) {
    res.status(500).json({ error: 'resolve_failed', message: err?.message || 'Resolve query failed' });
  }
});

// Setup Vite Development Server or Static Serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[semantics-srv] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
