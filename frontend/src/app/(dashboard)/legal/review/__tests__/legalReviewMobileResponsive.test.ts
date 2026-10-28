import fs from 'fs';
import path from 'path';

describe('Legal Review Workstation Mobile Responsive Contracts (MOB-LEGAL-001)', () => {
  const pageTsxPath = path.resolve(__dirname, '../page.tsx');
  const cssModulePath = path.resolve(__dirname, '../LegalReview.module.css');
  const workstationHeaderPath = path.resolve(__dirname, '../../../../../components/legal/LegalWorkstationHeader.tsx');
  const taskQueuePath = path.resolve(__dirname, '../../../../../components/legal/LegalTaskQueue.tsx');
  const groupedChecklistPath = path.resolve(__dirname, '../../../../../components/legal/GroupedLegalChecklist.tsx');

  let pageTsx: string;
  let cssModule: string;
  let workstationHeader: string;
  let taskQueue: string;
  let groupedChecklist: string;

  beforeAll(() => {
    pageTsx = fs.readFileSync(pageTsxPath, 'utf8');
    cssModule = fs.readFileSync(cssModulePath, 'utf8');
    workstationHeader = fs.readFileSync(workstationHeaderPath, 'utf8');
    taskQueue = fs.readFileSync(taskQueuePath, 'utf8');
    groupedChecklist = fs.readFileSync(groupedChecklistPath, 'utf8');
  });

  // 1. Desktop keeps 3-column layout
  test('1. Desktop keeps canonical 3-column workstation layout (Task List | Document Viewer | Checklist & Decision)', () => {
    expect(cssModule).toMatch(/\.workspaceRow\s*\{[^}]*display:\s*flex/);
    expect(cssModule).toMatch(/\.queueColumn\s*\{[^}]*width:\s*310px/);
    expect(cssModule).toMatch(/\.documentColumn\s*\{[^}]*flex:\s*1/);
    expect(cssModule).toMatch(/\.checklistColumn\s*\{[^}]*width:\s*370px/);
  });

  // 2. Mobile shows single active panel
  test('2. Mobile shows single active panel: mobileSegmentedWrapper and mobileActiveColumn / mobileHiddenColumn isolation', () => {
    expect(pageTsx).toContain('isMobile');
    expect(pageTsx).toContain('mobileActivePanel');
    expect(pageTsx).toContain('styles.mobileSegmentedWrapper');

    expect(cssModule).toMatch(/@media\s*\(max-width:\s*767px\)\s*\{[\s\S]*?\.mobileHiddenColumn\s*\{[\s\S]*?display:\s*none\s*!important/);
    expect(cssModule).toMatch(/@media\s*\(max-width:\s*767px\)\s*\{[\s\S]*?\.mobileActiveColumn\s*\{[\s\S]*?display:\s*flex\s*!important/);
  });

  // 3. Daftar Tugas mobile tab reachable
  test('3. Daftar Tugas mobile tab reachable: option defined in Segmented control with FileTextOutlined', () => {
    expect(pageTsx).toMatch(/label:\s*['"]Daftar Tugas['"]/);
    expect(pageTsx).toMatch(/value:\s*['"]queue['"]/);
    expect(pageTsx).toContain('styles.queueColumn');
  });

  // 4. Dokumen mobile tab reachable
  test('4. Dokumen mobile tab reachable: option defined in Segmented control with FilePdfOutlined', () => {
    expect(pageTsx).toMatch(/label:\s*['"]Dokumen['"]/);
    expect(pageTsx).toMatch(/value:\s*['"]document['"]/);
    expect(pageTsx).toContain('styles.documentColumn');
  });

  // 5. Checklist & Keputusan mobile tab reachable
  test('5. Checklist & Keputusan mobile tab reachable: option defined in Segmented control with AuditOutlined', () => {
    expect(pageTsx).toMatch(/label:\s*['"]Checklist & Keputusan['"]/);
    expect(pageTsx).toMatch(/value:\s*['"]checklist['"]/);
    expect(pageTsx).toContain('styles.checklistColumn');
  });

  // 6. Selected task preserved when switching tabs
  test('6. Selected task state is preserved when switching tabs: persistent React state outside tab conditional rendering', () => {
    // Both aside (queue, checklist) and main (document) remain rendered in the DOM with CSS-based visibility
    expect(pageTsx).toContain('mobileActivePanel === \'queue\'');
    expect(pageTsx).toContain('mobileActivePanel === \'document\'');
    expect(pageTsx).toContain('mobileActivePanel === \'checklist\'');

    // State is maintained in page root
    expect(pageTsx).toContain('const [selectedContractId, setSelectedContractId] = useState');
    expect(pageTsx).toContain('const [pendingContracts, setPendingContracts] = useState');
  });

  // 7. Checklist / form state preserved
  test('7. Checklist and form state preserved: checklist useState remains mounted during mobile navigation', () => {
    expect(pageTsx).toContain('const [checklist, setChecklist] = useState<ChecklistState>');
    expect(pageTsx).toContain('const [autosaveStatus, setAutosaveStatus] = useState');
    expect(pageTsx).toContain('const [revisionNotes, setRevisionNotes] = useState');
  });

  // 8. Decision buttons remain present
  test('8. Decision buttons remain present: Simpan, Revisi, and Setujui & Rilis in LegalWorkstationHeader', () => {
    expect(workstationHeader).toContain('onSaveDraft');
    expect(workstationHeader).toContain('onRequestRevision');
    expect(workstationHeader).toContain('onApprove');
    expect(workstationHeader).toContain('Setujui & Rilis');
    expect(workstationHeader).toContain('Simpan');
    expect(workstationHeader).toContain('Revisi');
  });

  // 9. No action removed: full action menu items preserved
  test('9. No action removed: moreMenuItems preserves approve with notes, forward, escalate, and reject', () => {
    expect(workstationHeader).toContain('approve_notes');
    expect(workstationHeader).toContain('forward');
    expect(workstationHeader).toContain('escalate');
    expect(workstationHeader).toContain('reject');
    expect(workstationHeader).toContain('cancel');
  });

  // 10. Mobile layout does not force 3 columns
  test('10. Mobile layout does not force 3 columns: columnsContainer transitions to flex-direction column with width 100%', () => {
    expect(cssModule).toMatch(/@media\s*\(max-width:\s*767px\)\s*\{[\s\S]*?\.workspaceRow\s*\{[\s\S]*?flex-direction:\s*column/);
    expect(cssModule).toMatch(/@media\s*\(max-width:\s*767px\)\s*\{[\s\S]*?\.workspaceRow\s*\{[\s\S]*?overflow-x:\s*hidden/);
    expect(cssModule).toMatch(/@media\s*\(max-width:\s*767px\)\s*\{[\s\S]*?\.queueColumn[\s\S]*?width:\s*100%\s*!important/);
    expect(cssModule).toMatch(/@media\s*\(max-width:\s*767px\)\s*\{[\s\S]*?\.documentColumn[\s\S]*?width:\s*100%\s*!important/);
    expect(cssModule).toMatch(/@media\s*\(max-width:\s*767px\)\s*\{[\s\S]*?\.checklistColumn[\s\S]*?width:\s*100%\s*!important/);
  });

  // 11. Desktop behavior preserved
  test('11. Desktop behavior preserved: queue collapse toggle button, 310px aside, and focus mode available on desktop', () => {
    expect(pageTsx).toContain('!isMobile && isQueueCollapsed');
    expect(pageTsx).toContain('Tampilkan Antrean Legal');
    expect(cssModule).toMatch(/\.queueCollapsed\s*\{[^}]*width:\s*0px/);
  });
});
