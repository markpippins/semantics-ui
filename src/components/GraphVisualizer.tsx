import React, { useState, useEffect, useRef, useMemo } from 'react';
import { select } from 'd3-selection';
import { zoom as d3Zoom, zoomIdentity, ZoomBehavior } from 'd3-zoom';
import {
  Concept,
  ConceptRelationship,
  GraphViewMode,
  OwningSubsystem,
  Representation,
  RepresentationRelationship,
  FilterState,
  RelationshipType,
  RelationshipEvidenceResponse,
} from '../types';
import {
  fetchConceptRelationshipEvidence,
  fetchRepresentationRelationshipEvidence,
} from '../services/api';
import { useTheme } from '../context/ThemeContext';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RefreshCw,
  Info,
  Edit3,
  Trash2,
  Plus,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  Filter,
  CheckCircle,
  Eye,
  Sliders,
  Sparkles,
} from 'lucide-react';

interface GraphVisualizerProps {
  concepts: Concept[];
  conceptRelationships: ConceptRelationship[];
  representations: Representation[];
  representationRelationships: RepresentationRelationship[];
  subsystems: OwningSubsystem[];
  relationshipTypes: RelationshipType[];
  filterState: FilterState;
  onFilterChange: (updated: Partial<FilterState>) => void;
  onEditNode: (table: 'concept' | 'representation', id: string) => void;
  onSoftDeleteNode: (table: 'concept' | 'representation', id: string) => void;
  onAddRelationship: (fromId: string, type: 'concept' | 'representation') => void;
}

interface NodePos {
  id: string;
  label: string;
  subtitle?: string;
  subsystemId?: number;
  subsystemName?: string;
  isExpired: boolean;
  x: number;
  y: number;
  type: 'concept' | 'representation';
  raw: Concept | Representation;
}

interface EdgePos {
  id: string;
  from: string;
  to: string;
  relType: string;
  pathType?: 'green' | 'red' | 'orange' | string | null;
  confidence?: number;
  evidenceSource?: string;
  evidenceType?: string;
  evidenceNotes?: string;
  notes?: string;
  isExpired: boolean;
  fromPos: NodePos;
  toPos: NodePos;
  raw: ConceptRelationship | RepresentationRelationship;
}

export const GraphVisualizer: React.FC<GraphVisualizerProps> = ({
  concepts,
  conceptRelationships,
  representations,
  representationRelationships,
  subsystems,
  relationshipTypes,
  filterState,
  onFilterChange,
  onEditNode,
  onSoftDeleteNode,
  onAddRelationship,
}) => {
  const { cardBgClass, borderClass, textPrimaryClass, textSecondaryClass } = useTheme();
  const [viewMode, setViewMode] = useState<GraphViewMode>('concept');
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [customNodePositions, setCustomNodePositions] = useState<Record<string, { x: number; y: number }>>({});
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [startPanPos, setStartPanPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const [edgeEvidence, setEdgeEvidence] = useState<RelationshipEvidenceResponse['evidence'] | null>(null);
  const [loadingEvidence, setLoadingEvidence] = useState(false);

  useEffect(() => {
    if (!selectedEdgeId) {
      setEdgeEvidence(null);
      return;
    }

    setLoadingEvidence(true);
    const fetchEvidence = async () => {
      try {
        if (viewMode === 'concept') {
          const res = await fetchConceptRelationshipEvidence(selectedEdgeId);
          setEdgeEvidence(res.evidence || []);
        } else {
          const res = await fetchRepresentationRelationshipEvidence(selectedEdgeId);
          setEdgeEvidence(res.evidence || []);
        }
      } catch {
        setEdgeEvidence([]);
      } finally {
        setLoadingEvidence(false);
      }
    };

    fetchEvidence();
  }, [selectedEdgeId, viewMode]);

  const svgRef = useRef<SVGSVGElement>(null);
  const zoomBehaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  // Attach d3-zoom behavior to the SVG container
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = select(svgRef.current);

    const zoomBehavior = d3Zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .filter((event) => {
        if (event.type === 'wheel') return true;
        const target = event.target as HTMLElement | SVGElement;
        if (
          target.closest &&
          (target.closest('.group') ||
            target.closest('button') ||
            target.closest('select') ||
            target.closest('input'))
        ) {
          return false;
        }
        return !event.button;
      })
      .on('zoom', (event) => {
        setPan({ x: event.transform.x, y: event.transform.y });
        setZoom(event.transform.k);
      });

    zoomBehaviorRef.current = zoomBehavior;
    svg.call(zoomBehavior);

    return () => {
      svg.on('.zoom', null);
    };
  }, []);

  // Handle Dragging Nodes on Canvas via window events
  useEffect(() => {
    if (!draggedNodeId) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left - pan.x) / zoom;
        const mouseY = (e.clientY - rect.top - pan.y) / zoom;
        setCustomNodePositions((prev) => ({
          ...prev,
          [draggedNodeId]: { x: mouseX, y: mouseY },
        }));
      }
    };

    const handleMouseUp = () => {
      setDraggedNodeId(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggedNodeId, pan, zoom]);

  // Map subsystem IDs to colors for visual grouping
  const subsystemColors = useMemo(() => {
    const colors = [
      { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30', stroke: '#818cf8' },
      { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30', stroke: '#34d399' },
      { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30', stroke: '#fbbf24' },
      { bg: 'bg-sky-500/15', text: 'text-sky-400', border: 'border-sky-500/30', stroke: '#38bdf8' },
      { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30', stroke: '#c084fc' },
      { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30', stroke: '#fb7185' },
      { bg: 'bg-cyan-500/15', text: 'text-cyan-400', border: 'border-cyan-500/30', stroke: '#22d3ee' },
      { bg: 'bg-teal-500/15', text: 'text-teal-400', border: 'border-teal-500/30', stroke: '#2dd4bf' },
    ];
    const map: Record<number, typeof colors[0]> = {};
    subsystems.forEach((sub, idx) => {
      map[sub.id] = colors[idx % colors.length];
    });
    return map;
  }, [subsystems]);

  // Compute Nodes and Edges for the active viewMode and filterState
  const { nodes, edges } = useMemo(() => {
    let nodeItems: NodePos[] = [];
    let edgeItems: EdgePos[] = [];

    // Filter concepts/representations by search and includeExpired
    const isNodeActive = (n: { expired_at: string | null }) => filterState.includeExpired || n.expired_at === null;

    if (viewMode === 'concept') {
      const activeConcepts = concepts.filter(isNodeActive);
      const activeCR = conceptRelationships.filter((cr) => {
        if (!filterState.includeExpired && cr.expired_at !== null) return false;
        if (filterState.selectedRelType !== 'all' && cr.relationship_type !== filterState.selectedRelType) return false;
        if (filterState.pathFilter !== 'all' && cr.path !== filterState.pathFilter) return false;
        if (cr.confidence !== undefined && cr.confidence < filterState.minConfidence) return false;
        return true;
      });

      // Circular layout arrangement
      const total = activeConcepts.length;
      const radiusX = Math.max(320, total * 42);
      const radiusY = Math.max(220, total * 30);
      const centerX = 500;
      const centerY = 350;

      nodeItems = activeConcepts.map((c, idx) => {
        const angle = (idx / (total || 1)) * 2 * Math.PI - Math.PI / 2;
        const customPos = customNodePositions[c.id];
        return {
          id: c.id,
          label: c.name,
          subtitle: c.description,
          isExpired: c.expired_at !== null,
          x: customPos ? customPos.x : centerX + radiusX * Math.cos(angle),
          y: customPos ? customPos.y : centerY + radiusY * Math.sin(angle),
          type: 'concept',
          raw: c,
        };
      });

      const nodeMap = new Map(nodeItems.map((n) => [n.id, n]));

      edgeItems = activeCR
        .map((cr) => {
          const fromPos = nodeMap.get(cr.from_concept_id);
          const toPos = nodeMap.get(cr.to_concept_id);
          if (!fromPos || !toPos) return null;
          return {
            id: cr.id,
            from: cr.from_concept_id,
            to: cr.to_concept_id,
            relType: cr.relationship_type,
            pathType: cr.path,
            confidence: cr.confidence,
            evidenceSource: cr.evidence_source,
            evidenceType: cr.evidence_type,
            evidenceNotes: cr.evidence_notes,
            notes: cr.notes,
            isExpired: cr.expired_at !== null,
            fromPos,
            toPos,
            raw: cr,
          };
        })
        .filter(Boolean) as EdgePos[];
    } else if (viewMode === 'representation' || viewMode === 'subsystem_map') {
      const activeReps = representations.filter((r) => {
        if (!isNodeActive(r)) return false;
        if (filterState.selectedSubsystemId !== 'all' && r.owning_subsystem_id !== filterState.selectedSubsystemId) {
          return false;
        }
        return true;
      });

      const activeRR = representationRelationships.filter((rr) => {
        if (!filterState.includeExpired && rr.expired_at !== null) return false;
        if (filterState.selectedRelType !== 'all' && rr.relationship_type !== filterState.selectedRelType) return false;
        if (rr.confidence !== undefined && rr.confidence < filterState.minConfidence) return false;
        return true;
      });

      // Group representations by subsystem for subsystem map layout
      const total = activeReps.length;
      const centerX = 500;
      const centerY = 350;

      if (viewMode === 'subsystem_map') {
        // Cluster nodes around subsystem centers
        const subsInUse: number[] = Array.from(new Set(activeReps.map((r) => r.owning_subsystem_id)));
        const subCount = subsInUse.length;
        const subMapPos: Record<number, { cx: number; cy: number }> = {};

        subsInUse.forEach((subId, idx) => {
          const angle = (idx / (subCount || 1)) * 2 * Math.PI - Math.PI / 2;
          subMapPos[subId] = {
            cx: centerX + 340 * Math.cos(angle),
            cy: centerY + 240 * Math.sin(angle),
          };
        });

        nodeItems = activeReps.map((r, idx) => {
          const subPos = subMapPos[r.owning_subsystem_id] || { cx: centerX, cy: centerY };
          const subName = subsystems.find((s) => s.id === r.owning_subsystem_id)?.name || `Subsystem #${r.owning_subsystem_id}`;
          const offsetAngle = (idx * 1.5) % (2 * Math.PI);
          const customPos = customNodePositions[r.id];

          return {
            id: r.id,
            label: r.label,
            subtitle: `${r.schema_name || 'public'}.${r.table_name || 'table'}`,
            subsystemId: r.owning_subsystem_id,
            subsystemName: subName,
            isExpired: r.expired_at !== null,
            x: customPos ? customPos.x : subPos.cx + 80 * Math.cos(offsetAngle),
            y: customPos ? customPos.y : subPos.cy + 80 * Math.sin(offsetAngle),
            type: 'representation',
            raw: r,
          };
        });
      } else {
        // Standard representation circular layout
        nodeItems = activeReps.map((r, idx) => {
          const angle = (idx / (total || 1)) * 2 * Math.PI - Math.PI / 2;
          const subName = subsystems.find((s) => s.id === r.owning_subsystem_id)?.name;
          const customPos = customNodePositions[r.id];

          return {
            id: r.id,
            label: r.label,
            subtitle: `${r.schema_name || 'schema'}.${r.table_name || 'table'}`,
            subsystemId: r.owning_subsystem_id,
            subsystemName: subName,
            isExpired: r.expired_at !== null,
            x: customPos ? customPos.x : centerX + 360 * Math.cos(angle),
            y: customPos ? customPos.y : centerY + 240 * Math.sin(angle),
            type: 'representation',
            raw: r,
          };
        });
      }

      const nodeMap = new Map(nodeItems.map((n) => [n.id, n]));

      edgeItems = activeRR
        .map((rr) => {
          const fromPos = nodeMap.get(rr.from_representation_id);
          const toPos = nodeMap.get(rr.to_representation_id);
          if (!fromPos || !toPos) return null;
          return {
            id: rr.id,
            from: rr.from_representation_id,
            to: rr.to_representation_id,
            relType: rr.relationship_type,
            confidence: rr.confidence,
            evidenceSource: rr.evidence_source,
            evidenceType: rr.evidence_type,
            evidenceNotes: rr.evidence_notes,
            notes: rr.notes,
            isExpired: rr.expired_at !== null,
            fromPos,
            toPos,
            raw: rr,
          };
        })
        .filter(Boolean) as EdgePos[];
    }

    // Apply global text search filter on node label / subtitle / notes
    if (filterState.searchQuery.trim()) {
      const q = filterState.searchQuery.toLowerCase();
      const matchedNodeIds = new Set(
        nodeItems.filter((n) => n.label.toLowerCase().includes(q) || n.subtitle?.toLowerCase().includes(q)).map((n) => n.id)
      );

      nodeItems = nodeItems.map((n) => ({
        ...n,
        highlighted: matchedNodeIds.has(n.id),
      })) as any[];
    }

    return { nodes: nodeItems, edges: edgeItems };
  }, [
    viewMode,
    concepts,
    conceptRelationships,
    representations,
    representationRelationships,
    subsystems,
    filterState,
    customNodePositions,
  ]);

  // Selected Node detailed item lookup
  const selectedNode = useMemo(() => {
    return nodes.find((n) => n.id === selectedNodeId) || null;
  }, [nodes, selectedNodeId]);

  // Selected Edge detailed item lookup
  const selectedEdge = useMemo(() => {
    return edges.find((e) => e.id === selectedEdgeId) || null;
  }, [edges, selectedEdgeId]);

  // Dynamic Canvas Bounds so graph elements exceeding initial viewport remain fully scrollable & accessible
  const canvasBounds = useMemo(() => {
    let maxX = 1200;
    let maxY = 800;

    for (const n of nodes) {
      if (n.x + 200 > maxX) maxX = n.x + 200;
      if (n.y + 150 > maxY) maxY = n.y + 150;
    }

    return {
      width: Math.max(2200, Math.ceil(maxX + 300)),
      height: Math.max(1600, Math.ceil(maxY + 300)),
    };
  }, [nodes]);

  // Handle Dragging Nodes on Canvas
  const handleMouseDownNode = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDraggedNodeId(id);
    setSelectedNodeId(id);
    setSelectedEdgeId(null);
  };

  const handleMouseMoveCanvas = (e: React.MouseEvent) => {
    if (draggedNodeId && svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left - pan.x) / zoom;
      const mouseY = (e.clientY - rect.top - pan.y) / zoom;
      setCustomNodePositions((prev) => ({
        ...prev,
        [draggedNodeId]: { x: mouseX, y: mouseY },
      }));
    } else if (isPanning) {
      setPan({
        x: e.clientX - startPanPos.x,
        y: e.clientY - startPanPos.y,
      });
    }
  };

  const handleMouseUpCanvas = () => {
    setDraggedNodeId(null);
    setIsPanning(false);
  };

  const handleStartPan = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement | SVGElement;
    const isInteractive = target.closest('.group') || target.closest('button') || target.closest('select') || target.closest('input');
    if (!isInteractive) {
      setIsPanning(true);
      setStartPanPos({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
    }
  };

  const handleZoomIn = () => {
    if (svgRef.current && zoomBehaviorRef.current) {
      select(svgRef.current).call(zoomBehaviorRef.current.scaleBy, 1.25);
    } else {
      setZoom((z) => Math.min(4, z * 1.25));
    }
  };

  const handleZoomOut = () => {
    if (svgRef.current && zoomBehaviorRef.current) {
      select(svgRef.current).call(zoomBehaviorRef.current.scaleBy, 0.8);
    } else {
      setZoom((z) => Math.max(0.2, z * 0.8));
    }
  };

  const handleResetView = () => {
    if (svgRef.current && zoomBehaviorRef.current) {
      select(svgRef.current).call(zoomBehaviorRef.current.transform, zoomIdentity);
    } else {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
    setCustomNodePositions({});
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  };

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden select-none">
      {/* Top Filter & Control Panel Bar */}
      <div className={`p-3 border-b ${borderClass} ${cardBgClass} flex flex-wrap items-center justify-between gap-3 text-xs z-20`}>
        {/* Mode Selector Tabs */}
        <div className={`flex items-center p-0.5 rounded-lg border ${borderClass} bg-black/5 dark:bg-white/5`}>
          <button
            onClick={() => {
              setViewMode('concept');
              setSelectedNodeId(null);
            }}
            className={`px-3 py-1.5 rounded-md font-medium transition-all ${
              viewMode === 'concept'
                ? 'bg-sky-600 text-white shadow-xs'
                : `${textSecondaryClass} hover:${textPrimaryClass}`
            }`}
          >
            Concept Graph ({concepts.filter((c) => filterState.includeExpired || c.expired_at === null).length})
          </button>
          <button
            onClick={() => {
              setViewMode('representation');
              setSelectedNodeId(null);
            }}
            className={`px-3 py-1.5 rounded-md font-medium transition-all ${
              viewMode === 'representation'
                ? 'bg-sky-600 text-white shadow-xs'
                : `${textSecondaryClass} hover:${textPrimaryClass}`
            }`}
          >
            Representation Graph ({representations.filter((r) => filterState.includeExpired || r.expired_at === null).length})
          </button>
          <button
            onClick={() => {
              setViewMode('subsystem_map');
              setSelectedNodeId(null);
            }}
            className={`px-3 py-1.5 rounded-md font-medium transition-all ${
              viewMode === 'subsystem_map'
                ? 'bg-sky-600 text-white shadow-xs'
                : `${textSecondaryClass} hover:${textPrimaryClass}`
            }`}
          >
            Subsystem Architecture
          </button>
        </div>

        {/* Real-time Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Subsystem Filter */}
          {(viewMode === 'representation' || viewMode === 'subsystem_map') && (
            <div className="flex items-center gap-1.5">
              <span className={textSecondaryClass}>Subsystem:</span>
              <select
                value={filterState.selectedSubsystemId}
                onChange={(e) =>
                  onFilterChange({
                    selectedSubsystemId: e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10),
                  })
                }
                className={`px-2 py-1 rounded-md border ${borderClass} bg-black/5 dark:bg-white/5 text-xs font-mono focus:outline-hidden ${textPrimaryClass}`}
              >
                <option value="all">All Subsystems</option>
                {subsystems.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} (#{s.id})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Relationship Type Filter */}
          <div className="flex items-center gap-1.5">
            <span className={textSecondaryClass}>Edge Type:</span>
            <select
              value={filterState.selectedRelType}
              onChange={(e) => onFilterChange({ selectedRelType: e.target.value })}
              className={`px-2 py-1 rounded-md border ${borderClass} bg-black/5 dark:bg-white/5 text-xs font-mono focus:outline-hidden ${textPrimaryClass}`}
            >
              <option value="all">All (31 vocabulary types)</option>
              {relationshipTypes.map((rt) => (
                <option key={rt.name} value={rt.name}>
                  {rt.name}
                </option>
              ))}
            </select>
          </div>

          {/* Path Status Filter (For Concepts) */}
          {viewMode === 'concept' && (
            <div className="flex items-center gap-1.5">
              <span className={textSecondaryClass}>Path:</span>
              <div className={`flex items-center p-0.5 rounded-md border ${borderClass} bg-black/5 dark:bg-white/5`}>
                <button
                  onClick={() => onFilterChange({ pathFilter: 'all' })}
                  className={`px-2 py-0.5 text-[11px] rounded-xs ${
                    filterState.pathFilter === 'all' ? 'bg-sky-600 text-white' : textSecondaryClass
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => onFilterChange({ pathFilter: 'green' })}
                  className={`px-2 py-0.5 text-[11px] rounded-xs font-medium ${
                    filterState.pathFilter === 'green' ? 'bg-emerald-600 text-white' : 'text-emerald-400'
                  }`}
                >
                  Green
                </button>
                <button
                  onClick={() => onFilterChange({ pathFilter: 'red' })}
                  className={`px-2 py-0.5 text-[11px] rounded-xs font-medium ${
                    filterState.pathFilter === 'red' ? 'bg-rose-600 text-white' : 'text-rose-400'
                  }`}
                >
                  Red
                </button>
                <button
                  onClick={() => onFilterChange({ pathFilter: 'orange' })}
                  className={`px-2 py-0.5 text-[11px] rounded-xs font-medium ${
                    filterState.pathFilter === 'orange' ? 'bg-amber-600 text-white' : 'text-amber-400'
                  }`}
                >
                  Orange
                </button>
              </div>
            </div>
          )}

          {/* Confidence Score Threshold Slider */}
          <div className="flex items-center gap-2 px-2 py-0.5 rounded-md border border-zinc-700/50 bg-black/5 dark:bg-white/5">
            <span className={`text-[11px] ${textSecondaryClass}`}>Min Confidence:</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={filterState.minConfidence}
              onChange={(e) => onFilterChange({ minConfidence: parseFloat(e.target.value) })}
              className="w-16 accent-sky-500 cursor-pointer"
            />
            <span className="font-mono text-[11px] text-sky-400 font-semibold w-8">
              {Math.round(filterState.minConfidence * 100)}%
            </span>
          </div>

          {/* Include Expired Rows Checkbox */}
          <label className={`flex items-center gap-1.5 text-xs font-medium cursor-pointer ${textSecondaryClass}`}>
            <input
              type="checkbox"
              checked={filterState.includeExpired}
              onChange={(e) => onFilterChange({ includeExpired: e.target.checked })}
              className="rounded-xs border-zinc-600 text-sky-600 focus:ring-0"
            />
            <span>Include Expired History</span>
          </label>
        </div>

        {/* Canvas Zoom Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleZoomIn}
            className={`p-1.5 rounded-md border ${borderClass} hover:bg-black/5 dark:hover:bg-white/5 ${textSecondaryClass}`}
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={handleZoomOut}
            className={`p-1.5 rounded-md border ${borderClass} hover:bg-black/5 dark:hover:bg-white/5 ${textSecondaryClass}`}
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={handleResetView}
            className={`p-1.5 rounded-md border ${borderClass} hover:bg-black/5 dark:hover:bg-white/5 ${textSecondaryClass}`}
            title="Fit Canvas & Reset Layout"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Interactive SVG Canvas Area */}
      <div
        className="flex-1 w-full h-full relative bg-radial from-slate-900/50 to-slate-950/90 overflow-auto cursor-grab active:cursor-grabbing"
        onMouseDown={handleStartPan}
        onMouseMove={handleMouseMoveCanvas}
        onMouseUp={handleMouseUpCanvas}
      >
        <div
          className="relative min-w-full min-h-full"
          style={{
            width: `${canvasBounds.width}px`,
            height: `${canvasBounds.height}px`,
          }}
        >
          {/* Subtle Canvas Grid Background */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-15">
            <defs>
              <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                <path d="M 30 0 L 0 0 0 30" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-zinc-500" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>

          {/* Interactive Graph SVG Elements */}
          <svg
            ref={svgRef}
            className="w-full h-full absolute inset-0"
            style={{ overflow: 'visible' }}
          >
          <defs>
            {/* Directional Arrow Markers for Edges */}
            <marker id="arrow-sky" viewBox="0 0 10 10" refX="24" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#38bdf8" />
            </marker>
            <marker id="arrow-emerald" viewBox="0 0 10 10" refX="24" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#10b981" />
            </marker>
            <marker id="arrow-rose" viewBox="0 0 10 10" refX="24" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#f43f5e" />
            </marker>
            <marker id="arrow-amber" viewBox="0 0 10 10" refX="24" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#f59e0b" />
            </marker>
          </defs>

          {/* Transformed Canvas Scene Group */}
          <g transform={`translate(${pan.x}px, ${pan.y}px) scale(${zoom})`}>
            {/* Render Relationship Edges */}
            {edges.map((edge) => {
              const isSelected = selectedEdgeId === edge.id;
              const isNodeSelected = selectedNodeId === edge.from || selectedNodeId === edge.to;

              // Curve calculation between nodes
              const dx = edge.toPos.x - edge.fromPos.x;
              const dy = edge.toPos.y - edge.fromPos.y;
              const midX = (edge.fromPos.x + edge.toPos.x) / 2;
              const midY = (edge.fromPos.y + edge.toPos.y) / 2 - 25; // Slight arch

              // Color selection based on path status or confidence
              let strokeColor = '#38bdf8'; // sky
              let markerId = 'arrow-sky';

              if (edge.pathType === 'green') {
                strokeColor = '#10b981'; // emerald
                markerId = 'arrow-emerald';
              } else if (edge.pathType === 'red') {
                strokeColor = '#f43f5e'; // rose
                markerId = 'arrow-rose';
              } else if (edge.pathType === 'orange') {
                strokeColor = '#f59e0b'; // amber / orange
                markerId = 'arrow-amber';
              }

              return (
                <g key={edge.id} className="cursor-pointer group" onClick={() => setSelectedEdgeId(edge.id)}>
                  {/* Curve path line */}
                  <path
                    d={`M ${edge.fromPos.x} ${edge.fromPos.y} Q ${midX} ${midY} ${edge.toPos.x} ${edge.toPos.y}`}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={isSelected || isNodeSelected ? 3 : 1.5}
                    strokeDasharray={edge.isExpired ? '4,4' : undefined}
                    opacity={edge.isExpired ? 0.4 : isNodeSelected || isSelected ? 1 : 0.75}
                    markerEnd={`url(#${markerId})`}
                    className="transition-all hover:opacity-100 hover:stroke-width-2"
                  />

                  {/* Edge Label Tag pill in middle */}
                  <g transform={`translate(${midX}, ${midY})`}>
                    <rect
                      x="-45"
                      y="-11"
                      width="90"
                      height="22"
                      rx="11"
                      fill="#0f172a"
                      stroke={strokeColor}
                      strokeWidth="1"
                      opacity="0.9"
                    />
                    <text
                      x="0"
                      y="3"
                      textAnchor="middle"
                      fill="#e2e8f0"
                      fontSize="10"
                      fontFamily="monospace"
                      fontWeight="600"
                    >
                      {edge.relType}
                    </text>
                    {edge.confidence !== undefined && (
                      <circle cx="36" cy="0" r="4" fill={edge.confidence >= 0.9 ? '#10b981' : '#f59e0b'} />
                    )}
                  </g>
                </g>
              );
            })}

            {/* Render Graph Nodes */}
            {nodes.map((node) => {
              const isSelected = selectedNodeId === node.id;
              const subColor = node.subsystemId !== undefined ? subsystemColors[node.subsystemId] : null;

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  onMouseDown={(e) => handleMouseDownNode(e, node.id)}
                  className="cursor-grab active:cursor-grabbing group"
                >
                  {/* Node Box / Card Container */}
                  <rect
                    x="-85"
                    y="-32"
                    width="170"
                    height="64"
                    rx="10"
                    fill={isSelected ? '#1e293b' : '#0f172a'}
                    stroke={isSelected ? '#38bdf8' : subColor ? subColor.stroke : '#475569'}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                    opacity={node.isExpired ? 0.5 : 0.95}
                    className="shadow-xl transition-all"
                  />

                  {/* Subsystem Color Accent Top Pill */}
                  {node.subsystemName && (
                    <rect
                      x="-85"
                      y="-32"
                      width="170"
                      height="4"
                      rx="2"
                      fill={subColor?.stroke || '#0ea5e9'}
                    />
                  )}

                  {/* Node Label Text */}
                  <text
                    x="0"
                    y="-10"
                    textAnchor="middle"
                    fill="#f8fafc"
                    fontSize="12"
                    fontWeight="600"
                    className={node.isExpired ? 'line-through opacity-70' : ''}
                  >
                    {node.label.length > 20 ? `${node.label.slice(0, 18)}...` : node.label}
                  </text>

                  {/* Subtitle / Subsystem Tag */}
                  <text x="0" y="8" textAnchor="middle" fill="#94a3b8" fontSize="10" fontFamily="monospace">
                    {node.subtitle ? (node.subtitle.length > 22 ? `${node.subtitle.slice(0, 20)}...` : node.subtitle) : node.type}
                  </text>

                  {/* Expired / Active Status Badge */}
                  <g transform="translate(0, 20)">
                    {node.isExpired ? (
                      <text x="0" y="0" textAnchor="middle" fill="#f43f5e" fontSize="9" fontWeight="bold">
                        EXPIRED
                      </text>
                    ) : (
                      <text x="0" y="0" textAnchor="middle" fill="#38bdf8" fontSize="9" fontWeight="bold">
                        {node.subsystemName || node.type.toUpperCase()}
                      </text>
                    )}
                  </g>
                </g>
              );
            })}
          </g>
        </svg>
        </div>

        {/* Empty Canvas Prompt if no items match filters */}
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-zinc-400">
            <Filter className="w-10 h-10 mb-2 opacity-50 text-sky-400" />
            <p className="text-sm font-medium">No nodes match the current filter criteria</p>
            <p className="text-xs text-zinc-500 mt-1 max-w-sm">
              Try adjusting the minimum confidence threshold, enabling expired rows, or clearing the search query.
            </p>
          </div>
        )}
      </div>

      {/* Selected Node Details & Action Drawer */}
      {selectedNode && (
        <div className={`absolute right-4 top-16 bottom-4 w-80 p-4 border ${borderClass} ${cardBgClass} rounded-2xl shadow-2xl overflow-y-auto flex flex-col justify-between z-30 transition-all`}>
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  {selectedNode.type}
                </span>
                <h3 className={`text-base font-semibold mt-1 ${textPrimaryClass}`}>
                  {selectedNode.label}
                </h3>
              </div>
              <button
                onClick={() => setSelectedNodeId(null)}
                className={`p-1 rounded-md text-xs ${textSecondaryClass} hover:${textPrimaryClass}`}
              >
                ✕
              </button>
            </div>

            {/* Subtitle / Details */}
            <div className="space-y-2 text-xs font-mono">
              <div className="p-2 rounded-lg bg-black/10 dark:bg-white/5 border border-zinc-700/40">
                <span className={textSecondaryClass}>UUID Primary Key:</span>
                <div className="text-sky-300 break-all text-[11px] font-semibold mt-0.5">{selectedNode.id}</div>
              </div>

              {selectedNode.subtitle && (
                <div className="p-2 rounded-lg bg-black/10 dark:bg-white/5 border border-zinc-700/40">
                  <span className={textSecondaryClass}>Schema Mapping:</span>
                  <div className="text-emerald-400 text-[11px] font-semibold mt-0.5">{selectedNode.subtitle}</div>
                </div>
              )}

              {selectedNode.subsystemName && (
                <div className="p-2 rounded-lg bg-black/10 dark:bg-white/5 border border-zinc-700/40">
                  <span className={textSecondaryClass}>Owning Subsystem:</span>
                  <div className="text-indigo-300 text-[11px] font-semibold mt-0.5">
                    {selectedNode.subsystemName} (#{selectedNode.subsystemId})
                  </div>
                </div>
              )}

              <div className="p-2 rounded-lg bg-black/10 dark:bg-white/5 border border-zinc-700/40 flex items-center justify-between">
                <span className={textSecondaryClass}>Lifecycle Status:</span>
                <span
                  className={`text-[11px] font-bold uppercase ${
                    selectedNode.isExpired ? 'text-rose-400' : 'text-emerald-400'
                  }`}
                >
                  {selectedNode.isExpired ? 'EXPIRED' : 'ACTIVE'}
                </span>
              </div>
            </div>

            {/* Connected Relationships List */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <ArrowRight className="w-3.5 h-3.5 text-sky-400" />
                <span>Connected Edges ({edges.filter((e) => e.from === selectedNode.id || e.to === selectedNode.id).length})</span>
              </div>

              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {edges
                  .filter((e) => e.from === selectedNode.id || e.to === selectedNode.id)
                  .map((e) => {
                    const isOutgoing = e.from === selectedNode.id;
                    const otherNode = isOutgoing ? e.toPos : e.fromPos;
                    return (
                      <div
                        key={e.id}
                        onClick={() => setSelectedEdgeId(e.id)}
                        className={`p-2 rounded-md border text-[11px] cursor-pointer transition-all ${
                          selectedEdgeId === e.id
                            ? 'border-sky-500 bg-sky-500/10'
                            : 'border-zinc-700/50 bg-black/5 dark:bg-white/5 hover:border-zinc-500'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-sky-400 font-semibold">{e.relType}</span>
                          <span className="text-[10px] text-zinc-400">{isOutgoing ? '→ Outgoing' : '← Incoming'}</span>
                        </div>
                        <div className="text-zinc-300 truncate mt-0.5">{otherNode.label}</div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* Action Buttons for Guided Append-Only Editing */}
          <div className="space-y-2 pt-3 border-t border-zinc-700/50">
            <button
              onClick={() => onEditNode(selectedNode.type, selectedNode.id)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg bg-sky-600 hover:bg-sky-500 text-white transition-colors shadow-xs"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Supersede Node (Append Edit)</span>
            </button>

            <button
              onClick={() => onAddRelationship(selectedNode.id, selectedNode.type)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Connected Relationship</span>
            </button>

            <button
              onClick={() => onSoftDeleteNode(selectedNode.type, selectedNode.id)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Soft Delete (Expire)</span>
            </button>
          </div>
        </div>
      )}

      {/* Selected Edge Details Drawer */}
      {selectedEdge && !selectedNode && (
        <div className={`absolute right-4 top-16 w-80 p-4 border ${borderClass} ${cardBgClass} rounded-2xl shadow-2xl space-y-3 z-30`}>
          <div className="flex items-center justify-between border-b border-zinc-700/50 pb-2">
            <div>
              <span className="text-[10px] font-mono uppercase text-sky-400">Relationship Edge</span>
              <h4 className="text-sm font-bold text-zinc-100 font-mono">{selectedEdge.relType}</h4>
            </div>
            <button onClick={() => setSelectedEdgeId(null)} className="text-zinc-400 hover:text-white">
              ✕
            </button>
          </div>

          <div className="space-y-2 text-xs">
            <div className="p-2 rounded-md bg-black/10 dark:bg-white/5 border border-zinc-700/40">
              <span className={textSecondaryClass}>Source Node:</span>
              <div className="font-semibold text-sky-300">{selectedEdge.fromPos.label}</div>
            </div>

            <div className="p-2 rounded-md bg-black/10 dark:bg-white/5 border border-zinc-700/40">
              <span className={textSecondaryClass}>Target Node:</span>
              <div className="font-semibold text-emerald-300">{selectedEdge.toPos.label}</div>
            </div>

            {selectedEdge.confidence !== undefined && (
              <div className="p-2 rounded-md bg-black/10 dark:bg-white/5 border border-zinc-700/40 flex items-center justify-between">
                <span className={textSecondaryClass}>Evidence Confidence:</span>
                <span className="font-mono font-bold text-emerald-400">{Math.round(selectedEdge.confidence * 100)}%</span>
              </div>
            )}

            {/* Evidence items supporting this claim */}
            <div className="pt-2 border-t border-zinc-700/50 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-zinc-300">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Supporting Evidence Claims
                </span>
                {edgeEvidence && (
                  <span className="text-[10px] font-mono text-zinc-400">({edgeEvidence.length})</span>
                )}
              </div>

              {loadingEvidence && (
                <div className="text-[11px] text-zinc-400 font-mono py-2 animate-pulse">
                  Loading relationship evidence claims...
                </div>
              )}

              {!loadingEvidence && edgeEvidence && edgeEvidence.length === 0 && (
                <div className="text-[11px] text-zinc-500 italic py-1">
                  No linked evidence claims found.
                </div>
              )}

              {!loadingEvidence && edgeEvidence && edgeEvidence.length > 0 && (
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {edgeEvidence.map((ev) => (
                    <div
                      key={ev.statementEvidenceId}
                      className="p-2 rounded-lg bg-black/20 dark:bg-white/5 border border-zinc-700/50 space-y-1 text-[11px]"
                    >
                      <div className="flex items-center justify-between">
                        <span className="px-1.5 py-0.5 rounded-xs text-[9px] font-bold uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          {ev.role}
                        </span>
                        {ev.strength !== null && ev.strength !== undefined && (
                          <span className="text-[10px] font-mono text-emerald-400 font-semibold">
                            {Math.round(ev.strength * 100)}% strength
                          </span>
                        )}
                      </div>

                      {ev.comment && (
                        <p className="text-zinc-300 text-[11px] leading-tight mt-0.5">{ev.comment}</p>
                      )}

                      {ev.evidenceItem && (
                        <div className="mt-1 pt-1 border-t border-zinc-700/30 text-[10px] text-zinc-400 space-y-0.5 font-mono">
                          <div className="flex items-center justify-between">
                            <span className="text-sky-400 font-semibold">{ev.evidenceItem.evidenceType}</span>
                            <span className="text-zinc-500 text-[9px]">{ev.evidenceItem.origin}</span>
                          </div>
                          {ev.evidenceItem.uri && (
                            <div className="truncate text-zinc-300 bg-black/30 p-1 rounded-xs font-mono">
                              {ev.evidenceItem.uri}
                            </div>
                          )}
                          {ev.evidenceItem.excerpt && (
                            <div className="text-zinc-400 italic font-sans text-[10px] line-clamp-2 mt-0.5">
                              "{ev.evidenceItem.excerpt}"
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
