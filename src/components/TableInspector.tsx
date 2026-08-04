import React, { useState } from 'react';
import { TableMetaItem, TableName } from '../types';
import { useTheme } from '../context/ThemeContext';
import {
  Table as TableIcon,
  Search,
  Plus,
  Edit3,
  Trash2,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  Filter,
  Eye,
  Clock,
  Sparkles,
} from 'lucide-react';

interface TableInspectorProps {
  selectedTable: TableName;
  onSelectTable: (tbl: TableName) => void;
  tablesMeta: TableMetaItem[];
  items: any[];
  totalCount: number;
  isLoading: boolean;
  includeExpired: boolean;
  onToggleIncludeExpired: (val: boolean) => void;
  onOpenCreateModal: () => void;
  onOpenEditModal: (row: any) => void;
  onSoftDeleteRow: (id: string | number) => void;
  onRefresh: () => void;
}

export const TableInspector: React.FC<TableInspectorProps> = ({
  selectedTable,
  onSelectTable,
  tablesMeta,
  items,
  totalCount,
  isLoading,
  includeExpired,
  onToggleIncludeExpired,
  onOpenCreateModal,
  onOpenEditModal,
  onSoftDeleteRow,
  onRefresh,
}) => {
  const { cardBgClass, borderClass, textPrimaryClass, textSecondaryClass } = useTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filter items by local search term
  const filteredItems = items.filter((row) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return Object.values(row).some((v) => String(v).toLowerCase().includes(q));
  });

  const handleCopyId = (id: string | number) => {
    navigator.clipboard.writeText(String(id));
    setCopiedId(String(id));
    setTimeout(() => setCopiedId(null), 1500);
  };

  // Determine headers based on keys of the first row
  const headers = items.length > 0 ? Object.keys(items[0]) : [];

  return (
    <div className="w-full h-full flex flex-col p-4 space-y-4 overflow-hidden">
      {/* Top Header & Table Controls Bar */}
      <div className={`p-4 border ${borderClass} ${cardBgClass} rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-sm`}>
        {/* Table Selector Dropdown */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-sky-500/20 text-sky-400">
            <TableIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <select
                value={selectedTable}
                onChange={(e) => onSelectTable(e.target.value as TableName)}
                className={`text-base font-bold font-mono border-b border-dashed ${borderClass} bg-transparent ${textPrimaryClass} focus:outline-hidden cursor-pointer`}
              >
                {tablesMeta.map((t) => (
                  <option key={t.table} value={t.table} className="bg-zinc-900 text-white">
                    {t.table} ({t.label})
                  </option>
                ))}
              </select>
            </div>
            <p className={`text-xs ${textSecondaryClass} mt-0.5`}>
              Total Records: <span className="font-mono font-semibold text-sky-400">{totalCount}</span> | Active:{' '}
              <span className="font-mono font-semibold text-emerald-400">
                {tablesMeta.find((m) => m.table === selectedTable)?.active ?? 0}
              </span>
            </p>
          </div>
        </div>

        {/* Search, Filter & Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Table Search */}
          <div className="relative">
            <Search className={`absolute left-3 top-2.5 w-4 h-4 ${textSecondaryClass}`} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={`Search in ${selectedTable}...`}
              className={`pl-9 pr-3 py-1.5 text-xs rounded-lg border ${borderClass} bg-black/5 dark:bg-white/5 ${textPrimaryClass} focus:outline-hidden focus:ring-2 focus:ring-sky-500`}
            />
          </div>

          {/* Include Expired Checkbox */}
          <label className={`flex items-center gap-2 text-xs font-medium cursor-pointer ${textSecondaryClass}`}>
            <input
              type="checkbox"
              checked={includeExpired}
              onChange={(e) => onToggleIncludeExpired(e.target.checked)}
              className="rounded-xs border-zinc-600 text-sky-600 focus:ring-0"
            />
            <span>Show Expired History</span>
          </label>

          {/* Add Row Button */}
          <button
            onClick={onOpenCreateModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-sky-600 hover:bg-sky-500 text-white transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add Row</span>
          </button>
        </div>
      </div>

      {/* Main Data Grid Table */}
      <div className={`flex-1 border ${borderClass} ${cardBgClass} rounded-2xl overflow-hidden flex flex-col shadow-sm`}>
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center p-8 text-xs text-sky-400">
            <div className="animate-spin mr-2 font-mono">⚡</div>
            <span>Querying table endpoint /api/{selectedTable}...</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-400">
            <TableIcon className="w-10 h-10 mb-2 opacity-40 text-sky-400" />
            <p className="text-sm font-medium">No rows found in {selectedTable}</p>
            <p className="text-xs text-zinc-500 mt-1">
              {searchTerm ? 'Try clearing your search query' : 'Click "Add Row" to insert a new record'}
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-zinc-900/90 backdrop-blur-xs border-b border-zinc-700/60 z-10 font-mono text-[11px] text-zinc-400 uppercase tracking-wider">
                <tr>
                  <th className="p-3">Actions</th>
                  {headers.map((h) => (
                    <th key={h} className="p-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-700/40 font-mono">
                {filteredItems.map((row, idx) => {
                  const isExpired = row.expired_at !== null && row.expired_at !== undefined;
                  return (
                    <tr
                      key={row.id || idx}
                      className={`transition-colors ${
                        isExpired
                          ? 'bg-rose-500/5 text-rose-300/60 line-through'
                          : 'hover:bg-black/5 dark:hover:bg-white/5 text-zinc-200'
                      }`}
                    >
                      {/* Action buttons */}
                      <td className="p-3 not-sr-only no-underline flex items-center gap-1.5 whitespace-nowrap">
                        <button
                          onClick={() => handleCopyId(row.id || row.name)}
                          className="p-1 rounded-md text-zinc-400 hover:text-sky-400 hover:bg-sky-500/10 transition-colors"
                          title="Copy Row ID"
                        >
                          {copiedId === String(row.id || row.name) ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() => onOpenEditModal(row)}
                          className="p-1 rounded-md text-zinc-400 hover:text-sky-400 hover:bg-sky-500/10 transition-colors"
                          title="Supersede / Update (Append-Only)"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {!isExpired && (
                          <button
                            onClick={() => onSoftDeleteRow(row.id || row.name)}
                            className="p-1 rounded-md text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            title="Soft Delete (Set expired_at = now)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>

                      {/* Column Cell Data */}
                      {headers.map((h) => {
                        const cellVal = row[h];
                        let content: React.ReactNode = String(cellVal ?? '');

                        if (h === 'id') {
                          content = (
                            <span className="font-semibold text-sky-400 break-all">
                              {String(cellVal).slice(0, 18)}
                              {String(cellVal).length > 18 ? '...' : ''}
                            </span>
                          );
                        } else if (h === 'expired_at') {
                          content = cellVal ? (
                            <span className="px-1.5 py-0.5 rounded-sm bg-rose-500/20 text-rose-300 font-bold text-[10px]">
                              {String(cellVal).slice(0, 19)}
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded-sm bg-emerald-500/20 text-emerald-300 font-semibold text-[10px]">
                              ACTIVE
                            </span>
                          );
                        } else if (typeof cellVal === 'object' && cellVal !== null) {
                          content = (
                            <span className="text-[10px] text-amber-300 bg-amber-500/10 px-1 py-0.5 rounded-sm border border-amber-500/20">
                              {JSON.stringify(cellVal)}
                            </span>
                          );
                        }

                        return (
                          <td key={h} className="p-3 max-w-xs truncate">
                            {content}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
