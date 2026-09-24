'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Modal,
  Typography,
  Tag,
  Button,
  Space,
  Card,
  Row,
  Col,
  Input,
  InputNumber,
  Table,
  Divider,
  Alert,
  Popconfirm,
  Tooltip,
  message,
  Form,
  Badge,
  Progress,
  Empty,
  Spin,
} from 'antd';
import {
  ApartmentOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  SaveOutlined,
  ReloadOutlined,
  FolderOutlined,
  FolderOpenOutlined,
  FileTextOutlined,
  NodeExpandOutlined,
  NodeCollapseOutlined,
  FileDoneOutlined,
  SearchOutlined,
  WarningOutlined,
  CloudSyncOutlined,
  CloudUploadOutlined,
} from '@ant-design/icons';
import { ProjectCharter } from '../ProjectOperationTab';
import { ProjectService } from '@/services/project.service';

const { Title, Text, Paragraph } = Typography;

export interface WbsNodeItem {
  id: string; // React/Antd unique string rowKey
  dbId?: number; // Persistent Database Primary Key
  code: string;
  name: string;
  level: number;
  weightPercentage: number;
  description?: string;
  parentId?: string | null;
  children?: WbsNodeItem[];
}

/**
 * Adapter: Converts flat database rows into nested hierarchical WBS tree
 */
export const convertFlatWbsToTree = (flatRows: any[]): WbsNodeItem[] => {
  if (!flatRows || !Array.isArray(flatRows) || flatRows.length === 0) return [];
  const activeRows = flatRows.filter((r) => !r.deletedAt && !r.deleted_at);
  const nodeMap = new Map<number, WbsNodeItem>();
  const rootNodes: WbsNodeItem[] = [];

  for (const row of activeRows) {
    const rawId = row.id ?? row.ID ?? row.dbId ?? row.wbsId ?? row.wbs_id;
    const numId = rawId !== undefined && rawId !== null && !isNaN(Number(rawId)) ? Number(rawId) : undefined;
    const parentIdRaw = row.parentWbsId ?? row.parent_wbs_id;
    const parentId = parentIdRaw !== undefined && parentIdRaw !== null ? String(parentIdRaw) : null;
    const weight = Number(row.weightPercentage ?? row.weight_percentage ?? 0);

    const safeKey = numId !== undefined ? numId : Math.random();
    nodeMap.set(safeKey, {
      id: numId !== undefined ? String(numId) : (row.id ? String(row.id) : `wbs-flat-${Date.now()}`),
      dbId: numId,
      code: row.code,
      name: row.name,
      level: Number(row.level || 1),
      weightPercentage: weight,
      description: row.description || '',
      parentId,
      children: [],
    });
  }

  for (const row of activeRows) {
    const rawId = row.id ?? row.ID ?? row.dbId ?? row.wbsId ?? row.wbs_id;
    const numId = rawId !== undefined && rawId !== null && !isNaN(Number(rawId)) ? Number(rawId) : undefined;
    const parentIdRaw = row.parentWbsId ?? row.parent_wbs_id;
    const parentNumId = parentIdRaw !== undefined && parentIdRaw !== null && !isNaN(Number(parentIdRaw)) ? Number(parentIdRaw) : null;

    if (numId === undefined) continue;
    const node = nodeMap.get(numId);
    if (!node) continue;

    if (parentNumId !== null && nodeMap.has(parentNumId)) {
      nodeMap.get(parentNumId)!.children!.push(node);
    } else {
      rootNodes.push(node);
    }
  }

  return recomputeWbsHierarchy(rootNodes);
};

/**
 * Adapter: Converts server nested tree response to UI nodes preserving dbId
 */
export const convertBackendTreeToUiNodes = (backendTree: any[]): WbsNodeItem[] => {
  if (!backendTree || !Array.isArray(backendTree)) return [];
  return backendTree.map((item) => {
    const rawId = item.id ?? item.ID ?? item.dbId ?? item.wbsId ?? item.wbs_id;
    const numId = rawId !== undefined && rawId !== null && !isNaN(Number(rawId)) ? Number(rawId) : undefined;
    const parentIdRaw = item.parentWbsId ?? item.parent_wbs_id;
    const parentId = parentIdRaw !== undefined && parentIdRaw !== null ? String(parentIdRaw) : null;
    const weight = Number(item.weightPercentage ?? item.weight_percentage ?? 0);

    return {
      id: numId !== undefined ? String(numId) : (item.id ? String(item.id) : `wbs-${Date.now()}`),
      dbId: numId,
      code: item.code,
      name: item.name,
      level: Number(item.level || 1),
      weightPercentage: weight,
      description: item.description || '',
      parentId,
      children: item.children && item.children.length > 0
        ? convertBackendTreeToUiNodes(item.children)
        : [],
    };
  });
};

/**
 * Adapter: Converts UI nodes to save payload with persistent DB IDs for upsert
 */
export const convertUiNodesToSavePayload = (nodes: WbsNodeItem[]): any[] => {
  return nodes.map((node) => {
    const resolvedId =
      node.dbId !== undefined && node.dbId !== null && !isNaN(Number(node.dbId))
        ? Number(node.dbId)
        : (node.id && !isNaN(Number(node.id)) && !String(node.id).startsWith('wbs-') && Number(node.id) > 0
            ? Number(node.id)
            : undefined);

    return {
      id: resolvedId,
      code: node.code,
      name: node.name,
      level: node.level,
      weightPercentage: Number(node.weightPercentage || 0),
      description: node.description || undefined,
      children: node.children && node.children.length > 0
        ? convertUiNodesToSavePayload(node.children)
        : undefined,
    };
  });
};

export interface WbsTreeTableModalProps {
  open: boolean;
  onClose: () => void;
  charter: ProjectCharter | null;
  onSaveDraft?: (wbsData: WbsNodeItem[]) => void;
}

interface TemplateWbsItem {
  code: string;
  name: string;
  level: number;
  weightPercentage: number;
  description: string;
  children?: TemplateWbsItem[];
}

// Preset standard templates for quick scaffolding
const STANDARD_TELECOM_TEMPLATE: TemplateWbsItem[] = [
  {
    code: '1.0',
    name: 'Persiapan, Survey & Perizinan',
    level: 1,
    weightPercentage: 15,
    description: 'Site survey, koordinasi perizinan instansi & K3 operasional',
    children: [
      {
        code: '1.1',
        name: 'Joint Survey & Pemetaan Jalur (Route Mapping)',
        level: 2,
        weightPercentage: 8,
        description: 'Penetapan titik ODP, tiang dan panjang span FO',
      },
      {
        code: '1.2',
        name: 'Pengurusan Izin Instansi (PU / Dishub / Kawasan)',
        level: 2,
        weightPercentage: 7,
        description: 'Perizinan galian jalan, crossing kabel dan permit area',
      },
    ],
  },
  {
    code: '2.0',
    name: 'Pengadaan Material & Delivery Perangkat',
    level: 1,
    weightPercentage: 35,
    description: 'Sourcing, delivery dan staging material FO di lokasi',
    children: [
      {
        code: '2.1',
        name: 'Pengadaan Kabel Fiber Optic & Aksesoris Tiang',
        level: 2,
        weightPercentage: 20,
        description: 'Kabel ADSS/duct, suspension clamp, dead-end, stainless band',
      },
      {
        code: '2.2',
        name: 'Pengadaan Enclosure, ODP & Passive Splitter',
        level: 2,
        weightPercentage: 15,
        description: 'Optical Distribution Point, pigtail, adapter dan splice tray',
      },
    ],
  },
  {
    code: '3.0',
    name: 'Instalasi, Penarikan & Splicing',
    level: 1,
    weightPercentage: 35,
    description: 'Pekerjaan fisik penarikan kabel, splicing core dan labeling',
    children: [
      {
        code: '3.1',
        name: 'Penarikan Kabel Udara / Bawah Tanah',
        level: 2,
        weightPercentage: 20,
        description: 'Stringing kabel FO antar tiang / manhole',
      },
      {
        code: '3.2',
        name: 'Fusion Splicing Core & Terminasi ODP',
        level: 2,
        weightPercentage: 15,
        description: 'Penyambungan core FO dan penataan tray ODP',
      },
    ],
  },
  {
    code: '4.0',
    name: 'Testing, Commissioning & BAST',
    level: 1,
    weightPercentage: 15,
    description: 'Pengukuran loss, dokumentasi as-built dan serah terima',
    children: [
      {
        code: '4.1',
        name: 'Pengukuran OTDR & Optical Power Meter (OPM)',
        level: 2,
        weightPercentage: 8,
        description: 'Verifikasi redaman total sesuai spesifikasi teknis',
      },
      {
        code: '4.2',
        name: 'Penyusunan As-Built Drawing & BAST 1',
        level: 2,
        weightPercentage: 7,
        description: 'Penyerahan dokumen laporan akhir dan penandatanganan BAST',
      },
    ],
  },
];

/**
 * Pure helper: Recursively re-indexes WBS nodes with clean codes and correct level.
 * Level 1: 1.0, 2.0, 3.0...
 * Level 2: 1.1, 1.2, 1.3...
 * Level 3: 1.1.1, 1.1.2...
 */
export const recomputeWbsHierarchy = (
  nodes: WbsNodeItem[],
  parentCode = '',
  level = 1
): WbsNodeItem[] => {
  return nodes.map((node, index) => {
    const seq = index + 1;
    let nodeCode = '';

    if (level === 1) {
      nodeCode = `${seq}.0`;
    } else if (level === 2) {
      const parentPrefix = parentCode.replace(/\.0$/, '');
      nodeCode = `${parentPrefix}.${seq}`;
    } else {
      nodeCode = `${parentCode}.${seq}`;
    }

    const updatedChildren =
      node.children && node.children.length > 0
        ? recomputeWbsHierarchy(node.children, nodeCode, level + 1)
        : undefined;

    const resolvedDbId =
      node.dbId !== undefined && node.dbId !== null && !isNaN(Number(node.dbId))
        ? Number(node.dbId)
        : (node.id && !isNaN(Number(node.id)) && !String(node.id).startsWith('wbs-') && Number(node.id) > 0
            ? Number(node.id)
            : undefined);

    return {
      ...node,
      dbId: resolvedDbId,
      code: nodeCode,
      level,
      children: updatedChildren,
    };
  });
};

/**
 * Helper to calculate total weight.
 * If nodes have children, effective weight is calculated from leaf nodes.
 */
export const calculateLeafWeightSum = (nodes: WbsNodeItem[]): number => {
  let sum = 0;
  for (const node of nodes) {
    if (node.children && node.children.length > 0) {
      sum += calculateLeafWeightSum(node.children);
    } else {
      sum += Number(node.weightPercentage || 0);
    }
  }
  return Number(sum.toFixed(2));
};

/**
 * Helper to calculate root packages weight sum
 */
export const calculateRootWeightSum = (nodes: WbsNodeItem[]): number => {
  return Number(
    nodes.reduce((acc, curr) => acc + Number(curr.weightPercentage || 0), 0).toFixed(2)
  );
};

/**
 * Count total number of deliverables (leaf nodes)
 */
export const countLeafNodes = (nodes: WbsNodeItem[]): number => {
  let count = 0;
  for (const node of nodes) {
    if (node.children && node.children.length > 0) {
      count += countLeafNodes(node.children);
    } else {
      count += 1;
    }
  }
  return count;
};

/**
 * Find total node count
 */
export const countTotalNodes = (nodes: WbsNodeItem[]): number => {
  let count = 0;
  for (const node of nodes) {
    count += 1;
    if (node.children && node.children.length > 0) {
      count += countTotalNodes(node.children);
    }
  }
  return count;
};

/**
 * Count all descendant nodes under a specific node
 */
export const countDescendants = (node: WbsNodeItem): number => {
  if (!node.children || node.children.length === 0) return 0;
  let count = node.children.length;
  for (const child of node.children) {
    count += countDescendants(child);
  }
  return count;
};

/**
 * Recursively find all node IDs
 */
export const getAllNodeIds = (nodes: WbsNodeItem[]): string[] => {
  let ids: string[] = [];
  for (const node of nodes) {
    ids.push(node.id);
    if (node.children && node.children.length > 0) {
      ids = ids.concat(getAllNodeIds(node.children));
    }
  }
  return ids;
};

/**
 * Calculate maximum hierarchy depth of WBS tree
 */
export const calculateMaxDepth = (nodes: WbsNodeItem[]): number => {
  if (!nodes || nodes.length === 0) return 0;
  let max = 1;
  for (const node of nodes) {
    if (node.children && node.children.length > 0) {
      const childDepth = 1 + calculateMaxDepth(node.children);
      if (childDepth > max) max = childDepth;
    }
  }
  return max;
};

export interface WbsStructureMetrics {
  rootPackageCount: number;
  totalNodeCount: number;
  leafDeliverableCount: number;
  maxHierarchyDepth: number;
  nestedNodeCount: number;
  isFlat: boolean;
  isStructured: boolean;
}

export const getWbsStructureMetrics = (nodes: WbsNodeItem[]): WbsStructureMetrics => {
  const rootPackageCount = nodes ? nodes.length : 0;
  const totalNodeCount = countTotalNodes(nodes || []);
  const leafDeliverableCount = countLeafNodes(nodes || []);
  const maxHierarchyDepth = calculateMaxDepth(nodes || []);
  const nestedNodeCount = totalNodeCount - rootPackageCount;
  const isFlat = rootPackageCount > 0 && maxHierarchyDepth === 1;
  const isStructured = maxHierarchyDepth > 1;

  return {
    rootPackageCount,
    totalNodeCount,
    leafDeliverableCount,
    maxHierarchyDepth,
    nestedNodeCount,
    isFlat,
    isStructured,
  };
};

export const WbsTreeTableModal: React.FC<WbsTreeTableModalProps> = ({
  open,
  onClose,
  charter,
  onSaveDraft,
}) => {
  const [wbsData, setWbsData] = useState<WbsNodeItem[]>([]);
  const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>([]);
  const [searchText, setSearchText] = useState<string>('');
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  // API Integration & State Status
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [isServerSynced, setIsServerSynced] = useState<boolean>(false);
  const [hasLegacyDraft, setHasLegacyDraft] = useState<boolean>(false);
  const [saveStatusText, setSaveStatusText] = useState<string>('Memuat data...');

  // Edit / Add Modal Form State
  const [isNodeModalOpen, setIsNodeModalOpen] = useState(false);
  const [nodeModalMode, setNodeModalMode] = useState<'ADD_ROOT' | 'ADD_CHILD' | 'EDIT'>('ADD_ROOT');
  const [targetParentNode, setTargetParentNode] = useState<WbsNodeItem | null>(null);
  const [targetEditNode, setTargetEditNode] = useState<WbsNodeItem | null>(null);
  const [nodeForm] = Form.useForm();

  // Canonical Planning Project ID (prioritizes backend projectId over contract id)
  const canonicalProjectId = useMemo(() => {
    return Number(charter?.projectId || charter?.id || 0);
  }, [charter]);

  // Storage key specific to this charter WBS (for legacy fallback/sync only)
  const storageKey = useMemo(() => {
    if (!canonicalProjectId) return '';
    return `epms_wbs_draft_${canonicalProjectId}`;
  }, [canonicalProjectId]);

  // Load WBS data from Backend SSOT on open (with legacy localStorage fallback)
  useEffect(() => {
    let isMounted = true;

    const loadWbs = async () => {
      if (!open || !charter) return;

      const projectId = canonicalProjectId;
      if (!projectId) {
        setWbsData([]);
        setExpandedRowKeys([]);
        setSaveStatusText('Project ID tidak tersedia');
        return;
      }

      setIsLoading(true);
      try {
        // 1. Fetch from canonical Backend REST API
        const backendRows = await ProjectService.getWbsByProject(projectId);

        if (!isMounted) return;

        if (backendRows && Array.isArray(backendRows) && backendRows.length > 0) {
          // Backend Database is SSOT
          const tree = convertFlatWbsToTree(backendRows);
          setWbsData(tree);
          setExpandedRowKeys(getAllNodeIds(tree));
          setIsDirty(false);
          setIsServerSynced(true);
          setHasLegacyDraft(false);
          setSaveStatusText('Tersimpan di Database Server');
          setIsLoading(false);
          return;
        }

        // 2. If Backend is empty, check for legacy localStorage draft to offer migration sync
        if (storageKey) {
          const savedDraft = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null;
          if (savedDraft) {
            try {
              const parsed = JSON.parse(savedDraft);
              if (Array.isArray(parsed.nodes) && parsed.nodes.length > 0) {
                const localTree = recomputeWbsHierarchy(parsed.nodes);
                setWbsData(localTree);
                setExpandedRowKeys(getAllNodeIds(localTree));
                setIsDirty(true);
                setIsServerSynced(false);
                setHasLegacyDraft(true);
                setSaveStatusText('Draft Lokal (Memerlukan Sinkronisasi ke Server)');
                setIsLoading(false);
                return;
              }
            } catch (e) {
              console.error('Error parsing legacy WBS draft:', e);
            }
          }
        }

        // 3. Both backend and local storage are empty
        setWbsData([]);
        setExpandedRowKeys([]);
        setIsDirty(false);
        setIsServerSynced(false);
        setHasLegacyDraft(false);
        setSaveStatusText('Belum ada data WBS');
      } catch (err: any) {
        if (!isMounted) return;
        console.error('Failed to fetch WBS from server:', err);
        message.error('Gagal memuat struktur WBS dari server. Silakan coba kembali.');
        setSaveStatusText('Gagal memuat data dari server');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadWbs();

    return () => {
      isMounted = false;
    };
  }, [open, charter, canonicalProjectId, storageKey]);

  // Calculations
  const rootWeightSum = useMemo(() => calculateRootWeightSum(wbsData), [wbsData]);
  const totalNodesCount = useMemo(() => countTotalNodes(wbsData), [wbsData]);
  const leafNodesCount = useMemo(() => countLeafNodes(wbsData), [wbsData]);
  const rootCount = wbsData.length;
  const structureMetrics = useMemo(() => getWbsStructureMetrics(wbsData), [wbsData]);

  const isWeightValid = Math.abs(rootWeightSum - 100) < 0.01;

  // Save to Backend Server SSOT
  const handleSaveToServer = async () => {
    if (!canonicalProjectId) {
      message.error('Project ID tidak tersedia. Simpan WBS dibatalkan.');
      return;
    }

    if (wbsData.length === 0) {
      message.warning('Struktur WBS kosong. Tambahkan minimal 1 Work Package sebelum menyimpan.');
      return;
    }

    // Pre-validation: Root weight total must be 100.00%
    if (!isWeightValid) {
      message.error(
        `Total bobot Work Package tingkat 1 (Root) harus bernilai 100.00% (saat ini: ${rootWeightSum.toFixed(2)}%). Silakan sesuaikan bobot.`
      );
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        nodes: convertUiNodesToSavePayload(wbsData),
      };

      const res = await ProjectService.saveWbsTree(canonicalProjectId, payload);
      const serverTree = convertBackendTreeToUiNodes(res?.data || []);

      setWbsData(serverTree);
      setExpandedRowKeys(getAllNodeIds(serverTree));
      setIsDirty(false);
      setIsServerSynced(true);
      setHasLegacyDraft(false);

      const nowStr = new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      setLastSavedTime(nowStr);
      setSaveStatusText(`Tersimpan di Server (${nowStr})`);

      message.success(`Struktur WBS berhasil disimpan ke Database Server (pukul ${nowStr})`);

      // Clean up legacy localStorage draft key since server is now canonical SSOT
      if (storageKey && typeof window !== 'undefined') {
        localStorage.removeItem(storageKey);
      }

      if (onSaveDraft) {
        onSaveDraft(serverTree);
      }
    } catch (err: any) {
      console.error('Failed to save WBS to server:', err);
      const errorMsg = err?.response?.data?.message || err?.message || 'Gagal menyimpan struktur WBS ke database server';
      message.error(errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  // Safe Close Handler with Dirty State Confirmation
  const handleSafeClose = () => {
    if (isDirty) {
      Modal.confirm({
        title: 'Perubahan WBS Belum Disimpan ke Server',
        content: 'Anda memiliki perubahan struktur WBS yang belum disimpan ke Database Server. Apakah Anda yakin ingin menutup tanpa menyimpan?',
        okText: 'Tutup & Abaikan Perubahan',
        cancelText: 'Lanjutkan Edit',
        okType: 'danger',
        onOk: () => {
          setIsDirty(false);
          onClose();
        },
      });
    } else {
      onClose();
    }
  };

  // Template loader
  const handleLoadTemplate = () => {
    const attachIds = (items: TemplateWbsItem[], parentId: string | null = null): WbsNodeItem[] => {
      return items.map((item, idx) => {
        const id = `wbs-template-${Date.now()}-${Math.random().toString(36).substring(2, 7)}-${idx}`;
        return {
          ...item,
          id,
          parentId,
          children: item.children ? attachIds(item.children, id) : undefined,
        };
      });
    };

    const loadedNodes = recomputeWbsHierarchy(attachIds(STANDARD_TELECOM_TEMPLATE));
    setWbsData(loadedNodes);
    setExpandedRowKeys(getAllNodeIds(loadedNodes));
    setIsDirty(true);
    message.info('Template standar WBS berhasil dimuat. Klik "Simpan ke Server" untuk menyimpan.');
  };

  // Reset Draft
  const handleResetWbs = () => {
    setWbsData([]);
    setExpandedRowKeys([]);
    setIsDirty(true);
    message.warning('Struktur WBS telah dikosongkan. Klik "Simpan ke Server" untuk menerapkan.');
  };

  // Expand / Collapse all
  const handleExpandAll = () => {
    setExpandedRowKeys(getAllNodeIds(wbsData));
  };

  const handleCollapseAll = () => {
    setExpandedRowKeys([]);
  };

  // Open Add Root Modal
  const handleOpenAddRoot = () => {
    setNodeModalMode('ADD_ROOT');
    setTargetParentNode(null);
    setTargetEditNode(null);
    nodeForm.resetFields();
    nodeForm.setFieldsValue({
      name: '',
      weightPercentage: 10,
      description: '',
    });
    setIsNodeModalOpen(true);
  };

  // Open Add Child Modal
  const handleOpenAddChild = (parent: WbsNodeItem) => {
    setNodeModalMode('ADD_CHILD');
    setTargetParentNode(parent);
    setTargetEditNode(null);
    nodeForm.resetFields();
    nodeForm.setFieldsValue({
      name: '',
      weightPercentage: 5,
      description: '',
    });
    setIsNodeModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditNode = (node: WbsNodeItem) => {
    setNodeModalMode('EDIT');
    setTargetParentNode(null);
    setTargetEditNode(node);
    nodeForm.resetFields();
    nodeForm.setFieldsValue({
      name: node.name,
      weightPercentage: node.weightPercentage,
      description: node.description || '',
    });
    setIsNodeModalOpen(true);
  };

  // Submit Modal Form (Add / Edit)
  const handleNodeFormSubmit = () => {
    nodeForm.validateFields().then((values) => {
      const { name, weightPercentage, description } = values;

      if (nodeModalMode === 'ADD_ROOT') {
        const newNode: WbsNodeItem = {
          id: `wbs-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          dbId: undefined,
          code: '',
          name: name.trim(),
          level: 1,
          weightPercentage: Number(weightPercentage) || 0,
          description: description?.trim() || '',
          parentId: null,
          children: [],
        };
        const updated = recomputeWbsHierarchy([...wbsData, newNode]);
        setWbsData(updated);
        setExpandedRowKeys((prev) => [...prev, newNode.id]);
        setIsDirty(true);
      } else if (nodeModalMode === 'ADD_CHILD' && targetParentNode) {
        const newNode: WbsNodeItem = {
          id: `wbs-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          dbId: undefined,
          code: '',
          name: name.trim(),
          level: targetParentNode.level + 1,
          weightPercentage: Number(weightPercentage) || 0,
          description: description?.trim() || '',
          parentId: targetParentNode.id,
          children: [],
        };

        const addChildRecursive = (nodes: WbsNodeItem[]): WbsNodeItem[] => {
          return nodes.map((node) => {
            if (String(node.id) === String(targetParentNode.id) || (node.dbId && targetParentNode.dbId && Number(node.dbId) === Number(targetParentNode.dbId))) {
              const currentChildren = node.children || [];
              return {
                ...node,
                children: [...currentChildren, newNode],
              };
            }
            if (node.children && node.children.length > 0) {
              return {
                ...node,
                children: addChildRecursive(node.children),
              };
            }
            return node;
          });
        };

        const updated = recomputeWbsHierarchy(addChildRecursive(wbsData));
        setWbsData(updated);
        setExpandedRowKeys((prev) => Array.from(new Set([...prev, targetParentNode.id, newNode.id])));
        setIsDirty(true);
      } else if (nodeModalMode === 'EDIT' && targetEditNode) {
        const updateRecursive = (nodes: WbsNodeItem[]): WbsNodeItem[] => {
          return nodes.map((node) => {
            if (String(node.id) === String(targetEditNode.id) || (node.dbId && targetEditNode.dbId && Number(node.dbId) === Number(targetEditNode.dbId))) {
              return {
                ...node,
                dbId: node.dbId ?? targetEditNode.dbId,
                name: name.trim(),
                weightPercentage: Number(weightPercentage) || 0,
                description: description?.trim() || '',
              };
            }
            if (node.children && node.children.length > 0) {
              return {
                ...node,
                children: updateRecursive(node.children),
              };
            }
            return node;
          });
        };

        const updated = recomputeWbsHierarchy(updateRecursive(wbsData));
        setWbsData(updated);
        setIsDirty(true);
      }

      setIsNodeModalOpen(false);
    });
  };

  // Delete Node (with child removal)
  const handleDeleteNode = (nodeToDelete: WbsNodeItem) => {
    const deleteRecursive = (nodes: WbsNodeItem[]): WbsNodeItem[] => {
      return nodes
        .filter((node) => String(node.id) !== String(nodeToDelete.id) && (!node.dbId || !nodeToDelete.dbId || Number(node.dbId) !== Number(nodeToDelete.dbId)))
        .map((node) => {
          if (node.children && node.children.length > 0) {
            return {
              ...node,
              children: deleteRecursive(node.children),
            };
          }
          return node;
        });
    };

    const updated = recomputeWbsHierarchy(deleteRecursive(wbsData));
    setWbsData(updated);
    setIsDirty(true);
    message.success(`Work Package / Item "${nodeToDelete.code} ${nodeToDelete.name}" berhasil dihapus.`);
  };

  // Filtered nodes for search
  const filteredData = useMemo(() => {
    if (!searchText.trim()) return wbsData;
    const lower = searchText.toLowerCase();

    const filterTree = (nodes: WbsNodeItem[]): WbsNodeItem[] => {
      return nodes
        .map((node) => {
          const matchSelf =
            node.name.toLowerCase().includes(lower) ||
            node.code.toLowerCase().includes(lower) ||
            (node.description && node.description.toLowerCase().includes(lower));

          const filteredChildren = node.children ? filterTree(node.children) : [];

          if (matchSelf || filteredChildren.length > 0) {
            return {
              ...node,
              children: filteredChildren.length > 0 ? filteredChildren : node.children,
            };
          }
          return null;
        })
        .filter(Boolean) as WbsNodeItem[];
    };

    return filterTree(wbsData);
  }, [wbsData, searchText]);

  // Level Badge Color Mapper
  const getLevelBadge = (level: number) => {
    if (level === 1) {
      return (
        <Tag color="blue" style={{ fontWeight: 700, borderRadius: 4 }}>
          Level 1 • Major Package
        </Tag>
      );
    }
    if (level === 2) {
      return (
        <Tag color="cyan" style={{ fontWeight: 600, borderRadius: 4 }}>
          Level 2 • Sub-Package
        </Tag>
      );
    }
    if (level === 3) {
      return (
        <Tag color="geekblue" style={{ fontWeight: 500, borderRadius: 4 }}>
          Level 3 • Deliverable
        </Tag>
      );
    }
    return (
      <Tag color="purple" style={{ fontWeight: 500, borderRadius: 4 }}>
        Level {level} • Detail
      </Tag>
    );
  };

  // Table Columns
  const columns = [
    {
      title: 'Kode WBS',
      dataIndex: 'code',
      key: 'code',
      width: 130,
      render: (code: string, record: WbsNodeItem) => {
        const isParent = record.children && record.children.length > 0;
        return (
          <Space size={4}>
            <Tag
              color={record.level === 1 ? '#1d4ed8' : record.level === 2 ? '#0284c7' : '#475569'}
              style={{
                fontFamily: 'monospace',
                fontWeight: 700,
                fontSize: 12,
                borderRadius: 4,
                padding: '1px 6px',
              }}
            >
              {code}
            </Tag>
            {isParent ? (
              <FolderOpenOutlined style={{ color: '#d97706', fontSize: 13 }} />
            ) : (
              <FileTextOutlined style={{ color: '#94a3b8', fontSize: 13 }} />
            )}
          </Space>
        );
      },
    },
    {
      title: 'Work Package / Scope Deliverable',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: WbsNodeItem) => (
        <div style={{ padding: '2px 0' }}>
          <Text
            strong={record.level === 1}
            style={{
              fontSize: record.level === 1 ? 13.5 : 12.5,
              color: record.level === 1 ? '#0f172a' : '#334155',
            }}
          >
            {name}
          </Text>
          {record.description && (
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
              {record.description}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Tingkat (Level)',
      dataIndex: 'level',
      key: 'level',
      width: 170,
      render: (level: number) => getLevelBadge(level),
    },
    {
      title: 'Bobot WBS (%)',
      dataIndex: 'weightPercentage',
      key: 'weightPercentage',
      width: 140,
      align: 'right' as const,
      render: (val: number, record: WbsNodeItem) => {
        const isParent = record.children && record.children.length > 0;
        return (
          <div style={{ textAlign: 'right' }}>
            <Text
              strong
              style={{
                fontSize: 13,
                color: isParent ? '#1d4ed8' : '#059669',
              }}
            >
              {Number(val || 0).toFixed(1)}%
            </Text>
            <Progress
              percent={Math.min(100, Number(val || 0))}
              size="small"
              showInfo={false}
              strokeColor={isParent ? '#3b82f6' : '#10b981'}
              style={{ margin: 0, padding: 0 }}
            />
          </div>
        );
      },
    },
    {
      title: 'Aksi',
      key: 'action',
      width: 210,
      align: 'center' as const,
      render: (_: any, record: WbsNodeItem) => {
        const subCount = countDescendants(record);
        return (
          <Space size={4}>
            <Tooltip title={`Tambah Sub Work Package di bawah ${record.code}`}>
              <Button
                size="small"
                type="link"
                icon={<PlusOutlined />}
                style={{ color: '#0284c7', fontSize: 11.5, padding: '0 4px', fontWeight: 600 }}
                onClick={() => handleOpenAddChild(record)}
              >
                Sub Work Package
              </Button>
            </Tooltip>

            <Tooltip title="Edit Work Package">
              <Button
                size="small"
                type="text"
                icon={<EditOutlined />}
                style={{ color: '#475569', fontSize: 12, padding: '0 4px' }}
                onClick={() => handleOpenEditNode(record)}
              />
            </Tooltip>

            {subCount > 0 ? (
              <Popconfirm
                title="Hapus Work Package & Sub-Item?"
                description={
                  <div style={{ maxWidth: 280 }}>
                    Work Package <strong>{record.code}</strong> memiliki <strong>{subCount} sub-item</strong>. Semua sub-item juga akan dihapus dari draft.
                  </div>
                }
                onConfirm={() => handleDeleteNode(record)}
                okText="Hapus Semua"
                cancelText="Batal"
                okButtonProps={{ danger: true }}
              >
                <Button
                  size="small"
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  style={{ fontSize: 12, padding: '0 4px' }}
                />
              </Popconfirm>
            ) : (
              <Popconfirm
                title="Hapus item WBS ini?"
                onConfirm={() => handleDeleteNode(record)}
                okText="Hapus"
                cancelText="Batal"
                okButtonProps={{ danger: true }}
              >
                <Button
                  size="small"
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  style={{ fontSize: 12, padding: '0 4px' }}
                />
              </Popconfirm>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <>
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 32 }}>
            <Space size={8}>
              <ApartmentOutlined style={{ color: '#1d4ed8', fontSize: 18 }} />
              <div>
                <span style={{ fontWeight: 700, fontSize: 16, color: '#0f172a' }}>
                  Struktur Rincian Kerja (WBS) — Pre-Kickoff Operational Plan
                </span>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 400 }}>
                  Penyusunan lingkup dan paket pekerjaan tersinkronisasi langsung dengan Database Server
                </div>
              </div>
            </Space>
            {isLoading ? (
              <Tag color="default" style={{ borderRadius: 12, padding: '2px 10px', fontWeight: 600 }}>
                <Spin size="small" style={{ marginRight: 6 }} /> MEMUAT DARI SERVER...
              </Tag>
            ) : isServerSynced && !isDirty ? (
              <Tag color="success" icon={<CheckCircleOutlined />} style={{ borderRadius: 12, padding: '2px 10px', fontWeight: 600 }}>
                DATABASE SSOT
              </Tag>
            ) : hasLegacyDraft ? (
              <Tag color="warning" icon={<CloudSyncOutlined />} style={{ borderRadius: 12, padding: '2px 10px', fontWeight: 600 }}>
                DRAFT PERLU SINKRONISASI
              </Tag>
            ) : isDirty ? (
              <Tag color="orange" icon={<EditOutlined />} style={{ borderRadius: 12, padding: '2px 10px', fontWeight: 600 }}>
                PERUBAHAN BELUM TERSIMPAN
              </Tag>
            ) : (
              <Tag color="default" style={{ borderRadius: 12, padding: '2px 10px', fontWeight: 600 }}>
                DRAFT WBS
              </Tag>
            )}
          </div>
        }
        open={open}
        onCancel={handleSafeClose}
        width={1180}
        footer={[
          <div key="footer-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space size={8}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                
                <strong>{saveStatusText}</strong>
              </Text>
            </Space>
            <Space size={8}>
              <Button onClick={handleSafeClose} style={{ borderRadius: 6 }}>
                Tutup
              </Button>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                loading={isSaving}
                disabled={isLoading || isSaving || !charter?.id}
                onClick={handleSaveToServer}
                style={{
                  backgroundColor: isDirty || hasLegacyDraft ? '#1d4ed8' : '#059669',
                  borderColor: isDirty || hasLegacyDraft ? '#1d4ed8' : '#059669',
                  borderRadius: 6,
                  fontWeight: 600,
                }}
              >
                {isSaving
                  ? 'Menyimpan ke Server...'
                  : hasLegacyDraft
                  ? 'Sync Draft ke Server'
                  : isDirty
                  ? 'Simpan Perubahan ke Server'
                  : 'Tersimpan di Server'}
              </Button>
            </Space>
          </div>,
        ]}
        style={{ top: 20 }}
      >
        <Spin spinning={isLoading} tip="Memuat struktur WBS dari Database Server...">
          <div style={{ maxHeight: 'calc(85vh - 120px)', overflowY: 'auto', paddingRight: 4 }}>
            {/* LEGACY DRAFT MIGRATION NOTICE */}
            {hasLegacyDraft && (
              <Alert
                type="warning"
                showIcon
                icon={<CloudUploadOutlined style={{ fontSize: 18 }} />}
                style={{ marginBottom: 16, borderRadius: 8, border: '1px solid #fde68a' }}
                message={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <strong>Ditemukan Draft WBS Lokal di Browser</strong> — Struktur WBS ini belum tersimpan di Database Server.
                    </div>
                    <Button
                      type="primary"
                      size="small"
                      icon={<CloudUploadOutlined />}
                      loading={isSaving}
                      onClick={handleSaveToServer}
                      style={{ backgroundColor: '#d97706', borderColor: '#d97706', fontWeight: 600, borderRadius: 6 }}
                    >
                      Sync Draft ke Server Sekarang
                    </Button>
                  </div>
                }
              />
            )}
          {/* READ-ONLY PROJECT REFERENCE BANNER */}
          {charter && (
            <Card
              size="small"
              style={{
                background: '#f8fafc',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                marginBottom: 16,
              }}
            >
              <Row gutter={[16, 8]} align="middle">
                <Col xs={24} sm={12} md={8}>
                  <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
                    NAMA PROYEK & KODE SPK (READ-ONLY)
                  </Text>
                  <Text strong style={{ fontSize: 13, color: '#0f172a' }}>
                    {charter.project_name}
                  </Text>
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    Ref Code: <Tag color="blue" style={{ fontSize: 10 }}>{charter.project_code}</Tag>
                  </div>
                </Col>

                <Col xs={24} sm={12} md={5}>
                  <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
                    KLIEN / CUSTOMER
                  </Text>
                  <Text strong style={{ fontSize: 13, color: '#334155' }}>
                    {charter.customerName || '-'}
                  </Text>
                </Col>

                <Col xs={12} sm={6} md={5}>
                  <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
                    NILAI SPK LEGAL (READ-ONLY)
                  </Text>
                  <Text strong style={{ fontSize: 13, color: '#1d4ed8' }}>
                    Rp {Number(charter.contract_total_value || 0).toLocaleString('id-ID')}
                  </Text>
                </Col>

                <Col xs={12} sm={6} md={6}>
                  <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
                    ESTIMASI BUDGET PROYEK
                  </Text>
                  <Text strong style={{ fontSize: 13, color: '#059669' }}>
                    Rp {Number(charter.project_budget || charter.contract_total_value || 0).toLocaleString('id-ID')}
                  </Text>
                </Col>
              </Row>
            </Card>
          )}

          {/* WBS KPI SUMMARY CARDS */}
          <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
            <Col xs={12} sm={6} md={6}>
              <Card size="small" style={{ borderRadius: 8, border: '1px solid #e2e8f0', background: '#ffffff' }}>
                <Text type="secondary" style={{ fontSize: 11 }}>MAJOR WORK PACKAGES</Text>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#1d4ed8' }}>
                  {rootCount} <span style={{ fontSize: 12, fontWeight: 400, color: '#64748b' }}>Paket Utama</span>
                </div>
              </Card>
            </Col>

            <Col xs={12} sm={6} md={6}>
              <Card size="small" style={{ borderRadius: 8, border: '1px solid #e2e8f0', background: '#ffffff' }}>
                <Text type="secondary" style={{ fontSize: 11 }}>DELIVERABLES / LEAF</Text>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                  {leafNodesCount} <span style={{ fontSize: 12, fontWeight: 400, color: '#64748b' }}>Deliverables</span>
                </div>
              </Card>
            </Col>

            <Col xs={12} sm={6} md={6}>
              <Card size="small" style={{ borderRadius: 8, border: '1px solid #e2e8f0', background: '#ffffff' }}>
                <Text type="secondary" style={{ fontSize: 11 }}>STRUKTUR HIERARKI</Text>
                <div style={{ fontSize: 18, fontWeight: 700, color: structureMetrics.isStructured ? '#059669' : '#0284c7' }}>
                  {wbsData.length === 0
                    ? '—'
                    : structureMetrics.isStructured
                    ? `Level ${structureMetrics.maxHierarchyDepth}`
                    : 'Level 1 (Flat)'}
                </div>
                <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 2 }}>
                  {wbsData.length === 0
                    ? 'Belum ada node'
                    : structureMetrics.isStructured
                    ? `${structureMetrics.nestedNodeCount} Sub-item Terstruktur`
                    : 'Tanpa Sub-Package'}
                </div>
              </Card>
            </Col>

            <Col xs={12} sm={6} md={6}>
              <Card
                size="small"
                style={{
                  borderRadius: 8,
                  border: `1px solid ${isWeightValid ? '#86efac' : '#fde68a'}`,
                  background: isWeightValid ? '#f0fdf4' : '#fffbeb',
                }}
              >
                <Text type="secondary" style={{ fontSize: 11 }}>TOTAL BOBOT SCOPE</Text>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: isWeightValid ? '#15803d' : '#b45309',
                  }}
                >
                  {rootWeightSum.toFixed(1)}%
                </div>
                <div style={{ fontSize: 10.5, color: isWeightValid ? '#15803d' : '#b45309', marginTop: 2, fontWeight: 600 }}>
                  {isWeightValid ? 'Bobot Scope Valid' : 'Belum 100.0%'}
                </div>
              </Card>
            </Col>
          </Row>

          {/* EDUCATIONAL ALERT IF STRUCTURE IS FLAT (NON-BLOCKING) */}
          {structureMetrics.isFlat && wbsData.length > 0 && (
            <Alert
              type="info"
              showIcon
              message={
                <Space size={8}>
                  <Text strong style={{ fontSize: 12 }}>Struktur WBS Masih Flat (Level 1)</Text>
                  <Tag color="blue" style={{ fontSize: 10 }}>INFORMASIONAL</Tag>
                </Space>
              }
              description={
                <span style={{ fontSize: 11.5 }}>
                  Semua pekerjaan saat ini berada pada Level 1. Gunakan <strong>+ Sub Work Package</strong> pada baris pekerjaan bila diperlukan untuk memecah paket kerja menjadi deliverables yang lebih terperinci. (Struktur flat tetap valid untuk proyek sederhana).
                </span>
              }
              style={{ marginBottom: 16, borderRadius: 8, background: '#f0f9ff', borderColor: '#bae6fd' }}
            />
          )}

          {/* WARNING ALERT IF WEIGHT != 100% */}
          {!isWeightValid && wbsData.length > 0 && (
            <Alert
              type="warning"
              showIcon
              icon={<WarningOutlined style={{ color: '#d97706' }} />}
              message="Total Bobot WBS Belum Mencapai 100%"
              description={
                <span style={{ fontSize: 12 }}>
                  Total bobot WBS saat ini adalah <strong>{rootWeightSum.toFixed(1)}%</strong>. Pastikan total pembagian bobot seluruh Work Package bernilai tepat <strong>100.0%</strong> sebelum melakukan submit paket operasional.
                </span>
              }
              style={{ marginBottom: 16, borderRadius: 8 }}
            />
          )}

          {/* TOOLBAR CONTROLS */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 8,
              marginBottom: 12,
              padding: '8px 12px',
              background: '#f1f5f9',
              borderRadius: 8,
            }}
          >
            <Space size={8} wrap>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleOpenAddRoot}
                style={{ backgroundColor: '#1d4ed8', borderColor: '#1d4ed8', borderRadius: 6, fontWeight: 600 }}
              >
                Tambah Work Package Utama
              </Button>
              <Button
                size="middle"
                icon={<NodeExpandOutlined />}
                onClick={handleExpandAll}
                disabled={wbsData.length === 0}
                style={{ borderRadius: 6 }}
              >
                Expand Semua
              </Button>
              <Button
                size="middle"
                icon={<NodeCollapseOutlined />}
                onClick={handleCollapseAll}
                disabled={wbsData.length === 0}
                style={{ borderRadius: 6 }}
              >
                Collapse Semua
              </Button>
            </Space>

            <Space size={8} wrap>
              <Input
                placeholder="Cari Work Package / Scope..."
                prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{ width: 220, borderRadius: 6 }}
                disabled={wbsData.length === 0}
                allowClear
              />

              {wbsData.length === 0 ? (
                <Button
                  icon={<FileDoneOutlined />}
                  onClick={handleLoadTemplate}
                  style={{ borderRadius: 6, color: '#0369a1', borderColor: '#7dd3fc', background: '#f0f9ff' }}
                >
                  Muat Template Standar
                </Button>
              ) : (
                <Popconfirm
                  title="Kosongkan Struktur WBS?"
                  description="Semua paket pekerjaan yang telah disusun dalam draft lokal akan dihapus."
                  onConfirm={handleResetWbs}
                  okText="Kosongkan"
                  cancelText="Batal"
                  okButtonProps={{ danger: true }}
                >
                  <Button danger icon={<ReloadOutlined />} style={{ borderRadius: 6 }}>
                    Reset WBS
                  </Button>
                </Popconfirm>
              )}
            </Space>
          </div>

          {/* INTERACTIVE TREE TABLE */}
          {wbsData.length === 0 ? (
            <Card style={{ borderRadius: 8, border: '1px dashed #cbd5e1', textAlign: 'center', padding: '36px 16px' }}>
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <div>
                    <Text strong style={{ fontSize: 14, color: '#334155', display: 'block', marginBottom: 4 }}>
                      Belum ada struktur pekerjaan WBS
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Mulai dengan membuat Work Package Utama atau gunakan template standar.
                    </Text>
                  </div>
                }
              >
                <Space size={8} style={{ marginTop: 12 }}>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={handleOpenAddRoot}
                    style={{ backgroundColor: '#1d4ed8', borderColor: '#1d4ed8', borderRadius: 6, fontWeight: 600 }}
                  >
                    Tambah Work Package Utama
                  </Button>
                  <Button
                    icon={<FileDoneOutlined />}
                    onClick={handleLoadTemplate}
                    style={{ borderRadius: 6, color: '#0369a1', borderColor: '#7dd3fc', background: '#f0f9ff' }}
                  >
                    Gunakan Template Standar
                  </Button>
                </Space>
              </Empty>
            </Card>
          ) : (
            <Table
              columns={columns}
              dataSource={filteredData}
              rowKey="id"
              pagination={false}
              size="middle"
              bordered
              expandable={{
                expandedRowKeys,
                onExpandedRowsChange: (keys) => setExpandedRowKeys(keys as React.Key[]),
                rowExpandable: (record) => Boolean(record.children && record.children.length > 0),
              }}
              rowClassName={(record) => (record.level === 1 ? 'wbs-root-row' : 'wbs-child-row')}
              style={{
                borderRadius: 8,
                overflow: 'hidden',
              }}
            />
          )}

          {/* FUTURE EXTENSION CONTEXT NOTE */}
          <div style={{ marginTop: 16, padding: '8px 12px', background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
            <Text type="secondary" style={{ fontSize: 11 }}>
              <strong>Catatan Teknis PMO:</strong> Struktur WBS ini tersinkronisasi langsung dengan Database Server per project charter. Elemen level terbawah (Leaf Deliverable) menjadi basis otomatis untuk alokasi biaya pada modul <strong>Cost Estimation</strong> dan jadwal kerja pada modul <strong>Schedule & Gantt Chart</strong>.
            </Text>
          </div>
        </div>
      </Spin>
    </Modal>

      {/* MODAL TAMBAH / EDIT NODE */}
      <Modal
        title={
          <Space>
            <ApartmentOutlined style={{ color: '#1d4ed8', fontSize: 16 }} />
            <span style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>
              {nodeModalMode === 'ADD_ROOT' && 'Tambah Work Package Utama'}
              {nodeModalMode === 'ADD_CHILD' && (
                <Space size={6}>
                  <span>Tambah Sub Work Package</span>
                  {targetParentNode && (
                    <Tag color="blue" style={{ fontSize: 11, fontWeight: 700, margin: 0 }}>
                      Induk: {targetParentNode.code} {targetParentNode.name}
                    </Tag>
                  )}
                </Space>
              )}
              {nodeModalMode === 'EDIT' && `Edit Work Package [${targetEditNode?.code}]`}
            </span>
          </Space>
        }
        open={isNodeModalOpen}
        onCancel={() => {
          setIsNodeModalOpen(false);
          setTargetParentNode(null);
          setTargetEditNode(null);
          setNodeModalMode('ADD_ROOT');
        }}
        onOk={handleNodeFormSubmit}
        okText={nodeModalMode === 'EDIT' ? 'Perbarui Item' : 'Tambahkan'}
        cancelText="Batal"
        okButtonProps={{ style: { backgroundColor: '#1d4ed8', borderColor: '#1d4ed8' } }}
        width={560}
      >
        <Form form={nodeForm} layout="vertical" style={{ marginTop: 16 }}>
          {/* Parent Node Context for Child */}
          {nodeModalMode === 'ADD_CHILD' && targetParentNode && (
            <Form.Item label={<Text strong style={{ fontSize: 13 }}>Parent Work Package</Text>} style={{ marginBottom: 12 }}>
              <Input
                disabled
                value={`${targetParentNode.code} — ${targetParentNode.name}`}
                style={{ background: '#f8fafc', color: '#0f172a', fontWeight: 600 }}
              />
            </Form.Item>
          )}

          <Form.Item
            name="name"
            label={<Text strong style={{ fontSize: 13 }}>Nama Pekerjaan / Deliverable</Text>}
            rules={[{ required: true, message: 'Nama pekerjaan wajib diisi minimal 3 karakter!' }]}
          >
            <Input
              placeholder={nodeModalMode === 'ADD_ROOT' ? 'Contoh: Pekerjaan Sipil & Penarikan Kabel' : 'Contoh: Pengadaan Material Kabel FO 24 Core'}
              maxLength={150}
              showCount
              autoFocus
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="weightPercentage"
                label={
                  <Space size={4}>
                    <Text strong style={{ fontSize: 13 }}>Bobot WBS (%)</Text>
                    <Tooltip title="Estimasi proporsi bobot penyelesaian terhadap keseluruhan proyek (0 - 100%)">
                      <InfoCircleOutlined style={{ color: '#94a3b8', fontSize: 12 }} />
                    </Tooltip>
                  </Space>
                }
                rules={[{ required: true, message: 'Bobot wajib diisi!' }]}
              >
                <InputNumber
                  min={0}
                  max={100}
                  step={0.5}
                  precision={1}
                  style={{ width: '100%' }}
                  addonAfter="%"
                  placeholder="10.0"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={<Text strong style={{ fontSize: 13 }}>Tingkat</Text>}>
                <Input
                  disabled
                  value={
                    nodeModalMode === 'ADD_ROOT'
                      ? 'Level 1 · Work Package Utama'
                      : nodeModalMode === 'ADD_CHILD'
                      ? `Level ${(targetParentNode?.level || 1) + 1} · otomatis`
                      : `Level ${targetEditNode?.level || 1} · ${targetEditNode?.level === 1 ? 'Work Package Utama' : 'Sub Work Package'}`
                  }
                  style={{ background: '#f1f5f9', color: '#334155' }}
                />
              </Form.Item>
            </Col>
          </Row>

          {/* Helper / Guidance Text */}
          <div style={{ marginBottom: 14, padding: '6px 10px', background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
            <Text type="secondary" style={{ fontSize: 11.5, display: 'block' }}>
              {nodeModalMode === 'ADD_ROOT' && 'Work Package Utama menjadi level pertama dalam struktur WBS.'}
              {nodeModalMode === 'ADD_CHILD' && 'Level dan kode WBS ditentukan otomatis berdasarkan Work Package induk yang dipilih.'}
              {nodeModalMode === 'EDIT' && 'Perubahan nama dan bobot akan memperbarui ringkasan alokasi operasional secara otomatis.'}
            </Text>
          </div>

          <Form.Item
            name="description"
            label={<Text strong style={{ fontSize: 13 }}>Keterangan Scope (Opsional)</Text>}
          >
            <Input.TextArea
              rows={3}
              placeholder="Tuliskan catatan teknis ruang lingkup, standar material, atau deliverables yang disyaratkan..."
              maxLength={300}
              showCount
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};
