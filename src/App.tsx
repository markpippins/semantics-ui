import React, { useEffect, useState, useCallback } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import {
  ActiveTab,
  DriftFinding,
  FilterState,
  MetaResponse,
  Snapshot,
  SnapshotObservation,
  TableMetaItem,
  TableName,
} from './types';
import {
  fetchMeta,
  fetchTableList,
  softDeleteTableRow,
} from './services/api';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { TableInspector } from './components/TableInspector';
import { SnapshotsAndDrift } from './components/SnapshotsAndDrift';
import { SchemaMetaViewer } from './components/SchemaMetaViewer';
import { ApiSandbox } from './components/ApiSandbox';
import { EvidenceExplorer } from './components/EvidenceExplorer';
import { NodeEditModal } from './components/NodeEditModal';

export function AppContent() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('tables');
  const [selectedTable, setSelectedTable] = useState<TableName>('snapshot');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

  // Global Datasets
  const [metaData, setMetaData] = useState<MetaResponse | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [observations, setObservations] = useState<SnapshotObservation[]>([]);
  const [driftFindings, setDriftFindings] = useState<DriftFinding[]>([]);

  // Selected Table Specific Row Items for TableInspector
  const [tableItems, setTableItems] = useState<any[]>([]);
  const [tableCount, setTableCount] = useState<number>(0);
  const [isTableLoading, setIsTableLoading] = useState<boolean>(false);

  // Real-time Filters
  const [filterState, setFilterState] = useState<FilterState>({
    searchQuery: '',
    includeExpired: false,
  });

  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Node Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalTableName, setModalTableName] = useState<TableName>('snapshot');
  const [editingRow, setEditingRow] = useState<any | null>(null);
  const [modalDefaultValues, setModalDefaultValues] = useState<Record<string, any>>({});

  // Fetch all core datasets
  const refreshAllData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const meta = await fetchMeta();
      setMetaData(meta);

      // Fetch active/all lists for the snapshot/drift views
      const [snapRes, obsRes, dfRes] = await Promise.all([
        fetchTableList<Snapshot>('snapshot', 500, 0, filterState.includeExpired),
        fetchTableList<SnapshotObservation>('snapshot_observation', 500, 0, filterState.includeExpired),
        fetchTableList<DriftFinding>('drift_finding', 500, 0, filterState.includeExpired),
      ]);

      setSnapshots(snapRes.items);
      setObservations(obsRes.items);
      setDriftFindings(dfRes.items);
    } catch (err) {
      console.error('Failed to load metadata or tables:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [filterState.includeExpired]);

  // Fetch selected table rows for TableInspector
  const loadSelectedTableItems = useCallback(async () => {
    setIsTableLoading(true);
    try {
      const res = await fetchTableList<any>(selectedTable, 200, 0, filterState.includeExpired);
      setTableItems(res.items);
      setTableCount(res.count);
    } catch (err) {
      console.error(`Failed to load ${selectedTable}:`, err);
    } finally {
      setIsTableLoading(false);
    }
  }, [selectedTable, filterState.includeExpired]);

  useEffect(() => {
    refreshAllData();
  }, [refreshAllData]);

  useEffect(() => {
    if (activeTab === 'tables') {
      loadSelectedTableItems();
    }
  }, [activeTab, selectedTable, loadSelectedTableItems]);

  // Modal Handlers
  const handleOpenCreateModal = (targetTable?: TableName, defaults?: Record<string, any>) => {
    setModalTableName(targetTable || selectedTable || 'snapshot');
    setEditingRow(null);
    setModalDefaultValues(defaults || {});
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (targetTable: TableName, row: any) => {
    setModalTableName(targetTable);
    setEditingRow(row);
    setModalDefaultValues({});
    setIsModalOpen(true);
  };

  const handleSoftDelete = async (tbl: TableName, id: string | number) => {
    if (window.confirm(`Expire record '${id}' in ${tbl}? (Soft delete sets expired_at = now())`)) {
      try {
        await softDeleteTableRow(tbl, id);
        refreshAllData();
        if (activeTab === 'tables') loadSelectedTableItems();
      } catch (err: any) {
        alert(`Failed to soft delete: ${err.message}`);
      }
    }
  };

  const updateFilterState = (updated: Partial<FilterState>) => {
    setFilterState((prev) => ({ ...prev, ...updated }));
  };

  const tablesMetaList: TableMetaItem[] = metaData?.tables || [];
  const currentWritableParams = metaData?.writableParams[modalTableName] || [];
  const unresolvedDriftCount = driftFindings.filter((d) => d.resolved_at === null).length;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Top Application Header */}
      <Header
        searchQuery={filterState.searchQuery}
        onSearchChange={(query) => updateFilterState({ searchQuery: query })}
        onOpenCreateModal={() => handleOpenCreateModal()}
        onRefreshData={refreshAllData}
        isRefreshing={isRefreshing}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Left Collapsible Navigation Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          selectedTable={selectedTable}
          onSelectTable={(tbl) => {
            setSelectedTable(tbl);
            if (activeTab !== 'tables') setActiveTab('tables');
          }}
          tablesMeta={tablesMetaList}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          unresolvedDriftCount={unresolvedDriftCount}
        />

        {/* Main Content Stage View */}
        <main className="flex-1 h-full overflow-hidden relative">
          {activeTab === 'tables' && (
            <TableInspector
              selectedTable={selectedTable}
              onSelectTable={setSelectedTable}
              tablesMeta={tablesMetaList}
              items={tableItems}
              totalCount={tableCount}
              isLoading={isTableLoading}
              includeExpired={filterState.includeExpired}
              onToggleIncludeExpired={(val) => updateFilterState({ includeExpired: val })}
              onOpenCreateModal={() => handleOpenCreateModal(selectedTable)}
              onOpenEditModal={(row) => handleOpenEditModal(selectedTable, row)}
              onSoftDeleteRow={(id) => handleSoftDelete(selectedTable, id)}
              onRefresh={loadSelectedTableItems}
            />
          )}

          {activeTab === 'evidence' && (
            <EvidenceExplorer
              onOpenCreateModal={(type) => handleOpenCreateModal('evidence_item', type ? { p_evidence_type_id: type } : {})}
              onOpenEditModal={(item) => handleOpenEditModal('evidence_item', item)}
              onRefreshGlobal={refreshAllData}
            />
          )}

          {activeTab === 'snapshots_drift' && (
            <SnapshotsAndDrift
              snapshots={snapshots}
              observations={observations}
              driftFindings={driftFindings}
              onRefreshData={refreshAllData}
              onOpenCreateSnapshot={() => handleOpenCreateModal('snapshot')}
            />
          )}

          {activeTab === 'schema_meta' && <SchemaMetaViewer metaData={metaData} isLoading={isRefreshing} />}

          {activeTab === 'api_sandbox' && <ApiSandbox />}
        </main>
      </div>

      {/* Guided Record Edit Modal */}
      <NodeEditModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        tableName={modalTableName}
        initialRow={editingRow}
        writableParams={currentWritableParams}
        snapshots={snapshots}
        observations={observations}
        defaultValues={modalDefaultValues}
        onSuccess={() => {
          refreshAllData();
          if (activeTab === 'tables') loadSelectedTableItems();
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
