const mysql = require('mysql2/promise');
async function main() {
    const connection = await mysql.createConnection({
        host: '127.0.0.1',
        user: 'epms_app_user',
        password: 'Epms_App_Us3r_2026!',
        database: 'epms_tvmubd_db'
    });
    try {
        console.log("=== TABLE STRUCTURE: contracts ===");
        const [cols] = await connection.query(`SHOW COLUMNS FROM contracts`);
        console.log(cols);
        console.log("\n=== FOREIGN KEYS TO contracts ===");
        const [fksToContracts] = await connection.query(`
      SELECT 
          TABLE_NAME, 
          COLUMN_NAME, 
          CONSTRAINT_NAME, 
          REFERENCED_TABLE_NAME 
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
      WHERE REFERENCED_TABLE_NAME = 'contracts';
    `);
        console.log(fksToContracts);
        console.log("\n=== FOREIGN KEYS FROM contracts ===");
        const [fksFromContracts] = await connection.query(`
      SELECT 
          TABLE_NAME, 
          COLUMN_NAME, 
          CONSTRAINT_NAME, 
          REFERENCED_TABLE_NAME 
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
      WHERE TABLE_NAME = 'contracts' AND REFERENCED_TABLE_NAME IS NOT NULL;
    `);
        console.log(fksFromContracts);
        console.log("\n=== GHOST CONTRACTS COUNT ===");
        const [ghostContracts] = await connection.query(`
      SELECT COUNT(*) as count 
      FROM contracts 
      WHERE spk_file_url IS NULL AND status IN ('DRAFT', 'PENDING_LEGAL_REVIEW');
    `);
        console.log(ghostContracts);
        console.log("\n=== HIDDEN REFERENCES: audit_logs ===");
        try {
            const [colsAudit] = await connection.query(`SHOW COLUMNS FROM audit_logs`);
            console.log(colsAudit.map((c) => c.Field).filter((f) => f.includes('contract')));
        }
        catch (e) {
            console.log('audit_logs not found');
        }
        console.log("\n=== HIDDEN REFERENCES: documents ===");
        try {
            const [colsDocs] = await connection.query(`SHOW COLUMNS FROM documents`);
            console.log(colsDocs.map((c) => c.Field).filter((f) => f.includes('contract')));
        }
        catch (e) {
            console.log('documents not found');
        }
        console.log("\n=== HIDDEN REFERENCES: notifications ===");
        try {
            const [colsNotif] = await connection.query(`SHOW COLUMNS FROM notifications`);
            console.log(colsNotif.map((c) => c.Field).filter((f) => f.includes('contract')));
        }
        catch (e) {
            console.log('notifications not found');
        }
        console.log("\n=== HIDDEN REFERENCES: workflow_instances ===");
        try {
            const [colsWf] = await connection.query(`SHOW COLUMNS FROM workflow_instances`);
            console.log(colsWf.map((c) => c.Field).filter((f) => f.includes('contract')));
        }
        catch (e) {
            console.log('workflow_instances not found');
        }
        console.log("\n=== HIDDEN REFERENCES: data values ===");
        try {
            const [wfValues] = await connection.query(`
        SELECT COUNT(*) as cnt FROM workflow_instances WHERE entity_type = 'CONTRACT'
      `);
            console.log("workflow_instances with entity_type='CONTRACT':", wfValues);
        }
        catch (e) { }
        try {
            const [auditValues] = await connection.query(`
        SELECT COUNT(*) as cnt FROM audit_logs WHERE entity_type = 'CONTRACT'
      `);
            console.log("audit_logs with entity_type='CONTRACT':", auditValues);
        }
        catch (e) { }
        try {
            const [notifValues] = await connection.query(`
        SELECT COUNT(*) as cnt FROM notifications WHERE type LIKE '%CONTRACT%' OR message LIKE '%contract%'
      `);
            console.log("notifications referring to contract:", notifValues);
        }
        catch (e) { }
    }
    finally {
        await connection.end();
    }
}
main().catch(console.error);
//# sourceMappingURL=investigate.js.map