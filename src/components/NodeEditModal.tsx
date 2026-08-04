import React, { useState, useEffect } from 'react';
import {
  Concept,
  OwningSubsystem,
  RelationshipType,
  Representation,
  Snapshot,
  SnapshotObservation,
  TableName,
} from '../types';
import { useTheme } from '../context/ThemeContext';
import { createTableRow, updateTableRowSupersede } from '../services/api';
import {
  X,
  Sparkles,
  GitCommit,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Clock,
  Layers,
} from 'lucide-react';

interface NodeEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableName: TableName;
  initialRow?: any; // If editing existing row
  writableParams: string[];
  concepts: Concept[];
  representations: Representation[];
  subsystems: OwningSubsystem[];
  relationshipTypes: RelationshipType[];
  snapshots: Snapshot[];
  observations: SnapshotObservation[];
  onSuccess: () => void;
  defaultValues?: Record<string, any>;
}

export const NodeEditModal: React.FC<NodeEditModalProps> = ({
  isOpen,
  onClose,
  tableName,
  initialRow,
  writableParams,
  concepts,
  representations,
  subsystems,
  relationshipTypes,
  snapshots,
  observations,
  onSuccess,
  defaultValues = {},
}) => {
  const { cardBgClass, borderClass, textPrimaryClass, textSecondaryClass } = useTheme();
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [supersededResult, setSupersededResult] = useState<any | null>(null);

  const isEditMode = Boolean(initialRow && initialRow.id !== undefined);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setSupersededResult(null);

      // Initialize form values from initialRow or defaultValues or blank
      const initialForm: Record<string, any> = {};

      writableParams.forEach((paramKey) => {
        const colName = paramKey.replace(/^p_/, '');
        if (initialRow && initialRow[colName] !== undefined) {
          let val = initialRow[colName];
          if (colName === 'raw_metadata' && typeof val === 'object') {
            val = JSON.stringify(val, null, 2);
          }
          initialForm[paramKey] = val;
        } else if (defaultValues[colName] !== undefined) {
          initialForm[paramKey] = defaultValues[colName];
        } else if (defaultValues[paramKey] !== undefined) {
          initialForm[paramKey] = defaultValues[paramKey];
        } else {
          initialForm[paramKey] = '';
        }
      });

      // Special update extra params
      if (tableName === 'owning_subsystem' && isEditMode) {
        initialForm['p_new_id'] = initialRow.id;
      }
      if (tableName === 'relationship_type' && isEditMode) {
        initialForm['p_new_name'] = initialRow.name;
      }

      setFormData(initialForm);
    }
  }, [isOpen, initialRow, tableName, writableParams, defaultValues]);

  if (!isOpen) return null;

  const handleInputChange = (key: string, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      if (isEditMode) {
        // Append-only PATCH / update
        const res = await updateTableRowSupersede(tableName, initialRow.id, formData);
        setSupersededResult(res);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1200);
      } else {
        // POST / Add new row
        await createTableRow(tableName, formData);
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Operation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper renderer for table-specific foreign key inputs
  const renderFieldInput = (paramKey: string) => {
    const colName = paramKey.replace(/^p_/, '');
    const val = formData[paramKey] ?? '';

    // FK: concept_id or from_concept_id or to_concept_id
    if (colName === 'concept_id' || colName === 'from_concept_id' || colName === 'to_concept_id') {
      return (
        <select
          value={val}
          onChange={(e) => handleInputChange(paramKey, e.target.value)}
          className={`w-full px-3 py-2 text-xs rounded-lg border ${borderClass} bg-black/5 dark:bg-white/5 ${textPrimaryClass} focus:outline-hidden focus:ring-2 focus:ring-sky-500`}
        >
          <option value="">Select Concept...</option>
          {concepts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.id.slice(0, 8)}...)
            </option>
          ))}
        </select>
      );
    }

    // FK: representation_id or from_representation_id or to_representation_id
    if (colName === 'representation_id' || colName === 'from_representation_id' || colName === 'to_representation_id') {
      return (
        <select
          value={val}
          onChange={(e) => handleInputChange(paramKey, e.target.value)}
          className={`w-full px-3 py-2 text-xs rounded-lg border ${borderClass} bg-black/5 dark:bg-white/5 ${textPrimaryClass} focus:outline-hidden focus:ring-2 focus:ring-sky-500`}
        >
          <option value="">Select Representation...</option>
          {representations.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label} ({r.schema_name}.{r.table_name})
            </option>
          ))}
        </select>
      );
    }

    // FK: owning_subsystem_id
    if (colName === 'owning_subsystem_id') {
      return (
        <select
          value={val}
          onChange={(e) => handleInputChange(paramKey, e.target.value)}
          className={`w-full px-3 py-2 text-xs rounded-lg border ${borderClass} bg-black/5 dark:bg-white/5 ${textPrimaryClass} focus:outline-hidden focus:ring-2 focus:ring-sky-500`}
        >
          <option value="">Select Subsystem...</option>
          {subsystems.map((s) => (
            <option key={s.id} value={s.id}>
              #{s.id} - {s.name}
            </option>
          ))}
        </select>
      );
    }

    // FK: relationship_type
    if (colName === 'relationship_type') {
      return (
        <select
          value={val}
          onChange={(e) => handleInputChange(paramKey, e.target.value)}
          className={`w-full px-3 py-2 text-xs rounded-lg border ${borderClass} bg-black/5 dark:bg-white/5 ${textPrimaryClass} focus:outline-hidden focus:ring-2 focus:ring-sky-500 font-mono`}
        >
          <option value="">Select Vocabulary Type...</option>
          {relationshipTypes.map((rt) => (
            <option key={rt.name} value={rt.name}>
              {rt.name}
            </option>
          ))}
        </select>
      );
    }

    // Path selection: green / red
    if (colName === 'path') {
      return (
        <select
          value={val}
          onChange={(e) => handleInputChange(paramKey, e.target.value)}
          className={`w-full px-3 py-2 text-xs rounded-lg border ${borderClass} bg-black/5 dark:bg-white/5 ${textPrimaryClass} focus:outline-hidden focus:ring-2 focus:ring-sky-500`}
        >
          <option value="">None / Default</option>
          <option value="green">Green Path (Validated / Active)</option>
          <option value="red">Red Path (Drift / Flagged)</option>
        </select>
      );
    }

    // Confidence: number slider / input
    if (colName === 'confidence') {
      return (
        <div className="flex items-center gap-3">
          <input
            type="number"
            min="0"
            max="1"
            step="0.01"
            value={val}
            onChange={(e) => handleInputChange(paramKey, e.target.value)}
            className={`w-28 px-3 py-2 text-xs rounded-lg border ${borderClass} bg-black/5 dark:bg-white/5 ${textPrimaryClass} font-mono`}
            placeholder="0.95"
          />
          <span className="text-xs text-sky-400 font-mono">
            {val !== '' && !isNaN(parseFloat(val)) ? `${Math.round(parseFloat(val) * 100)}% Confidence` : ''}
          </span>
        </div>
      );
    }

    // JSONB metadata
    if (colName === 'raw_metadata') {
      return (
        <textarea
          rows={3}
          value={val}
          onChange={(e) => handleInputChange(paramKey, e.target.value)}
          placeholder='{"key": "value", "partitionKey": "tenant_id"}'
          className={`w-full px-3 py-2 text-xs font-mono rounded-lg border ${borderClass} bg-black/5 dark:bg-white/5 ${textPrimaryClass} focus:outline-hidden focus:ring-2 focus:ring-sky-500`}
        />
      );
    }

    // Severity level
    if (colName === 'severity') {
      return (
        <select
          value={val}
          onChange={(e) => handleInputChange(paramKey, e.target.value)}
          className={`w-full px-3 py-2 text-xs rounded-lg border ${borderClass} bg-black/5 dark:bg-white/5 ${textPrimaryClass}`}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
      );
    }

    // Textarea for descriptions or notes
    if (colName === 'description' || colName === 'notes' || colName === 'evidence_notes') {
      return (
        <textarea
          rows={2}
          value={val}
          onChange={(e) => handleInputChange(paramKey, e.target.value)}
          className={`w-full px-3 py-2 text-xs rounded-lg border ${borderClass} bg-black/5 dark:bg-white/5 ${textPrimaryClass} focus:outline-hidden focus:ring-2 focus:ring-sky-500`}
        />
      );
    }

    // Standard text / number input
    return (
      <input
        type="text"
        value={val}
        onChange={(e) => handleInputChange(paramKey, e.target.value)}
        className={`w-full px-3 py-2 text-xs rounded-lg border ${borderClass} bg-black/5 dark:bg-white/5 ${textPrimaryClass} focus:outline-hidden focus:ring-2 focus:ring-sky-500`}
      />
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className={`w-full max-w-lg p-6 border ${borderClass} ${cardBgClass} rounded-2xl shadow-2xl space-y-4 my-8`}>
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-zinc-700/50 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-sky-500/20 text-sky-400">
              {isEditMode ? <GitCommit className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
            </div>
            <div>
              <h3 className={`text-base font-semibold ${textPrimaryClass}`}>
                {isEditMode ? `Supersede ${tableName} Record` : `Add New ${tableName} Record`}
              </h3>
              <p className={`text-xs ${textSecondaryClass}`}>
                {isEditMode ? 'Creates new row version & expires active row' : 'Appends new record to database'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className={`p-1 rounded-md ${textSecondaryClass} hover:${textPrimaryClass}`}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Append-Only Design Invariant Banner */}
        {isEditMode && (
          <div className="p-3 rounded-xl border border-sky-500/30 bg-sky-500/10 text-sky-300 text-xs flex items-start gap-2.5">
            <HelpCircle className="w-4 h-4 shrink-0 text-sky-400 mt-0.5" />
            <div>
              <span className="font-semibold block">Design Invariant: Append-Only History</span>
              Updating row <code className="text-white font-mono">{initialRow.id}</code> will not mutate it in place.
              The system expires the old row (<code className="text-white font-mono">expired_at = now()</code>) and inserts
              a new version with a brand new UUID.
            </div>
          </div>
        )}

        {/* Error Alert Banner */}
        {errorMsg && (
          <div className="p-3 rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Success Superseded Feedback */}
        {supersededResult && (
          <div className="p-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <div>
              <span className="font-bold">Supersession Complete!</span>
              <div>
                Superseded Old ID: <code className="font-mono text-white">{supersededResult.superseded_id}</code> → New ID:{' '}
                <code className="font-mono text-white">{supersededResult.id}</code>
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Parameter Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {tableName === 'owning_subsystem' && isEditMode && (
            <div className="space-y-1">
              <label className="text-[11px] font-mono text-sky-400 font-semibold">p_new_id (Required for subsystem)</label>
              <input
                type="number"
                value={formData['p_new_id'] ?? ''}
                onChange={(e) => handleInputChange('p_new_id', e.target.value)}
                className={`w-full px-3 py-2 text-xs rounded-lg border ${borderClass} bg-black/5 dark:bg-white/5 ${textPrimaryClass}`}
              />
            </div>
          )}

          {tableName === 'relationship_type' && isEditMode && (
            <div className="space-y-1">
              <label className="text-[11px] font-mono text-sky-400 font-semibold">p_new_name (Required for relationship vocabulary)</label>
              <input
                type="text"
                value={formData['p_new_name'] ?? ''}
                onChange={(e) => handleInputChange('p_new_name', e.target.value)}
                className={`w-full px-3 py-2 text-xs rounded-lg border ${borderClass} bg-black/5 dark:bg-white/5 ${textPrimaryClass}`}
              />
            </div>
          )}

          {writableParams
            .filter((p) => p !== 'p_expired_at') // p_expired_at is handled automatically by soft-delete
            .map((pParam) => {
              const colName = pParam.replace(/^p_/, '');
              return (
                <div key={pParam} className="space-y-1">
                  <label className={`text-[11px] font-mono capitalize ${textSecondaryClass}`}>
                    {pParam} <span className="text-zinc-500">({colName})</span>
                  </label>
                  {renderFieldInput(pParam)}
                </div>
              );
            })}

          <div className="pt-4 flex items-center justify-end gap-2 border-t border-zinc-700/50">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 text-xs font-medium rounded-lg border ${borderClass} ${textSecondaryClass} hover:${textPrimaryClass}`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-sky-600 hover:bg-sky-500 text-white shadow-xs transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : isEditMode ? 'Supersede & Create Version' : 'Insert Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
