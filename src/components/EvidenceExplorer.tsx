import React, { useEffect, useState, useCallback } from 'react';
import { FormattedEvidenceItem } from '../types';
import { fetchEvidenceItems, fetchEvidenceTypes, softDeleteTableRow } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import {
  FileText,
  Search,
  Filter,
  Hash,
  Globe,
  Tag,
  Clock,
  Plus,
  RefreshCw,
  Copy,
  Check,
  Eye,
  Trash2,
  Edit3,
  Calendar,
  AlertCircle,
  Database,
  Info,
  X,
  Code,
} from 'lucide-react';

interface EvidenceExplorerProps {
  onOpenCreateModal: (defaultType?: string) => void;
  onOpenEditModal: (item: FormattedEvidenceItem) => void;
  onRefreshGlobal?: () => void;
}

export const EvidenceExplorer: React.FC<EvidenceExplorerProps> = ({
  onOpenCreateModal,
  onOpenEditModal,
  onRefreshGlobal,
}) => {
  const { cardBgClass, borderClass, textPrimaryClass, textSecondaryClass } = useTheme();

  // Data states
  const [items, setItems] = useState<FormattedEvidenceItem[]>([]);
  const [evidenceTypes, setEvidenceTypes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Filter states
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedOrigin, setSelectedOrigin] = useState<string>('');
  const [sourceHashFilter, setSourceHashFilter] = useState<string>('');
  const [uriFilter, setUriFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [includeExpired, setIncludeExpired] = useState<boolean>(false);

  // Copy state
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  // Detail Modal State
  const [inspectingItem, setInspectingItem] = useState<FormattedEvidenceItem | null>(null);

  // Load Evidence Types list
  const loadTypes = useCallback(async () => {
    try {
      const res = await fetchEvidenceTypes(includeExpired);
      setEvidenceTypes(res.items || []);
    } catch (err) {
      console.error('Failed to load evidence types:', err);
    }
  }, [includeExpired]);

  // Load Evidence Items
  const loadItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetchEvidenceItems({
        evidenceType: selectedType || undefined,
        origin: selectedOrigin || undefined,
        sourceHash: sourceHashFilter || undefined,
        uri: uriFilter || undefined,
        includeExpired,
        limit: 200,
      });
      setItems(res.items || []);
      setTotalCount(res.total || (res.items ? res.items.length : 0));
    } catch (err) {
      console.error('Failed to load evidence items:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedType, selectedOrigin, sourceHashFilter, uriFilter, includeExpired]);

  useEffect(() => {
    loadTypes();
  }, [loadTypes]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const handleSoftDelete = async (id: string) => {
    if (window.confirm(`Are you sure you want to expire evidence item '${id}'?`)) {
      try {
        await softDeleteTableRow('evidence_item', id);
        loadItems();
        if (onRefreshGlobal) onRefreshGlobal();
      } catch (err: any) {
        alert(`Failed to soft delete evidence item: ${err.message}`);
      }
    }
  };

  const handleResetFilters = () => {
    setSelectedType('');
    setSelectedOrigin('');
    setSourceHashFilter('');
    setUriFilter('');
    setSearchQuery('');
    setIncludeExpired(false);
  };

  // Local client-side search filtering across items
  const filteredItems = items.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.id.toLowerCase().includes(q) ||
      (item.evidenceType && item.evidenceType.toLowerCase().includes(q)) ||
      (item.excerpt && item.excerpt.toLowerCase().includes(q)) ||
      (item.note && item.note.toLowerCase().includes(q)) ||
      (item.origin && item.origin.toLowerCase().includes(q)) ||
      (item.uri && item.uri.toLowerCase().includes(q)) ||
      (item.sourceHash && item.sourceHash.toLowerCase().includes(q))
    );
  });

  // Unique origins for dropdown
  const availableOrigins = Array.from(new Set(items.map((i) => i.origin).filter(Boolean))) as string[];

  return (
    <div className="h-full flex flex-col overflow-hidden bg-zinc-950/40">
      {/* Top Header / Action Bar */}
      <div className={`p-4 border-b ${borderClass} ${cardBgClass} flex flex-wrap items-center justify-between gap-3 shrink-0`}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className={`text-base font-semibold ${textPrimaryClass}`}>Evidence Explorer</h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-mono font-medium">
                {totalCount} records
              </span>
            </div>
            <p className={`text-xs ${textSecondaryClass}`}>
              Immutable, hash-deduplicated evidence items proving system relationships & claims
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              loadItems();
              loadTypes();
            }}
            className={`p-2 rounded-lg border ${borderClass} ${textSecondaryClass} hover:${textPrimaryClass} hover:bg-white/5 transition-all`}
            title="Refresh Evidence Data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => onOpenCreateModal(selectedType || undefined)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs shadow-xs transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Evidence Item</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className={`p-3 border-b ${borderClass} bg-black/20 flex flex-wrap items-center gap-2 shrink-0 text-xs`}>
        {/* Search Bar */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-zinc-500" />
          <input
            type="text"
            placeholder="Search excerpt, notes, URI, hash..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-8 pr-3 py-1.5 rounded-md border ${borderClass} bg-black/30 ${textPrimaryClass} text-xs focus:outline-hidden focus:border-sky-500`}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-2 text-zinc-400 hover:text-white"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Evidence Type Filter */}
        <div className="flex items-center gap-1">
          <Tag className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className={`px-2 py-1.5 rounded-md border ${borderClass} bg-black/30 ${textPrimaryClass} focus:outline-hidden focus:border-sky-500`}
          >
            <option value="">All Types ({evidenceTypes.length})</option>
            {evidenceTypes.map((t) => (
              <option key={t.id || t.name} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        {/* Origin Filter */}
        <div className="flex items-center gap-1">
          <Globe className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <select
            value={selectedOrigin}
            onChange={(e) => setSelectedOrigin(e.target.value)}
            className={`px-2 py-1.5 rounded-md border ${borderClass} bg-black/30 ${textPrimaryClass} focus:outline-hidden focus:border-sky-500`}
          >
            <option value="">All Origins</option>
            {availableOrigins.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>

        {/* Source Hash Filter */}
        <div className="flex items-center gap-1">
          <Hash className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <input
            type="text"
            placeholder="Filter by hash..."
            value={sourceHashFilter}
            onChange={(e) => setSourceHashFilter(e.target.value)}
            className={`w-32 px-2 py-1.5 rounded-md border ${borderClass} bg-black/30 ${textPrimaryClass} focus:outline-hidden focus:border-sky-500 font-mono text-[11px]`}
          />
        </div>

        {/* Include Expired Toggle */}
        <label className="flex items-center gap-1.5 cursor-pointer select-none text-zinc-400 hover:text-zinc-200">
          <input
            type="checkbox"
            checked={includeExpired}
            onChange={(e) => setIncludeExpired(e.target.checked)}
            className="rounded-xs border-zinc-700 bg-black/40 text-sky-500 focus:ring-0"
          />
          <span>Include Expired</span>
        </label>

        {/* Active Filters Reset */}
        {(selectedType || selectedOrigin || sourceHashFilter || uriFilter || searchQuery || includeExpired) && (
          <button
            onClick={handleResetFilters}
            className="px-2 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium transition-all"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 text-zinc-500 gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-sky-400" />
            <span className="text-xs">Loading evidence items...</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-zinc-500 gap-3 border border-dashed border-zinc-800 rounded-xl p-6">
            <FileText className="w-10 h-10 text-zinc-600" />
            <div className="text-center">
              <p className="text-sm font-medium text-zinc-300">No Evidence Items Found</p>
              <p className="text-xs text-zinc-500 mt-1">
                Try adjusting your filter criteria or create a new evidence item.
              </p>
            </div>
            <button
              onClick={() => onOpenCreateModal(selectedType || undefined)}
              className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium"
            >
              Add Evidence Item
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map((item) => {
              const isExpired = !!item.expiredAt;
              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-xl border ${borderClass} ${cardBgClass} flex flex-col justify-between gap-3 hover:border-sky-500/40 transition-all ${
                    isExpired ? 'opacity-60 bg-red-950/10' : ''
                  }`}
                >
                  <div>
                    {/* Item Header */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-mono font-semibold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-md border border-sky-500/20">
                          {item.evidenceType || 'Uncategorized'}
                        </span>

                        {item.origin && (
                          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-xs border border-emerald-500/20">
                            {item.origin}
                          </span>
                        )}

                        {isExpired && (
                          <span className="text-[10px] font-mono text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded-xs border border-rose-500/20">
                            EXPIRED
                          </span>
                        )}
                      </div>

                      <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                        {item.id}
                      </span>
                    </div>

                    {/* Excerpt */}
                    {item.excerpt ? (
                      <p className="text-xs text-zinc-200 line-clamp-3 bg-black/30 p-2.5 rounded-lg border border-zinc-800/80 font-sans italic leading-relaxed mb-2">
                        "{item.excerpt}"
                      </p>
                    ) : (
                      <p className="text-xs text-zinc-500 italic mb-2">No excerpt provided</p>
                    )}

                    {/* URI / Note */}
                    <div className="space-y-1 text-xs">
                      {item.uri && (
                        <div className="flex items-center gap-1.5 text-zinc-400 font-mono text-[11px] truncate">
                          <Globe className="w-3.5 h-3.5 shrink-0 text-sky-400" />
                          <span className="truncate" title={item.uri}>
                            {item.uri}
                          </span>
                        </div>
                      )}

                      {item.note && (
                        <p className="text-[11px] text-zinc-400 line-clamp-2">
                          <span className="font-semibold text-zinc-300">Note:</span> {item.note}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Item Footer */}
                  <div className="pt-3 border-t border-zinc-800/60 flex flex-col gap-2 text-[11px] font-mono text-zinc-400">
                    {/* Source Hash */}
                    {item.sourceHash && (
                      <div className="flex items-center justify-between gap-1 bg-black/40 px-2 py-1 rounded-md border border-zinc-800/60">
                        <div className="flex items-center gap-1.5 truncate">
                          <Hash className="w-3 h-3 text-amber-400 shrink-0" />
                          <span className="truncate text-zinc-300" title={item.sourceHash}>
                            {item.sourceHash}
                          </span>
                        </div>

                        <button
                          onClick={() => handleCopyHash(item.sourceHash!)}
                          className="text-zinc-400 hover:text-white p-0.5 rounded-xs"
                          title="Copy Source Hash"
                        >
                          {copiedHash === item.sourceHash ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    )}

                    {/* Timestamps & Actions */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                        <Clock className="w-3 h-3" />
                        <span>
                          {item.capturedAt
                            ? new Date(item.capturedAt).toLocaleDateString()
                            : 'Unspecified time'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setInspectingItem(item)}
                          className="p-1 rounded-md text-zinc-400 hover:text-sky-400 hover:bg-sky-500/10 transition-all"
                          title="View Full Metadata & Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => onOpenEditModal(item)}
                          className="p-1 rounded-md text-zinc-400 hover:text-amber-400 hover:bg-amber-500/10 transition-all"
                          title="Edit Evidence Item"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        {!isExpired && (
                          <button
                            onClick={() => handleSoftDelete(item.id)}
                            className="p-1 rounded-md text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                            title="Soft Delete (Expire)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail Inspection Modal */}
      {inspectingItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`w-full max-w-2xl rounded-xl border ${borderClass} ${cardBgClass} p-5 shadow-2xl space-y-4 max-h-[90vh] flex flex-col`}>
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-sky-400" />
                <h3 className={`text-base font-semibold ${textPrimaryClass}`}>
                  Evidence Item Details
                </h3>
              </div>
              <button
                onClick={() => setInspectingItem(null)}
                className="p-1 rounded-md text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-black/30 rounded-lg border border-zinc-800">
                <div>
                  <span className="text-zinc-500 block text-[10px] font-mono uppercase">ID</span>
                  <span className="font-mono text-sky-400 font-semibold">{inspectingItem.id}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[10px] font-mono uppercase">Evidence Type</span>
                  <span className="font-mono text-emerald-400">{inspectingItem.evidenceType}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[10px] font-mono uppercase">Origin</span>
                  <span className="text-zinc-300">{inspectingItem.origin || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[10px] font-mono uppercase">Captured At</span>
                  <span className="text-zinc-300">
                    {inspectingItem.capturedAt
                      ? new Date(inspectingItem.capturedAt).toISOString()
                      : 'N/A'}
                  </span>
                </div>
              </div>

              {inspectingItem.sourceHash && (
                <div>
                  <span className="text-zinc-400 font-mono text-[11px] block mb-1">Source Hash</span>
                  <div className="p-2 bg-black/50 rounded-md border border-zinc-800 font-mono text-amber-300 break-all select-all">
                    {inspectingItem.sourceHash}
                  </div>
                </div>
              )}

              {inspectingItem.uri && (
                <div>
                  <span className="text-zinc-400 font-mono text-[11px] block mb-1">URI</span>
                  <div className="p-2 bg-black/50 rounded-md border border-zinc-800 font-mono text-sky-300 break-all">
                    {inspectingItem.uri}
                  </div>
                </div>
              )}

              {inspectingItem.excerpt && (
                <div>
                  <span className="text-zinc-400 font-mono text-[11px] block mb-1">Excerpt</span>
                  <div className="p-3 bg-black/50 rounded-md border border-zinc-800 text-zinc-200 italic leading-relaxed">
                    "{inspectingItem.excerpt}"
                  </div>
                </div>
              )}

              {inspectingItem.note && (
                <div>
                  <span className="text-zinc-400 font-mono text-[11px] block mb-1">Notes</span>
                  <div className="p-3 bg-black/50 rounded-md border border-zinc-800 text-zinc-300">
                    {inspectingItem.note}
                  </div>
                </div>
              )}

              {inspectingItem.metadata && (
                <div>
                  <span className="text-zinc-400 font-mono text-[11px] block mb-1">Metadata (JSON)</span>
                  <pre className="p-3 bg-black/60 rounded-md border border-zinc-800 text-emerald-400 font-mono text-[11px] overflow-x-auto">
                    {JSON.stringify(inspectingItem.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-zinc-800 flex justify-end gap-2">
              <button
                onClick={() => setInspectingItem(null)}
                className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
