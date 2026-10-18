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
  Select,
  Divider,
  Alert,
  Radio,
  Popconfirm,
  Tooltip,
  message,
  Progress,
  Spin,
  Badge,
} from 'antd';
import {
  CalculatorOutlined,
  DollarOutlined,
  PlusOutlined,
  DeleteOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  SaveOutlined,
  AppstoreOutlined,
  FileTextOutlined,
  ReloadOutlined,
  PercentageOutlined,
  SettingOutlined,
  ApartmentOutlined,
  DownOutlined,
  UpOutlined,
  WarningOutlined,
  CloudSyncOutlined,
  CloudUploadOutlined,
  LockOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { ProjectCharter } from '../ProjectOperationTab';
import { WbsNodeItem } from './WbsTreeTableModal';
import { ProjectService } from '@/services/project.service';

const { Title, Text } = Typography;
const { TextArea } = Input;

export type CostGroupKey = 'DIRECT' | 'INDIRECT' | 'RISK';

export type ResourceType =
  | 'MATERIAL'
  | 'LABOR'
  | 'EQUIPMENT'
  | 'SERVICE'
  | 'SUBCONTRACTOR'
  | 'ALLOWANCE';

export type CostSource =
  | 'PM_ESTIMATE'
  | 'PROCUREMENT_REFERENCE'
  | 'HISTORICAL_PRICE'
  | 'VENDOR_QUOTE'
  | 'CONTRACT_SCHEDULE_RATE';

export type RateType = 'UNIT_RATE' | 'TIME_BASED' | 'LUMP_SUM';

export type CostAssignmentScope = 'WBS' | 'PROJECT' | 'UNASSIGNED';

export const ASSIGNMENT_SCOPE_OPTIONS: { label: string; value: CostAssignmentScope; desc: string }[] = [
  { label: 'Pekerjaan WBS', value: 'WBS', desc: 'Biaya terkait pekerjaan / scope deliverable WBS tertentu' },
  { label: 'Project-Level', value: 'PROJECT', desc: 'Biaya berlaku untuk keseluruhan project (overhead, mobilisasi, insurance, risk)' },
  { label: 'Belum Ditentukan', value: 'UNASSIGNED', desc: 'PM belum menentukan alokasi scope biaya ini' },
];

export interface CostItemDetail {
  id: string;
  itemName: string;
  description?: string;
  quantity: number;
  uom: string;
  rateType?: RateType;
  unitPrice: number;
  subtotal: number;
  resourceType?: ResourceType;
  costSource?: CostSource;
  assignmentScope?: CostAssignmentScope;
  wbsNodeId?: string;
  notes?: string;
}

export interface CostCategoryEstimation {
  categoryKey: string;
  categoryLabel: string;
  groupKey?: CostGroupKey;
  mode: 'DIRECT' | 'ITEMIZED';
  directSubtotal: number;
  items: CostItemDetail[];
  categoryTotal: number;
}

export interface CostGroupConfig {
  key: CostGroupKey;
  label: string;
  description: string;
  categoryKeys: string[];
}

export const COST_GROUP_CONFIGS: CostGroupConfig[] = [
  {
    key: 'DIRECT',
    label: '1. DIRECT PROJECT COSTS',
    description: 'Biaya langsung pelaksanaan fisik pekerjaan proyek (Material, Tenaga Kerja, Subkon)',
    categoryKeys: ['MATERIAL', 'LABOR', 'SUBCONTRACTOR'],
  },
  {
    key: 'INDIRECT',
    label: '2. INDIRECT PROJECT COSTS',
    description: 'Biaya pendukung pelaksanaan, armada, perizinan, dan fasilitas lapangan',
    categoryKeys: ['EQUIPMENT', 'PERMIT', 'OPERATIONAL'],
  },
  {
    key: 'RISK',
    label: '3. RISK & CONTINGENCY',
    description: 'Cadangan moneter untuk antisipasi kendala tak terduga dan fluktuasi lapangan',
    categoryKeys: ['CONTINGENCY'],
  },
];

export const DEFAULT_CATEGORIES: { key: string; label: string; groupKey: CostGroupKey }[] = [
  { key: 'MATERIAL', label: 'Material & Consumables', groupKey: 'DIRECT' },
  { key: 'LABOR', label: 'Tenaga Kerja Internal / In-House (Non-Procurement)', groupKey: 'DIRECT' },
  { key: 'SUBCONTRACTOR', label: 'Jasa Subkontraktor / Vendor Pihak Ketiga (Procurement-Eligible)', groupKey: 'DIRECT' },
  { key: 'EQUIPMENT', label: 'Sewa Alat & Perlengkapan (Procurement-Eligible)', groupKey: 'INDIRECT' },
  { key: 'PERMIT', label: 'Perizinan, Koordinasi & Retribusi', groupKey: 'INDIRECT' },
  { key: 'OPERATIONAL', label: 'Operasional, Logistik & Direksi Keet (Procurement-Eligible)', groupKey: 'INDIRECT' },
  { key: 'CONTINGENCY', label: 'Contingency / Dana Cadangan Risiko', groupKey: 'RISK' },
];

export const COMMON_UOMS = [
  'Unit', 'Set', 'Titik', 'Batang', 'Pack', 'Box', 'Meter', 'Km', 'M2', 'M3', 'Kg', 'Ton',
  'Hari', 'Bulan', 'Orang/Hari', 'Orang/Bulan', 'Lot', 'Ls', 'Rit', 'Trip'
];

export const RESOURCE_TYPE_OPTIONS: { label: string; value: ResourceType }[] = [
  { label: 'Material', value: 'MATERIAL' },
  { label: 'Tenaga Kerja Internal / In-House (Non-Procurement)', value: 'LABOR' },
  { label: 'Peralatan / Sewa Alat (Procurement-Eligible)', value: 'EQUIPMENT' },
  { label: 'Jasa (Service)', value: 'SERVICE' },
  { label: 'Jasa Subkontraktor / Vendor (Procurement-Eligible)', value: 'SUBCONTRACTOR' },
  { label: 'Allowance / Cadangan', value: 'ALLOWANCE' },
];

export const COST_SOURCE_OPTIONS: { label: string; value: CostSource }[] = [
  { label: 'Estimasi Mandiri PM', value: 'PM_ESTIMATE' },
  { label: 'Referensi Katalog Procurement', value: 'PROCUREMENT_REFERENCE' },
  { label: 'Harga Historis Proyek Sejenis', value: 'HISTORICAL_PRICE' },
  { label: 'Penawaran Resmi Vendor / Subkon', value: 'VENDOR_QUOTE' },
  { label: 'Schedule of Rates Kontrak', value: 'CONTRACT_SCHEDULE_RATE' },
];

export const RATE_TYPE_OPTIONS: { label: string; value: RateType }[] = [
  { label: 'Tarif Satuan (Unit Rate)', value: 'UNIT_RATE' },
  { label: 'Berbasis Waktu (Time-based)', value: 'TIME_BASED' },
  { label: 'Lump Sum (Borongan)', value: 'LUMP_SUM' },
];

export function getWbsLeafNodes(nodes: WbsNodeItem[]): { id: string; code: string; name: string; level: number }[] {
  const leaves: { id: string; code: string; name: string; level: number }[] = [];
  function traverse(list: WbsNodeItem[]) {
    for (const item of list) {
      if (!item.children || item.children.length === 0) {
        leaves.push({ id: String(item.id), code: item.code, name: item.name, level: item.level });
      } else {
        traverse(item.children);
      }
    }
  }
  traverse(nodes);
  return leaves;
}

export function buildWbsHierarchyOptions(nodes: WbsNodeItem[]): any[] {
  const options: any[] = [];
  function traverse(list: WbsNodeItem[], prefix = '') {
    for (const item of list) {
      const isLeaf = !item.children || item.children.length === 0;
      options.push({
        value: item.id,
        label: `${prefix}${item.code} · ${item.name}${!isLeaf ? ' [Paket Utama]' : ''}`,
        disabled: !isLeaf,
        code: item.code,
        name: item.name,
        isLeaf,
      });
      if (item.children && item.children.length > 0) {
        traverse(item.children, `${prefix}  `);
      }
    }
  }
  traverse(nodes);
  return options;
}

export interface CostWbsAllocationSummary {
  totalItemizedItems: number;
  mappedItemsCount: number;
  projectLevelItemsCount: number;
  unassignedItemsCount: number;
  orphanedItemsCount: number;
  totalItemizedCost: number;
  totalAllocatedCost: number;
  totalProjectLevelCost: number;
  totalUnallocatedCost: number;
  directModeCost: number;
  wbsCostList: { wbsId: string; wbsCode: string; wbsName: string; totalCost: number; itemCount: number }[];
}

export function computeCostWbsReconciliation(
  categories: CostCategoryEstimation[],
  wbsData: WbsNodeItem[]
): CostWbsAllocationSummary {
  const leaves = getWbsLeafNodes(wbsData);
  const leafMap = new Map<string, { id: string; code: string; name: string }>();
  for (const l of leaves) {
    leafMap.set(String(l.id), l);
  }

  let totalItemizedItems = 0;
  let mappedItemsCount = 0;
  let projectLevelItemsCount = 0;
  let unassignedItemsCount = 0;
  let orphanedItemsCount = 0;
  let totalItemizedCost = 0;
  let totalAllocatedCost = 0;
  let totalProjectLevelCost = 0;
  let directModeCost = 0;

  const wbsCostMap = new Map<string, { wbsId: string; wbsCode: string; wbsName: string; totalCost: number; itemCount: number }>();

  for (const cat of categories) {
    if (cat.mode === 'DIRECT') {
      directModeCost += Number(cat.directSubtotal || 0);
    } else {
      for (const item of cat.items || []) {
        totalItemizedItems += 1;
        const sub = Number(item.subtotal || 0);
        totalItemizedCost += sub;

        const targetWbsId = item.wbsNodeId !== undefined && item.wbsNodeId !== null && String(item.wbsNodeId).trim() !== ''
          ? String(item.wbsNodeId)
          : (item as any).wbsId !== undefined && (item as any).wbsId !== null && String((item as any).wbsId).trim() !== ''
          ? String((item as any).wbsId)
          : undefined;

        const effectiveScope: CostAssignmentScope = item.assignmentScope
          ? item.assignmentScope
          : targetWbsId
          ? 'WBS'
          : 'UNASSIGNED';

        if (effectiveScope === 'PROJECT') {
          projectLevelItemsCount += 1;
          totalProjectLevelCost += sub;
        } else if (effectiveScope === 'WBS') {
          if (targetWbsId) {
            const wbsLeaf = leafMap.get(targetWbsId);
            if (wbsLeaf) {
              mappedItemsCount += 1;
              totalAllocatedCost += sub;

              const existing = wbsCostMap.get(wbsLeaf.id) || {
                wbsId: wbsLeaf.id,
                wbsCode: wbsLeaf.code,
                wbsName: wbsLeaf.name,
                totalCost: 0,
                itemCount: 0,
              };
              existing.totalCost += sub;
              existing.itemCount += 1;
              wbsCostMap.set(wbsLeaf.id, existing);
            } else {
              orphanedItemsCount += 1;
              unassignedItemsCount += 1;
            }
          } else {
            unassignedItemsCount += 1;
          }
        } else {
          unassignedItemsCount += 1;
        }
      }
    }
  }

  const totalUnallocatedCost = totalItemizedCost - (totalAllocatedCost + totalProjectLevelCost);
  const wbsCostList = Array.from(wbsCostMap.values()).sort((a, b) =>
    a.wbsCode.localeCompare(b.wbsCode, undefined, { numeric: true })
  );

  return {
    totalItemizedItems,
    mappedItemsCount,
    projectLevelItemsCount,
    unassignedItemsCount,
    orphanedItemsCount,
    totalItemizedCost,
    totalAllocatedCost,
    totalProjectLevelCost,
    totalUnallocatedCost,
    directModeCost,
    wbsCostList,
  };
}


export function mapBackendEstimateToCategories(categoriesFromBackend?: any[]): CostCategoryEstimation[] {
  if (!categoriesFromBackend || categoriesFromBackend.length === 0) {
    return normalizeCostCategories([]);
  }

  const catMap = new Map<string, any>();
  for (const c of categoriesFromBackend) {
    catMap.set(c.categoryKey, c);
  }

  return DEFAULT_CATEGORIES.map((defCat) => {
    const bCat = catMap.get(defCat.key);
    if (bCat) {
      const items: CostItemDetail[] = (bCat.items || []).map((item: any) => ({
        id: item.id ? String(item.id) : `item_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        itemName: item.itemName || '',
        description: item.description || '',
        quantity: Number(item.quantity) || 0,
        uom: item.uom || 'Unit',
        rateType: item.rateType || 'UNIT_RATE',
        unitPrice: Number(item.unitPrice) || 0,
        subtotal: Number(item.subtotal) || (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
        resourceType: item.resourceType || undefined,
        costSource: item.costSource || 'PM_ESTIMATE',
        assignmentScope: item.assignmentScope || ((item.wbsId || item.wbsNodeId) ? 'WBS' : 'UNASSIGNED'),
        wbsNodeId: item.wbsId !== undefined && item.wbsId !== null ? String(item.wbsId) : (item.wbsNodeId ? String(item.wbsNodeId) : undefined),
        notes: item.notes || '',
      }));

      const mode = bCat.mode === 'ITEMIZED' ? 'ITEMIZED' : 'DIRECT';
      const directSubtotal = Number(bCat.directSubtotal) || 0;
      const categoryTotal = Number(bCat.categoryTotal) !== undefined && Number(bCat.categoryTotal) !== null
        ? Number(bCat.categoryTotal)
        : (mode === 'ITEMIZED' ? items.reduce((s, i) => s + i.subtotal, 0) : directSubtotal);

      return {
        categoryKey: defCat.key,
        categoryLabel: bCat.categoryLabel || defCat.label,
        groupKey: defCat.groupKey,
        mode,
        directSubtotal,
        items,
        categoryTotal,
      };
    }

    return {
      categoryKey: defCat.key,
      categoryLabel: defCat.label,
      groupKey: defCat.groupKey,
      mode: 'DIRECT',
      directSubtotal: 0,
      items: [],
      categoryTotal: 0,
    };
  });
}

export function normalizeCostCategories(rawCategories?: any[]): CostCategoryEstimation[] {
  if (!rawCategories || rawCategories.length === 0) {
    return DEFAULT_CATEGORIES.map((cat) => ({
      categoryKey: cat.key,
      categoryLabel: cat.label,
      groupKey: cat.groupKey,
      mode: 'DIRECT',
      directSubtotal: 0,
      items: [],
      categoryTotal: 0,
    }));
  }

  const existingMap = new Map<string, any>();
  for (const raw of rawCategories) {
    existingMap.set(raw.categoryKey || raw.key, raw);
  }

  return DEFAULT_CATEGORIES.map((defCat) => {
    const existing = existingMap.get(defCat.key);
    if (existing) {
      const items: CostItemDetail[] = (existing.items || []).map((item: any) => ({
        id: item.id ? String(item.id) : `item_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        itemName: item.itemName || '',
        description: item.description || '',
        quantity: Number(item.quantity) || 0,
        uom: item.uom || 'Unit',
        rateType: item.rateType || 'UNIT_RATE',
        unitPrice: Number(item.unitPrice) || 0,
        subtotal: Number(item.subtotal) || (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
        resourceType: item.resourceType || undefined,
        costSource: item.costSource || 'PM_ESTIMATE',
        assignmentScope: item.assignmentScope || (item.wbsNodeId ? 'WBS' : 'UNASSIGNED'),
        wbsNodeId: item.wbsNodeId || (item.wbsId ? String(item.wbsId) : undefined),
        notes: item.notes || '',
      }));

      const mode = existing.mode === 'ITEMIZED' ? 'ITEMIZED' : 'DIRECT';
      const directSubtotal = Number(existing.directSubtotal) || 0;
      const categoryTotal = mode === 'ITEMIZED'
        ? items.reduce((sum, i) => sum + i.subtotal, 0)
        : directSubtotal;

      return {
        categoryKey: defCat.key,
        categoryLabel: defCat.label,
        groupKey: defCat.groupKey,
        mode,
        directSubtotal,
        items,
        categoryTotal,
      };
    }

    return {
      categoryKey: defCat.key,
      categoryLabel: defCat.label,
      groupKey: defCat.groupKey,
      mode: 'DIRECT',
      directSubtotal: 0,
      items: [],
      categoryTotal: 0,
    };
  });
}

export interface CostItemValidationError {
  itemName: string;
  categoryKey: string;
  reason: 'MISSING_WBS' | 'INVALID_OR_DELETED_WBS' | 'UNASSIGNED_SCOPE';
  message: string;
}

export interface ValidateCostEstimateOptions {
  allowUnassigned?: boolean;
}

export function validateCostEstimateItems(
  categories: CostCategoryEstimation[],
  activeLeafWbsIds?: Set<string | number> | null,
  options?: ValidateCostEstimateOptions
): { valid: boolean; error?: string; errors: CostItemValidationError[]; unassignedCount: number } {
  const errors: CostItemValidationError[] = [];
  let unassignedCount = 0;

  for (const cat of categories) {
    if (cat.mode !== 'ITEMIZED' || !cat.items) continue;

    for (const item of cat.items) {
      const hasValidNumericWbs =
        item.wbsNodeId !== undefined &&
        item.wbsNodeId !== null &&
        String(item.wbsNodeId).trim() !== '' &&
        String(item.wbsNodeId).trim() !== 'undefined' &&
        String(item.wbsNodeId).trim() !== 'null' &&
        !isNaN(Number(item.wbsNodeId));

      const effectiveScope: CostAssignmentScope =
        item.assignmentScope || (hasValidNumericWbs ? 'WBS' : 'UNASSIGNED');

      const itemLabel = item.itemName && item.itemName.trim() !== '' ? item.itemName.trim() : 'Item';

      if (effectiveScope === 'UNASSIGNED') {
        unassignedCount++;
        if (!options?.allowUnassigned) {
          errors.push({
            itemName: itemLabel,
            categoryKey: cat.categoryKey,
            reason: 'UNASSIGNED_SCOPE',
            message: `${itemLabel}: belum memiliki alokasi scope/WBS yang valid (UNASSIGNED).`,
          });
        }
      } else if (effectiveScope === 'WBS') {
        if (!hasValidNumericWbs) {
          errors.push({
            itemName: itemLabel,
            categoryKey: cat.categoryKey,
            reason: 'MISSING_WBS',
            message: `${itemLabel}: pilih WBS Deliverable terlebih dahulu.`,
          });
        } else if (activeLeafWbsIds && activeLeafWbsIds.size > 0) {
          const wbsIdStr = String(item.wbsNodeId).trim();
          const wbsIdNum = Number(item.wbsNodeId);
          const isPresentInActiveLeaves =
            activeLeafWbsIds.has(wbsIdStr) || activeLeafWbsIds.has(wbsIdNum);

          if (!isPresentInActiveLeaves) {
            errors.push({
              itemName: itemLabel,
              categoryKey: cat.categoryKey,
              reason: 'INVALID_OR_DELETED_WBS',
              message: `${itemLabel}: WBS Deliverable yang dipilih sudah tidak ada atau bukan leaf WBS. Silakan pilih kembali WBS Deliverable aktif.`,
            });
          }
        }
      }
      // effectiveScope === 'PROJECT' is valid project-level allocation per backend SSOT
    }
  }

  return {
    valid: errors.length === 0,
    error: errors.length > 0 ? errors[0].message : undefined,
    errors,
    unassignedCount,
  };
}

export function buildSaveCostEstimatePayload(
  categories: CostCategoryEstimation[],
  pmNotes: string
) {
  return {
    pmNotes: pmNotes ? pmNotes.trim() : null,
    categories: categories.map((cat) => ({
      categoryKey: cat.categoryKey,
      mode: cat.mode,
      directSubtotal: Number(cat.directSubtotal) || 0,
      items: cat.mode === 'ITEMIZED'
        ? (cat.items || []).map((item) => {
            const isNumericDbId = typeof item.id === 'number' || (!isNaN(Number(item.id)) && !String(item.id).startsWith('item_'));

            const hasValidNumericWbs =
              item.wbsNodeId !== undefined &&
              item.wbsNodeId !== null &&
              String(item.wbsNodeId).trim() !== '' &&
              String(item.wbsNodeId).trim() !== 'undefined' &&
              String(item.wbsNodeId).trim() !== 'null' &&
              !isNaN(Number(item.wbsNodeId));

            // Canonical Effective Scope
            const effectiveScope: CostAssignmentScope =
              item.assignmentScope || (hasValidNumericWbs ? 'WBS' : 'UNASSIGNED');

            // Derived WBS ID: only if effectiveScope === 'WBS' and numeric ID is valid
            const resolvedWbsId: number | null =
              effectiveScope === 'WBS' && hasValidNumericWbs
                ? Number(item.wbsNodeId)
                : null;

            return {
              id: isNumericDbId ? Number(item.id) : undefined,
              itemName: item.itemName || 'Item',
              description: item.description ? item.description.trim() : undefined,
              quantity: Number(item.quantity) || 1,
              uom: item.uom || 'Unit',
              rateType: item.rateType || 'UNIT_RATE',
              unitPrice: Number(item.unitPrice) || 0,
              subtotal: Number(item.subtotal) || 0,
              resourceType: item.resourceType || undefined,
              costSource: item.costSource || 'PM_ESTIMATE',
              assignmentScope: effectiveScope,
              wbsId: resolvedWbsId,
              notes: item.notes ? item.notes.trim() : undefined,
            };
          })
        : [],
    })),
  };
}

export interface PmCostEstimationModalProps {
  open: boolean;
  onClose: () => void;
  charter: ProjectCharter | null;
  wbsData?: WbsNodeItem[];
  onSaveDraft?: (draftData: any) => void;
  onNavigateToWbs?: () => void;
}

export const PmCostEstimationModal: React.FC<PmCostEstimationModalProps> = ({
  open,
  onClose,
  charter,
  wbsData = [],
  onSaveDraft,
  onNavigateToWbs,
}) => {
  const [categories, setCategories] = useState<CostCategoryEstimation[]>([]);
  const [pmNotes, setPmNotes] = useState<string>('');
  const [expandedItemIds, setExpandedItemIds] = useState<Record<string, boolean>>({});
  const [internalWbsData, setInternalWbsData] = useState<WbsNodeItem[]>(wbsData);

  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [dirtyState, setDirtyState] = useState<'CLEAN' | 'DIRTY' | 'SAVING' | 'ERROR'>('CLEAN');
  const [estimateId, setEstimateId] = useState<number | null>(null);
  const [estimateStatus, setEstimateStatus] = useState<string>('DRAFT');
  const [estimateVersion, setEstimateVersion] = useState<number>(1);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showSyncPrompt, setShowSyncPrompt] = useState<boolean>(false);

  const isApproved = estimateStatus === 'APPROVED';

  const loadEstimateFromApi = useCallback(async () => {
    if (!charter || (!charter.id && !charter.projectId)) {
      setFetchError('Project ID tidak tersedia.');
      setLoading(false);
      return;
    }
    const projectId = Number(charter?.projectId || charter?.id || 0);
    if (!projectId || isNaN(projectId)) {
      setFetchError('Project ID tidak valid.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setFetchError(null);
    setSaveError(null);

    if (!wbsData || wbsData.length === 0) {
      try {
        const wbsRes = await ProjectService.getWbsByProject(projectId);
        if (Array.isArray(wbsRes)) {
          const mappedWbs: WbsNodeItem[] = wbsRes.map((w: any) => ({
            id: String(w.id),
            dbId: Number(w.id),
            code: w.code,
            name: w.name,
            level: Number(w.level || 1),
            weightPercentage: Number(w.weightPercentage || 0),
            parentId: w.parentWbsId ? String(w.parentWbsId) : null,
          }));
          setInternalWbsData(mappedWbs);
        }
      } catch (err) {
        console.warn('WBS could not be loaded from API:', err);
      }
    } else {
      setInternalWbsData(wbsData);
    }

    try {
      const res = await ProjectService.getCostEstimate(projectId);
      if (res && res.id) {
        setEstimateId(Number(res.id));
        setEstimateStatus(res.status || 'DRAFT');
        setEstimateVersion(Number(res.version || 1));
        setPmNotes(res.pmNotes || '');
        const mappedCategories = mapBackendEstimateToCategories(res.categories);
        setCategories(mappedCategories);
        setDirtyState('CLEAN');
        setShowSyncPrompt(false);
      }
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 404) {
        const storageKey = `epms_cost_estimate_draft_${projectId}`;
        const legacyKey = `pm_cost_estimate_draft_${projectId}`;
        const legacyDraft = typeof window !== 'undefined' ? (localStorage.getItem(storageKey) || localStorage.getItem(legacyKey)) : null;
        if (legacyDraft) {
          try {
            const parsed = JSON.parse(legacyDraft);
            const hasItems = parsed.categories?.some((c: any) => (c.items && c.items.length > 0) || Number(c.directSubtotal) > 0);
            if (hasItems) {
              setShowSyncPrompt(true);
              setCategories(normalizeCostCategories(parsed.categories));
              setPmNotes(parsed.pmNotes || '');
              setDirtyState('DIRTY');
              setEstimateId(null);
              setEstimateStatus('DRAFT');
              setEstimateVersion(1);
              return;
            }
          } catch (e) {}
        }
        setEstimateId(null);
        setEstimateStatus('DRAFT');
        setEstimateVersion(1);
        setCategories(normalizeCostCategories([]));
        setPmNotes('');
        setDirtyState('CLEAN');
        setShowSyncPrompt(false);
      } else {
        const errMsg = err?.response?.data?.message || 'Data RAB dari server tidak dapat dimuat.';
        setFetchError(Array.isArray(errMsg) ? errMsg.join('. ') : errMsg);
      }
    } finally {
      setLoading(false);
    }
  }, [charter, wbsData]);

  useEffect(() => {
    if (open && charter) {
      loadEstimateFromApi();
    }
  }, [open, charter, loadEstimateFromApi]);

  const wbsLeaves = useMemo(() => getWbsLeafNodes(internalWbsData), [internalWbsData]);
  const wbsLeafMap = useMemo(() => {
    const map = new Map<string, { id: string; code: string; name: string }>();
    for (const leaf of wbsLeaves) {
      map.set(String(leaf.id), leaf);
      if ((leaf as any).dbId) {
        map.set(String((leaf as any).dbId), leaf);
      }
    }
    return map;
  }, [wbsLeaves]);

  const activeLeafWbsIds = useMemo(() => {
    const set = new Set<string | number>();
    for (const leaf of wbsLeaves) {
      set.add(String(leaf.id));
      set.add(Number(leaf.id));
      if ((leaf as any).dbId) {
        set.add(Number((leaf as any).dbId));
        set.add(String((leaf as any).dbId));
      }
    }
    return set;
  }, [wbsLeaves]);

  const costValidationResult = useMemo(() => {
    return validateCostEstimateItems(categories, activeLeafWbsIds);
  }, [categories, activeLeafWbsIds]);

  const costSaveValidationResult = useMemo(() => {
    return validateCostEstimateItems(categories, activeLeafWbsIds, { allowUnassigned: true });
  }, [categories, activeLeafWbsIds]);

  const isCostMappingValid = costValidationResult.valid;
  const isCostSaveable = costSaveValidationResult.valid;

  const wbsSelectOptions = useMemo(() => buildWbsHierarchyOptions(internalWbsData), [internalWbsData]);

  const reconciliation = useMemo(() => {
    return computeCostWbsReconciliation(categories, internalWbsData);
  }, [categories, internalWbsData]);

  const handleDirectSubtotalChange = (categoryKey: string, value: number | null) => {
    if (isApproved) return;
    const val = value || 0;
    setDirtyState('DIRTY');
    setCategories((prev) =>
      prev.map((cat) => {
        if (cat.categoryKey === categoryKey) {
          return {
            ...cat,
            directSubtotal: val,
            categoryTotal: val,
          };
        }
        return cat;
      })
    );
  };

  const handleModeChange = (categoryKey: string, newMode: 'DIRECT' | 'ITEMIZED') => {
    if (isApproved) return;
    setDirtyState('DIRTY');
    setCategories((prev) =>
      prev.map((cat) => {
        if (cat.categoryKey === categoryKey) {
          let catTotal = cat.directSubtotal;
          if (newMode === 'ITEMIZED') {
            catTotal = cat.items.reduce((sum, item) => sum + (item.subtotal || 0), 0);
          }
          return {
            ...cat,
            mode: newMode,
            categoryTotal: catTotal,
          };
        }
        return cat;
      })
    );
  };

  const handleAddItem = (categoryKey: string) => {
    if (isApproved) return;
    setDirtyState('DIRTY');
    const newItem: CostItemDetail = {
      id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      itemName: '',
      quantity: 1,
      uom: 'Unit',
      rateType: 'UNIT_RATE',
      unitPrice: 0,
      subtotal: 0,
      costSource: 'PM_ESTIMATE',
      assignmentScope: 'UNASSIGNED',
    };

    setCategories((prev) =>
      prev.map((cat) => {
        if (cat.categoryKey === categoryKey) {
          const updatedItems = [...cat.items, newItem];
          const newTotal = updatedItems.reduce((sum, i) => sum + i.subtotal, 0);
          return {
            ...cat,
            items: updatedItems,
            categoryTotal: newTotal,
          };
        }
        return cat;
      })
    );
  };

  const handleItemChange = (
    categoryKey: string,
    itemId: string,
    field: keyof CostItemDetail,
    value: any
  ) => {
    if (isApproved) return;
    setDirtyState('DIRTY');
    setCategories((prev) =>
      prev.map((cat) => {
        if (cat.categoryKey === categoryKey) {
          const updatedItems = cat.items.map((item) => {
            if (item.id === itemId) {
              const updated = { ...item, [field]: value };
              if (field === 'quantity' || field === 'unitPrice') {
                const q = field === 'quantity' ? Number(value) || 0 : item.quantity;
                const p = field === 'unitPrice' ? Number(value) || 0 : item.unitPrice;
                updated.subtotal = q * p;
              }
              if (field === 'assignmentScope' && value !== 'WBS') {
                updated.wbsNodeId = undefined;
              }
              return updated;
            }
            return item;
          });
          const newTotal = updatedItems.reduce((sum, i) => sum + i.subtotal, 0);
          return {
            ...cat,
            items: updatedItems,
            categoryTotal: newTotal,
          };
        }
        return cat;
      })
    );
  };

  const handleRemoveItem = (categoryKey: string, itemId: string) => {
    if (isApproved) return;
    setDirtyState('DIRTY');
    setCategories((prev) =>
      prev.map((cat) => {
        if (cat.categoryKey === categoryKey) {
          const updatedItems = cat.items.filter((i) => i.id !== itemId);
          const newTotal = updatedItems.reduce((sum, i) => sum + i.subtotal, 0);
          return {
            ...cat,
            items: updatedItems,
            categoryTotal: newTotal,
          };
        }
        return cat;
      })
    );
  };

  const toggleItemExpansion = (itemId: string) => {
    setExpandedItemIds((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const handleResetAll = () => {
    if (isApproved) return;
    setCategories(normalizeCostCategories([]));
    setPmNotes('');
    setExpandedItemIds({});
    setDirtyState('DIRTY');
    message.info('Formulir estimasi biaya berhasil direset.');
  };

  const handleSaveEstimate = async (closeAfterSave = false) => {
    if (!charter || !charter.id || isNaN(Number(charter.id))) {
      message.error('Project ID tidak tersedia.');
      return;
    }
    if (isApproved) {
      message.warning('Estimasi biaya berstatus APPROVED (Baseline) tidak dapat diubah secara langsung.');
      return;
    }
    if (saving || dirtyState === 'SAVING') {
      return;
    }

    // PRE-SAVE GUARD: Block save if any WBS item lacks active leaf WBS mapping (avoid 400 BadRequest)
    // Draft persistence of UNASSIGNED items is allowed, but readiness remains false.
    const validation = validateCostEstimateItems(categories, activeLeafWbsIds, { allowUnassigned: true });
    if (!validation.valid) {
      const errText = validation.error || 'Terdapat item WBS yang belum dipetakan ke WBS Deliverable aktif.';
      message.error(errText);
      setSaveError(errText);
      return;
    }

    const projectId = Number(charter?.projectId || charter?.id || 0);
    if (!projectId || isNaN(projectId)) {
      message.error('Project ID tidak valid.');
      return;
    }
    setSaving(true);
    setDirtyState('SAVING');
    setSaveError(null);

    try {
      const payload = buildSaveCostEstimatePayload(categories, pmNotes);
      const res = await ProjectService.saveCostEstimate(projectId, payload);

      setEstimateId(Number(res.id));
      setEstimateStatus(res.status || 'DRAFT');
      setEstimateVersion(Number(res.version || 1));
      setPmNotes(res.pmNotes || '');
      const mappedCategories = mapBackendEstimateToCategories(res.categories);
      setCategories(mappedCategories);
      setDirtyState('CLEAN');
      setSaveError(null);

      if (typeof window !== 'undefined') {
        localStorage.removeItem(`epms_cost_estimate_draft_${projectId}`);
        localStorage.removeItem(`pm_cost_estimate_draft_${projectId}`);
        if (charter.project_code) {
          localStorage.removeItem(`epms_cost_estimate_draft_${charter.project_code}`);
          localStorage.removeItem(`pm_cost_estimate_draft_${charter.project_code}`);
        }
      }
      setShowSyncPrompt(false);

      message.success('Draft estimasi biaya (RAB) berhasil disimpan ke server.');
      if (onSaveDraft) {
        onSaveDraft(res);
      }

      if (closeAfterSave) {
        onClose();
      }
    } catch (err: any) {
      setDirtyState('DIRTY');
      const errMsg = err?.response?.data?.message || 'Gagal menyimpan estimasi biaya ke server.';
      const formattedErr = Array.isArray(errMsg) ? errMsg.join('. ') : errMsg;
      setSaveError(formattedErr);
      message.error(formattedErr);
    } finally {
      setSaving(false);
    }
  };

  const handleSyncLegacyDraft = async () => {
    if (!charter || (!charter.id && !charter.projectId)) return;
    const projectId = Number(charter?.projectId || charter?.id || 0);
    const storageKey = `epms_cost_estimate_draft_${projectId}`;
    const legacyKey = `pm_cost_estimate_draft_${projectId}`;
    const raw = typeof window !== 'undefined' ? (localStorage.getItem(storageKey) || localStorage.getItem(legacyKey)) : null;
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      const normalized = normalizeCostCategories(parsed.categories);

      // PRE-SAVE GUARD: Block sync if any WBS item in legacy draft lacks active leaf WBS mapping
      const validation = validateCostEstimateItems(normalized, activeLeafWbsIds, { allowUnassigned: true });
      if (!validation.valid) {
        const errText = `Sinkronisasi dibatalkan: ${validation.error || 'Terdapat item WBS tanpa mapping valid.'}`;
        message.error(errText);
        setSaveError(errText);
        return;
      }

      setCategories(normalized);
      setPmNotes(parsed.pmNotes || '');

      setSyncing(true);
      setSaving(true);
      setDirtyState('SAVING');
      setSaveError(null);

      const payload = buildSaveCostEstimatePayload(normalized, parsed.pmNotes || '');
      const res = await ProjectService.saveCostEstimate(projectId, payload);

      setEstimateId(Number(res.id));
      setEstimateStatus(res.status || 'DRAFT');
      setEstimateVersion(Number(res.version || 1));
      setPmNotes(res.pmNotes || '');
      setCategories(mapBackendEstimateToCategories(res.categories));
      setDirtyState('CLEAN');
      setShowSyncPrompt(false);

      if (typeof window !== 'undefined') {
        localStorage.removeItem(storageKey);
        localStorage.removeItem(legacyKey);
      }
      message.success('Draft RAB legacy berhasil disinkronkan ke database server.');
      if (onSaveDraft) {
        onSaveDraft(res);
      }
    } catch (err: any) {
      setDirtyState('DIRTY');
      const errMsg = err?.response?.data?.message || 'Gagal menyinkronkan draft legacy ke server.';
      const formattedErr = Array.isArray(errMsg) ? errMsg.join('. ') : errMsg;
      setSaveError(formattedErr);
      message.error(formattedErr);
    } finally {
      setSyncing(false);
      setSaving(false);
    }
  };

  const handleDismissLegacySync = () => {
    setShowSyncPrompt(false);
    setCategories(normalizeCostCategories([]));
    setPmNotes('');
    setDirtyState('CLEAN');
    message.info('Memulai dengan template RAB kosong.');
  };

  const totalPmEstimate = useMemo(() => {
    return categories.reduce((sum, cat) => sum + (cat.categoryTotal || 0), 0);
  }, [categories]);

  const hasCostInput = useMemo(() => {
    return categories.some((cat) => {
      if (cat.mode === 'DIRECT') return cat.directSubtotal > 0;
      return cat.items.some((item) => item.subtotal > 0);
    });
  }, [categories]);

  const marketingEstimate = Number(charter?.project_budget || charter?.contract_total_value || 0);
  const contractLegalValue = Number(charter?.contract_total_value || 0);

  const varianceNominal = hasCostInput ? totalPmEstimate - marketingEstimate : 0;
  const variancePercentage = marketingEstimate > 0 && hasCostInput ? (varianceNominal / marketingEstimate) * 100 : 0;

  const estimatedMarginNominal = hasCostInput ? contractLegalValue - totalPmEstimate : 0;
  const estimatedMarginPercentage = contractLegalValue > 0 && hasCostInput ? (estimatedMarginNominal / contractLegalValue) * 100 : 0;

  if (!charter) return null;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width="min(1100px, 94vw)"
      centered
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 24 }}>
          <Space size={8}>
            <DollarOutlined style={{ color: '#1d4ed8', fontSize: 18 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>PM Cost Estimate (RAB) Workspace</span>
                {estimateStatus === 'APPROVED' ? (
                  <Tag color="green" icon={<LockOutlined />} style={{ fontWeight: 600 }}>
                    BASELINE APPROVED (V{estimateVersion})
                  </Tag>
                ) : (
                  <Tag color="blue" style={{ fontWeight: 600 }}>
                    DRAFT (V{estimateVersion})
                  </Tag>
                )}
                {dirtyState === 'DIRTY' && !isApproved && (
                  <Tag color="warning" style={{ fontSize: 10 }}>Belum Disimpan</Tag>
                )}
                {dirtyState === 'SAVING' && (
                  <Tag color="processing" icon={<LoadingOutlined />} style={{ fontSize: 10 }}>Menyimpan...</Tag>
                )}
                {dirtyState === 'CLEAN' && !isApproved && (
                  <Tag color="success" style={{ fontSize: 10 }}>Tersimpan di Server</Tag>
                )}
              </div>
              <Text type="secondary" style={{ fontSize: 11 }}>
                Rencana Anggaran Biaya Terstruktur (Database SSOT • Direct, Indirect & Risk)
              </Text>
            </div>
          </Space>
          <Space size={6}>
            {!isApproved && (
              <Popconfirm
                title="Reset formulir estimasi biaya?"
                description="Perubahan lokal yang belum disimpan akan dikembalikan ke template awal."
                onConfirm={handleResetAll}
                okText="Reset"
                cancelText="Batal"
                okButtonProps={{ danger: true }}
                disabled={saving || loading}
              >
                <Button size="small" icon={<ReloadOutlined />} disabled={saving || loading}>
                  Reset
                </Button>
              </Popconfirm>
            )}
            {!isApproved && (
              <Tooltip title={!isCostSaveable ? (costSaveValidationResult.error || 'Terdapat item WBS yang belum dipetakan ke WBS Deliverable aktif') : undefined}>
                <span>
                  <Button
                    size="small"
                    type="primary"
                    icon={saving ? <LoadingOutlined /> : <SaveOutlined />}
                    loading={saving}
                    disabled={saving || loading || !isCostSaveable}
                    onClick={() => handleSaveEstimate(false)}
                    style={{ backgroundColor: !isCostSaveable ? '#94a3b8' : '#1d4ed8', borderColor: !isCostSaveable ? '#94a3b8' : '#1d4ed8', fontWeight: 600 }}
                  >
                    Simpan Draft RAB
                  </Button>
                </span>
              </Tooltip>
            )}
          </Space>
        </div>
      }
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text type="secondary" style={{ fontSize: 11.5 }}>
            {isApproved
              ? 'Estimasi biaya telah berstatus APPROVED (Baseline Resmi Proyek).'
              : 'Estimasi biaya disimpan secara persisten di Database Server (SSOT).'}
          </Text>
          <Space>
            <Button onClick={onClose}>Tutup</Button>
            {!isApproved && (
              <Tooltip title={!isCostSaveable ? (costSaveValidationResult.error || 'Terdapat item WBS yang belum dipetakan ke WBS Deliverable aktif') : undefined}>
                <span>
                  <Button
                    type="primary"
                    loading={saving}
                    disabled={saving || loading || !isCostSaveable}
                    onClick={() => handleSaveEstimate(true)}
                    style={{ backgroundColor: !isCostSaveable ? '#94a3b8' : '#1d4ed8', borderColor: !isCostSaveable ? '#94a3b8' : '#1d4ed8', fontWeight: 600 }}
                  >
                    Simpan & Selesai
                  </Button>
                </span>
              </Tooltip>
            )}
          </Space>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 'calc(90vh - 160px)', overflowY: 'auto', paddingRight: 4 }}>
        {loading && (
          <div style={{ padding: '24px 0', textAlign: 'center' }}>
            <Spin tip="Memuat data estimasi biaya dari server..." />
          </div>
        )}

        {fetchError && (
          <Alert
            type="error"
            message={fetchError}
            showIcon
            closable
            onClose={() => setFetchError(null)}
          />
        )}

        {saveError && (
          <Alert
            type="error"
            message={saveError}
            showIcon
            closable
            onClose={() => setSaveError(null)}
          />
        )}

        {!isCostMappingValid && costValidationResult.error && (
          <Alert
            type={isCostSaveable ? 'warning' : 'error'}
            showIcon
            message={isCostSaveable ? 'Alokasi Scope / WBS Belum Lengkap' : 'Pemetaan WBS Belum Lengkap'}
            description={costValidationResult.error}
          />
        )}

        {showSyncPrompt && (
          <Alert
            type="warning"
            showIcon
            icon={<CloudSyncOutlined />}
            message="Ditemukan Draft Estimasi Biaya Lokal (Legacy LocalStorage)"
            description={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, flexWrap: 'wrap', gap: 8 }}>
                <span style={{ fontSize: 12 }}>
                  Terdapat draft RAB yang tersimpan di browser Anda dari versi sebelumnya. Apakah Anda ingin menyinkronkan draft ini ke Database Server?
                </span>
                <Space size={8}>
                  <Button size="small" type="primary" loading={syncing} onClick={handleSyncLegacyDraft} icon={<CloudUploadOutlined />}>
                    Sinkronkan ke Server
                  </Button>
                  <Button size="small" onClick={handleDismissLegacySync}>
                    Abaikan
                  </Button>
                </Space>
              </div>
            }
          />
        )}

        {/* EXECUTIVE KPI SUMMARY CARDS */}
        <Row gutter={8}>
          <Col span={6}>
            <Card size="small" style={{ borderRadius: 6, border: '1px solid #e2e8f0', background: '#ffffff' }} bodyStyle={{ padding: '8px 10px' }}>
              <Text type="secondary" style={{ fontSize: 10.5, display: 'block' }}>Marketing Estimate / Plafon</Text>
              <Text strong style={{ fontSize: 13, color: '#0f172a' }}>
                Rp {marketingEstimate.toLocaleString('id-ID')}
              </Text>
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small" style={{ borderRadius: 6, border: '1px solid #bfdbfe', background: '#eff6ff' }} bodyStyle={{ padding: '8px 10px' }}>
              <Text type="secondary" style={{ fontSize: 10.5, display: 'block' }}>Total PM Estimate (RAB)</Text>
              <Text strong style={{ fontSize: 13, color: '#1d4ed8' }}>
                Rp {totalPmEstimate.toLocaleString('id-ID')}
              </Text>
            </Card>
          </Col>
          <Col span={6}>
            <Card
              size="small"
              style={{
                borderRadius: 6,
                border: `1px solid ${varianceNominal > 0 ? '#fecaca' : '#bbf7d0'}`,
                background: varianceNominal > 0 ? '#fef2f2' : '#f0fdf4',
              }}
              bodyStyle={{ padding: '8px 10px' }}
            >
              <Text type="secondary" style={{ fontSize: 10.5, display: 'block' }}>
                Variansi (PM vs Plafon)
              </Text>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {varianceNominal > 0 ? (
                  <ArrowUpOutlined style={{ color: '#dc2626', fontSize: 11 }} />
                ) : (
                  <ArrowDownOutlined style={{ color: '#16a34a', fontSize: 11 }} />
                )}
                <Text strong style={{ fontSize: 13, color: varianceNominal > 0 ? '#dc2626' : '#16a34a' }}>
                  Rp {Math.abs(varianceNominal).toLocaleString('id-ID')} ({variancePercentage.toFixed(1)}%)
                </Text>
              </div>
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small" style={{ borderRadius: 6, border: '1px solid #e2e8f0', background: '#ffffff' }} bodyStyle={{ padding: '8px 10px' }}>
              <Text type="secondary" style={{ fontSize: 10.5, display: 'block' }}>Estimasi Gross Margin</Text>
              <Text strong style={{ fontSize: 13, color: estimatedMarginNominal >= 0 ? '#16a34a' : '#dc2626' }}>
                Rp {estimatedMarginNominal.toLocaleString('id-ID')} ({estimatedMarginPercentage.toFixed(1)}%)
              </Text>
            </Card>
          </Col>
        </Row>

        {/* WBS COST RECONCILIATION STRIP */}
        <div
          style={{
            background: reconciliation.unassignedItemsCount === 0 && reconciliation.orphanedItemsCount === 0 && reconciliation.totalItemizedItems > 0
              ? '#f0fdf4'
              : '#f8fafc',
            padding: '8px 12px',
            borderRadius: 6,
            border: `1px solid ${reconciliation.unassignedItemsCount === 0 && reconciliation.orphanedItemsCount === 0 && reconciliation.totalItemizedItems > 0 ? '#bbf7d0' : '#e2e8f0'}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 6,
          }}
        >
          <Space size={8} wrap>
            <ApartmentOutlined style={{ color: '#0284c7', fontSize: 14 }} />
            <Tooltip title="Setiap item biaya dapat dipetakan ke pekerjaan WBS tertentu atau dialokasikan sebagai biaya Project-Level (keseluruhan proyek).">
              <Text strong style={{ fontSize: 11.5, color: '#0f172a', cursor: 'help' }}>
                Pemetaan Cost:
              </Text>
            </Tooltip>
            {reconciliation.totalItemizedItems === 0 ? (
              <Text type="secondary" style={{ fontSize: 11 }}>Belum ada rincian item biaya</Text>
            ) : reconciliation.unassignedItemsCount === 0 && reconciliation.orphanedItemsCount === 0 ? (
              <Tag color="success" style={{ fontSize: 10.5, margin: 0 }}>
                Semua item biaya sudah dipetakan ({reconciliation.mappedItemsCount} WBS • {reconciliation.projectLevelItemsCount} Project-Level)
              </Tag>
            ) : (
              <Tag color="warning" style={{ fontSize: 10.5, margin: 0 }}>
                {reconciliation.unassignedItemsCount} item biaya belum ditentukan
              </Tag>
            )}
            {reconciliation.orphanedItemsCount > 0 && (
              <Tag color="error" style={{ fontSize: 10.5, margin: 0 }}>
                {reconciliation.orphanedItemsCount} WBS Dihapus
              </Tag>
            )}
          </Space>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Text style={{ fontSize: 11, color: '#334155' }}>
              Terpetakan ke WBS: <strong style={{ color: '#0284c7' }}>Rp {reconciliation.totalAllocatedCost.toLocaleString('id-ID')}</strong>
            </Text>
            <Text style={{ fontSize: 11, color: '#475569' }}>
              Project-Level Cost: <strong style={{ color: '#7c3aed' }}>Rp {reconciliation.totalProjectLevelCost.toLocaleString('id-ID')}</strong>
            </Text>
            {reconciliation.totalUnallocatedCost > 0 && (
              <Text style={{ fontSize: 11, color: '#b45309' }}>
                Belum Ditentukan: <strong>Rp {reconciliation.totalUnallocatedCost.toLocaleString('id-ID')}</strong>
              </Text>
            )}
          </div>
        </div>

        {/* 3 LOGICAL COST GROUPS */}
        {COST_GROUP_CONFIGS.map((grp) => {
          const groupCategories = categories.filter((c) => grp.categoryKeys.includes(c.categoryKey));
          const grpTotal = groupCategories.reduce((sum, c) => sum + (c.categoryTotal || 0), 0);

          return (
            <div
              key={grp.key}
              style={{
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                background: '#f8fafc',
                padding: '8px 10px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              {/* Group Header Strip */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 4px' }}>
                <Space size={6}>
                  <Text strong style={{ fontSize: 12.5, color: grp.key === 'DIRECT' ? '#1d4ed8' : grp.key === 'INDIRECT' ? '#0369a1' : '#b45309' }}>
                    {grp.label}
                  </Text>
                  <Tag color="default" style={{ fontSize: 10, margin: 0 }}>
                    {groupCategories.length} Kategori
                  </Tag>
                </Space>
                <Text strong style={{ fontSize: 12.5, color: '#0f172a' }}>
                  Subtotal: Rp {grpTotal.toLocaleString('id-ID')}
                </Text>
              </div>

              {/* Categories inside group */}
              {groupCategories.map((cat, catIdx) => (
                <Card
                  key={cat.categoryKey}
                  size="small"
                  style={{ borderRadius: 6, border: '1px solid #e2e8f0', background: '#ffffff' }}
                  bodyStyle={{ padding: '8px 10px' }}
                  title={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                      <Space size={6}>
                        <Tag color="blue" style={{ fontSize: 10.5, fontWeight: 700, margin: 0 }}>
                          {catIdx + 1}
                        </Tag>
                        <Text strong style={{ fontSize: 12, color: '#0f172a' }}>
                          {cat.categoryLabel}
                        </Text>
                      </Space>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Radio.Group
                          size="small"
                          value={cat.mode}
                          onChange={(e) => handleModeChange(cat.categoryKey, e.target.value)}
                          optionType="button"
                          buttonStyle="solid"
                        >
                          <Radio.Button value="ITEMIZED" style={{ fontSize: 11 }}>Rincian Item</Radio.Button>
                          <Radio.Button value="DIRECT" style={{ fontSize: 11 }}>Nominal Langsung</Radio.Button>
                        </Radio.Group>
                        <Text strong style={{ fontSize: 12, color: '#1d4ed8', minWidth: 100, textAlign: 'right', whiteSpace: 'nowrap' }}>
                          Rp {(cat.categoryTotal || 0).toLocaleString('id-ID')}
                        </Text>
                      </div>
                    </div>
                  }
                >
                  {cat.mode === 'DIRECT' ? (
                    <div style={{ padding: '2px 0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Text type="secondary" style={{ fontSize: 11.5 }}>
                          Estimasi Nominal:
                        </Text>
                        <InputNumber
                          size="small"
                          style={{ width: 220 }}
                          prefix="Rp"
                          formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                          parser={(value) => (value ? Number(value.replace(/\./g, '')) : 0)}
                          value={cat.directSubtotal}
                          onChange={(val) => handleDirectSubtotalChange(cat.categoryKey, val)}
                          placeholder="0"
                        />
                      </div>
                      {cat.categoryKey === 'MATERIAL' && (
                        <div
                          style={{
                            marginTop: 6,
                            fontSize: 11,
                            color: '#d97706',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <InfoCircleOutlined />
                          <span>
                            Material belum dirinci (wajib berstatus Rincian Item / ITEMIZED untuk kesiapan pengadaan).
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      {cat.items.length === 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: '#f8fafc', borderRadius: 4, border: '1px dashed #e2e8f0' }}>
                          <Text type="secondary" style={{ fontSize: 11.5 }}>Belum ada rincian item estimasi.</Text>
                          <Button
                            size="small"
                            type="link"
                            icon={<PlusOutlined />}
                            onClick={() => handleAddItem(cat.categoryKey)}
                            style={{ fontSize: 11.5, padding: 0 }}
                          >
                            Tambah Item
                          </Button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                          {cat.items.map((item, idx) => {
                            const isExpanded = !!expandedItemIds[item.id];
                            const effectiveScope: CostAssignmentScope =
                              item.assignmentScope || (item.wbsNodeId ? 'WBS' : 'UNASSIGNED');
                            const isWbsScope = effectiveScope === 'WBS';
                            const isMissingWbs = isWbsScope && (!item.wbsNodeId || String(item.wbsNodeId).trim() === '');
                            const isMapped = isWbsScope && !!item.wbsNodeId && wbsLeafMap.has(String(item.wbsNodeId));
                            const isOrphaned = isWbsScope && !!item.wbsNodeId && !wbsLeafMap.has(String(item.wbsNodeId));
                            const hasWbsError = isMissingWbs || isOrphaned;

                            return (
                              <div
                                key={item.id}
                                style={{
                                  background: hasWbsError ? '#fff8f8' : '#f8fafc',
                                  padding: '5px 8px',
                                  borderRadius: 6,
                                  border: `1px solid ${hasWbsError ? '#fca5a5' : isMapped ? '#cbd5e1' : '#e2e8f0'}`,
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 4,
                                }}
                              >
                                {/* Primary Compact Row */}
                                <Row gutter={6} align="middle">
                                  <Col span={8}>
                                    <Input
                                      size="small"
                                      placeholder={`Nama Item #${idx + 1}`}
                                      value={item.itemName}
                                      onChange={(e) => handleItemChange(cat.categoryKey, item.id, 'itemName', e.target.value)}
                                      style={{ fontSize: 12 }}
                                    />
                                  </Col>
                                  <Col span={3}>
                                    <InputNumber
                                      size="small"
                                      style={{ width: '100%', fontSize: 12 }}
                                      min={0}
                                      value={item.quantity}
                                      onChange={(val) => handleItemChange(cat.categoryKey, item.id, 'quantity', val)}
                                      placeholder="Qty"
                                    />
                                  </Col>
                                  <Col span={3}>
                                    <Select
                                      size="small"
                                      style={{ width: '100%', fontSize: 11.5 }}
                                      value={item.uom}
                                      onChange={(val) => handleItemChange(cat.categoryKey, item.id, 'uom', val)}
                                      options={COMMON_UOMS.map((u) => ({ label: u, value: u }))}
                                    />
                                  </Col>
                                  <Col span={4}>
                                    <InputNumber
                                      size="small"
                                      style={{ width: '100%', fontSize: 12 }}
                                      prefix="Rp"
                                      formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                                      parser={(value) => (value ? Number(value.replace(/\./g, '')) : 0)}
                                      value={item.unitPrice}
                                      onChange={(val) => handleItemChange(cat.categoryKey, item.id, 'unitPrice', val)}
                                      placeholder="Harga Satuan"
                                    />
                                  </Col>
                                  <Col span={3} style={{ textAlign: 'right' }}>
                                    <Text strong style={{ fontSize: 11.5, color: '#1d4ed8', whiteSpace: 'nowrap' }}>
                                      Rp {(item.subtotal || 0).toLocaleString('id-ID')}
                                    </Text>
                                  </Col>
                                  <Col span={2} style={{ textAlign: 'center' }}>
                                    <Button
                                      size="small"
                                      type="link"
                                      icon={isExpanded ? <UpOutlined /> : <DownOutlined />}
                                      onClick={() => toggleItemExpansion(item.id)}
                                      style={{
                                        fontSize: 11,
                                        padding: '0 4px',
                                        color: hasWbsError ? '#dc2626' : isMapped ? '#059669' : '#64748b',
                                        fontWeight: hasWbsError ? 700 : 400,
                                      }}
                                    >
                                      {isMapped || isOrphaned || isMissingWbs ? 'WBS' : 'Detail'}
                                    </Button>
                                  </Col>
                                  <Col span={1} style={{ textAlign: 'center' }}>
                                    <Button
                                      size="small"
                                      type="text"
                                      danger
                                      icon={<DeleteOutlined />}
                                      onClick={() => handleRemoveItem(cat.categoryKey, item.id)}
                                      style={{ padding: 0 }}
                                    />
                                  </Col>
                                </Row>

                                {/* Inline Collapsible Secondary Metadata with WBS Picker */}
                                {isExpanded && (
                                  <div
                                    style={{
                                      marginTop: 4,
                                      padding: '8px 10px',
                                      background: '#ffffff',
                                      borderRadius: 4,
                                      border: '1px solid #cbd5e1',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: 6,
                                    }}
                                  >
                                    {/* Row 1: Resource Type, Cost Source, Rate Type */}
                                    <Row gutter={8} align="middle">
                                      <Col span={8}>
                                        <Text type="secondary" style={{ fontSize: 10, display: 'block', marginBottom: 2 }}>
                                          Tipe Sumber Daya:
                                        </Text>
                                        <Select
                                          size="small"
                                          allowClear
                                          placeholder="Pilih Sumber Daya"
                                          value={item.resourceType}
                                          onChange={(val) => handleItemChange(cat.categoryKey, item.id, 'resourceType', val)}
                                          options={RESOURCE_TYPE_OPTIONS}
                                          style={{ width: '100%', fontSize: 11 }}
                                        />
                                      </Col>
                                      <Col span={8}>
                                        <Text type="secondary" style={{ fontSize: 10, display: 'block', marginBottom: 2 }}>
                                          Sumber Harga:
                                        </Text>
                                        <Select
                                          size="small"
                                          allowClear
                                          placeholder="Pilih Sumber Harga"
                                          value={item.costSource || 'PM_ESTIMATE'}
                                          onChange={(val) => handleItemChange(cat.categoryKey, item.id, 'costSource', val)}
                                          options={COST_SOURCE_OPTIONS}
                                          style={{ width: '100%', fontSize: 11 }}
                                        />
                                      </Col>
                                      <Col span={8}>
                                        <Text type="secondary" style={{ fontSize: 10, display: 'block', marginBottom: 2 }}>
                                          Tipe Tarif:
                                        </Text>
                                        <Select
                                          size="small"
                                          allowClear
                                          placeholder="Pilih Tipe Tarif"
                                          value={item.rateType || 'UNIT_RATE'}
                                          onChange={(val) => handleItemChange(cat.categoryKey, item.id, 'rateType', val)}
                                          options={RATE_TYPE_OPTIONS}
                                          style={{ width: '100%', fontSize: 11 }}
                                        />
                                      </Col>
                                    </Row>

                                    {/* Row 2: Cost Assignment Scope & Target */}
                                    <Row gutter={8} align="middle">
                                      <Col span={8}>
                                        <Text type="secondary" style={{ fontSize: 10, display: 'block', marginBottom: 2 }}>
                                          Scope Pemetaan Biaya:
                                        </Text>
                                        <Select
                                          size="small"
                                          value={effectiveScope}
                                          onChange={(val: CostAssignmentScope) => handleItemChange(cat.categoryKey, item.id, 'assignmentScope', val)}
                                          options={[
                                            { label: 'Pekerjaan WBS', value: 'WBS' },
                                            { label: 'Project-Level', value: 'PROJECT' },
                                            { label: 'Belum Ditentukan', value: 'UNASSIGNED' },
                                          ]}
                                          style={{ width: '100%', fontSize: 11 }}
                                        />
                                      </Col>
                                      <Col span={10}>
                                        {isWbsScope ? (
                                          <div>
                                            <Text type="secondary" style={{ fontSize: 10, display: 'block', marginBottom: 2 }}>
                                              <span style={{ color: '#ef4444', fontWeight: 'bold' }}>* </span>
                                              Pilih Pekerjaan WBS <span style={{ color: '#ef4444', fontSize: 9 }}>(Wajib)</span>:
                                            </Text>
                                            {internalWbsData.length === 0 ? (
                                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f8fafc', padding: '3px 8px', borderRadius: 4, border: '1px dashed #cbd5e1' }}>
                                                <Text type="secondary" style={{ fontSize: 10.5 }}>Belum ada struktur WBS.</Text>
                                                {onNavigateToWbs && (
                                                  <Button size="small" type="link" onClick={onNavigateToWbs} style={{ fontSize: 10.5, padding: 0 }}>
                                                    + Susun WBS
                                                  </Button>
                                                )}
                                              </div>
                                            ) : (
                                              <Select
                                                size="small"
                                                allowClear
                                                showSearch
                                                placeholder="Pilih pekerjaan WBS (Wajib)..."
                                                value={item.wbsNodeId ? String(item.wbsNodeId) : undefined}
                                                onChange={(val) => handleItemChange(cat.categoryKey, item.id, 'wbsNodeId', val)}
                                                filterOption={(input, option) =>
                                                  ((option?.label as string) || '').toLowerCase().includes(input.toLowerCase())
                                                }
                                                options={wbsSelectOptions}
                                                style={{ width: '100%', fontSize: 11 }}
                                                status={hasWbsError ? 'error' : undefined}
                                              />
                                            )}
                                          </div>
                                        ) : effectiveScope === 'PROJECT' ? (
                                          <div>
                                            <Text type="secondary" style={{ fontSize: 10, display: 'block', marginBottom: 2 }}>
                                              Keterangan Scope:
                                            </Text>
                                            <Text style={{ fontSize: 10.5, color: '#6b21a8' }}>
                                              Biaya berlaku untuk keseluruhan project.
                                            </Text>
                                          </div>
                                        ) : (
                                          <div>
                                            <Text type="secondary" style={{ fontSize: 10, display: 'block', marginBottom: 2 }}>
                                              Keterangan Scope:
                                            </Text>
                                            <Text type="secondary" style={{ fontSize: 10.5, fontStyle: 'italic' }}>
                                              Belum ditentukan WBS / Project-Level.
                                            </Text>
                                          </div>
                                        )}
                                      </Col>
                                      <Col span={6}>
                                        <Text type="secondary" style={{ fontSize: 10, display: 'block', marginBottom: 2 }}>
                                          Status Pemetaan:
                                        </Text>
                                        {effectiveScope === 'PROJECT' ? (
                                          <Tag color="purple" style={{ fontSize: 10, margin: 0, fontWeight: 600 }}>
                                            ● Project-Level
                                          </Tag>
                                        ) : isWbsScope ? (
                                          !item.wbsNodeId ? (
                                            <Tag color="error" style={{ fontSize: 10, margin: 0, fontWeight: 600 }}>
                                              Wajib Pilih WBS
                                            </Tag>
                                          ) : isMapped ? (
                                            <Tag color="success" style={{ fontSize: 10, margin: 0 }}>
                                              {wbsLeafMap.get(String(item.wbsNodeId))?.code} · {wbsLeafMap.get(String(item.wbsNodeId))?.name}
                                            </Tag>
                                          ) : (
                                            <Tag color="error" style={{ fontSize: 10, margin: 0, fontWeight: 600 }}>
                                              WBS Dihapus / Remap Diperlukan
                                            </Tag>
                                          )
                                        ) : (
                                          <Tag color="warning" style={{ fontSize: 10, margin: 0 }}>
                                            Belum Ditentukan
                                          </Tag>
                                        )}
                                      </Col>
                                    </Row>

                                    {/* Row 3: Notes / Technical Specs */}
                                    <Row gutter={8} align="middle">
                                      <Col span={24}>
                                        <Input
                                          size="small"
                                          placeholder="Catatan / spesifikasi teknis item (opsional)..."
                                          value={item.notes}
                                          onChange={(e) => handleItemChange(cat.categoryKey, item.id, 'notes', e.target.value)}
                                          style={{ fontSize: 11 }}
                                        />
                                      </Col>
                                    </Row>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          <div style={{ marginTop: 2 }}>
                            <Button
                              size="small"
                              type="dashed"
                              icon={<PlusOutlined />}
                              onClick={() => handleAddItem(cat.categoryKey)}
                              style={{ width: '100%', fontSize: 11 }}
                            >
                              Tambah Baris Item
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          );
        })}

        {/* WBS COST ALLOCATION BREAKDOWN (DERIVED SUMMARY) */}
        {(reconciliation.wbsCostList.length > 0 || reconciliation.totalProjectLevelCost > 0) && (
          <Card
            size="small"
            title={
              <Space size={6}>
                <ApartmentOutlined style={{ color: '#0284c7' }} />
                <span style={{ fontWeight: 600, fontSize: 12 }}>Ringkasan Pemetaan Biaya per WBS Deliverable & Project-Level</span>
              </Space>
            }
            style={{ borderRadius: 8, border: '1px solid #e2e8f0', background: '#ffffff' }}
            bodyStyle={{ padding: '8px 12px' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {reconciliation.wbsCostList.map((w) => (
                <div
                  key={w.wbsId}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '3px 6px',
                    borderRadius: 4,
                    background: '#f8fafc',
                  }}
                >
                  <Space size={6}>
                    <Tag color="blue" style={{ fontSize: 10, margin: 0 }}>{w.wbsCode}</Tag>
                    <Text style={{ fontSize: 11.5, color: '#0f172a' }}>{w.wbsName}</Text>
                    <Tag color="default" style={{ fontSize: 9.5, margin: 0 }}>{w.itemCount} item</Tag>
                  </Space>
                  <Text strong style={{ fontSize: 11.5, color: '#0284c7' }}>
                    Rp {w.totalCost.toLocaleString('id-ID')}
                  </Text>
                </div>
              ))}
              {reconciliation.totalProjectLevelCost > 0 && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '3px 6px',
                    borderRadius: 4,
                    background: '#faf5ff',
                    border: '1px solid #f3e8ff',
                  }}
                >
                  <Space size={6}>
                    <Tag color="purple" style={{ fontSize: 10, margin: 0, fontWeight: 600 }}>PROJECT</Tag>
                    <Text style={{ fontSize: 11.5, color: '#581c87', fontWeight: 600 }}>Biaya Tingkat Proyek (Project-Level / Overhead / Mobilisasi)</Text>
                    <Tag color="default" style={{ fontSize: 9.5, margin: 0 }}>{reconciliation.projectLevelItemsCount} item</Tag>
                  </Space>
                  <Text strong style={{ fontSize: 11.5, color: '#7c3aed' }}>
                    Rp {reconciliation.totalProjectLevelCost.toLocaleString('id-ID')}
                  </Text>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* PM NOTES */}
        <Card size="small" title="Catatan Asumsi Operasional PM" style={{ borderRadius: 8, border: '1px solid #e2e8f0', background: '#ffffff' }} bodyStyle={{ padding: '8px 10px' }}>
          <TextArea
            rows={2}
            value={pmNotes}
            onChange={(e) => setPmNotes(e.target.value)}
            placeholder="Tambahkan catatan justifikasi teknis atau kondisi khusus lapangan..."
            style={{ fontSize: 11.5 }}
          />
        </Card>
      </div>
    </Modal>
  );
};
