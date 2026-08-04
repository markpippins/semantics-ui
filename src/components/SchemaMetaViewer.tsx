import React from 'react';
import { MetaResponse } from '../types';
import { useTheme } from '../context/ThemeContext';
import { Code2, Database, ShieldCheck, Terminal, FileCode2, Layers, Cpu } from 'lucide-react';

interface SchemaMetaViewerProps {
  metaData: MetaResponse | null;
  isLoading: boolean;
}

export const SchemaMetaViewer: React.FC<SchemaMetaViewerProps> = ({ metaData, isLoading }) => {
  const { cardBgClass, borderClass, textPrimaryClass, textSecondaryClass } = useTheme();

  if (isLoading || !metaData) {
    return (
      <div className="w-full h-full flex items-center justify-center p-8 text-sky-400 font-mono text-xs">
        <div className="animate-spin mr-2">⚡</div>
        <span>Querying /api/meta schema overview...</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full p-4 space-y-4 overflow-y-auto">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`p-4 border ${borderClass} ${cardBgClass} rounded-2xl flex items-center gap-3 shadow-xs`}>
          <div className="p-3 rounded-xl bg-sky-500/20 text-sky-400">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-mono uppercase text-zinc-400">Database Schema</div>
            <div className="text-base font-bold text-sky-400 font-mono">{metaData.schema}</div>
            <div className="text-[10px] text-zinc-500">{metaData.service}</div>
          </div>
        </div>

        <div className={`p-4 border ${borderClass} ${cardBgClass} rounded-2xl flex items-center gap-3 shadow-xs`}>
          <div className="p-3 rounded-xl bg-indigo-500/20 text-indigo-400">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-mono uppercase text-zinc-400">Tables Registered</div>
            <div className="text-base font-bold text-indigo-400 font-mono">{metaData.tables.length} Tables</div>
            <div className="text-[10px] text-zinc-500">All 12 Core Entities</div>
          </div>
        </div>

        <div className={`p-4 border ${borderClass} ${cardBgClass} rounded-2xl flex items-center gap-3 shadow-xs`}>
          <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-400">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-mono uppercase text-zinc-400">Stored Procedures</div>
            <div className="text-base font-bold text-emerald-400 font-mono">{metaData.procs} Procs</div>
            <div className="text-[10px] text-zinc-500">Write Layer Controls</div>
          </div>
        </div>

        <div className={`p-4 border ${borderClass} ${cardBgClass} rounded-2xl flex items-center gap-3 shadow-xs`}>
          <div className="p-3 rounded-xl bg-amber-500/20 text-amber-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-mono uppercase text-zinc-400">Active / Total Rows</div>
            <div className="text-base font-bold text-amber-400 font-mono">
              {metaData.tables.reduce((acc, t) => acc + t.active, 0)} /{' '}
              {metaData.tables.reduce((acc, t) => acc + t.total, 0)}
            </div>
            <div className="text-[10px] text-zinc-500">Append-Only Supersessions</div>
          </div>
        </div>
      </div>

      {/* Writable Parameters & Table List Grid */}
      <div className={`p-5 border ${borderClass} ${cardBgClass} rounded-2xl space-y-4 shadow-xs`}>
        <div className="flex items-center justify-between border-b border-zinc-700/50 pb-3">
          <div className="flex items-center gap-2">
            <FileCode2 className="w-5 h-5 text-sky-400" />
            <h3 className={`text-base font-bold ${textPrimaryClass}`}>
              Table Registry & Writable <code className="text-sky-400">p_*</code> Parameters
            </h3>
          </div>
          <span className="text-xs font-mono text-zinc-400">GET /api/meta Response</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {metaData.tables.map((t) => {
            const params = metaData.writableParams[t.table] || [];
            return (
              <div
                key={t.table}
                className="p-3.5 rounded-xl border border-zinc-700/60 bg-black/5 dark:bg-white/5 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-sky-300">{t.table}</span>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-xs">
                    {t.active} Active
                  </span>
                </div>

                <div className="text-[11px] text-zinc-400 font-medium">{t.label}</div>

                <div className="pt-2 border-t border-zinc-700/40 text-[10px] font-mono space-y-1">
                  <div className="text-zinc-500 uppercase tracking-wider font-semibold">Writable Proc Params:</div>
                  <div className="flex flex-wrap gap-1">
                    {params.map((p) => (
                      <span
                        key={p}
                        className="px-1.5 py-0.5 rounded-xs bg-sky-500/10 text-sky-300 border border-sky-500/20"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Raw JSON Meta Inspector */}
      <div className={`p-5 border ${borderClass} ${cardBgClass} rounded-2xl space-y-2 shadow-xs font-mono`}>
        <div className="text-xs text-zinc-400 flex items-center justify-between">
          <span>Raw JSON Envelope (/api/meta)</span>
          <span className="text-emerald-400">200 OK</span>
        </div>
        <pre className="p-4 rounded-xl bg-slate-950 text-sky-300 text-xs overflow-x-auto border border-zinc-800">
          {JSON.stringify(metaData, null, 2)}
        </pre>
      </div>
    </div>
  );
};
