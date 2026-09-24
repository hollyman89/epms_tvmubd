import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button, Typography, Space, message, Tag, Modal, Badge, Select, Alert, Tooltip } from 'antd';
import {
  ArrowLeftOutlined,
  SaveOutlined,
  SendOutlined,
  PlusOutlined,
  LockOutlined,
} from '@ant-design/icons';
import {
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  Connection,
  Edge,
  Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import WorkflowDefinitionService, {
  WorkflowDefinition,
  WorkflowVersion,
  CANONICAL_WORKFLOW_KEYS,
} from '@/services/workflowDefinition.service';
import { Sidebar, NODE_TYPES } from './Sidebar';
import { PropertiesPanel } from './PropertiesPanel';
import { CustomNode } from './CustomNode';
import { normalizeNodes, normalizeEdges } from './workflow-normalizer';

const { Title, Text } = Typography;

const nodeTypes = {
  ...NODE_TYPES.reduce((acc: any, nt) => {
    acc[nt.type] = CustomNode;
    return acc;
  }, {}),
  customNode: CustomNode,
  default: CustomNode,
};

const getId = () => `node_${Math.random().toString(36).substr(2, 9)}`;
const getEdgeId = () => `edge_${Math.random().toString(36).substr(2, 9)}`;

interface WorkflowEditorProps {
  workflowKey: string;
  userRole: string;
  onBack: () => void;
}

export const WorkflowEditor: React.FC<WorkflowEditorProps> = ({ workflowKey, userRole, onBack }) => {
  const [definition, setDefinition] = useState<WorkflowDefinition | null>(null);
  const [selectedVersionObj, setSelectedVersionObj] = useState<WorkflowVersion | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);

  const isCanonical = CANONICAL_WORKFLOW_KEYS.includes(workflowKey);
  const isArchived = definition?.status === 'ARCHIVED' || selectedVersionObj?.status === 'ARCHIVED';
  const canEditBase = userRole === 'SUPER_ADMIN' || userRole === 'HEAD_OF_OPERATIONS';
  const isDraft = selectedVersionObj?.status === 'DRAFT';
  const readOnly = isCanonical || isArchived || !canEditBase || !isDraft;

  // Safe setter that guarantees all nodes have valid position and structure
  const setSafeNodes = useCallback((newNodesOrFn: any) => {
    setNodes((currentNodes) => {
      const nextNodes = typeof newNodesOrFn === 'function' ? newNodesOrFn(currentNodes) : newNodesOrFn;
      return normalizeNodes(nextNodes);
    });
  }, [setNodes]);

  const setSafeEdges = useCallback((newEdgesOrFn: any) => {
    setEdges((currentEdges) => {
      const nextEdges = typeof newEdgesOrFn === 'function' ? newEdgesOrFn(currentEdges) : newEdgesOrFn;
      return normalizeEdges(nextEdges);
    });
  }, [setEdges]);

  const loadWorkflow = async (preferredVersion?: number) => {
    try {
      setLoading(true);
      setLoadError(null);
      const def = await WorkflowDefinitionService.getDefinitionByKey(workflowKey);
      setDefinition(def);
      
      if (def.versions && def.versions.length > 0) {
        // Sort descending by version number
        const sorted = [...def.versions].sort((a, b) => b.version - a.version);
        
        let targetVersion: WorkflowVersion | undefined;
        if (preferredVersion) {
          targetVersion = def.versions.find((v) => v.version === preferredVersion);
        }
        if (!targetVersion) {
          // Prioritize activeVersion if set and exists, otherwise latest version
          targetVersion = (def.activeVersion
            ? def.versions.find((v) => v.version === def.activeVersion)
            : null) || sorted[0];
        }

        if (targetVersion) {
          setSelectedVersionObj(targetVersion);
          const bpmn = targetVersion.bpmnJson || {};
          const safeNodes = normalizeNodes(bpmn);
          const safeEdges = normalizeEdges(bpmn);
          setNodes(safeNodes);
          setEdges(safeEdges);
        }
      } else {
        setSelectedVersionObj(null);
        setNodes([]);
        setEdges([]);
      }
      setHasUnsavedChanges(false);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to load workflow';
      setLoadError(msg);
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkflow();
  }, [workflowKey]);

  const handleSelectVersion = (versionNum: number) => {
    if (!definition?.versions) return;
    const target = definition.versions.find((v) => v.version === versionNum);
    if (target) {
      setSelectedVersionObj(target);
      const bpmn = target.bpmnJson || {};
      const safeNodes = normalizeNodes(bpmn);
      const safeEdges = normalizeEdges(bpmn);
      setNodes(safeNodes);
      setEdges(safeEdges);
      setHasUnsavedChanges(false);
      setSelectedNode(null);
      setSelectedEdge(null);
    }
  };

  const onConnect = useCallback((params: Connection | Edge) => {
    if (readOnly) return;
    setEdges((eds) => addEdge({ ...params, id: getEdgeId() }, eds));
    setHasUnsavedChanges(true);
  }, [readOnly, setEdges]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      if (readOnly || !reactFlowInstance) return;

      const type = event.dataTransfer.getData('application/reactflow');
      const label = event.dataTransfer.getData('application/reactflow-label');
      if (!type) return;

      let position = { x: 250, y: 150 };
      if (reactFlowInstance && typeof reactFlowInstance.screenToFlowPosition === 'function') {
        try {
          const flowPos = reactFlowInstance.screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
          });
          if (
            flowPos &&
            typeof flowPos.x === 'number' &&
            !isNaN(flowPos.x) &&
            typeof flowPos.y === 'number' &&
            !isNaN(flowPos.y)
          ) {
            position = flowPos;
          }
        } catch {
          // Fallback to default position
        }
      }

      const newNode: Node = {
        id: getId(),
        type,
        position,
        data: { label: label || type, type },
      };

      setSafeNodes((nds: Node[]) => nds.concat(newNode));
      setHasUnsavedChanges(true);
    },
    [reactFlowInstance, readOnly, setSafeNodes]
  );

  const onNodeClick = (_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    setSelectedEdge(null);
  };

  const onEdgeClick = (_: React.MouseEvent, edge: Edge) => {
    setSelectedEdge(edge);
    setSelectedNode(null);
  };

  const onPaneClick = () => {
    setSelectedNode(null);
    setSelectedEdge(null);
  };

  const onNodesDelete = () => {
    if (readOnly) return;
    setHasUnsavedChanges(true);
    setSelectedNode(null);
  };
  
  const onEdgesDelete = () => {
    if (readOnly) return;
    setHasUnsavedChanges(true);
    setSelectedEdge(null);
  };

  const handleNodeDataChange = (nodeId: string, data: any) => {
    setSafeNodes((nds: Node[]) =>
      nds.map((n) => {
        if (n.id === nodeId) {
          return { ...n, data: { ...n.data, ...data } };
        }
        return n;
      })
    );
    setHasUnsavedChanges(true);
  };

  const handleEdgeDataChange = (edgeId: string, data: any) => {
    setSafeEdges((eds: Edge[]) =>
      eds.map((e) => {
        if (e.id === edgeId) {
          return { ...e, data: { ...e.data, ...data }, label: data.label };
        }
        return e;
      })
    );
    setHasUnsavedChanges(true);
  };

  const handleSaveDraft = async () => {
    if (!selectedVersionObj) return;
    try {
      setLoading(true);
      const safeNodes = normalizeNodes(nodes);
      const safeEdges = normalizeEdges(edges);
      await WorkflowDefinitionService.updateVersion(workflowKey, selectedVersionObj.version, { nodes: safeNodes, edges: safeEdges });
      message.success('Draft saved successfully');
      setHasUnsavedChanges(false);
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to save draft');
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = () => {
    if (!selectedVersionObj) return;
    const safeNodes = normalizeNodes(nodes);
    const safeEdges = normalizeEdges(edges);

    // 1. Validation
    const startNodes = safeNodes.filter(n => (n.data?.type || n.type) === 'START');
    const endNodes = safeNodes.filter(n => (n.data?.type || n.type) === 'END');
    
    if (startNodes.length !== 1) {
      return message.error('Workflow must have exactly one START node.');
    }
    if (endNodes.length < 1) {
      return message.error('Workflow must have at least one END node.');
    }

    // Orphan validation
    const hasOrphans = safeNodes.some(n => {
      const nType = (n.data?.type || n.type);
      if (nType === 'START') {
        return !safeEdges.some(e => e.source === n.id);
      }
      if (nType === 'END') {
        return !safeEdges.some(e => e.target === n.id);
      }
      const hasIncoming = safeEdges.some(e => e.target === n.id);
      const hasOutgoing = safeEdges.some(e => e.source === n.id);
      return !hasIncoming || !hasOutgoing;
    });

    if (hasOrphans) {
      return message.error('Graph contains orphan nodes or dead-ends. Ensure all nodes are connected.');
    }

    // Condition node validation
    const invalidConditions = safeNodes.filter(n => (n.data?.type || n.type) === 'CONDITION' && !n.data?.condition);
    if (invalidConditions.length > 0) {
      return message.error('All CONDITION nodes must have a condition expression set.');
    }

    Modal.confirm({
      title: 'Publish Workflow Version?',
      content: 'Once published, this version will become immutable and set as the active version for new instances. Are you sure?',
      onOk: async () => {
        try {
          setLoading(true);
          // Auto save before publish if unsaved changes exist
          if (hasUnsavedChanges) {
            await WorkflowDefinitionService.updateVersion(workflowKey, selectedVersionObj.version, { nodes: safeNodes, edges: safeEdges });
          }
          const pubVer = selectedVersionObj.version;
          await WorkflowDefinitionService.publishVersion(workflowKey, pubVer);
          message.success(`Version v${pubVer} published successfully`);
          await loadWorkflow(pubVer);
        } catch (err: any) {
          message.error(err?.response?.data?.message || 'Failed to publish version');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleCreateDraft = async () => {
    try {
      setLoading(true);
      const safeNodes = normalizeNodes(nodes);
      const safeEdges = normalizeEdges(edges);
      const newVer = await WorkflowDefinitionService.createVersion(workflowKey, { bpmnJson: { nodes: safeNodes, edges: safeEdges } });
      message.success(`New draft version v${newVer.version} created`);
      await loadWorkflow(newVer.version);
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to create new draft');
    } finally {
      setLoading(false);
    }
  };

  if (loadError && !definition) {
    return (
      <div style={{ padding: 24, background: '#fff', borderRadius: 8, minHeight: 400 }}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Button icon={<ArrowLeftOutlined />} onClick={onBack} data-testid="error-back-btn">
            Back to Workflows
          </Button>
          <Alert
            type="error"
            showIcon
            message="Error Loading Workflow"
            description={loadError}
            data-testid="workflow-load-error"
          />
        </Space>
      </div>
    );
  }

  return (
    <div style={{ background: '#fff', borderRadius: 8, height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '12px 24px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <Space size="large" wrap>
          <Button icon={<ArrowLeftOutlined />} onClick={onBack} data-testid="editor-back-btn" />
          <div>
            <Space align="center">
              <Title level={4} style={{ margin: 0 }}>
                {definition?.name || workflowKey} 
                {hasUnsavedChanges && <Badge dot color="red" offset={[5, 0]}><span style={{marginLeft: 10}} /></Badge>}
              </Title>
              {isCanonical && (
                <Tooltip title="Canonical System Workflow (Protected)">
                  <Tag icon={<LockOutlined />} color="purple" data-testid="protected-system-badge">
                    Protected
                  </Tag>
                </Tooltip>
              )}
            </Space>
            <Space size="small" style={{ display: 'block', marginTop: 2 }}>
              <Text type="secondary" code>{workflowKey}</Text>
              {definition?.domain && <Tag color="blue">{definition.domain}</Tag>}
              {definition?.status && (
                <Tag
                  color={
                    definition.status === 'PUBLISHED'
                      ? 'green'
                      : definition.status === 'ARCHIVED'
                      ? 'default'
                      : 'orange'
                  }
                  data-testid="definition-status-tag"
                >
                  {definition.status}
                </Tag>
              )}
              <Text type="secondary" style={{ fontSize: 12 }}>
                Active: <Text strong data-testid="active-version-display">{definition?.activeVersion ? `v${definition.activeVersion}` : 'None'}</Text>
              </Text>
            </Space>
          </div>

          <div style={{ borderLeft: '1px solid #d9d9d9', height: 40, margin: '0 8px' }} />

          <div>
            <div style={{ fontSize: 12, color: '#8c8c8c' }}>Viewing Version</div>
            <Space>
              {definition?.versions && definition.versions.length > 1 ? (
                <Select
                  size="small"
                  value={selectedVersionObj?.version}
                  onChange={handleSelectVersion}
                  style={{ minWidth: 150 }}
                  data-testid="version-select"
                >
                  {[...definition.versions]
                    .sort((a, b) => b.version - a.version)
                    .map((v) => {
                      const isActive = v.version === definition.activeVersion;
                      const isHistorical = v.status === 'PUBLISHED' && !isActive;
                      const labelDesc = isActive
                        ? 'Active'
                        : isHistorical
                        ? 'Historical'
                        : v.status;
                      return (
                        <Select.Option key={v.version} value={v.version}>
                          v{v.version} ({labelDesc})
                        </Select.Option>
                      );
                    })}
                </Select>
              ) : (
                <Text strong>{selectedVersionObj ? `v${selectedVersionObj.version}` : 'None'}</Text>
              )}

              {/* Version Status Badges */}
              {selectedVersionObj ? (
                <>
                  {selectedVersionObj.version === definition?.activeVersion ? (
                    <Tag color="blue" data-testid="active-version-tag">
                      Active Version
                    </Tag>
                  ) : selectedVersionObj.status === 'PUBLISHED' ? (
                    <Tag color="default" data-testid="historical-version-tag">
                      Historical
                    </Tag>
                  ) : selectedVersionObj.status === 'DRAFT' ? (
                    <Tag color="orange" data-testid="draft-version-tag">
                      Draft
                    </Tag>
                  ) : (
                    <Tag color="default" data-testid="archived-version-tag">
                      {selectedVersionObj.status}
                    </Tag>
                  )}
                </>
              ) : (
                <Tag color="default">No Version Available</Tag>
              )}
            </Space>
          </div>
        </Space>
        
        <Space>
          {isCanonical ? (
            <Tooltip title="Canonical system workflow is protected and locked against modifications.">
              <Tag icon={<LockOutlined />} color="purple" style={{ padding: '4px 8px' }} data-testid="canonical-locked-badge">
                System Locked
              </Tag>
            </Tooltip>
          ) : isArchived ? (
            <Tag color="default" style={{ padding: '4px 8px' }} data-testid="archived-locked-badge">
              Workflow Archived (Read-Only)
            </Tag>
          ) : (
            <>
              {isDraft && canEditBase && (
                <Button
                  type="default"
                  icon={<SaveOutlined />}
                  onClick={handleSaveDraft}
                  loading={loading}
                  disabled={!hasUnsavedChanges}
                  data-testid="save-draft-btn"
                >
                  Save Draft
                </Button>
              )}
              {isDraft && canEditBase && (
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  onClick={handlePublish}
                  loading={loading}
                  data-testid="publish-btn"
                >
                  Publish
                </Button>
              )}
              {!isDraft && canEditBase && (
                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={handleCreateDraft}
                  loading={loading}
                  data-testid="create-draft-btn"
                >
                  Create New Draft
                </Button>
              )}
            </>
          )}
        </Space>
      </div>

      {/* Editor Body */}
      <div style={{ flex: 1, display: 'flex', position: 'relative' }}>
        <ReactFlowProvider>
          <Sidebar readOnly={readOnly} />
          <div style={{ flex: 1 }} ref={reactFlowWrapper}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={readOnly ? undefined : onNodesChange}
              onEdgesChange={readOnly ? undefined : onEdgesChange}
              onConnect={onConnect}
              onInit={setReactFlowInstance}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onNodeClick={onNodeClick}
              onEdgeClick={onEdgeClick}
              onPaneClick={onPaneClick}
              onNodesDelete={onNodesDelete}
              onEdgesDelete={onEdgesDelete}
              fitView
              nodesDraggable={!readOnly}
              nodesConnectable={!readOnly}
              elementsSelectable={true}
            >
              <Background color="#ccc" gap={16} />
              <Controls />
            </ReactFlow>
          </div>
          <PropertiesPanel 
            selectedNode={selectedNode}
            selectedEdge={selectedEdge}
            readOnly={readOnly}
            onNodeDataChange={handleNodeDataChange}
            onEdgeDataChange={handleEdgeDataChange}
          />
        </ReactFlowProvider>
      </div>
    </div>
  );
};
