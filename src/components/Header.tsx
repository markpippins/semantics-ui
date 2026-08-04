import React, { useEffect, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { Theme } from '../types';
import { Database, Sun, Moon, ShieldAlert, Sparkles, Activity, Search, RefreshCw } from 'lucide-react';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onOpenCreateModal: () => void;
  onRefreshData: () => void;
  isRefreshing?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
  onOpenCreateModal,
  onRefreshData,
  isRefreshing = false,
}) => {
  const { theme, setTheme, cardBgClass, borderClass, textPrimaryClass, textSecondaryClass } = useTheme();
  const [healthStatus, setHealthStatus] = useState<{ status: string; service?: string } | null>(null);

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setHealthStatus(data))
      .catch(() => setHealthStatus({ status: 'degraded' }));
  }, []);

  const themesList: { id: Theme; label: string; icon: React.ReactNode }[] = [
    { id: 'light', label: 'Light', icon: <Sun className="w-3.5 h-3.5" /> },
    { id: 'dark', label: 'Dark', icon: <Moon className="w-3.5 h-3.5" /> },
    { id: 'steel', label: 'Steel', icon: <ShieldAlert className="w-3.5 h-3.5" /> },
  ];

  return (
    <header className={`sticky top-0 z-40 w-full border-b ${borderClass} ${cardBgClass} px-4 py-3 flex items-center justify-between gap-4`}>
      {/* Brand & Service Info */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white shadow-xs">
          <Database className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className={`font-semibold tracking-tight text-base ${textPrimaryClass}`}>
              Semantics Database
            </h1>
            <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded-sm bg-sky-500/10 text-sky-400 border border-sky-500/20">
              v1.0.0
            </span>
          </div>
          <p className={`text-xs ${textSecondaryClass} hidden sm:block`}>
            Suite System Description & Append-Only Graph Model
          </p>
        </div>
      </div>

      {/* Global Search & Actions */}
      <div className="flex items-center gap-3 flex-1 max-w-md mx-2">
        <div className="relative w-full">
          <Search className={`absolute left-3 top-2.5 w-4 h-4 ${textSecondaryClass}`} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Filter concepts, representations, relationships..."
            className={`w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border ${borderClass} bg-black/5 dark:bg-white/5 focus:outline-hidden focus:ring-2 focus:ring-sky-500 transition-all ${textPrimaryClass}`}
          />
        </div>
      </div>

      {/* Right Controls: Health, Theme, Add Node */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Service Health Indicator */}
        <div className="hidden lg:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 font-mono">
          <Activity className="w-3.5 h-3.5 animate-pulse" />
          <span>{healthStatus?.status === 'ok' ? 'semantics-srv:3160' : 'offline'}</span>
        </div>

        {/* Refresh button */}
        <button
          onClick={onRefreshData}
          disabled={isRefreshing}
          title="Refresh database state"
          className={`p-1.5 text-xs rounded-lg border ${borderClass} hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${textSecondaryClass}`}
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>

        {/* Theme Selector Toggle */}
        <div className={`flex items-center p-0.5 rounded-lg border ${borderClass} bg-black/5 dark:bg-white/5 text-xs`}>
          {themesList.map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all text-xs font-medium ${
                theme === t.id
                  ? 'bg-sky-600 text-white shadow-xs'
                  : `${textSecondaryClass} hover:${textPrimaryClass}`
              }`}
            >
              {t.icon}
              <span className="capitalize hidden md:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {/* Create Entity Button */}
        <button
          onClick={onOpenCreateModal}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-sky-600 hover:bg-sky-500 text-white shadow-xs transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">New Record</span>
        </button>
      </div>
    </header>
  );
};
