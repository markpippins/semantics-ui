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
    { id: 'cr-301', from_concept_id: 'c-101', to_concept_id: 'c-102', relationship_type: 'produces', path: 'green', notes: 'User accounts originate payment transactions', evidence_source: 'Payment Spec v3.1', evidence_type: 'architecture_doc', confidence: 0.98, evidence_notes: 'Verified in API contract docs', expired_at: null },
    { id: 'cr-302', from_concept_id: 'c-102', to_concept_id: 'c-105', relationship_type: 'transforms_into', path: 'green', notes: 'Settled payments transform into double-entry ledger items', evidence_source: 'Accounting Schema', evidence_type: 'code_analysis', confidence: 0.95, evidence_notes: 'Confirmed via ledger-worker codebase', expired_at: null },
    { id: 'cr-303', from_concept_id: 'c-103', to_concept_id: 'c-101', relationship_type: 'governs', path: 'green', notes: 'Authorization policies restrict user account actions', evidence_source: 'IAM Policy Matrix', evidence_type: 'expert_judgment', confidence: 0.99, evidence_notes: 'Reviewed by Security Chief', expired_at: null },
    { id: 'cr-304', from_concept_id: 'c-101', to_concept_id: 'c-106', relationship_type: 'spawns', path: 'green', notes: 'Successful authentication spawns identity tokens', evidence_source: 'OAuth2 Specs', evidence_type: 'standard_reference', confidence: 0.92, evidence_notes: 'RFC 6749 compliance', expired_at: null },
    { id: 'cr-305', from_concept_id: 'c-102', to_concept_id: 'c-107', relationship_type: 'evidences', path: 'red', notes: 'Unflagged transaction patterns evidence potential risk scores', evidence_source: 'Risk Engine Logs', evidence_type: 'runtime_drift', confidence: 0.84, evidence_notes: 'Discovered during audit drift analysis', expired_at: null },
    { id: 'cr-306', from_concept_id: 'c-106', to_concept_id: 'c-110', relationship_type: 'implements', path: 'green', notes: 'Identity token implements stateful user session', evidence_source: 'Session Middleware', evidence_type: 'code_analysis', confidence: 0.91, evidence_notes: 'Validated by dev team', expired_at: null },
    { id: 'cr-307', from_concept_id: 'c-110', to_concept_id: 'c-108', relationship_type: 'emits', path: 'green', notes: 'Customer sessions emit audit log events', evidence_source: 'Telemetry Pipeline', evidence_type: 'event_schema', confidence: 0.97, evidence_notes: 'Built into base middleware', expired_at: null },
    { id: 'cr-308', from_concept_id: 'c-104', to_concept_id: 'c-102', relationship_type: 'derives_from', path: 'green', notes: 'Order receipt derives item breakdown from transaction', evidence_source: 'Checkout API', evidence_type: 'architecture_doc', confidence: 0.96, evidence_notes: 'Match verified', expired_at: null },
    { id: 'cr-309', from_concept_id: 'c-107', to_concept_id: 'c-103', relationship_type: 'constrains', path: 'red', notes: 'High risk scores dynamically constrain authorization policies', evidence_source: 'Adaptive Security Rules', evidence_type: 'experimental', confidence: 0.78, evidence_notes: 'Flagged for further validation', expired_at: null },
  ];

  const representation_relationship = [
    { id: 'rr-401', from_representation_id: 'r-201', to_representation_id: 'r-203', relationship_type: 'writes', notes: 'Auth users trigger write events into pay_db.transactions', evidence_source: 'Transaction Controller', evidence_type: 'code_analysis', confidence: 0.95, evidence_notes: 'Direct SQL call chain', expired_at: null },
    { id: 'rr-402', from_representation_id: 'r-203', to_representation_id: 'r-204', relationship_type: 'validates', notes: 'Payment transaction validates corresponding order row', evidence_source: 'Order Webhook', evidence_type: 'event_schema', confidence: 0.98, evidence_notes: 'Webhook response validation', expired_at: null },
    { id: 'rr-403', from_representation_id: 'r-205', to_representation_id: 'r-201', relationship_type: 'equivalent', notes: 'User profile document maps 1:1 to auth_db users row', evidence_source: 'Sync Service', evidence_type: 'architecture_doc', confidence: 0.99, evidence_notes: 'CDC sync pipeline', expired_at: null },
    { id: 'rr-404', from_representation_id: 'r-203', to_representation_id: 'r-208', relationship_type: 'calls', notes: 'Payment gateway calls fraud risk evaluation score table', evidence_source: 'Risk Client SDK', evidence_type: 'code_analysis', confidence: 0.88, evidence_notes: 'gRPC client call', expired_at: null },
    { id: 'rr-405', from_representation_id: 'r-202', to_representation_id: 'r-207', relationship_type: 'emits', notes: 'Token invalidations emit compliance records', evidence_source: 'Auth Auditor', evidence_type: 'code_analysis', confidence: 0.94, evidence_notes: 'Security audit hook', expired_at: null },
    { id: 'rr-406', from_representation_id: 'r-206', to_representation_id: 'r-207', relationship_type: 'projects', notes: 'Kafka telemetry projects compliance summaries to audit DB', evidence_source: 'Flink Processor', evidence_type: 'event_schema', confidence: 0.82, evidence_notes: 'Stream projection pipeline', expired_at: null },
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
    params: ['p_from_representation_id', 'p_to_representation_id', 'p_relationship_type', 'p_notes', 'p_evidence_source', 'p_evidence_type', 'p_confidence', 'p_evidence_notes', 'p_expired_at']
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
    params: ['p_from_concept_id', 'p_to_concept_id', 'p_relationship_type', 'p_path', 'p_notes', 'p_evidence_source', 'p_evidence_type', 'p_confidence', 'p_evidence_notes', 'p_expired_at']
  },
  relationship_type: {
    idType: 'uuid', idAuto: true, required: ['name', 'description'],
    params: ['p_name', 'p_description', 'p_scope', 'p_notes', 'p_expired_at']
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
