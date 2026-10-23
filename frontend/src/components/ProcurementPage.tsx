'use client';

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Table,
  Typography,
  Row,
  Col,
  Tag,
  Button,
  Space,
  message,
  Empty,
  Tooltip,
  Modal,
  Alert,
  Tabs,
  Input,
  Select,
  Spin,
  Dropdown,
  type MenuProps,
} from 'antd';
import {
  FileDoneOutlined,
  ShoppingCartOutlined,
  InboxOutlined,
  EyeOutlined,
  SafetyCertificateOutlined,
  AuditOutlined,
  ClockCircleFilled,
  CheckCircleFilled,
  ExclamationCircleFilled,
  SendOutlined,
  RollbackOutlined,
  FilterOutlined,
  ReloadOutlined,
  FileTextOutlined,
  StopOutlined,
  MoreOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  ProcurementService,
  ProcurementPackage,
  ProcurementPackageStatus,
  RfqRecord,
} from '@/services/procurement.service';
import dynamic from 'next/dynamic';
import { useAuth } from '@/context/AuthContext';
import {
  PrApprovalWorkflow,
  PrStatusBadge,
  PrApprovalStatus,
} from '@/components/procurement/PrApprovalWorkflow';
import type { PurchaseOrderPrototypeRecord } from '@/components/procurement/PurchaseOrderModal';
import type { GoodsReceiptRecord } from '@/components/procurement/GoodsReceiptModal';
import UserIdentityDisplay from '@/components/common/UserIdentityDisplay';
import { resolveStatusPresentation } from '@/lib/statusPresentation';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatQuantity,
  formatNumber,
} from '@/lib/formatters';
import { StatusBadge } from '@/components/common/StatusBadge';
import styles from './procurement/ProcurementPage.module.css';

const PurchaseOrderModal = dynamic(
  () => import('@/components/procurement/PurchaseOrderModal').then((m) => m.PurchaseOrderModal),
  { ssr: false }
);

const GoodsReceiptModal = dynamic(
  () => import('@/components/procurement/GoodsReceiptModal').then((m) => m.GoodsReceiptModal),
  { ssr: false }
);

const CreateRfqModal = dynamic(
  () => import('@/components/procurement/CreateRfqModal').then((m) => m.CreateRfqModal),
  { ssr: false }
);

const ProcurementPackageDetailDrawer = dynamic(
  () => import('@/components/procurement/ProcurementPackageDetailDrawer').then((m) => m.ProcurementPackageDetailDrawer),
  { ssr: false }
);

const ServiceOrderModal = dynamic(
  () => import('@/components/procurement/ServiceOrderModal').then((m) => m.ServiceOrderModal),
  { ssr: false }
);

const ServiceClaimModal = dynamic(
  () => import('@/components/procurement/ServiceClaimModal').then((m) => m.ServiceClaimModal),
  { ssr: false }
);

const ReconciliationTab = dynamic(
  () => import('@/components/procurement/ReconciliationTab').then((m) => m.ReconciliationTab),
  { ssr: false }
);

const getPackageStatusTag = (status: ProcurementPackageStatus | string) => {
  const p = resolveStatusPresentation('package', status);
  let icon: React.ReactNode = null;
  if (p.rawStatus === 'SUBMITTED') icon = <ClockCircleFilled />;
  else if (p.rawStatus === 'PR_CREATED') icon = <CheckCircleFilled />;
  else if (p.rawStatus === 'RETURNED') icon = <RollbackOutlined />;
  else if (p.rawStatus === 'CANCELLED') icon = <StopOutlined />;

  return (
    <Tag color={p.color} icon={icon} style={{ fontWeight: 600, padding: '2px 8px', borderRadius: 12, fontSize: 11 }}>
      {p.label}
    </Tag>
  );
};

/**
 * EPMS — PROCUREMENT-EMPTY-COUNT-R1
 * Resolves safe count representation for Procurement summary cards.
 * Never returns '—' or undefined; empty or loading fallback is numeric 0.
 */
export function resolveProcurementCount(value: number | any[] | undefined | null): number {
  if (value === null || value === undefined) return 0;
  if (Array.isArray(value)) return value.length;
  if (typeof value === 'number') {
    return isNaN(value) ? 0 : Math.max(0, value);
  }
  return 0;
}

export function formatProcurementSummaryCount(value: number | any[] | undefined | null, unit: 'PR' | 'PO'): string {
  const count = resolveProcurementCount(value);
  return `${count} ${unit}`;
}

export interface ResolveSummaryMetricParams {
  summaryCount?: number | null;
  localArray?: any[];
  isLoading?: boolean;
  isAuthorized?: boolean;
}

export function resolveSummaryCardValue(params: ResolveSummaryMetricParams): {
  displayValue: number | string;
  isLoading: boolean;
  isUnauthorized: boolean;
} {
  const { summaryCount, localArray = [], isLoading = false, isAuthorized = true } = params;
  if (isLoading && summaryCount === undefined && localArray.length === 0) {
    return { displayValue: 'LOADING', isLoading: true, isUnauthorized: !isAuthorized };
  }
  if (!isAuthorized && (summaryCount === undefined || summaryCount === null)) {
    return { displayValue: 0, isLoading: false, isUnauthorized: true };
  }
  if (summaryCount !== undefined && summaryCount !== null) {
    return { displayValue: summaryCount, isLoading: false, isUnauthorized: false };
  }
  return { displayValue: localArray.length, isLoading: false, isUnauthorized: false };
}

/**
 * EPMS — Authoritative PR Domain Resolution
 * Distinguishes MATERIAL vs SERVICE Purchase Requests.
 * Primary discriminator: resourceType === 'SERVICE' -> SERVICE, resourceType === 'MATERIAL' -> MATERIAL.
 * Category 'SUBCONTRACTOR' supports SERVICE only where backed by resourceType or not explicitly MATERIAL.
 * EQUIPMENT and OPERATIONAL are NOT classified as SERVICE solely by category.
 */
export function checkIsServicePr(r: any): boolean {
  if (!r) return false;

  // Direct domain or orderType if already resolved
  if (r.domain === 'SERVICE' || r.orderType === 'SERVICE') {
    return true;
  }
  if (r.domain === 'MATERIAL' || r.orderType === 'MATERIAL') {
    return false;
  }

  // Top-level resourceType
  const topResourceType = (r.resourceType || r.resource_type)?.toUpperCase();
  if (topResourceType === 'SERVICE') return true;
  if (topResourceType === 'MATERIAL') return false;

  // Inspect PR items
  if (Array.isArray(r.items) && r.items.length > 0) {
    return r.items.some((it: any) => {
      const ci = it.costItem || it;
      const resType = (ci.resourceType || ci.resource_type || it.resourceType || it.resource_type)?.toUpperCase();
      if (resType === 'SERVICE') return true;
      if (resType === 'MATERIAL') return false;

      // Category check: only SUBCONTRACTOR supports SERVICE when resourceType is not MATERIAL
      const catKey = (ci.categoryKey || ci.category_key || it.categoryKey || it.category_key)?.toUpperCase();
      if (catKey === 'SERVICE') return true;
      if (catKey === 'SUBCONTRACTOR' && resType !== 'MATERIAL') return true;

      // EQUIPMENT and OPERATIONAL are NEVER auto-classified as SERVICE solely by category
      return false;
    });
  }

  return false;
}

/**
 * EPMS — Domain-Isolated Duplicate Detection
 * Compares PRs only within the SAME procurement domain (Material vs Service).
 * A Material PR and a Service PR on the same project are NEVER duplicates of each other.
 */
export function checkIsDuplicatePr(r: any, allPrs: any[]): boolean {
  if (!r || !Array.isArray(allPrs)) return false;
  const rIsService = checkIsServicePr(r);
  const effectiveStatus = r.status || 'SUBMITTED';
  const isApproved = effectiveStatus === 'APPROVED';

  const hasCanonicalApproved = allPrs.some((otherPr) => {
    if (String(otherPr.id) === String(r.id)) return false;
    if (String(otherPr.projectId) !== String(r.projectId)) return false;

    // Strict domain isolation:
    const otherIsService = checkIsServicePr(otherPr);
    if (otherIsService !== rIsService) {
      return false; // Cross-domain PRs on the same project are NEVER duplicates
    }

    return otherPr.status === 'APPROVED';
  });

  return hasCanonicalApproved && !isApproved;
}

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

export const ProcurementPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user, isProcurement, isFinance, isDirector, isSuperAdmin, isProjectManager, isHeadOfOperations } = useAuth();
  const userRoles = (user?.roles || []).map((r: any) => String(r.name || r).toUpperCase());
  const isPurchasing = userRoles.includes('PURCHASING');
  const canPerformProcurementAction = isProcurement || isPurchasing;

  const canReceiveGoods =
    isProcurement ||
    isPurchasing ||
    isProjectManager ||
    isHeadOfOperations ||
    userRoles.includes('PMO');

  // Authorized GET roles for reconciliation matching backend: PROCUREMENT, PURCHASING, PROJECT_MANAGER, SUPER_ADMIN, ADMIN, DIRECTOR, MANAGEMENT, GENERAL_MANAGER, HEAD_OF_OPERATIONS
  const canReadReconciliation =
    isProcurement ||
    isSuperAdmin ||
    isProjectManager ||
    isDirector ||
    isHeadOfOperations ||
    userRoles.includes('PURCHASING') ||
    userRoles.includes('ADMIN') ||
    userRoles.includes('DIRECTOR') ||
    userRoles.includes('GENERAL_MANAGER') ||
    userRoles.includes('MANAGEMENT') ||
    userRoles.includes('MANAGER');

  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const prIdParam = searchParams.get('prId');
  const poIdParam = searchParams.get('poId');
  const domainParam = searchParams.get('domain');
  const autoOpenedPrRef = useRef<string | null>(null);
  const autoOpenedPoRef = useRef<string | null>(null);

  // Workstation Tab
  const [activeTabKey, setActiveTabKey] = useState<string>(() => {
    if (tabParam === 'po' || poIdParam) return 'po';
    if (tabParam === 'pr' || prIdParam) return 'pr';
    if (tabParam === 'gr') return 'gr';
    if (tabParam === 'reconciliation') return 'reconciliation';
    if (tabParam === 'packages') return 'packages';
    return 'packages';
  });

  // PR Domain Sub-Tab (Material vs Jasa)
  const [prDomainTab, setPrDomainTab] = useState<'MATERIAL' | 'SERVICE'>(() => {
    if (domainParam?.toUpperCase() === 'SERVICE') return 'SERVICE';
    return 'MATERIAL';
  });

  // Package Intake Filters
  const [statusFilter, setStatusFilter] = useState<string>('SUBMITTED');

  // Package Drawer & Modals
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null);
  const [isPackageDrawerOpen, setIsPackageDrawerOpen] = useState<boolean>(false);

  // Return Package Modal
  const [returnModalOpen, setReturnModalOpen] = useState<boolean>(false);
  const [packageToReturn, setPackageToReturn] = useState<ProcurementPackage | null>(null);
  const [returnReason, setReturnReason] = useState<string>('');
  const [returnSubmitting, setReturnSubmitting] = useState<boolean>(false);

  // Create PR Submitting state
  const [createPrLoadingId, setCreatePrLoadingId] = useState<number | null>(null);

  // Existing PR, PO & GR Workflow Modal States
  const [selectedPrForApproval, setSelectedPrForApproval] = useState<any | null>(null);
  const [isPrApprovalModalOpen, setIsPrApprovalModalOpen] = useState<boolean>(false);
  const [prVersion, setPrVersion] = useState<number>(0);

  const [selectedPrForRfq, setSelectedPrForRfq] = useState<any | null>(null);
  const [isCreateRfqModalOpen, setIsCreateRfqModalOpen] = useState<boolean>(false);
  const [rfqVersion, setRfqVersion] = useState<number>(0);

  const [selectedPoForView, setSelectedPoForView] = useState<PurchaseOrderPrototypeRecord | null>(null);
  const [isPoModalOpen, setIsPoModalOpen] = useState<boolean>(false);
  const [selectedPrForServicePo, setSelectedPrForServicePo] = useState<any | null>(null);
  const [isServicePoModalOpen, setIsServicePoModalOpen] = useState<boolean>(false);
  const [poVersion, setPoVersion] = useState<number>(0);

  const [selectedPoForServiceOrder, setSelectedPoForServiceOrder] = useState<PurchaseOrderPrototypeRecord | null>(null);
  const [isServiceOrderModalOpen, setIsServiceOrderModalOpen] = useState<boolean>(false);

  const [selectedPoForServiceClaim, setSelectedPoForServiceClaim] = useState<PurchaseOrderPrototypeRecord | null>(null);
  const [isServiceClaimModalOpen, setIsServiceClaimModalOpen] = useState<boolean>(false);

  const [selectedPoForGr, setSelectedPoForGr] = useState<PurchaseOrderPrototypeRecord | null>(null);
  const [selectedGrForView, setSelectedGrForView] = useState<GoodsReceiptRecord | null>(null);
  const [isGrModalOpen, setIsGrModalOpen] = useState<boolean>(false);
  const [grVersion, setGrVersion] = useState<number>(0);

  // 0. AUTHORITATIVE DASHBOARD SUMMARY (EPMS — PROCUREMENT-SUMMARY-LAZYLOAD-R1)
  const {
    data: dashboardSummary,
    isLoading: summaryLoading,
    refetch: refetchSummary,
  } = useQuery({
    queryKey: ['procurement', 'summary'],
    queryFn: () => ProcurementService.getDashboardSummary(),
    enabled: Boolean(user),
    staleTime: 60 * 1000,
  });

  // 1. CANONICAL INTAKE: GET /procurement/packages
  const packageQueryFilters = useMemo(() => {
    const q: { status?: ProcurementPackageStatus } = {};
    if (statusFilter && statusFilter !== 'ALL') {
      q.status = statusFilter as ProcurementPackageStatus;
    }
    return q;
  }, [statusFilter]);

  const {
    data: packages = [],
    isLoading: packagesLoading,
    isError: packagesError,
    refetch: refetchPackages,
  } = useQuery({
    queryKey: ['procurement', 'packages', packageQueryFilters],
    queryFn: () => ProcurementService.getPackages(packageQueryFilters),
    enabled: Boolean(user) && activeTabKey === 'packages',
    staleTime: 60 * 1000,
  });

  // Query for unresolved reconciliations count badge (tab-scoped for authorized roles)
  const { data: unresolvedReconciliations = [], refetch: refetchReconciliations } = useQuery({
    queryKey: ['procurement', 'reconciliations'],
    queryFn: () => ProcurementService.getUnresolvedReconciliations(),
    enabled: Boolean(user && canReadReconciliation && activeTabKey === 'reconciliation'),
    staleTime: 60 * 1000,
  });

  const submittedPackagesCount = useMemo(() => {
    if (statusFilter === 'SUBMITTED') return packages.length;
    return packages.filter((p) => p.status === 'SUBMITTED').length;
  }, [packages, statusFilter]);

  // Authoritative counters with tab-local fallback
  // Card 1: Antrean Paket
  const hasPackageQueueAccess = dashboardSummary ? dashboardSummary.packageQueueCount !== null : true;
  const effectivePackageCount =
    dashboardSummary?.packageQueueCount !== null && dashboardSummary?.packageQueueCount !== undefined
      ? dashboardSummary.packageQueueCount
      : submittedPackagesCount;

  // Card 2: Perlu Rekonsiliasi
  const effectiveReconciliationCount = canReadReconciliation
    ? (dashboardSummary?.reconciliationCount !== null && dashboardSummary?.reconciliationCount !== undefined
        ? dashboardSummary.reconciliationCount
        : unresolvedReconciliations.length)
    : (dashboardSummary?.reconciliationCount ?? 0);

  // 2. Tab-Scoped Downstream Queries (PR, RFQ, PO, GR) - Lazy loaded per active tab
  const {
    data: prs = [],
    isLoading: prsLoading,
    refetch: refetchPrs,
  } = useQuery({
    queryKey: ['procurement', 'prs'],
    queryFn: async () => {
      try {
        const prData = await ProcurementService.getPurchaseRequests();
        return Array.isArray(prData) ? prData : [];
      } catch (e: any) {
        if (e.response?.status === 401) {
          message.warning('Anda belum login. Beberapa data mungkin tidak tampil.');
        } else {
          message.error('Gagal mengambil data Purchase Request');
        }
        return [];
      }
    },
    enabled: Boolean(user) && (activeTabKey === 'pr' || Boolean(prIdParam)),
    staleTime: 60 * 1000,
  });

  const {
    data: rfqs = [],
    isLoading: rfqsLoading,
    refetch: refetchRfqs,
  } = useQuery({
    queryKey: ['procurement', 'rfqs'],
    queryFn: async () => {
      try {
        const rfqData = await ProcurementService.getRfqs();
        return Array.isArray(rfqData) ? rfqData : [];
      } catch (e: any) {
        console.warn('Failed to load RFQs:', e);
        return [];
      }
    },
    enabled: Boolean(user) && activeTabKey === 'pr',
    staleTime: 60 * 1000,
  });

  const {
    data: pos = [],
    isLoading: posLoading,
    refetch: refetchPos,
  } = useQuery({
    queryKey: ['procurement', 'purchase-orders'],
    queryFn: async () => {
      try {
        const poData = await ProcurementService.getPurchaseOrders();
        return Array.isArray(poData) ? poData : [];
      } catch (e: any) {
        if (e.response?.status === 401) {
          message.warning('Anda belum login. Beberapa data mungkin tidak tampil.');
        } else {
          message.error('Gagal mengambil data Purchase Order');
        }
        return [];
      }
    },
    enabled:
      Boolean(user) &&
      (activeTabKey === 'po' ||
        activeTabKey === 'pr' ||
        Boolean(poIdParam) ||
        isCreateRfqModalOpen ||
        Boolean(selectedPrForRfq)),
    staleTime: 60 * 1000,
  });

  const {
    data: rawGrs = [],
    isLoading: grsLoading,
    refetch: refetchGrs,
  } = useQuery({
    queryKey: ['procurement', 'goods-receipts'],
    queryFn: async () => {
      try {
        const grData = await ProcurementService.getGoodsReceipts();
        return Array.isArray(grData) ? grData : [];
      } catch (e: any) {
        console.warn('Failed to load goods receipts:', e);
        return [];
      }
    },
    enabled: Boolean(user) && (activeTabKey === 'gr' || activeTabKey === 'po'),
    staleTime: 60 * 1000,
  });

  // Card 3: Total Purchase Request
  const prSummaryCount =
    dashboardSummary?.purchaseRequestCount !== undefined
      ? dashboardSummary.purchaseRequestCount
      : resolveProcurementCount(prs);

  // Card 4: Total Purchase Order
  const poSummaryCount =
    dashboardSummary?.purchaseOrderCount !== undefined
      ? dashboardSummary.purchaseOrderCount
      : resolveProcurementCount(pos);

  // Tab Badge: Goods Receipt
  const grBadgeCount =
    dashboardSummary?.goodsReceiptCount !== undefined
      ? dashboardSummary.goodsReceiptCount
      : rawGrs.length;

  // Deep-link support: Auto-select tab based on tabParam / query params
  useEffect(() => {
    if (tabParam === 'po' || poIdParam) {
      setActiveTabKey('po');
    } else if (tabParam === 'pr' || prIdParam) {
      setActiveTabKey('pr');
    } else if (tabParam === 'gr') {
      setActiveTabKey('gr');
    } else if (tabParam === 'reconciliation') {
      setActiveTabKey('reconciliation');
    } else if (tabParam === 'packages') {
      setActiveTabKey('packages');
    }
  }, [tabParam, prIdParam, poIdParam]);

  // Deep-link support: Auto-open PO modal for poIdParam
  useEffect(() => {
    if (!poIdParam) return;
    if (autoOpenedPoRef.current === poIdParam) return;

    const poRecord = pos.find(
      (p: any) =>
        String(p.id) === poIdParam ||
        String(p.poId) === poIdParam ||
        String(p.poNumber) === poIdParam
    );
    if (poRecord) {
      autoOpenedPoRef.current = poIdParam;
      setSelectedPoForView((poRecord as any).rawRecord || (poRecord as any));
      setIsPoModalOpen(true);
    }
  }, [poIdParam, pos]);

  useEffect(() => {
    if (!prIdParam) return;
    if (autoOpenedPrRef.current === prIdParam) return;

    const prIdNum = Number(prIdParam);
    if (!Number.isFinite(prIdNum) || prIdNum <= 0) return;

    // Check if present in prs list
    const foundInList = prs.find((p: any) => Number(p.id) === prIdNum);
    if (foundInList) {
      autoOpenedPrRef.current = prIdParam;
      setSelectedPrForApproval(foundInList);
      setIsPrApprovalModalOpen(true);
      return;
    }

    if (prsLoading) return;

    // Otherwise, fetch authoritative PR by ID directly
    let isCancelled = false;
    ProcurementService.getPurchaseRequestById(prIdNum)
      .then((fetchedPr) => {
        if (!isCancelled && fetchedPr && (fetchedPr.id || (fetchedPr as any).prId)) {
          autoOpenedPrRef.current = prIdParam;
          setSelectedPrForApproval(fetchedPr);
          setIsPrApprovalModalOpen(true);
        }
      })
      .catch((err) => {
        console.warn(`Failed to load PR #${prIdNum} for deep link:`, err);
      });

    return () => {
      isCancelled = true;
    };
  }, [prIdParam, prs, prsLoading]);

  const { activeRfqMapByPrId, latestRfqMapByPrId } = useMemo(() => {
    const activeMap: Record<string, RfqRecord> = {};
    const latestMap: Record<string, RfqRecord> = {};

    // Sort rfqs newest first
    const sortedRfqs = [...rfqs].sort((a: any, b: any) => {
      const timeA = new Date(a.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || 0).getTime();
      if (timeA !== timeB) return timeB - timeA;
      return (Number(b.id) || 0) - (Number(a.id) || 0);
    });

    for (const r of sortedRfqs) {
      const keys: string[] = [];
      if (r.prId) keys.push(String(r.prId));
      if (r.purchaseRequest?.prNumber) keys.push(String(r.purchaseRequest.prNumber));

      for (const k of keys) {
        if (!latestMap[k]) {
          latestMap[k] = r;
        }
        if (r.status !== 'CANCELLED' && !activeMap[k]) {
          activeMap[k] = r;
        }
      }
    }

    return { activeRfqMapByPrId: activeMap, latestRfqMapByPrId: latestMap };
  }, [rfqs]);

  // Backward compatibility alias: rfqMapByPrId points to latest historical RFQ
  const rfqMapByPrId = latestRfqMapByPrId;

  const poMapByPrId = useMemo(() => {
    const map: Record<string, any> = {};
    for (const p of pos) {
      const anyP = p as any;
      const prId = anyP.purchaseRequestId || anyP.purchaseRequest?.id || anyP.prId;
      if (prId) map[String(prId)] = p;
      const prNum = anyP.purchaseRequest?.prNumber || anyP.prNumber;
      if (prNum) map[String(prNum)] = p;
    }
    return map;
  }, [pos]);

  const materialPrs = useMemo(() => prs.filter((p: any) => !checkIsServicePr(p)), [prs]);
  const servicePrs = useMemo(() => prs.filter((p: any) => checkIsServicePr(p)), [prs]);

  const checkIsDuplicate = useCallback(
    (r: any) => checkIsDuplicatePr(r, prs),
    [prs]
  );

  const existingPoForSelectedPr = useMemo(() => {
    if (!selectedPrForRfq) return null;
    const prId = Number(selectedPrForRfq.id);
    return (
      pos.find((p: any) => {
        const pPrId = Number(p.purchaseRequestId || p.purchaseRequest?.id || p.prId);
        if (prId && pPrId === prId) return true;
        if (selectedPrForRfq.prNumber && p.purchaseRequest?.prNumber === selectedPrForRfq.prNumber) return true;
        return false;
      }) || null
    );
  }, [selectedPrForRfq, pos]);

  const handleOpenPrApproval = (pr: any) => {
    setSelectedPrForApproval(pr);
    setIsPrApprovalModalOpen(true);
  };

  // 3. ACTION HANDLERS FOR PROCUREMENT PACKAGE
  const handleOpenDetail = (pkgId: number) => {
    setSelectedPackageId(pkgId);
    setIsPackageDrawerOpen(true);
  };

  const handleOpenReturnModal = (pkg: ProcurementPackage) => {
    setPackageToReturn(pkg);
    setReturnReason('');
    setReturnModalOpen(true);
  };

  const handleConfirmReturn = async () => {
    if (!packageToReturn) return;
    const trimmed = returnReason.trim();
    if (!trimmed) {
      message.error('Alasan pengembalian paket wajib diisi');
      return;
    }

    setReturnSubmitting(true);
    try {
      await ProcurementService.returnPackage(packageToReturn.id, { reason: trimmed });
      message.success(`Paket pengadaan ${packageToReturn.packageNumber} berhasil dikembalikan ke PM.`);
      queryClient.invalidateQueries({ queryKey: ['procurement', 'packages'] });
      queryClient.invalidateQueries({ queryKey: ['procurement', 'packages', packageToReturn.id] });
      queryClient.invalidateQueries({ queryKey: ['procurement', 'summary'] });
      setReturnModalOpen(false);
      setPackageToReturn(null);
      setReturnReason('');
      if (isPackageDrawerOpen) {
        setIsPackageDrawerOpen(false);
      }
    } catch (err: any) {
      console.error('Failed to return package:', err);
      message.error(err.response?.data?.message || 'Gagal mengembalikan paket ke PM');
    } finally {
      setReturnSubmitting(false);
    }
  };

  const handleCreatePr = async (pkg: ProcurementPackage) => {
    setCreatePrLoadingId(pkg.id);
    try {
      const result = await ProcurementService.createPrFromPackage(pkg.id);
      message.success(
        `Purchase Request ${result.purchaseRequest?.prNumber || (result as any).prNumber || ''} berhasil dibuat dari paket pengadaan!`
      );
      queryClient.invalidateQueries({ queryKey: ['procurement', 'packages'] });
      queryClient.invalidateQueries({ queryKey: ['procurement', 'packages', pkg.id] });
      queryClient.invalidateQueries({ queryKey: ['procurement', 'prs-pos'] });
      queryClient.invalidateQueries({ queryKey: ['procurement', 'prs'] });
      queryClient.invalidateQueries({ queryKey: ['procurement', 'summary'] });
      refetchPrs();
      if (isPackageDrawerOpen) {
        setIsPackageDrawerOpen(false);
      }
    } catch (err: any) {
      console.error('Failed to create PR from package:', err);
      const status = err.response?.status;
      const errorMsg = err.response?.data?.message || err.message || 'Gagal membuat Purchase Request';

      if (status === 409) {
        message.warning('Purchase Request sudah pernah dibuat untuk paket pengadaan ini.');
        queryClient.invalidateQueries({ queryKey: ['procurement', 'packages'] });
        queryClient.invalidateQueries({ queryKey: ['procurement', 'packages', pkg.id] });
      } else if (status === 422) {
        Modal.warning({
          title: 'Safety Gate Aktif — Rekonsiliasi Belum Selesai',
          centered: true,
          width: 520,
          content: (
            <div style={{ marginTop: 8 }}>
              <Paragraph style={{ color: '#0f172a', fontSize: 13 }}>
                {errorMsg}
              </Paragraph>
              <Alert
                type="warning"
                showIcon
                message="Tindakan Diperlukan"
                description="Terdapat item PR legacy atau ad-hoc pada proyek ini yang belum direkonsiliasi dengan WBS RAB. Selesaikan rekonsiliasi atau eksklusi item terlebih dahulu untuk mencegah duplikasi pengadaan barang/jasa."
                style={{ marginTop: 12 }}
              />
            </div>
          ),
          okText: 'Buka Tab Rekonsiliasi',
          cancelText: 'Tutup',
          okButtonProps: { style: { backgroundColor: '#1d4ed8' } },
          onOk: () => {
            setActiveTabKey('reconciliation');
          },
        });
      } else if (status === 403) {
        message.error('Akses ditolak. Anda tidak memiliki otoritas untuk memproses paket ini.');
      } else if (status === 404) {
        message.error('Paket pengadaan tidak ditemukan di database.');
        queryClient.invalidateQueries({ queryKey: ['procurement', 'packages'] });
      } else {
        message.error(errorMsg);
      }
    } finally {
      setCreatePrLoadingId(null);
    }
  };

  const handleViewLinkedPr = (linkedPrOrPackage: any) => {
    const linkedPr = linkedPrOrPackage?.purchaseRequest || linkedPrOrPackage;
    if (!linkedPr) {
      message.info('Informasi Purchase Request tidak tersedia');
      return;
    }
    const found = prs.find(
      (p: any) =>
        String(p.id) === String(linkedPr.id) ||
        (linkedPr.prNumber && p.prNumber === linkedPr.prNumber)
    );
    setSelectedPrForApproval(found || linkedPr);
    setIsPrApprovalModalOpen(true);
  };

  // 4. COLUMNS DEFINITIONS
  const packageColumns = useMemo(
    () => [
      {
        title: 'NOMOR PAKET & JUDUL',
        key: 'packageNumber',
        width: 250,
        render: (_: any, r: ProcurementPackage) => {
          const isService = (r.items || []).some((item) =>
            ['SUBCONTRACTOR', 'EQUIPMENT', 'OPERATIONAL'].includes(item.costItem?.categoryKey || '')
          );
          return (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span className={styles.idMonospace} style={{ fontWeight: 700, fontSize: 13, color: '#1D4ED8' }}>
                  {r.packageNumber || `PKG-${r.id}`}
                </span>
                <Tag color={isService ? 'purple' : 'cyan'} style={{ fontSize: 9.5, lineHeight: '14px', margin: 0, fontWeight: 700 }}>
                  {isService ? 'JASA' : 'MATERIAL'}
                </Tag>
              </div>
              <div style={{ fontWeight: 600, fontSize: 12.5, color: '#0F172A', marginTop: 2 }}>
                {r.title}
              </div>
              <div style={{ fontSize: 10.5, color: '#64748B', marginTop: 2 }}>
                Ref ID: #{r.id}
              </div>
            </div>
          );
        },
      },
      {
        title: 'PROYEK',
        key: 'project',
        width: 220,
        render: (_: any, r: ProcurementPackage) => (
          <div>
            <div style={{ fontWeight: 600, fontSize: 12.5, color: '#0F172A' }}>
              {r.project?.name || 'Tanpa Nama Proyek'}
            </div>
            {r.project?.code && (
              <span className={styles.subtleCodeTag} style={{ background: '#F1F5F9', color: '#475569', display: 'inline-block', marginTop: 2 }}>
                {r.project.code}
              </span>
            )}
          </div>
        ),
      },
      {
        title: 'PEMBUAT (PM)',
        key: 'requester',
        width: 170,
        render: (_: any, r: ProcurementPackage) => (
          <div>
            <div style={{ fontWeight: 500, fontSize: 12, color: '#0F172A' }}>
              {r.requester?.fullName || r.requester?.email || '—'}
            </div>
            {r.submittedAt && (
              <div style={{ fontSize: 10.5, color: '#64748B', marginTop: 2 }}>
                Diajukan: {formatDateTime(r.submittedAt)}
              </div>
            )}
          </div>
        ),
      },
      {
        title: 'TARGET DIBUTUHKAN',
        dataIndex: 'requiredDate',
        key: 'requiredDate',
        width: 150,
        render: (date: string) => (
          <span className={styles.idMonospace} style={{ fontSize: 12, color: date ? '#0F172A' : '#94A3B8' }}>
            {formatDate(date)}
          </span>
        ),
      },
      {
        title: 'ITEM & ESTIMASI TOTAL',
        key: 'itemsTotal',
        width: 170,
        align: 'right' as const,
        render: (_: any, r: ProcurementPackage) => (
          <div>
            <div className={styles.currencyText} style={{ color: '#059669', fontSize: 13 }}>
              {formatCurrency(r.totalEstimatedAmount)}
            </div>
            <span style={{ fontSize: 11, color: '#64748B' }}>
              {(r.items || []).length} Item RAB
            </span>
          </div>
        ),
      },
      {
        title: 'STATUS',
        dataIndex: 'status',
        key: 'status',
        width: 140,
        align: 'center' as const,
        render: (status: ProcurementPackageStatus) => getPackageStatusTag(status),
      },
      {
        title: 'AKSI',
        key: 'action',
        width: 220,
        align: 'center' as const,
        render: (_: any, r: ProcurementPackage) => {
          const isSubmitted = r.status === 'SUBMITTED';
          const isPrCreated = r.status === 'PR_CREATED';
          const isReturned = r.status === 'RETURNED';

          return (
            <Space size={6} wrap>
              <Button
                size="small"
                icon={<EyeOutlined />}
                onClick={() => handleOpenDetail(r.id)}
                className={styles.btnActionBlue}
              >
                Detail
              </Button>

              {isSubmitted && canPerformProcurementAction && (
                <>
                  <Button
                    type="primary"
                    size="small"
                    icon={<SendOutlined />}
                    loading={createPrLoadingId === r.id}
                    onClick={() => handleCreatePr(r)}
                    className={styles.btnActionPrimary}
                  >
                    Buat PR
                  </Button>
                  <Button
                    size="small"
                    icon={<RollbackOutlined />}
                    onClick={() => handleOpenReturnModal(r)}
                    className={styles.btnActionDanger}
                  >
                    Kembalikan
                  </Button>
                </>
              )}

              {isPrCreated && (
                <Button
                  size="small"
                  icon={<FileTextOutlined />}
                  onClick={() => handleViewLinkedPr(r)}
                  style={{
                    borderRadius: 6,
                    fontWeight: 600,
                    fontSize: 11.5,
                    borderColor: '#86EFAC',
                    color: '#15803D',
                    background: '#F0FDF4',
                  }}
                >
                  Lihat PR
                </Button>
              )}

              {isReturned && (
                <Tooltip title={r.rejectionReason || 'Paket dikembalikan ke PM untuk revisi'}>
                  <Tag color="volcano" style={{ fontSize: 10, margin: 0, borderRadius: 4 }}>
                    Dalam Revisi PM
                  </Tag>
                </Tooltip>
              )}
            </Space>
          );
        },
      },
    ],
    [canPerformProcurementAction, createPrLoadingId]
  );

  // Helper: Service Sourcing Presentation (Section 4)
  const renderServiceSourcing = useCallback((r: any, rfq: any, po: any) => {
    if (po) {
      return (
        <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 3, alignItems: 'flex-start' }}>
          <Tag color="cyan" style={{ fontWeight: 700, fontSize: 10, margin: 0, padding: '0 5px', lineHeight: '18px', whiteSpace: 'nowrap' }}>
            SERVICE PO ISSUED
          </Tag>
          {rfq ? (
            <span style={{ fontSize: 10.5, color: '#64748B' }}>
              via {rfq.rfqNumber}
            </span>
          ) : (
            <span style={{ fontSize: 10.5, color: '#64748B' }}>
              Direct PO
            </span>
          )}
        </div>
      );
    }

    if (rfq && rfq.status === 'OPEN') {
      return (
        <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 3, alignItems: 'flex-start' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexWrap: 'nowrap' }}>
            <Tag color="blue" style={{ fontWeight: 700, fontSize: 10, margin: 0, padding: '0 5px', lineHeight: '18px', whiteSpace: 'nowrap' }}>
              COMPETITIVE RFQ
            </Tag>
            <Tag color="processing" style={{ fontSize: 9.5, margin: 0, padding: '0 4px', fontWeight: 600, lineHeight: '18px', whiteSpace: 'nowrap' }}>
              OPEN
            </Tag>
          </div>
          <span className={styles.idMonospace} style={{ fontSize: 11, color: '#1D4ED8', fontWeight: 600, whiteSpace: 'nowrap' }}>
            {rfq.rfqNumber}
          </span>
        </div>
      );
    }

    if (rfq && rfq.status === 'CANCELLED') {
      return (
        <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 3, alignItems: 'flex-start' }}>
          <Tag color="default" style={{ fontWeight: 700, fontSize: 10, margin: 0, padding: '0 5px', color: '#475569', background: '#F1F5F9', lineHeight: '18px', whiteSpace: 'nowrap' }}>
            DIRECT
          </Tag>
          <span style={{ fontSize: 10, color: '#94A3B8' }}>
            {rfq.rfqNumber} Dibatalkan
          </span>
        </div>
      );
    }

    return (
      <Tag color="default" style={{ fontWeight: 700, fontSize: 10, margin: 0, padding: '0 5px', color: '#475569', background: '#F1F5F9', lineHeight: '18px', whiteSpace: 'nowrap' }}>
        DIRECT
      </Tag>
    );
  }, []);

  // Helper: Service PO / SPK Presentation (Section 3)
  const renderServicePoOrSpk = useCallback((po: any) => {
    if (!po) {
      return <span style={{ color: '#94A3B8', fontSize: 12 }}>Belum Terbit</span>;
    }
    return (
      <Space direction="vertical" size={2}>
        <span className={styles.idMonospace} style={{ fontWeight: 700, color: '#0F172A', fontSize: 11.5 }}>
          {po.poNumber || `PO-${po.id}`}
        </span>
        <Tag color="purple" style={{ fontSize: 9.5, margin: 0, padding: '0 4px', fontWeight: 600 }}>
          SPK Aktif
        </Tag>
      </Space>
    );
  }, []);

  // ─────────────────────────────────────────────
  // MATERIAL PR COLUMNS (Section 2)
  // Columns: PR, Nilai, Approval, RFQ, Vendor, PO, Aksi
  // ─────────────────────────────────────────────
  const materialPrColumns = useMemo(
    () => [
      {
        title: 'PR',
        dataIndex: 'prNumber',
        key: 'prNumber',
        width: 170,
        render: (val: string, r: any) => {
          const isDuplicate = checkIsDuplicate(r);
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap' }}>
                <span className={styles.idMonospace} style={{ fontWeight: 700, color: '#0F172A', fontSize: 12.5 }}>
                  {val || `PR-${r.id}`}
                </span>
                {isDuplicate && (
                  <Tooltip title={`Terdeteksi lebih dari satu PR untuk proyek ini (#${r.projectId}). Data tetap dipreservasi.`}>
                    <Tag className={styles.duplicateTag}>DUPLIKAT</Tag>
                  </Tooltip>
                )}
              </div>
              <span style={{ fontSize: 11, color: '#64748B' }}>Ref ID: #{r.id}</span>
            </div>
          );
        },
      },
      {
        title: 'NILAI',
        dataIndex: 'totalEstimatedAmount',
        key: 'totalEstimatedAmount',
        width: 140,
        align: 'right' as const,
        render: (val: number) => (
          <span className={styles.currencyText} style={{ color: '#0F172A', fontWeight: 600, fontSize: 12.5 }}>
            {formatCurrency(val)}
          </span>
        ),
      },
      {
        title: 'APPROVAL',
        key: 'approvalStatus',
        width: 180,
        render: (_: any, r: any) => {
          const effectiveStatus: PrApprovalStatus = (r.status as PrApprovalStatus) || 'SUBMITTED';
          return <PrStatusBadge status={effectiveStatus} />;
        },
      },
      {
        title: 'RFQ',
        key: 'rfqStatus',
        width: 170,
        render: (_: any, r: any) => {
          const rfq = rfqMapByPrId[String(r.id)] || (r.prNumber ? rfqMapByPrId[String(r.prNumber)] : undefined);
          if (!rfq) return <span style={{ color: '#94A3B8' }}>—</span>;
          return (
            <Space direction="vertical" size={2}>
              <span className={styles.idMonospace} style={{ fontWeight: 700, color: '#1D4ED8', fontSize: 11.5 }}>
                {rfq.rfqNumber}
              </span>
              <StatusBadge domain="rfq" status={rfq.status} showDot />
            </Space>
          );
        },
      },
      {
        title: 'VENDOR',
        key: 'vendor',
        width: 180,
        render: (_: any, r: any) => {
          const po = poMapByPrId[String(r.id)] || (r.prNumber ? poMapByPrId[String(r.prNumber)] : undefined);
          const rfq = rfqMapByPrId[String(r.id)] || (r.prNumber ? rfqMapByPrId[String(r.prNumber)] : undefined);
          const vendorName =
            po?.vendor?.name ||
            po?.vendorName ||
            po?.vendor_name ||
            rfq?.comparison?.selectedWinnerVendorName;
          if (!vendorName) return <span style={{ color: '#94A3B8' }}>—</span>;
          return (
            <span style={{ fontSize: 12, color: '#334155', fontWeight: 600 }} title={vendorName}>
              {vendorName}
            </span>
          );
        },
      },
      {
        title: 'PO',
        key: 'po',
        width: 160,
        render: (_: any, r: any) => {
          const po = poMapByPrId[String(r.id)] || (r.prNumber ? poMapByPrId[String(r.prNumber)] : undefined);
          if (!po) return <span style={{ color: '#94A3B8' }}>—</span>;
          return (
            <Space direction="vertical" size={2}>
              <span className={styles.idMonospace} style={{ fontWeight: 700, color: '#0F172A', fontSize: 11.5 }}>
                {po.poNumber || `PO-${po.id}`}
              </span>
              <StatusBadge domain="po" status={po.status} />
            </Space>
          );
        },
      },
      {
        title: 'AKSI',
        key: 'action',
        align: 'center' as const,
        width: 160,
        render: (_: any, r: any) => {
          const effectiveStatus = r.status || 'SUBMITTED';
          const isApproved = effectiveStatus === 'APPROVED';
          const activeRfq = activeRfqMapByPrId[String(r.id)] || (r.prNumber ? activeRfqMapByPrId[String(r.prNumber)] : undefined);
          const latestRfq = latestRfqMapByPrId[String(r.id)] || (r.prNumber ? latestRfqMapByPrId[String(r.prNumber)] : undefined);
          const rfq = latestRfq;
          const po = poMapByPrId[String(r.id)] || (r.prNumber ? poMapByPrId[String(r.prNumber)] : undefined);
          const canActOnPr = isProcurement || isPurchasing;

          let primaryBtn: React.ReactNode = null;
          if (po) {
            primaryBtn = (
              <Button
                size="small"
                icon={<EyeOutlined />}
                onClick={() => {
                  setSelectedPoForView((po as any).rawRecord || po);
                  setIsPoModalOpen(true);
                }}
                className={styles.btnActionSecondary}
              >
                Lihat PO
              </Button>
            );
          } else if (activeRfq) {
            primaryBtn = (
              <Button
                size="small"
                icon={<EyeOutlined />}
                onClick={() => {
                  setSelectedPrForRfq(r);
                  setIsCreateRfqModalOpen(true);
                }}
                className={styles.btnActionSecondary}
              >
                Kelola RFQ
              </Button>
            );
          } else if (isApproved && canActOnPr) {
            const hasCancelledRfqOnly = Boolean(latestRfq && latestRfq.status === 'CANCELLED');
            primaryBtn = (
              <Button
                type="primary"
                size="small"
                icon={<SendOutlined />}
                onClick={() => {
                  setSelectedPrForRfq(r);
                  setIsCreateRfqModalOpen(true);
                }}
                className={styles.btnActionPrimary}
              >
                {hasCancelledRfqOnly ? 'Buat RFQ Baru' : 'Buat RFQ'}
              </Button>
            );
          } else {
            primaryBtn = (
              <Button
                size="small"
                icon={<AuditOutlined />}
                onClick={() => handleOpenPrApproval(r)}
                className={styles.btnActionBlue}
              >
                Alur Approval
              </Button>
            );
          }

          const overflowItems: MenuProps['items'] = [
            {
              key: 'approval',
              icon: <AuditOutlined />,
              label: 'Lihat Alur Approval',
              onClick: () => handleOpenPrApproval(r),
            },
            {
              key: 'detail',
              icon: <FileTextOutlined />,
              label: 'Lihat Detail PR',
              onClick: () => handleOpenPrApproval(r),
            },
            ...(latestRfq
              ? [
                  {
                    key: 'rfq',
                    icon: <EyeOutlined />,
                    label: activeRfq ? 'Lihat RFQ' : 'Lihat Riwayat RFQ (Batal)',
                    onClick: () => {
                      setSelectedPrForRfq(r);
                      setIsCreateRfqModalOpen(true);
                    },
                  },
                ]
              : []),
            ...(po
              ? [
                  {
                    key: 'po',
                    icon: <ShoppingCartOutlined />,
                    label: 'Lihat PO',
                    onClick: () => {
                      setSelectedPoForView((po as any).rawRecord || po);
                      setIsPoModalOpen(true);
                    },
                  },
                ]
              : []),
          ];

          return (
            <div className={styles.actionCell}>
              {primaryBtn}
              <Dropdown menu={{ items: overflowItems }} trigger={['click']} placement="bottomRight">
                <Button size="small" icon={<MoreOutlined />} title="Menu Lainnya" />
              </Dropdown>
            </div>
          );
        },
      },
    ],
    [prVersion, rfqVersion, poVersion, isProcurement, isPurchasing, prs, pos, rfqMapByPrId, activeRfqMapByPrId, latestRfqMapByPrId, poMapByPrId, checkIsDuplicate]
  );

  // ─────────────────────────────────────────────
  // SERVICE PR COLUMNS (Section 3 & 4)
  // Columns: PR Jasa, Scope, Nilai, Approval, Sourcing, Service PO / SPK, Aksi
  // ─────────────────────────────────────────────
  const servicePrColumns = useMemo(
    () => [
      {
        title: 'PR JASA',
        dataIndex: 'prNumber',
        key: 'prNumber',
        width: 160,
        render: (val: string, r: any) => {
          const isDuplicate = checkIsDuplicate(r);
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap' }}>
                <span className={styles.idMonospace} style={{ fontWeight: 700, color: '#0F172A', fontSize: 12.5 }}>
                  {val || `PR-${r.id}`}
                </span>
                {isDuplicate && (
                  <Tooltip title={`Terdeteksi lebih dari satu PR untuk proyek ini (#${r.projectId}). Data tetap dipreservasi.`}>
                    <Tag className={styles.duplicateTag}>DUPLIKAT</Tag>
                  </Tooltip>
                )}
              </div>
              <span style={{ fontSize: 11, color: '#64748B' }}>Ref ID: #{r.id}</span>
            </div>
          );
        },
      },
      {
        title: 'SCOPE',
        key: 'scope',
        width: 260,
        render: (_: any, r: any) => {
          const firstItem = r.items?.[0];
          const scopeText =
            firstItem?.itemName ||
            firstItem?.item_name ||
            r.project?.name ||
            r.projectName ||
            'Layanan Jasa';
          const otherItemsCount = (r.items?.length || 1) - 1;

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Tooltip title={scopeText}>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#1E293B',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    lineHeight: '16px',
                  }}
                >
                  {scopeText}
                </span>
              </Tooltip>
              {otherItemsCount > 0 && (
                <span style={{ fontSize: 10.5, color: '#64748B' }}>
                  +{otherItemsCount} item lainnya
                </span>
              )}
            </div>
          );
        },
      },
      {
        title: 'NILAI',
        dataIndex: 'totalEstimatedAmount',
        key: 'totalEstimatedAmount',
        width: 130,
        align: 'right' as const,
        render: (val: number) => (
          <span className={styles.currencyText} style={{ color: '#0F172A', fontWeight: 600, fontSize: 12.5 }}>
            {formatCurrency(val)}
          </span>
        ),
      },
      {
        title: 'APPROVAL',
        key: 'approvalStatus',
        width: 160,
        render: (_: any, r: any) => {
          const effectiveStatus: PrApprovalStatus = (r.status as PrApprovalStatus) || 'SUBMITTED';
          return <PrStatusBadge status={effectiveStatus} />;
        },
      },
      {
        title: 'SOURCING',
        key: 'sourcing',
        width: 220,
        render: (_: any, r: any) => {
          const rfq = rfqMapByPrId[String(r.id)] || (r.prNumber ? rfqMapByPrId[String(r.prNumber)] : undefined);
          const po = poMapByPrId[String(r.id)] || (r.prNumber ? poMapByPrId[String(r.prNumber)] : undefined);
          return renderServiceSourcing(r, rfq, po);
        },
      },
      {
        title: 'SERVICE PO / SPK',
        key: 'servicePo',
        width: 150,
        render: (_: any, r: any) => {
          const po = poMapByPrId[String(r.id)] || (r.prNumber ? poMapByPrId[String(r.prNumber)] : undefined);
          return renderServicePoOrSpk(po);
        },
      },
      {
        title: 'AKSI',
        key: 'action',
        align: 'center' as const,
        width: 160,
        render: (_: any, r: any) => {
          const effectiveStatus = r.status || 'SUBMITTED';
          const isApproved = effectiveStatus === 'APPROVED';
          const rfq = rfqMapByPrId[String(r.id)] || (r.prNumber ? rfqMapByPrId[String(r.prNumber)] : undefined);
          const po = poMapByPrId[String(r.id)] || (r.prNumber ? poMapByPrId[String(r.prNumber)] : undefined);
          const canActOnPr = isProcurement || isPurchasing;

          let primaryBtn: React.ReactNode = null;
          if (po) {
            primaryBtn = (
              <Button
                size="small"
                icon={<FileTextOutlined />}
                onClick={() => {
                  setSelectedPoForServiceOrder((po as any).rawRecord || po);
                  setIsServiceOrderModalOpen(true);
                }}
                className={styles.btnActionSecondary}
              >
                Kelola SPK / WO
              </Button>
            );
          } else if (rfq && rfq.status === 'OPEN') {
            primaryBtn = (
              <Button
                size="small"
                icon={<EyeOutlined />}
                onClick={() => {
                  setSelectedPrForRfq(r);
                  setIsCreateRfqModalOpen(true);
                }}
                className={styles.btnActionSecondary}
              >
                Kelola RFQ
              </Button>
            );
          } else if (isApproved && canActOnPr && (!rfq || rfq.status === 'CANCELLED')) {
            primaryBtn = (
              <Button
                size="small"
                icon={<FileTextOutlined />}
                onClick={() => {
                  setSelectedPrForServicePo(r);
                  setIsServicePoModalOpen(true);
                }}
                className={styles.btnActionSecondary}
              >
                Buat Service PO
              </Button>
            );
          } else {
            primaryBtn = (
              <Button
                size="small"
                icon={<AuditOutlined />}
                onClick={() => handleOpenPrApproval(r)}
                className={styles.btnActionBlue}
              >
                Alur Approval
              </Button>
            );
          }

          const overflowItems: MenuProps['items'] = [
            {
              key: 'approval',
              icon: <AuditOutlined />,
              label: 'Lihat Alur Approval',
              onClick: () => handleOpenPrApproval(r),
            },
            {
              key: 'detail',
              icon: <FileTextOutlined />,
              label: 'Lihat Detail PR',
              onClick: () => handleOpenPrApproval(r),
            },
            ...(rfq
              ? [
                  {
                    key: 'rfq',
                    icon: <EyeOutlined />,
                    label: 'Lihat RFQ',
                    onClick: () => {
                      setSelectedPrForRfq(r);
                      setIsCreateRfqModalOpen(true);
                    },
                  },
                ]
              : []),
            ...(po
              ? [
                  {
                    key: 'po-view',
                    icon: <EyeOutlined />,
                    label: 'Lihat Service PO',
                    onClick: () => {
                      setSelectedPoForView((po as any).rawRecord || po);
                      setIsPoModalOpen(true);
                    },
                  },
                  {
                    key: 'spk-manage',
                    icon: <FileTextOutlined />,
                    label: 'Kelola SPK / WO',
                    onClick: () => {
                      setSelectedPoForServiceOrder((po as any).rawRecord || po);
                      setIsServiceOrderModalOpen(true);
                    },
                  },
                ]
              : []),
            ...(!rfq && isApproved && canActOnPr
              ? [
                  {
                    key: 'create-rfq-jasa',
                    icon: <SendOutlined />,
                    label: 'Buat RFQ Jasa',
                    onClick: () => {
                      setSelectedPrForRfq(r);
                      setIsCreateRfqModalOpen(true);
                    },
                  },
                ]
              : []),
          ];

          return (
            <div className={styles.actionCell}>
              {primaryBtn}
              <Dropdown menu={{ items: overflowItems }} trigger={['click']} placement="bottomRight">
                <Button size="small" icon={<MoreOutlined />} title="Menu Lainnya" />
              </Dropdown>
            </div>
          );
        },
      },
    ],
    [
      prVersion,
      rfqVersion,
      poVersion,
      isProcurement,
      isPurchasing,
      prs,
      pos,
      rfqMapByPrId,
      poMapByPrId,
      checkIsDuplicate,
      renderServiceSourcing,
      renderServicePoOrSpk,
    ]
  );

  const allGoodsReceipts: GoodsReceiptRecord[] = useMemo(() => {
    return (rawGrs || []).map((g: any) => {
      const items = Array.isArray(g.items) ? g.items : [];
      const totalQty = items.reduce((sum: number, it: any) => sum + Number(it.receivedQuantity || 0), 0);
      return {
        grId: String(g.id),
        grNumber: g.grNumber || `GR-${g.id}`,
        poId: String(g.poId || g.purchaseOrder?.id || ''),
        poNumber: g.purchaseOrder?.poNumber || (g.poId ? `PO-${g.poId}` : '-'),
        prId: g.purchaseOrder?.purchaseRequest?.id || g.purchaseOrder?.purchaseRequestId || '',
        prNumber: g.purchaseOrder?.purchaseRequest?.prNumber || '',
        projectId: g.purchaseOrder?.purchaseRequest?.project?.id || g.purchaseOrder?.purchaseRequest?.projectId || '',
        projectName: g.purchaseOrder?.purchaseRequest?.project?.name || g.purchaseOrder?.purchaseRequest?.projectName || '',
        vendorId: g.purchaseOrder?.vendor?.id || g.purchaseOrder?.vendorId || 0,
        vendorCode: g.purchaseOrder?.vendor?.code || g.purchaseOrder?.vendor?.vendorCode || '',
        vendorName: g.purchaseOrder?.vendor?.name || g.purchaseOrder?.vendorName || '—',
        receiptDate: g.receiptDate,
        deliveryNoteNumber: g.deliveryNoteNumber,
        remarks: g.remarks,
        status: (g.purchaseOrder?.status === 'COMPLETED' ? 'COMPLETED' : 'PARTIAL') as 'COMPLETED' | 'PARTIAL',
        createdAt: g.createdAt,
        createdBy: g.createdBy,
        createdByRaw: g.createdBy,
        creator: (g as any).creator,
        receiver: (g as any).receiver,
        totalItemsCount: items.length,
        totalQtyReceivedInGr: totalQty,
        items: items,
      };
    });
  }, [rawGrs, grVersion]);

  const poColumns = useMemo(
    () => [
      {
        title: 'NOMOR PO',
        dataIndex: 'poNumber',
        key: 'poNumber',
        width: 170,
        render: (poNum: string) => (
          <span className={styles.idMonospace} style={{ fontWeight: 700, color: '#1D4ED8' }}>
            {poNum}
          </span>
        ),
      },
      {
        title: 'VENDOR PEMENANG',
        key: 'vendor',
        width: 220,
        render: (_: any, r: any) => {
          const vName = r.vendor?.name || r.vendorName || '—';
          const vCode = r.vendor?.code || r.vendorCode;
          return (
            <div>
              <div style={{ fontWeight: 600, fontSize: 12.5, color: '#0F172A' }}>{vName}</div>
              {vCode && (
                <span className={styles.subtleCodeTag} style={{ background: '#F1F5F9', color: '#475569', display: 'inline-block', marginTop: 2 }}>
                  {vCode}
                </span>
              )}
            </div>
          );
        },
      },
      {
        title: 'TOTAL PEMBELIAN',
        dataIndex: 'totalAmount',
        key: 'totalAmount',
        width: 160,
        align: 'right' as const,
        render: (val: number) => (
          <span className={styles.currencyText} style={{ color: '#059669', fontSize: 13 }}>
            {formatCurrency(val)}
          </span>
        ),
      },
      {
        title: 'TIPE PO',
        dataIndex: 'orderType',
        key: 'orderType',
        width: 140,
        align: 'center' as const,
        render: (type: string) => {
          if (type === 'SERVICE') {
            return <Tag color="cyan" style={{ fontWeight: 600 }}>Jasa / Subcon</Tag>;
          }
          if (type === 'LEGACY_MIXED') {
            return <Tag color="orange" style={{ fontWeight: 600 }}>Legacy Campuran</Tag>;
          }
          return <Tag color="blue" style={{ fontWeight: 600 }}>Material</Tag>;
        },
      },
      {
        title: 'STATUS',
        dataIndex: 'status',
        key: 'status',
        width: 140,
        align: 'center' as const,
        render: (status: string) => <StatusBadge domain="po" status={status} showDot />,
      },
      {
        title: 'TANGGAL TERBIT',
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: 150,
        render: (date: string) => <span className={styles.idMonospace} style={{ fontSize: 12 }}>{formatDateTime(date)}</span>,
      },
      {
        title: 'AKSI',
        key: 'action',
        width: 250,
        align: 'center' as const,
        render: (_: any, r: any) => {
          const poRecord: PurchaseOrderPrototypeRecord = {
            poId: String(r.id || r.poId),
            poNumber: r.poNumber,
            comparisonId: r.comparisonId || '',
            rfqId: r.rfqId || '',
            rfqNumber: r.rfqNumber || '',
            prId: r.purchaseRequestId || r.purchaseRequest?.id || '',
            prNumber: r.purchaseRequest?.prNumber || '',
            projectId: r.projectId || r.purchaseRequest?.projectId || r.purchaseRequest?.project?.id || '',
            projectName: r.projectName || r.purchaseRequest?.projectName || r.purchaseRequest?.project?.name || r.project?.name || '',
            vendorId: r.vendorId || r.vendor?.id || 0,
            vendorCode: r.vendorCode || r.vendor?.code || '',
            vendorName: r.vendorName || r.vendor?.name || '—',
            totalAmount: Number(r.totalAmount || 0),
            budgetCeiling: 0,
            orderType: r.orderType,
            status: r.status,
            issuedAt: r.createdAt,
            issuedBy: r.issuedBy || 'Purchasing',
            deliveryDate: r.deliveryDate,
            deliveryLocation: r.deliveryLocation,
            paymentTerms: r.paymentTerms,
            notes: r.notes,
            items: r.items || [],
            serviceOrders: r.serviceOrders || [],
            vendor: r.vendor,
            purchaseRequest: r.purchaseRequest,
          };
          const poGrs = allGoodsReceipts.filter(
            (g) =>
              String(g.poId) === String(poRecord.poId || (poRecord as any).id) ||
              String(g.poNumber) === String(poRecord.poNumber)
          );
          const isEligibleForGr =
            (r.status === 'ISSUED' || r.status === 'PARTIALLY_FULFILLED') && canReceiveGoods;
          const isCompleted = r.status === 'COMPLETED';

          return (
            <Space size={6} wrap>
              <Button
                size="small"
                icon={<EyeOutlined />}
                onClick={() => {
                  setSelectedPoForView(poRecord);
                  setIsPoModalOpen(true);
                }}
                className={styles.btnActionSecondary}
              >
                Lihat PO
              </Button>

              {isEligibleForGr && r.orderType !== 'SERVICE' && (
                <Button
                  size="small"
                  icon={<InboxOutlined />}
                  onClick={() => {
                    setSelectedPoForGr(poRecord);
                    setSelectedGrForView(null);
                    setIsGrModalOpen(true);
                  }}
                  className={styles.btnActionTeal}
                >
                  Terima Barang
                </Button>
              )}

              {r.orderType === 'SERVICE' && (
                <>
                  <Button
                    size="small"
                    icon={<FileTextOutlined />}
                    onClick={() => {
                      setSelectedPoForServiceOrder(poRecord);
                      setIsServiceOrderModalOpen(true);
                    }}
                    className={styles.btnActionBlue}
                  >
                    SPK / Work Order
                  </Button>
                  <Button
                    size="small"
                    icon={<SafetyCertificateOutlined />}
                    onClick={() => {
                      setSelectedPoForServiceClaim(poRecord);
                      setIsServiceClaimModalOpen(true);
                    }}
                    className={styles.btnActionTeal}
                  >
                    Klaim Jasa
                  </Button>
                </>
              )}

              {isCompleted && (
                <Tag color="green" style={{ fontWeight: 700, margin: 0, padding: '2px 8px', borderRadius: 12, fontSize: 10.5 }}>
                  ● Selesai Diterima
                </Tag>
              )}

              {poGrs.length > 0 && (
                <Button
                  size="small"
                  onClick={() => {
                    setSelectedGrForView(poGrs[0]);
                    setSelectedPoForGr(null);
                    setIsGrModalOpen(true);
                  }}
                  className={styles.btnActionAmber}
                >
                  Riwayat GR ({poGrs.length})
                </Button>
              )}
            </Space>
          );
        },
      },
    ],
    [canReceiveGoods, grVersion, poVersion, allGoodsReceipts]
  );

  const grColumns = useMemo(
    () => [
      {
        title: 'NOMOR GR',
        dataIndex: 'grNumber',
        key: 'grNumber',
        width: 170,
        render: (grNum: string) => (
          <span className={styles.idMonospace} style={{ fontWeight: 700, color: '#0F766E' }}>
            {grNum}
          </span>
        ),
      },
      {
        title: 'NOMOR PO',
        dataIndex: 'poNumber',
        key: 'poNumber',
        width: 160,
        render: (poNum: string) => (
          <span className={styles.idMonospace} style={{ fontWeight: 600, color: '#1D4ED8' }}>
            {poNum}
          </span>
        ),
      },
      {
        title: 'VENDOR',
        key: 'vendor',
        width: 200,
        render: (_: any, r: GoodsReceiptRecord) => (
          <div>
            <div style={{ fontWeight: 600, fontSize: 12.5, color: '#0F172A' }}>{r.vendorName}</div>
            {r.vendorCode && (
              <span className={styles.subtleCodeTag} style={{ background: '#F1F5F9', color: '#475569', display: 'inline-block', marginTop: 2 }}>
                {r.vendorCode}
              </span>
            )}
          </div>
        ),
      },
      {
        title: 'TANGGAL TERIMA',
        dataIndex: 'receiptDate',
        key: 'receiptDate',
        width: 140,
        render: (date: string) => <span className={styles.idMonospace} style={{ fontSize: 12 }}>{formatDate(date)}</span>,
      },
      {
        title: 'NO. SURAT JALAN / DO',
        dataIndex: 'deliveryNoteNumber',
        key: 'deliveryNoteNumber',
        width: 160,
        render: (val: string) => <span style={{ fontSize: 12, color: val ? '#0F172A' : '#94A3B8' }}>{val || '—'}</span>,
      },
      {
        title: 'TOTAL ITEM DITERIMA',
        key: 'totalReceived',
        align: 'center' as const,
        width: 180,
        render: (_: any, r: GoodsReceiptRecord) => (
          <Tag color="teal" style={{ fontWeight: 600, fontSize: 11, margin: 0, borderRadius: 12, padding: '2px 8px' }}>
            {formatQuantity(r.totalQtyReceivedInGr)} Unit · {formatQuantity(r.totalItemsCount)} Item
          </Tag>
        ),
      },
      {
        title: 'STATUS PEMENUHAN',
        dataIndex: 'status',
        key: 'status',
        width: 140,
        align: 'center' as const,
        render: (status: string) => <StatusBadge domain="gr" status={status} showDot />,
      },
      {
        title: 'PENERIMA',
        key: 'createdBy',
        width: 160,
        render: (_: any, r: GoodsReceiptRecord) => (
          <UserIdentityDisplay
            user={(r as any).receiver || (r as any).creator}
            userId={(r as any).createdByRaw || r.createdBy}
            fallbackRole="Petugas Logistik"
            textStyle={{ fontSize: 12 }}
          />
        ),
      },
      {
        title: 'AKSI',
        key: 'action',
        width: 110,
        align: 'center' as const,
        render: (_: any, r: GoodsReceiptRecord) => (
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedGrForView(r);
              setSelectedPoForGr(null);
              setIsGrModalOpen(true);
            }}
            className={styles.btnActionTeal}
          >
            Lihat GR
          </Button>
        ),
      },
    ],
    []
  );

  // ─────────────────────────────────────────────
  // RESPONSIVE MOBILE PR CARD (Section 12)
  // ─────────────────────────────────────────────
  const renderPrMobileCard = useCallback(
    (r: any, isService: boolean) => {
      const isDuplicate = checkIsDuplicate(r);
      const effectiveStatus: PrApprovalStatus = (r.status as PrApprovalStatus) || 'SUBMITTED';
      const activeRfq = activeRfqMapByPrId[String(r.id)] || (r.prNumber ? activeRfqMapByPrId[String(r.prNumber)] : undefined);
      const latestRfq = latestRfqMapByPrId[String(r.id)] || (r.prNumber ? latestRfqMapByPrId[String(r.prNumber)] : undefined);
      const rfq = latestRfq;
      const po = poMapByPrId[String(r.id)] || (r.prNumber ? poMapByPrId[String(r.prNumber)] : undefined);
      const isApproved = effectiveStatus === 'APPROVED';
      const canActOnPr = isProcurement || isPurchasing;

      let primaryBtn: React.ReactNode = null;
      if (isService) {
        if (po) {
          primaryBtn = (
            <Button
              size="small"
              icon={<FileTextOutlined />}
              onClick={() => {
                setSelectedPoForServiceOrder((po as any).rawRecord || po);
                setIsServiceOrderModalOpen(true);
              }}
              className={styles.btnActionSecondary}
            >
              Kelola SPK / WO
            </Button>
          );
        } else if (activeRfq) {
          primaryBtn = (
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => {
                setSelectedPrForRfq(r);
                setIsCreateRfqModalOpen(true);
              }}
              className={styles.btnActionSecondary}
            >
              Kelola RFQ
            </Button>
          );
        } else if (isApproved && canActOnPr && !activeRfq) {
          primaryBtn = (
            <Button
              size="small"
              icon={<FileTextOutlined />}
              onClick={() => {
                setSelectedPrForServicePo(r);
                setIsServicePoModalOpen(true);
              }}
              className={styles.btnActionSecondary}
            >
              Buat Service PO
            </Button>
          );
        } else {
          primaryBtn = (
            <Button
              size="small"
              icon={<AuditOutlined />}
              onClick={() => handleOpenPrApproval(r)}
              className={styles.btnActionBlue}
            >
              Alur Approval
            </Button>
          );
        }
      } else {
        if (po) {
          primaryBtn = (
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => {
                setSelectedPoForView((po as any).rawRecord || po);
                setIsPoModalOpen(true);
              }}
              className={styles.btnActionSecondary}
            >
              Lihat PO
            </Button>
          );
        } else if (activeRfq) {
          primaryBtn = (
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => {
                setSelectedPrForRfq(r);
                setIsCreateRfqModalOpen(true);
              }}
              className={styles.btnActionSecondary}
            >
              Kelola RFQ
            </Button>
          );
        } else if (isApproved && canActOnPr) {
          const hasCancelledRfqOnly = Boolean(latestRfq && latestRfq.status === 'CANCELLED');
          primaryBtn = (
            <Button
              type="primary"
              size="small"
              icon={<SendOutlined />}
              onClick={() => {
                setSelectedPrForRfq(r);
                setIsCreateRfqModalOpen(true);
              }}
              className={styles.btnActionPrimary}
            >
              {hasCancelledRfqOnly ? 'Buat RFQ Baru' : 'Buat RFQ'}
            </Button>
          );
        } else {
          primaryBtn = (
            <Button
              size="small"
              icon={<AuditOutlined />}
              onClick={() => handleOpenPrApproval(r)}
              className={styles.btnActionBlue}
            >
              Alur Approval
            </Button>
          );
        }
      }

      const overflowItems: MenuProps['items'] = [
        {
          key: 'approval',
          icon: <AuditOutlined />,
          label: 'Lihat Alur Approval',
          onClick: () => handleOpenPrApproval(r),
        },
        {
          key: 'detail',
          icon: <FileTextOutlined />,
          label: 'Lihat Detail PR',
          onClick: () => handleOpenPrApproval(r),
        },
        ...(latestRfq
          ? [
              {
                key: 'rfq',
                icon: <EyeOutlined />,
                label: activeRfq ? 'Lihat RFQ' : 'Lihat Riwayat RFQ (Batal)',
                onClick: () => {
                  setSelectedPrForRfq(r);
                  setIsCreateRfqModalOpen(true);
                },
              },
            ]
          : []),
        ...(po
          ? [
              {
                key: 'po',
                icon: <ShoppingCartOutlined />,
                label: isService ? 'Lihat Service PO' : 'Lihat PO',
                onClick: () => {
                  setSelectedPoForView((po as any).rawRecord || po);
                  setIsPoModalOpen(true);
                },
              },
            ]
          : []),
        ...(isService && po
          ? [
              {
                key: 'spk-manage',
                icon: <FileTextOutlined />,
                label: 'Kelola SPK / WO',
                onClick: () => {
                  setSelectedPoForServiceOrder((po as any).rawRecord || po);
                  setIsServiceOrderModalOpen(true);
                },
              },
            ]
          : []),
      ];

      return (
        <div key={r.id} className={styles.prMobileCard}>
          <div className={styles.prMobileCardHeader}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span className={styles.idMonospace} style={{ fontWeight: 700, fontSize: 13, color: '#0F172A' }}>
                  {r.prNumber || `PR-${r.id}`}
                </span>
                <Tag color={isService ? 'cyan' : 'blue'} style={{ fontSize: 9.5, margin: 0, fontWeight: 700, padding: '0 4px' }}>
                  {isService ? 'JASA' : 'MATERIAL'}
                </Tag>
                {isDuplicate && (
                  <Tooltip title={`Terdeteksi lebih dari satu PR untuk proyek ini (#${r.projectId}). Data tetap dipreservasi.`}>
                    <Tag className={styles.duplicateTag}>DUPLIKAT</Tag>
                  </Tooltip>
                )}
              </div>
              <span style={{ fontSize: 11, color: '#64748B' }}>Ref ID: #{r.id}</span>
            </div>
            <span className={styles.currencyText} style={{ color: '#0F172A', fontSize: 13 }}>
              {formatCurrency(r.totalEstimatedAmount)}
            </span>
          </div>

          {isService && (
            <div className={styles.prMobileCardRow}>
              <span className={styles.prMobileCardLabel}>Scope:</span>
              <span style={{ fontWeight: 600, color: '#1E293B', textAlign: 'right', maxWidth: '65%' }}>
                {r.items?.[0]?.itemName || r.project?.name || 'Layanan Jasa'}
              </span>
            </div>
          )}

          <div className={styles.prMobileCardRow}>
            <span className={styles.prMobileCardLabel}>Approval:</span>
            <PrStatusBadge status={effectiveStatus} />
          </div>

          {isService ? (
            <div className={styles.prMobileCardRow}>
              <span className={styles.prMobileCardLabel}>Sourcing:</span>
              <div>{renderServiceSourcing(r, rfq, po)}</div>
            </div>
          ) : (
            <div className={styles.prMobileCardRow}>
              <span className={styles.prMobileCardLabel}>RFQ:</span>
              {rfq ? (
                <Space size={4}>
                  <span className={styles.idMonospace} style={{ fontSize: 11, color: '#1D4ED8', fontWeight: 600 }}>{rfq.rfqNumber}</span>
                  <StatusBadge domain="rfq" status={rfq.status} showDot />
                </Space>
              ) : (
                <span style={{ color: '#94A3B8' }}>—</span>
              )}
            </div>
          )}

          <div className={styles.prMobileCardRow}>
            <span className={styles.prMobileCardLabel}>{isService ? 'Service PO / SPK:' : 'PO:'}</span>
            {isService ? (
              <div>{renderServicePoOrSpk(po)}</div>
            ) : (
              po ? (
                <Space size={4}>
                  <span className={styles.idMonospace} style={{ fontSize: 11, fontWeight: 600 }}>{po.poNumber || `PO-${po.id}`}</span>
                  <StatusBadge domain="po" status={po.status} />
                </Space>
              ) : (
                <span style={{ color: '#94A3B8' }}>—</span>
              )
            )}
          </div>

          <div className={styles.prMobileCardActions}>
            {primaryBtn}
            <Dropdown menu={{ items: overflowItems }} trigger={['click']} placement="bottomRight">
              <Button size="small" icon={<MoreOutlined />} title="Menu Lainnya" />
            </Dropdown>
          </div>
        </div>
      );
    },
    [
      checkIsDuplicate,
      rfqMapByPrId,
      poMapByPrId,
      isProcurement,
      isPurchasing,
      renderServiceSourcing,
      renderServicePoOrSpk,
    ]
  );

  // 5. TABS ITEMS
  const tabItems = [
    {
      key: 'packages',
      label: (
        <span>
          <InboxOutlined style={{ marginRight: 6 }} />
          Paket Pengadaan
          <span className={`${styles.tabBadge} ${activeTabKey === 'packages' ? styles.tabBadgeActive : styles.tabBadgeInactive}`}>
            {hasPackageQueueAccess ? effectivePackageCount : 0}
          </span>
        </span>
      ),
      children: (
        <div>
          {/* Package Filter & Refresh Toolbar */}
          <div className={styles.tabToolbar}>
            <Space size={12} wrap align="center">
              <span style={{ fontWeight: 600, fontSize: 13, color: '#475569' }}>
                <FilterOutlined style={{ marginRight: 6 }} />
                Filter Status Paket:
              </span>
              <Select
                size="small"
                value={statusFilter}
                onChange={(val) => setStatusFilter(val)}
                style={{ width: 190 }}
                options={[
                  { label: 'SUBMITTED (Antrean)', value: 'SUBMITTED' },
                  { label: 'RETURNED (Revisi PM)', value: 'RETURNED' },
                  { label: 'PR_CREATED (Terbit PR)', value: 'PR_CREATED' },
                  { label: 'CANCELLED (Dibatalkan)', value: 'CANCELLED' },
                  { label: 'CLOSED (Selesai)', value: 'CLOSED' },
                  { label: 'Semua Status (ALL)', value: 'ALL' },
                ]}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                Menampilkan {packages.length} paket
              </Text>
            </Space>

            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => {
                refetchPackages();
                refetchSummary();
              }}
              loading={packagesLoading}
              className={styles.btnActionSecondary}
            >
              Segarkan Antrean
            </Button>
          </div>

          {/* Package Table */}
          <div className={styles.tableContainer}>
            <Table
              className={styles.procurementTable}
              columns={packageColumns}
              dataSource={packages}
              rowKey="id"
              loading={packagesLoading}
              pagination={{ pageSize: 8, showSizeChanger: false }}
              scroll={{ x: 1050 }}
              locale={{
                emptyText: (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={
                      <div style={{ textAlign: 'center', padding: '12px 0' }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: '#475569' }}>
                          Tidak ada paket pengadaan dengan filter ini
                        </div>
                        <Text type="secondary" style={{ fontSize: 11.5 }}>
                          Paket pengadaan dibuat oleh Project Manager pada proyek berstatus IN_PROGRESS.
                        </Text>
                      </div>
                    }
                  />
                ),
              }}
            />
          </div>
        </div>
      ),
    },
    ...(canReadReconciliation
      ? [
          {
            key: 'reconciliation',
            label: (
              <span>
                <SafetyCertificateOutlined style={{ marginRight: 6 }} />
                Rekonsiliasi
                {effectiveReconciliationCount !== null && (
                  <span className={`${styles.tabBadge} ${activeTabKey === 'reconciliation' ? styles.tabBadgeActive : styles.tabBadgeInactive}`}>
                    {effectiveReconciliationCount}
                  </span>
                )}
              </span>
            ),
            children: (
              <ReconciliationTab
                onReconciliationChanged={() => {
                  queryClient.invalidateQueries({ queryKey: ['procurement', 'packages'] });
                  queryClient.invalidateQueries({ queryKey: ['procurement', 'reconciliations'] });
                  queryClient.invalidateQueries({ queryKey: ['procurement', 'summary'] });
                  refetchReconciliations();
                  refetchSummary();
                }}
              />
            ),
          },
        ]
      : []),
    {
      key: 'pr',
      label: (
        <span>
          <FileDoneOutlined style={{ marginRight: 6 }} />
          Purchase Request
          {prSummaryCount > 0 && (
            <span className={`${styles.tabBadge} ${activeTabKey === 'pr' ? styles.tabBadgeActive : styles.tabBadgeInactive}`}>
              {prSummaryCount}
            </span>
          )}
        </span>
      ),
      children: (
        <div>
          <div className={styles.tabDescBar}>
            <div>
              <div style={{ fontWeight: 600, color: '#0F172A', fontSize: 13 }}>
                {prDomainTab === 'MATERIAL'
                  ? 'Daftar Purchase Request Material (Barang Fisik)'
                  : 'Daftar Purchase Request Jasa (Subcon & Layanan Operasional)'}
              </div>
              <div style={{ fontSize: 11.5, color: '#64748B' }}>
                Alur 2-Level: Procurement (Maker) → Finance (Reviewer) → Director (Final Approval)
              </div>
            </div>
            <div className={styles.subTabSegmentWrapper}>
              <div className={styles.subTabSegment}>
                <button
                  type="button"
                  className={`${styles.subTabBtn} ${prDomainTab === 'MATERIAL' ? styles.subTabBtnActive : ''}`}
                  onClick={() => setPrDomainTab('MATERIAL')}
                >
                  <span>Material</span>
                  <span className={styles.subTabCount}>{materialPrs.length}</span>
                </button>
                <button
                  type="button"
                  className={`${styles.subTabBtn} ${prDomainTab === 'SERVICE' ? styles.subTabBtnActive : ''}`}
                  onClick={() => setPrDomainTab('SERVICE')}
                >
                  <span>Jasa</span>
                  <span className={styles.subTabCount}>{servicePrs.length}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Desktop Structured Table View */}
          <div className={styles.desktopTableView}>
            <div className={styles.tableContainer}>
              <Table
                className={styles.procurementTable}
                columns={prDomainTab === 'MATERIAL' ? materialPrColumns : servicePrColumns}
                dataSource={prDomainTab === 'MATERIAL' ? materialPrs : servicePrs}
                rowKey="id"
                loading={prsLoading || rfqsLoading || posLoading}
                pagination={{ pageSize: 8, showSizeChanger: false }}
                scroll={{ x: prDomainTab === 'MATERIAL' ? 1040 : 1240 }}
                locale={{
                  emptyText: (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description={
                        <div style={{ textAlign: 'center', padding: '12px 0' }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: '#475569' }}>
                            {prDomainTab === 'MATERIAL'
                              ? 'Belum ada Purchase Request Material'
                              : 'Belum ada Purchase Request Jasa'}
                          </div>
                          <Text type="secondary" style={{ fontSize: 11.5 }}>
                            Buat PR dari Paket Pengadaan berstatus SUBMITTED di tab &ldquo;Paket Pengadaan&rdquo;.
                          </Text>
                        </div>
                      }
                    />
                  ),
                }}
              />
            </div>
          </div>

          {/* Mobile & Tablet Compact Card View */}
          <div className={styles.mobileCardView}>
            {(prDomainTab === 'MATERIAL' ? materialPrs : servicePrs).length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <div style={{ textAlign: 'center', padding: '12px 0' }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#475569' }}>
                      {prDomainTab === 'MATERIAL'
                        ? 'Belum ada Purchase Request Material'
                        : 'Belum ada Purchase Request Jasa'}
                    </div>
                  </div>
                }
              />
            ) : (
              (prDomainTab === 'MATERIAL' ? materialPrs : servicePrs).map((r) =>
                renderPrMobileCard(r, prDomainTab === 'SERVICE')
              )
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'po',
      label: (
        <span>
          <ShoppingCartOutlined style={{ marginRight: 6 }} />
          Purchase Order
          {poSummaryCount > 0 && (
            <span className={`${styles.tabBadge} ${activeTabKey === 'po' ? styles.tabBadgeActive : styles.tabBadgeInactive}`}>
              {poSummaryCount}
            </span>
          )}
        </span>
      ),
      children: (
        <div>
          <div className={styles.tabDescBar}>
            <div>
              Daftar Purchase Order (PO) resmi yang diterbitkan ke vendor rekanan terpilih.
            </div>
          </div>
          <div className={styles.tableContainer}>
            <Table
              className={styles.procurementTable}
              columns={poColumns}
              dataSource={pos}
              rowKey="id"
              loading={posLoading}
              pagination={{ pageSize: 8, showSizeChanger: false }}
              scroll={{ x: 1050 }}
              locale={{
                emptyText: (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={
                      <div style={{ textAlign: 'center', padding: '12px 0' }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: '#475569' }}>
                          Belum ada Purchase Order
                        </div>
                        <Text type="secondary" style={{ fontSize: 11.5 }}>
                          Terbitkan PO melalui alur evaluasi vendor RFQ pada PR yang telah disetujui Direktur.
                        </Text>
                      </div>
                    }
                  />
                ),
              }}
            />
          </div>
        </div>
      ),
    },
    {
      key: 'gr',
      label: (
        <span>
          <InboxOutlined style={{ marginRight: 6 }} />
          Goods Receipt
          {grBadgeCount > 0 && (
            <span className={`${styles.tabBadge} ${activeTabKey === 'gr' ? styles.tabBadgeActive : styles.tabBadgeInactive}`}>
              {grBadgeCount}
            </span>
          )}
        </span>
      ),
      children: (
        <div>
          <div className={styles.tabDescBar}>
            <div>
              Daftar Goods Receipt (GR) &amp; Riwayat Penerimaan Fisik Barang di Site/Gudang.
            </div>
            <div style={{ fontSize: 11.5, color: '#0F766E', fontWeight: 600 }}>
              Proteksi Validasi Anti Over-Receipt Aktif
            </div>
          </div>
          <div className={styles.tableContainer}>
            <Table
              className={styles.procurementTable}
              columns={grColumns}
              dataSource={allGoodsReceipts}
              rowKey="grId"
              loading={grsLoading}
              pagination={{ pageSize: 8, showSizeChanger: false }}
              scroll={{ x: 1050 }}
              locale={{
                emptyText: (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={
                      <div style={{ textAlign: 'center', padding: '12px 0' }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: '#475569' }}>
                          Belum ada Goods Receipt yang diterbitkan
                        </div>
                        <Text type="secondary" style={{ fontSize: 11.5 }}>
                          Klik tombol &ldquo;Terima Barang&rdquo; pada PO berstatus ISSUED untuk memproses penerimaan barang fisik.
                        </Text>
                      </div>
                    }
                  />
                ),
              }}
            />
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className={styles.pageContainer}>
      {/* Header Section */}
      <div className={styles.pageHeader}>
        <div>
          <Title level={3} className={styles.headerTitle}>
            Procurement
          </Title>
          <div className={styles.headerSubtitle}>
            Paket pengadaan, rekonsiliasi RAB, purchase request, purchase order, dan penerimaan barang (goods receipt).
          </div>
        </div>
      </div>

      {/* Summary Statistic Cards */}
      <Row gutter={[16, 16]} className={styles.metricsRow}>
        {/* Card 1: Antrean Paket */}
        <Col xs={24} sm={12} md={12} xl={6}>
          <div className={styles.summaryCard}>
            <div>
              <div className={styles.cardHeader}>
                <div className={styles.iconSurface} style={{ background: '#FEF3C7', color: '#D97706' }}>
                  <InboxOutlined />
                </div>
                <span className={styles.cardLabel} title="Antrean Paket (SUBMITTED)">
                  Antrean Paket
                </span>
              </div>
              <div className={styles.cardValueRow}>
                <span className={styles.cardValue} style={{ color: '#D97706' }}>
                  {summaryLoading && !dashboardSummary && packages.length === 0 ? (
                    <Spin size="small" />
                  ) : (
                    effectivePackageCount ?? 0
                  )}
                </span>
                <span className={styles.cardUnit}>Paket</span>
              </div>
            </div>
            <div className={styles.cardSubtext}>
              Status: SUBMITTED
            </div>
          </div>
        </Col>

        {/* Card 2: Perlu Rekonsiliasi */}
        <Col xs={24} sm={12} md={12} xl={6}>
          <div className={styles.summaryCard}>
            <div>
              <div className={styles.cardHeader}>
                <div
                  className={styles.iconSurface}
                  style={{
                    background: (effectiveReconciliationCount ?? 0) > 0 ? '#FEE2E2' : '#ECFDF5',
                    color: (effectiveReconciliationCount ?? 0) > 0 ? '#DC2626' : '#059669',
                  }}
                >
                  <SafetyCertificateOutlined />
                </div>
                <span className={styles.cardLabel} title="Perlu Rekonsiliasi">
                  Perlu Rekonsiliasi
                </span>
              </div>
              <div className={styles.cardValueRow}>
                <span
                  className={styles.cardValue}
                  style={{ color: (effectiveReconciliationCount ?? 0) > 0 ? '#DC2626' : '#059669' }}
                >
                  {summaryLoading && !dashboardSummary && unresolvedReconciliations.length === 0 ? (
                    <Spin size="small" />
                  ) : (
                    effectiveReconciliationCount ?? 0
                  )}
                </span>
                <span className={styles.cardUnit}>Item</span>
              </div>
            </div>
            <div className={styles.cardSubtext}>
              {effectiveReconciliationCount && effectiveReconciliationCount > 0
                ? 'Item pengadaan legacy/ad-hoc'
                : 'Safety Gate: Bersih'}
            </div>
          </div>
        </Col>

        {/* Card 3: Total Purchase Request */}
        <Col xs={24} sm={12} md={12} xl={6}>
          <div className={styles.summaryCard}>
            <div>
              <div className={styles.cardHeader}>
                <div className={styles.iconSurface} style={{ background: '#EFF6FF', color: '#2563EB' }}>
                  <FileDoneOutlined />
                </div>
                <span className={styles.cardLabel} title="Total Purchase Request">
                  Total Purchase Request
                </span>
              </div>
              <div className={styles.cardValueRow}>
                <span className={styles.cardValue} style={{ color: '#0F172A' }}>
                  {summaryLoading && !dashboardSummary && prs.length === 0 ? (
                    <Spin size="small" />
                  ) : (
                    prSummaryCount
                  )}
                </span>
                <span className={styles.cardUnit}>PR</span>
              </div>
            </div>
            <div className={styles.cardSubtext}>
              {prSummaryCount > 0
                ? 'Tercatat di sistem SSOT'
                : (activeTabKey === 'pr' ? 'Belum ada PR' : 'Dimuat saat tab PR aktif')}
            </div>
          </div>
        </Col>

        {/* Card 4: Total Purchase Order */}
        <Col xs={24} sm={12} md={12} xl={6}>
          <div className={styles.summaryCard}>
            <div>
              <div className={styles.cardHeader}>
                <div className={styles.iconSurface} style={{ background: '#E0E7FF', color: '#4F46E5' }}>
                  <ShoppingCartOutlined />
                </div>
                <span className={styles.cardLabel} title="Total Purchase Order">
                  Total Purchase Order
                </span>
              </div>
              <div className={styles.cardValueRow}>
                <span className={styles.cardValue} style={{ color: '#0F172A' }}>
                  {summaryLoading && !dashboardSummary && pos.length === 0 ? (
                    <Spin size="small" />
                  ) : (
                    poSummaryCount
                  )}
                </span>
                <span className={styles.cardUnit}>PO</span>
              </div>
            </div>
            <div className={styles.cardSubtext}>
              {poSummaryCount > 0
                ? 'PO terbit ke vendor'
                : (activeTabKey === 'po' ? 'Belum ada PO' : 'Dimuat saat tab PO aktif')}
            </div>
          </div>
        </Col>
      </Row>

      {/* Main Tabs Container */}
      <div className={styles.tabsCard}>
        <Tabs
          className={styles.procurementTabs}
          activeKey={activeTabKey}
          onChange={(k) => setActiveTabKey(k)}
          items={tabItems}
        />
      </div>

      {/* PACKAGE DETAIL DRAWER */}
      <ProcurementPackageDetailDrawer
        open={isPackageDrawerOpen}
        onClose={() => {
          setIsPackageDrawerOpen(false);
          setSelectedPackageId(null);
        }}
        packageId={selectedPackageId}
        onReturnClick={(pkg) => handleOpenReturnModal(pkg)}
        onCreatePrClick={(pkg) => handleCreatePr(pkg)}
        onViewLinkedPrClick={(pr) => handleViewLinkedPr(pr)}
      />

      {/* RETURN PACKAGE MODAL */}
      <Modal
        title={
          <Space>
            <RollbackOutlined style={{ color: '#dc2626' }} />
            <span>Kembalikan Paket Pengadaan ke PM</span>
          </Space>
        }
        open={returnModalOpen}
        onCancel={() => {
          if (!returnSubmitting) {
            setReturnModalOpen(false);
            setPackageToReturn(null);
            setReturnReason('');
          }
        }}
        onOk={handleConfirmReturn}
        okText="Konfirmasi Kembalikan"
        cancelText="Batal"
        confirmLoading={returnSubmitting}
        okButtonProps={{ danger: true }}
        destroyOnClose
      >
        {packageToReturn && (
          <div style={{ marginTop: 8 }}>
            <Paragraph style={{ fontSize: 13, color: '#334155' }}>
              Anda akan mengembalikan paket <strong>{packageToReturn.packageNumber}</strong> ({packageToReturn.title}) kepada Project Manager untuk perbaikan/revisi.
            </Paragraph>
            <div style={{ marginBottom: 12 }}>
              <Text strong style={{ fontSize: 12.5 }}>
                Alasan Pengembalian / Catatan Revisi <span style={{ color: '#dc2626' }}>*</span>:
              </Text>
              <TextArea
                rows={4}
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder="Contoh: Estimasi harga satuan untuk kabel NYY terlalu tinggi dibanding harga pasar, mohon verifikasi ulang kuantitas pipa."
                style={{ marginTop: 6 }}
                maxLength={500}
                showCount
              />
            </div>
          </div>
        )}
      </Modal>

      {/* PR APPROVAL WORKFLOW MODAL */}
      <Modal
        open={isPrApprovalModalOpen}
        onCancel={() => {
          setIsPrApprovalModalOpen(false);
          setSelectedPrForApproval(null);
        }}
        footer={null}
        width="min(1180px, calc(100vw - 64px))"
        centered
        destroyOnClose
        title={null}
        closable={false}
        styles={{
          content: {
            padding: 0,
            maxHeight: 'calc(100vh - 80px)',
            overflow: 'hidden',
          },
          body: {
            padding: 0,
            overflow: 'hidden',
          },
        }}
      >
        {selectedPrForApproval && (
          <div style={{ padding: 0, height: '100%' }}>
            <PrApprovalWorkflow
              prId={selectedPrForApproval.id}
              prNumber={selectedPrForApproval.prNumber || undefined}
              projectId={selectedPrForApproval.projectId || selectedPrForApproval.id}
              projectName={
                ((selectedPrForApproval as any).project?.name ||
                  selectedPrForApproval.projectName ||
                  selectedPrForApproval.project_name ||
                  '').trim() || undefined
              }
              totalAmount={
                selectedPrForApproval.totalEstimatedAmount != null
                  ? Number(selectedPrForApproval.totalEstimatedAmount)
                  : undefined
              }
              customerName={selectedPrForApproval.customerName || selectedPrForApproval.customer_name || undefined}
              budgetAllocation={
                selectedPrForApproval.budgetAllocation != null
                  ? Number(selectedPrForApproval.budgetAllocation)
                  : selectedPrForApproval.wbsAllocation != null
                  ? Number(selectedPrForApproval.wbsAllocation)
                  : undefined
              }
              wbsTaskName={selectedPrForApproval.wbsTaskName || selectedPrForApproval.wbsName || undefined}
              opPlanRef={selectedPrForApproval.opPlanRef || selectedPrForApproval.gate || undefined}
              items={selectedPrForApproval.items || []}
              initialStatus={(selectedPrForApproval.status as PrApprovalStatus) || 'SUBMITTED'}
              isProcurement={isProcurement}
              isFinance={isFinance}
              isDirector={isDirector}
              isSuperAdmin={isSuperAdmin}
              currentUserName={user?.fullName || user?.email || undefined}
              onClose={() => {
                setIsPrApprovalModalOpen(false);
                setSelectedPrForApproval(null);
              }}
              onStatusChange={() => {
                setPrVersion((v) => v + 1);
                queryClient.invalidateQueries({ queryKey: ['procurement', 'prs'] });
                queryClient.invalidateQueries({ queryKey: ['procurement', 'prs-pos'] });
                refetchPrs();
              }}
              onCreateRfqClick={() => {
                setIsPrApprovalModalOpen(false);
                setSelectedPrForRfq(selectedPrForApproval);
                setIsCreateRfqModalOpen(true);
              }}
              activeRfq={
                selectedPrForApproval
                  ? activeRfqMapByPrId[String(selectedPrForApproval.id)] ||
                    activeRfqMapByPrId[String(selectedPrForApproval.prNumber)] ||
                    null
                  : null
              }
              latestRfq={
                selectedPrForApproval
                  ? latestRfqMapByPrId[String(selectedPrForApproval.id)] ||
                    latestRfqMapByPrId[String(selectedPrForApproval.prNumber)] ||
                    null
                  : null
              }
            />
          </div>
        )}
      </Modal>

      {/* CREATE & VIEW RFQ MODAL */}
      {selectedPrForRfq && (
        <CreateRfqModal
          open={isCreateRfqModalOpen}
          onClose={() => {
            setIsCreateRfqModalOpen(false);
            setSelectedPrForRfq(null);
          }}
          pr={selectedPrForRfq}
          existingRfq={
            selectedPrForRfq
              ? activeRfqMapByPrId[String(selectedPrForRfq.id)] ||
                activeRfqMapByPrId[String(selectedPrForRfq.prNumber)] ||
                latestRfqMapByPrId[String(selectedPrForRfq.id)] ||
                latestRfqMapByPrId[String(selectedPrForRfq.prNumber)] ||
                null
              : null
          }
          existingPo={existingPoForSelectedPr}
          onRfqCreated={() => {
            setRfqVersion((v) => v + 1);
            setPrVersion((v) => v + 1);
            setPoVersion((v) => v + 1);
            queryClient.invalidateQueries({ queryKey: ['procurement', 'rfqs'] });
            queryClient.invalidateQueries({ queryKey: ['procurement', 'prs'] });
            queryClient.invalidateQueries({ queryKey: ['procurement', 'prs-pos'] });
            refetchRfqs();
            refetchPrs();
          }}
          onRfqCancelled={() => {
            setRfqVersion((v) => v + 1);
            setPrVersion((v) => v + 1);
            queryClient.invalidateQueries({ queryKey: ['procurement', 'rfqs'] });
            queryClient.invalidateQueries({ queryKey: ['procurement', 'prs'] });
            queryClient.invalidateQueries({ queryKey: ['procurement', 'prs-pos'] });
            queryClient.invalidateQueries({ queryKey: ['procurement', 'packages'] });
            refetchRfqs();
            refetchPrs();
          }}
          onPoCreated={() => {
            setPoVersion((v) => v + 1);
            queryClient.invalidateQueries({ queryKey: ['procurement', 'purchase-orders'] });
            queryClient.invalidateQueries({ queryKey: ['procurement', 'rfqs'] });
            queryClient.invalidateQueries({ queryKey: ['procurement', 'prs-pos'] });
            refetchPos();
            refetchRfqs();
          }}
          currentUserName={user?.fullName || user?.email || 'Procurement Team'}
        />
      )}

      {/* PURCHASE ORDER VIEW MODAL */}
      {selectedPoForView && (
        <PurchaseOrderModal
          open={isPoModalOpen}
          onClose={() => {
            setIsPoModalOpen(false);
            setSelectedPoForView(null);
          }}
          comparison={null}
          rfq={null}
          existingPo={selectedPoForView}
          viewOnly={true}
          canReceiveGoods={canReceiveGoods}
          currentUserName={user?.fullName || user?.email || 'Procurement Team'}
          onOpenGoodsReceipt={(targetPoRecord) => {
            setIsPoModalOpen(false);
            setSelectedPoForView(null);
            setSelectedPoForGr(targetPoRecord);
            setSelectedGrForView(null);
            setIsGrModalOpen(true);
          }}
          onOpenServiceOrder={(targetPoRecord) => {
            setIsPoModalOpen(false);
            setSelectedPoForView(null);
            setSelectedPoForServiceOrder(targetPoRecord);
            setIsServiceOrderModalOpen(true);
          }}
        />
      )}

      {/* SERVICE PO CREATION MODAL (DIRECT SERVICE SOURCING) */}
      {selectedPrForServicePo && (
        <PurchaseOrderModal
          open={isServicePoModalOpen}
          onClose={() => {
            setIsServicePoModalOpen(false);
            setSelectedPrForServicePo(null);
          }}
          targetPr={selectedPrForServicePo}
          comparison={null}
          rfq={null}
          existingPo={null}
          viewOnly={false}
          canReceiveGoods={false}
          currentUserName={user?.fullName || user?.email || 'Procurement Team'}
          onPoCreated={() => {
            setIsServicePoModalOpen(false);
            setSelectedPrForServicePo(null);
            setPoVersion((v) => v + 1);
            setPrVersion((v) => v + 1);
            queryClient.invalidateQueries({ queryKey: ['procurement', 'purchase-orders'] });
            queryClient.invalidateQueries({ queryKey: ['procurement', 'prs-pos'] });
            queryClient.invalidateQueries({ queryKey: ['procurement', 'prs'] });
            refetchPos();
            refetchPrs();
          }}
        />
      )}

      {/* GOODS RECEIPT MODAL (CREATE & VIEW) */}
      {(selectedPoForGr || selectedGrForView) && (
        <GoodsReceiptModal
          open={isGrModalOpen}
          onClose={() => {
            setIsGrModalOpen(false);
            setSelectedPoForGr(null);
            setSelectedGrForView(null);
          }}
          po={selectedPoForGr}
          existingGr={selectedGrForView}
          viewOnly={Boolean(selectedGrForView)}
          canReceiveGoods={canReceiveGoods}
          currentUserName={user?.fullName || user?.email || 'Petugas Logistik'}
          onGrCreated={() => {
            setGrVersion((v) => v + 1);
            setPoVersion((v) => v + 1);
            queryClient.invalidateQueries({ queryKey: ['procurement', 'goods-receipts'] });
            queryClient.invalidateQueries({ queryKey: ['procurement', 'purchase-orders'] });
            queryClient.invalidateQueries({ queryKey: ['procurement', 'prs-pos'] });
            refetchGrs();
            refetchPos();
          }}
        />
      )}

      {/* SERVICE ORDER MODAL (SPK / WORK ORDER) */}
      {selectedPoForServiceOrder && (
        <ServiceOrderModal
          open={isServiceOrderModalOpen}
          onClose={() => {
            setIsServiceOrderModalOpen(false);
            setSelectedPoForServiceOrder(null);
          }}
          po={selectedPoForServiceOrder}
          onOrderUpdated={() => {
            refetchPos();
          }}
          canManage={isProcurement || isPurchasing || isSuperAdmin}
        />
      )}

      {/* SERVICE CLAIM MODAL (KLAIM JASA) */}
      {selectedPoForServiceClaim && (
        <ServiceClaimModal
          open={isServiceClaimModalOpen}
          onClose={() => {
            setIsServiceClaimModalOpen(false);
            setSelectedPoForServiceClaim(null);
          }}
          po={selectedPoForServiceClaim}
          onClaimUpdated={() => {
            refetchPos();
          }}
          userRole={user?.roles?.[0]}
          userId={user?.sub ? Number(user.sub) : undefined}
        />
      )}
    </div>
  );
};
