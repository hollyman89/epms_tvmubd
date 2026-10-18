/**
 * EPMS — PROJECT-DELIVERY-KICKOFF-UI-R1
 * Authoritative Kickoff Queue Presentation & Identity Utilities
 *
 * Enforces:
 * 1. Exact PM identity resolution: actual person name, never role string 'Project Manager'.
 * 2. Unassigned fallback: 'Belum Ditugaskan'.
 * 3. Marketing PIC identity resolution.
 * 4. Strict separation of Operational Plan vs Handover statuses (no duplicate 'APPROVED (SIAP KICKOFF)').
 * 5. Deterministic Next Action state resolution based on lifecycle stage and role authorization.
 */

export interface ProjectCharterLike {
  id?: number | string | null;
  contractId?: number | string | null;
  projectId?: number | string | null;
  project_code?: string | null;
  project_name?: string | null;
  customerName?: string | null;
  contract_total_value?: number | string | null;
  project_budget?: number | string | null;
  marketingName?: string | null;
  pmName?: string | null;
  managerId?: number | string | null;
  projectManagerId?: number | string | null;
  project_manager_id?: number | string | null;
  manager?: {
    id?: number | string | null;
    fullName?: string | null;
    full_name?: string | null;
    email?: string | null;
  } | null;
  proposal?: {
    tender?: {
      title?: string | null;
      marketing_pic?: { fullName?: string | null } | null;
      estimated_budget?: number | string | null;
    } | null;
  } | null;
  operationalPlanStatus?: string | null;
  handoverStatus?: string | null;
  status?: string | null;
  projectStatus?: string | null;
  readiness?: any;
  [key: string]: any;
}

export interface ResolvedPmIdentity {
  id: number | null;
  name: string;
  isAssigned: boolean;
  initials: string;
}

export interface ResolvedMarketingIdentity {
  name: string;
  initials: string;
  isAssigned: boolean;
}

/**
 * 1. Resolve PM Identity
 * NEVER returns 'Project Manager' as person's display name.
 */
export function resolvePmIdentity(record: ProjectCharterLike): ResolvedPmIdentity {
  const pmIdRaw =
    record.managerId ??
    record.projectManagerId ??
    record.project_manager_id ??
    record.manager?.id ??
    null;
  const pmId = pmIdRaw !== null && pmIdRaw !== undefined && !isNaN(Number(pmIdRaw)) && Number(pmIdRaw) > 0
    ? Number(pmIdRaw)
    : null;

  const rawName =
    record.manager?.fullName?.trim() ||
    record.manager?.full_name?.trim() ||
    record.pmName?.trim() ||
    '';
  const email = record.manager?.email?.trim() || '';

  // Case: No PM assigned
  if (!pmId && (!rawName || rawName === 'Belum Ditugaskan')) {
    return {
      id: null,
      name: 'Belum Ditugaskan',
      isAssigned: false,
      initials: '',
    };
  }

  let cleanName = rawName;

  if (!cleanName) {
    if (email) {
      cleanName = email;
    } else if (pmId) {
      cleanName = `User #${pmId}`;
    } else {
      return {
        id: null,
        name: 'Belum Ditugaskan',
        isAssigned: false,
        initials: '',
      };
    }
  }

  cleanName = cleanName.trim();

  // Compute initials (up to 2 letters)
  const parts = cleanName.split(/\s+/).filter(Boolean);
  let initials = 'PM';
  if (parts.length >= 2) {
    initials = (parts[0][0] + parts[1][0]).toUpperCase();
  } else if (parts.length === 1 && parts[0].length >= 2) {
    initials = parts[0].slice(0, 2).toUpperCase();
  } else if (parts.length === 1) {
    initials = parts[0][0].toUpperCase();
  }

  return {
    id: pmId,
    name: cleanName,
    isAssigned: true,
    initials,
  };
}

/**
 * 2. Resolve Marketing Identity
 */
export function resolveMarketingIdentity(record: ProjectCharterLike): ResolvedMarketingIdentity {
  const rawName =
    record.marketingName?.trim() ||
    record.proposal?.tender?.marketing_pic?.fullName?.trim() ||
    '';

  if (!rawName || rawName === '-' || rawName.toLowerCase() === 'null') {
    return {
      name: '-',
      initials: '-',
      isAssigned: false,
    };
  }

  const cleanName = rawName.trim();
  const parts = cleanName.split(/\s+/).filter(Boolean);
  let initials = 'MK';
  if (parts.length >= 2) {
    initials = (parts[0][0] + parts[1][0]).toUpperCase();
  } else if (parts.length === 1 && parts[0].length >= 2) {
    initials = parts[0].slice(0, 2).toUpperCase();
  }

  return {
    name: cleanName,
    initials,
    isAssigned: true,
  };
}

export type ChipTone = 'green' | 'purple' | 'blue' | 'amber' | 'slate' | 'red';

export interface StatusTagDescriptor {
  text: string;
  tone: ChipTone;
  hasCheck?: boolean;
  hasDot?: boolean;
  tooltip?: string;
}

/**
 * 3. Status Separation: Operational Plan vs Handover
 * NEVER renders combined 'APPROVED (SIAP KICKOFF)' or 'MENUNGGU KICKOFF PM'.
 */
export function getKickoffQueueStatusTags(
  record: ProjectCharterLike,
  readinessMap: Record<number, any> = {}
): {
  isReadyForKickoff: boolean;
  opTag: StatusTagDescriptor;
  hoTag: StatusTagDescriptor;
} {
  const pid = record.projectId ? Number(record.projectId) : 0;
  const entry = pid > 0 ? readinessMap[pid] : null;
  const readiness = entry?.status === 'SUCCESS' ? entry.data : (record.readiness || null);
  const gate = readiness?.gate;
  const gateStatus = gate?.status;
  const currentStage = gate?.currentStage || readiness?.workflow?.currentStage;
  const currentNodeId = gate?.currentNodeId || readiness?.workflow?.currentNodeId;
  const count = readiness?.completenessCount ?? 0;
  const opStatus = record.operationalPlanStatus;
  const hoStatus = record.handoverStatus;
  const pm = resolvePmIdentity(record);

  const isReadyForKickoff =
    currentStage === 'READY_FOR_KICKOFF' ||
    gateStatus === 'READY_FOR_KICKOFF' ||
    currentNodeId === 'node_end' ||
    opStatus === 'READY_FOR_KICKOFF' ||
    opStatus === 'APPROVED_READY_FOR_KICKOFF' ||
    hoStatus === 'READY_FOR_KICKOFF' ||
    hoStatus === 'MENUNGGU_KICKOFF_PM';

  // --- A. OPERATIONAL PLAN TAG ---
  let opTag: StatusTagDescriptor;

  if (!pm.isAssigned) {
    opTag = {
      text: 'BELUM DITUGASKAN',
      tone: 'slate',
      hasDot: false,
      tooltip: 'Project Manager belum ditugaskan oleh PMO.',
    };
  } else if (isReadyForKickoff) {
    // Canonical requirement: MUST NOT render APPROVED (SIAP KICKOFF)
    opTag = {
      text: 'APPROVED',
      tone: 'green',
      hasCheck: true,
      tooltip: 'Operational Plan telah disetujui penuh oleh Director.',
    };
  } else if (
    currentStage === 'NEEDS_REVISION' ||
    gateStatus === 'NEEDS_REVISION' ||
    currentNodeId?.startsWith('node_pm_revision') ||
    opStatus === 'NEEDS_REVISION'
  ) {
    opTag = {
      text: 'NEEDS REVISION',
      tone: 'red',
      hasDot: true,
      tooltip: 'Manajemen meminta revisi terhadap Operational Plan.',
    };
  } else if (currentStage === 'REVIEW_HOPS' || currentNodeId === 'node_hops_review' || opStatus === 'REVIEW_HOPS') {
    opTag = {
      text: 'REVIEW HEAD OF OPS',
      tone: 'blue',
      hasDot: true,
      tooltip: 'Operational Plan sedang ditinjau oleh Head of Operations.',
    };
  } else if (currentStage === 'REVIEW_PROCUREMENT' || currentNodeId === 'node_procurement_review' || opStatus === 'REVIEW_PROCUREMENT') {
    opTag = {
      text: 'REVIEW PROCUREMENT',
      tone: 'blue',
      hasDot: true,
      tooltip: 'Operational Plan sedang ditinjau oleh Procurement.',
    };
  } else if (currentStage === 'REVIEW_FINANCE' || currentNodeId === 'node_finance_review' || opStatus === 'REVIEW_FINANCE') {
    opTag = {
      text: 'REVIEW FINANCE',
      tone: 'blue',
      hasDot: true,
      tooltip: 'Operational Plan sedang ditinjau oleh Finance.',
    };
  } else if (currentStage === 'REVIEW_DIRECTOR' || currentNodeId === 'node_director_approval' || opStatus === 'REVIEW_DIRECTOR') {
    opTag = {
      text: 'REVIEW DIRECTOR',
      tone: 'purple',
      hasDot: true,
      tooltip: 'Operational Plan sedang menunggu persetujuan final Director.',
    };
  } else if (gateStatus === 'REVIEW_PENDING' || opStatus === 'REVIEW_PENDING') {
    opTag = {
      text: 'REVIEW PENDING',
      tone: 'blue',
      hasDot: true,
      tooltip: 'Operational Plan sedang dalam peninjauan manajemen.',
    };
  } else if (count === 4 || currentStage === 'READY_TO_SUBMIT' || opStatus === 'COMPLETE_READINESS') {
    opTag = {
      text: 'COMPLETE READINESS',
      tone: 'green',
      hasDot: true,
      tooltip: '4/4 Pilar Operational Plan telah lengkap disusun dan siap diajukan.',
    };
  } else if (count > 0 || currentStage === 'INCOMPLETE' || opStatus === 'INCOMPLETE') {
    opTag = {
      text: `${count}/4 INCOMPLETE`,
      tone: 'amber',
      hasDot: false,
      tooltip: `${count}/4 Pilar terisi. Masih ada pilar operasional yang belum lengkap.`,
    };
  } else {
    opTag = {
      text: 'BELUM DIINISIASI',
      tone: 'slate',
      hasDot: false,
      tooltip: 'Operational Plan belum disusun oleh PM.',
    };
  }

  // --- B. HANDOVER TAG ---
  let hoTag: StatusTagDescriptor;

  if (!pm.isAssigned || hoStatus === 'ANTREAN_KICKOFF') {
    hoTag = {
      text: 'ANTREAN KICKOFF',
      tone: 'amber',
      hasDot: true,
      tooltip: 'Menunggu penugasan Project Manager oleh PMO.',
    };
  } else if (isReadyForKickoff) {
    // Canonical requirement: Handover reflects SIAP KICKOFF (NOT MENUNGGU KICKOFF PM)
    hoTag = {
      text: 'SIAP KICKOFF',
      tone: 'purple',
      hasDot: true,
      tooltip: 'Seluruh tahap persetujuan governance selesai. Siap Kick Off oleh PM.',
    };
  } else if (currentStage === 'NEEDS_REVISION' || gateStatus === 'NEEDS_REVISION' || hoStatus === 'PERLU_REVISI_PM') {
    hoTag = {
      text: 'PERLU REVISI PM',
      tone: 'red',
      hasDot: true,
      tooltip: 'Membutuhkan revisi perencanaan oleh Project Manager.',
    };
  } else if (
    currentStage === 'REVIEW_HOPS' ||
    currentStage === 'REVIEW_PROCUREMENT' ||
    currentStage === 'REVIEW_FINANCE' ||
    currentStage === 'REVIEW_DIRECTOR'
  ) {
    const stageLabel = currentStage.replace('_', ' ');
    hoTag = {
      text: stageLabel,
      tone: currentStage === 'REVIEW_DIRECTOR' ? 'purple' : 'blue',
      hasDot: true,
      tooltip: `Tahap peninjauan tata kelola: ${stageLabel}`,
    };
  } else {
    hoTag = {
      text: 'PENYUSUNAN PLAN',
      tone: 'amber',
      hasDot: true,
      tooltip: 'PM sedang menyusun perencanaan operasional proyek.',
    };
  }

  return {
    isReadyForKickoff,
    opTag,
    hoTag,
  };
}

export type NextActionMode =
  | 'KICKOFF_BUTTON'
  | 'WAITING_PM_KICKOFF'
  | 'ASSIGN_PM_BUTTON'
  | 'WAITING_PMO_ASSIGN'
  | 'OPERATIONAL_PLAN_BUTTON'
  | 'REVISION_PLAN_BUTTON'
  | 'WAITING_PM_REVISION'
  | 'WAITING_GOVERNANCE'
  | 'PLANNING_IN_PROGRESS';

export interface NextActionDescriptor {
  mode: NextActionMode;
  buttonLabel?: string;
  buttonType?: 'primary' | 'default';
  waitingText?: string;
  subText?: string;
  actorName?: string;
}

/**
 * 4. Next Action Resolver
 * Gated strictly by user identity and role matrix.
 */
export function resolveNextAction(
  record: ProjectCharterLike,
  readinessMap: Record<number, any> = {},
  currentUserId: number | string | null | undefined,
  userRoles: string[] = []
): NextActionDescriptor {
  const pm = resolvePmIdentity(record);
  const { isReadyForKickoff } = getKickoffQueueStatusTags(record, readinessMap);

  const rolesUpper = userRoles.map((r) => String(r).toUpperCase());
  const isPmo = rolesUpper.includes('PMO');
  const isSuperAdmin = rolesUpper.includes('SUPER_ADMIN');
  const isDirector =
    rolesUpper.includes('DIRECTOR') ||
    rolesUpper.includes('GENERAL_MANAGER') ||
    rolesUpper.includes('HEAD_OF_OPERATIONS');

  const isAssignedPm = Boolean(
    currentUserId &&
    pm.id &&
    Number(pm.id) === Number(currentUserId)
  );

  // CASE 1: READY FOR KICKOFF
  if (isReadyForKickoff) {
    if (isAssignedPm) {
      // ONLY the exact assigned PM sees and can trigger Kick Off Proyek
      return {
        mode: 'KICKOFF_BUTTON',
        buttonLabel: 'Kick Off Proyek',
        buttonType: 'primary',
      };
    }

    // ALL OTHER ROLES (Admin, SuperAdmin, PMO, Director, HOO, Procurement, Finance, Other PM):
    // Must NOT see Kick Off Proyek button; see waiting text
    const pmDisplayName = pm.name !== 'Belum Ditugaskan' ? pm.name : 'PM';
    return {
      mode: 'WAITING_PM_KICKOFF',
      waitingText: `Menunggu ${pmDisplayName} melakukan kickoff`,
    };
  }

  // CASE 2: UNASSIGNED PM
  if (!pm.isAssigned) {
    if (isPmo) {
      return {
        mode: 'ASSIGN_PM_BUTTON',
        buttonLabel: 'Tugaskan PM',
        buttonType: 'primary',
      };
    }
    return {
      mode: 'WAITING_PMO_ASSIGN',
      waitingText: 'Menunggu penugasan PMO',
    };
  }

  const pid = record.projectId ? Number(record.projectId) : 0;
  const entry = pid > 0 ? readinessMap[pid] : null;
  const readiness = entry?.status === 'SUCCESS' ? entry.data : (record.readiness || null);
  const gate = readiness?.gate;
  const gateStatus = gate?.status;
  const currentStage = gate?.currentStage || readiness?.workflow?.currentStage;
  const opStatus = record.operationalPlanStatus;

  // CASE 3: NEEDS REVISION
  if (
    currentStage === 'NEEDS_REVISION' ||
    gateStatus === 'NEEDS_REVISION' ||
    opStatus === 'NEEDS_REVISION'
  ) {
    if (isAssignedPm) {
      return {
        mode: 'REVISION_PLAN_BUTTON',
        buttonLabel: 'Revisi Plan',
      };
    }
    return {
      mode: 'WAITING_PM_REVISION',
      waitingText: 'Menunggu revisi oleh PM',
    };
  }

  // CASE 4: UNDER GOVERNANCE REVIEW
  if (
    currentStage === 'REVIEW_HOPS' ||
    currentStage === 'REVIEW_PROCUREMENT' ||
    currentStage === 'REVIEW_FINANCE' ||
    currentStage === 'REVIEW_DIRECTOR' ||
    gateStatus === 'REVIEW_PENDING' ||
    opStatus === 'REVIEW_PENDING' ||
    opStatus === 'REVIEW_HOPS' ||
    opStatus === 'REVIEW_PROCUREMENT' ||
    opStatus === 'REVIEW_FINANCE' ||
    opStatus === 'REVIEW_DIRECTOR'
  ) {
    let actorName = 'Manajemen';
    if (currentStage === 'REVIEW_HOPS' || opStatus === 'REVIEW_HOPS') actorName = 'Head of Operations';
    else if (currentStage === 'REVIEW_PROCUREMENT' || opStatus === 'REVIEW_PROCUREMENT') actorName = 'Procurement';
    else if (currentStage === 'REVIEW_FINANCE' || opStatus === 'REVIEW_FINANCE') actorName = 'Finance';
    else if (currentStage === 'REVIEW_DIRECTOR' || opStatus === 'REVIEW_DIRECTOR') actorName = 'Director';

    return {
      mode: 'WAITING_GOVERNANCE',
      waitingText: 'Menunggu persetujuan',
      actorName,
    };
  }

  // CASE 5: PLANNING / DRAFTING (Operational Plan)
  const canOpenPlan = isAssignedPm || isPmo || isSuperAdmin || isDirector;
  if (canOpenPlan) {
    return {
      mode: 'OPERATIONAL_PLAN_BUTTON',
      buttonLabel: 'Operational Plan',
    };
  }

  return {
    mode: 'PLANNING_IN_PROGRESS',
    waitingText: 'Penyusunan Plan',
  };
}
