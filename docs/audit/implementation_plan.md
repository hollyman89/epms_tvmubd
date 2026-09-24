# Implementation Plan: Workflow Definition & Versioning (Phase 1)

This plan covers the backend-only implementation of Phase 1 of the Enterprise Workflow Engine, ensuring strict adherence to the zero-impact and backward-compatibility rules.

## 1. Existing Schema Audit & Mapping
Currently, the database has `workflow_definitions` which conflates both the "Definition" (metadata) and the "Version" (BPMN JSON) into a single table. It has `name` (UNIQUE), `bpmn_json`, `version`, and `is_active`.
*Note*: A query against `workflow_definitions` returned `0` rows. There are no running workflows utilizing this schema in the database.

**Design Decision:**
To meet the requirement where "Version is immutable after published" and "Old versions must not change", the schema must be normalized into two tables: `workflow_definitions` and `workflow_versions`. Because there is zero existing data, we can seamlessly execute a migration to align with the Target Model without breaking existing records.

## 2. Proposed Migrations (Backward-Compatible)

We will execute the following SQL migration:

```sql
-- 1. Create the new versions table
CREATE TABLE `workflow_versions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `workflow_definition_id` bigint unsigned NOT NULL,
  `version` int NOT NULL,
  `bpmn_json` json NOT NULL,
  `status` varchar(50) NOT NULL DEFAULT 'DRAFT',
  `published_at` datetime DEFAULT NULL,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_wv_def_version` (`workflow_definition_id`, `version`),
  CONSTRAINT `fk_wv_definition` FOREIGN KEY (`workflow_definition_id`) REFERENCES `workflow_definitions` (`id`) ON DELETE CASCADE
);

-- 2. Alter existing definitions table to match Target Model
ALTER TABLE `workflow_definitions` 
  DROP INDEX `name`,
  ADD COLUMN `workflow_key` varchar(100) NOT NULL AFTER `id`,
  ADD COLUMN `description` text DEFAULT NULL AFTER `name`,
  ADD COLUMN `domain` varchar(50) DEFAULT NULL AFTER `description`,
  ADD COLUMN `active_version` int DEFAULT NULL AFTER `domain`,
  ADD COLUMN `status` varchar(50) NOT NULL DEFAULT 'DRAFT' AFTER `active_version`,
  ADD UNIQUE KEY `idx_wd_key` (`workflow_key`);
```

## 3. Entity & Service Updates

### [NEW] `backend/src/entities/workflow-definition.entity.ts`
TypeORM entity mapping to `workflow_definitions`.

### [NEW] `backend/src/entities/workflow-version.entity.ts`
TypeORM entity mapping to `workflow_versions`.

### [MODIFY] `backend/src/modules/workflow-engine/workflow.module.ts`
Register the new TypeORM entities using `TypeOrmModule.forFeature([WorkflowDefinition, WorkflowVersion])`.

### [MODIFY] `backend/src/modules/workflow-engine/workflow.controller.ts`
Add the Phase 1 APIs with proper Validation DTOs:
- `POST /workflow-definitions`
- `GET /workflow-definitions`
- `GET /workflow-definitions/:id`
- `POST /workflow-definitions/:id/versions`
- `GET /workflow-definitions/:id/versions`
- `GET /workflow-definitions/:id/versions/:version`
- `POST /workflow-definitions/:id/versions/:version/publish`

### [NEW] `backend/src/modules/workflow-engine/workflow-definition.service.ts`
Implementation of the business logic:
- Ensure `workflowKey` is unique.
- Create v1 `DRAFT` automatically when creating a definition.
- When `publish` is called: transition v1 to `PUBLISHED`, make immutable, update `active_version` on the Definition.
- When creating v2: clone `bpmn_json` from the latest version into a new `DRAFT` record.

## 4. Zero-Impact Guarantees
- We **WILL NOT** touch `workflow_instances` or `workflow_tasks` runtime logic.
- We **WILL NOT** modify the existing mock BPMN engine used in `workflow.service.ts` (`generateSampleBpmnXml`, `evaluateApprovalMatrix`) which is currently driving the prototype. This ensures Project #2 PR flow remains untouched.
- No frontend changes will be made.

## 5. Testing Plan
- `npm run type-check` and `npm run build`.
- Playwright E2E suites for Procurement (`npm run test:e2e` or Playwright script) to verify Project #2 remains at `READY_FOR_PROCUREMENT` and PR #1 is unaffected.
- A custom Jest/API script to verify the 10 mandatory test cases for the new endpoints (immutability, transitions, rejection of duplicates).

> [!IMPORTANT]
> User Review Required: Please approve the creation of the new `workflow_versions` table and the modification of `workflow_definitions`. Since the table has 0 rows, this will be executed via an isolated raw SQL migration script during this phase.
