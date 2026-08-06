import React, { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { Terminal, Send, Clock, Play, Code2, AlertCircle, CheckCircle2 } from 'lucide-react';

export const ApiSandbox: React.FC = () => {
  const { cardBgClass, borderClass, textPrimaryClass, textSecondaryClass } = useTheme();
  const [method, setMethod] = useState<'GET' | 'POST' | 'PATCH' | 'DELETE'>('GET');
  const [path, setPath] = useState('/api/meta');
  const [requestBody, setRequestBody] = useState('');
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [responseTime, setResponseTime] = useState<number | null>(null);
  const [responseJson, setResponseJson] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleExecuteRequest = async () => {
    setIsLoading(true);
    setResponseStatus(null);
    setResponseJson(null);
    const startTime = performance.now();

    try {
      const options: RequestInit = {
        method,
        headers: { 'Content-Type': 'application/json' },
      };

      if ((method === 'POST' || method === 'PATCH') && requestBody.trim()) {
        options.body = requestBody;
      }

      const res = await fetch(path, options);
      const endTime = performance.now();
      setResponseTime(Math.round(endTime - startTime));
      setResponseStatus(res.status);

      const json = await res.json().catch(() => ({ raw: 'Failed to parse JSON' }));
      setResponseJson(json);
    } catch (err: any) {
      setResponseStatus(500);
      setResponseJson({ error: 'client_error', message: err?.message || 'Network request failed' });
    } finally {
      setIsLoading(false);
    }
  };

  const presets = [
    { label: 'GET /api/meta', method: 'GET', path: '/api/meta', body: '' },
    { label: 'GET /api/evidence-type', method: 'GET', path: '/api/evidence-type', body: '' },
    { label: 'GET /api/evidence-item', method: 'GET', path: '/api/evidence-item?origin=harvested', body: '' },
    { label: 'GET /api/statement-evidence', method: 'GET', path: '/api/statement-evidence', body: '' },
    { label: 'GET Concept Evidence', method: 'GET', path: '/api/concept-relationship/crel_1/evidence', body: '' },
    {
      label: 'POST /api/evidence-type',
      method: 'POST',
      path: '/api/evidence-type',
      body: JSON.stringify({ p_name: 'git_commit', p_description: 'Git commit hash reference', p_origin_category: 'vcs' }, null, 2),
    },
    {
      label: 'PATCH Evidence Item (Immutable 400 Test)',
      method: 'PATCH',
      path: '/api/evidence-item/eitem_1',
      body: JSON.stringify({ p_note: 'Attempting edit' }, null, 2),
    },
  ];

  return (
    <div className="w-full h-full p-4 space-y-4 overflow-y-auto">
      {/* Top Banner */}
      <div className={`p-4 border ${borderClass} ${cardBgClass} rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-sm`}>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-sky-500/20 text-sky-400">
            <Terminal className="w-6 h-6" />
          </div>
          <div>
            <h2 className={`text-lg font-bold tracking-tight ${textPrimaryClass}`}>
              Live REST API Sandbox & Debugger
            </h2>
            <p className={`text-xs ${textSecondaryClass}`}>
              Execute live REST requests against the Express backend and inspect envelope shapes.
            </p>
          </div>
        </div>

        {/* Quick Presets */}
        <div className="flex flex-wrap items-center gap-1.5">
          {presets.map((p, idx) => (
            <button
              key={idx}
              onClick={() => {
                setMethod(p.method as any);
                setPath(p.path);
                setRequestBody(p.body);
              }}
              className="px-2.5 py-1 text-xs font-mono rounded-lg border border-zinc-700/60 bg-black/5 dark:bg-white/5 hover:border-sky-500 hover:text-sky-300 transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Request Form & Response Viewer Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Request Builder Form */}
        <div className={`p-5 border ${borderClass} ${cardBgClass} rounded-2xl space-y-4 shadow-sm flex flex-col`}>
          <div className="text-xs font-bold text-zinc-300 flex items-center justify-between border-b border-zinc-700/50 pb-2">
            <span>HTTP Request Builder</span>
            <Code2 className="w-4 h-4 text-sky-400" />
          </div>

          <div className="space-y-3 flex-1">
            <div className="flex items-center gap-2">
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as any)}
                className="px-3 py-2 text-xs font-mono font-bold rounded-lg border border-zinc-700/60 bg-sky-500/10 text-sky-400 focus:outline-hidden"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PATCH">PATCH</option>
                <option value="DELETE">DELETE</option>
              </select>

              <input
                type="text"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="/api/concept"
                className={`flex-1 px-3 py-2 text-xs font-mono rounded-lg border ${borderClass} bg-black/5 dark:bg-white/5 ${textPrimaryClass} focus:outline-hidden`}
              />

              <button
                onClick={handleExecuteRequest}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-sky-600 hover:bg-sky-500 text-white shadow-xs transition-colors disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Execute</span>
              </button>
            </div>

            {(method === 'POST' || method === 'PATCH') && (
              <div className="space-y-1">
                <label className="text-[11px] font-mono text-zinc-400">Request Body (JSON)</label>
                <textarea
                  rows={8}
                  value={requestBody}
                  onChange={(e) => setRequestBody(e.target.value)}
                  placeholder='{"p_name": "Example"}'
                  className={`w-full p-3 text-xs font-mono rounded-lg border ${borderClass} bg-slate-950 text-sky-300 focus:outline-hidden`}
                />
              </div>
            )}
          </div>
        </div>

        {/* Response Envelope Inspector */}
        <div className={`p-5 border ${borderClass} ${cardBgClass} rounded-2xl space-y-3 shadow-sm flex flex-col font-mono`}>
          <div className="text-xs font-bold text-zinc-300 flex items-center justify-between border-b border-zinc-700/50 pb-2">
            <span>Response Envelope</span>
            {responseStatus && (
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className={responseStatus < 300 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  HTTP {responseStatus}
                </span>
                {responseTime !== null && (
                  <span className="text-zinc-500 flex items-center gap-1 text-[11px]">
                    <Clock className="w-3 h-3" /> {responseTime}ms
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex-1 min-h-[220px]">
            {isLoading ? (
              <div className="h-full flex items-center justify-center text-xs text-sky-400">
                <div className="animate-spin mr-2">⚡</div>
                <span>Executing request...</span>
              </div>
            ) : responseJson ? (
              <pre className="p-4 rounded-xl bg-slate-950 text-emerald-400 text-xs overflow-auto h-full max-h-[360px] border border-zinc-800">
                {JSON.stringify(responseJson, null, 2)}
              </pre>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-zinc-500 text-xs">
                <Terminal className="w-8 h-8 mb-2 opacity-30 text-sky-400" />
                <span>Execute an API request to view response envelopes</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
