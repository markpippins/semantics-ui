import React, { useState } from 'react';
import { DriftFinding, Snapshot, SnapshotObservation } from '../types';
import { useTheme } from '../context/ThemeContext';
import { resolveDriftFinding } from '../services/api';
import {
  Layers,
  GitCommit,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
  ShieldAlert,
  ArrowRight,
  Plus,
  Lock,
} from 'lucide-react';

interface SnapshotsAndDriftProps {
  snapshots: Snapshot[];
  observations: SnapshotObservation[];
  driftFindings: DriftFinding[];
  onRefreshData: () => void;
  onOpenCreateSnapshot: () => void;
}

export const SnapshotsAndDrift: React.FC<SnapshotsAndDriftProps> = ({
  snapshots,
  observations,
  driftFindings,
  onRefreshData,
  onOpenCreateSnapshot,
}) => {
  const { cardBgClass, borderClass, textPrimaryClass, textSecondaryClass } = useTheme();
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolveSuccessMsg, setResolveSuccessMsg] = useState<string | null>(null);

  const handleResolveDrift = async (id: string) => {
    setResolvingId(id);
    setResolveSuccessMsg(null);
    try {
      const res = await resolveDriftFinding(id);
      if (res.resolved) {
        setResolveSuccessMsg(`Drift finding ${id.slice(0, 8)} successfully resolved!`);
        onRefreshData();
      }
    } catch (err: any) {
      alert(`Failed to resolve drift: ${err.message}`);
    } finally {
      setResolvingId(null);
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      case 'high':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'medium':
        return 'bg-sky-500/20 text-sky-300 border-sky-500/30';
      default:
        return 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30';
    }
  };

  return (
    <div className="w-full h-full flex flex-col p-4 space-y-4 overflow-y-auto">
      {/* Banner */}
      <div className={`p-4 border ${borderClass} ${cardBgClass} rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-sm`}>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h2 className={`text-lg font-bold tracking-tight ${textPrimaryClass}`}>
              Snapshots & Drift Findings Lifecycle
            </h2>
            <p className={`text-xs ${textSecondaryClass}`}>
              Published snapshots are immutable records chained via <code className="text-sky-400">parent_id</code>. Drift findings track system anomalies.
            </p>
          </div>
        </div>

        <button
          onClick={onOpenCreateSnapshot}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-sky-600 hover:bg-sky-500 text-white transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>New Snapshot Version</span>
        </button>
      </div>

      {/* Grid: Left - Snapshots Version Chain; Right - Drift Findings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1">
        {/* Snapshots Version Chain */}
        <div className={`p-4 border ${borderClass} ${cardBgClass} rounded-2xl space-y-4 shadow-sm flex flex-col`}>
          <div className="flex items-center justify-between border-b border-zinc-700/50 pb-2">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-sky-400" />
              <h3 className={`text-sm font-semibold ${textPrimaryClass}`}>
                Snapshot Version Lineage ({snapshots.length})
              </h3>
            </div>
            <span className="text-[10px] font-mono uppercase bg-sky-500/10 text-sky-400 px-2 py-0.5 rounded-md border border-sky-500/20">
              Immutable Baselines
            </span>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto pr-1">
            {snapshots.map((snap) => (
              <div
                key={snap.id}
                className="p-3.5 rounded-xl border border-zinc-700/60 bg-black/5 dark:bg-white/5 space-y-2 relative"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-md border border-sky-500/20">
                      v{snap.version}
                    </span>
                    <span className={`text-xs font-semibold ${textPrimaryClass}`}>{snap.label}</span>
                  </div>
                  <span
                    className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                      snap.status === 'published'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {snap.status}
                  </span>
                </div>

                <p className="text-xs text-zinc-400">{snap.notes}</p>

                <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 pt-1 border-t border-zinc-700/40">
                  <span>Author: {snap.created_by}</span>
                  {snap.parent_id && (
                    <span className="text-sky-300 flex items-center gap-1">
                      <GitCommit className="w-3 h-3" /> Parent: {snap.parent_id.slice(0, 8)}...
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Drift Findings Lifecycle */}
        <div className={`p-4 border ${borderClass} ${cardBgClass} rounded-2xl space-y-4 shadow-sm flex flex-col`}>
          <div className="flex items-center justify-between border-b border-zinc-700/50 pb-2">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <h3 className={`text-sm font-semibold ${textPrimaryClass}`}>
                Drift Findings Auditor ({driftFindings.length})
              </h3>
            </div>
            <span className="text-[10px] font-mono bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-md border border-amber-500/20">
              {driftFindings.filter((d) => d.resolved_at === null).length} Unresolved
            </span>
          </div>

          {resolveSuccessMsg && (
            <div className="p-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{resolveSuccessMsg}</span>
            </div>
          )}

          <div className="space-y-3 flex-1 overflow-y-auto pr-1">
            {driftFindings.map((drift) => {
              const isResolved = drift.resolved_at !== null;
              return (
                <div
                  key={drift.id}
                  className={`p-3.5 rounded-xl border space-y-2 transition-all ${
                    isResolved
                      ? 'border-emerald-500/30 bg-emerald-500/5 text-zinc-400'
                      : 'border-amber-500/40 bg-amber-500/5 text-zinc-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold uppercase font-mono px-2 py-0.5 rounded-md border ${getSeverityBadge(
                          drift.severity
                        )}`}
                      >
                        {drift.severity}
                      </span>
                      <span className="font-mono text-xs text-sky-400">{drift.id.slice(0, 8)}...</span>
                    </div>

                    {isResolved ? (
                      <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Resolved
                      </span>
                    ) : (
                      <button
                        onClick={() => handleResolveDrift(drift.id)}
                        disabled={resolvingId === drift.id}
                        className="px-2.5 py-1 text-xs font-medium rounded-lg bg-amber-600 hover:bg-amber-500 text-white transition-colors shadow-xs disabled:opacity-50"
                      >
                        {resolvingId === drift.id ? 'Resolving...' : 'Resolve Drift'}
                      </button>
                    )}
                  </div>

                  <p className="text-xs text-zinc-200">{drift.description}</p>

                  <div className="text-[10px] font-mono text-zinc-500 flex items-center justify-between pt-1 border-t border-zinc-700/40">
                    <span>Observation ID: {drift.observation_id}</span>
                    {drift.resolved_at && (
                      <span className="text-emerald-400">Resolved at: {drift.resolved_at.slice(0, 19)}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
