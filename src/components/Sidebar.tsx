import React from 'react';
import { ActiveTab, TableMetaItem, TableName } from '../types';
import { useTheme } from '../context/ThemeContext';
import {
  Network,
  Table,
  Layers,
  Code2,
  Terminal,
  ChevronLeft,
  ChevronRight,
  Database,
  AlertTriangle,
  GitCommit,
  CheckCircle2,
} from 'lucide-react';

interface SidebarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  selectedTable: TableName;
  onSelectTable: (table: TableName) => void;
  tablesMeta: TableMetaItem[];
  collapsed: boolean;
  onToggleCollapse: () => void;
  unresolvedDriftCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  selectedTable,
  onSelectTable,
  tablesMeta,
  collapsed,
  onToggleCollapse,
  unresolvedDriftCount,
}) => {
  const { cardBgClass, borderClass, textPrimaryClass, textSecondaryClass } = useTheme();

  const mainNavItems = [
    { id: 'graph' as ActiveTab, label: 'Graph Explorer', icon: Network, badge: 'Interactive' },
    { id: 'tables' as ActiveTab, label: 'Table Inspector', icon: Table, badge: `${tablesMeta.length} Tables` },
    { id: 'snapshots_drift' as ActiveTab, label: 'Snapshots & Drift', icon: Layers, countBadge: unresolvedDriftCount },
    { id: 'schema_meta' as ActiveTab, label: 'Schema Meta & Procs', icon: Code2 },
    { id: 'api_sandbox' as ActiveTab, label: 'API Sandbox', icon: Terminal },
  ];

  return (
    <aside
      className={`relative border-r ${borderClass} ${cardBgClass} transition-all duration-300 flex flex-col z-30 ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Collapse Toggle Button */}
      <button
        onClick={onToggleCollapse}
        className={`absolute -right-3 top-6 p-1 rounded-full border ${borderClass} bg-zinc-800 text-zinc-300 hover:bg-zinc-700 shadow-xs z-50`}
        title={collapsed ? 'Expand Navigation' : 'Collapse Navigation'}
      >
        {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
      </button>

      {/* Primary Navigation Tabs */}
      <div className="p-2 space-y-1">
        {mainNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-sky-600/20 text-sky-400 border border-sky-500/30'
                  : `${textSecondaryClass} hover:${textPrimaryClass} hover:bg-black/5 dark:hover:bg-white/5`
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-sky-400' : ''}`} />
              {!collapsed && (
                <div className="flex items-center justify-between flex-1 overflow-hidden">
                  <span className="truncate">{item.label}</span>
                  {item.badge && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-sm bg-sky-500/10 text-sky-400 font-mono">
                      {item.badge}
                    </span>
                  )}
                  {item.countBadge !== undefined && item.countBadge > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold font-mono flex items-center gap-0.5">
                      <AlertTriangle className="w-2.5 h-2.5" />
                      {item.countBadge}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className={`my-2 border-t ${borderClass}`} />

      {/* Sub-navigation for Tables when 'tables' or 'graph' tab is selected */}
      {!collapsed && (activeTab === 'tables' || activeTab === 'graph') && (
        <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-1">
          <div className="px-3 py-1 flex items-center justify-between text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
            <span>Table Registry (12)</span>
            <Database className="w-3 h-3" />
          </div>

          <div className="space-y-0.5">
            {tablesMeta.map((t) => {
              const isSelected = selectedTable === t.table;
              return (
                <button
                  key={t.table}
                  onClick={() => {
                    onSelectTable(t.table);
                    if (activeTab !== 'tables') onSelectTab('tables');
                  }}
                  className={`w-full text-left px-3 py-1.5 rounded-md text-xs transition-all flex items-center justify-between ${
                    isSelected
                      ? 'bg-sky-500/15 text-sky-300 font-medium border border-sky-500/20'
                      : `${textSecondaryClass} hover:${textPrimaryClass} hover:bg-black/5 dark:hover:bg-white/5`
                  }`}
                >
                  <span className="truncate font-mono text-[11px]">{t.table}</span>
                  <div className="flex items-center gap-1 font-mono text-[10px] opacity-80">
                    <span className="text-emerald-400">{t.active}</span>
                    <span className="text-zinc-500">/</span>
                    <span className="text-zinc-400">{t.total}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Append-only Design Invariant Badge in Footer */}
      {!collapsed && (
        <div className={`p-3 border-t ${borderClass} text-[11px] font-mono space-y-1 ${textSecondaryClass}`}>
          <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Append-Only Active</span>
          </div>
          <p className="text-[10px] leading-tight opacity-75">
            Updates supersede via <code className="text-sky-400">expired_at</code>. Rows never physically deleted.
          </p>
        </div>
      )}
    </aside>
  );
};
