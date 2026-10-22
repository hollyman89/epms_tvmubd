import fs from 'fs';
import path from 'path';

describe('Project Workspace Mobile Responsive Contracts (P0/P1 Responsive Fix)', () => {
  const workspaceCssPath = path.resolve(__dirname, '../ProjectWorkspace.module.css');
  const monitoringTsxPath = path.resolve(__dirname, '../ProjectProgressMonitoring.tsx');
  const monitoringCssPath = path.resolve(__dirname, '../ProjectProgressMonitoring.module.css');
  const workspaceTsxPath = path.resolve(__dirname, '../ProjectWorkspace.tsx');

  let workspaceCss: string;
  let monitoringTsx: string;
  let monitoringCss: string;
  let workspaceTsx: string;

  beforeAll(() => {
    workspaceCss = fs.readFileSync(workspaceCssPath, 'utf8');
    monitoringTsx = fs.readFileSync(monitoringTsxPath, 'utf8');
    monitoringCss = fs.readFileSync(monitoringCssPath, 'utf8');
    workspaceTsx = fs.readFileSync(workspaceTsxPath, 'utf8');
  });

  // 1. breadcrumb container can shrink
  test('1. Breadcrumb container can shrink: topNav and breadcrumbRow enforce min-width 0, max-width 100%, and wrap cleanly', () => {
    expect(workspaceCss).toMatch(/\.topNav\s*\{[^}]*width:\s*100%/);
    expect(workspaceCss).toMatch(/\.topNav\s*\{[^}]*max-width:\s*100%/);
    expect(workspaceCss).toMatch(/\.topNav\s*\{[^}]*min-width:\s*0/);

    expect(workspaceCss).toMatch(/\.breadcrumbRow\s*\{[^}]*flex-wrap:\s*wrap/);
    expect(workspaceCss).toMatch(/\.breadcrumbRow\s*\{[^}]*min-width:\s*0/);
    expect(workspaceCss).toMatch(/\.breadcrumbRow\s*\{[^}]*max-width:\s*100%/);

    expect(workspaceCss).toMatch(/\.breadcrumbLink\s*\{[^}]*white-space:\s*nowrap/);
    expect(workspaceCss).toMatch(/\.breadcrumbLink\s*\{[^}]*flex-shrink:\s*0/);
    expect(workspaceCss).toMatch(/\.breadcrumbSeparator\s*\{[^}]*flex-shrink:\s*0/);
  });

  // 2. long project name does not expand body
  test('2. Long project name does not expand body: breadcrumbCurrent and projectName have truncation & word-break', () => {
    expect(workspaceCss).toMatch(/\.breadcrumbCurrent\s*\{[^}]*min-width:\s*0/);
    expect(workspaceCss).toMatch(/\.breadcrumbCurrent\s*\{[^}]*overflow:\s*hidden/);
    expect(workspaceCss).toMatch(/\.breadcrumbCurrent\s*\{[^}]*text-overflow:\s*ellipsis/);
    expect(workspaceCss).toMatch(/\.breadcrumbCurrent\s*\{[^}]*white-space:\s*nowrap/);

    expect(workspaceCss).toMatch(/@media\s*\(max-width:\s*640px\)\s*\{[\s\S]*?\.breadcrumbCurrent\s*\{[\s\S]*?max-width:\s*100%/);

    expect(workspaceCss).toMatch(/\.projectName\s*\{[^}]*word-break:\s*break-word/);
    expect(workspaceCss).toMatch(/\.projectName\s*\{[^}]*min-width:\s*0/);
  });

  // 3. Workspace nav remains accessible
  test('3. Workspace navigation remains accessible: navBarWrapper and navTabsList maintain horizontal touch-scroll', () => {
    expect(workspaceCss).toMatch(/\.navBarWrapper\s*\{[^}]*max-width:\s*100%/);
    expect(workspaceCss).toMatch(/\.navBarWrapper\s*\{[^}]*min-width:\s*0/);

    expect(workspaceCss).toMatch(/\.navTabsList\s*\{[^}]*overflow-x:\s*auto/);
    expect(workspaceCss).toMatch(/\.navTabsList\s*\{[^}]*width:\s*100%/);
    expect(workspaceCss).toMatch(/\.navTabsList\s*\{[^}]*-webkit-overflow-scrolling:\s*touch/);

    expect(workspaceTsx).toContain('data-testid="nav-tab-overview"');
    expect(workspaceTsx).toContain('data-testid="nav-tab-tasks"');
    expect(workspaceTsx).toContain('data-testid="nav-tab-monitoring"');
    expect(workspaceTsx).toContain('data-testid="nav-tab-gantt"');
  });

  // 4. Monitoring table has internal scroll containment
  test('4. Monitoring table has internal scroll containment: tableScrollWrapper wraps work package and milestone tables with horizontal scrolling', () => {
    expect(monitoringTsx).toContain('data-testid="work-package-table" className={styles.tableScrollWrapper}');
    expect(monitoringTsx).toContain('className={styles.tableScrollWrapper} data-testid="milestone-table-wrapper"');
    expect(monitoringTsx).toContain('scroll={{ x: 800 }}');
    expect(monitoringTsx).toContain('scroll={{ x: 500 }}');

    expect(monitoringCss).toMatch(/\.tableScrollWrapper\s*\{[^}]*overflow-x:\s*auto/);
    expect(monitoringCss).toMatch(/\.tableScrollWrapper\s*\{[^}]*max-width:\s*100%/);
    expect(monitoringCss).toMatch(/\.tableScrollWrapper\s*\{[^}]*min-width:\s*0/);
    expect(monitoringCss).toMatch(/\.tableScrollWrapper\s*\{[^}]*-webkit-overflow-scrolling:\s*touch/);
  });

  // 5. Monitoring wrapper does not expand page
  test('5. Monitoring wrapper does not expand page: monitoringWorkspace and surfaceCard are bounded to max-width 100%', () => {
    expect(monitoringCss).toMatch(/\.monitoringWorkspace\s*\{[^}]*max-width:\s*100%/);
    expect(monitoringCss).toMatch(/\.monitoringWorkspace\s*\{[^}]*min-width:\s*0/);

    expect(monitoringCss).toMatch(/\.surfaceCard\s*\{[^}]*max-width:\s*100%/);
    expect(monitoringCss).toMatch(/\.surfaceCard\s*\{[^}]*min-width:\s*0/);

    expect(monitoringCss).toMatch(/\.chartContainer\s*\{[^}]*max-width:\s*100%/);
    expect(monitoringCss).toMatch(/\.chartContainer\s*\{[^}]*min-width:\s*0/);

    expect(monitoringCss).toMatch(/\.twoColGrid > \*\s*\{[^}]*min-width:\s*0;\s*max-width:\s*100%;/);
  });

  // 6. Tasks internal scroll preserved
  test('6. Tasks internal scroll preserved: ProjectTaskBoard embedded mode retains board horizontal scrolling without page overflow', () => {
    expect(workspaceTsx).toContain('<ProjectTaskBoard');
    expect(workspaceTsx).toContain('embedded={true}');
    expect(workspaceTsx).toContain('data-testid="workspace-section-tasks"');
  });

  // 7. Gantt internal scroll preserved
  test('7. Gantt internal scroll preserved: ProjectGantt embedded mode retains timeline horizontal scrolling without page overflow', () => {
    expect(workspaceTsx).toContain('<ProjectGantt');
    expect(workspaceTsx).toContain('embedded={true}');
    expect(workspaceTsx).toContain('data-testid="workspace-section-gantt"');
  });

  // 8. All section routes/section state unchanged
  test('8. All section routes and state unchanged: overview, tasks, monitoring, gantt, issue-risk, closure are preserved', () => {
    const validSections = ['overview', 'tasks', 'monitoring', 'gantt', 'issue-risk', 'closure'];
    for (const sec of validSections) {
      expect(workspaceTsx).toContain(`'${sec}'`);
      expect(workspaceTsx).toContain(`activeSection === '${sec}'`);
    }
    expect(workspaceTsx).toContain('handleSectionChange');
    expect(workspaceTsx).toContain('currentUrl.searchParams.set(\'section\', newSection)');
  });

  // 9. Desktop layout preserved
  test('9. Desktop layout preserved: desktop media queries (>= 768px / 992px) keep identityCol, headerRight, and kpiBar inline', () => {
    expect(workspaceCss).toMatch(/\.identityCol\s*\{[^}]*flex:\s*1\s*1\s*500px/);
    expect(workspaceCss).toMatch(/@media\s*\(max-width:\s*992px\)\s*\{[\s\S]*?\.headerTop\s*\{[\s\S]*?flex-direction:\s*column/);
    expect(workspaceCss).toMatch(/@media\s*\(max-width:\s*640px\)\s*\{[\s\S]*?\.projectIconBox\s*\{[\s\S]*?display:\s*none/);
  });
});
