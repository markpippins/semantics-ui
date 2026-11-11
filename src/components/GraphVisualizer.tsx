import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { select } from 'd3-selection';
import { zoom as d3Zoom, zoomIdentity, ZoomBehavior } from 'd3-zoom';
import {
  forceSimulation,
  forceManyBody,
  forceCenter,
  forceLink,
  forceCollide,
  forceX,
  forceY,
  SimulationNodeDatum,
  SimulationLinkDatum,
} from 'd3-force';
import {
  Concept,
  ConceptRelationship,
  GraphViewMode,
  GraphLayoutMode,
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
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Route,
  ArrowUpDown,
  LayoutGrid,
  Network,
  Boxes,
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
  const [highlightConnected, setHighlightConnected] = useState<boolean>(true);
  const [layoutMode, setLayoutMode] = useState<GraphLayoutMode>('organic');
  const [clusterBySubsystem, setClusterBySubsystem] = useState<boolean>(false);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [customNodePositions, setCustomNodePositions] = useState<Record<string, { x: number; y: number }>>({});

  // Shortest Path Finder state
  const [pathFinderOpen, setPathFinderOpen] = useState<boolean>(false);
  const [startNodeId, setStartNodeId] = useState<string | null>(null);
  const [endNodeId, setEndNodeId] = useState<string | null>(null);
  const [pathDirectionMode, setPathDirectionMode] = useState<'undirected' | 'directed'>('undirected');
  const [pickingTarget, setPickingTarget] = useState<'start' | 'end' | null>(null);

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
      .scaleExtent([0.15, 4])
      .filter((event) => {
        if (event.type === 'wheel') return true;
        const target = event.target as HTMLElement | SVGElement;
        if (
          target.closest &&
          (target.closest('[data-node-drag]') ||
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

  // Compute Nodes and Edges for the active viewMode, layoutMode, and filterState
  const { nodes, edges } = useMemo(() => {
    let nodeItems: NodePos[] = [];
    let edgeItems: EdgePos[] = [];

    // Filter concepts/representations by search and includeExpired
    const isNodeActive = (n: { expired_at: string | null }) => filterState.includeExpired || n.expired_at === null;

    type RawBaseNode = {
      id: string;
      label: string;
      subtitle?: string;
      subsystemId?: number;
      subsystemName?: string;
      isExpired: boolean;
      type: 'concept' | 'representation';
      raw: Concept | Representation;
    };

    type RawBaseEdge = {
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
      raw: ConceptRelationship | RepresentationRelationship;
    };

    let baseNodes: RawBaseNode[] = [];
    let rawEdges: RawBaseEdge[] = [];

    if (viewMode === 'concept') {
      const activeConcepts = concepts.filter(isNodeActive);
      const activeCR = conceptRelationships.filter((cr) => {
        if (!filterState.includeExpired && cr.expired_at !== null) return false;
        if (filterState.selectedRelType !== 'all' && cr.relationship_type !== filterState.selectedRelType) return false;
        if (filterState.pathFilter !== 'all' && cr.path !== filterState.pathFilter) return false;
        if (cr.confidence !== undefined && cr.confidence < filterState.minConfidence) return false;
        return true;
      });

      baseNodes = activeConcepts.map((c) => {
        const rep = representations.find(
          (r) => r.concept_id === c.id && (filterState.includeExpired || r.expired_at === null)
        ) || representations.find((r) => r.concept_id === c.id);
        const sub = rep ? subsystems.find((s) => s.id === rep.owning_subsystem_id) : undefined;
        return {
          id: c.id,
          label: c.name,
          subtitle: c.description,
          subsystemId: rep ? rep.owning_subsystem_id : undefined,
          subsystemName: sub ? sub.name : (rep ? `Subsystem #${rep.owning_subsystem_id}` : undefined),
          isExpired: c.expired_at !== null,
          type: 'concept',
          raw: c,
        };
      });

      rawEdges = activeCR.map((cr) => ({
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
        raw: cr,
      }));
    } else {
      // representation or subsystem_map
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

      // Sort representations when in subsystem_map mode, clustered mode, or grid layout to group by subsystem cleanly
      const sortedReps = [...activeReps];
      if (viewMode === 'subsystem_map' || clusterBySubsystem || layoutMode === 'grid') {
        sortedReps.sort((a, b) => {
          if (a.owning_subsystem_id !== b.owning_subsystem_id) {
            return a.owning_subsystem_id - b.owning_subsystem_id;
          }
          return a.label.localeCompare(b.label);
        });
      }

      baseNodes = sortedReps.map((r) => {
        const subName = subsystems.find((s) => s.id === r.owning_subsystem_id)?.name || `Subsystem #${r.owning_subsystem_id}`;
        return {
          id: r.id,
          label: r.label,
          subtitle: `${r.schema_name || 'public'}.${r.table_name || 'table'}`,
          subsystemId: r.owning_subsystem_id,
          subsystemName: subName,
          isExpired: r.expired_at !== null,
          type: 'representation',
          raw: r,
        };
      });

      rawEdges = activeRR.map((rr) => ({
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
        raw: rr,
      }));
    }

    // Layout coordinate calculation (Organic force-directed vs Grid matrix, with Subsystem Clustering support)
    const computedPositions = new Map<string, { x: number; y: number }>();
    const total = baseNodes.length;
    const centerX = 500;
    const centerY = 350;

    if (total > 0) {
      const shouldCluster = clusterBySubsystem || viewMode === 'subsystem_map';

      if (layoutMode === 'grid') {
        if (shouldCluster) {
          // Grid Layout Clustered by Subsystem:
          // Group nodes by subsystem into distinct cluster blocks with clear separation
          const subGroups = new Map<number, RawBaseNode[]>();
          baseNodes.forEach((n) => {
            const sKey = n.subsystemId !== undefined ? n.subsystemId : -1;
            if (!subGroups.has(sKey)) subGroups.set(sKey, []);
            subGroups.get(sKey)!.push(n);
          });

          const blockEntries = Array.from(subGroups.entries());
          const numBlocks = blockEntries.length;
          const blocksPerRow = Math.min(3, Math.max(1, Math.ceil(Math.sqrt(numBlocks))));
          const colSpacing = 220;
          const rowSpacing = 130;
          const blockGutterX = 90;
          const blockGutterY = 110;

          const blockMeta = blockEntries.map(([sKey, gNodes]) => {
            const count = gNodes.length;
            const bCols = Math.min(3, Math.max(1, Math.ceil(Math.sqrt(count))));
            const bRows = Math.ceil(count / bCols);
            const bWidth = (bCols - 1) * colSpacing;
            const bHeight = (bRows - 1) * rowSpacing;
            return { sKey, nodes: gNodes, cols: bCols, rows: bRows, width: bWidth, height: bHeight };
          });

          const rowHeights: number[] = [];
          const colWidths: number[] = [];
          blockMeta.forEach((bm, idx) => {
            const r = Math.floor(idx / blocksPerRow);
            const c = idx % blocksPerRow;
            rowHeights[r] = Math.max(rowHeights[r] || 0, bm.height);
            colWidths[c] = Math.max(colWidths[c] || 0, bm.width);
          });

          const totalGridW = colWidths.reduce((a, b) => a + b, 0) + (blocksPerRow - 1) * (colSpacing + blockGutterX);
          const totalGridH = rowHeights.reduce((a, b) => a + b, 0) + (rowHeights.length - 1) * (rowSpacing + blockGutterY);
          const startGridX = centerX - totalGridW / 2;
          const startGridY = centerY - totalGridH / 2;

          let currentY = startGridY;
          for (let r = 0; r < rowHeights.length; r++) {
            let currentX = startGridX;
            for (let c = 0; c < blocksPerRow; c++) {
              const bIdx = r * blocksPerRow + c;
              if (bIdx < blockMeta.length) {
                const bm = blockMeta[bIdx];
                bm.nodes.forEach((node, nIdx) => {
                  const nCol = nIdx % bm.cols;
                  const nRow = Math.floor(nIdx / bm.cols);
                  computedPositions.set(node.id, {
                    x: currentX + nCol * colSpacing,
                    y: currentY + nRow * rowSpacing,
                  });
                });
              }
              currentX += (colWidths[c] || 0) + colSpacing + blockGutterX;
            }
            currentY += (rowHeights[r] || 0) + rowSpacing + blockGutterY;
          }
        } else {
          // Standard Grid Matrix Layout
          const cols = Math.min(6, Math.max(2, Math.ceil(Math.sqrt(total * 1.35))));
          const rows = Math.ceil(total / cols);
          const colSpacing = 240;
          const rowSpacing = 140;
          const startX = centerX - ((cols - 1) * colSpacing) / 2;
          const startY = centerY - ((rows - 1) * rowSpacing) / 2;

          baseNodes.forEach((node, idx) => {
            const col = idx % cols;
            const row = Math.floor(idx / cols);
            computedPositions.set(node.id, {
              x: startX + col * colSpacing,
              y: startY + row * rowSpacing,
            });
          });
        }
      } else {
        // Organic Force-Directed Layout:
        interface SimNode extends SimulationNodeDatum {
          id: string;
          subsystemId?: number;
          x?: number;
          y?: number;
        }

        interface SimLink extends SimulationLinkDatum<SimNode> {
          source: string | SimNode;
          target: string | SimNode;
        }

        const subsInUse = Array.from(
          new Set(
            baseNodes.map((n) => (n.subsystemId !== undefined ? n.subsystemId : -1))
          )
        );
        const subCount = subsInUse.length;
        const subClusterCenters = new Map<number, { cx: number; cy: number }>();
        const clusterRadius = Math.max(340, subCount * 110);

        if (shouldCluster && subCount > 0) {
          subsInUse.forEach((sId, idx) => {
            if (subCount === 1) {
              subClusterCenters.set(sId, { cx: centerX, cy: centerY });
            } else {
              const angle = (idx / subCount) * 2 * Math.PI - Math.PI / 2;
              subClusterCenters.set(sId, {
                cx: centerX + clusterRadius * Math.cos(angle),
                cy: centerY + (clusterRadius * 0.72) * Math.sin(angle),
              });
            }
          });
        }

        const simNodes: SimNode[] = baseNodes.map((n, idx) => {
          const sKey = n.subsystemId !== undefined ? n.subsystemId : -1;
          if (shouldCluster && subClusterCenters.has(sKey)) {
            const sc = subClusterCenters.get(sKey)!;
            const offsetAngle = (idx * 1.5) % (2 * Math.PI);
            return {
              id: n.id,
              subsystemId: n.subsystemId,
              x: sc.cx + 70 * Math.cos(offsetAngle),
              y: sc.cy + 70 * Math.sin(offsetAngle),
            };
          }
          const angle = (idx / (total || 1)) * 2 * Math.PI - Math.PI / 2;
          const radius = Math.max(260, total * 32);
          return {
            id: n.id,
            subsystemId: n.subsystemId,
            x: centerX + radius * Math.cos(angle),
            y: centerY + (radius * 0.72) * Math.sin(angle),
          };
        });

        const nodeIdSet = new Set(simNodes.map((n) => n.id));
        const validLinks: SimLink[] = rawEdges
          .filter((e) => nodeIdSet.has(e.from) && nodeIdSet.has(e.to))
          .map((e) => ({
            source: e.from,
            target: e.to,
          }));

        const simulation = forceSimulation<SimNode>(simNodes)
          .force('charge', forceManyBody().strength(shouldCluster ? -850 : -1100))
          .force('center', forceCenter(centerX, centerY))
          .force(
            'link',
            forceLink<SimNode, SimLink>(validLinks)
              .id((d) => d.id)
              .distance(shouldCluster ? 170 : 210)
              .strength(shouldCluster ? 0.35 : 0.65)
          )
          .force('collide', forceCollide().radius(115).iterations(3));

        if (shouldCluster) {
          simulation
            .force(
              'clusterX',
              forceX<SimNode>((d) => {
                const sKey = d.subsystemId !== undefined ? d.subsystemId : -1;
                return subClusterCenters.get(sKey)?.cx ?? centerX;
              }).strength(0.6)
            )
            .force(
              'clusterY',
              forceY<SimNode>((d) => {
                const sKey = d.subsystemId !== undefined ? d.subsystemId : -1;
                return subClusterCenters.get(sKey)?.cy ?? centerY;
              }).strength(0.6)
            );
        }

        simulation.stop();
        for (let i = 0; i < 220; ++i) {
          simulation.tick();
        }

        simNodes.forEach((sn) => {
          computedPositions.set(sn.id, {
            x: sn.x ?? centerX,
            y: sn.y ?? centerY,
          });
        });
      }
    }

    // Materialize positioned node items
    nodeItems = baseNodes.map((bn) => {
      const customPos = customNodePositions[bn.id];
      const defaultPos = computedPositions.get(bn.id) || { x: centerX, y: centerY };
      return {
        ...bn,
        x: customPos ? customPos.x : defaultPos.x,
        y: customPos ? customPos.y : defaultPos.y,
      };
    });

    const nodeMap = new Map(nodeItems.map((n) => [n.id, n]));

    // Materialize edges with connected node coordinates
    edgeItems = rawEdges
      .map((e) => {
        const fromPos = nodeMap.get(e.from);
        const toPos = nodeMap.get(e.to);
        if (!fromPos || !toPos) return null;
        return {
          ...e,
          fromPos,
          toPos,
        };
      })
      .filter(Boolean) as EdgePos[];

    // Apply global text search filter on node label / subtitle / notes
    if (filterState.searchQuery.trim()) {
      const q = filterState.searchQuery.toLowerCase();
      const matchedNodeIds = new Set(
        nodeItems
          .filter(
            (n) =>
              n.label.toLowerCase().includes(q) ||
              n.subtitle?.toLowerCase().includes(q)
          )
          .map((n) => n.id)
      );

      nodeItems = nodeItems.map((n) => ({
        ...n,
        highlighted: matchedNodeIds.has(n.id),
      })) as any[];
    }

    return { nodes: nodeItems, edges: edgeItems };
  }, [
    viewMode,
    layoutMode,
    clusterBySubsystem,
    concepts,
    conceptRelationships,
    representations,
    representationRelationships,
    subsystems,
    filterState,
    customNodePositions,
  ]);

  // Calculate bounding hulls / enclosures for subsystem visual grouping
  const clusterGroups = useMemo(() => {
    const shouldShow = clusterBySubsystem || viewMode === 'subsystem_map';
    if (!shouldShow || nodes.length === 0) return [];

    const groupsMap = new Map<
      number | 'unassigned',
      {
        subsystemId?: number;
        subsystemName: string;
        nodes: NodePos[];
      }
    >();

    nodes.forEach((n) => {
      const key = n.subsystemId !== undefined ? n.subsystemId : 'unassigned';
      if (!groupsMap.has(key)) {
        groupsMap.set(key, {
          subsystemId: n.subsystemId,
          subsystemName:
            n.subsystemName ||
            (n.subsystemId !== undefined ? `Subsystem #${n.subsystemId}` : 'Shared Domain Core'),
          nodes: [],
        });
      }
      groupsMap.get(key)!.nodes.push(n);
    });

    return Array.from(groupsMap.values()).map((g) => {
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;

      g.nodes.forEach((n) => {
        minX = Math.min(minX, n.x - 85);
        maxX = Math.max(maxX, n.x + 85);
        minY = Math.min(minY, n.y - 32);
        maxY = Math.max(maxY, n.y + 32);
      });

      const paddingX = 32;
      const paddingTop = 46;
      const paddingBottom = 26;
      const subColor = g.subsystemId !== undefined ? subsystemColors[g.subsystemId] : undefined;

      return {
        key: g.subsystemId !== undefined ? `sub-${g.subsystemId}` : 'sub-unassigned',
        subsystemId: g.subsystemId,
        subsystemName: g.subsystemName,
        nodeCount: g.nodes.length,
        x: minX - paddingX,
        y: minY - paddingTop,
        width: Math.max(220, maxX - minX + paddingX * 2),
        height: Math.max(120, maxY - minY + paddingTop + paddingBottom),
        strokeColor: subColor?.stroke || '#818cf8',
      };
    });
  }, [clusterBySubsystem, viewMode, nodes, subsystemColors]);

  // Selected Node detailed item lookup
  const selectedNode = useMemo(() => {
    return nodes.find((n) => n.id === selectedNodeId) || null;
  }, [nodes, selectedNodeId]);

  // Selected Edge detailed item lookup
  const selectedEdge = useMemo(() => {
    return edges.find((e) => e.id === selectedEdgeId) || null;
  }, [edges, selectedEdgeId]);

  // Compute connected nodes and edges when a node or relationship is selected
  const { connectedNodeIds, connectedEdgeIds, isFocusActive } = useMemo(() => {
    if (!highlightConnected) {
      return {
        connectedNodeIds: new Set<string>(),
        connectedEdgeIds: new Set<string>(),
        isFocusActive: false,
      };
    }

    if (selectedNodeId) {
      const nodeIds = new Set<string>([selectedNodeId]);
      const edgeIds = new Set<string>();

      edges.forEach((edge) => {
        if (edge.from === selectedNodeId || edge.to === selectedNodeId) {
          edgeIds.add(edge.id);
          nodeIds.add(edge.from);
          nodeIds.add(edge.to);
        }
      });

      return {
        connectedNodeIds: nodeIds,
        connectedEdgeIds: edgeIds,
        isFocusActive: true,
      };
    }

    if (selectedEdgeId) {
      const edge = edges.find((e) => e.id === selectedEdgeId);
      if (edge) {
        const nodeIds = new Set<string>([edge.from, edge.to]);
        const edgeIds = new Set<string>([edge.id]);
        return {
          connectedNodeIds: nodeIds,
          connectedEdgeIds: edgeIds,
          isFocusActive: true,
        };
      }
    }

    return {
      connectedNodeIds: new Set<string>(),
      connectedEdgeIds: new Set<string>(),
      isFocusActive: false,
    };
  }, [highlightConnected, selectedNodeId, selectedEdgeId, edges]);

  // Compute Shortest Path between startNodeId and endNodeId using BFS
  const shortestPathResult = useMemo<{
    found: boolean;
    nodeIds: string[];
    edgeIds: string[];
    steps: Array<{
      fromNodeId: string;
      toNodeId: string;
      edgeId: string;
      relType: string;
      isForward: boolean;
    }>;
    hops: number;
  } | null>(() => {
    if (!startNodeId || !endNodeId) return null;

    if (startNodeId === endNodeId) {
      return {
        found: true,
        nodeIds: [startNodeId],
        edgeIds: [],
        steps: [],
        hops: 0,
      };
    }

    // Build adjacency mapping for fast traversal
    const adj = new Map<
      string,
      Array<{ neighborId: string; edgeId: string; relType: string; isForward: boolean }>
    >();

    nodes.forEach((n) => {
      adj.set(n.id, []);
    });

    edges.forEach((edge) => {
      if (adj.has(edge.from)) {
        adj.get(edge.from)!.push({
          neighborId: edge.to,
          edgeId: edge.id,
          relType: edge.relType,
          isForward: true,
        });
      }

      // If undirected traversal is active, allow traversing edge in reverse
      if (pathDirectionMode === 'undirected' && adj.has(edge.to)) {
        adj.get(edge.to)!.push({
          neighborId: edge.from,
          edgeId: edge.id,
          relType: edge.relType,
          isForward: false,
        });
      }
    });

    interface QueueItem {
      nodeId: string;
      pathNodes: string[];
      pathEdges: string[];
      steps: Array<{
        fromNodeId: string;
        toNodeId: string;
        edgeId: string;
        relType: string;
        isForward: boolean;
      }>;
    }

    const queue: QueueItem[] = [
      {
        nodeId: startNodeId,
        pathNodes: [startNodeId],
        pathEdges: [],
        steps: [],
      },
    ];

    const visited = new Set<string>([startNodeId]);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const neighbors = adj.get(current.nodeId) || [];

      for (const edgeInfo of neighbors) {
        if (!visited.has(edgeInfo.neighborId)) {
          const nextNodes = [...current.pathNodes, edgeInfo.neighborId];
          const nextEdges = [...current.pathEdges, edgeInfo.edgeId];
          const nextSteps = [
            ...current.steps,
            {
              fromNodeId: current.nodeId,
              toNodeId: edgeInfo.neighborId,
              edgeId: edgeInfo.edgeId,
              relType: edgeInfo.relType,
              isForward: edgeInfo.isForward,
            },
          ];

          if (edgeInfo.neighborId === endNodeId) {
            return {
              found: true,
              nodeIds: nextNodes,
              edgeIds: nextEdges,
              steps: nextSteps,
              hops: nextSteps.length,
            };
          }

          visited.add(edgeInfo.neighborId);
          queue.push({
            nodeId: edgeInfo.neighborId,
            pathNodes: nextNodes,
            pathEdges: nextEdges,
            steps: nextSteps,
          });
        }
      }
    }

    return {
      found: false,
      nodeIds: [],
      edgeIds: [],
      steps: [],
      hops: 0,
    };
  }, [startNodeId, endNodeId, nodes, edges, pathDirectionMode]);

  const isPathActive = Boolean(shortestPathResult && shortestPathResult.found);
  const pathNodeSet = useMemo(() => new Set(shortestPathResult?.nodeIds || []), [shortestPathResult]);
  const pathEdgeSet = useMemo(() => new Set(shortestPathResult?.edgeIds || []), [shortestPathResult]);

  const startNode = useMemo(() => nodes.find((n) => n.id === startNodeId) || null, [nodes, startNodeId]);
  const endNode = useMemo(() => nodes.find((n) => n.id === endNodeId) || null, [nodes, endNodeId]);

  // Fit view specifically to the nodes in the calculated shortest path
  const fitPathToScreen = useCallback(() => {
    if (!svgRef.current || !zoomBehaviorRef.current || !shortestPathResult?.found || shortestPathResult.nodeIds.length === 0) return;

    const pathNodes = nodes.filter((n) => pathNodeSet.has(n.id));
    if (pathNodes.length === 0) return;

    const svgRect = svgRef.current.getBoundingClientRect();
    const containerW = svgRect.width || 800;
    const containerH = svgRect.height || 600;

    const NODE_HALF_W = 85;
    const NODE_HALF_H = 32;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const n of pathNodes) {
      const left = n.x - NODE_HALF_W;
      const right = n.x + NODE_HALF_W;
      const top = n.y - NODE_HALF_H;
      const bottom = n.y + NODE_HALF_H;

      if (left < minX) minX = left;
      if (right > maxX) maxX = right;
      if (top < minY) minY = top;
      if (bottom > maxY) maxY = bottom;
    }

    const margin = 60;
    minX -= margin;
    maxX += margin;
    minY -= margin;
    maxY += margin;

    const bboxWidth = Math.max(120, maxX - minX);
    const bboxHeight = Math.max(120, maxY - minY);
    const bboxCenterX = (minX + maxX) / 2;
    const bboxCenterY = (minY + maxY) / 2;

    const padding = 40;
    const availableW = Math.max(100, containerW - padding * 2);
    const availableH = Math.max(100, containerH - padding * 2);

    const scaleX = availableW / bboxWidth;
    const scaleY = availableH / bboxHeight;
    const targetScale = Math.min(1.4, Math.max(0.2, Math.min(scaleX, scaleY)));

    const targetPanX = containerW / 2 - bboxCenterX * targetScale;
    const targetPanY = containerH / 2 - bboxCenterY * targetScale;

    const newTransform = zoomIdentity.translate(targetPanX, targetPanY).scale(targetScale);

    select(svgRef.current).call(zoomBehaviorRef.current.transform, newTransform);
    setPan({ x: targetPanX, y: targetPanY });
    setZoom(targetScale);
  }, [shortestPathResult, nodes, pathNodeSet]);

  // Calculate bounding box of all current nodes and fit entire graph into viewport
  const fitToScreen = useCallback(() => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;

    const svgRect = svgRef.current.getBoundingClientRect();
    const containerW = svgRect.width || 800;
    const containerH = svgRect.height || 600;

    if (nodes.length === 0) {
      const defaultTransform = zoomIdentity.translate(containerW / 2, containerH / 2).scale(1);
      select(svgRef.current).call(zoomBehaviorRef.current.transform, defaultTransform);
      setPan({ x: containerW / 2, y: containerH / 2 });
      setZoom(1);
      return;
    }

    // Node card dimensions: width=170, height=64 (centered at node.x, node.y)
    const NODE_HALF_W = 85;
    const NODE_HALF_H = 32;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const n of nodes) {
      const left = n.x - NODE_HALF_W;
      const right = n.x + NODE_HALF_W;
      const top = n.y - NODE_HALF_H;
      const bottom = n.y + NODE_HALF_H;

      if (left < minX) minX = left;
      if (right > maxX) maxX = right;
      if (top < minY) minY = top;
      if (bottom > maxY) maxY = bottom;
    }

    // Add margin around the bounding box so boundary nodes aren't clipped
    const margin = 40;
    minX -= margin;
    maxX += margin;
    minY -= margin;
    maxY += margin;

    const bboxWidth = Math.max(100, maxX - minX);
    const bboxHeight = Math.max(100, maxY - minY);
    const bboxCenterX = (minX + maxX) / 2;
    const bboxCenterY = (minY + maxY) / 2;

    const padding = 36;
    const availableW = Math.max(100, containerW - padding * 2);
    const availableH = Math.max(100, containerH - padding * 2);

    const scaleX = availableW / bboxWidth;
    const scaleY = availableH / bboxHeight;
    const targetScale = Math.min(1.2, Math.max(0.15, Math.min(scaleX, scaleY)));

    const targetPanX = containerW / 2 - bboxCenterX * targetScale;
    const targetPanY = containerH / 2 - bboxCenterY * targetScale;

    const newTransform = zoomIdentity.translate(targetPanX, targetPanY).scale(targetScale);

    select(svgRef.current).call(zoomBehaviorRef.current.transform, newTransform);
    setPan({ x: targetPanX, y: targetPanY });
    setZoom(targetScale);
  }, [nodes]);

  // Alias fitViewToNodes to fitToScreen for backward compatibility
  const fitViewToNodes = fitToScreen;

  // Auto-fit view when viewMode, layoutMode, or clusterBySubsystem changes or initial nodes load
  useEffect(() => {
    const timer = setTimeout(() => {
      fitToScreen();
    }, 60);
    return () => clearTimeout(timer);
  }, [viewMode, layoutMode, clusterBySubsystem, fitToScreen]);

  // Handle Dragging Nodes on Canvas
  const handleMouseDownNode = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();

    if (pickingTarget === 'start') {
      setStartNodeId(id);
      setPickingTarget(null);
      return;
    }

    if (pickingTarget === 'end') {
      setEndNodeId(id);
      setPickingTarget(null);
      return;
    }

    setDraggedNodeId(id);
    setSelectedNodeId(id);
    setSelectedEdgeId(null);
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

  const handleFitToScreen = () => {
    fitToScreen();
  };

  const handleResetLayout = () => {
    setCustomNodePositions({});
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setTimeout(() => {
      fitToScreen();
    }, 0);
  };

  const handleResetView = () => {
    handleFitToScreen();
  };

  const handleNudge = (direction: 'up' | 'down' | 'left' | 'right') => {
    const step = 100;
    let dx = 0;
    let dy = 0;
    if (direction === 'up') dy = step;
    if (direction === 'down') dy = -step;
    if (direction === 'left') dx = step;
    if (direction === 'right') dx = -step;

    if (svgRef.current && zoomBehaviorRef.current) {
      select(svgRef.current).call(zoomBehaviorRef.current.translateBy, dx, dy);
    } else {
      setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
    }
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
              setSelectedEdgeId(null);
              setStartNodeId(null);
              setEndNodeId(null);
              setPickingTarget(null);
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
              setSelectedEdgeId(null);
              setStartNodeId(null);
              setEndNodeId(null);
              setPickingTarget(null);
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
              setSelectedEdgeId(null);
              setStartNodeId(null);
              setEndNodeId(null);
              setPickingTarget(null);
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

        {/* Canvas Zoom & Layout Controls */}
        <div className="flex items-center gap-1.5">
          {/* Shortest Path Finder Feature Toggle */}
          <button
            id="btn-toggle-shortest-path"
            onClick={() => {
              setPathFinderOpen((prev) => !prev);
              if (pickingTarget) setPickingTarget(null);
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border transition-colors ${
              pathFinderOpen || (shortestPathResult && shortestPathResult.found)
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 font-medium'
                : `${borderClass} hover:bg-black/5 dark:hover:bg-white/5 ${textSecondaryClass}`
            }`}
            title="Find and highlight the shortest path between two nodes"
            aria-label="Toggle Shortest Path Finder"
          >
            <Route className={`w-3.5 h-3.5 ${pathFinderOpen || (shortestPathResult && shortestPathResult.found) ? 'text-emerald-400' : 'text-zinc-400'}`} />
            <span className="text-xs font-medium">Shortest Path</span>
            {shortestPathResult && shortestPathResult.found && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {shortestPathResult.hops} {shortestPathResult.hops === 1 ? 'hop' : 'hops'}
              </span>
            )}
          </button>

          {/* Highlight Connected Nodes Feature Toggle */}
          <button
            id="btn-toggle-highlight-connected"
            onClick={() => setHighlightConnected((prev) => !prev)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border transition-colors ${
              highlightConnected
                ? 'bg-sky-500/15 border-sky-500/40 text-sky-400 font-medium'
                : `${borderClass} hover:bg-black/5 dark:hover:bg-white/5 ${textSecondaryClass}`
            }`}
            title={
              highlightConnected
                ? 'Highlight Connected Nodes is active: non-connected nodes dim when clicking a node or relationship'
                : 'Highlight Connected Nodes is disabled: click to enable dimming of non-connected nodes'
            }
            aria-label="Toggle Highlight Connected Nodes"
          >
            <Sparkles className={`w-3.5 h-3.5 ${highlightConnected ? 'text-sky-400' : 'text-zinc-400'}`} />
            <span className="text-xs font-medium">Highlight Connected</span>
            {highlightConnected && (
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
            )}
          </button>

          {/* Cluster by Subsystem Feature Toggle */}
          <button
            id="btn-toggle-cluster-subsystem"
            onClick={() => {
              setClusterBySubsystem((prev) => !prev);
              setCustomNodePositions({});
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border transition-colors ${
              clusterBySubsystem
                ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-400 font-medium'
                : `${borderClass} hover:bg-black/5 dark:hover:bg-white/5 ${textSecondaryClass}`
            }`}
            title={
              clusterBySubsystem
                ? 'Cluster by Subsystem is active: automatically grouping nodes visually by their owning_subsystem ID'
                : 'Click to cluster nodes visually based on their associated owning_subsystem ID'
            }
            aria-label="Toggle Cluster by Subsystem"
            aria-pressed={clusterBySubsystem}
          >
            <Boxes className={`w-3.5 h-3.5 ${clusterBySubsystem ? 'text-indigo-400' : 'text-zinc-400'}`} />
            <span className="text-xs font-medium">Cluster by Subsystem</span>
            {clusterBySubsystem && (
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            )}
          </button>

          <div className="h-4 w-px bg-zinc-700/40 my-auto" />

          {/* Layout Mode Toggle: Organic (Force-directed) vs Grid */}
          <div
            id="layout-mode-toggle"
            className={`flex items-center p-0.5 rounded-md border ${borderClass} bg-black/10 dark:bg-white/5`}
            role="group"
            aria-label="Node Layout Mode"
          >
            <button
              id="btn-layout-organic"
              onClick={() => {
                if (layoutMode !== 'organic') {
                  setLayoutMode('organic');
                  setCustomNodePositions({});
                }
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs font-medium transition-colors ${
                layoutMode === 'organic'
                  ? 'bg-sky-500 text-white shadow-xs font-semibold'
                  : `${textSecondaryClass} hover:${textPrimaryClass}`
              }`}
              title="Organic Layout: Dynamic force-directed positioning using link springs & repulsion physics"
              aria-label="Switch to Organic force-directed layout"
              aria-pressed={layoutMode === 'organic'}
            >
              <Network className="w-3.5 h-3.5" />
              <span>Organic</span>
            </button>
            <button
              id="btn-layout-grid"
              onClick={() => {
                if (layoutMode !== 'grid') {
                  setLayoutMode('grid');
                  setCustomNodePositions({});
                }
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs font-medium transition-colors ${
                layoutMode === 'grid'
                  ? 'bg-sky-500 text-white shadow-xs font-semibold'
                  : `${textSecondaryClass} hover:${textPrimaryClass}`
              }`}
              title="Grid Layout: Structured matrix arrangement aligned in neat rows and columns"
              aria-label="Switch to Grid layout"
              aria-pressed={layoutMode === 'grid'}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Grid</span>
            </button>
          </div>

          <div className="h-4 w-px bg-zinc-700/40 my-auto" />

          <button
            id="btn-fit-to-screen"
            onClick={handleFitToScreen}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border ${borderClass} hover:bg-black/5 dark:hover:bg-white/5 ${textSecondaryClass} hover:${textPrimaryClass} transition-colors`}
            title="Fit to Screen (Fit entire graph into viewport)"
            aria-label="Fit to Screen"
          >
            <Maximize2 className="w-4 h-4 text-sky-400" />
            <span className="font-medium text-xs">Fit to Screen</span>
          </button>
          <div className="h-4 w-px bg-zinc-700/40 my-auto" />
          <button
            id="btn-zoom-in"
            onClick={handleZoomIn}
            className={`p-1.5 rounded-md border ${borderClass} hover:bg-black/5 dark:hover:bg-white/5 ${textSecondaryClass}`}
            title="Zoom In"
            aria-label="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            id="btn-zoom-out"
            onClick={handleZoomOut}
            className={`p-1.5 rounded-md border ${borderClass} hover:bg-black/5 dark:hover:bg-white/5 ${textSecondaryClass}`}
            title="Zoom Out"
            aria-label="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            id="btn-reset-layout"
            onClick={handleResetLayout}
            className={`p-1.5 rounded-md border ${borderClass} hover:bg-black/5 dark:hover:bg-white/5 ${textSecondaryClass}`}
            title="Reset Node Layout & Fit"
            aria-label="Reset Node Layout & Fit"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Interactive SVG Canvas Area */}
      <div className="flex-1 w-full h-full relative bg-radial from-slate-900/50 to-slate-950/90 overflow-hidden">
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
          id="graph-canvas-svg"
          className="w-full h-full absolute inset-0 cursor-grab active:cursor-grabbing select-none"
          style={{ overflow: 'visible' }}
          onClick={(e) => {
            const target = e.target as HTMLElement | SVGElement;
            if (
              target === svgRef.current ||
              target.id === 'canvas-bg-rect' ||
              target.tagName?.toLowerCase() === 'svg'
            ) {
              setSelectedNodeId(null);
              setSelectedEdgeId(null);
            }
          }}
        >
          {/* Clickable transparent background rect to easily deselect on empty canvas click */}
          <rect id="canvas-bg-rect" width="100%" height="100%" fill="transparent" />

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
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* Visual Subsystem Cluster Enclosures */}
            {(clusterBySubsystem || viewMode === 'subsystem_map') && (
              <g id="subsystem-cluster-enclosures" className="pointer-events-none">
                {clusterGroups.map((cluster) => (
                  <g key={cluster.key} className="transition-all duration-300">
                    {/* Bounding Hull/Box */}
                    <rect
                      x={cluster.x}
                      y={cluster.y}
                      width={cluster.width}
                      height={cluster.height}
                      rx="18"
                      ry="18"
                      fill={cluster.strokeColor}
                      fillOpacity={cluster.subsystemId !== undefined ? '0.05' : '0.02'}
                      stroke={cluster.strokeColor}
                      strokeWidth="1.5"
                      strokeDasharray={cluster.subsystemId !== undefined ? '6 4' : '4 4'}
                      strokeOpacity={cluster.subsystemId !== undefined ? '0.45' : '0.25'}
                    />
                    {/* Cluster Title Header Badge Pill */}
                    <g transform={`translate(${cluster.x + 14}, ${cluster.y + 10})`}>
                      <rect
                        x="0"
                        y="0"
                        width={Math.max(160, cluster.subsystemName.length * 7.5 + 85)}
                        height="26"
                        rx="6"
                        fill="#090d16"
                        fillOpacity="0.88"
                        stroke={cluster.strokeColor}
                        strokeWidth="1.2"
                        strokeOpacity="0.65"
                      />
                      <circle cx="12" cy="13" r="4" fill={cluster.strokeColor} />
                      <text
                        x="22"
                        y="17"
                        fill={cluster.strokeColor}
                        fontSize="11"
                        fontWeight="700"
                        fontFamily="sans-serif"
                        letterSpacing="0.02em"
                      >
                        {cluster.subsystemName}
                        <tspan fill="#94a3b8" fontWeight="500" fontSize="10">
                          {' '}• {cluster.nodeCount} {cluster.nodeCount === 1 ? 'node' : 'nodes'}
                        </tspan>
                      </text>
                    </g>
                  </g>
                ))}
              </g>
            )}

            {/* Render Relationship Edges */}
            {edges.map((edge) => {
              const isSelected = selectedEdgeId === edge.id;
              const isNodeSelected = selectedNodeId === edge.from || selectedNodeId === edge.to;
              const isPathEdge = isPathActive && pathEdgeSet.has(edge.id);
              const isConnectedEdge = isPathActive ? isPathEdge : connectedEdgeIds.has(edge.id);
              const isEdgeDimmed = isPathActive ? !isPathEdge : (isFocusActive && !isConnectedEdge);

              // Curve calculation between nodes
              const dx = edge.toPos.x - edge.fromPos.x;
              const dy = edge.toPos.y - edge.fromPos.y;
              const midX = (edge.fromPos.x + edge.toPos.x) / 2;
              const midY = (edge.fromPos.y + edge.toPos.y) / 2 - 25; // Slight arch

              // Color selection based on path status or confidence
              let strokeColor = '#38bdf8'; // sky
              let markerId = 'arrow-sky';

              if (isPathEdge) {
                strokeColor = '#10b981'; // emerald for shortest path route
                markerId = 'arrow-emerald';
              } else if (edge.pathType === 'green') {
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
                <g
                  key={edge.id}
                  id={`edge-group-${edge.id}`}
                  className="cursor-pointer group"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedEdgeId(edge.id);
                    setSelectedNodeId(null);
                  }}
                  style={{
                    opacity: isPathEdge ? 1 : isEdgeDimmed ? 0.08 : 1,
                    transition: 'opacity 0.25s ease',
                  }}
                >
                  {/* Curve path line */}
                  <path
                    d={`M ${edge.fromPos.x} ${edge.fromPos.y} Q ${midX} ${midY} ${edge.toPos.x} ${edge.toPos.y}`}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={isPathEdge ? 4 : isSelected ? 3.5 : isNodeSelected ? 2.5 : isEdgeDimmed ? 1 : 1.5}
                    strokeDasharray={edge.isExpired ? '4,4' : undefined}
                    opacity={isPathEdge ? 1 : isEdgeDimmed ? 0.15 : edge.isExpired ? 0.4 : isNodeSelected || isSelected ? 1 : 0.75}
                    markerEnd={isEdgeDimmed ? undefined : `url(#${markerId})`}
                    className="transition-all hover:opacity-100 hover:stroke-width-2"
                  />

                  {/* Edge Label Tag pill in middle */}
                  <g
                    transform={`translate(${midX}, ${midY})`}
                    opacity={isPathEdge ? 1 : isEdgeDimmed ? 0.2 : 1}
                    className="transition-opacity duration-200"
                  >
                    <rect
                      x="-45"
                      y="-11"
                      width="90"
                      height="22"
                      rx="11"
                      fill={isPathEdge ? '#064e3b' : '#0f172a'}
                      stroke={isPathEdge ? '#10b981' : isSelected ? '#38bdf8' : strokeColor}
                      strokeWidth={isPathEdge ? 2 : isSelected ? 2 : 1}
                      opacity={isPathEdge ? 1 : isEdgeDimmed ? 0.25 : 0.9}
                    />
                    <text
                      x="0"
                      y="3"
                      textAnchor="middle"
                      fill={isPathEdge ? '#a7f3d0' : isEdgeDimmed ? '#64748b' : '#e2e8f0'}
                      fontSize="10"
                      fontFamily="monospace"
                      fontWeight={isPathEdge || isSelected || isNodeSelected ? '700' : '600'}
                    >
                      {edge.relType}
                    </text>
                    {edge.confidence !== undefined && (
                      <circle
                        cx="36"
                        cy="0"
                        r="4"
                        fill={isPathEdge ? '#34d399' : edge.confidence >= 0.9 ? '#10b981' : '#f59e0b'}
                        opacity={isEdgeDimmed ? 0.2 : 1}
                      />
                    )}
                  </g>
                </g>
              );
            })}

            {/* Render Graph Nodes */}
            {nodes.map((node) => {
              const isSelected = selectedNodeId === node.id;
              const isStartNode = isPathActive && node.id === startNodeId;
              const isEndNode = isPathActive && node.id === endNodeId;
              const isPathNode = isPathActive && pathNodeSet.has(node.id);
              const pathStepIndex = isPathActive ? shortestPathResult!.nodeIds.indexOf(node.id) : -1;

              const isConnected = isPathActive ? isPathNode : connectedNodeIds.has(node.id);
              const isDimmed = isPathActive ? !isPathNode : (isFocusActive && !isConnected);
              const subColor = node.subsystemId !== undefined ? subsystemColors[node.subsystemId] : null;

              // Card styling based on selection, path role, or connected state
              let boxFill = '#0f172a';
              let boxStroke = subColor ? subColor.stroke : '#475569';
              let strokeWidth = 1.5;

              if (isStartNode) {
                boxFill = '#064e3b';
                boxStroke = '#10b981';
                strokeWidth = 3;
              } else if (isEndNode) {
                boxFill = '#451a03';
                boxStroke = '#f59e0b';
                strokeWidth = 3;
              } else if (isPathNode) {
                boxFill = '#0c4a6e';
                boxStroke = '#38bdf8';
                strokeWidth = 2.5;
              } else if (isSelected) {
                boxFill = '#1e293b';
                boxStroke = '#38bdf8';
                strokeWidth = 2.5;
              } else if (isConnected && isFocusActive) {
                boxFill = '#162238';
                boxStroke = '#38bdf8';
                strokeWidth = 2;
              }

              return (
                <g
                  key={node.id}
                  id={`node-group-${node.id}`}
                  data-node-drag="true"
                  transform={`translate(${node.x}, ${node.y})`}
                  onMouseDown={(e) => handleMouseDownNode(e, node.id)}
                  className="cursor-grab active:cursor-grabbing group"
                  style={{
                    opacity: isDimmed ? 0.16 : 1,
                    transition: 'opacity 0.25s ease, filter 0.25s ease',
                    filter: isDimmed ? 'grayscale(80%)' : undefined,
                  }}
                >
                  {/* Outer halo / glow for start, end, or selected node */}
                  {isStartNode && (
                    <rect
                      x="-89"
                      y="-36"
                      width="178"
                      height="72"
                      rx="14"
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2"
                      strokeDasharray="4,2"
                      opacity="0.9"
                    />
                  )}
                  {isEndNode && (
                    <rect
                      x="-89"
                      y="-36"
                      width="178"
                      height="72"
                      rx="14"
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="2"
                      strokeDasharray="4,2"
                      opacity="0.9"
                    />
                  )}
                  {isSelected && !isStartNode && !isEndNode && (
                    <rect
                      x="-89"
                      y="-36"
                      width="178"
                      height="72"
                      rx="14"
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="1.5"
                      strokeDasharray="4,3"
                      opacity="0.75"
                    />
                  )}

                  {/* Node Box / Card Container */}
                  <rect
                    x="-85"
                    y="-32"
                    width="170"
                    height="64"
                    rx="10"
                    fill={boxFill}
                    stroke={boxStroke}
                    strokeWidth={strokeWidth}
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
                      opacity={isDimmed ? 0.25 : 1}
                    />
                  )}

                  {/* Node Label Text */}
                  <text
                    x="0"
                    y="-10"
                    textAnchor="middle"
                    fill={isDimmed ? '#64748b' : isStartNode ? '#a7f3d0' : isEndNode ? '#fde68a' : isSelected ? '#ffffff' : '#f8fafc'}
                    fontSize="12"
                    fontWeight={isSelected || isStartNode || isEndNode || isPathNode ? '700' : '600'}
                    className={node.isExpired ? 'line-through opacity-70' : ''}
                  >
                    {node.label.length > 20 ? `${node.label.slice(0, 18)}...` : node.label}
                  </text>

                  {/* Subtitle / Subsystem Tag */}
                  <text
                    x="0"
                    y="8"
                    textAnchor="middle"
                    fill={isDimmed ? '#475569' : isStartNode ? '#6ee7b7' : isEndNode ? '#fcd34d' : '#94a3b8'}
                    fontSize="10"
                    fontFamily="monospace"
                  >
                    {node.subtitle ? (node.subtitle.length > 22 ? `${node.subtitle.slice(0, 20)}...` : node.subtitle) : node.type}
                  </text>

                  {/* Status / Link / Path indicator */}
                  <g transform="translate(0, 20)">
                    {isStartNode ? (
                      <text x="0" y="0" textAnchor="middle" fill="#34d399" fontSize="9" fontWeight="800">
                        ● START NODE
                      </text>
                    ) : isEndNode ? (
                      <text x="0" y="0" textAnchor="middle" fill="#fbbf24" fontSize="9" fontWeight="800">
                        🏁 END NODE
                      </text>
                    ) : isPathNode ? (
                      <text x="0" y="0" textAnchor="middle" fill="#38bdf8" fontSize="9" fontWeight="800">
                        STEP {pathStepIndex}
                      </text>
                    ) : node.isExpired ? (
                      <text x="0" y="0" textAnchor="middle" fill="#f43f5e" fontSize="9" fontWeight="bold">
                        EXPIRED
                      </text>
                    ) : isConnected && !isSelected && isFocusActive ? (
                      <text x="0" y="0" textAnchor="middle" fill="#38bdf8" fontSize="9" fontWeight="bold">
                        LINKED
                      </text>
                    ) : (
                      <text
                        x="0"
                        y="0"
                        textAnchor="middle"
                        fill={isSelected ? '#38bdf8' : isDimmed ? '#475569' : '#94a3b8'}
                        fontSize="9"
                        fontWeight="bold"
                      >
                        {node.subsystemName || node.type.toUpperCase()}
                      </text>
                    )}
                  </g>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Picking on Canvas Prompt Banner */}
        {pickingTarget && (
          <div
            id="picking-target-banner"
            className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 px-4 py-2 rounded-full bg-slate-950/95 border border-amber-500/70 text-xs text-amber-200 backdrop-blur-md shadow-2xl pointer-events-auto select-none animate-pulse"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span>
              Click any node on the canvas to set as{' '}
              <strong className="text-white uppercase">{pickingTarget === 'start' ? 'Start Node' : 'End Node'}</strong>
            </span>
            <button
              onClick={() => setPickingTarget(null)}
              className="text-[11px] px-2 py-0.5 rounded-md bg-white/10 hover:bg-white/20 text-zinc-200 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Shortest Path Active Status Banner */}
        {isPathActive && shortestPathResult && !pickingTarget && (
          <div
            id="shortest-path-banner"
            className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5 px-4 py-2 rounded-full bg-slate-950/95 border border-emerald-500/60 text-xs text-emerald-200 backdrop-blur-md shadow-2xl pointer-events-auto select-none"
          >
            <Route className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span className="font-medium">
              Shortest Path: <span className="text-white font-semibold">{startNode?.label}</span> →{' '}
              <span className="text-white font-semibold">{endNode?.label}</span>{' '}
              <span className="text-emerald-400 font-mono font-bold">
                ({shortestPathResult.hops} {shortestPathResult.hops === 1 ? 'hop' : 'hops'}, {shortestPathResult.nodeIds.length} nodes)
              </span>
            </span>
            <button
              id="btn-path-fit"
              onClick={fitPathToScreen}
              className="ml-1 flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 transition-colors"
              title="Fit path into screen view"
            >
              <Maximize2 className="w-3 h-3" />
              <span>Fit Path</span>
            </button>
            <button
              id="btn-clear-path"
              onClick={() => {
                setStartNodeId(null);
                setEndNodeId(null);
              }}
              className="text-[11px] px-2 py-0.5 rounded-md bg-white/10 hover:bg-white/20 text-zinc-200 hover:text-white transition-colors"
              title="Clear shortest path"
            >
              Clear
            </button>
          </div>
        )}

        {/* Active Highlight Info Banner (when single node or edge is focused and path is not active) */}
        {!isPathActive && !pickingTarget && isFocusActive && (
          <div
            id="highlight-connected-banner"
            className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-slate-950/90 border border-sky-500/40 text-xs text-sky-200 backdrop-blur-md shadow-2xl pointer-events-auto select-none"
          >
            <Sparkles className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
            <span className="font-medium">
              {selectedNode ? (
                <>
                  Focused on <span className="text-white font-semibold">{selectedNode.label}</span> •{' '}
                  {connectedNodeIds.size - 1} connected node{connectedNodeIds.size - 1 === 1 ? '' : 's'} highlighted
                </>
              ) : selectedEdge ? (
                <>
                  Focused on relationship <span className="text-white font-mono font-semibold">{selectedEdge.relType}</span> • 2 connected nodes highlighted
                </>
              ) : null}
            </span>
            <button
              id="btn-clear-highlight"
              onClick={() => {
                setSelectedNodeId(null);
                setSelectedEdgeId(null);
              }}
              className="ml-1 text-[11px] px-2 py-0.5 rounded-md bg-white/10 hover:bg-white/20 text-zinc-200 hover:text-white transition-colors"
              title="Clear highlight and restore all nodes"
              aria-label="Clear highlight"
            >
              Show All
            </button>
          </div>
        )}

        {/* Shortest Path Finder Floating Control Panel */}
        {pathFinderOpen && (
          <div
            id="shortest-path-panel"
            className={`absolute left-4 top-4 w-84 max-h-[calc(100%-2rem)] p-4 border ${borderClass} ${cardBgClass} rounded-2xl shadow-2xl overflow-y-auto flex flex-col z-30 transition-all text-xs space-y-3.5`}
          >
            {/* Panel Header */}
            <div className="flex items-center justify-between border-b border-zinc-700/50 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                  <Route className="w-4 h-4" />
                </div>
                <div>
                  <h3 className={`font-semibold text-sm ${textPrimaryClass}`}>Shortest Path Finder</h3>
                  <p className="text-[10px] text-zinc-400">Calculate & highlight graph route</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setPathFinderOpen(false);
                  setPickingTarget(null);
                }}
                className={`p-1 rounded-md text-xs ${textSecondaryClass} hover:${textPrimaryClass}`}
                aria-label="Close Path Finder"
              >
                ✕
              </button>
            </div>

            {/* Start Node Selector */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  Start Node:
                </span>
                <button
                  onClick={() => setPickingTarget(pickingTarget === 'start' ? null : 'start')}
                  className={`text-[10px] px-2 py-0.5 rounded-md border transition-colors ${
                    pickingTarget === 'start'
                      ? 'bg-emerald-500/25 border-emerald-500 text-emerald-300 font-bold'
                      : 'border-zinc-700 hover:border-emerald-500/50 text-zinc-400 hover:text-emerald-300'
                  }`}
                >
                  {pickingTarget === 'start' ? 'Click canvas node...' : 'Pick on Canvas'}
                </button>
              </div>

              <select
                id="select-start-node"
                value={startNodeId || ''}
                onChange={(e) => {
                  setStartNodeId(e.target.value || null);
                  setPickingTarget(null);
                }}
                className={`w-full px-2.5 py-1.5 rounded-lg border ${borderClass} bg-black/10 dark:bg-white/5 font-mono text-xs focus:outline-hidden ${textPrimaryClass}`}
              >
                <option value="">-- Choose Start Node --</option>
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.label} ({n.type})
                  </option>
                ))}
              </select>

              {selectedNode && selectedNode.id !== startNodeId && (
                <button
                  onClick={() => setStartNodeId(selectedNode.id)}
                  className="text-[10px] text-emerald-400 hover:underline flex items-center gap-1"
                >
                  <span>Use selected "{selectedNode.label}" as Start</span>
                </button>
              )}
            </div>

            {/* Swap Start & End button */}
            <div className="flex items-center justify-center">
              <button
                id="btn-swap-nodes"
                onClick={() => {
                  const temp = startNodeId;
                  setStartNodeId(endNodeId);
                  setEndNodeId(temp);
                }}
                disabled={!startNodeId && !endNodeId}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full border ${borderClass} bg-black/5 dark:bg-white/5 text-[11px] ${
                  !startNodeId && !endNodeId ? 'opacity-40 cursor-not-allowed' : 'hover:border-zinc-500 cursor-pointer'
                } ${textSecondaryClass} hover:${textPrimaryClass} transition-colors`}
                title="Swap Start and End nodes"
              >
                <ArrowUpDown className="w-3 h-3" />
                <span>Swap Endpoints</span>
              </button>
            </div>

            {/* End Node Selector */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-amber-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  End Node:
                </span>
                <button
                  onClick={() => setPickingTarget(pickingTarget === 'end' ? null : 'end')}
                  className={`text-[10px] px-2 py-0.5 rounded-md border transition-colors ${
                    pickingTarget === 'end'
                      ? 'bg-amber-500/25 border-amber-500 text-amber-300 font-bold'
                      : 'border-zinc-700 hover:border-amber-500/50 text-zinc-400 hover:text-amber-300'
                  }`}
                >
                  {pickingTarget === 'end' ? 'Click canvas node...' : 'Pick on Canvas'}
                </button>
              </div>

              <select
                id="select-end-node"
                value={endNodeId || ''}
                onChange={(e) => {
                  setEndNodeId(e.target.value || null);
                  setPickingTarget(null);
                }}
                className={`w-full px-2.5 py-1.5 rounded-lg border ${borderClass} bg-black/10 dark:bg-white/5 font-mono text-xs focus:outline-hidden ${textPrimaryClass}`}
              >
                <option value="">-- Choose End Node --</option>
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.label} ({n.type})
                  </option>
                ))}
              </select>

              {selectedNode && selectedNode.id !== endNodeId && (
                <button
                  onClick={() => setEndNodeId(selectedNode.id)}
                  className="text-[10px] text-amber-400 hover:underline flex items-center gap-1"
                >
                  <span>Use selected "{selectedNode.label}" as End</span>
                </button>
              )}
            </div>

            {/* Traversal Direction Options */}
            <div className="p-2 rounded-lg bg-black/10 dark:bg-white/5 border border-zinc-700/40 space-y-1">
              <span className={`text-[10px] font-mono ${textSecondaryClass}`}>Traversal Direction:</span>
              <div className="grid grid-cols-2 gap-1 text-[10px]">
                <button
                  type="button"
                  onClick={() => setPathDirectionMode('undirected')}
                  className={`px-2 py-1 rounded-md border font-medium transition-colors ${
                    pathDirectionMode === 'undirected'
                      ? 'bg-sky-500/20 border-sky-500/60 text-sky-300 font-semibold'
                      : 'border-transparent text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Any (Undirected)
                </button>
                <button
                  type="button"
                  onClick={() => setPathDirectionMode('directed')}
                  className={`px-2 py-1 rounded-md border font-medium transition-colors ${
                    pathDirectionMode === 'directed'
                      ? 'bg-sky-500/20 border-sky-500/60 text-sky-300 font-semibold'
                      : 'border-transparent text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Strict (A → B)
                </button>
              </div>
            </div>

            {/* Path Results & Step-by-Step Breakdown */}
            {startNodeId && endNodeId && (
              <div className="pt-2 border-t border-zinc-700/50 space-y-2.5">
                {shortestPathResult?.found ? (
                  <>
                    <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-emerald-400 flex items-center gap-1 text-xs">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Path Found ({shortestPathResult.hops} {shortestPathResult.hops === 1 ? 'hop' : 'hops'})
                        </span>
                        <span className="font-mono text-[10px] text-emerald-300">
                          {shortestPathResult.nodeIds.length} nodes
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-300">
                        Shortest route is illuminated on the canvas with non-path nodes dimmed.
                      </p>
                    </div>

                    {/* Path Action Buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        id="btn-path-fit-viewport"
                        onClick={fitPathToScreen}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-xs transition-colors cursor-pointer"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                        <span>Fit Path</span>
                      </button>
                      <button
                        id="btn-clear-path-selection"
                        onClick={() => {
                          setStartNodeId(null);
                          setEndNodeId(null);
                        }}
                        className={`px-3 py-1.5 rounded-lg border ${borderClass} hover:bg-white/10 ${textSecondaryClass} hover:${textPrimaryClass} text-xs transition-colors cursor-pointer`}
                      >
                        Reset
                      </button>
                    </div>

                    {/* Step-by-Step Route Sequence */}
                    <div className="space-y-1 pt-1">
                      <span className="text-[10px] font-mono text-zinc-400 uppercase font-semibold">
                        Route Steps ({shortestPathResult.steps.length}):
                      </span>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {shortestPathResult.steps.map((step, idx) => {
                          const fromNode = nodes.find((n) => n.id === step.fromNodeId);
                          const toNode = nodes.find((n) => n.id === step.toNodeId);
                          return (
                            <div
                              key={`${step.edgeId}-${idx}`}
                              className="p-2 rounded-md bg-black/15 dark:bg-white/5 border border-zinc-700/40 text-[11px] space-y-1"
                            >
                              <div className="flex items-center justify-between text-[10px] font-mono">
                                <span className="text-zinc-400">Step {idx + 1}</span>
                                <span className="px-1.5 py-0.2 rounded-xs bg-sky-500/20 text-sky-300 font-semibold">
                                  {step.relType}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 text-zinc-200">
                                <span className="font-semibold text-emerald-300 truncate max-w-[45%]">
                                  {fromNode?.label || step.fromNodeId}
                                </span>
                                <ArrowRight className="w-3 h-3 text-zinc-500 shrink-0" />
                                <span className="font-semibold text-amber-300 truncate max-w-[45%]">
                                  {toNode?.label || step.toNodeId}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 space-y-1 text-[11px]">
                    <span className="font-semibold text-rose-400 flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      No Path Found
                    </span>
                    <p className="text-zinc-300">
                      No sequence of relationships connects these two nodes under current filter and direction settings.
                    </p>
                    {pathDirectionMode === 'directed' && (
                      <button
                        onClick={() => setPathDirectionMode('undirected')}
                        className="mt-1 text-[10px] text-sky-400 hover:underline font-semibold block"
                      >
                        Switch to "Any (Undirected)" mode →
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {!startNodeId && !endNodeId && (
              <div className="p-3 rounded-lg bg-black/10 dark:bg-white/5 border border-zinc-700/30 text-[11px] text-zinc-400">
                Choose a Start and End node above, or use <strong>Pick on Canvas</strong> to click nodes directly in the graph.
              </div>
            )}
          </div>
        )}

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

        {/* On-Screen Directional Navigation Controls (D-Pad Corner) */}
        <div
          id="canvas-directional-controls"
          className={`absolute bottom-4 left-4 z-20 flex flex-col items-center p-1.5 rounded-xl border ${borderClass} bg-slate-950/80 backdrop-blur-md shadow-2xl text-zinc-300`}
        >
          {/* Nudge Up */}
          <button
            id="btn-nudge-up"
            onClick={() => handleNudge('up')}
            className="p-1.5 rounded-md hover:bg-white/10 active:bg-sky-600/30 text-zinc-300 hover:text-white transition-colors focus:outline-hidden"
            title="Pan / Nudge Up"
            aria-label="Pan Up"
          >
            <ChevronUp className="w-4 h-4" />
          </button>

          {/* Middle Row: Left, Reset/Center, Right */}
          <div className="flex items-center gap-0.5">
            <button
              id="btn-nudge-left"
              onClick={() => handleNudge('left')}
              className="p-1.5 rounded-md hover:bg-white/10 active:bg-sky-600/30 text-zinc-300 hover:text-white transition-colors focus:outline-hidden"
              title="Pan / Nudge Left"
              aria-label="Pan Left"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              id="btn-nudge-center"
              onClick={handleFitToScreen}
              className="p-1.5 rounded-md hover:bg-white/10 active:bg-sky-600/30 text-sky-400 hover:text-sky-300 transition-colors focus:outline-hidden"
              title="Fit to Screen (Center entire graph)"
              aria-label="Fit to Screen"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>

            <button
              id="btn-nudge-right"
              onClick={() => handleNudge('right')}
              className="p-1.5 rounded-md hover:bg-white/10 active:bg-sky-600/30 text-zinc-300 hover:text-white transition-colors focus:outline-hidden"
              title="Pan / Nudge Right"
              aria-label="Pan Right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Nudge Down */}
          <button
            id="btn-nudge-down"
            onClick={() => handleNudge('down')}
            className="p-1.5 rounded-md hover:bg-white/10 active:bg-sky-600/30 text-zinc-300 hover:text-white transition-colors focus:outline-hidden"
            title="Pan / Nudge Down"
            aria-label="Pan Down"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
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

            {/* Shortest Path Quick Assignment */}
            <div className="p-2.5 rounded-xl bg-black/20 dark:bg-white/5 border border-zinc-700/50 space-y-2">
              <div className="text-[10px] font-mono uppercase text-zinc-400 font-semibold flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <Route className="w-3.5 h-3.5" />
                  Shortest Path Route
                </span>
                {startNodeId === selectedNode.id ? (
                  <span className="text-emerald-400 font-bold">Start Endpoint ✓</span>
                ) : endNodeId === selectedNode.id ? (
                  <span className="text-amber-400 font-bold">End Endpoint ✓</span>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  id="btn-drawer-set-start"
                  onClick={() => {
                    setStartNodeId(selectedNode.id);
                    setPathFinderOpen(true);
                  }}
                  className={`px-2 py-1.5 rounded-lg text-[11px] font-medium border transition-colors flex items-center justify-center gap-1.5 ${
                    startNodeId === selectedNode.id
                      ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300 font-bold'
                      : 'border-zinc-700/60 hover:border-emerald-500/40 text-zinc-300 hover:text-emerald-300'
                  }`}
                  title="Set this node as Start endpoint for shortest path"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>{startNodeId === selectedNode.id ? 'Path Start ✓' : 'Set as Start'}</span>
                </button>

                <button
                  id="btn-drawer-set-end"
                  onClick={() => {
                    setEndNodeId(selectedNode.id);
                    setPathFinderOpen(true);
                  }}
                  className={`px-2 py-1.5 rounded-lg text-[11px] font-medium border transition-colors flex items-center justify-center gap-1.5 ${
                    endNodeId === selectedNode.id
                      ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 font-bold'
                      : 'border-zinc-700/60 hover:border-amber-500/40 text-zinc-300 hover:text-amber-300'
                  }`}
                  title="Set this node as End endpoint for shortest path"
                >
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span>{endNodeId === selectedNode.id ? 'Path End ✓' : 'Set as End'}</span>
                </button>
              </div>
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
                        onClick={() => {
                          setSelectedEdgeId(e.id);
                          setSelectedNodeId(null);
                        }}
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
            <div
              onClick={() => {
                setSelectedNodeId(selectedEdge.from);
                setSelectedEdgeId(null);
              }}
              className="p-2 rounded-md bg-black/10 dark:bg-white/5 border border-zinc-700/40 hover:border-sky-500/60 cursor-pointer transition-colors"
              title="Click to focus on source node"
            >
              <div className="flex items-center justify-between">
                <span className={textSecondaryClass}>Source Node:</span>
                <span className="text-[10px] text-sky-400 font-medium">Focus Node →</span>
              </div>
              <div className="font-semibold text-sky-300 mt-0.5">{selectedEdge.fromPos.label}</div>
            </div>

            <div
              onClick={() => {
                setSelectedNodeId(selectedEdge.to);
                setSelectedEdgeId(null);
              }}
              className="p-2 rounded-md bg-black/10 dark:bg-white/5 border border-zinc-700/40 hover:border-emerald-500/60 cursor-pointer transition-colors"
              title="Click to focus on target node"
            >
              <div className="flex items-center justify-between">
                <span className={textSecondaryClass}>Target Node:</span>
                <span className="text-[10px] text-emerald-400 font-medium">Focus Node →</span>
              </div>
              <div className="font-semibold text-emerald-300 mt-0.5">{selectedEdge.toPos.label}</div>
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
