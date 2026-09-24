import { Node, Edge } from '@xyflow/react';

/**
 * Normalizes raw node data defensively to guarantee compliance with React Flow specifications.
 * Ensures every node has a deterministic, valid position: { x: number, y: number }, id, type, and data.
 * Prevents React Flow 'Cannot read properties of undefined (reading x)' runtime errors.
 */
export function normalizeNodes(rawNodesInput: any): Node[] {
  let rawNodes = rawNodesInput;
  if (typeof rawNodes === 'string') {
    try {
      rawNodes = JSON.parse(rawNodes);
    } catch {
      return [];
    }
  }

  if (rawNodes && typeof rawNodes === 'object' && !Array.isArray(rawNodes)) {
    if (Array.isArray(rawNodes.nodes)) {
      rawNodes = rawNodes.nodes;
    } else if (rawNodes.bpmnJson) {
      return normalizeNodes(rawNodes.bpmnJson);
    }
  }

  if (!Array.isArray(rawNodes)) {
    return [];
  }

  return rawNodes
    .filter((n): n is Record<string, any> => n !== null && typeof n === 'object' && !Array.isArray(n))
    .map((rawNode, index) => {
      const id = typeof rawNode.id === 'string' && rawNode.id.trim() !== ''
        ? rawNode.id.trim()
        : (rawNode.id ? String(rawNode.id) : `node_${index + 1}_${Math.random().toString(36).substring(2, 7)}`);

      const rawType = rawNode.type || rawNode.data?.type || 'TASK';
      const type = typeof rawType === 'string' && rawType.trim() !== '' ? rawType.trim() : 'TASK';

      // Deterministic fallback position based on grid layout (220px horizontal spacing, 140px vertical)
      const defaultX = 100 + (index % 4) * 220;
      const defaultY = 100 + Math.floor(index / 4) * 140;

      let x = defaultX;
      let y = defaultY;

      if (rawNode.position && typeof rawNode.position === 'object') {
        const rawX = Number(rawNode.position.x);
        const rawY = Number(rawNode.position.y);

        if (Number.isFinite(rawX)) {
          x = rawX;
        }
        if (Number.isFinite(rawY)) {
          y = rawY;
        }
      }

      const rawData = rawNode.data && typeof rawNode.data === 'object' && !Array.isArray(rawNode.data)
        ? rawNode.data
        : {};

      const data = {
        label: rawData.label || rawNode.label || id,
        type: rawData.type || type,
        ...rawData,
      };

      const normalizedNode: Node = {
        id,
        type,
        position: { x, y },
        data,
      };

      if (typeof rawNode.selected === 'boolean') normalizedNode.selected = rawNode.selected;
      if (typeof rawNode.draggable === 'boolean') normalizedNode.draggable = rawNode.draggable;
      if (typeof rawNode.selectable === 'boolean') normalizedNode.selectable = rawNode.selectable;
      if (typeof rawNode.deletable === 'boolean') normalizedNode.deletable = rawNode.deletable;

      return normalizedNode;
    });
}

/**
 * Normalizes raw edge data defensively.
 */
export function normalizeEdges(rawEdgesInput: any): Edge[] {
  let rawEdges = rawEdgesInput;
  if (typeof rawEdges === 'string') {
    try {
      rawEdges = JSON.parse(rawEdges);
    } catch {
      return [];
    }
  }

  if (rawEdges && typeof rawEdges === 'object' && !Array.isArray(rawEdges)) {
    if (Array.isArray(rawEdges.edges)) {
      rawEdges = rawEdges.edges;
    } else if (rawEdges.bpmnJson) {
      return normalizeEdges(rawEdges.bpmnJson);
    }
  }

  if (!Array.isArray(rawEdges)) {
    return [];
  }

  return rawEdges
    .filter((e): e is Record<string, any> => e !== null && typeof e === 'object' && !Array.isArray(e))
    .filter((e) => e.source && e.target)
    .map((rawEdge, index) => {
      const id = typeof rawEdge.id === 'string' && rawEdge.id.trim() !== ''
        ? rawEdge.id.trim()
        : (rawEdge.id ? String(rawEdge.id) : `edge_${index + 1}_${Math.random().toString(36).substring(2, 7)}`);

      const source = String(rawEdge.source);
      const target = String(rawEdge.target);

      const normalizedEdge: Edge = {
        id,
        source,
        target,
      };

      if (rawEdge.label) normalizedEdge.label = String(rawEdge.label);
      if (rawEdge.type) normalizedEdge.type = String(rawEdge.type);
      if (rawEdge.data && typeof rawEdge.data === 'object') normalizedEdge.data = rawEdge.data;

      return normalizedEdge;
    });
}
