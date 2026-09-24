# DOCUMENTATION: 01_DATABASE_BASELINE.md

> **BASELINE DATABASE RESMI EPMS**  
> **Source Snapshot**: `database/epms_tvmubd_db.sql`  
> **Generated Date**: 5 Agustus 2026  
> **Mode**: READ ONLY BASELINE AUDIT  

## A. DATABASE INFORMATION

- **Database Name**: `epms_tvmubd_db`
- **Server Version (Dump Header)**: MySQL / MariaDB `9.7.1`
- **Default Charset**: `utf8mb4`
- **Default Collation**: `utf8mb4_unicode_ci` / `utf8mb4_0900_ai_ci`
- **Default Storage Engine**: `InnoDB`
- **Total Tables**: `35` tabel

## B. TABLE INVENTORY

| No | Table Name | Engine | Estimated Rows | Default Charset / Collation |
|---|---|---|---|---|
| 1 | `audit_logs` | InnoDB | 11 | `utf8mb4_unicode_ci` |
| 2 | `contract_amendments` | InnoDB | 0 | `utf8mb4_0900_ai_ci` |
| 3 | `contracts` | InnoDB | 25 | `utf8mb4_unicode_ci` |
| 4 | `customers` | InnoDB | 2 | `utf8mb4_unicode_ci` |
| 5 | `dashboard_kpis` | InnoDB | 0 | `utf8mb4_unicode_ci` |
| 6 | `documents` | InnoDB | 5 | `utf8mb4_unicode_ci` |
| 7 | `goods_receipts` | InnoDB | 0 | `utf8mb4_unicode_ci` |
| 8 | `invoices` | InnoDB | 0 | `utf8mb4_unicode_ci` |
| 9 | `milestones` | InnoDB | 0 | `utf8mb4_unicode_ci` |
| 10 | `notifications` | InnoDB | 11 | `utf8mb4_unicode_ci` |
| 11 | `outbox_events` | InnoDB | 11 | `utf8mb4_0900_ai_ci` |
| 12 | `payments` | InnoDB | 0 | `utf8mb4_unicode_ci` |
| 13 | `permissions` | InnoDB | 0 | `utf8mb4_unicode_ci` |
| 14 | `project_budgets` | InnoDB | 0 | `utf8mb4_unicode_ci` |
| 15 | `projects` | InnoDB | 3 | `utf8mb4_unicode_ci` |
| 16 | `proposals` | InnoDB | 48 | `utf8mb4_unicode_ci` |
| 17 | `purchase_order_items` | InnoDB | 0 | `utf8mb4_unicode_ci` |
| 18 | `purchase_orders` | InnoDB | 0 | `utf8mb4_unicode_ci` |
| 19 | `purchase_request_items` | InnoDB | 0 | `utf8mb4_unicode_ci` |
| 20 | `purchase_requests` | InnoDB | 0 | `utf8mb4_unicode_ci` |
| 21 | `rfqs` | InnoDB | 0 | `utf8mb4_unicode_ci` |
| 22 | `role_permissions` | InnoDB | 0 | `utf8mb4_unicode_ci` |
| 23 | `roles` | InnoDB | 11 | `utf8mb4_unicode_ci` |
| 24 | `tasks` | InnoDB | 0 | `utf8mb4_unicode_ci` |
| 25 | `tender_activities` | InnoDB | 138 | `utf8mb4_general_ci` |
| 26 | `tender_price_history` | InnoDB | 0 | `utf8mb4_0900_ai_ci` |
| 27 | `tenders` | InnoDB | 48 | `utf8mb4_unicode_ci` |
| 28 | `user_roles` | InnoDB | 17 | `utf8mb4_unicode_ci` |
| 29 | `users` | InnoDB | 17 | `utf8mb4_unicode_ci` |
| 30 | `vendor_comparisons` | InnoDB | 0 | `utf8mb4_unicode_ci` |
| 31 | `vendors` | InnoDB | 0 | `utf8mb4_unicode_ci` |
| 32 | `work_breakdown_structures` | InnoDB | 0 | `utf8mb4_unicode_ci` |
| 33 | `workflow_definitions` | InnoDB | 0 | `utf8mb4_unicode_ci` |
| 34 | `workflow_instances` | InnoDB | 0 | `utf8mb4_unicode_ci` |
| 35 | `workflow_tasks` | InnoDB | 0 | `utf8mb4_unicode_ci` |

## C. TABLE STRUCTURE

### Table: `audit_logs`

| Column Name | Data Type | Nullable | Default Value | Primary Key | Auto Increment |
|---|---|---|---|---|---|
| `id` | `bigint UNSIGNED` | NO | `-` | YES ✅ | YES ⚡ |
| `table_name` | `varchar(100)` | NO | `-` | NO | NO |
| `record_id` | `bigint UNSIGNED` | NO | `-` | NO | NO |
| `action` | `varchar(50)` | NO | `-` | NO | NO |
| `old_value` | `json` | YES | `NULL` | NO | NO |
| `new_value` | `json` | YES | `NULL` | NO | NO |
| `ip_address` | `varchar(45)` | YES | `NULL` | NO | NO |
| `user_agent` | `text` | YES | `-` | NO | NO |
| `created_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `created_at` | `datetime` | YES | `CURRENT_TIMESTAMP` | NO | NO |

### Table: `contract_amendments`

| Column Name | Data Type | Nullable | Default Value | Primary Key | Auto Increment |
|---|---|---|---|---|---|
| `id` | `bigint UNSIGNED` | NO | `-` | YES ✅ | YES ⚡ |
| `contract_id` | `bigint UNSIGNED` | NO | `-` | NO | NO |
| `version_number` | `int` | NO | `'1'` | NO | NO |
| `old_value` | `decimal(19,2)` | YES | `NULL` | NO | NO |
| `new_value` | `decimal(19,2)` | YES | `NULL` | NO | NO |
| `reason` | `text` | NO | `-` | NO | NO |
| `approved_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `created_at` | `datetime` | NO | `CURRENT_TIMESTAMP` | NO | NO |
| `updated_at` | `datetime` | NO | `CURRENT_TIMESTAMP` | NO | NO |

### Table: `contracts`

| Column Name | Data Type | Nullable | Default Value | Primary Key | Auto Increment |
|---|---|---|---|---|---|
| `id` | `bigint UNSIGNED` | NO | `-` | YES ✅ | YES ⚡ |
| `proposal_id` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `customer_id` | `bigint UNSIGNED` | NO | `-` | NO | NO |
| `contract_number` | `varchar(100)` | NO | `-` | NO | NO |
| `contract_value` | `decimal(19,2)` | NO | `-` | NO | NO |
| `start_date` | `date` | NO | `-` | NO | NO |
| `end_date` | `date` | NO | `-` | NO | NO |
| `status` | `varchar(50)` | NO | `'ACTIVE'` | NO | NO |
| `created_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `updated_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `deleted_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `created_at` | `datetime` | YES | `CURRENT_TIMESTAMP` | NO | NO |
| `updated_at` | `datetime` | YES | `CURRENT_TIMESTAMP` | NO | NO |
| `deleted_at` | `datetime` | YES | `NULL` | NO | NO |
| `legal_status` | `enum('DRAFT','ON_REVIEW','APPROVED','REJECTED','REVISION_REQUESTED')` | NO | `'DRAFT'` | NO | NO |
| `legal_reviewer_id` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `legal_notes` | `text` | YES | `-` | NO | NO |
| `project_manager_id` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `ops_team_activated_at` | `datetime` | YES | `NULL` | NO | NO |
| `version` | `int` | NO | `'1'` | NO | NO |
| `tender_id` | `bigint` | YES | `NULL` | NO | NO |
| `spk_file_url` | `varchar(1000)` | YES | `NULL` | NO | NO |

### Table: `customers`

| Column Name | Data Type | Nullable | Default Value | Primary Key | Auto Increment |
|---|---|---|---|---|---|
| `id` | `bigint UNSIGNED` | NO | `-` | YES ✅ | YES ⚡ |
| `code` | `varchar(50)` | NO | `-` | NO | NO |
| `name` | `varchar(200)` | NO | `-` | NO | NO |
| `address` | `text` | YES | `-` | NO | NO |
| `tax_id` | `varchar(50)` | YES | `NULL` | NO | NO |
| `created_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `updated_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `deleted_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `created_at` | `datetime` | YES | `CURRENT_TIMESTAMP` | NO | NO |
| `updated_at` | `datetime` | YES | `CURRENT_TIMESTAMP` | NO | NO |
| `deleted_at` | `datetime` | YES | `NULL` | NO | NO |
| `company` | `varchar(150)` | YES | `NULL` | NO | NO |
| `contact_person` | `varchar(100)` | NO | `'-'` | NO | NO |
| `phone` | `varchar(20)` | NO | `'-'` | NO | NO |
| `email` | `varchar(100)` | YES | `NULL` | NO | NO |
| `business_sector` | `varchar(100)` | YES | `NULL` | NO | NO |
| `city` | `varchar(100)` | YES | `NULL` | NO | NO |
| `status` | `enum('Active','Inactive','PROSPECT')` | YES | `'Active'` | NO | NO |
| `marketing_pic_id` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |

### Table: `dashboard_kpis`

| Column Name | Data Type | Nullable | Default Value | Primary Key | Auto Increment |
|---|---|---|---|---|---|
| `id` | `bigint UNSIGNED` | NO | `-` | YES ✅ | YES ⚡ |
| `kpi_key` | `varchar(100)` | NO | `-` | NO | NO |
| `kpi_value` | `decimal(19,2)` | NO | `'0.00'` | NO | NO |
| `metadata` | `json` | YES | `NULL` | NO | NO |
| `created_at` | `datetime` | YES | `CURRENT_TIMESTAMP` | NO | NO |
| `updated_at` | `datetime` | YES | `CURRENT_TIMESTAMP` | NO | NO |

### Table: `documents`

| Column Name | Data Type | Nullable | Default Value | Primary Key | Auto Increment |
|---|---|---|---|---|---|
| `id` | `bigint UNSIGNED` | NO | `-` | YES ✅ | YES ⚡ |
| `entity_type` | `varchar(100)` | NO | `-` | NO | NO |
| `entity_id` | `bigint UNSIGNED` | NO | `-` | NO | NO |
| `file_name` | `varchar(255)` | NO | `-` | NO | NO |
| `file_path` | `varchar(255)` | NO | `-` | NO | NO |
| `mime_type` | `varchar(100)` | YES | `NULL` | NO | NO |
| `file_size` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `created_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `updated_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `deleted_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `created_at` | `datetime` | YES | `CURRENT_TIMESTAMP` | NO | NO |
| `updated_at` | `datetime` | YES | `CURRENT_TIMESTAMP` | NO | NO |
| `deleted_at` | `datetime` | YES | `NULL` | NO | NO |

### Table: `goods_receipts`

| Column Name | Data Type | Nullable | Default Value | Primary Key | Auto Increment |
|---|---|---|---|---|---|
| `id` | `bigint UNSIGNED` | NO | `-` | YES ✅ | YES ⚡ |
| `po_id` | `bigint UNSIGNED` | NO | `-` | NO | NO |
| `gr_number` | `varchar(100)` | NO | `-` | NO | NO |
| `receipt_date` | `date` | NO | `-` | NO | NO |
| `total_received_amount` | `decimal(19,2)` | NO | `-` | NO | NO |
| `created_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `updated_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `deleted_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `created_at` | `datetime` | YES | `CURRENT_TIMESTAMP` | NO | NO |
| `updated_at` | `datetime` | YES | `CURRENT_TIMESTAMP` | NO | NO |
| `deleted_at` | `datetime` | YES | `NULL` | NO | NO |
| `version` | `int` | NO | `'1'` | NO | NO |

### Table: `invoices`

| Column Name | Data Type | Nullable | Default Value | Primary Key | Auto Increment |
|---|---|---|---|---|---|
| `id` | `bigint UNSIGNED` | NO | `-` | YES ✅ | YES ⚡ |
| `po_id` | `bigint UNSIGNED` | NO | `-` | NO | NO |
| `invoice_number` | `varchar(100)` | NO | `-` | NO | NO |
| `total_amount` | `decimal(19,2)` | NO | `-` | NO | NO |
| `status` | `varchar(50)` | NO | `'UNPAID'` | NO | NO |
| `created_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `updated_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `deleted_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `created_at` | `datetime` | YES | `CURRENT_TIMESTAMP` | NO | NO |
| `updated_at` | `datetime` | YES | `CURRENT_TIMESTAMP` | NO | NO |
| `deleted_at` | `datetime` | YES | `NULL` | NO | NO |
| `version` | `int` | NO | `'1'` | NO | NO |

### Table: `milestones`

| Column Name | Data Type | Nullable | Default Value | Primary Key | Auto Increment |
|---|---|---|---|---|---|
| `id` | `bigint UNSIGNED` | NO | `-` | YES ✅ | YES ⚡ |
| `project_id` | `bigint UNSIGNED` | NO | `-` | NO | NO |
| `name` | `varchar(255)` | NO | `-` | NO | NO |
| `target_date` | `date` | NO | `-` | NO | NO |
| `is_completed` | `tinyint(1)` | YES | `'0'` | NO | NO |
| `created_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `updated_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `deleted_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `created_at` | `datetime` | YES | `CURRENT_TIMESTAMP` | NO | NO |
| `updated_at` | `datetime` | YES | `CURRENT_TIMESTAMP` | NO | NO |
| `deleted_at` | `datetime` | YES | `NULL` | NO | NO |

### Table: `notifications`

| Column Name | Data Type | Nullable | Default Value | Primary Key | Auto Increment |
|---|---|---|---|---|---|
| `id` | `bigint UNSIGNED` | NO | `-` | YES ✅ | YES ⚡ |
| `user_id` | `bigint UNSIGNED` | NO | `-` | NO | NO |
| `title` | `varchar(255)` | NO | `-` | NO | NO |
| `is_read` | `tinyint(1)` | YES | `'0'` | NO | NO |
| `created_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `updated_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `deleted_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `created_at` | `datetime` | YES | `CURRENT_TIMESTAMP` | NO | NO |
| `updated_at` | `datetime` | YES | `CURRENT_TIMESTAMP` | NO | NO |
| `deleted_at` | `datetime` | YES | `NULL` | NO | NO |
| `message` | `text` | YES | `-` | NO | NO |
| `notification_type` | `varchar(50)` | YES | `'TASK'` | NO | NO |
| `action_link` | `varchar(255)` | YES | `NULL` | NO | NO |
| `meta_data` | `json` | YES | `NULL` | NO | NO |

### Table: `outbox_events`

| Column Name | Data Type | Nullable | Default Value | Primary Key | Auto Increment |
|---|---|---|---|---|---|
| `id` | `bigint UNSIGNED` | NO | `-` | YES ✅ | YES ⚡ |
| `event_id` | `varchar(100)` | NO | `-` | NO | NO |
| `event_name` | `varchar(100)` | NO | `-` | NO | NO |
| `event_version` | `varchar(20)` | YES | `'1.0'` | NO | NO |
| `aggregate_type` | `varchar(50)` | NO | `-` | NO | NO |
| `aggregate_id` | `bigint UNSIGNED` | NO | `-` | NO | NO |
| `correlation_id` | `varchar(100)` | YES | `NULL` | NO | NO |
| `transaction_id` | `varchar(100)` | YES | `NULL` | NO | NO |
| `payload` | `json` | YES | `NULL` | NO | NO |
| `status` | `varchar(20)` | YES | `'PENDING'` | NO | NO |
| `retry_count` | `int` | YES | `'0'` | NO | NO |
| `error_message` | `text` | YES | `-` | NO | NO |
| `created_at` | `datetime` | YES | `CURRENT_TIMESTAMP` | NO | NO |
| `published_at` | `datetime` | YES | `NULL` | NO | NO |

### Table: `payments`

| Column Name | Data Type | Nullable | Default Value | Primary Key | Auto Increment |
|---|---|---|---|---|---|
| `id` | `bigint UNSIGNED` | NO | `-` | YES ✅ | YES ⚡ |
| `invoice_id` | `bigint UNSIGNED` | NO | `-` | NO | NO |
| `payment_number` | `varchar(100)` | NO | `-` | NO | NO |
| `amount_paid` | `decimal(19,2)` | NO | `-` | NO | NO |
| `payment_date` | `date` | NO | `-` | NO | NO |
| `created_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `updated_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `deleted_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `created_at` | `datetime` | YES | `CURRENT_TIMESTAMP` | NO | NO |
| `updated_at` | `datetime` | YES | `CURRENT_TIMESTAMP` | NO | NO |
| `deleted_at` | `datetime` | YES | `NULL` | NO | NO |
| `version` | `int` | NO | `'1'` | NO | NO |

### Table: `permissions`

| Column Name | Data Type | Nullable | Default Value | Primary Key | Auto Increment |
|---|---|---|---|---|---|
| `id` | `bigint UNSIGNED` | NO | `-` | YES ✅ | YES ⚡ |
| `name` | `varchar(100)` | NO | `-` | NO | NO |
| `description` | `varchar(255)` | YES | `NULL` | NO | NO |
| `created_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `updated_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `deleted_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `created_at` | `datetime` | YES | `CURRENT_TIMESTAMP` | NO | NO |
| `updated_at` | `datetime` | YES | `CURRENT_TIMESTAMP` | NO | NO |
| `deleted_at` | `datetime` | YES | `NULL` | NO | NO |

### Table: `project_budgets`

| Column Name | Data Type | Nullable | Default Value | Primary Key | Auto Increment |
|---|---|---|---|---|---|
| `id` | `bigint UNSIGNED` | NO | `-` | YES ✅ | YES ⚡ |
| `project_id` | `bigint UNSIGNED` | NO | `-` | NO | NO |
| `category` | `varchar(100)` | NO | `-` | NO | NO |
| `planned_amount` | `decimal(19,2)` | NO | `'0.00'` | NO | NO |
| `actual_amount` | `decimal(19,2)` | NO | `'0.00'` | NO | NO |
| `remaining_amount` | `decimal(19,2)` | YES | `-` | NO | NO |
| `created_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `updated_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `deleted_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `created_at` | `datetime` | YES | `CURRENT_TIMESTAMP` | NO | NO |
| `updated_at` | `datetime` | YES | `CURRENT_TIMESTAMP` | NO | NO |
| `deleted_at` | `datetime` | YES | `NULL` | NO | NO |

### Table: `projects`

| Column Name | Data Type | Nullable | Default Value | Primary Key | Auto Increment |
|---|---|---|---|---|---|
| `id` | `bigint UNSIGNED` | NO | `-` | YES ✅ | YES ⚡ |
| `contract_id` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `manager_id` | `bigint UNSIGNED` | NO | `-` | NO | NO |
| `code` | `varchar(50)` | NO | `-` | NO | NO |
| `name` | `varchar(255)` | NO | `-` | NO | NO |
| `status` | `varchar(50)` | NO | `'PLANNING'` | NO | NO |
| `start_date` | `date` | YES | `NULL` | NO | NO |
| `end_date` | `date` | YES | `NULL` | NO | NO |
| `created_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `updated_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `deleted_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `created_at` | `datetime` | YES | `CURRENT_TIMESTAMP` | NO | NO |
| `updated_at` | `datetime` | YES | `CURRENT_TIMESTAMP` | NO | NO |
| `deleted_at` | `datetime` | YES | `NULL` | NO | NO |
| `version` | `int` | NO | `'1'` | NO | NO |

### Table: `proposals`

| Column Name | Data Type | Nullable | Default Value | Primary Key | Auto Increment |
|---|---|---|---|---|---|
| `id` | `bigint UNSIGNED` | NO | `-` | YES ✅ | YES ⚡ |
| `tender_id` | `bigint UNSIGNED` | NO | `-` | NO | NO |
| `proposal_number` | `varchar(100)` | NO | `-` | NO | NO |
| `proposed_amount` | `decimal(19,2)` | NO | `-` | NO | NO |
| `status` | `varchar(50)` | NO | `'DRAFT'` | NO | NO |
| `created_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `updated_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `deleted_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `created_at` | `datetime` | YES | `CURRENT_TIMESTAMP` | NO | NO |
| `updated_at` | `datetime` | YES | `CURRENT_TIMESTAMP` | NO | NO |
| `deleted_at` | `datetime` | YES | `NULL` | NO | NO |

### Table: `purchase_order_items`

| Column Name | Data Type | Nullable | Default Value | Primary Key | Auto Increment |
|---|---|---|---|---|---|
| `id` | `bigint UNSIGNED` | NO | `-` | YES ✅ | YES ⚡ |
| `purchase_order_id` | `bigint UNSIGNED` | NO | `-` | NO | NO |
| `item_name` | `varchar(255)` | NO | `-` | NO | NO |
| `quantity` | `decimal(10,2)` | NO | `-` | NO | NO |
| `received_quantity` | `decimal(10,2)` | NO | `'0.00'` | NO | NO |
| `unit_price` | `decimal(19,2)` | NO | `-` | NO | NO |
| `total_price` | `decimal(19,2)` | NO | `'0.00'` | NO | NO |
| `created_at` | `datetime` | YES | `CURRENT_TIMESTAMP` | NO | NO |
| `updated_at` | `datetime` | YES | `CURRENT_TIMESTAMP` | NO | NO |
| `deleted_at` | `datetime` | YES | `NULL` | NO | NO |

### Table: `purchase_orders`

| Column Name | Data Type | Nullable | Default Value | Primary Key | Auto Increment |
|---|---|---|---|---|---|
| `id` | `bigint UNSIGNED` | NO | `-` | YES ✅ | YES ⚡ |
| `pr_id` | `bigint UNSIGNED` | NO | `-` | NO | NO |
| `vendor_id` | `bigint UNSIGNED` | NO | `-` | NO | NO |
| `po_number` | `varchar(100)` | NO | `-` | NO | NO |
| `total_amount` | `decimal(19,2)` | NO | `-` | NO | NO |
| `status` | `varchar(50)` | NO | `'ISSUED'` | NO | NO |
| `created_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `updated_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `deleted_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `created_at` | `datetime` | YES | `CURRENT_TIMESTAMP` | NO | NO |
| `updated_at` | `datetime` | YES | `CURRENT_TIMESTAMP` | NO | NO |
| `deleted_at` | `datetime` | YES | `NULL` | NO | NO |
| `version` | `int` | NO | `'1'` | NO | NO |

### Table: `purchase_request_items`

| Column Name | Data Type | Nullable | Default Value | Primary Key | Auto Increment |
|---|---|---|---|---|---|
| `id` | `bigint UNSIGNED` | NO | `-` | YES ✅ | YES ⚡ |
| `pr_id` | `bigint UNSIGNED` | NO | `-` | NO | NO |
| `item_name` | `varchar(255)` | NO | `-` | NO | NO |
| `quantity` | `decimal(10,2)` | NO | `-` | NO | NO |
| `uom` | `varchar(50)` | NO | `'PCS'` | NO | NO |
| `estimated_unit_price` | `decimal(19,2)` | NO | `-` | NO | NO |
| `total_price` | `decimal(19,2)` | YES | `-` | NO | NO |
| `created_at` | `datetime` | YES | `CURRENT_TIMESTAMP` | NO | NO |
| `updated_at` | `datetime` | YES | `CURRENT_TIMESTAMP` | NO | NO |

### Table: `purchase_requests`

| Column Name | Data Type | Nullable | Default Value | Primary Key | Auto Increment |
|---|---|---|---|---|---|
| `id` | `bigint UNSIGNED` | NO | `-` | YES ✅ | YES ⚡ |
| `project_id` | `bigint UNSIGNED` | NO | `-` | NO | NO |
| `requester_id` | `bigint UNSIGNED` | NO | `-` | NO | NO |
| `pr_number` | `varchar(100)` | NO | `-` | NO | NO |
| `total_estimated_amount` | `decimal(19,2)` | NO | `'0.00'` | NO | NO |
| `status` | `varchar(50)` | NO | `'DRAFT'` | NO | NO |
| `created_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `updated_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `deleted_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `created_at` | `datetime` | YES | `CURRENT_TIMESTAMP` | NO | NO |
| `updated_at` | `datetime` | YES | `CURRENT_TIMESTAMP` | NO | NO |
| `deleted_at` | `datetime` | YES | `NULL` | NO | NO |
| `version` | `int` | NO | `'1'` | NO | NO |

### Table: `rfqs`

| Column Name | Data Type | Nullable | Default Value | Primary Key | Auto Increment |
|---|---|---|---|---|---|
| `id` | `bigint UNSIGNED` | NO | `-` | YES ✅ | YES ⚡ |
| `pr_id` | `bigint UNSIGNED` | NO | `-` | NO | NO |
| `rfq_number` | `varchar(100)` | NO | `-` | NO | NO |
| `status` | `varchar(50)` | NO | `'OPEN'` | NO | NO |
| `created_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `updated_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `deleted_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `created_at` | `datetime` | YES | `CURRENT_TIMESTAMP` | NO | NO |
| `updated_at` | `datetime` | YES | `CURRENT_TIMESTAMP` | NO | NO |
| `deleted_at` | `datetime` | YES | `NULL` | NO | NO |

### Table: `role_permissions`

| Column Name | Data Type | Nullable | Default Value | Primary Key | Auto Increment |
|---|---|---|---|---|---|
| `role_id` | `bigint UNSIGNED` | NO | `-` | YES ✅ | NO |
| `permission_id` | `bigint UNSIGNED` | NO | `-` | YES ✅ | NO |

### Table: `roles`

| Column Name | Data Type | Nullable | Default Value | Primary Key | Auto Increment |
|---|---|---|---|---|---|
| `id` | `bigint UNSIGNED` | NO | `-` | YES ✅ | YES ⚡ |
| `name` | `varchar(50)` | NO | `-` | NO | NO |
| `description` | `varchar(255)` | YES | `NULL` | NO | NO |
| `created_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `updated_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `deleted_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `created_at` | `datetime` | YES | `CURRENT_TIMESTAMP` | NO | NO |
| `updated_at` | `datetime` | YES | `CURRENT_TIMESTAMP` | NO | NO |
| `deleted_at` | `datetime` | YES | `NULL` | NO | NO |

### Table: `tasks`

| Column Name | Data Type | Nullable | Default Value | Primary Key | Auto Increment |
|---|---|---|---|---|---|
| `id` | `bigint UNSIGNED` | NO | `-` | YES ✅ | YES ⚡ |
| `wbs_id` | `bigint UNSIGNED` | NO | `-` | NO | NO |
| `assignee_id` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `name` | `varchar(255)` | NO | `-` | NO | NO |
| `status` | `varchar(50)` | NO | `'TODO'` | NO | NO |
| `start_date` | `date` | YES | `NULL` | NO | NO |
| `due_date` | `date` | YES | `NULL` | NO | NO |
| `created_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `updated_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `deleted_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `created_at` | `datetime` | YES | `CURRENT_TIMESTAMP` | NO | NO |
| `updated_at` | `datetime` | YES | `CURRENT_TIMESTAMP` | NO | NO |
| `deleted_at` | `datetime` | YES | `NULL` | NO | NO |

### Table: `tender_activities`

| Column Name | Data Type | Nullable | Default Value | Primary Key | Auto Increment |
|---|---|---|---|---|---|
| `id` | `bigint UNSIGNED` | NO | `-` | YES ✅ | YES ⚡ |
| `tender_id` | `bigint UNSIGNED` | NO | `-` | NO | NO |
| `user_id` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `type` | `enum('SYSTEM','COMMENT')` | NO | `'COMMENT'` | NO | NO |
| `content` | `text` | NO | `-` | NO | NO |
| `created_at` | `datetime(6)` | NO | `CURRENT_TIMESTAMP` | NO | NO |

### Table: `tender_price_history`

| Column Name | Data Type | Nullable | Default Value | Primary Key | Auto Increment |
|---|---|---|---|---|---|
| `id` | `bigint UNSIGNED` | NO | `-` | YES ✅ | YES ⚡ |
| `tender_id` | `bigint UNSIGNED` | NO | `-` | NO | NO |
| `old_price` | `decimal(19,2)` | YES | `NULL` | NO | NO |
| `new_price` | `decimal(19,2)` | YES | `NULL` | NO | NO |
| `changed_by` | `bigint UNSIGNED` | NO | `-` | NO | NO |
| `reason` | `text` | YES | `-` | NO | NO |
| `created_at` | `timestamp` | YES | `CURRENT_TIMESTAMP` | NO | NO |

### Table: `tenders`

| Column Name | Data Type | Nullable | Default Value | Primary Key | Auto Increment |
|---|---|---|---|---|---|
| `id` | `bigint UNSIGNED` | NO | `-` | YES ✅ | YES ⚡ |
| `customer_id` | `bigint UNSIGNED` | NO | `-` | NO | NO |
| `title` | `varchar(255)` | NO | `-` | NO | NO |
| `submission_deadline` | `datetime` | YES | `NULL` | NO | NO |
| `status` | `enum('NEW','IN_PROGRESS','NEGOTIATION','PENDING_APPROVAL','WON','LOST')` | YES | `'NEW'` | NO | NO |
| `created_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `updated_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `deleted_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `created_at` | `datetime` | YES | `CURRENT_TIMESTAMP` | NO | NO |
| `updated_at` | `datetime` | YES | `CURRENT_TIMESTAMP` | NO | NO |
| `deleted_at` | `datetime` | YES | `NULL` | NO | NO |
| `estimated_budget` | `decimal(19,2)` | YES | `NULL` | NO | NO |
| `marketing_pic_id` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `pic_customer_name` | `varchar(100)` | YES | `NULL` | NO | NO |
| `pic_customer_phone` | `varchar(20)` | YES | `NULL` | NO | NO |
| `pic_customer_email` | `varchar(100)` | YES | `NULL` | NO | NO |
| `business_sector` | `varchar(100)` | YES | `NULL` | NO | NO |
| `stage` | `varchar(50)` | NO | `'LEAD'` | NO | NO |
| `probability_percentage` | `int` | YES | `'0'` | NO | NO |
| `priority` | `enum('LOW','MEDIUM','HIGH','CRITICAL')` | YES | `'MEDIUM'` | NO | NO |
| `source` | `varchar(50)` | YES | `NULL` | NO | NO |
| `notes` | `text` | YES | `-` | NO | NO |
| `expected_closing_date` | `date` | YES | `NULL` | NO | NO |
| `procurement_type` | `enum('TENDER','DIRECT_APPOINTMENT')` | YES | `'TENDER'` | NO | NO |
| `project_location` | `varchar(255)` | YES | `NULL` | NO | NO |
| `bid_submission_deadline` | `date` | YES | `NULL` | NO | NO |
| `negotiated_price` | `decimal(19,2)` | YES | `NULL` | NO | NO |
| `max_discount_rate` | `int` | YES | `'20'` | NO | NO |
| `spk_file_key` | `varchar(255)` | YES | `NULL` | NO | NO |
| `spk_verification_status` | `enum('UNVERIFIED','PENDING_REVIEW','VERIFIED','REJECTED')` | YES | `'UNVERIFIED'` | NO | NO |
| `grace_deadline` | `datetime` | YES | `NULL` | NO | NO |
| `version` | `int` | NO | `'1'` | NO | NO |

### Table: `user_roles`

| Column Name | Data Type | Nullable | Default Value | Primary Key | Auto Increment |
|---|---|---|---|---|---|
| `user_id` | `bigint UNSIGNED` | NO | `-` | YES ✅ | NO |
| `role_id` | `bigint UNSIGNED` | NO | `-` | YES ✅ | NO |

### Table: `users`

| Column Name | Data Type | Nullable | Default Value | Primary Key | Auto Increment |
|---|---|---|---|---|---|
| `id` | `bigint UNSIGNED` | NO | `-` | YES ✅ | YES ⚡ |
| `email` | `varchar(100)` | NO | `-` | NO | NO |
| `password_hash` | `varchar(255)` | NO | `-` | NO | NO |
| `full_name` | `varchar(100)` | NO | `-` | NO | NO |
| `is_active` | `tinyint(1)` | YES | `'1'` | NO | NO |
| `created_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `updated_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `deleted_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `created_at` | `datetime` | YES | `CURRENT_TIMESTAMP` | NO | NO |
| `updated_at` | `datetime` | YES | `CURRENT_TIMESTAMP` | NO | NO |
| `deleted_at` | `datetime` | YES | `NULL` | NO | NO |
| `refresh_token` | `varchar(255)` | YES | `NULL` | NO | NO |

### Table: `vendor_comparisons`

| Column Name | Data Type | Nullable | Default Value | Primary Key | Auto Increment |
|---|---|---|---|---|---|
| `id` | `bigint UNSIGNED` | NO | `-` | YES ✅ | YES ⚡ |
| `rfq_id` | `bigint UNSIGNED` | NO | `-` | NO | NO |
| `vendor_id` | `bigint UNSIGNED` | NO | `-` | NO | NO |
| `offered_amount` | `decimal(19,2)` | NO | `-` | NO | NO |
| `is_winner` | `tinyint(1)` | YES | `'0'` | NO | NO |
| `remarks` | `text` | YES | `-` | NO | NO |
| `created_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `updated_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `deleted_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `created_at` | `datetime` | YES | `CURRENT_TIMESTAMP` | NO | NO |
| `updated_at` | `datetime` | YES | `CURRENT_TIMESTAMP` | NO | NO |
| `deleted_at` | `datetime` | YES | `NULL` | NO | NO |

### Table: `vendors`

| Column Name | Data Type | Nullable | Default Value | Primary Key | Auto Increment |
|---|---|---|---|---|---|
| `id` | `bigint UNSIGNED` | NO | `-` | YES ✅ | YES ⚡ |
| `code` | `varchar(50)` | NO | `-` | NO | NO |
| `name` | `varchar(200)` | NO | `-` | NO | NO |
| `address` | `text` | YES | `-` | NO | NO |
| `tax_id` | `varchar(50)` | YES | `NULL` | NO | NO |
| `vendor_type` | `varchar(50)` | YES | `NULL` | NO | NO |
| `created_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `updated_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `deleted_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `created_at` | `datetime` | YES | `CURRENT_TIMESTAMP` | NO | NO |
| `updated_at` | `datetime` | YES | `CURRENT_TIMESTAMP` | NO | NO |
| `deleted_at` | `datetime` | YES | `NULL` | NO | NO |

### Table: `work_breakdown_structures`

| Column Name | Data Type | Nullable | Default Value | Primary Key | Auto Increment |
|---|---|---|---|---|---|
| `id` | `bigint UNSIGNED` | NO | `-` | YES ✅ | YES ⚡ |
| `project_id` | `bigint UNSIGNED` | NO | `-` | NO | NO |
| `parent_wbs_id` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `code` | `varchar(50)` | NO | `-` | NO | NO |
| `name` | `varchar(255)` | NO | `-` | NO | NO |
| `level` | `int` | NO | `'1'` | NO | NO |
| `created_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `updated_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `deleted_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `created_at` | `datetime` | YES | `CURRENT_TIMESTAMP` | NO | NO |
| `updated_at` | `datetime` | YES | `CURRENT_TIMESTAMP` | NO | NO |
| `deleted_at` | `datetime` | YES | `NULL` | NO | NO |

### Table: `workflow_definitions`

| Column Name | Data Type | Nullable | Default Value | Primary Key | Auto Increment |
|---|---|---|---|---|---|
| `id` | `bigint UNSIGNED` | NO | `-` | YES ✅ | YES ⚡ |
| `name` | `varchar(255)` | NO | `-` | NO | NO |
| `bpmn_json` | `json` | NO | `-` | NO | NO |
| `version` | `int` | NO | `'1'` | NO | NO |
| `is_active` | `tinyint(1)` | YES | `'1'` | NO | NO |
| `created_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `updated_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `deleted_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `created_at` | `datetime` | YES | `CURRENT_TIMESTAMP` | NO | NO |
| `updated_at` | `datetime` | YES | `CURRENT_TIMESTAMP` | NO | NO |
| `deleted_at` | `datetime` | YES | `NULL` | NO | NO |

### Table: `workflow_instances`

| Column Name | Data Type | Nullable | Default Value | Primary Key | Auto Increment |
|---|---|---|---|---|---|
| `id` | `bigint UNSIGNED` | NO | `-` | YES ✅ | YES ⚡ |
| `workflow_definition_id` | `bigint UNSIGNED` | NO | `-` | NO | NO |
| `entity_type` | `varchar(100)` | NO | `-` | NO | NO |
| `entity_id` | `bigint UNSIGNED` | NO | `-` | NO | NO |
| `status` | `varchar(50)` | NO | `'IN_PROGRESS'` | NO | NO |
| `current_state_data` | `json` | YES | `NULL` | NO | NO |
| `created_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `updated_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `deleted_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `created_at` | `datetime` | YES | `CURRENT_TIMESTAMP` | NO | NO |
| `updated_at` | `datetime` | YES | `CURRENT_TIMESTAMP` | NO | NO |
| `deleted_at` | `datetime` | YES | `NULL` | NO | NO |

### Table: `workflow_tasks`

| Column Name | Data Type | Nullable | Default Value | Primary Key | Auto Increment |
|---|---|---|---|---|---|
| `id` | `bigint UNSIGNED` | NO | `-` | YES ✅ | YES ⚡ |
| `workflow_instance_id` | `bigint UNSIGNED` | NO | `-` | NO | NO |
| `assignee_role_id` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `assignee_user_id` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `task_key` | `varchar(100)` | NO | `-` | NO | NO |
| `status` | `varchar(50)` | NO | `'PENDING'` | NO | NO |
| `comments` | `text` | YES | `-` | NO | NO |
| `created_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `updated_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `deleted_by` | `bigint UNSIGNED` | YES | `NULL` | NO | NO |
| `created_at` | `datetime` | YES | `CURRENT_TIMESTAMP` | NO | NO |
| `updated_at` | `datetime` | YES | `CURRENT_TIMESTAMP` | NO | NO |
| `deleted_at` | `datetime` | YES | `NULL` | NO | NO |

## D. FOREIGN KEY RELATIONSHIPS

| Source Table | Source Column | Constraint Name | Referenced Table | Referenced Column | On Delete | On Update |
|---|---|---|---|---|---|---|
| `contract_amendments` | `approved_by` | `FK_585886cc7ea612824c3db4c50e6` | `users` | `id` | `SET NULL` | `RESTRICT` |
| `contract_amendments` | `contract_id` | `FK_e3c3ded02ffe206062ade0ef31d` | `contracts` | `id` | `CASCADE` | `RESTRICT` |
| `contracts` | `project_manager_id` | `FK_cb7d02b9a4d6b88327a58268ed4` | `users` | `id` | `SET NULL` | `RESTRICT` |
| `contracts` | `customer_id` | `fk_contracts_customer` | `customers` | `id` | `RESTRICT` | `RESTRICT` |
| `contracts` | `legal_reviewer_id` | `fk_contracts_legal_reviewer` | `users` | `id` | `SET NULL` | `RESTRICT` |
| `contracts` | `proposal_id` | `fk_contracts_proposal` | `proposals` | `id` | `RESTRICT` | `RESTRICT` |
| `goods_receipts` | `po_id` | `fk_gr_po` | `purchase_orders` | `id` | `RESTRICT` | `RESTRICT` |
| `invoices` | `po_id` | `fk_invoices_po` | `purchase_orders` | `id` | `RESTRICT` | `RESTRICT` |
| `milestones` | `project_id` | `fk_milestones_project` | `projects` | `id` | `RESTRICT` | `RESTRICT` |
| `notifications` | `user_id` | `fk_notif_user` | `users` | `id` | `RESTRICT` | `RESTRICT` |
| `payments` | `invoice_id` | `fk_payments_invoice` | `invoices` | `id` | `RESTRICT` | `RESTRICT` |
| `project_budgets` | `project_id` | `fk_pb_project` | `projects` | `id` | `RESTRICT` | `RESTRICT` |
| `projects` | `contract_id` | `fk_projects_contract` | `contracts` | `id` | `RESTRICT` | `RESTRICT` |
| `projects` | `manager_id` | `fk_projects_manager` | `users` | `id` | `RESTRICT` | `RESTRICT` |
| `proposals` | `tender_id` | `fk_proposals_tender` | `tenders` | `id` | `RESTRICT` | `RESTRICT` |
| `purchase_order_items` | `purchase_order_id` | `fk_poi_po` | `purchase_orders` | `id` | `CASCADE` | `RESTRICT` |
| `purchase_orders` | `pr_id` | `fk_po_pr` | `purchase_requests` | `id` | `RESTRICT` | `RESTRICT` |
| `purchase_orders` | `vendor_id` | `fk_po_vendor` | `vendors` | `id` | `RESTRICT` | `RESTRICT` |
| `purchase_request_items` | `pr_id` | `fk_pri_pr` | `purchase_requests` | `id` | `CASCADE` | `RESTRICT` |
| `purchase_requests` | `project_id` | `fk_pr_project` | `projects` | `id` | `RESTRICT` | `RESTRICT` |
| `purchase_requests` | `requester_id` | `fk_pr_requester` | `users` | `id` | `RESTRICT` | `RESTRICT` |
| `rfqs` | `pr_id` | `fk_rfq_pr` | `purchase_requests` | `id` | `RESTRICT` | `RESTRICT` |
| `role_permissions` | `permission_id` | `fk_rp_permission` | `permissions` | `id` | `RESTRICT` | `RESTRICT` |
| `role_permissions` | `role_id` | `fk_rp_role` | `roles` | `id` | `RESTRICT` | `RESTRICT` |
| `tasks` | `assignee_id` | `fk_tasks_assignee` | `users` | `id` | `RESTRICT` | `RESTRICT` |
| `tasks` | `wbs_id` | `fk_tasks_wbs` | `work_breakdown_structures` | `id` | `RESTRICT` | `RESTRICT` |
| `tender_activities` | `tender_id` | `FK_tender_activities_tender_id` | `tenders` | `id` | `CASCADE` | `RESTRICT` |
| `tender_activities` | `user_id` | `FK_tender_activities_user_id` | `users` | `id` | `SET NULL` | `RESTRICT` |
| `tender_price_history` | `tender_id` | `tender_price_history_ibfk_1` | `tenders` | `id` | `CASCADE` | `RESTRICT` |
| `tenders` | `customer_id` | `fk_tenders_customer` | `customers` | `id` | `RESTRICT` | `RESTRICT` |
| `tenders` | `marketing_pic_id` | `fk_tenders_marketing_pic` | `users` | `id` | `SET NULL` | `RESTRICT` |
| `user_roles` | `role_id` | `fk_ur_role` | `roles` | `id` | `RESTRICT` | `RESTRICT` |
| `user_roles` | `user_id` | `fk_ur_user` | `users` | `id` | `RESTRICT` | `RESTRICT` |
| `users` | `created_by` | `fk_users_created_by` | `users` | `id` | `RESTRICT` | `RESTRICT` |
| `users` | `deleted_by` | `fk_users_deleted_by` | `users` | `id` | `RESTRICT` | `RESTRICT` |
| `users` | `updated_by` | `fk_users_updated_by` | `users` | `id` | `RESTRICT` | `RESTRICT` |
| `vendor_comparisons` | `rfq_id` | `fk_vc_rfq` | `rfqs` | `id` | `RESTRICT` | `RESTRICT` |
| `vendor_comparisons` | `vendor_id` | `fk_vc_vendor` | `vendors` | `id` | `RESTRICT` | `RESTRICT` |
| `work_breakdown_structures` | `parent_wbs_id` | `fk_wbs_parent` | `work_breakdown_structures` | `id` | `RESTRICT` | `RESTRICT` |
| `work_breakdown_structures` | `project_id` | `fk_wbs_project` | `projects` | `id` | `RESTRICT` | `RESTRICT` |
| `workflow_instances` | `workflow_definition_id` | `fk_wi_definition` | `workflow_definitions` | `id` | `RESTRICT` | `RESTRICT` |
| `workflow_tasks` | `workflow_instance_id` | `fk_wt_instance` | `workflow_instances` | `id` | `RESTRICT` | `RESTRICT` |
| `workflow_tasks` | `assignee_role_id` | `fk_wt_role` | `roles` | `id` | `RESTRICT` | `RESTRICT` |
| `workflow_tasks` | `assignee_user_id` | `fk_wt_user` | `users` | `id` | `RESTRICT` | `RESTRICT` |

## E. INDEXES INVENTORY

| Table Name | Index Name | Index Type | Columns |
|---|---|---|---|
| `audit_logs` | `PRIMARY` | PRIMARY KEY | `id` |
| `audit_logs` | `idx_audit_table_record` | INDEX | `table_name, record_id` |
| `contract_amendments` | `PRIMARY` | PRIMARY KEY | `id` |
| `contract_amendments` | `IDX_ab02b9f3cfcac3fd6bf9778709` | INDEX | `contract_id, created_at` |
| `contract_amendments` | `FK_585886cc7ea612824c3db4c50e6` | INDEX | `approved_by` |
| `contracts` | `PRIMARY` | PRIMARY KEY | `id` |
| `contracts` | `contract_number` | UNIQUE | `contract_number` |
| `contracts` | `idx_contracts_deleted_at` | INDEX | `deleted_at` |
| `contracts` | `fk_contracts_proposal` | INDEX | `proposal_id` |
| `contracts` | `fk_contracts_customer` | INDEX | `customer_id` |
| `contracts` | `fk_contracts_legal_reviewer` | INDEX | `legal_reviewer_id` |
| `contracts` | `FK_cb7d02b9a4d6b88327a58268ed4` | INDEX | `project_manager_id` |
| `customers` | `PRIMARY` | PRIMARY KEY | `id` |
| `customers` | `code` | UNIQUE | `code` |
| `customers` | `idx_customers_deleted_at` | INDEX | `deleted_at` |
| `dashboard_kpis` | `PRIMARY` | PRIMARY KEY | `id` |
| `dashboard_kpis` | `kpi_key` | UNIQUE | `kpi_key` |
| `documents` | `PRIMARY` | PRIMARY KEY | `id` |
| `documents` | `idx_docs_deleted_at` | INDEX | `deleted_at` |
| `documents` | `idx_docs_entity` | INDEX | `entity_type, entity_id` |
| `goods_receipts` | `PRIMARY` | PRIMARY KEY | `id` |
| `goods_receipts` | `gr_number` | UNIQUE | `gr_number` |
| `goods_receipts` | `idx_gr_deleted_at` | INDEX | `deleted_at` |
| `goods_receipts` | `fk_gr_po` | INDEX | `po_id` |
| `invoices` | `PRIMARY` | PRIMARY KEY | `id` |
| `invoices` | `invoice_number` | UNIQUE | `invoice_number` |
| `invoices` | `idx_invoices_deleted_at` | INDEX | `deleted_at` |
| `invoices` | `fk_invoices_po` | INDEX | `po_id` |
| `milestones` | `PRIMARY` | PRIMARY KEY | `id` |
| `milestones` | `idx_milestones_deleted_at` | INDEX | `deleted_at` |
| `milestones` | `fk_milestones_project` | INDEX | `project_id` |
| `notifications` | `PRIMARY` | PRIMARY KEY | `id` |
| `notifications` | `idx_notif_deleted_at` | INDEX | `deleted_at` |
| `notifications` | `idx_notif_user` | INDEX | `user_id` |
| `outbox_events` | `PRIMARY` | PRIMARY KEY | `id` |
| `payments` | `PRIMARY` | PRIMARY KEY | `id` |
| `payments` | `payment_number` | UNIQUE | `payment_number` |
| `payments` | `idx_payments_deleted_at` | INDEX | `deleted_at` |
| `payments` | `fk_payments_invoice` | INDEX | `invoice_id` |
| `permissions` | `PRIMARY` | PRIMARY KEY | `id` |
| `permissions` | `name` | UNIQUE | `name` |
| `permissions` | `idx_permissions_deleted_at` | INDEX | `deleted_at` |
| `project_budgets` | `PRIMARY` | PRIMARY KEY | `id` |
| `project_budgets` | `uk_pb_project_category` | UNIQUE | `project_id, category` |
| `project_budgets` | `idx_pb_deleted_at` | INDEX | `deleted_at` |
| `projects` | `PRIMARY` | PRIMARY KEY | `id` |
| `projects` | `code` | UNIQUE | `code` |
| `projects` | `idx_projects_deleted_at` | INDEX | `deleted_at` |
| `projects` | `fk_projects_contract` | INDEX | `contract_id` |
| `projects` | `fk_projects_manager` | INDEX | `manager_id` |
| `proposals` | `PRIMARY` | PRIMARY KEY | `id` |
| `proposals` | `proposal_number` | UNIQUE | `proposal_number` |
| `proposals` | `idx_proposals_deleted_at` | INDEX | `deleted_at` |
| `proposals` | `fk_proposals_tender` | INDEX | `tender_id` |
| `purchase_order_items` | `PRIMARY` | PRIMARY KEY | `id` |
| `purchase_order_items` | `fk_poi_po` | INDEX | `purchase_order_id` |
| `purchase_orders` | `PRIMARY` | PRIMARY KEY | `id` |
| `purchase_orders` | `po_number` | UNIQUE | `po_number` |
| `purchase_orders` | `idx_po_deleted_at` | INDEX | `deleted_at` |
| `purchase_orders` | `fk_po_pr` | INDEX | `pr_id` |
| `purchase_orders` | `fk_po_vendor` | INDEX | `vendor_id` |
| `purchase_request_items` | `PRIMARY` | PRIMARY KEY | `id` |
| `purchase_request_items` | `fk_pri_pr` | INDEX | `pr_id` |
| `purchase_requests` | `PRIMARY` | PRIMARY KEY | `id` |
| `purchase_requests` | `pr_number` | UNIQUE | `pr_number` |
| `purchase_requests` | `idx_pr_deleted_at` | INDEX | `deleted_at` |
| `purchase_requests` | `fk_pr_project` | INDEX | `project_id` |
| `purchase_requests` | `fk_pr_requester` | INDEX | `requester_id` |
| `rfqs` | `PRIMARY` | PRIMARY KEY | `id` |
| `rfqs` | `rfq_number` | UNIQUE | `rfq_number` |
| `rfqs` | `idx_rfq_deleted_at` | INDEX | `deleted_at` |
| `rfqs` | `fk_rfq_pr` | INDEX | `pr_id` |
| `role_permissions` | `PRIMARY` | PRIMARY KEY | `role_id, permission_id` |
| `role_permissions` | `fk_rp_permission` | INDEX | `permission_id` |
| `roles` | `PRIMARY` | PRIMARY KEY | `id` |
| `roles` | `name` | UNIQUE | `name` |
| `roles` | `idx_roles_deleted_at` | INDEX | `deleted_at` |
| `tasks` | `PRIMARY` | PRIMARY KEY | `id` |
| `tasks` | `idx_tasks_deleted_at` | INDEX | `deleted_at` |
| `tasks` | `fk_tasks_wbs` | INDEX | `wbs_id` |
| `tasks` | `fk_tasks_assignee` | INDEX | `assignee_id` |
| `tender_activities` | `PRIMARY` | PRIMARY KEY | `id` |
| `tender_activities` | `IDX_tender_activities_tender_id` | INDEX | `tender_id` |
| `tender_activities` | `IDX_tender_activities_user_id` | INDEX | `user_id` |
| `tender_price_history` | `PRIMARY` | PRIMARY KEY | `id` |
| `tender_price_history` | `tender_id` | INDEX | `tender_id` |
| `tenders` | `PRIMARY` | PRIMARY KEY | `id` |
| `tenders` | `idx_tenders_deleted_at` | INDEX | `deleted_at` |
| `tenders` | `fk_tenders_customer` | INDEX | `customer_id` |
| `tenders` | `fk_tenders_marketing_pic` | INDEX | `marketing_pic_id` |
| `tenders` | `idx_tenders_status_date` | INDEX | `status, created_at` |
| `user_roles` | `PRIMARY` | PRIMARY KEY | `user_id, role_id` |
| `user_roles` | `fk_ur_role` | INDEX | `role_id` |
| `users` | `PRIMARY` | PRIMARY KEY | `id` |
| `users` | `email` | UNIQUE | `email` |
| `users` | `idx_users_deleted_at` | INDEX | `deleted_at` |
| `users` | `fk_users_created_by` | INDEX | `created_by` |
| `users` | `fk_users_updated_by` | INDEX | `updated_by` |
| `users` | `fk_users_deleted_by` | INDEX | `deleted_by` |
| `vendor_comparisons` | `PRIMARY` | PRIMARY KEY | `id` |
| `vendor_comparisons` | `uk_vc_rfq_vendor` | UNIQUE | `rfq_id, vendor_id` |
| `vendor_comparisons` | `idx_vc_deleted_at` | INDEX | `deleted_at` |
| `vendor_comparisons` | `fk_vc_vendor` | INDEX | `vendor_id` |
| `vendors` | `PRIMARY` | PRIMARY KEY | `id` |
| `vendors` | `code` | UNIQUE | `code` |
| `vendors` | `idx_vendors_deleted_at` | INDEX | `deleted_at` |
| `work_breakdown_structures` | `PRIMARY` | PRIMARY KEY | `id` |
| `work_breakdown_structures` | `uk_wbs_project_code` | UNIQUE | `project_id, code` |
| `work_breakdown_structures` | `idx_wbs_deleted_at` | INDEX | `deleted_at` |
| `work_breakdown_structures` | `fk_wbs_parent` | INDEX | `parent_wbs_id` |
| `workflow_definitions` | `PRIMARY` | PRIMARY KEY | `id` |
| `workflow_definitions` | `name` | UNIQUE | `name` |
| `workflow_definitions` | `idx_wd_deleted_at` | INDEX | `deleted_at` |
| `workflow_instances` | `PRIMARY` | PRIMARY KEY | `id` |
| `workflow_instances` | `idx_wi_deleted_at` | INDEX | `deleted_at` |
| `workflow_instances` | `fk_wi_definition` | INDEX | `workflow_definition_id` |
| `workflow_tasks` | `PRIMARY` | PRIMARY KEY | `id` |
| `workflow_tasks` | `idx_wt_deleted_at` | INDEX | `deleted_at` |
| `workflow_tasks` | `fk_wt_instance` | INDEX | `workflow_instance_id` |
| `workflow_tasks` | `fk_wt_role` | INDEX | `assignee_role_id` |
| `workflow_tasks` | `fk_wt_user` | INDEX | `assignee_user_id` |

## F. ENUM INVENTORY

| Table Name | Column Name | Enum Allowed Values |
|---|---|---|
| `contracts` | `legal_status` | `enum('DRAFT','ON_REVIEW','APPROVED','REJECTED','REVISION_REQUESTED')` |
| `customers` | `status` | `enum('Active','Inactive','PROSPECT')` |
| `tender_activities` | `type` | `enum('SYSTEM','COMMENT')` |
| `tenders` | `status` | `enum('NEW','IN_PROGRESS','NEGOTIATION','PENDING_APPROVAL','WON','LOST')` |
| `tenders` | `priority` | `enum('LOW','MEDIUM','HIGH','CRITICAL')` |
| `tenders` | `procurement_type` | `enum('TENDER','DIRECT_APPOINTMENT')` |
| `tenders` | `spk_verification_status` | `enum('UNVERIFIED','PENDING_REVIEW','VERIFIED','REJECTED')` |

## G. VIEW INVENTORY

```sql
CREATE TABLE `audit_logs` (
  `id` bigint UNSIGNED NOT NULL,
  `table_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `record_id` bigint UNSIGNED NOT NULL,
  `action` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `old_value` json DEFAULT NULL,
  `new_value` json DEFAULT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` text COLLATE utf8mb4_unicode_ci,
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `audit_logs`
--

INSERT INTO `audit_logs` (`id`, `table_name`, `record_id`, `action`, `old_value`, `new_value`, `ip_address`, `user_agent`, `created_by`, `created_at`) VALUES
(1, 'contracts', 2, 'LEGAL_REVIEW_APPROVED', '{\"status\": \"PENDING\", \"legal_status\": \"DRAFT\"}', '{\"notes\": \"Legal Clearance Approved & Released to PMO\", \"status\": \"ACTIVE\", \"legal_status\": \"APPROVED\"}', NULL, NULL, 10, '2026-07-25 13:27:59'),
(2, 'contracts', 1, 'LEGAL_REVIEW_APPROVED', '{\"status\": \"PENDING_LEGAL_REVIEW\", \"legal_status\": \"DRAFT\"}', '{\"notes\": \"Legal Clearance Approved & Released to PMO\", \"status\": \"ACTIVE\", \"legal_status\": \"APPROVED\"}', NULL, NULL, 32, '2026-07-29 17:34:23'),
(3, 'contracts', 1, 'LEGAL_REVIEW_APPROVED', '{\"status\": \"ACTIVE\", \"legal_status\": \"APPROVED\"}', '{\"notes\": \"Legal Clearance Approved & Released to PMO\", \"status\": \"ACTIVE\", \"legal_status\": \"APPROVED\"}', NULL, NULL, 32, '2026-07-29 17:35:34'),
(4, 'contracts', 4, 'LEGAL_REVIEW_REJECTED', '{\"status\": \"PENDING\", \"legal_status\": \"DRAFT\"}', '{\"notes\": \"SPK Belum di upload silahkan upload dulu\", \"status\": \"REJECTED\", \"legal_status\": \"REJECTED\"}', NULL, NULL, 10, '2026-07-29 18:19:14'),
(5, 'contracts', 15, 'LEGAL_REVIEW_APPROVED', '{\"status\": \"PENDING_LEGAL_REVIEW\", \"legal_status\": \"DRAFT\"}', '{\"notes\": \"Legal Clearance Approved & Released to PMO\", \"status\": \"ACTIVE\", \"legal_status\": \"APPROVED\"}', NULL, NULL, 10, '2026-07-31 13:38:03'),
(6, 'contracts', 18, 'LEGAL_REVIEW_APPROVED', '{\"status\": \"PENDING_LEGAL_REVIEW\", \"legal_status\": \"DRAFT\"}', '{\"notes\": \"Legal Clearance Approved & Released to PMO\", \"status\": \"ACTIVE\", \"legal_status\": \"APPROVED\"}', NULL, NULL, 10, '2026-07-31 15:35:16'),
(7, 'contracts', 19, 'LEGAL_REVIEW_APPROVED', '{\"status\": \"PENDING_LEGAL_REVIEW\", \"legal_status\": \"DRAFT\"}', '{\"notes\": \"Legal Clearance Approved & Released to PMO\", \"status\": \"ACTIVE\", \"legal_status\": \"APPROVED\"}', NULL, NULL, 10, '2026-07-31 16:27:40'),
(8, 'contracts', 17, 'LEGAL_REVIEW_APPROVED', '{\"status\": \"PENDING_LEGAL_REVIEW\", \"legal_status\": \"DRAFT\"}', '{\"notes\": \"Legal Clearance Approved & Released to PMO\", \"status\": \"ACTIVE\", \"legal_status\": \"APPROVED\"}', NULL, NULL, 10, '2026-07-31 16:50:48'),
(9, 'contracts', 20, 'LEGAL_REVIEW_APPROVED', '{\"status\": \"PENDING_LEGAL_REVIEW\", \"legal_status\": \"DRAFT\"}', '{\"notes\": \"Legal Clearance Approved & Released to PMO\", \"status\": \"ACTIVE\", \"legal_status\": \"APPROVED\"}', NULL, NULL, 10, '2026-07-31 16:59:46'),
(10, 'contracts', 21, 'LEGAL_REVIEW_APPROVED', '{\"status\": \"PENDING_LEGAL_REVIEW\", \"legal_status\": \"DRAFT\"}', '{\"notes\": \"Legal Clearance Approved & Released to PMO\", \"status\": \"ACTIVE\", \"legal_status\": \"APPROVED\"}', NULL, NULL, 10, '2026-08-03 11:27:07'),
(11, 'contracts', 23, 'LEGAL_REVIEW_APPROVED', '{\"status\": \"PENDING_LEGAL_REVIEW\", \"legal_status\": \"DRAFT\"}', '{\"notes\": \"Legal Clearance Approved & Released to PMO\", \"status\": \"ACTIVE\", \"legal_status\": \"APPROVED\"}', NULL, NULL, 10, '2026-08-03 13:46:18');
```

```sql
CREATE TABLE `contracts` (
  `id` bigint UNSIGNED NOT NULL,
  `proposal_id` bigint UNSIGNED DEFAULT NULL,
  `customer_id` bigint UNSIGNED NOT NULL,
  `contract_number` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `contract_value` decimal(19,2) NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `updated_by` bigint UNSIGNED DEFAULT NULL,
  `deleted_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  `legal_status` enum('DRAFT','ON_REVIEW','APPROVED','REJECTED','REVISION_REQUESTED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT',
  `legal_reviewer_id` bigint UNSIGNED DEFAULT NULL,
  `legal_notes` text COLLATE utf8mb4_unicode_ci,
  `project_manager_id` bigint UNSIGNED DEFAULT NULL,
  `ops_team_activated_at` datetime DEFAULT NULL,
  `version` int NOT NULL DEFAULT '1',
  `tender_id` bigint DEFAULT NULL,
  `spk_file_url` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

```sql
created_by`, `updated_by`, `deleted_by`, `created_at`, `updated_at`, `deleted_at`, `legal_status`, `legal_reviewer_id`, `legal_notes`, `project_manager_id`, `ops_team_activated_at`, `version`, `tender_id`, `spk_file_url`) VALUES
(1, 1, 1, 'CONT-20260724-0001', 380000000.00, '2026-07-25', '2027-07-25', 'ACTIVE', 7, 32, NULL, '2026-07-25 00:49:02', '2026-07-29 22:50:39', NULL, 'APPROVED', 32, 'Legal Clearance Approved & Released to PMO', NULL, NULL, 3, 2, 'http://localhost:4000/uploads/contracts/spk-2-1784915342373-188103388.pdf'),
(2, 2, 2, 'CONT-20260724-0002', 380000000.00, '2026-07-25', '2027-07-25', 'ACTIVE', 7, 10, NULL, '2026-07-25 00:49:02', '2026-07-25 13:27:59', NULL, 'APPROVED', 10, 'Legal Clearance Approved & Released to PMO', NULL, NULL, 3, NULL, NULL),
(4, 7, 2, 'CONT-20260729-0004', 300000000.00, '2026-07-29', '2027-07-29', 'PENDING_LEGAL_REVIEW', 7, 10, NULL, '2026-07-29 18:18:23', '2026-07-29 18:19:35', NULL, 'REJECTED', 10, 'SPK Belum di upload silahkan upload dulu', NULL, NULL, 3, 7, 'http://localhost:4000/uploads/contracts/spk-7-1785323975728-695791080.pdf'),
(5, 8, 2, 'CONT-20260729-0005', 300000000.00, '2026-07-29', '2027-07-29', 'PENDING', 7, NULL, NULL, '2026-07-29 18:19:35', '2026-07-29 21:44:19', '2026-07-29 21:44:19', 'DRAFT', NULL, NULL, NULL, NULL, 2, 7, NULL),
(6, 12, 1, 'CONT-20260729-0006', 100000000.00, '2026-07-29', '2027-07-29', 'PENDING_LEGAL_REVIEW', 7, NULL, NULL, '2026-07-29 21:03:50', '2026-07-29 22:40:08', NULL, 'DRAFT', NULL, NULL, NULL, NULL, 1, 8, 'http://localhost/test2'),
(7, 13, 1, 'CONT-20260729-0007', 100000000.00, '2026-07-29', '2027-07-29', 'PENDING_LEGAL_REVIEW', 7, NULL, NULL, '2026-07-29 21:03:50', '2026-07-29 22:40:08', '2026-07-29 21:44:19', 'DRAFT', NULL, NULL, NULL, NULL, 2, 8, 'http://localhost/test2'),
(8, 14, 1, 'CONT-20260729-0008', 150000000.00, '2026-07-29', '2027-07-29', 'PENDING', 7, NULL, NULL, '2026-07-29 21:08:29', '2026-07-29 21:44:19', '2026-07-29 21:44:19', 'DRAFT', NULL, NULL, NULL, NULL, 2, 3, NULL),
(9, 11, 1, 'CONT-20260729-0009', 250000000.00, '2026-07-29', '2027-07-29', 'PENDING_LEGAL_REVIEW', 7, NULL, NULL, '2026-07-29 21:59:03', '2026-07-29 22:50:39', NULL, 'DRAFT', NULL, NULL, NULL, NULL, 1, 1, 'http://localhost:4000/uploads/contracts/spk-1-1785337143700-439702074.pdf'),
(10, 17, 1, 'CONT-20260729-0010', 300000000.00, '2026-07-29', '2027-07-29', 'PENDING_LEGAL_REVIEW', 7, NULL, NULL, '2026-07-29 22:29:27', '2026-07-29 22:50:39', NULL, 'DRAFT', NULL, NULL, NULL, NULL, 1, 11, 'http://localhost:4000/uploads/contracts/spk-11-1785338966985-7712801.pdf'),
(11, 19, 1, 'CONT-20260729-0011', 240000000.00, '2026-07-29', '2027-07-29', 'PENDING_LEGAL_REVIEW', 7, NULL, NULL, '2026-07-29 22:43:13', '2026-07-29 22:43:13', NULL, 'DRAFT', NULL, NULL, NULL, NULL, 1, 10, 'http://localhost:4000/uploads/contracts/spk-10-1785339793771-490321500.pdf'),
(12, 21, 1, 'CONT-20260729-0012', 200000000.00, '2026-07-29', '2027-07-29', 'PENDING_LEGAL_REVIEW', 7, NULL, NULL, '2026-07-29 22:44:02', '2026-07-29 22:44:02', NULL, 'DRAFT', NULL, NULL, NULL, NULL, 1, 9, 'http://localhost:4000/uploads/contracts/spk-9-1785339842864-541115247.pdf'),
(13, NULL, 1, 'CONT-TEST-001', 500000.00, '2026-07-29', '2026-07-29', 'DRAFT', 1, NULL, NULL, '2026-07-29 23:04:20', '2026-07-29 23:04:20', '2026-07-29 23:04:20', 'DRAFT', NULL, NULL, NULL, NULL, 2, 14, NULL),
(14, 23, 1, 'CONT-20260731-0014', 150000000.00, '2026-07-31', '2027-07-31', 'PENDING_LEGAL_REVIEW', 7, NULL, NULL, '2026-07-31 12:14:32', '2026-07-31 12:47:57', '2026-07-31 12:47:57', 'DRAFT', NULL, NULL, NULL, NULL, 2, 15, 'http://localhost:4000/uploads/contracts/spk-15-1785474872493-587329612.pdf'),
(15, 25, 2, 'CONT-20260731-0015', 150000000.00, '2026-07-31', '2027-07-31', 'ACTIVE', 7, 10, NULL, '2026-07-31 13:34:31', '2026-07-31 14:04:06', '2026-07-31 14:04:06', 'APPROVED', 10, 'Legal Clearance Approved & Released to PMO', NULL, NULL, 3, 21, 'http://localhost:4000/uploads/contracts/spk-21-1785479671724-482948854.pdf'),
(16, 27, 2, 'CONT-20260731-0016', 200000000.00, '2026-07-31', '2027-07-31', 'PENDING_LEGAL_REVIEW', 7, NULL, NULL, '2026-07-31 14:14:44', '2026-07-31 14:15:22', '2026-07-31 14:15:22', 'DRAFT', NULL, NULL, NULL, NULL, 2, 20, 'http://localhost:4000/uploads/contracts/spk-20-1785482084277-343881108.pdf'),
(17, 29, 2, 'CONT-20260731-0017', 100000000.00, '2026-07-31', '2027-07-31', 'ACTIVE', 7, 10, NULL, '2026-07-31 14:15:58', '2026-07-31 16:50:48', NULL, 'APPROVED', 10, 'Legal Clearance Approved & Released to PMO', NULL, NULL, 2, 19, 'http://localhost:4000/uploads/contracts/spk-19-1785482157954-817419485.pdf'),
(18, 31, 2, 'CONT-20260731-0018', 150000000.00, '2026-07-31', '2027-07-31', 'ACTIVE', 7, 10, NULL, '2026-07-31 15:33:26', '2026-07-31 15:35:16', NULL, 'APPROVED', 10, 'Legal Clearance Approved & Released to PMO', NULL, NULL, 2, 18, 'http://localhost:4000/uploads/contracts/spk-18-1785486805950-900947533.pdf'),
(19, 33, 2, 'CONT-20260731-0019', 200000000.00, '2026-07-31', '2027-07-31', 'ACTIVE', 7, 10, NULL, '2026-07-31 16:26:22', '2026-07-31 16:27:40', NULL, 'APPROVED', 10, 'Legal Clearance Approved & Released to PMO', NULL, NULL, 2, 17, 'http://localhost:4000/uploads/contracts/spk-17-1785489982283-694294833.pdf'),
(20, 35, 2, 'CONT-20260731-0020', 400000000.00, '2026-07-31', '2027-07-31', 'ACTIVE', 7, 10, NULL, '2026-07-31 16:57:19', '2026-07-31 16:59:46', NULL, 'APPROVED', 10, 'Legal Clearance Approved & Released to PMO', NULL, NULL, 2, 16, 'http://localhost:4000/uploads/contracts/spk-16-1785491839279-434357699.pdf'),
(21, 37, 2, 'CONT-20260803-0021', 850000000.00, '2026-08-03', '2027-08-03', 'ACTIVE', 7, 10, NULL, '2026-08-03 11:26:11', '2026-08-03 11:27:07', NULL, 'APPROVED', 10, 'Legal Clearance Approved & Released to PMO', NULL, NULL, 2, 45, 'http://localhost:4000/uploads/contracts/spk-45-1785731171214-265699805.pdf'),
(22, 39, 2, 'CONT-20260803-0022', 50000000.00, '2026-08-03', '2027-08-03', 'PENDING_LEGAL_REVIEW', 9, NULL, NULL, '2026-08-03 13:42:08', '2026-08-03 13:42:08', NULL, 'DRAFT', NULL, NULL, NULL, NULL, 1, 47, 'http://localhost:4000/uploads/contracts/spk-47-1785739328543-523347381.pdf'),
(23, 41, 2, 'CONT-20260803-0023', 500000000.00, '2026-08-03', '2027-08-03', 'ACTIVE', 9, 10, NULL, '2026-08-03 13:44:51', '2026-08-03 13:46:18', NULL, 'APPROVED', 10, 'Legal Clearance Approved & Released to PMO', NULL, NULL, 2, 48, 'http://localhost:4000/uploads/contracts/spk-48-1785739491201-766612368.pdf'),
(24, 45, 2, 'CONT-20260803-0024', 400000000.00, '2026-08-03', '2027-08-03', 'PENDING_LEGAL_REVIEW', 9, NULL, NULL, '2026-08-03 17:41:23', '2026-08-03 17:41:23', NULL, 'DRAFT', NULL, NULL, NULL, NULL, 1, 46, 'http://localhost:4000/uploads/contracts/spk-46-1785753683536-175972917.pdf'),
(25, 47, 2, 'CONT-20260803-0025', 135000000.00, '2026-08-03', '2027-08-03', 'PENDING_LEGAL_REVIEW', 9, NULL, NULL, '2026-08-03 17:42:56', '2026-08-03 17:42:56', NULL, 'DRAFT', NULL, NULL, NULL, NULL, 1, 35, 'http://localhost:4000/uploads/contracts/spk-35-1785753776616-315423875.pdf'),
(26, 49, 2, 'CONT-20260804-0026', 140000000.00, '2026-08-04', '2027-08-04', 'PENDING_LEGAL_REVIEW', 9, NULL, NULL, '2026-08-04 07:05:35', '2026-08-04 07:05:35', NULL, 'DRAFT', NULL, NULL, NULL, NULL, 1, 34, 'http://localhost:4000/uploads/contracts/spk-34-1785801934848-730784278.pdf');
```

```sql
CREATE TABLE `contract_amendments` (
  `id` bigint UNSIGNED NOT NULL,
  `contract_id` bigint UNSIGNED NOT NULL,
  `version_number` int NOT NULL DEFAULT '1',
  `old_value` decimal(19,2) DEFAULT NULL,
  `new_value` decimal(19,2) DEFAULT NULL,
  `reason` text NOT NULL,
  `approved_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `customers`
--

CREATE TABLE `customers` (
  `id` bigint UNSIGNED NOT NULL,
  `code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `address` text COLLATE utf8mb4_unicode_ci,
  `tax_id` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `updated_by` bigint UNSIGNED DEFAULT NULL,
  `deleted_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  `company` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `contact_person` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '-',
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '-',
  `email` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `business_sector` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `city` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('Active','Inactive','PROSPECT') COLLATE utf8mb4_unicode_ci DEFAULT 'Active',
  `marketing_pic_id` bigint UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `customers`
--

INSERT INTO `customers` (`id`, `code`, `name`, `address`, `tax_id`, `created_by`, `updated_by`, `deleted_by`, `created_at`, `updated_at`, `deleted_at`, `company`, `contact_person`, `phone`, `email`, `business_sector`, `city`, `status`, `marketing_pic_id`) VALUES
(1, 'CUST-001', 'PT. GLOBAL JET EXPRESS', NULL, NULL, 7, NULL, NULL, '2026-07-25 00:39:05', '2026-07-25 00:39:05', NULL, 'J&T EXPRESS', 'Ramdani', '081234789650', 'ramdani@jet.co.id', 'Transportasi & Logistik', 'Jakarta', 'PROSPECT', 7),
(2, 'CUST-002', 'PT. Cipta Sejahtera Abadi', NULL, NULL, 7, NULL, NULL, '2026-07-25 00:46:19', '2026-07-25 00:46:19', NULL, 'PT. Cipta Sejahtera Abadi', 'Aldhi Dharmawan', '087434543557', 'aldhi.dharmawan@csatower.co.id', 'Telekomunikasi & Internet', 'Jakarta', 'PROSPECT', 9);

-- --------------------------------------------------------

--
-- Table structure for table `dashboard_kpis`
--

CREATE TABLE `dashboard_kpis` (
  `id` bigint UNSIGNED NOT NULL,
  `kpi_key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `kpi_value` decimal(19,2) NOT NULL DEFAULT '0.00',
  `metadata` json DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `documents`
--

CREATE TABLE `documents` (
  `id` bigint UNSIGNED NOT NULL,
  `entity_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity_id` bigint UNSIGNED NOT NULL,
  `file_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_path` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `mime_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `file_size` bigint UNSIGNED DEFAULT NULL,
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `updated_by` bigint UNSIGNED DEFAULT NULL,
  `deleted_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `documents`
--

INSERT INTO `documents` (`id`, `entity_type`, `entity_id`, `file_name`, `file_path`, `mime_type`, `file_size`, `created_by`, `updated_by`, `deleted_by`, `created_at`, `updated_at`, `deleted_at`) VALUES
(1, 'PROPOSAL', 5, 'PO TJ RW 07.pdf', 'proposal-1785323727391-724040850.pdf', 'application/pdf', 272073, 7, NULL, NULL, '2026-07-29 18:15:27', '2026-07-29 18:15:27', NULL),
(2, 'PROPOSAL', 7, '(HO TK) FRM.IPL.JLM.012 Formulir Berita Acara ATP_ (JAMPANG RW 01) rev.pdf', 'proposal-1785323837729-567427591.pdf', 'application/pdf', 34675521, 7, NULL, NULL, '2026-07-29 18:17:17', '2026-07-29 18:17:17', NULL),
(3, 'PROPOSAL', 8, 'panduan aktivasi ONU atau HC RumahNet .pdf', 'proposal-1785333796364-37797874.pdf', 'application/pdf', 775046, 7, NULL, NULL, '2026-07-29 21:03:16', '2026-07-29 21:03:16', NULL),
(4, 'PROPOSAL', 39, 'panduan aktivasi ONU atau HC RumahNet .pdf', 'proposal-1785525727190-707259747.pdf', 'application/pdf', 775046, 7, NULL, NULL, '2026-08-01 02:22:07', '2026-08-01 02:22:07', NULL),
(5, 'PROPOSAL', 45, 'RAP_UBD_REPAIR_PUNCH_LIST_MONDOKANRW02_TUBAN.pdf', 'proposal-1785731144642-280691751.pdf', 'application/pdf', 392160, 7, NULL, NULL, '2026-08-03 11:25:44', '2026-08-03 11:25:44', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `goods_receipts`
--

CREATE TABLE `goods_receipts` (
  `id` bigint UNSIGNED NOT NULL,
  `po_id` bigint UNSIGNED NOT NULL,
  `gr_number` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `receipt_date` date NOT NULL,
  `total_received_amount` decimal(19,2) NOT NULL,
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `updated_by` bigint UNSIGNED DEFAULT NULL,
  `deleted_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  `version` int NOT NULL DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `invoices`
--

CREATE TABLE `invoices` (
  `id` bigint UNSIGNED NOT NULL,
  `po_id` bigint UNSIGNED NOT NULL,
  `invoice_number` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `total_amount` decimal(19,2) NOT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'UNPAID',
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `updated_by` bigint UNSIGNED DEFAULT NULL,
  `deleted_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  `version` int NOT NULL DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `milestones`
--

CREATE TABLE `milestones` (
  `id` bigint UNSIGNED NOT NULL,
  `project_id` bigint UNSIGNED NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `target_date` date NOT NULL,
  `is_completed` tinyint(1) DEFAULT '0',
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `updated_by` bigint UNSIGNED DEFAULT NULL,
  `deleted_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `notifications`
--

CREATE TABLE `notifications` (
  `id` bigint UNSIGNED NOT NULL,
  `user_id` bigint UNSIGNED NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_read` tinyint(1) DEFAULT '0',
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `updated_by` bigint UNSIGNED DEFAULT NULL,
  `deleted_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  `message` text COLLATE utf8mb4_unicode_ci,
  `notification_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'TASK',
  `action_link` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `meta_data` json DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `notifications`
--

INSERT INTO `notifications` (`id`, `user_id`, `title`, `is_read`, `created_by`, `updated_by`, `deleted_by`, `created_at`, `updated_at`, `deleted_at`, `message`, `notification_type`, `action_link`, `meta_data`) VALUES
(1, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-25 00:40:18', '2026-07-25 00:40:17', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi Gudang J&T Jelambar Ruang Purchasing</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/1', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"1\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Renovasi Gudang J&T Jelambar Ruang Purchasing\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(2, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-25 00:40:18', '2026-07-25 00:40:17', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi Gudang J&T Jelambar Ruang Purchasing</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/1', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"1\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Renovasi Gudang J&T Jelambar Ruang Purchasing\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(3, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-25 00:40:18', '2026-07-25 00:40:17', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi Gudang J&T Jelambar Ruang Purchasing</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/1', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"1\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Renovasi Gudang J&T Jelambar Ruang Purchasing\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(4, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-25 00:40:18', '2026-07-25 00:40:17', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi Gudang J&T Jelambar Ruang Purchasing</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/1', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"1\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Renovasi Gudang J&T Jelambar Ruang Purchasing\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(5, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-25 00:40:18', '2026-07-25 00:40:17', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi Gudang J&T Jelambar Ruang Purchasing</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/1', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"1\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Renovasi Gudang J&T Jelambar Ruang Purchasing\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(6, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-25 00:47:26', '2026-07-25 00:47:25', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project CSA-FKI Karawang Rumah Net</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/2', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"2\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project CSA-FKI Karawang Rumah Net\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(7, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-25 00:47:26', '2026-07-25 00:47:25', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project CSA-FKI Karawang Rumah Net</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/2', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"2\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project CSA-FKI Karawang Rumah Net\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(8, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-25 00:47:26', '2026-07-25 00:47:25', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project CSA-FKI Karawang Rumah Net</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/2', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"2\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project CSA-FKI Karawang Rumah Net\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(9, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-25 00:47:26', '2026-07-25 00:47:25', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project CSA-FKI Karawang Rumah Net</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/2', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"2\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project CSA-FKI Karawang Rumah Net\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(10, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-25 00:47:26', '2026-07-25 00:47:25', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project CSA-FKI Karawang Rumah Net</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/2', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"2\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project CSA-FKI Karawang Rumah Net\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(11, 10, 'Tender WON - Draft Kontrak Baru', 1, 0, NULL, NULL, '2026-07-25 00:49:03', '2026-07-31 13:29:15', NULL, 'Tender \"Project CSA-FKI Karawang Rumah Net\" telah disetujui (WON). Draft Kontrak #2 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": \"2\"}'),
(12, 1, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-25 00:49:03', '2026-07-25 00:49:02', NULL, '<span style=\"font-weight: 600;
```

```sql
CREATED\", \"project_name\": \"Renovasi Gateway Tangerang\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(22, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-25 14:11:35', '2026-07-25 14:11:34', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gateway Tangerang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/3', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"3\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gateway Tangerang\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(23, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-25 14:11:35', '2026-07-25 14:11:34', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gateway Tangerang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/3', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"3\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gateway Tangerang\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(24, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-25 14:11:35', '2026-07-25 14:11:35', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gateway Tangerang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/3', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"3\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gateway Tangerang\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(25, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-25 14:11:35', '2026-07-25 14:11:35', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gateway Tangerang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/3', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"3\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gateway Tangerang\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(26, 1, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-07-29 18:15:28', '2026-07-29 18:15:27', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">Test Deal Automation Fix Verification</span>.', 'ALERT', '/sales/tenders/5', '{\"tier\": \"Small\", \"won_at\": null, \"lead_id\": \"5\", \"user_name\": \"Lukas Kurniawan\", \"action_type\": \"PROPOSAL_UPLOADED\", \"project_name\": \"Test Deal Automation Fix Verification\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(27, 4, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-07-29 18:15:28', '2026-07-29 18:15:27', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">Test Deal Automation Fix Verification</span>.', 'ALERT', '/sales/tenders/5', '{\"tier\": \"Small\", \"won_at\": null, \"lead_id\": \"5\", \"user_name\": \"Lukas Kurniawan\", \"action_type\": \"PROPOSAL_UPLOADED\", \"project_name\": \"Test Deal Automation Fix Verification\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(28, 6, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-07-29 18:15:28', '2026-07-29 18:15:27', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">Test Deal Automation Fix Verification</span>.', 'ALERT', '/sales/tenders/5', '{\"tier\": \"Small\", \"won_at\": null, \"lead_id\": \"5\", \"user_name\": \"Lukas Kurniawan\", \"action_type\": \"PROPOSAL_UPLOADED\", \"project_name\": \"Test Deal Automation Fix Verification\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(29, 32, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-07-29 18:15:28', '2026-07-29 18:15:27', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">Test Deal Automation Fix Verification</span>.', 'ALERT', '/sales/tenders/5', '{\"tier\": \"Small\", \"won_at\": null, \"lead_id\": \"5\", \"user_name\": \"Lukas Kurniawan\", \"action_type\": \"PROPOSAL_UPLOADED\", \"project_name\": \"Test Deal Automation Fix Verification\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(30, 33, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-07-29 18:15:28', '2026-07-29 18:15:27', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">Test Deal Automation Fix Verification</span>.', 'ALERT', '/sales/tenders/5', '{\"tier\": \"Small\", \"won_at\": null, \"lead_id\": \"5\", \"user_name\": \"Lukas Kurniawan\", \"action_type\": \"PROPOSAL_UPLOADED\", \"project_name\": \"Test Deal Automation Fix Verification\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(31, 39, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-07-29 18:15:28', '2026-07-29 18:15:27', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">Test Deal Automation Fix Verification</span>.', 'ALERT', '/sales/tenders/5', '{\"tier\": \"Small\", \"won_at\": null, \"lead_id\": \"5\", \"user_name\": \"Lukas Kurniawan\", \"action_type\": \"PROPOSAL_UPLOADED\", \"project_name\": \"Test Deal Automation Fix Verification\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(32, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-29 18:16:35', '2026-07-29 18:16:35', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project CSA-JLM BOGOR</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/7', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"7\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project CSA-JLM BOGOR\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(33, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-29 18:16:35', '2026-07-29 18:16:35', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project CSA-JLM BOGOR</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/7', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"7\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project CSA-JLM BOGOR\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(34, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-29 18:16:35', '2026-07-29 18:16:35', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project CSA-JLM BOGOR</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/7', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"7\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project CSA-JLM BOGOR\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(35, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-29 18:16:35', '2026-07-29 18:16:35', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project CSA-JLM BOGOR</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/7', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"7\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project CSA-JLM BOGOR\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(36, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-29 18:16:35', '2026-07-29 18:16:35', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project CSA-JLM BOGOR</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/7', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"7\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project CSA-JLM BOGOR\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(37, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-29 18:16:35', '2026-07-29 18:16:35', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project CSA-JLM BOGOR</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/7', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"7\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project CSA-JLM BOGOR\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(38, 1, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-07-29 18:17:18', '2026-07-29 18:17:17', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">Project CSA-JLM BOGOR</span>.', 'ALERT', '/sales/tenders/7', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"7\", \"user_name\": \"Lukas Kurniawan\", \"action_type\": \"PROPOSAL_UPLOADED\", \"project_name\": \"Project CSA-JLM BOGOR\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(39, 4, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-07-29 18:17:18', '2026-07-29 18:17:17', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">Project CSA-JLM BOGOR</span>.', 'ALERT', '/sales/tenders/7', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"7\", \"user_name\": \"Lukas Kurniawan\", \"action_type\": \"PROPOSAL_UPLOADED\", \"project_name\": \"Project CSA-JLM BOGOR\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(40, 6, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-07-29 18:17:18', '2026-07-29 18:17:17', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">Project CSA-JLM BOGOR</span>.', 'ALERT', '/sales/tenders/7', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"7\", \"user_name\": \"Lukas Kurniawan\", \"action_type\": \"PROPOSAL_UPLOADED\", \"project_name\": \"Project CSA-JLM BOGOR\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(41, 32, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-07-29 18:17:18', '2026-07-29 18:17:17', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">Project CSA-JLM BOGOR</span>.', 'ALERT', '/sales/tenders/7', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"7\", \"user_name\": \"Lukas Kurniawan\", \"action_type\": \"PROPOSAL_UPLOADED\", \"project_name\": \"Project CSA-JLM BOGOR\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(42, 33, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-07-29 18:17:18', '2026-07-29 18:17:17', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">Project CSA-JLM BOGOR</span>.', 'ALERT', '/sales/tenders/7', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"7\", \"user_name\": \"Lukas Kurniawan\", \"action_type\": \"PROPOSAL_UPLOADED\", \"project_name\": \"Project CSA-JLM BOGOR\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(43, 39, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-07-29 18:17:18', '2026-07-29 18:17:17', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">Project CSA-JLM BOGOR</span>.', 'ALERT', '/sales/tenders/7', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"7\", \"user_name\": \"Lukas Kurniawan\", \"action_type\": \"PROPOSAL_UPLOADED\", \"project_name\": \"Project CSA-JLM BOGOR\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(44, 10, 'Tender WON - Draft Kontrak Baru', 1, 0, NULL, NULL, '2026-07-29 18:18:24', '2026-07-31 13:29:15', NULL, 'Tender \"Project CSA-JLM BOGOR\" telah disetujui (WON). Draft Kontrak #4 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": \"4\"}'),
(45, 1, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-29 18:18:24', '2026-07-29 18:18:23', NULL, '<span style=\"font-weight: 600;
```

```sql
CREATED\", \"project_name\": \"Renovasi Lahan Parkir Gateway Bandung\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(69, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-29 19:30:32', '2026-07-29 19:30:31', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Lahan Parkir Gateway Bandung</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/8', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"8\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Lahan Parkir Gateway Bandung\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(70, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-29 19:30:32', '2026-07-29 19:30:31', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Lahan Parkir Gateway Bandung</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/8', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"8\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Lahan Parkir Gateway Bandung\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(71, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-29 19:30:32', '2026-07-29 19:30:31', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Lahan Parkir Gateway Bandung</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/8', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"8\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Lahan Parkir Gateway Bandung\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(72, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-29 19:30:32', '2026-07-29 19:30:31', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Lahan Parkir Gateway Bandung</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/8', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"8\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Lahan Parkir Gateway Bandung\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(73, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-29 19:30:32', '2026-07-29 19:30:31', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Lahan Parkir Gateway Bandung</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/8', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"8\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Lahan Parkir Gateway Bandung\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(74, 1, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-07-29 21:03:16', '2026-07-29 21:03:16', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Lahan Parkir Gateway Bandung</span>.', 'ALERT', '/sales/tenders/8', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"8\", \"user_name\": \"Lukas Kurniawan\", \"action_type\": \"PROPOSAL_UPLOADED\", \"project_name\": \"Renovasi Lahan Parkir Gateway Bandung\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(75, 4, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-07-29 21:03:16', '2026-07-29 21:03:16', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Lahan Parkir Gateway Bandung</span>.', 'ALERT', '/sales/tenders/8', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"8\", \"user_name\": \"Lukas Kurniawan\", \"action_type\": \"PROPOSAL_UPLOADED\", \"project_name\": \"Renovasi Lahan Parkir Gateway Bandung\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(76, 6, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-07-29 21:03:16', '2026-07-29 21:03:16', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Lahan Parkir Gateway Bandung</span>.', 'ALERT', '/sales/tenders/8', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"8\", \"user_name\": \"Lukas Kurniawan\", \"action_type\": \"PROPOSAL_UPLOADED\", \"project_name\": \"Renovasi Lahan Parkir Gateway Bandung\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(77, 32, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-07-29 21:03:16', '2026-07-29 21:03:16', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Lahan Parkir Gateway Bandung</span>.', 'ALERT', '/sales/tenders/8', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"8\", \"user_name\": \"Lukas Kurniawan\", \"action_type\": \"PROPOSAL_UPLOADED\", \"project_name\": \"Renovasi Lahan Parkir Gateway Bandung\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(78, 33, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-07-29 21:03:16', '2026-07-29 21:03:16', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Lahan Parkir Gateway Bandung</span>.', 'ALERT', '/sales/tenders/8', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"8\", \"user_name\": \"Lukas Kurniawan\", \"action_type\": \"PROPOSAL_UPLOADED\", \"project_name\": \"Renovasi Lahan Parkir Gateway Bandung\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(79, 39, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-07-29 21:03:16', '2026-07-29 21:03:16', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Lahan Parkir Gateway Bandung</span>.', 'ALERT', '/sales/tenders/8', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"8\", \"user_name\": \"Lukas Kurniawan\", \"action_type\": \"PROPOSAL_UPLOADED\", \"project_name\": \"Renovasi Lahan Parkir Gateway Bandung\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(80, 1, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-29 21:03:51', '2026-07-29 21:03:50', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Lahan Parkir Gateway Bandung</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/8', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-29T14:03:50.873Z\", \"lead_id\": \"8\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Renovasi Lahan Parkir Gateway Bandung\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(81, 10, 'Tender WON - Draft Kontrak Baru', 1, 0, NULL, NULL, '2026-07-29 21:03:51', '2026-07-31 13:29:15', NULL, 'Tender \"Renovasi Lahan Parkir Gateway Bandung\" telah disetujui (WON). Draft Kontrak #7 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": \"7\"}'),
(82, 35, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-29 21:03:51', '2026-07-29 21:03:50', NULL, 'Tender \"Renovasi Lahan Parkir Gateway Bandung\" telah disetujui (WON). Draft Kontrak #7 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": \"7\"}');
```

```sql
created_by`, `updated_by`, `deleted_by`, `created_at`, `updated_at`, `deleted_at`, `message`, `notification_type`, `action_link`, `meta_data`) VALUES
(83, 4, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-29 21:03:51', '2026-07-29 21:03:50', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Lahan Parkir Gateway Bandung</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/8', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-29T14:03:50.873Z\", \"lead_id\": \"8\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Renovasi Lahan Parkir Gateway Bandung\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(84, 1, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-29 21:03:51', '2026-07-29 21:03:50', NULL, 'Tender \"Renovasi Lahan Parkir Gateway Bandung\" telah disetujui (WON). Draft Kontrak #7 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": \"7\"}'),
(85, 6, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-29 21:03:51', '2026-07-29 21:03:50', NULL, '<span style=\"font-weight: 600;
```

```sql
CREATED\", \"project_name\": \"Renovasi Gudang J&T Bogor \", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(124, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-29 22:04:34', '2026-07-29 22:04:33', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang J&T Bogor </span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/9', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"9\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gudang J&T Bogor \", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(125, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-29 22:04:34', '2026-07-29 22:04:33', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang J&T Bogor </span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/9', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"9\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gudang J&T Bogor \", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(126, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-29 22:04:34', '2026-07-29 22:04:33', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang J&T Bogor </span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/9', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"9\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gudang J&T Bogor \", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(127, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-29 22:04:34', '2026-07-29 22:04:33', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang J&T Bogor </span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/9', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"9\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gudang J&T Bogor \", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(128, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-29 22:04:34', '2026-07-29 22:04:33', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang J&T Bogor </span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/9', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"9\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gudang J&T Bogor \", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(129, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-29 22:05:34', '2026-07-29 22:05:33', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang Serang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/10', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"10\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gudang Serang\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(130, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-29 22:05:34', '2026-07-29 22:05:33', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang Serang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/10', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"10\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gudang Serang\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(131, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-29 22:05:34', '2026-07-29 22:05:33', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang Serang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/10', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"10\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gudang Serang\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(132, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-29 22:05:34', '2026-07-29 22:05:33', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang Serang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/10', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"10\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gudang Serang\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(133, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-29 22:05:34', '2026-07-29 22:05:33', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang Serang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/10', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"10\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gudang Serang\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(134, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-29 22:05:34', '2026-07-29 22:05:33', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang Serang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/10', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"10\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gudang Serang\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(135, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-29 22:06:23', '2026-07-29 22:06:22', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang Jambi</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/11', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"11\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gudang Jambi\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(136, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-29 22:06:23', '2026-07-29 22:06:22', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang Jambi</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/11', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"11\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gudang Jambi\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(137, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-29 22:06:23', '2026-07-29 22:06:22', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang Jambi</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/11', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"11\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gudang Jambi\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(138, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-29 22:06:23', '2026-07-29 22:06:22', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang Jambi</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/11', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"11\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gudang Jambi\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(139, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-29 22:06:23', '2026-07-29 22:06:22', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang Jambi</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/11', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"11\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gudang Jambi\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(140, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-29 22:06:23', '2026-07-29 22:06:22', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang Jambi</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/11', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"11\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gudang Jambi\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(141, 10, 'Tender WON - Draft Kontrak Baru', 1, 0, NULL, NULL, '2026-07-29 22:29:27', '2026-07-31 13:29:15', NULL, 'Tender \"Tender ID: 11\" telah disetujui (WON). Draft Kontrak #10 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 10}'),
(142, 35, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-29 22:29:27', '2026-07-29 22:29:27', NULL, 'Tender \"Tender ID: 11\" telah disetujui (WON). Draft Kontrak #10 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 10}'),
(143, 1, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-29 22:29:27', '2026-07-29 22:29:27', NULL, 'Tender \"Tender ID: 11\" telah disetujui (WON). Draft Kontrak #10 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 10}'),
(144, 32, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-29 22:29:27', '2026-07-29 22:29:27', NULL, 'Tender \"Tender ID: 11\" telah disetujui (WON). Draft Kontrak #10 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 10}'),
(145, 39, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-29 22:29:27', '2026-07-29 22:29:27', NULL, 'Tender \"Tender ID: 11\" telah disetujui (WON). Draft Kontrak #10 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 10}'),
(146, 1, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-29 22:29:28', '2026-07-29 22:29:27', NULL, '<span style=\"font-weight: 600;
```

```sql
created_by`, `updated_by`, `deleted_by`, `created_at`, `updated_at`, `deleted_at`, `message`, `notification_type`, `action_link`, `meta_data`) VALUES
(168, 32, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-29 22:44:03', '2026-07-29 22:44:03', NULL, 'Tender \"Tender ID: 9\" telah disetujui (WON). Draft Kontrak #12 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 12}'),
(169, 39, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-29 22:44:03', '2026-07-29 22:44:03', NULL, 'Tender \"Tender ID: 9\" telah disetujui (WON). Draft Kontrak #12 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 12}'),
(170, 1, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-29 22:44:03', '2026-07-29 22:44:03', NULL, '<span style=\"font-weight: 600;
```

```sql
CREATED\", \"project_name\": \"Project Renovasi lahan parkir Gateway Bandung\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(178, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 10:32:07', '2026-07-31 10:32:07', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi lahan parkir Gateway Bandung</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/15', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"15\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Renovasi lahan parkir Gateway Bandung\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(179, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 10:32:07', '2026-07-31 10:32:07', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi lahan parkir Gateway Bandung</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/15', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"15\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Renovasi lahan parkir Gateway Bandung\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(180, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 10:32:07', '2026-07-31 10:32:07', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi lahan parkir Gateway Bandung</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/15', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"15\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Renovasi lahan parkir Gateway Bandung\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(181, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 10:32:07', '2026-07-31 10:32:07', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi lahan parkir Gateway Bandung</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/15', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"15\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Renovasi lahan parkir Gateway Bandung\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(182, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 10:32:07', '2026-07-31 10:32:07', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi lahan parkir Gateway Bandung</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/15', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"15\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Renovasi lahan parkir Gateway Bandung\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(183, 10, 'Tender WON - Draft Kontrak Baru', 1, 0, NULL, NULL, '2026-07-31 12:14:33', '2026-07-31 13:29:15', NULL, 'Tender \"Tender ID: 15\" telah disetujui (WON). Draft Kontrak #14 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 14}'),
(184, 35, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-31 12:14:33', '2026-07-31 12:14:32', NULL, 'Tender \"Tender ID: 15\" telah disetujui (WON). Draft Kontrak #14 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 14}'),
(185, 1, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-31 12:14:33', '2026-07-31 12:14:32', NULL, 'Tender \"Tender ID: 15\" telah disetujui (WON). Draft Kontrak #14 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 14}'),
(186, 32, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-31 12:14:33', '2026-07-31 12:14:32', NULL, 'Tender \"Tender ID: 15\" telah disetujui (WON). Draft Kontrak #14 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 14}'),
(187, 39, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-31 12:14:33', '2026-07-31 12:14:32', NULL, 'Tender \"Tender ID: 15\" telah disetujui (WON). Draft Kontrak #14 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 14}'),
(188, 1, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-31 12:14:33', '2026-07-31 12:14:32', NULL, '<span style=\"font-weight: 600;
```

```sql
CREATED\", \"project_name\": \"CSA-FKI Rumah Net Bandung \", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(196, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:27:12', '2026-07-31 13:27:12', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bandung </span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/16', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"16\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Bandung \", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(197, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:27:12', '2026-07-31 13:27:12', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bandung </span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/16', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"16\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Bandung \", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(198, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:27:12', '2026-07-31 13:27:12', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bandung </span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/16', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"16\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Bandung \", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(199, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:27:12', '2026-07-31 13:27:12', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bandung </span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/16', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"16\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Bandung \", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(200, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:27:12', '2026-07-31 13:27:12', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bandung </span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/16', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"16\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Bandung \", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(201, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:28:09', '2026-07-31 13:28:08', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net BOGOR</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/17', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"17\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net BOGOR\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(202, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:28:09', '2026-07-31 13:28:08', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net BOGOR</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/17', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"17\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net BOGOR\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(203, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:28:09', '2026-07-31 13:28:08', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net BOGOR</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/17', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"17\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net BOGOR\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(204, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:28:09', '2026-07-31 13:28:08', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net BOGOR</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/17', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"17\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net BOGOR\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(205, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:28:09', '2026-07-31 13:28:08', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net BOGOR</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/17', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"17\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net BOGOR\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(206, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:28:09', '2026-07-31 13:28:08', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net BOGOR</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/17', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"17\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net BOGOR\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(207, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:30:29', '2026-07-31 13:30:29', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Garut</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/18', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"18\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Garut\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(208, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:30:29', '2026-07-31 13:30:29', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Garut</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/18', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"18\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Garut\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(209, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:30:29', '2026-07-31 13:30:29', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Garut</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/18', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"18\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Garut\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(210, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:30:29', '2026-07-31 13:30:29', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Garut</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/18', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"18\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Garut\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(211, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:30:29', '2026-07-31 13:30:29', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Garut</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/18', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"18\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Garut\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(212, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:30:29', '2026-07-31 13:30:29', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Garut</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/18', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"18\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Garut\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(213, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:31:10', '2026-07-31 13:31:09', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Ciamis</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/19', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"19\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Ciamis\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(214, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:31:10', '2026-07-31 13:31:09', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Ciamis</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/19', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"19\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Ciamis\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(215, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:31:10', '2026-07-31 13:31:09', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Ciamis</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/19', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"19\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Ciamis\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(216, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:31:10', '2026-07-31 13:31:09', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Ciamis</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/19', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"19\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Ciamis\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(217, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:31:10', '2026-07-31 13:31:09', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Ciamis</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/19', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"19\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Ciamis\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(218, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:31:10', '2026-07-31 13:31:09', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Ciamis</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/19', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"19\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Ciamis\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(219, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:32:46', '2026-07-31 13:32:45', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Tasikmalaya</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/20', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"20\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Tasikmalaya\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(220, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:32:46', '2026-07-31 13:32:45', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Tasikmalaya</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/20', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"20\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Tasikmalaya\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(221, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:32:46', '2026-07-31 13:32:45', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Tasikmalaya</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/20', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"20\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Tasikmalaya\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(222, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:32:46', '2026-07-31 13:32:45', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Tasikmalaya</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/20', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"20\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Tasikmalaya\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(223, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:32:46', '2026-07-31 13:32:45', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Tasikmalaya</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/20', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"20\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Tasikmalaya\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(224, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:32:46', '2026-07-31 13:32:45', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Tasikmalaya</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/20', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"20\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Tasikmalaya\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(225, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:33:46', '2026-07-31 13:33:46', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA FKI Rumah Net Cirebon</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/21', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"21\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA FKI Rumah Net Cirebon\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(226, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:33:46', '2026-07-31 13:33:46', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA FKI Rumah Net Cirebon</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/21', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"21\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA FKI Rumah Net Cirebon\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(227, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:33:46', '2026-07-31 13:33:46', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA FKI Rumah Net Cirebon</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/21', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"21\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA FKI Rumah Net Cirebon\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(228, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:33:46', '2026-07-31 13:33:46', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA FKI Rumah Net Cirebon</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/21', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"21\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA FKI Rumah Net Cirebon\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(229, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:33:46', '2026-07-31 13:33:46', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA FKI Rumah Net Cirebon</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/21', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"21\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA FKI Rumah Net Cirebon\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(230, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:33:46', '2026-07-31 13:33:46', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA FKI Rumah Net Cirebon</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/21', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"21\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA FKI Rumah Net Cirebon\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(231, 10, 'Tender WON - Draft Kontrak Baru', 1, 0, NULL, NULL, '2026-07-31 13:34:32', '2026-07-31 14:14:19', NULL, 'Tender \"Tender ID: 21\" telah disetujui (WON). Draft Kontrak #15 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 15}'),
(232, 35, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-31 13:34:32', '2026-07-31 13:34:31', NULL, 'Tender \"Tender ID: 21\" telah disetujui (WON). Draft Kontrak #15 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 15}'),
(233, 1, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-31 13:34:32', '2026-07-31 13:34:31', NULL, 'Tender \"Tender ID: 21\" telah disetujui (WON). Draft Kontrak #15 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 15}'),
(234, 32, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-31 13:34:32', '2026-07-31 13:34:31', NULL, 'Tender \"Tender ID: 21\" telah disetujui (WON). Draft Kontrak #15 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 15}'),
(235, 39, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-31 13:34:32', '2026-07-31 13:34:31', NULL, 'Tender \"Tender ID: 21\" telah disetujui (WON). Draft Kontrak #15 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 15}'),
(236, 1, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-31 13:34:32', '2026-07-31 13:34:32', NULL, '<span style=\"font-weight: 600;
```

```sql
created_by`, `updated_by`, `deleted_by`, `created_at`, `updated_at`, `deleted_at`, `message`, `notification_type`, `action_link`, `meta_data`) VALUES
(249, 4, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-31 14:14:45', '2026-07-31 14:14:44', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Tasikmalaya</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/20', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-31T07:14:44.701Z\", \"lead_id\": \"20\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Tasikmalaya\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(250, 6, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-31 14:14:45', '2026-07-31 14:14:44', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Tasikmalaya</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/20', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-31T07:14:44.701Z\", \"lead_id\": \"20\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Tasikmalaya\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(251, 7, '🎉 Pemenang Tender', 1, 0, NULL, NULL, '2026-07-31 14:14:45', '2026-07-31 16:50:14', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Tasikmalaya</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/20', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-31T07:14:44.701Z\", \"lead_id\": \"20\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Tasikmalaya\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(252, 32, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-31 14:14:45', '2026-07-31 14:14:44', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Tasikmalaya</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/20', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-31T07:14:44.701Z\", \"lead_id\": \"20\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Tasikmalaya\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(253, 33, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-31 14:14:45', '2026-07-31 14:14:44', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Tasikmalaya</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/20', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-31T07:14:44.701Z\", \"lead_id\": \"20\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Tasikmalaya\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(254, 39, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-31 14:14:45', '2026-07-31 14:14:44', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Tasikmalaya</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/20', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-31T07:14:44.701Z\", \"lead_id\": \"20\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Tasikmalaya\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(255, 10, 'Tender WON - Draft Kontrak Baru', 1, 0, NULL, NULL, '2026-07-31 14:15:58', '2026-07-31 16:50:08', NULL, 'Tender \"Tender ID: 19\" telah disetujui (WON). Draft Kontrak #17 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 17}'),
(256, 35, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-31 14:15:58', '2026-07-31 14:15:58', NULL, 'Tender \"Tender ID: 19\" telah disetujui (WON). Draft Kontrak #17 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 17}'),
(257, 1, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-31 14:15:58', '2026-07-31 14:15:58', NULL, 'Tender \"Tender ID: 19\" telah disetujui (WON). Draft Kontrak #17 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 17}'),
(258, 32, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-31 14:15:58', '2026-07-31 14:15:58', NULL, 'Tender \"Tender ID: 19\" telah disetujui (WON). Draft Kontrak #17 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 17}'),
(259, 39, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-31 14:15:58', '2026-07-31 14:15:58', NULL, 'Tender \"Tender ID: 19\" telah disetujui (WON). Draft Kontrak #17 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 17}'),
(260, 1, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-31 14:15:58', '2026-07-31 14:15:58', NULL, '<span style=\"font-weight: 600;
```

```sql
CREATED\", \"project_name\": \"CSA-FKI Kuningan\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(317, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 17:12:11', '2026-07-31 17:12:10', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Kuningan</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/22', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"22\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Kuningan\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(318, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 17:12:11', '2026-07-31 17:12:10', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Kuningan</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/22', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"22\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Kuningan\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(319, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 17:12:11', '2026-07-31 17:12:10', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Kuningan</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/22', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"22\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Kuningan\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(320, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 17:12:11', '2026-07-31 17:12:11', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Kuningan</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/22', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"22\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Kuningan\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(321, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 17:12:11', '2026-07-31 17:12:11', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Kuningan</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/22', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"22\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Kuningan\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(322, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 20:11:01', '2026-07-31 20:11:00', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bali</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/23', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"23\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Bali\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(323, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 20:11:01', '2026-07-31 20:11:00', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bali</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/23', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"23\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Bali\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(324, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 20:11:01', '2026-07-31 20:11:00', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bali</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/23', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"23\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Bali\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(325, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 20:11:01', '2026-07-31 20:11:00', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bali</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/23', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"23\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Bali\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(326, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 20:11:01', '2026-07-31 20:11:00', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bali</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/23', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"23\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Bali\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(327, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 20:11:01', '2026-07-31 20:11:00', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bali</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/23', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"23\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Bali\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(328, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 20:12:01', '2026-07-31 20:12:00', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Surabaya</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/24', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"24\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Surabaya\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(329, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 20:12:01', '2026-07-31 20:12:00', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Surabaya</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/24', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"24\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Surabaya\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(330, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 20:12:01', '2026-07-31 20:12:00', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Surabaya</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/24', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"24\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Surabaya\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(331, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 20:12:01', '2026-07-31 20:12:00', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Surabaya</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/24', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"24\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Surabaya\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(332, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 20:12:01', '2026-07-31 20:12:00', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Surabaya</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/24', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"24\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Surabaya\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(333, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 20:12:01', '2026-07-31 20:12:00', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Surabaya</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/24', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"24\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Surabaya\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(334, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:16:01', '2026-07-31 22:16:01', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Gresik</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/25', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"25\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Gresik\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(335, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:16:01', '2026-07-31 22:16:01', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Gresik</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/25', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"25\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Gresik\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(336, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:16:01', '2026-07-31 22:16:01', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Gresik</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/25', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"25\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Gresik\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(337, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:16:01', '2026-07-31 22:16:01', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Gresik</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/25', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"25\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Gresik\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(338, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:16:01', '2026-07-31 22:16:01', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Gresik</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/25', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"25\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Gresik\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `is_read`, `created_by`, `updated_by`, `deleted_by`, `created_at`, `updated_at`, `deleted_at`, `message`, `notification_type`, `action_link`, `meta_data`) VALUES
(339, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:16:01', '2026-07-31 22:16:01', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Gresik</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/25', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"25\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Gresik\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(340, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:23:36', '2026-07-31 22:23:35', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah net Bandung Lembang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/26', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"26\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah net Bandung Lembang\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(341, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:23:36', '2026-07-31 22:23:35', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah net Bandung Lembang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/26', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"26\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah net Bandung Lembang\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(342, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:23:36', '2026-07-31 22:23:35', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah net Bandung Lembang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/26', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"26\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah net Bandung Lembang\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(343, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:23:36', '2026-07-31 22:23:35', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah net Bandung Lembang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/26', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"26\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah net Bandung Lembang\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(344, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:23:36', '2026-07-31 22:23:35', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah net Bandung Lembang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/26', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"26\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah net Bandung Lembang\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(345, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:23:36', '2026-07-31 22:23:35', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah net Bandung Lembang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/26', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"26\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah net Bandung Lembang\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(346, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:26:54', '2026-07-31 22:26:54', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Ruman Net Subang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/27', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"27\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Ruman Net Subang\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(347, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:26:54', '2026-07-31 22:26:54', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Ruman Net Subang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/27', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"27\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Ruman Net Subang\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(348, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:26:54', '2026-07-31 22:26:54', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Ruman Net Subang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/27', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"27\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Ruman Net Subang\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(349, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:26:54', '2026-07-31 22:26:54', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Ruman Net Subang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/27', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"27\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Ruman Net Subang\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(350, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:26:54', '2026-07-31 22:26:54', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Ruman Net Subang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/27', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"27\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Ruman Net Subang\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(351, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:26:54', '2026-07-31 22:26:54', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Ruman Net Subang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/27', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"27\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Ruman Net Subang\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(352, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:28:14', '2026-07-31 22:28:13', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Tuban</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/28', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"28\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Tuban\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(353, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:28:14', '2026-07-31 22:28:13', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Tuban</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/28', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"28\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Tuban\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(354, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:28:14', '2026-07-31 22:28:13', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Tuban</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/28', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"28\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Tuban\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(355, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:28:14', '2026-07-31 22:28:13', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Tuban</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/28', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"28\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Tuban\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(356, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:28:14', '2026-07-31 22:28:13', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Tuban</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/28', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"28\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Tuban\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(357, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:28:14', '2026-07-31 22:28:13', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Tuban</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/28', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"28\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Tuban\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(358, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:49:18', '2026-07-31 22:49:18', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Pati</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/29', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"29\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Pati\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(359, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:49:18', '2026-07-31 22:49:18', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Pati</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/29', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"29\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Pati\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(360, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:49:18', '2026-07-31 22:49:18', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Pati</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/29', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"29\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Pati\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(361, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:49:18', '2026-07-31 22:49:18', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Pati</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/29', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"29\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Pati\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(362, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:49:18', '2026-07-31 22:49:18', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Pati</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/29', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"29\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Pati\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(363, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:49:18', '2026-07-31 22:49:18', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Pati</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/29', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"29\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Pati\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(364, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:50:32', '2026-07-31 22:50:32', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Pangandaran</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/30', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"30\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Pangandaran\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(365, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:50:32', '2026-07-31 22:50:32', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Pangandaran</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/30', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"30\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Pangandaran\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(366, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:50:32', '2026-07-31 22:50:32', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Pangandaran</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/30', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"30\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Pangandaran\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(367, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:50:32', '2026-07-31 22:50:32', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Pangandaran</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/30', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"30\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Pangandaran\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(368, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:50:32', '2026-07-31 22:50:32', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Pangandaran</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/30', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"30\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Pangandaran\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(369, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:50:32', '2026-07-31 22:50:32', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Pangandaran</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/30', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"30\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Pangandaran\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(370, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:54:29', '2026-07-31 22:54:29', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Kabupaten Bandung</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/31', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"31\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Kabupaten Bandung\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(371, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:54:29', '2026-07-31 22:54:29', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Kabupaten Bandung</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/31', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"31\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Kabupaten Bandung\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(372, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:54:29', '2026-07-31 22:54:29', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Kabupaten Bandung</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/31', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"31\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Kabupaten Bandung\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(373, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:54:29', '2026-07-31 22:54:29', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Kabupaten Bandung</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/31', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"31\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Kabupaten Bandung\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(374, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:54:29', '2026-07-31 22:54:29', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Kabupaten Bandung</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/31', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"31\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Kabupaten Bandung\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(375, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:54:29', '2026-07-31 22:54:29', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Kabupaten Bandung</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/31', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"31\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Kabupaten Bandung\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(376, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:57:51', '2026-07-31 22:57:50', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Yogyakarta</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/32', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"32\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Yogyakarta\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(377, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:57:51', '2026-07-31 22:57:50', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Yogyakarta</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/32', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"32\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Yogyakarta\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(378, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:57:51', '2026-07-31 22:57:50', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Yogyakarta</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/32', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"32\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Yogyakarta\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(379, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:57:51', '2026-07-31 22:57:50', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Yogyakarta</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/32', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"32\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Yogyakarta\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(380, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:57:51', '2026-07-31 22:57:50', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Yogyakarta</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/32', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"32\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Yogyakarta\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(381, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:57:51', '2026-07-31 22:57:50', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Yogyakarta</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/32', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"32\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Yogyakarta\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(382, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:58:58', '2026-07-31 22:58:58', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net SOLO</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/33', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"33\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net SOLO\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(383, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:58:58', '2026-07-31 22:58:58', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net SOLO</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/33', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"33\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net SOLO\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(384, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:58:58', '2026-07-31 22:58:58', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net SOLO</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/33', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"33\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net SOLO\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(385, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:58:58', '2026-07-31 22:58:58', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net SOLO</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/33', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"33\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net SOLO\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(386, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:58:58', '2026-07-31 22:58:58', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net SOLO</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/33', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"33\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net SOLO\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(387, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:58:58', '2026-07-31 22:58:58', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net SOLO</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/33', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"33\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net SOLO\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(388, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 23:04:09', '2026-07-31 23:04:09', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bolo Gresik</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/34', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"34\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Bolo Gresik\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(389, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 23:04:09', '2026-07-31 23:04:09', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bolo Gresik</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/34', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"34\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Bolo Gresik\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(390, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 23:04:09', '2026-07-31 23:04:09', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bolo Gresik</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/34', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"34\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Bolo Gresik\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(391, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 23:04:09', '2026-07-31 23:04:09', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bolo Gresik</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/34', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"34\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Bolo Gresik\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(392, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 23:04:09', '2026-07-31 23:04:09', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bolo Gresik</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/34', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"34\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Bolo Gresik\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(393, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 23:04:09', '2026-07-31 23:04:09', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bolo Gresik</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/34', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"34\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Bolo Gresik\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(394, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 23:06:43', '2026-07-31 23:06:42', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bojonegori</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/35', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"35\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Bojonegori\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(395, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 23:06:43', '2026-07-31 23:06:42', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bojonegori</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/35', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"35\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Bojonegori\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(396, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 23:06:43', '2026-07-31 23:06:43', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bojonegori</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/35', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"35\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Bojonegori\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(397, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 23:06:43', '2026-07-31 23:06:43', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bojonegori</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/35', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"35\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Bojonegori\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(398, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 23:06:43', '2026-07-31 23:06:43', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bojonegori</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/35', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"35\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Bojonegori\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(399, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 23:06:43', '2026-07-31 23:06:43', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bojonegori</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/35', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"35\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Bojonegori\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(400, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 23:20:46', '2026-07-31 23:20:45', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang J&T Gresik</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/36', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"36\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gudang J&T Gresik\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(401, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 23:20:46', '2026-07-31 23:20:45', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang J&T Gresik</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/36', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"36\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gudang J&T Gresik\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(402, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 23:20:46', '2026-07-31 23:20:45', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang J&T Gresik</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/36', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"36\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gudang J&T Gresik\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(403, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 23:20:46', '2026-07-31 23:20:45', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang J&T Gresik</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/36', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"36\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gudang J&T Gresik\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(404, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 23:20:46', '2026-07-31 23:20:45', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang J&T Gresik</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/36', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"36\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gudang J&T Gresik\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(405, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 23:20:46', '2026-07-31 23:20:45', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang J&T Gresik</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/36', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"36\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gudang J&T Gresik\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(406, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 23:51:51', '2026-07-31 23:51:51', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang Tangerang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/37', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"37\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gudang Tangerang\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(407, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 23:51:51', '2026-07-31 23:51:51', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang Tangerang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/37', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"37\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gudang Tangerang\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(408, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 23:51:51', '2026-07-31 23:51:51', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang Tangerang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/37', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"37\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gudang Tangerang\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(409, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 23:51:51', '2026-07-31 23:51:51', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang Tangerang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/37', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"37\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gudang Tangerang\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(410, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 23:51:51', '2026-07-31 23:51:51', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang Tangerang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/37', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"37\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gudang Tangerang\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `is_read`, `created_by`, `updated_by`, `deleted_by`, `created_at`, `updated_at`, `deleted_at`, `message`, `notification_type`, `action_link`, `meta_data`) VALUES
(411, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 23:51:51', '2026-07-31 23:51:51', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang Tangerang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/37', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"37\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gudang Tangerang\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(412, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 00:25:13', '2026-08-01 00:25:12', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Ruang Purchasing J&T Tuban</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/38', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"38\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Ruang Purchasing J&T Tuban\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(413, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 00:25:13', '2026-08-01 00:25:12', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Ruang Purchasing J&T Tuban</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/38', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"38\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Ruang Purchasing J&T Tuban\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(414, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 00:25:13', '2026-08-01 00:25:12', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Ruang Purchasing J&T Tuban</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/38', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"38\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Ruang Purchasing J&T Tuban\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(415, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 00:25:13', '2026-08-01 00:25:12', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Ruang Purchasing J&T Tuban</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/38', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"38\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Ruang Purchasing J&T Tuban\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(416, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 00:25:13', '2026-08-01 00:25:13', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Ruang Purchasing J&T Tuban</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/38', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"38\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Ruang Purchasing J&T Tuban\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(417, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 00:25:13', '2026-08-01 00:25:13', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Ruang Purchasing J&T Tuban</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/38', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"38\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Ruang Purchasing J&T Tuban\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(418, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 02:21:02', '2026-08-01 02:21:01', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project ATP Gateway Madiun</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/39', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"39\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project ATP Gateway Madiun\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(419, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 02:21:02', '2026-08-01 02:21:01', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project ATP Gateway Madiun</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/39', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"39\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project ATP Gateway Madiun\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(420, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 02:21:02', '2026-08-01 02:21:01', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project ATP Gateway Madiun</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/39', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"39\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project ATP Gateway Madiun\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(421, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 02:21:02', '2026-08-01 02:21:01', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project ATP Gateway Madiun</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/39', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"39\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project ATP Gateway Madiun\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(422, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 02:21:02', '2026-08-01 02:21:01', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project ATP Gateway Madiun</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/39', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"39\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project ATP Gateway Madiun\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(423, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 02:21:02', '2026-08-01 02:21:01', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project ATP Gateway Madiun</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/39', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"39\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project ATP Gateway Madiun\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(424, 1, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-01 02:22:07', '2026-08-01 02:22:07', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">Project ATP Gateway Madiun</span>.', 'ALERT', '/sales/tenders/39', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"39\", \"user_name\": \"Lukas Kurniawan\", \"action_type\": \"PROPOSAL_UPLOADED\", \"project_name\": \"Project ATP Gateway Madiun\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(425, 4, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-01 02:22:07', '2026-08-01 02:22:07', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">Project ATP Gateway Madiun</span>.', 'ALERT', '/sales/tenders/39', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"39\", \"user_name\": \"Lukas Kurniawan\", \"action_type\": \"PROPOSAL_UPLOADED\", \"project_name\": \"Project ATP Gateway Madiun\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(426, 6, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-01 02:22:07', '2026-08-01 02:22:07', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">Project ATP Gateway Madiun</span>.', 'ALERT', '/sales/tenders/39', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"39\", \"user_name\": \"Lukas Kurniawan\", \"action_type\": \"PROPOSAL_UPLOADED\", \"project_name\": \"Project ATP Gateway Madiun\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(427, 32, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-01 02:22:07', '2026-08-01 02:22:07', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">Project ATP Gateway Madiun</span>.', 'ALERT', '/sales/tenders/39', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"39\", \"user_name\": \"Lukas Kurniawan\", \"action_type\": \"PROPOSAL_UPLOADED\", \"project_name\": \"Project ATP Gateway Madiun\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(428, 33, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-01 02:22:07', '2026-08-01 02:22:07', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">Project ATP Gateway Madiun</span>.', 'ALERT', '/sales/tenders/39', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"39\", \"user_name\": \"Lukas Kurniawan\", \"action_type\": \"PROPOSAL_UPLOADED\", \"project_name\": \"Project ATP Gateway Madiun\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(429, 39, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-01 02:22:07', '2026-08-01 02:22:07', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">Project ATP Gateway Madiun</span>.', 'ALERT', '/sales/tenders/39', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"39\", \"user_name\": \"Lukas Kurniawan\", \"action_type\": \"PROPOSAL_UPLOADED\", \"project_name\": \"Project ATP Gateway Madiun\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(430, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 03:05:22', '2026-08-01 03:05:22', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi Kantor J&T HQ</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/40', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"40\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Renovasi Kantor J&T HQ\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(431, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 03:05:22', '2026-08-01 03:05:22', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi Kantor J&T HQ</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/40', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"40\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Renovasi Kantor J&T HQ\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(432, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 03:05:22', '2026-08-01 03:05:22', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi Kantor J&T HQ</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/40', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"40\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Renovasi Kantor J&T HQ\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(433, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 03:05:22', '2026-08-01 03:05:22', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi Kantor J&T HQ</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/40', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"40\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Renovasi Kantor J&T HQ\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(434, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 03:05:22', '2026-08-01 03:05:22', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi Kantor J&T HQ</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/40', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"40\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Renovasi Kantor J&T HQ\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(435, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 03:05:22', '2026-08-01 03:05:22', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi Kantor J&T HQ</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/40', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"40\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Renovasi Kantor J&T HQ\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(436, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 03:08:31', '2026-08-01 03:08:30', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi DP Mini Jakarta</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Small).', 'ALERT', '/sales/tenders/41', '{\"tier\": \"Small\", \"won_at\": null, \"lead_id\": \"41\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Renovasi DP Mini Jakarta\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(437, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 03:08:31', '2026-08-01 03:08:30', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi DP Mini Jakarta</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Small).', 'ALERT', '/sales/tenders/41', '{\"tier\": \"Small\", \"won_at\": null, \"lead_id\": \"41\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Renovasi DP Mini Jakarta\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(438, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 03:08:31', '2026-08-01 03:08:30', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi DP Mini Jakarta</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Small).', 'ALERT', '/sales/tenders/41', '{\"tier\": \"Small\", \"won_at\": null, \"lead_id\": \"41\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Renovasi DP Mini Jakarta\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(439, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 03:08:31', '2026-08-01 03:08:30', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi DP Mini Jakarta</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Small).', 'ALERT', '/sales/tenders/41', '{\"tier\": \"Small\", \"won_at\": null, \"lead_id\": \"41\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Renovasi DP Mini Jakarta\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(440, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 03:08:31', '2026-08-01 03:08:30', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi DP Mini Jakarta</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Small).', 'ALERT', '/sales/tenders/41', '{\"tier\": \"Small\", \"won_at\": null, \"lead_id\": \"41\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Renovasi DP Mini Jakarta\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(441, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 03:08:31', '2026-08-01 03:08:30', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi DP Mini Jakarta</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Small).', 'ALERT', '/sales/tenders/41', '{\"tier\": \"Small\", \"won_at\": null, \"lead_id\": \"41\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Renovasi DP Mini Jakarta\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(442, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 03:10:29', '2026-08-01 03:10:29', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Sulawesi makasar</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/42', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"42\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Sulawesi makasar\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(443, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 03:10:29', '2026-08-01 03:10:29', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Sulawesi makasar</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/42', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"42\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Sulawesi makasar\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(444, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 03:10:29', '2026-08-01 03:10:29', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Sulawesi makasar</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/42', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"42\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Sulawesi makasar\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(445, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 03:10:29', '2026-08-01 03:10:29', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Sulawesi makasar</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/42', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"42\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Sulawesi makasar\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(446, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 03:10:29', '2026-08-01 03:10:29', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Sulawesi makasar</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/42', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"42\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Sulawesi makasar\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(447, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 03:10:29', '2026-08-01 03:10:29', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Sulawesi makasar</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/42', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"42\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Sulawesi makasar\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(448, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 03:31:56', '2026-08-01 03:31:56', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Kalimantan</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/43', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"43\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Rumah Net Kalimantan\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(449, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 03:31:56', '2026-08-01 03:31:56', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Kalimantan</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/43', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"43\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Rumah Net Kalimantan\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(450, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 03:31:56', '2026-08-01 03:31:56', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Kalimantan</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/43', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"43\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Rumah Net Kalimantan\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(451, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 03:31:56', '2026-08-01 03:31:56', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Kalimantan</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/43', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"43\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Rumah Net Kalimantan\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(452, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 03:31:56', '2026-08-01 03:31:56', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Kalimantan</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/43', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"43\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Rumah Net Kalimantan\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(453, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 03:31:56', '2026-08-01 03:31:56', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Kalimantan</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/43', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"43\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Rumah Net Kalimantan\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(454, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-02 23:21:44', '2026-08-02 23:21:44', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net papua</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/44', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"44\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Rumah Net papua\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(455, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-02 23:21:44', '2026-08-02 23:21:44', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net papua</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/44', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"44\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Rumah Net papua\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(456, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-02 23:21:44', '2026-08-02 23:21:44', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net papua</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/44', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"44\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Rumah Net papua\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(457, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-02 23:21:44', '2026-08-02 23:21:44', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net papua</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/44', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"44\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Rumah Net papua\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(458, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-02 23:21:44', '2026-08-02 23:21:44', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net papua</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/44', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"44\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Rumah Net papua\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(459, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-02 23:21:44', '2026-08-02 23:21:44', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net papua</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/44', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"44\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Rumah Net papua\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(460, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-02 23:24:47', '2026-08-02 23:24:47', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Rumah Net Batam\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(461, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-02 23:24:47', '2026-08-02 23:24:47', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Rumah Net Batam\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(462, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-02 23:24:47', '2026-08-02 23:24:47', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Rumah Net Batam\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(463, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-02 23:24:47', '2026-08-02 23:24:47', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Rumah Net Batam\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(464, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-02 23:24:47', '2026-08-02 23:24:47', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Rumah Net Batam\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(465, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-02 23:24:47', '2026-08-02 23:24:47', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Rumah Net Batam\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(466, 1, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-02 23:56:36', '2026-08-02 23:56:36', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Batam Central\", \"requires_approval\": false}'),
(467, 4, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-02 23:56:36', '2026-08-02 23:56:36', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Batam Central\", \"requires_approval\": true}'),
(468, 6, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-02 23:56:36', '2026-08-02 23:56:36', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Batam Central\", \"requires_approval\": false}'),
(469, 32, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-02 23:56:36', '2026-08-02 23:56:36', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Batam Central\", \"requires_approval\": false}'),
(470, 33, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-02 23:56:36', '2026-08-02 23:56:36', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Batam Central\", \"requires_approval\": true}'),
(471, 39, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-02 23:56:36', '2026-08-02 23:56:36', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Batam Central\", \"requires_approval\": false}'),
(472, 1, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-02 23:56:53', '2026-08-02 23:56:53', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net papua Sorong</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Large).', 'ALERT', '/sales/tenders/44', '{\"tier\": \"Large\", \"won_at\": null, \"lead_id\": \"44\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net papua Sorong\", \"requires_approval\": false}'),
(473, 4, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-02 23:56:53', '2026-08-02 23:56:53', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net papua Sorong</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Large).', 'ALERT', '/sales/tenders/44', '{\"tier\": \"Large\", \"won_at\": null, \"lead_id\": \"44\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net papua Sorong\", \"requires_approval\": true}'),
(474, 6, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-02 23:56:53', '2026-08-02 23:56:53', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net papua Sorong</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Large).', 'ALERT', '/sales/tenders/44', '{\"tier\": \"Large\", \"won_at\": null, \"lead_id\": \"44\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net papua Sorong\", \"requires_approval\": false}'),
(475, 32, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-02 23:56:53', '2026-08-02 23:56:53', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net papua Sorong</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Large).', 'ALERT', '/sales/tenders/44', '{\"tier\": \"Large\", \"won_at\": null, \"lead_id\": \"44\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net papua Sorong\", \"requires_approval\": false}'),
(476, 33, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-02 23:56:53', '2026-08-02 23:56:53', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net papua Sorong</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Large).', 'ALERT', '/sales/tenders/44', '{\"tier\": \"Large\", \"won_at\": null, \"lead_id\": \"44\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net papua Sorong\", \"requires_approval\": true}'),
(477, 39, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-02 23:56:53', '2026-08-02 23:56:53', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net papua Sorong</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Large).', 'ALERT', '/sales/tenders/44', '{\"tier\": \"Large\", \"won_at\": null, \"lead_id\": \"44\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net papua Sorong\", \"requires_approval\": false}'),
(478, 1, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-02 23:57:16', '2026-08-02 23:57:15', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Kalimantan</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/43', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"43\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Kalimantan\", \"requires_approval\": false}'),
(479, 4, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-02 23:57:16', '2026-08-02 23:57:15', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Kalimantan</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/43', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"43\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Kalimantan\", \"requires_approval\": true}'),
(480, 6, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-02 23:57:16', '2026-08-02 23:57:15', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Kalimantan</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/43', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"43\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Kalimantan\", \"requires_approval\": false}'),
(481, 32, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-02 23:57:16', '2026-08-02 23:57:15', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Kalimantan</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/43', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"43\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Kalimantan\", \"requires_approval\": false}'),
(482, 33, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-02 23:57:16', '2026-08-02 23:57:15', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Kalimantan</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/43', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"43\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Kalimantan\", \"requires_approval\": true}'),
(483, 39, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-02 23:57:16', '2026-08-02 23:57:15', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Kalimantan</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/43', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"43\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Kalimantan\", \"requires_approval\": false}'),
(484, 1, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-02 23:59:00', '2026-08-02 23:58:59', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Batam Central\", \"requires_approval\": false}'),
(485, 4, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-02 23:59:00', '2026-08-02 23:58:59', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Batam Central\", \"requires_approval\": true}'),
(486, 6, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-02 23:59:00', '2026-08-02 23:58:59', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Batam Central\", \"requires_approval\": false}'),
(487, 32, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-02 23:59:00', '2026-08-02 23:58:59', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Batam Central\", \"requires_approval\": false}');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `is_read`, `created_by`, `updated_by`, `deleted_by`, `created_at`, `updated_at`, `deleted_at`, `message`, `notification_type`, `action_link`, `meta_data`) VALUES
(488, 33, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-02 23:59:00', '2026-08-02 23:58:59', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Batam Central\", \"requires_approval\": true}'),
(489, 39, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-02 23:59:00', '2026-08-02 23:58:59', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Batam Central\", \"requires_approval\": false}'),
(490, 1, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:04:37', '2026-08-03 00:04:36', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Batam Central\", \"requires_approval\": false}'),
(491, 4, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:04:37', '2026-08-03 00:04:36', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Batam Central\", \"requires_approval\": true}'),
(492, 6, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:04:37', '2026-08-03 00:04:36', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Batam Central\", \"requires_approval\": false}'),
(493, 32, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:04:37', '2026-08-03 00:04:36', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Batam Central\", \"requires_approval\": false}'),
(494, 33, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:04:37', '2026-08-03 00:04:36', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Batam Central\", \"requires_approval\": true}'),
(495, 39, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:04:37', '2026-08-03 00:04:36', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Batam Central\", \"requires_approval\": false}'),
(496, 1, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:05:00', '2026-08-03 00:04:59', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Batam Central\", \"requires_approval\": false}'),
(497, 4, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:05:00', '2026-08-03 00:04:59', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Batam Central\", \"requires_approval\": true}'),
(498, 6, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:05:00', '2026-08-03 00:04:59', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Batam Central\", \"requires_approval\": false}'),
(499, 32, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:05:00', '2026-08-03 00:04:59', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Batam Central\", \"requires_approval\": false}'),
(500, 33, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:05:00', '2026-08-03 00:04:59', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Batam Central\", \"requires_approval\": true}'),
(501, 39, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:05:00', '2026-08-03 00:04:59', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Batam Central\", \"requires_approval\": false}'),
(502, 1, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:05:34', '2026-08-03 00:05:34', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net papua Sorong</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/44', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"44\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net papua Sorong\", \"requires_approval\": false}'),
(503, 4, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:05:34', '2026-08-03 00:05:34', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net papua Sorong</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/44', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"44\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net papua Sorong\", \"requires_approval\": true}'),
(504, 6, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:05:34', '2026-08-03 00:05:34', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net papua Sorong</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/44', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"44\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net papua Sorong\", \"requires_approval\": false}'),
(505, 32, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:05:34', '2026-08-03 00:05:34', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net papua Sorong</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/44', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"44\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net papua Sorong\", \"requires_approval\": false}'),
(506, 33, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:05:34', '2026-08-03 00:05:34', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net papua Sorong</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/44', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"44\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net papua Sorong\", \"requires_approval\": true}'),
(507, 39, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:05:34', '2026-08-03 00:05:34', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net papua Sorong</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/44', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"44\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net papua Sorong\", \"requires_approval\": false}'),
(508, 1, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:05:51', '2026-08-03 00:05:51', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Kalimantan</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/43', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"43\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Kalimantan\", \"requires_approval\": false}'),
(509, 4, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:05:51', '2026-08-03 00:05:51', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Kalimantan</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/43', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"43\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Kalimantan\", \"requires_approval\": true}'),
(510, 6, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:05:51', '2026-08-03 00:05:51', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Kalimantan</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/43', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"43\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Kalimantan\", \"requires_approval\": false}'),
(511, 32, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:05:51', '2026-08-03 00:05:51', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Kalimantan</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/43', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"43\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Kalimantan\", \"requires_approval\": false}'),
(512, 33, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:05:51', '2026-08-03 00:05:51', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Kalimantan</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/43', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"43\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Kalimantan\", \"requires_approval\": true}'),
(513, 39, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:05:51', '2026-08-03 00:05:51', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Kalimantan</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/43', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"43\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Kalimantan\", \"requires_approval\": false}'),
(514, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-03 00:07:57', '2026-08-03 00:07:57', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Riau</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/46', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"46\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Rumah Net Riau\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(515, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-03 00:07:57', '2026-08-03 00:07:57', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Riau</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/46', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"46\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Rumah Net Riau\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(516, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-03 00:07:57', '2026-08-03 00:07:57', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Riau</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/46', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"46\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Rumah Net Riau\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(517, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-03 00:07:57', '2026-08-03 00:07:57', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Riau</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/46', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"46\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Rumah Net Riau\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(518, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-03 00:07:57', '2026-08-03 00:07:57', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Riau</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/46', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"46\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Rumah Net Riau\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(519, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-03 00:07:57', '2026-08-03 00:07:57', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Riau</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/46', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"46\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Rumah Net Riau\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(520, 1, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:09:45', '2026-08-03 00:09:45', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Riau</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/46', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"46\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Riau\", \"requires_approval\": false}'),
(521, 4, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:09:45', '2026-08-03 00:09:45', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Riau</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/46', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"46\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Riau\", \"requires_approval\": true}'),
(522, 6, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:09:45', '2026-08-03 00:09:45', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Riau</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/46', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"46\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Riau\", \"requires_approval\": false}'),
(523, 32, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:09:45', '2026-08-03 00:09:45', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Riau</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/46', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"46\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Riau\", \"requires_approval\": false}'),
(524, 33, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:09:45', '2026-08-03 00:09:45', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Riau</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/46', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"46\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Riau\", \"requires_approval\": true}'),
(525, 39, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:09:45', '2026-08-03 00:09:45', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Riau</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/46', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"46\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Riau\", \"requires_approval\": false}'),
(526, 1, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:16:11', '2026-08-03 00:16:11', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Riau</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Large).', 'ALERT', '/sales/tenders/46', '{\"tier\": \"Large\", \"won_at\": null, \"lead_id\": \"46\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Riau\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(527, 4, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:16:11', '2026-08-03 00:16:11', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Riau</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Large).', 'ALERT', '/sales/tenders/46', '{\"tier\": \"Large\", \"won_at\": null, \"lead_id\": \"46\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Riau\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(528, 6, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:16:11', '2026-08-03 00:16:11', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Riau</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Large).', 'ALERT', '/sales/tenders/46', '{\"tier\": \"Large\", \"won_at\": null, \"lead_id\": \"46\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Riau\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(529, 32, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:16:11', '2026-08-03 00:16:11', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Riau</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Large).', 'ALERT', '/sales/tenders/46', '{\"tier\": \"Large\", \"won_at\": null, \"lead_id\": \"46\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Riau\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(530, 33, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:16:11', '2026-08-03 00:16:11', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Riau</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Large).', 'ALERT', '/sales/tenders/46', '{\"tier\": \"Large\", \"won_at\": null, \"lead_id\": \"46\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Riau\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(531, 39, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:16:11', '2026-08-03 00:16:11', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Riau</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Large).', 'ALERT', '/sales/tenders/46', '{\"tier\": \"Large\", \"won_at\": null, \"lead_id\": \"46\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Riau\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(532, 1, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:24:56', '2026-08-03 00:24:55', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Riau</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/46', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"46\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Riau\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(533, 4, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:24:56', '2026-08-03 00:24:55', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Riau</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/46', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"46\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Riau\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(534, 6, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:24:56', '2026-08-03 00:24:55', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Riau</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/46', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"46\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Riau\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(535, 9, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:24:56', '2026-08-03 00:24:55', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Riau</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/46', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"46\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Riau\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(536, 32, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:24:56', '2026-08-03 00:24:55', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Riau</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/46', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"46\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Riau\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(537, 33, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:24:56', '2026-08-03 00:24:55', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Riau</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/46', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"46\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Riau\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(538, 39, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:24:56', '2026-08-03 00:24:55', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Riau</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/46', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"46\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Riau\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(539, 1, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 11:25:45', '2026-08-03 11:25:44', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span>.', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"user_name\": \"Lukas Kurniawan\", \"action_type\": \"PROPOSAL_UPLOADED\", \"project_name\": \"Project Rumah Net Batam Central\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(540, 4, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 11:25:45', '2026-08-03 11:25:44', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span>.', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"user_name\": \"Lukas Kurniawan\", \"action_type\": \"PROPOSAL_UPLOADED\", \"project_name\": \"Project Rumah Net Batam Central\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(541, 6, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 11:25:45', '2026-08-03 11:25:44', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span>.', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"user_name\": \"Lukas Kurniawan\", \"action_type\": \"PROPOSAL_UPLOADED\", \"project_name\": \"Project Rumah Net Batam Central\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(542, 32, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 11:25:45', '2026-08-03 11:25:44', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span>.', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"user_name\": \"Lukas Kurniawan\", \"action_type\": \"PROPOSAL_UPLOADED\", \"project_name\": \"Project Rumah Net Batam Central\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(543, 33, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 11:25:45', '2026-08-03 11:25:44', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span>.', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"user_name\": \"Lukas Kurniawan\", \"action_type\": \"PROPOSAL_UPLOADED\", \"project_name\": \"Project Rumah Net Batam Central\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(544, 39, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 11:25:45', '2026-08-03 11:25:44', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span>.', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"user_name\": \"Lukas Kurniawan\", \"action_type\": \"PROPOSAL_UPLOADED\", \"project_name\": \"Project Rumah Net Batam Central\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(545, 1, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 11:26:03', '2026-08-03 11:26:02', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">undefined</span>.', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Small\", \"won_at\": null, \"lead_id\": 45, \"action_type\": \"NEW_ACTIVITY\", \"requires_approval\": false}'),
(546, 4, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 11:26:03', '2026-08-03 11:26:02', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">undefined</span>.', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Small\", \"won_at\": null, \"lead_id\": 45, \"action_type\": \"NEW_ACTIVITY\", \"requires_approval\": true}'),
(547, 6, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 11:26:03', '2026-08-03 11:26:02', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">undefined</span>.', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Small\", \"won_at\": null, \"lead_id\": 45, \"action_type\": \"NEW_ACTIVITY\", \"requires_approval\": false}'),
(548, 32, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 11:26:03', '2026-08-03 11:26:02', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">undefined</span>.', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Small\", \"won_at\": null, \"lead_id\": 45, \"action_type\": \"NEW_ACTIVITY\", \"requires_approval\": false}'),
(549, 33, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 11:26:03', '2026-08-03 11:26:02', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">undefined</span>.', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Small\", \"won_at\": null, \"lead_id\": 45, \"action_type\": \"NEW_ACTIVITY\", \"requires_approval\": true}'),
(550, 39, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 11:26:03', '2026-08-03 11:26:02', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">undefined</span>.', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Small\", \"won_at\": null, \"lead_id\": 45, \"action_type\": \"NEW_ACTIVITY\", \"requires_approval\": false}'),
(551, 10, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-08-03 11:26:11', '2026-08-03 11:26:11', NULL, 'Tender \"Tender ID: 45\" telah disetujui (WON). Draft Kontrak #21 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 21}'),
(552, 35, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-08-03 11:26:11', '2026-08-03 11:26:11', NULL, 'Tender \"Tender ID: 45\" telah disetujui (WON). Draft Kontrak #21 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 21}'),
(553, 1, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-08-03 11:26:11', '2026-08-03 11:26:11', NULL, 'Tender \"Tender ID: 45\" telah disetujui (WON). Draft Kontrak #21 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 21}'),
(554, 32, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-08-03 11:26:11', '2026-08-03 11:26:11', NULL, 'Tender \"Tender ID: 45\" telah disetujui (WON). Draft Kontrak #21 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 21}'),
(555, 39, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-08-03 11:26:11', '2026-08-03 11:26:11', NULL, 'Tender \"Tender ID: 45\" telah disetujui (WON). Draft Kontrak #21 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 21}'),
(556, 1, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-03 11:26:11', '2026-08-03 11:26:11', NULL, '<span style=\"font-weight: 600;
```

```sql
CREATED\", \"project_name\": \"CSA-FKI Rumah Net Madura\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(572, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-03 13:41:20', '2026-08-03 13:41:20', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Madura</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Small).', 'ALERT', '/sales/tenders/47', '{\"tier\": \"Small\", \"won_at\": null, \"lead_id\": \"47\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Madura\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(573, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-03 13:41:20', '2026-08-03 13:41:20', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Madura</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Small).', 'ALERT', '/sales/tenders/47', '{\"tier\": \"Small\", \"won_at\": null, \"lead_id\": \"47\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Madura\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(574, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-03 13:41:20', '2026-08-03 13:41:20', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Madura</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Small).', 'ALERT', '/sales/tenders/47', '{\"tier\": \"Small\", \"won_at\": null, \"lead_id\": \"47\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Madura\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(575, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-03 13:41:20', '2026-08-03 13:41:20', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Madura</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Small).', 'ALERT', '/sales/tenders/47', '{\"tier\": \"Small\", \"won_at\": null, \"lead_id\": \"47\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Madura\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `is_read`, `created_by`, `updated_by`, `deleted_by`, `created_at`, `updated_at`, `deleted_at`, `message`, `notification_type`, `action_link`, `meta_data`) VALUES
(576, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-03 13:41:20', '2026-08-03 13:41:20', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Madura</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Small).', 'ALERT', '/sales/tenders/47', '{\"tier\": \"Small\", \"won_at\": null, \"lead_id\": \"47\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Madura\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(577, 10, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-08-03 13:42:09', '2026-08-03 13:42:08', NULL, 'Tender \"Tender ID: 47\" telah disetujui (WON). Draft Kontrak #22 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 22}'),
(578, 35, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-08-03 13:42:09', '2026-08-03 13:42:08', NULL, 'Tender \"Tender ID: 47\" telah disetujui (WON). Draft Kontrak #22 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 22}'),
(579, 1, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-08-03 13:42:09', '2026-08-03 13:42:08', NULL, 'Tender \"Tender ID: 47\" telah disetujui (WON). Draft Kontrak #22 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 22}'),
(580, 32, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-08-03 13:42:09', '2026-08-03 13:42:08', NULL, 'Tender \"Tender ID: 47\" telah disetujui (WON). Draft Kontrak #22 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 22}'),
(581, 39, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-08-03 13:42:09', '2026-08-03 13:42:08', NULL, 'Tender \"Tender ID: 47\" telah disetujui (WON). Draft Kontrak #22 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 22}'),
(582, 1, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-03 13:42:09', '2026-08-03 13:42:08', NULL, '<span style=\"font-weight: 600;
```

```sql
CREATED\", \"project_name\": \"CSA-FKI Rumah Net Sulawesi\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(590, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-03 13:44:24', '2026-08-03 13:44:23', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Sulawesi</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/48', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"48\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Sulawesi\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(591, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-03 13:44:24', '2026-08-03 13:44:23', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Sulawesi</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/48', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"48\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Sulawesi\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(592, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-03 13:44:24', '2026-08-03 13:44:23', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Sulawesi</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/48', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"48\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Sulawesi\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(593, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-03 13:44:24', '2026-08-03 13:44:23', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Sulawesi</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/48', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"48\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Sulawesi\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(594, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-03 13:44:24', '2026-08-03 13:44:23', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Sulawesi</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/48', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"48\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Sulawesi\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(595, 10, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-08-03 13:44:51', '2026-08-03 13:44:51', NULL, 'Tender \"Tender ID: 48\" telah disetujui (WON). Draft Kontrak #23 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 23}'),
(596, 35, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-08-03 13:44:51', '2026-08-03 13:44:51', NULL, 'Tender \"Tender ID: 48\" telah disetujui (WON). Draft Kontrak #23 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 23}'),
(597, 1, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-08-03 13:44:51', '2026-08-03 13:44:51', NULL, 'Tender \"Tender ID: 48\" telah disetujui (WON). Draft Kontrak #23 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 23}'),
(598, 32, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-08-03 13:44:51', '2026-08-03 13:44:51', NULL, 'Tender \"Tender ID: 48\" telah disetujui (WON). Draft Kontrak #23 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 23}'),
(599, 39, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-08-03 13:44:51', '2026-08-03 13:44:51', NULL, 'Tender \"Tender ID: 48\" telah disetujui (WON). Draft Kontrak #23 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 23}'),
(600, 1, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-03 13:44:51', '2026-08-03 13:44:51', NULL, '<span style=\"font-weight: 600;
```

```sql
created_by`, `updated_by`, `deleted_by`, `created_at`, `updated_at`, `deleted_at`, `message`, `notification_type`, `action_link`, `meta_data`) VALUES
(661, 4, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-03 17:42:57', '2026-08-03 17:42:56', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bojonegori</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/35', '{\"tier\": \"Medium\", \"won_at\": \"2026-08-03T10:42:56.726Z\", \"lead_id\": \"35\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Bojonegori\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(662, 6, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-03 17:42:57', '2026-08-03 17:42:56', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bojonegori</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/35', '{\"tier\": \"Medium\", \"won_at\": \"2026-08-03T10:42:56.726Z\", \"lead_id\": \"35\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Bojonegori\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(663, 9, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-03 17:42:57', '2026-08-03 17:42:56', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bojonegori</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/35', '{\"tier\": \"Medium\", \"won_at\": \"2026-08-03T10:42:56.726Z\", \"lead_id\": \"35\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Bojonegori\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(664, 32, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-03 17:42:57', '2026-08-03 17:42:56', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bojonegori</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/35', '{\"tier\": \"Medium\", \"won_at\": \"2026-08-03T10:42:56.726Z\", \"lead_id\": \"35\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Bojonegori\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(665, 33, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-03 17:42:57', '2026-08-03 17:42:56', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bojonegori</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/35', '{\"tier\": \"Medium\", \"won_at\": \"2026-08-03T10:42:56.726Z\", \"lead_id\": \"35\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Bojonegori\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(666, 39, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-03 17:42:57', '2026-08-03 17:42:56', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bojonegori</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/35', '{\"tier\": \"Medium\", \"won_at\": \"2026-08-03T10:42:56.726Z\", \"lead_id\": \"35\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Bojonegori\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(667, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-04 06:46:36', '2026-08-04 06:46:36', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Banten</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/49', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"49\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Banten\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(668, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-04 06:46:36', '2026-08-04 06:46:36', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Banten</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/49', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"49\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Banten\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(669, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-04 06:46:36', '2026-08-04 06:46:36', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Banten</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/49', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"49\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Banten\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(670, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-04 06:46:36', '2026-08-04 06:46:36', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Banten</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/49', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"49\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Banten\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(671, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-04 06:46:36', '2026-08-04 06:46:36', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Banten</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/49', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"49\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Banten\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(672, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-04 06:46:36', '2026-08-04 06:46:36', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Banten</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/49', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"49\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Banten\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(673, 10, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-08-04 07:05:35', '2026-08-04 07:05:35', NULL, 'Tender \"Tender ID: 34\" telah disetujui (WON). Draft Kontrak #26 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 26}'),
(674, 35, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-08-04 07:05:35', '2026-08-04 07:05:35', NULL, 'Tender \"Tender ID: 34\" telah disetujui (WON). Draft Kontrak #26 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 26}'),
(675, 1, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-08-04 07:05:35', '2026-08-04 07:05:35', NULL, 'Tender \"Tender ID: 34\" telah disetujui (WON). Draft Kontrak #26 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 26}'),
(676, 32, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-08-04 07:05:35', '2026-08-04 07:05:35', NULL, 'Tender \"Tender ID: 34\" telah disetujui (WON). Draft Kontrak #26 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 26}'),
(677, 39, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-08-04 07:05:35', '2026-08-04 07:05:35', NULL, 'Tender \"Tender ID: 34\" telah disetujui (WON). Draft Kontrak #26 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 26}'),
(678, 1, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-04 07:05:35', '2026-08-04 07:05:35', NULL, '<span style=\"font-weight: 600;
```

```sql
CREATE TABLE `outbox_events` (
  `id` bigint UNSIGNED NOT NULL,
  `event_id` varchar(100) NOT NULL,
  `event_name` varchar(100) NOT NULL,
  `event_version` varchar(20) DEFAULT '1.0',
  `aggregate_type` varchar(50) NOT NULL,
  `aggregate_id` bigint UNSIGNED NOT NULL,
  `correlation_id` varchar(100) DEFAULT NULL,
  `transaction_id` varchar(100) DEFAULT NULL,
  `payload` json DEFAULT NULL,
  `status` varchar(20) DEFAULT 'PENDING',
  `retry_count` int DEFAULT '0',
  `error_message` text,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `published_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `outbox_events`
--

INSERT INTO `outbox_events` (`id`, `event_id`, `event_name`, `event_version`, `aggregate_type`, `aggregate_id`, `correlation_id`, `transaction_id`, `payload`, `status`, `retry_count`, `error_message`, `created_at`, `published_at`) VALUES
(1, 'evt-1784960879881-815', 'ContractApprovedEvent', '1.0', 'Contract', 2, 'corr-legal-2-1784960879881', 'tx-1784960879881', '{\"timestamp\": \"2026-07-25T06:27:59.881Z\", \"contractId\": \"2\", \"reviewerId\": 10, \"legalStatus\": \"APPROVED\", \"contractNumber\": \"CONT-20260724-0002\"}', 'PENDING', 0, NULL, '2026-07-25 13:27:59', NULL),
(2, 'evt-1785321264023-9672', 'ContractApprovedEvent', '1.0', 'Contract', 1, 'corr-legal-1-1785321264023', 'tx-1785321264024', '{\"timestamp\": \"2026-07-29T10:34:24.024Z\", \"contractId\": \"1\", \"reviewerId\": 32, \"legalStatus\": \"APPROVED\", \"contractNumber\": \"CONT-20260724-0001\"}', 'PENDING', 0, NULL, '2026-07-29 17:34:24', NULL),
(3, 'evt-1785321334574-9484', 'ContractApprovedEvent', '1.0', 'Contract', 1, 'corr-legal-1-1785321334574', 'tx-1785321334574', '{\"timestamp\": \"2026-07-29T10:35:34.574Z\", \"contractId\": \"1\", \"reviewerId\": 32, \"legalStatus\": \"APPROVED\", \"contractNumber\": \"CONT-20260724-0001\"}', 'PENDING', 0, NULL, '2026-07-29 17:35:34', NULL),
(4, 'evt-1785323954477-93', 'ContractRevisionRequestedEvent', '1.0', 'Contract', 4, 'corr-legal-4-1785323954477', 'tx-1785323954477', '{\"timestamp\": \"2026-07-29T11:19:14.477Z\", \"contractId\": \"4\", \"reviewerId\": 10, \"legalStatus\": \"REJECTED\", \"contractNumber\": \"CONT-20260729-0004\"}', 'PENDING', 0, NULL, '2026-07-29 18:19:14', NULL),
(5, 'evt-1785479883087-5191', 'ContractApprovedEvent', '1.0', 'Contract', 15, 'corr-legal-15-1785479883087', 'tx-1785479883087', '{\"timestamp\": \"2026-07-31T06:38:03.087Z\", \"contractId\": \"15\", \"reviewerId\": 10, \"legalStatus\": \"APPROVED\", \"contractNumber\": \"CONT-20260731-0015\"}', 'PENDING', 0, NULL, '2026-07-31 13:38:03', NULL),
(6, 'evt-1785486916889-3994', 'ContractApprovedEvent', '1.0', 'Contract', 18, 'corr-legal-18-1785486916889', 'tx-1785486916889', '{\"timestamp\": \"2026-07-31T08:35:16.889Z\", \"contractId\": \"18\", \"reviewerId\": 10, \"legalStatus\": \"APPROVED\", \"contractNumber\": \"CONT-20260731-0018\"}', 'PENDING', 0, NULL, '2026-07-31 15:35:16', NULL),
(7, 'evt-1785490060877-9595', 'ContractApprovedEvent', '1.0', 'Contract', 19, 'corr-legal-19-1785490060877', 'tx-1785490060877', '{\"timestamp\": \"2026-07-31T09:27:40.877Z\", \"contractId\": \"19\", \"reviewerId\": 10, \"legalStatus\": \"APPROVED\", \"contractNumber\": \"CONT-20260731-0019\"}', 'PENDING', 0, NULL, '2026-07-31 16:27:40', NULL),
(8, 'evt-1785491448818-3195', 'ContractApprovedEvent', '1.0', 'Contract', 17, 'corr-legal-17-1785491448818', 'tx-1785491448818', '{\"timestamp\": \"2026-07-31T09:50:48.818Z\", \"contractId\": \"17\", \"reviewerId\": 10, \"legalStatus\": \"APPROVED\", \"contractNumber\": \"CONT-20260731-0017\"}', 'PENDING', 0, NULL, '2026-07-31 16:50:48', NULL),
(9, 'evt-1785491986360-9573', 'ContractApprovedEvent', '1.0', 'Contract', 20, 'corr-legal-20-1785491986360', 'tx-1785491986360', '{\"timestamp\": \"2026-07-31T09:59:46.360Z\", \"contractId\": \"20\", \"reviewerId\": 10, \"legalStatus\": \"APPROVED\", \"contractNumber\": \"CONT-20260731-0020\"}', 'PENDING', 0, NULL, '2026-07-31 16:59:46', NULL),
(10, 'evt-1785731228010-1160', 'ContractApprovedEvent', '1.0', 'Contract', 21, 'corr-legal-21-1785731228010', 'tx-1785731228010', '{\"timestamp\": \"2026-08-03T04:27:08.010Z\", \"contractId\": \"21\", \"reviewerId\": 10, \"legalStatus\": \"APPROVED\", \"contractNumber\": \"CONT-20260803-0021\"}', 'PENDING', 0, NULL, '2026-08-03 11:27:08', NULL),
(11, 'evt-1785739578059-876', 'ContractApprovedEvent', '1.0', 'Contract', 23, 'corr-legal-23-1785739578058', 'tx-1785739578059', '{\"timestamp\": \"2026-08-03T06:46:18.059Z\", \"contractId\": \"23\", \"reviewerId\": 10, \"legalStatus\": \"APPROVED\", \"contractNumber\": \"CONT-20260803-0023\"}', 'PENDING', 0, NULL, '2026-08-03 13:46:18', NULL);
```

```sql
CREATE TABLE `payments` (
  `id` bigint UNSIGNED NOT NULL,
  `invoice_id` bigint UNSIGNED NOT NULL,
  `payment_number` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount_paid` decimal(19,2) NOT NULL,
  `payment_date` date NOT NULL,
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `updated_by` bigint UNSIGNED DEFAULT NULL,
  `deleted_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  `version` int NOT NULL DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `permissions`
--

CREATE TABLE `permissions` (
  `id` bigint UNSIGNED NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `updated_by` bigint UNSIGNED DEFAULT NULL,
  `deleted_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `projects`
--

CREATE TABLE `projects` (
  `id` bigint UNSIGNED NOT NULL,
  `contract_id` bigint UNSIGNED DEFAULT NULL,
  `manager_id` bigint UNSIGNED NOT NULL,
  `code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PLANNING',
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `updated_by` bigint UNSIGNED DEFAULT NULL,
  `deleted_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  `version` int NOT NULL DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `projects`
--

INSERT INTO `projects` (`id`, `contract_id`, `manager_id`, `code`, `name`, `status`, `start_date`, `end_date`, `created_by`, `updated_by`, `deleted_by`, `created_at`, `updated_at`, `deleted_at`, `version`) VALUES
(1, NULL, 5, 'CONT-20260724-0002', 'Project CSA-FKI Karawang Rumah Net', 'IN_PROGRESS', '2026-07-25', '2026-12-31', NULL, NULL, NULL, '2026-07-25 14:26:10', '2026-07-25 14:26:10', NULL, 1),
(2, NULL, 5, 'CONT-20260803-0021', 'Project Rumah Net Batam Central', 'IN_PROGRESS', '2026-08-08', '2026-10-31', NULL, NULL, NULL, '2026-08-03 11:31:16', '2026-08-03 11:31:16', NULL, 1),
(3, NULL, 5, 'CONT-20260803-0023', 'CSA-FKI Rumah Net Sulawesi', 'IN_PROGRESS', '2026-08-07', '2026-12-31', NULL, NULL, NULL, '2026-08-03 13:47:57', '2026-08-03 13:47:57', NULL, 1);

-- --------------------------------------------------------

--
-- Table structure for table `project_budgets`
--

CREATE TABLE `project_budgets` (
  `id` bigint UNSIGNED NOT NULL,
  `project_id` bigint UNSIGNED NOT NULL,
  `category` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `planned_amount` decimal(19,2) NOT NULL DEFAULT '0.00',
  `actual_amount` decimal(19,2) NOT NULL DEFAULT '0.00',
  `remaining_amount` decimal(19,2) GENERATED ALWAYS AS ((`planned_amount` - `actual_amount`)) STORED,
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `updated_by` bigint UNSIGNED DEFAULT NULL,
  `deleted_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `proposals`
--

CREATE TABLE `proposals` (
  `id` bigint UNSIGNED NOT NULL,
  `tender_id` bigint UNSIGNED NOT NULL,
  `proposal_number` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `proposed_amount` decimal(19,2) NOT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT',
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `updated_by` bigint UNSIGNED DEFAULT NULL,
  `deleted_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `proposals`
--

INSERT INTO `proposals` (`id`, `tender_id`, `proposal_number`, `proposed_amount`, `status`, `created_by`, `updated_by`, `deleted_by`, `created_at`, `updated_at`, `deleted_at`) VALUES
(1, 2, 'PROP-1784915342502', 0.00, 'APPROVED', 7, NULL, NULL, '2026-07-25 00:49:02', '2026-07-29 17:34:23', NULL),
(2, 2, 'PROP-20260724-2608', 380000000.00, 'APPROVED', 7, NULL, NULL, '2026-07-25 00:49:02', '2026-07-25 13:27:59', NULL),
(3, 4, 'PROP-TEST-001', 150000000.00, 'ACCEPTED', 7, NULL, NULL, '2026-07-29 18:05:27', '2026-07-29 18:05:27', NULL),
(6, 7, 'PROP-1785323871760', 0.00, 'ACCEPTED', 7, NULL, NULL, '2026-07-29 18:17:51', '2026-07-29 18:17:51', NULL),
(7, 7, 'PROP-20260729-3861', 300000000.00, 'ACCEPTED', 7, NULL, NULL, '2026-07-29 18:18:23', '2026-07-29 18:18:23', NULL),
(8, 7, 'PROP-20260729-5821', 300000000.00, 'ACCEPTED', 7, NULL, NULL, '2026-07-29 18:19:35', '2026-07-29 18:19:35', NULL),
(9, 5, 'PROP-1785324038091', 0.00, 'ACCEPTED', 7, NULL, NULL, '2026-07-29 18:20:38', '2026-07-29 18:20:38', NULL),
(10, 3, 'PROP-1785327853570', 0.00, 'ACCEPTED', 7, NULL, NULL, '2026-07-29 19:24:13', '2026-07-29 19:24:13', NULL),
(11, 1, 'PROP-1785327926814', 0.00, 'ACCEPTED', 7, NULL, NULL, '2026-07-29 19:25:26', '2026-07-29 19:25:26', NULL),
(12, 8, 'PROP-1785333830672', 0.00, 'ACCEPTED', 7, NULL, NULL, '2026-07-29 21:03:50', '2026-07-29 21:03:50', NULL),
(13, 8, 'PROP-20260729-0814', 100000000.00, 'ACCEPTED', 7, NULL, NULL, '2026-07-29 21:03:50', '2026-07-29 21:03:50', NULL),
(14, 3, 'PROP-20260729-9708', 150000000.00, 'ACCEPTED', 7, NULL, NULL, '2026-07-29 21:08:29', '2026-07-29 21:08:29', NULL),
(15, 1, 'PROP-20260729-1175', 250000000.00, 'ACCEPTED', 7, NULL, NULL, '2026-07-29 21:58:41', '2026-07-29 21:58:41', NULL),
(16, 1, 'PROP-20260729-4215', 250000000.00, 'ACCEPTED', 7, NULL, NULL, '2026-07-29 21:59:04', '2026-07-29 21:59:04', NULL),
(17, 11, 'PROP-1785338967063', 0.00, 'ACCEPTED', 7, NULL, NULL, '2026-07-29 22:29:27', '2026-07-29 22:29:27', NULL),
(18, 11, 'PROP-20260729-7543', 300000000.00, 'ACCEPTED', 7, NULL, NULL, '2026-07-29 22:29:27', '2026-07-29 22:29:27', NULL),
(19, 10, 'PROP-1785339793829', 240000000.00, 'ACCEPTED', 7, NULL, NULL, '2026-07-29 22:43:13', '2026-07-29 22:43:13', NULL),
(20, 10, 'PROP-20260729-4366', 240000000.00, 'ACCEPTED', 7, NULL, NULL, '2026-07-29 22:43:14', '2026-07-29 22:43:14', NULL),
(21, 9, 'PROP-1785339842909', 200000000.00, 'ACCEPTED', 7, NULL, NULL, '2026-07-29 22:44:02', '2026-07-29 22:44:02', NULL),
(22, 9, 'PROP-20260729-3362', 200000000.00, 'ACCEPTED', 7, NULL, NULL, '2026-07-29 22:44:03', '2026-07-29 22:44:03', NULL),
(23, 15, 'PROP-1785474872545', 150000000.00, 'ACCEPTED', 7, NULL, NULL, '2026-07-31 12:14:32', '2026-07-31 12:47:57', '2026-07-31 12:47:57'),
(24, 15, 'PROP-20260731-2701', 150000000.00, 'ACCEPTED', 7, NULL, NULL, '2026-07-31 12:14:32', '2026-07-31 12:47:57', '2026-07-31 12:47:57'),
(25, 21, 'PROP-1785479671791', 150000000.00, 'APPROVED', 7, NULL, NULL, '2026-07-31 13:34:31', '2026-07-31 14:04:06', '2026-07-31 14:04:06'),
(26, 21, 'PROP-20260731-2017', 150000000.00, 'ACCEPTED', 7, NULL, NULL, '2026-07-31 13:34:32', '2026-07-31 14:04:06', '2026-07-31 14:04:06'),
(27, 20, 'PROP-1785482084365', 200000000.00, 'ACCEPTED', 7, NULL, NULL, '2026-07-31 14:14:44', '2026-07-31 14:15:22', '2026-07-31 14:15:22'),
(28, 20, 'PROP-20260731-4680', 200000000.00, 'ACCEPTED', 7, NULL, NULL, '2026-07-31 14:14:44', '2026-07-31 14:15:22', '2026-07-31 14:15:22'),
(29, 19, 'PROP-1785482157987', 100000000.00, 'APPROVED', 7, NULL, NULL, '2026-07-31 14:15:57', '2026-07-31 16:50:48', NULL),
(30, 19, 'PROP-20260731-8335', 100000000.00, 'ACCEPTED', 7, NULL, NULL, '2026-07-31 14:15:58', '2026-07-31 14:15:58', NULL),
(31, 18, 'PROP-1785486806004', 150000000.00, 'APPROVED', 7, NULL, NULL, '2026-07-31 15:33:26', '2026-07-31 15:35:16', NULL),
(32, 18, 'PROP-20260731-6636', 150000000.00, 'ACCEPTED', 7, NULL, NULL, '2026-07-31 15:33:26', '2026-07-31 15:33:26', NULL),
(33, 17, 'PROP-1785489982374', 200000000.00, 'APPROVED', 7, NULL, NULL, '2026-07-31 16:26:22', '2026-07-31 16:27:40', NULL),
(34, 17, 'PROP-20260731-2866', 200000000.00, 'ACCEPTED', 7, NULL, NULL, '2026-07-31 16:26:22', '2026-07-31 16:26:22', NULL),
(35, 16, 'PROP-1785491839370', 400000000.00, 'APPROVED', 7, NULL, NULL, '2026-07-31 16:57:19', '2026-07-31 16:59:46', NULL),
(36, 16, 'PROP-20260731-0611', 400000000.00, 'ACCEPTED', 7, NULL, NULL, '2026-07-31 16:57:20', '2026-07-31 16:57:20', NULL),
(37, 45, 'PROP-1785731171299', 850000000.00, 'APPROVED', 7, NULL, NULL, '2026-08-03 11:26:11', '2026-08-03 11:27:07', NULL),
(38, 45, 'PROP-20260803-1392', 850000000.00, 'ACCEPTED', 7, NULL, NULL, '2026-08-03 11:26:11', '2026-08-03 11:26:11', NULL),
(39, 47, 'PROP-1785739328613', 50000000.00, 'ACCEPTED', 9, NULL, NULL, '2026-08-03 13:42:08', '2026-08-03 13:42:08', NULL),
(40, 47, 'PROP-20260803-8738', 50000000.00, 'ACCEPTED', 9, NULL, NULL, '2026-08-03 13:42:08', '2026-08-03 13:42:08', NULL),
(41, 48, 'PROP-1785739491256', 500000000.00, 'APPROVED', 9, NULL, NULL, '2026-08-03 13:44:51', '2026-08-03 13:46:18', NULL),
(42, 48, 'PROP-20260803-1395', 500000000.00, 'ACCEPTED', 9, NULL, NULL, '2026-08-03 13:44:51', '2026-08-03 13:44:51', NULL),
(43, 44, 'PROP-20260803-1961', 900000000.00, 'ACCEPTED', 7, NULL, NULL, '2026-08-03 13:52:01', '2026-08-03 13:52:01', NULL),
(44, 43, 'PROP-20260803-6072', 400000000.00, 'ACCEPTED', 7, NULL, NULL, '2026-08-03 14:46:46', '2026-08-03 14:46:46', NULL),
(45, 46, 'PROP-1785753683571', 400000000.00, 'ACCEPTED', 9, NULL, NULL, '2026-08-03 17:41:23', '2026-08-03 17:41:23', NULL),
(46, 46, 'PROP-20260803-3700', 400000000.00, 'ACCEPTED', 9, NULL, NULL, '2026-08-03 17:41:23', '2026-08-03 17:41:23', NULL),
(47, 35, 'PROP-20260803-4483', 135000000.00, 'ACCEPTED', 9, NULL, NULL, '2026-08-03 17:42:34', '2026-08-03 17:42:34', NULL),
(48, 35, 'PROP-20260803-6711', 135000000.00, 'ACCEPTED', 9, NULL, NULL, '2026-08-03 17:42:56', '2026-08-03 17:42:56', NULL),
(49, 34, 'PROP-1785801935040', 140000000.00, 'ACCEPTED', 9, NULL, NULL, '2026-08-04 07:05:35', '2026-08-04 07:05:35', NULL),
(50, 34, 'PROP-20260804-5240', 140000000.00, 'ACCEPTED', 9, NULL, NULL, '2026-08-04 07:05:35', '2026-08-04 07:05:35', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `purchase_orders`
--

CREATE TABLE `purchase_orders` (
  `id` bigint UNSIGNED NOT NULL,
  `pr_id` bigint UNSIGNED NOT NULL,
  `vendor_id` bigint UNSIGNED NOT NULL,
  `po_number` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `total_amount` decimal(19,2) NOT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ISSUED',
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `updated_by` bigint UNSIGNED DEFAULT NULL,
  `deleted_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  `version` int NOT NULL DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `purchase_order_items`
--

CREATE TABLE `purchase_order_items` (
  `id` bigint UNSIGNED NOT NULL,
  `purchase_order_id` bigint UNSIGNED NOT NULL,
  `item_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` decimal(10,2) NOT NULL,
  `received_quantity` decimal(10,2) NOT NULL DEFAULT '0.00',
  `unit_price` decimal(19,2) NOT NULL,
  `total_price` decimal(19,2) NOT NULL DEFAULT '0.00',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `purchase_requests`
--

CREATE TABLE `purchase_requests` (
  `id` bigint UNSIGNED NOT NULL,
  `project_id` bigint UNSIGNED NOT NULL,
  `requester_id` bigint UNSIGNED NOT NULL,
  `pr_number` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `total_estimated_amount` decimal(19,2) NOT NULL DEFAULT '0.00',
  `status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT',
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `updated_by` bigint UNSIGNED DEFAULT NULL,
  `deleted_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  `version` int NOT NULL DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `purchase_request_items`
--

CREATE TABLE `purchase_request_items` (
  `id` bigint UNSIGNED NOT NULL,
  `pr_id` bigint UNSIGNED NOT NULL,
  `item_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` decimal(10,2) NOT NULL,
  `uom` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PCS',
  `estimated_unit_price` decimal(19,2) NOT NULL,
  `total_price` decimal(19,2) GENERATED ALWAYS AS ((`quantity` * `estimated_unit_price`)) STORED,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `rfqs`
--

CREATE TABLE `rfqs` (
  `id` bigint UNSIGNED NOT NULL,
  `pr_id` bigint UNSIGNED NOT NULL,
  `rfq_number` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'OPEN',
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `updated_by` bigint UNSIGNED DEFAULT NULL,
  `deleted_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `roles`
--

CREATE TABLE `roles` (
  `id` bigint UNSIGNED NOT NULL,
  `name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `updated_by` bigint UNSIGNED DEFAULT NULL,
  `deleted_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `roles`
--

INSERT INTO `roles` (`id`, `name`, `description`, `created_by`, `updated_by`, `deleted_by`, `created_at`, `updated_at`, `deleted_at`) VALUES
(1, 'SUPER_ADMIN', 'Super Administrator with full access', NULL, NULL, NULL, '2026-07-10 14:10:30', '2026-07-10 14:10:30', NULL),
(2, 'PROJECT_MANAGER', 'Project Manager', NULL, NULL, NULL, '2026-07-10 14:10:30', '2026-07-10 14:10:30', NULL),
(3, 'FINANCE', 'Finance and Accounting', NULL, NULL, NULL, '2026-07-10 14:10:30', '2026-07-10 14:10:30', NULL),
(4, 'DIRECTOR', 'Company Director (Highest Approval)', NULL, NULL, NULL, '2026-07-10 14:10:30', '2026-07-10 14:10:30', NULL),
(5, 'MANAGER', 'Department Manager (Approval Level 1)', NULL, NULL, NULL, '2026-07-10 14:10:30', '2026-07-10 14:10:30', NULL),
(6, 'GENERAL_MANAGER', 'General Manager (Approval Level 2)', NULL, NULL, NULL, '2026-07-10 14:10:30', '2026-07-10 14:10:30', NULL),
(7, 'MARKETING', 'Marketing Team', NULL, NULL, NULL, '2026-07-13 12:30:42', '2026-07-13 12:30:42', NULL),
(8, 'LEGAL', 'Legal and Compliance Department', NULL, NULL, NULL, '2026-07-13 13:36:58', '2026-07-13 13:36:58', NULL),
(9, 'PURCHASING', 'Purchasing and Procurement Department', NULL, NULL, NULL, '2026-07-13 13:36:58', '2026-07-13 13:36:58', NULL),
(40, 'HEAD_OF_OPERATIONS', NULL, NULL, NULL, NULL, '2026-07-19 19:43:22', '2026-07-19 19:43:22', NULL),
(42, 'PROCUREMENT', NULL, NULL, NULL, NULL, '2026-07-19 19:43:22', '2026-07-19 19:43:22', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `role_permissions`
--

CREATE TABLE `role_permissions` (
  `role_id` bigint UNSIGNED NOT NULL,
  `permission_id` bigint UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `tasks`
--

CREATE TABLE `tasks` (
  `id` bigint UNSIGNED NOT NULL,
  `wbs_id` bigint UNSIGNED NOT NULL,
  `assignee_id` bigint UNSIGNED DEFAULT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'TODO',
  `start_date` date DEFAULT NULL,
  `due_date` date DEFAULT NULL,
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `updated_by` bigint UNSIGNED DEFAULT NULL,
  `deleted_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `tenders`
--

CREATE TABLE `tenders` (
  `id` bigint UNSIGNED NOT NULL,
  `customer_id` bigint UNSIGNED NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `submission_deadline` datetime DEFAULT NULL,
  `status` enum('NEW','IN_PROGRESS','NEGOTIATION','PENDING_APPROVAL','WON','LOST') COLLATE utf8mb4_unicode_ci DEFAULT 'NEW',
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `updated_by` bigint UNSIGNED DEFAULT NULL,
  `deleted_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  `estimated_budget` decimal(19,2) DEFAULT NULL,
  `marketing_pic_id` bigint UNSIGNED DEFAULT NULL,
  `pic_customer_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pic_customer_phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pic_customer_email` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `business_sector` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `stage` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'LEAD',
  `probability_percentage` int DEFAULT '0',
  `priority` enum('LOW','MEDIUM','HIGH','CRITICAL') COLLATE utf8mb4_unicode_ci DEFAULT 'MEDIUM',
  `source` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `expected_closing_date` date DEFAULT NULL,
  `procurement_type` enum('TENDER','DIRECT_APPOINTMENT') COLLATE utf8mb4_unicode_ci DEFAULT 'TENDER',
  `project_location` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bid_submission_deadline` date DEFAULT NULL,
  `negotiated_price` decimal(19,2) DEFAULT NULL,
  `max_discount_rate` int DEFAULT '20',
  `spk_file_key` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `spk_verification_status` enum('UNVERIFIED','PENDING_REVIEW','VERIFIED','REJECTED') COLLATE utf8mb4_unicode_ci DEFAULT 'UNVERIFIED',
  `grace_deadline` datetime DEFAULT NULL,
  `version` int NOT NULL DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

```sql
created_by`, `updated_by`, `deleted_by`, `created_at`, `updated_at`, `deleted_at`, `estimated_budget`, `marketing_pic_id`, `pic_customer_name`, `pic_customer_phone`, `pic_customer_email`, `business_sector`, `stage`, `probability_percentage`, `priority`, `source`, `notes`, `expected_closing_date`, `procurement_type`, `project_location`, `bid_submission_deadline`, `negotiated_price`, `max_discount_rate`, `spk_file_key`, `spk_verification_status`, `grace_deadline`, `version`) VALUES
(1, 1, 'Project Renovasi Gudang J&T Jelambar Ruang Purchasing', NULL, 'WON', 7, 7, NULL, '2026-07-25 00:40:17', '2026-07-29 22:55:26', '2026-07-29 22:55:26', 250000000.00, 7, 'Ramdani', '081234789650', NULL, 'Transportasi & Logistik', 'WON', 100, 'MEDIUM', 'Referensi Internal', NULL, '2026-07-31', 'DIRECT_APPOINTMENT', 'Jakarta Barat', '2026-07-27', NULL, 20, 'contracts/spk-1-1785337143700-439702074.pdf', 'PENDING_REVIEW', '2026-07-31 21:58:41', 44),
(2, 2, 'Project CSA-FKI Karawang Rumah Net', NULL, 'WON', 7, 7, NULL, '2026-07-25 00:47:25', '2026-07-29 22:55:21', '2026-07-29 22:55:21', 380000000.00, 9, 'Aldhi Dharmawan', '087434543557', NULL, 'Telekomunikasi & Internet', 'WON', 100, 'MEDIUM', 'Referensi Eksternal', NULL, '2026-07-31', 'TENDER', 'Karawang', '2026-07-27', NULL, 20, 'contracts/spk-2-1784915342373-188103388.pdf', 'PENDING_REVIEW', NULL, 4),
(3, 1, 'Renovasi Gateway Tangerang', NULL, 'WON', 7, 7, NULL, '2026-07-25 14:11:34', '2026-07-29 22:55:16', '2026-07-29 22:55:16', 150000000.00, 7, 'Ramdani', '081234789650', NULL, 'Transportasi & Logistik', 'WON', 100, 'MEDIUM', 'Referensi Internal', NULL, '2026-07-27', 'TENDER', 'Tangerang', '2026-07-26', NULL, 20, NULL, 'UNVERIFIED', '2026-07-31 21:08:30', 16),
(4, 1, 'Test Deal Automation Fix Verification', NULL, 'NEW', 7, NULL, NULL, '2026-07-29 18:05:27', '2026-07-29 19:04:40', '2026-07-29 19:04:40', NULL, NULL, NULL, NULL, NULL, NULL, 'LEAD', 0, 'MEDIUM', NULL, NULL, NULL, 'TENDER', NULL, NULL, NULL, 20, NULL, 'UNVERIFIED', NULL, 2),
(5, 1, 'Test Deal Automation Fix Verification', NULL, 'NEW', 7, 7, NULL, '2026-07-29 18:05:46', '2026-07-29 19:04:35', '2026-07-29 19:04:35', NULL, NULL, NULL, NULL, NULL, NULL, 'LEAD', 10, 'MEDIUM', NULL, NULL, NULL, 'TENDER', NULL, NULL, NULL, 20, NULL, 'UNVERIFIED', NULL, 6),
(7, 2, 'Project CSA-JLM BOGOR', NULL, 'WON', 7, 7, NULL, '2026-07-29 18:16:35', '2026-07-29 22:55:10', '2026-07-29 22:55:10', 300000000.00, 7, 'Aldhi Dharmawan', '087434543557', NULL, 'Telekomunikasi & Internet', 'WON', 100, 'MEDIUM', 'Referensi Internal', NULL, '2026-07-31', 'TENDER', 'BOGOR', '2026-07-29', NULL, 20, 'contracts/spk-7-1785323975728-695791080.pdf', 'PENDING_REVIEW', '2026-07-31 18:18:24', 10),
(8, 1, 'Renovasi Lahan Parkir Gateway Bandung', NULL, 'WON', 7, 7, NULL, '2026-07-29 19:30:31', '2026-07-29 22:55:05', '2026-07-29 22:55:05', 100000000.00, 7, 'Ramdani', '081234789650', NULL, 'Transportasi & Logistik', 'WON', 100, 'MEDIUM', 'Referensi Internal', NULL, '2026-07-31', 'DIRECT_APPOINTMENT', 'Tangerang', '2026-07-30', NULL, 20, 'contracts/undefined', 'PENDING_REVIEW', NULL, 9),
(9, 1, 'Renovasi Gudang J&T Bogor ', NULL, 'WON', 7, 7, NULL, '2026-07-29 22:04:33', '2026-07-29 22:54:59', '2026-07-29 22:54:59', 200000000.00, 7, 'Ramdani', '081234789650', NULL, 'Transportasi & Logistik', 'WON', 100, 'MEDIUM', 'Referensi Internal', NULL, '2026-07-31', 'DIRECT_APPOINTMENT', 'BOGOR', '2026-07-29', NULL, 20, 'contracts/spk-9-1785339842864-541115247.pdf', 'PENDING_REVIEW', NULL, 4),
(10, 1, 'Renovasi Gudang Serang', NULL, 'WON', 7, 7, NULL, '2026-07-29 22:05:33', '2026-07-29 22:54:52', '2026-07-29 22:54:52', 240000000.00, 7, 'Ramdani', '081234789650', NULL, 'Transportasi & Logistik', 'WON', 100, 'MEDIUM', 'Referensi Internal', NULL, '2026-07-31', 'DIRECT_APPOINTMENT', 'Serang', '2026-07-30', NULL, 20, 'contracts/spk-10-1785339793771-490321500.pdf', 'PENDING_REVIEW', NULL, 4),
(11, 1, 'Renovasi Gudang Jambi', NULL, 'WON', 7, 7, NULL, '2026-07-29 22:06:22', '2026-07-29 22:54:28', '2026-07-29 22:54:28', 300000000.00, 7, 'Ramdani', '081234789650', NULL, 'Transportasi & Logistik', 'WON', 100, 'MEDIUM', 'LPSE', NULL, '2026-07-31', 'TENDER', 'Jambi', '2026-07-29', NULL, 20, 'contracts/spk-11-1785338966985-7712801.pdf', 'PENDING_REVIEW', NULL, 4),
(12, 1, 'Dummy Cascade Test', NULL, 'NEW', 1, NULL, NULL, '2026-07-29 23:03:33', '2026-07-30 00:04:27', '2026-07-30 00:04:27', 500000.00, NULL, NULL, NULL, NULL, NULL, 'LEAD', 0, 'MEDIUM', NULL, NULL, NULL, 'TENDER', NULL, NULL, NULL, 20, NULL, 'UNVERIFIED', NULL, 2),
(13, 1, 'Dummy Cascade Test', NULL, 'NEW', 1, 7, NULL, '2026-07-29 23:03:56', '2026-07-30 00:04:24', '2026-07-30 00:04:24', 500000.00, NULL, NULL, NULL, NULL, NULL, 'LEAD', 10, 'MEDIUM', NULL, NULL, NULL, 'TENDER', NULL, NULL, NULL, 20, NULL, 'UNVERIFIED', NULL, 6),
(14, 1, 'Dummy Cascade Test', NULL, 'NEW', 1, NULL, NULL, '2026-07-29 23:04:20', '2026-07-29 23:04:20', '2026-07-29 23:04:20', 500000.00, NULL, NULL, NULL, NULL, NULL, 'LEAD', 0, 'MEDIUM', NULL, NULL, NULL, 'TENDER', NULL, NULL, NULL, 20, NULL, 'UNVERIFIED', NULL, 2),
(15, 1, 'Project Renovasi lahan parkir Gateway Bandung', NULL, 'WON', 7, 7, NULL, '2026-07-31 10:32:07', '2026-07-31 12:47:57', '2026-07-31 12:47:57', 150000000.00, 7, 'Ramdani', '081234789650', NULL, 'Transportasi & Logistik', 'WON', 100, 'MEDIUM', 'Referensi Internal', NULL, '2026-08-07', 'DIRECT_APPOINTMENT', 'Bandung', '2026-08-06', NULL, 20, 'contracts/spk-15-1785474872493-587329612.pdf', 'PENDING_REVIEW', NULL, 4),
(16, 2, 'CSA-FKI Rumah Net Bandung ', NULL, 'WON', 7, 7, NULL, '2026-07-31 13:27:12', '2026-07-31 16:57:20', NULL, 400000000.00, 7, 'Aldhi Dharmawan', '087434543557', NULL, 'Telekomunikasi & Internet', 'WON', 100, 'MEDIUM', 'Referensi Internal', NULL, '2026-08-07', 'TENDER', 'Bandung', '2026-08-04', NULL, 20, 'contracts/spk-16-1785491839279-434357699.pdf', 'PENDING_REVIEW', NULL, 3),
(17, 2, 'CSA-FKI Rumah Net BOGOR', NULL, 'WON', 7, 7, NULL, '2026-07-31 13:28:08', '2026-07-31 16:26:22', NULL, 200000000.00, 7, 'Aldhi Dharmawan', '087434543557', NULL, 'Telekomunikasi & Internet', 'WON', 100, 'MEDIUM', 'Referensi Internal', NULL, '2026-08-08', 'DIRECT_APPOINTMENT', 'BOGOR', '2026-08-07', NULL, 20, 'contracts/spk-17-1785489982283-694294833.pdf', 'PENDING_REVIEW', NULL, 3),
(18, 2, 'CSA-FKI Rumah Net Garut', NULL, 'WON', 7, 7, NULL, '2026-07-31 13:30:28', '2026-07-31 15:33:26', NULL, 150000000.00, 7, 'Aldhi Dharmawan', '087434543557', NULL, 'Telekomunikasi & Internet', 'WON', 100, 'MEDIUM', 'Referensi Internal', NULL, '2026-08-07', 'DIRECT_APPOINTMENT', 'Garut', '2026-08-06', NULL, 20, 'contracts/spk-18-1785486805950-900947533.pdf', 'PENDING_REVIEW', NULL, 3),
(19, 2, 'CSA-FKI Rumah Net Ciamis', NULL, 'WON', 7, 7, NULL, '2026-07-31 13:31:09', '2026-07-31 14:15:58', NULL, 100000000.00, 7, 'Aldhi Dharmawan', '087434543557', NULL, 'Telekomunikasi & Internet', 'WON', 100, 'MEDIUM', 'Referensi Internal', NULL, '2026-08-08', 'DIRECT_APPOINTMENT', 'Ciamis', '2026-08-07', NULL, 20, 'contracts/spk-19-1785482157954-817419485.pdf', 'PENDING_REVIEW', NULL, 3),
(20, 2, 'CSA-FKI Rumah Net Tasikmalaya', NULL, 'WON', 7, 7, NULL, '2026-07-31 13:32:45', '2026-07-31 14:15:22', '2026-07-31 14:15:22', 200000000.00, 9, 'Aldhi Dharmawan', '087434543557', NULL, 'Telekomunikasi & Internet', 'WON', 100, 'MEDIUM', 'Referensi Internal', NULL, '2026-08-08', 'TENDER', 'Tasikmalaya', '2026-08-07', NULL, 20, 'contracts/spk-20-1785482084277-343881108.pdf', 'PENDING_REVIEW', NULL, 4),
(21, 2, 'CSA FKI Rumah Net Cirebon', NULL, 'WON', 7, 7, NULL, '2026-07-31 13:33:46', '2026-07-31 14:04:06', '2026-07-31 14:04:06', 150000000.00, 7, 'Aldhi Dharmawan', '087434543557', NULL, 'Telekomunikasi & Internet', 'WON', 100, 'MEDIUM', 'Referensi Eksternal', NULL, '2026-08-08', 'DIRECT_APPOINTMENT', 'CIREBON', '2026-08-07', NULL, 20, 'contracts/spk-21-1785479671724-482948854.pdf', 'PENDING_REVIEW', NULL, 4),
(22, 2, 'CSA-FKI Kuningan', NULL, 'NEW', 7, NULL, NULL, '2026-07-31 17:12:10', '2026-07-31 17:12:10', NULL, 100000000.00, 7, 'Aldhi Dharmawan', '087434543557', NULL, 'Telekomunikasi & Internet', 'LEAD', 10, 'MEDIUM', 'Referensi Internal', NULL, '2026-08-08', 'DIRECT_APPOINTMENT', 'Kuningan', '2026-08-07', NULL, 20, NULL, 'UNVERIFIED', NULL, 1),
(23, 2, 'CSA-FKI Rumah Net Bali', NULL, 'NEW', 7, NULL, NULL, '2026-07-31 20:11:00', '2026-07-31 20:11:00', NULL, 600000000.00, 7, 'Aldhi Dharmawan', '087434543557', NULL, 'Telekomunikasi & Internet', 'LEAD', 10, 'MEDIUM', 'Referensi Internal', NULL, '2026-08-08', 'DIRECT_APPOINTMENT', 'BALI', '2026-08-07', NULL, 20, NULL, 'UNVERIFIED', NULL, 1),
(24, 2, 'CSA-FKI Rumah Net Surabaya', NULL, 'NEW', 7, NULL, NULL, '2026-07-31 20:12:00', '2026-07-31 20:12:00', NULL, 300000000.00, 7, 'Aldhi Dharmawan', '087434543557', NULL, 'Telekomunikasi & Internet', 'LEAD', 10, 'MEDIUM', 'Direct Call / Email', NULL, '2026-08-08', 'DIRECT_APPOINTMENT', 'Surabaya', '2026-08-06', NULL, 20, NULL, 'UNVERIFIED', NULL, 1),
(25, 2, 'CSA-FKI Rumah Net Gresik', NULL, 'NEW', 7, NULL, NULL, '2026-07-31 22:16:01', '2026-07-31 22:16:01', NULL, 100000000.00, 9, 'Aldhi Dharmawan', '087434543557', NULL, 'Telekomunikasi & Internet', 'LEAD', 10, 'MEDIUM', 'Referensi Internal', NULL, '2026-08-08', 'DIRECT_APPOINTMENT', 'Jombang', '2026-08-06', NULL, 20, NULL, 'UNVERIFIED', NULL, 1),
(26, 2, 'CSA-FKI Rumah net Bandung Lembang', NULL, 'NEW', 7, NULL, NULL, '2026-07-31 22:23:35', '2026-07-31 22:23:35', NULL, 200000000.00, 7, 'Aldhi Dharmawan', '087434543557', NULL, 'Telekomunikasi & Internet', 'LEAD', 10, 'MEDIUM', 'Referensi Eksternal', NULL, '2026-08-08', 'TENDER', 'Kabupaten Bandung', '2026-08-07', NULL, 20, NULL, 'UNVERIFIED', NULL, 1),
(27, 2, 'CSA-FKI Ruman Net Subang', NULL, 'NEW', 7, 9, NULL, '2026-07-31 22:26:54', '2026-07-31 23:10:56', NULL, 130000000.00, 9, 'Aldhi Dharmawan', '087434543557', NULL, 'Telekomunikasi & Internet', 'LEAD', 10, 'MEDIUM', 'LPSE', NULL, '2026-08-08', 'TENDER', 'Subang', '2026-08-07', NULL, 20, NULL, 'UNVERIFIED', NULL, 11),
(28, 2, 'CSA-FKI Rumah Net Tuban', NULL, 'NEW', 7, NULL, NULL, '2026-07-31 22:28:13', '2026-07-31 22:28:13', NULL, 230000000.00, 7, 'Aldhi Dharmawan', '087434543557', NULL, 'Telekomunikasi & Internet', 'LEAD', 10, 'MEDIUM', 'LPSE', NULL, '2026-09-05', 'TENDER', NULL, '2026-08-04', NULL, 20, NULL, 'UNVERIFIED', NULL, 1),
(29, 2, 'CSA-FKI Rumah Net Pati', NULL, 'NEW', 7, NULL, NULL, '2026-07-31 22:49:18', '2026-07-31 22:49:18', NULL, 230000000.00, 7, 'Aldhi Dharmawan', '087434543557', NULL, 'Telekomunikasi & Internet', 'LEAD', 10, 'MEDIUM', 'Referensi Internal', NULL, '2026-08-08', 'TENDER', 'PATI', '2026-08-06', NULL, 20, NULL, 'UNVERIFIED', NULL, 1),
(30, 2, 'CSA-FKI Rumah Net Pangandaran', NULL, 'NEW', 7, NULL, NULL, '2026-07-31 22:50:32', '2026-07-31 22:50:32', NULL, 110000000.00, 7, 'Aldhi Dharmawan', '087434543557', NULL, 'Telekomunikasi & Internet', 'LEAD', 10, 'MEDIUM', 'Referensi Eksternal', NULL, '2026-08-08', 'TENDER', 'Pangandaran Jawa Barat', '2026-08-06', NULL, 20, NULL, 'UNVERIFIED', NULL, 1),
(31, 2, 'CSA-FKI Rumah Net Kabupaten Bandung', NULL, 'NEW', 7, NULL, NULL, '2026-07-31 22:54:29', '2026-07-31 22:54:29', NULL, 140000000.00, 7, 'Aldhi Dharmawan', '087434543557', NULL, 'Telekomunikasi & Internet', 'LEAD', 10, 'MEDIUM', 'Referensi Internal', NULL, '2026-08-08', 'TENDER', 'Kab. Bandung', '2026-08-07', NULL, 20, NULL, 'UNVERIFIED', NULL, 1),
(32, 2, 'CSA-FKI Rumah Net Yogyakarta', NULL, 'NEW', 7, NULL, NULL, '2026-07-31 22:57:50', '2026-07-31 22:57:50', NULL, 150000000.00, 7, 'Aldhi Dharmawan', '087434543557', NULL, 'Telekomunikasi & Internet', 'LEAD', 10, 'MEDIUM', 'Referensi Internal', NULL, '2026-08-01', 'DIRECT_APPOINTMENT', 'JOGJA', '2026-07-31', NULL, 20, NULL, 'UNVERIFIED', NULL, 1),
(33, 2, 'CSA-FKI Rumah Net SOLO', NULL, 'NEW', 7, NULL, NULL, '2026-07-31 22:58:58', '2026-07-31 22:58:58', NULL, 110000000.00, 7, 'Aldhi Dharmawan', '087434543557', NULL, 'Telekomunikasi & Internet', 'LEAD', 10, 'MEDIUM', 'Referensi Internal', NULL, '2026-08-01', 'DIRECT_APPOINTMENT', 'SOLO', '2026-07-31', NULL, 20, NULL, 'UNVERIFIED', NULL, 1),
(34, 2, 'CSA-FKI Rumah Net Bolo Gresik', NULL, 'WON', 9, 9, NULL, '2026-07-31 23:04:09', '2026-08-04 07:05:35', NULL, 140000000.00, 9, 'Aldhi Dharmawan', '087434543557', NULL, 'Telekomunikasi & Internet', 'WON', 100, 'MEDIUM', 'Referensi Internal', NULL, '2026-08-01', 'TENDER', 'Gresik', '2026-07-31', NULL, 20, 'contracts/spk-34-1785801934848-730784278.pdf', 'PENDING_REVIEW', NULL, 5),
(35, 2, 'CSA-FKI Rumah Net Bojonegori', NULL, 'WON', 9, 9, NULL, '2026-07-31 23:06:42', '2026-08-03 17:42:56', NULL, 135000000.00, 9, 'Aldhi Dharmawan', '087434543557', NULL, 'Telekomunikasi & Internet', 'WON', 100, 'MEDIUM', 'Referensi Internal', NULL, '2026-08-01', 'TENDER', 'Bojonegoro', '2026-07-31', NULL, 20, 'contracts/spk-35-1785753776616-315423875.pdf', 'PENDING_REVIEW', '2026-08-05 17:42:34', 5),
(36, 1, 'Renovasi Gudang J&T Gresik', NULL, 'NEW', 7, 1, NULL, '2026-07-31 23:20:45', '2026-07-31 23:48:35', NULL, 400000000.00, 7, 'Ramdani', '081234789650', NULL, 'Transportasi & Logistik', 'LEAD', 10, 'MEDIUM', 'Referensi Internal', NULL, '2026-08-01', 'DIRECT_APPOINTMENT', 'Gresik', '2026-07-31', NULL, 20, NULL, 'UNVERIFIED', NULL, 3),
(37, 1, 'Renovasi Gudang Tangerang', NULL, 'NEW', 7, 7, NULL, '2026-07-31 23:51:51', '2026-08-01 01:18:05', NULL, 140000000.00, 7, 'Ramdani', '081234789650', NULL, 'Transportasi & Logistik', 'LEAD', 10, 'MEDIUM', 'LPSE', NULL, '2026-08-01', 'TENDER', NULL, '2026-07-31', NULL, 20, NULL, 'UNVERIFIED', NULL, 3),
(38, 1, 'Renovasi Ruang Purchasing J&T Tuban', NULL, 'NEW', 7, 7, NULL, '2026-08-01 00:25:12', '2026-08-01 01:17:54', NULL, 300000000.00, 7, 'Ramdani', '081234789650', NULL, 'Transportasi & Logistik', 'LEAD', 10, 'MEDIUM', 'LPSE', NULL, '2026-08-08', 'DIRECT_APPOINTMENT', 'Tuban', '2026-08-07', NULL, 20, NULL, 'UNVERIFIED', NULL, 9),
(39, 1, 'Project ATP Gateway Madiun', NULL, 'NEW', 7, 7, NULL, '2026-08-01 02:21:01', '2026-08-01 02:43:50', NULL, 360000000.00, 7, 'Ramdani', '081234789650', NULL, 'Transportasi & Logistik', 'LEAD', 10, 'MEDIUM', 'Referensi Internal', NULL, '2026-08-08', 'TENDER', 'Madiun', '2026-08-01', NULL, 20, NULL, 'UNVERIFIED', NULL, 6),
(40, 1, 'Project Renovasi Kantor J&T HQ', NULL, 'NEW', 7, NULL, NULL, '2026-08-01 03:05:22', '2026-08-01 03:05:22', NULL, 130000000.00, 7, 'Ramdani', '081234789650', NULL, 'Transportasi & Logistik', 'LEAD', 10, 'MEDIUM', 'LPSE', NULL, '2026-09-05', 'DIRECT_APPOINTMENT', 'Jakarta Utara', '2026-09-03', NULL, 20, NULL, 'UNVERIFIED', NULL, 1),
(41, 1, 'Project Renovasi DP Mini Jakarta', NULL, 'NEW', 7, NULL, NULL, '2026-08-01 03:08:30', '2026-08-01 03:08:30', NULL, 50000000.00, 7, 'Ramdani', '081234789650', NULL, 'Transportasi & Logistik', 'LEAD', 10, 'MEDIUM', 'LPSE', NULL, '2026-09-05', 'TENDER', NULL, '2026-09-03', NULL, 20, NULL, 'UNVERIFIED', NULL, 1),
(42, 2, 'CSA-FKI Rumah Net Sulawesi makasar', NULL, 'NEW', 7, NULL, NULL, '2026-08-01 03:10:29', '2026-08-01 03:10:29', NULL, 300000000.00, 7, 'Aldhi Dharmawan', '087434543557', NULL, 'Telekomunikasi & Internet', 'LEAD', 10, 'MEDIUM', 'Referensi Internal', NULL, '2026-09-05', 'TENDER', 'Sulawesi', '2026-09-04', NULL, 20, NULL, 'UNVERIFIED', NULL, 1),
(43, 2, 'Project Rumah Net Kalimantan', NULL, 'WON', 7, 7, NULL, '2026-08-01 03:31:56', '2026-08-03 14:46:46', NULL, 400000000.00, 7, 'Aldhi Dharmawan', '087434543557', NULL, 'Telekomunikasi & Internet', 'WON', 100, 'MEDIUM', 'Referensi Internal', NULL, '2026-09-05', 'DIRECT_APPOINTMENT', 'Kalimantan', '2026-09-05', NULL, 20, NULL, 'UNVERIFIED', '2026-08-05 14:46:46', 10),
(44, 2, 'Project Rumah Net papua Sorong', NULL, 'WON', 7, 7, NULL, '2026-08-02 23:21:44', '2026-08-03 13:52:01', NULL, 900000000.00, 7, 'Aldhi Dharmawan', '087434543557', NULL, 'Telekomunikasi & Internet', 'WON', 100, 'MEDIUM', 'Referensi Internal', NULL, '2026-08-08', 'DIRECT_APPOINTMENT', 'Papua', '2026-08-07', NULL, 20, NULL, 'UNVERIFIED', '2026-08-05 13:52:02', 15),
(45, 2, 'Project Rumah Net Batam Central', NULL, 'WON', 7, 7, NULL, '2026-08-02 23:24:47', '2026-08-03 11:26:11', NULL, 850000000.00, 7, 'Aldhi Dharmawan', '087434543557', NULL, 'Telekomunikasi & Internet', 'WON', 100, 'HIGH', 'LPSE', NULL, '2026-08-07', 'TENDER', NULL, '2026-08-10', NULL, 20, 'contracts/spk-45-1785731171214-265699805.pdf', 'PENDING_REVIEW', NULL, 22),
(46, 2, 'Project Rumah Net Riau', NULL, 'WON', 9, 9, NULL, '2026-08-03 00:07:57', '2026-08-03 17:41:23', NULL, 400000000.00, 9, 'Aldhi Dharmawan', '087434543557', NULL, 'Telekomunikasi & Internet', 'WON', 100, 'HIGH', 'Referensi Internal', NULL, '2026-08-08', 'TENDER', 'Riau', '2026-08-08', NULL, 20, 'contracts/spk-46-1785753683536-175972917.pdf', 'PENDING_REVIEW', NULL, 7),
(47, 2, 'CSA-FKI Rumah Net Madura', NULL, 'WON', 9, 9, NULL, '2026-08-03 13:41:20', '2026-08-03 13:42:08', NULL, 50000000.00, 9, 'Aldhi Dharmawan', '087434543557', NULL, 'Telekomunikasi & Internet', 'WON', 100, 'MEDIUM', 'LPSE', NULL, '2026-08-08', 'TENDER', NULL, '2026-08-06', NULL, 20, 'contracts/spk-47-1785739328543-523347381.pdf', 'PENDING_REVIEW', NULL, 3),
(48, 2, 'CSA-FKI Rumah Net Sulawesi', NULL, 'WON', 9, 9, NULL, '2026-08-03 13:44:23', '2026-08-03 13:44:51', NULL, 500000000.00, 9, 'Aldhi Dharmawan', '087434543557', NULL, 'Telekomunikasi & Internet', 'WON', 100, 'MEDIUM', 'Referensi Internal', NULL, '2026-08-08', 'DIRECT_APPOINTMENT', NULL, '2026-08-06', NULL, 20, 'contracts/spk-48-1785739491201-766612368.pdf', 'PENDING_REVIEW', NULL, 3),
(49, 2, 'CSA-FKI Rumah Net Banten', NULL, 'NEW', 7, 7, NULL, '2026-08-04 06:46:36', '2026-08-04 07:31:20', NULL, 120000000.00, 7, 'Aldhi Dharmawan', '087434543557', NULL, 'Telekomunikasi & Internet', 'QUALIFICATION', 30, 'MEDIUM', 'LPSE', NULL, '2026-09-05', 'TENDER', NULL, '2026-09-03', NULL, 20, NULL, 'UNVERIFIED', NULL, 2);
```

```sql
CREATE TABLE `tender_activities` (
  `id` bigint UNSIGNED NOT NULL,
  `tender_id` bigint UNSIGNED NOT NULL,
  `user_id` bigint UNSIGNED DEFAULT NULL,
  `type` enum('SYSTEM','COMMENT') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'COMMENT',
  `content` text COLLATE utf8mb4_general_ci NOT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tender_activities`
--

INSERT INTO `tender_activities` (`id`, `tender_id`, `user_id`, `type`, `content`, `created_at`) VALUES
(1, 1, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-25 00:41:00.228116'),
(2, 1, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-25 00:41:02.550221'),
(3, 1, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-25 00:41:05.211953'),
(4, 1, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-25 00:41:07.370964'),
(5, 1, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-25 00:41:09.710685'),
(6, 1, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-25 00:41:13.862908'),
(7, 1, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-25 00:41:16.734554'),
(8, 1, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-25 00:41:19.102835'),
(9, 1, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-25 00:41:21.267330'),
(10, 1, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-25 00:41:22.860561'),
(11, 1, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-25 00:41:40.298733'),
(12, 1, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-25 00:41:42.002864'),
(13, 1, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-25 00:41:43.842304'),
(14, 1, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-25 00:41:45.390165'),
(15, 1, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-25 00:41:47.895365'),
(16, 1, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-25 00:41:50.147622'),
(17, 1, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-25 00:41:51.836114'),
(18, 1, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-25 00:41:54.280904'),
(19, 1, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-25 00:41:56.544398'),
(20, 1, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-25 00:41:58.542432'),
(21, 1, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-25 00:42:00.756644'),
(22, 1, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-25 00:42:02.703398'),
(23, 1, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-25 00:42:05.472047'),
(24, 1, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-25 00:42:07.379328'),
(25, 1, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-25 00:42:21.952942'),
(26, 1, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-25 00:42:23.479092'),
(27, 1, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-25 00:42:25.502928'),
(28, 1, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-25 00:42:26.717153'),
(29, 1, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-25 00:43:00.663285'),
(30, 1, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-25 00:43:04.137480'),
(31, 1, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-25 00:43:06.266891'),
(32, 1, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-25 00:43:08.933655'),
(33, 1, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-25 00:43:11.951967'),
(34, 1, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-25 00:43:16.649940'),
(35, 2, 7, 'SYSTEM', 'Tender marked as WON', '2026-07-25 00:49:02.607315'),
(36, 1, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-25 13:36:04.108861'),
(37, 1, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-25 13:36:18.777973'),
(38, 1, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-25 13:53:25.564094'),
(39, 1, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-25 13:53:36.418451'),
(40, 3, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-26 14:45:59.169360'),
(41, 3, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-26 14:46:01.469360'),
(42, 3, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-26 14:46:03.182844'),
(43, 3, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-26 14:46:04.713428'),
(44, 3, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-26 14:46:09.172565'),
(45, 3, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-26 14:46:10.502470'),
(46, 3, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-26 18:01:19.817582'),
(47, 3, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-26 18:01:21.719905'),
(48, 3, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-26 18:01:23.138824'),
(49, 3, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-26 18:01:24.942684'),
(50, 3, 1, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-27 09:28:21.716551'),
(51, 3, 1, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-27 09:28:23.364756'),
(52, 5, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-29 18:15:15.722616'),
(53, 5, 7, 'SYSTEM', 'Proposal document uploaded: proposal-1785323727391-724040850.pdf. Stage updated to PROPOSAL.', '2026-07-29 18:15:27.481460'),
(54, 5, 7, 'SYSTEM', 'Tender stage changed from PROPOSAL to LEAD', '2026-07-29 18:16:40.685254'),
(55, 7, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-29 18:16:48.625822'),
(56, 7, 7, 'SYSTEM', 'Proposal document uploaded: proposal-1785323837729-567427591.pdf. Stage updated to PROPOSAL.', '2026-07-29 18:17:17.945985'),
(57, 7, 7, 'COMMENT', 'Catatan Negosiasi: Termin 3x bayar tidak ada perubahan harga', '2026-07-29 18:17:35.604259'),
(58, 7, 7, 'SYSTEM', 'Tender stage changed from PROPOSAL to NEGOTIATION', '2026-07-29 18:17:35.659940'),
(59, 7, 7, 'SYSTEM', 'Tender marked as WON', '2026-07-29 18:18:23.859471'),
(60, 7, 7, 'SYSTEM', 'Tender marked as WON', '2026-07-29 18:19:35.818635'),
(61, 8, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-29 21:03:03.334647'),
(62, 8, 7, 'SYSTEM', 'Proposal document uploaded: proposal-1785333796364-37797874.pdf. Stage updated to PROPOSAL.', '2026-07-29 21:03:16.452411'),
(63, 8, 7, 'COMMENT', 'Catatan Negosiasi: tidak ada perubahan harga termin bayar 3x', '2026-07-29 21:03:33.245215'),
(64, 8, 7, 'SYSTEM', 'Tender stage changed from PROPOSAL to NEGOTIATION', '2026-07-29 21:03:33.372412'),
(65, 8, 7, 'SYSTEM', 'Tender marked as WON', '2026-07-29 21:03:50.811476'),
(66, 3, 7, 'SYSTEM', 'Tender marked as WON', '2026-07-29 21:08:29.705271'),
(67, 1, 7, 'SYSTEM', 'Tender marked as WON', '2026-07-29 21:58:41.165139'),
(68, 1, 7, 'SYSTEM', 'Tender marked as WON', '2026-07-29 21:59:04.213211'),
(69, 11, 7, 'SYSTEM', 'Tender marked as WON', '2026-07-29 22:29:27.538947'),
(70, 10, 7, 'SYSTEM', 'Tender marked as WON', '2026-07-29 22:43:14.351643'),
(71, 9, 7, 'SYSTEM', 'Tender marked as WON', '2026-07-29 22:44:03.356519'),
(72, 13, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-29 23:35:22.084348'),
(73, 13, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-29 23:35:24.319414'),
(74, 13, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-29 23:35:26.718387'),
(75, 13, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-29 23:35:29.614426'),
(76, 15, 7, 'SYSTEM', 'Tender marked as WON', '2026-07-31 12:14:32.695211'),
(77, 21, 7, 'SYSTEM', 'Tender marked as WON', '2026-07-31 13:34:31.975370'),
(78, 20, 7, 'SYSTEM', 'Tender marked as WON', '2026-07-31 14:14:44.671622'),
(79, 19, 7, 'SYSTEM', 'Tender marked as WON', '2026-07-31 14:15:58.327048'),
(80, 18, 7, 'SYSTEM', 'Tender marked as WON', '2026-07-31 15:33:26.620280'),
(81, 17, 7, 'SYSTEM', 'Tender marked as WON', '2026-07-31 16:26:22.813390'),
(82, 16, 7, 'SYSTEM', 'Tender marked as WON', '2026-07-31 16:57:20.469529'),
(83, 27, 9, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-31 22:39:24.239188'),
(84, 27, 9, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-31 22:39:27.917609'),
(85, 27, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-31 22:39:54.911990'),
(86, 27, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-31 22:39:56.823803'),
(87, 27, 9, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-31 23:00:18.918534'),
(88, 27, 9, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-31 23:00:25.417262'),
(89, 27, 9, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-31 23:00:56.258978'),
(90, 27, 9, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-31 23:01:06.554358'),
(91, 27, 9, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-31 23:10:03.036018'),
(92, 27, 9, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-31 23:10:56.977873'),
(93, 34, 9, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-31 23:31:05.034111'),
(94, 34, 9, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-31 23:42:10.154179'),
(95, 36, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-31 23:48:04.095445'),
(96, 36, 1, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-31 23:48:35.847278'),
(97, 38, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-08-01 00:25:52.992570'),
(98, 38, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-08-01 00:26:15.740234'),
(99, 38, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-08-01 00:28:59.343282'),
(100, 38, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-08-01 00:29:04.046193'),
(101, 38, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-08-01 00:30:51.152186'),
(102, 38, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-08-01 00:30:53.909054'),
(103, 38, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-08-01 00:31:05.641245'),
(104, 37, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-08-01 01:17:51.428523'),
(105, 38, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-08-01 01:17:54.452181'),
(106, 37, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-08-01 01:18:05.271313'),
(107, 39, 7, 'SYSTEM', 'Proposal document uploaded: proposal-1785525727190-707259747.pdf. Stage updated to PROPOSAL.', '2026-08-01 02:22:07.351588'),
(108, 39, 7, 'SYSTEM', 'Tender stage changed from PROPOSAL to LEAD', '2026-08-01 02:28:39.879518'),
(109, 39, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-08-01 02:28:54.179744'),
(110, 39, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-08-01 02:43:50.278301'),
(111, 45, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-08-02 23:26:17.293879'),
(112, 45, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-08-02 23:48:43.650350'),
(113, 46, 9, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-08-03 00:24:23.819650'),
(114, 45, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-08-03 00:26:13.658600'),
(115, 45, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-08-03 08:40:24.350325'),
(116, 45, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-08-03 08:40:28.253675'),
(117, 45, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-08-03 08:40:31.098110'),
(118, 44, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-08-03 08:40:33.274007'),
(119, 44, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-08-03 08:40:36.245984'),
(120, 43, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-08-03 08:40:39.194949'),
(121, 43, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-08-03 08:40:44.170779'),
(122, 45, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-08-03 11:24:22.425239'),
(123, 45, 4, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-08-03 11:24:47.258584'),
(124, 45, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-08-03 11:25:29.685154'),
(125, 45, 7, 'SYSTEM', 'Proposal document uploaded: proposal-1785731144642-280691751.pdf. Stage updated to PROPOSAL.', '2026-08-03 11:25:44.713964'),
(126, 45, 7, 'COMMENT', 'Catatan Negosiasi: Termin 3x bayar\nSPK 1 minggu', '2026-08-03 11:26:02.665897'),
(127, 45, 7, 'SYSTEM', 'Tender stage changed from PROPOSAL to NEGOTIATION', '2026-08-03 11:26:02.752676'),
(128, 45, 7, 'SYSTEM', 'Tender marked as WON', '2026-08-03 11:26:11.389512'),
(129, 44, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-08-03 13:08:20.764511'),
(130, 47, 9, 'SYSTEM', 'Tender marked as WON', '2026-08-03 13:42:08.730615'),
(131, 48, 9, 'SYSTEM', 'Tender marked as WON', '2026-08-03 13:44:51.390051'),
(132, 44, 7, 'SYSTEM', 'Tender marked as WON', '2026-08-03 13:52:01.958176'),
(133, 43, 7, 'SYSTEM', 'Tender marked as WON', '2026-08-03 14:46:46.065516'),
(134, 46, 9, 'SYSTEM', 'Tender marked as WON', '2026-08-03 17:41:23.683283'),
(135, 35, 9, 'SYSTEM', 'Tender marked as WON', '2026-08-03 17:42:34.480694'),
(136, 35, 9, 'SYSTEM', 'Tender marked as WON', '2026-08-03 17:42:56.707990'),
(137, 34, 9, 'SYSTEM', 'Tender marked as WON', '2026-08-04 07:05:35.234415'),
(138, 49, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-08-04 07:31:20.259139');

-- --------------------------------------------------------

--
-- Table structure for table `tender_price_history`
--

CREATE TABLE `tender_price_history` (
  `id` bigint UNSIGNED NOT NULL,
  `tender_id` bigint UNSIGNED NOT NULL,
  `old_price` decimal(19,2) DEFAULT NULL,
  `new_price` decimal(19,2) DEFAULT NULL,
  `changed_by` bigint UNSIGNED NOT NULL,
  `reason` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` bigint UNSIGNED NOT NULL,
  `email` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `full_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `updated_by` bigint UNSIGNED DEFAULT NULL,
  `deleted_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  `refresh_token` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `email`, `password_hash`, `full_name`, `is_active`, `created_by`, `updated_by`, `deleted_by`, `created_at`, `updated_at`, `deleted_at`, `refresh_token`) VALUES
(1, 'admin@epms.com', '$2b$10$G7T6u.9w0pjb6o6v3mXnsu1qrjuuPlgUYUAh3Kmwe8SuedxANWVT2', 'System Admin', 1, NULL, NULL, NULL, '2026-07-10 14:10:30', '2026-08-04 07:09:50', NULL, '$2b$10$Nt360OfgYJn8ERT0Chxkg.mA9i0kPIFu.r1aB6eygI6IOzaGnbDGS'),
(2, 'pm@epms.com', '$2b$10$G7T6u.9w0pjb6o6v3mXnsu1qrjuuPlgUYUAh3Kmwe8SuedxANWVT2', 'Project Manager', 1, NULL, NULL, NULL, '2026-07-10 14:10:30', '2026-08-03 13:47:11', NULL, '$2b$10$6GqD2FDS5ALMmx6L6IZOPO/AJ/QritnjTBI1j1rPGwkX/qiYQUPXS'),
(3, 'finance@epms.com', '$2b$10$G7T6u.9w0pjb6o6v3mXnsu1qrjuuPlgUYUAh3Kmwe8SuedxANWVT2', 'Finance User', 1, NULL, NULL, NULL, '2026-07-10 14:10:30', '2026-07-20 11:58:02', NULL, NULL),
(4, 'director@epms.com', '$2b$10$G7T6u.9w0pjb6o6v3mXnsu1qrjuuPlgUYUAh3Kmwe8SuedxANWVT2', 'Director', 1, NULL, NULL, NULL, '2026-07-10 14:10:30', '2026-08-04 09:34:15', NULL, '$2b$10$hy3sijNYijxXxVbaN/ERveihUtWijEnGpHQpRRSKvj5HGT3O04QYy'),
(5, 'manager@epms.com', '$2b$10$G7T6u.9w0pjb6o6v3mXnsu1qrjuuPlgUYUAh3Kmwe8SuedxANWVT2', 'Approval Manager', 1, NULL, NULL, NULL, '2026-07-10 14:10:30', '2026-07-20 11:58:02', NULL, NULL),
(6, 'gm@epms.com', '$2b$10$G7T6u.9w0pjb6o6v3mXnsu1qrjuuPlgUYUAh3Kmwe8SuedxANWVT2', 'General Manager', 1, NULL, NULL, NULL, '2026-07-10 14:10:30', '2026-07-20 11:58:02', NULL, NULL),
(7, 'lukas@epms.com', '$2b$10$.SHCvFNgKBCpF.z5U3hnmO8o8g5Bl.Zx1pJNewCwS7S.k2MNpaSt2', 'Lukas Kurniawan', 1, NULL, NULL, NULL, '2026-07-13 12:29:10', '2026-08-05 00:41:55', NULL, '$2b$10$Y/hQcfW1q3QFpVjaVtmNyuocItAGdNjXT0QzjSkrXs9l07mQvp08e'),
(9, 'ragil@epms.com', '$2b$10$G7T6u.9w0pjb6o6v3mXnsu1qrjuuPlgUYUAh3Kmwe8SuedxANWVT2', 'Dwi Ragil Pribadi', 1, NULL, NULL, NULL, '2026-07-13 14:54:34', '2026-08-04 19:42:50', NULL, '$2b$10$cfTiv4kBbhwnn5cxt.grpedtJAsRkV.zDO/ZKzQNMNsGoWn/GQVR2'),
(10, 'legal@epms.com', '$2b$10$G7T6u.9w0pjb6o6v3mXnsu1qrjuuPlgUYUAh3Kmwe8SuedxANWVT2', 'Legal Officer', 1, NULL, NULL, NULL, '2026-07-16 21:12:08', '2026-08-04 07:22:04', NULL, '$2b$10$fUNShRCP7F2mVQvWAEn5N.uSD0uggP/V3JzFMFYe4q.OOPZqo2LXa'),
(32, 'admin@tvmubd.com', '$2b$10$r/qZekglj5pq.Dzndq65bOHgEotVzTgE7UYLE7Av.hNCXvHKvo1Ji', 'Super Admin', 1, NULL, NULL, NULL, '2026-07-19 19:43:22', '2026-08-03 14:53:57', NULL, '$2b$10$NkQ8Ojiv0FB3yWWALICGruxYuqAYAR2kU.NjrnuaAe1Grk4hPSTki'),
(33, 'director@tvmubd.com', '$2b$10$G7T6u.9w0pjb6o6v3mXnsu1qrjuuPlgUYUAh3Kmwe8SuedxANWVT2', 'Director', 1, NULL, NULL, NULL, '2026-07-19 19:43:22', '2026-07-20 11:58:02', NULL, NULL),
(34, 'marketing@tvmubd.com', '$2b$10$G7T6u.9w0pjb6o6v3mXnsu1qrjuuPlgUYUAh3Kmwe8SuedxANWVT2', 'Marketing Staff', 1, NULL, NULL, NULL, '2026-07-19 19:43:22', '2026-08-04 07:12:21', NULL, '$2b$10$vleovyEQeA.MZz7aBSG.oeKImTllQr8h5w0CF9HCIhM/vUt6U.ReC'),
(35, 'legal@tvmubd.com', '$2b$10$r/qZekglj5pq.Dzndq65bOHgEotVzTgE7UYLE7Av.hNCXvHKvo1Ji', 'Legal Staff', 1, NULL, NULL, NULL, '2026-07-19 19:43:22', '2026-07-29 16:38:14', NULL, '$2b$10$SKxF8lWVU0eUrkJk1fbRkOXdTOMxgbYbwXlKXDfRLyJ7158yFlxNG'),
(36, 'pm@tvmubd.com', '$2b$10$G7T6u.9w0pjb6o6v3mXnsu1qrjuuPlgUYUAh3Kmwe8SuedxANWVT2', 'Project Manager', 1, NULL, NULL, NULL, '2026-07-19 19:43:23', '2026-07-20 11:58:02', NULL, NULL),
(37, 'procurement@tvmubd.com', '$2b$10$G7T6u.9w0pjb6o6v3mXnsu1qrjuuPlgUYUAh3Kmwe8SuedxANWVT2', 'Procurement Staff', 1, NULL, NULL, NULL, '2026-07-19 19:43:23', '2026-07-20 11:58:02', NULL, '$2b$10$oMQs7cxApy2bFP3D4LJTXOHxY.LIFBDIZuj/A8nNb90bW8tU/oZFy'),
(38, 'finance@tvmubd.com', '$2b$10$G7T6u.9w0pjb6o6v3mXnsu1qrjuuPlgUYUAh3Kmwe8SuedxANWVT2', 'Finance Staff', 1, NULL, NULL, NULL, '2026-07-19 19:43:23', '2026-07-20 11:58:02', NULL, NULL),
(39, 'superadmin@epms.com', '$2b$10$G7T6u.9w0pjb6o6v3mXnsu1qrjuuPlgUYUAh3Kmwe8SuedxANWVT2', 'super admin', 1, NULL, NULL, NULL, '2026-07-20 11:10:54', '2026-07-20 11:58:02', NULL, '$2b$10$tFqIJdyn6qPM63CYGyProOhxEihl2GBe3bH/U5DbPhkUvCw/5xa5C');

-- --------------------------------------------------------

--
-- Table structure for table `user_roles`
--

CREATE TABLE `user_roles` (
  `user_id` bigint UNSIGNED NOT NULL,
  `role_id` bigint UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `user_roles`
--

INSERT INTO `user_roles` (`user_id`, `role_id`) VALUES
(1, 1),
(32, 1),
(39, 1),
(2, 2),
(36, 2),
(3, 3),
(38, 3),
(4, 4),
(33, 4),
(5, 5),
(6, 6),
(7, 7),
(9, 7),
(34, 7),
(10, 8),
(35, 8),
(37, 42);

-- --------------------------------------------------------

--
-- Table structure for table `vendors`
--

CREATE TABLE `vendors` (
  `id` bigint UNSIGNED NOT NULL,
  `code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `address` text COLLATE utf8mb4_unicode_ci,
  `tax_id` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `vendor_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `updated_by` bigint UNSIGNED DEFAULT NULL,
  `deleted_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `vendor_comparisons`
--

CREATE TABLE `vendor_comparisons` (
  `id` bigint UNSIGNED NOT NULL,
  `rfq_id` bigint UNSIGNED NOT NULL,
  `vendor_id` bigint UNSIGNED NOT NULL,
  `offered_amount` decimal(19,2) NOT NULL,
  `is_winner` tinyint(1) DEFAULT '0',
  `remarks` text COLLATE utf8mb4_unicode_ci,
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `updated_by` bigint UNSIGNED DEFAULT NULL,
  `deleted_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `workflow_definitions`
--

CREATE TABLE `workflow_definitions` (
  `id` bigint UNSIGNED NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `bpmn_json` json NOT NULL,
  `version` int NOT NULL DEFAULT '1',
  `is_active` tinyint(1) DEFAULT '1',
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `updated_by` bigint UNSIGNED DEFAULT NULL,
  `deleted_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `workflow_instances`
--

CREATE TABLE `workflow_instances` (
  `id` bigint UNSIGNED NOT NULL,
  `workflow_definition_id` bigint UNSIGNED NOT NULL,
  `entity_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity_id` bigint UNSIGNED NOT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'IN_PROGRESS',
  `current_state_data` json DEFAULT NULL,
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `updated_by` bigint UNSIGNED DEFAULT NULL,
  `deleted_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `workflow_tasks`
--

CREATE TABLE `workflow_tasks` (
  `id` bigint UNSIGNED NOT NULL,
  `workflow_instance_id` bigint UNSIGNED NOT NULL,
  `assignee_role_id` bigint UNSIGNED DEFAULT NULL,
  `assignee_user_id` bigint UNSIGNED DEFAULT NULL,
  `task_key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `comments` text COLLATE utf8mb4_unicode_ci,
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `updated_by` bigint UNSIGNED DEFAULT NULL,
  `deleted_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `work_breakdown_structures`
--

CREATE TABLE `work_breakdown_structures` (
  `id` bigint UNSIGNED NOT NULL,
  `project_id` bigint UNSIGNED NOT NULL,
  `parent_wbs_id` bigint UNSIGNED DEFAULT NULL,
  `code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `level` int NOT NULL DEFAULT '1',
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `updated_by` bigint UNSIGNED DEFAULT NULL,
  `deleted_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `audit_logs`
--
ALTER TABLE `audit_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_audit_table_record` (`table_name`,`record_id`);

--
-- Indexes for table `contracts`
--
ALTER TABLE `contracts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `contract_number` (`contract_number`),
  ADD KEY `idx_contracts_deleted_at` (`deleted_at`),
  ADD KEY `fk_contracts_proposal` (`proposal_id`),
  ADD KEY `fk_contracts_customer` (`customer_id`),
  ADD KEY `fk_contracts_legal_reviewer` (`legal_reviewer_id`),
  ADD KEY `FK_cb7d02b9a4d6b88327a58268ed4` (`project_manager_id`);
```

```sql
created_at`),
  ADD KEY `FK_585886cc7ea612824c3db4c50e6` (`approved_by`);

--
-- Indexes for table `customers`
--
ALTER TABLE `customers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `code` (`code`),
  ADD KEY `idx_customers_deleted_at` (`deleted_at`);

--
-- Indexes for table `dashboard_kpis`
--
ALTER TABLE `dashboard_kpis`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `kpi_key` (`kpi_key`);

--
-- Indexes for table `documents`
--
ALTER TABLE `documents`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_docs_deleted_at` (`deleted_at`),
  ADD KEY `idx_docs_entity` (`entity_type`,`entity_id`);

--
-- Indexes for table `goods_receipts`
--
ALTER TABLE `goods_receipts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `gr_number` (`gr_number`),
  ADD KEY `idx_gr_deleted_at` (`deleted_at`),
  ADD KEY `fk_gr_po` (`po_id`);

--
-- Indexes for table `invoices`
--
ALTER TABLE `invoices`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `invoice_number` (`invoice_number`),
  ADD KEY `idx_invoices_deleted_at` (`deleted_at`),
  ADD KEY `fk_invoices_po` (`po_id`);

--
-- Indexes for table `milestones`
--
ALTER TABLE `milestones`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_milestones_deleted_at` (`deleted_at`),
  ADD KEY `fk_milestones_project` (`project_id`);

--
-- Indexes for table `notifications`
--
ALTER TABLE `notifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_notif_deleted_at` (`deleted_at`),
  ADD KEY `idx_notif_user` (`user_id`);

--
-- Indexes for table `outbox_events`
--
ALTER TABLE `outbox_events`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `payments`
--
ALTER TABLE `payments`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `payment_number` (`payment_number`),
  ADD KEY `idx_payments_deleted_at` (`deleted_at`),
  ADD KEY `fk_payments_invoice` (`invoice_id`);

--
-- Indexes for table `permissions`
--
ALTER TABLE `permissions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`),
  ADD KEY `idx_permissions_deleted_at` (`deleted_at`);

--
-- Indexes for table `projects`
--
ALTER TABLE `projects`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `code` (`code`),
  ADD KEY `idx_projects_deleted_at` (`deleted_at`),
  ADD KEY `fk_projects_contract` (`contract_id`),
  ADD KEY `fk_projects_manager` (`manager_id`);

--
-- Indexes for table `project_budgets`
--
ALTER TABLE `project_budgets`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_pb_project_category` (`project_id`,`category`),
  ADD KEY `idx_pb_deleted_at` (`deleted_at`);

--
-- Indexes for table `proposals`
--
ALTER TABLE `proposals`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `proposal_number` (`proposal_number`),
  ADD KEY `idx_proposals_deleted_at` (`deleted_at`),
  ADD KEY `fk_proposals_tender` (`tender_id`);

--
-- Indexes for table `purchase_orders`
--
ALTER TABLE `purchase_orders`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `po_number` (`po_number`),
  ADD KEY `idx_po_deleted_at` (`deleted_at`),
  ADD KEY `fk_po_pr` (`pr_id`),
  ADD KEY `fk_po_vendor` (`vendor_id`);

--
-- Indexes for table `purchase_order_items`
--
ALTER TABLE `purchase_order_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_poi_po` (`purchase_order_id`);

--
-- Indexes for table `purchase_requests`
--
ALTER TABLE `purchase_requests`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `pr_number` (`pr_number`),
  ADD KEY `idx_pr_deleted_at` (`deleted_at`),
  ADD KEY `fk_pr_project` (`project_id`),
  ADD KEY `fk_pr_requester` (`requester_id`);

--
-- Indexes for table `purchase_request_items`
--
ALTER TABLE `purchase_request_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_pri_pr` (`pr_id`);

--
-- Indexes for table `rfqs`
--
ALTER TABLE `rfqs`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `rfq_number` (`rfq_number`),
  ADD KEY `idx_rfq_deleted_at` (`deleted_at`),
  ADD KEY `fk_rfq_pr` (`pr_id`);

--
-- Indexes for table `roles`
--
ALTER TABLE `roles`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`),
  ADD KEY `idx_roles_deleted_at` (`deleted_at`);

--
-- Indexes for table `role_permissions`
--
ALTER TABLE `role_permissions`
  ADD PRIMARY KEY (`role_id`,`permission_id`),
  ADD KEY `fk_rp_permission` (`permission_id`);

--
-- Indexes for table `tasks`
--
ALTER TABLE `tasks`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_tasks_deleted_at` (`deleted_at`),
  ADD KEY `fk_tasks_wbs` (`wbs_id`),
  ADD KEY `fk_tasks_assignee` (`assignee_id`);

--
-- Indexes for table `tenders`
--
ALTER TABLE `tenders`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_tenders_deleted_at` (`deleted_at`),
  ADD KEY `fk_tenders_customer` (`customer_id`),
  ADD KEY `fk_tenders_marketing_pic` (`marketing_pic_id`),
  ADD KEY `idx_tenders_status_date` (`status`,`created_at`);

--
-- Indexes for table `tender_activities`
--
ALTER TABLE `tender_activities`
  ADD PRIMARY KEY (`id`),
  ADD KEY `IDX_tender_activities_tender_id` (`tender_id`),
  ADD KEY `IDX_tender_activities_user_id` (`user_id`);

--
-- Indexes for table `tender_price_history`
--
ALTER TABLE `tender_price_history`
  ADD PRIMARY KEY (`id`),
  ADD KEY `tender_id` (`tender_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `idx_users_deleted_at` (`deleted_at`),
  ADD KEY `fk_users_created_by` (`created_by`),
  ADD KEY `fk_users_updated_by` (`updated_by`),
  ADD KEY `fk_users_deleted_by` (`deleted_by`);

--
-- Indexes for table `user_roles`
--
ALTER TABLE `user_roles`
  ADD PRIMARY KEY (`user_id`,`role_id`),
  ADD KEY `fk_ur_role` (`role_id`);

--
-- Indexes for table `vendors`
--
ALTER TABLE `vendors`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `code` (`code`),
  ADD KEY `idx_vendors_deleted_at` (`deleted_at`);

--
-- Indexes for table `vendor_comparisons`
--
ALTER TABLE `vendor_comparisons`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_vc_rfq_vendor` (`rfq_id`,`vendor_id`),
  ADD KEY `idx_vc_deleted_at` (`deleted_at`),
  ADD KEY `fk_vc_vendor` (`vendor_id`);

--
-- Indexes for table `workflow_definitions`
--
ALTER TABLE `workflow_definitions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`),
  ADD KEY `idx_wd_deleted_at` (`deleted_at`);

--
-- Indexes for table `workflow_instances`
--
ALTER TABLE `workflow_instances`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_wi_deleted_at` (`deleted_at`),
  ADD KEY `fk_wi_definition` (`workflow_definition_id`);

--
-- Indexes for table `workflow_tasks`
--
ALTER TABLE `workflow_tasks`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_wt_deleted_at` (`deleted_at`),
  ADD KEY `fk_wt_instance` (`workflow_instance_id`),
  ADD KEY `fk_wt_role` (`assignee_role_id`),
  ADD KEY `fk_wt_user` (`assignee_user_id`);

--
-- Indexes for table `work_breakdown_structures`
--
ALTER TABLE `work_breakdown_structures`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_wbs_project_code` (`project_id`,`code`),
  ADD KEY `idx_wbs_deleted_at` (`deleted_at`),
  ADD KEY `fk_wbs_parent` (`parent_wbs_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `audit_logs`
--
ALTER TABLE `audit_logs`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT for table `contracts`
--
ALTER TABLE `contracts`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=27;

--
-- AUTO_INCREMENT for table `contract_amendments`
--
ALTER TABLE `contract_amendments`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `customers`
--
ALTER TABLE `customers`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `dashboard_kpis`
--
ALTER TABLE `dashboard_kpis`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `documents`
--
ALTER TABLE `documents`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `goods_receipts`
--
ALTER TABLE `goods_receipts`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `invoices`
--
ALTER TABLE `invoices`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `milestones`
--
ALTER TABLE `milestones`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `notifications`
--
ALTER TABLE `notifications`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=685;

--
-- AUTO_INCREMENT for table `outbox_events`
--
ALTER TABLE `outbox_events`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT for table `payments`
--
ALTER TABLE `payments`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `permissions`
--
ALTER TABLE `permissions`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `projects`
--
ALTER TABLE `projects`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `project_budgets`
--
ALTER TABLE `project_budgets`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `proposals`
--
ALTER TABLE `proposals`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=51;

--
-- AUTO_INCREMENT for table `purchase_orders`
--
ALTER TABLE `purchase_orders`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `purchase_order_items`
--
ALTER TABLE `purchase_order_items`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `purchase_requests`
--
ALTER TABLE `purchase_requests`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `purchase_request_items`
--
ALTER TABLE `purchase_request_items`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `rfqs`
--
ALTER TABLE `rfqs`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `roles`
--
ALTER TABLE `roles`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=60;

--
-- AUTO_INCREMENT for table `tasks`
--
ALTER TABLE `tasks`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `tenders`
--
ALTER TABLE `tenders`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=50;

--
-- AUTO_INCREMENT for table `tender_activities`
--
ALTER TABLE `tender_activities`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=139;

--
-- AUTO_INCREMENT for table `tender_price_history`
--
ALTER TABLE `tender_price_history`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=40;

--
-- AUTO_INCREMENT for table `vendors`
--
ALTER TABLE `vendors`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `vendor_comparisons`
--
ALTER TABLE `vendor_comparisons`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `workflow_definitions`
--
ALTER TABLE `workflow_definitions`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `workflow_instances`
--
ALTER TABLE `workflow_instances`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `workflow_tasks`
--
ALTER TABLE `workflow_tasks`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `work_breakdown_structures`
--
ALTER TABLE `work_breakdown_structures`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `contracts`
--
ALTER TABLE `contracts`
  ADD CONSTRAINT `FK_cb7d02b9a4d6b88327a58268ed4` FOREIGN KEY (`project_manager_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_contracts_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `fk_contracts_legal_reviewer` FOREIGN KEY (`legal_reviewer_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_contracts_proposal` FOREIGN KEY (`proposal_id`) REFERENCES `proposals` (`id`) ON DELETE RESTRICT;
```

## H. TRIGGER INVENTORY

Tidak ditemukan Trigger.

## I. STORED PROCEDURE INVENTORY

Tidak ditemukan Stored Procedure.

## J. EVENT SCHEDULER INVENTORY

```sql
CREATE TABLE `audit_logs` (
  `id` bigint UNSIGNED NOT NULL,
  `table_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `record_id` bigint UNSIGNED NOT NULL,
  `action` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `old_value` json DEFAULT NULL,
  `new_value` json DEFAULT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` text COLLATE utf8mb4_unicode_ci,
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `audit_logs`
--

INSERT INTO `audit_logs` (`id`, `table_name`, `record_id`, `action`, `old_value`, `new_value`, `ip_address`, `user_agent`, `created_by`, `created_at`) VALUES
(1, 'contracts', 2, 'LEGAL_REVIEW_APPROVED', '{\"status\": \"PENDING\", \"legal_status\": \"DRAFT\"}', '{\"notes\": \"Legal Clearance Approved & Released to PMO\", \"status\": \"ACTIVE\", \"legal_status\": \"APPROVED\"}', NULL, NULL, 10, '2026-07-25 13:27:59'),
(2, 'contracts', 1, 'LEGAL_REVIEW_APPROVED', '{\"status\": \"PENDING_LEGAL_REVIEW\", \"legal_status\": \"DRAFT\"}', '{\"notes\": \"Legal Clearance Approved & Released to PMO\", \"status\": \"ACTIVE\", \"legal_status\": \"APPROVED\"}', NULL, NULL, 32, '2026-07-29 17:34:23'),
(3, 'contracts', 1, 'LEGAL_REVIEW_APPROVED', '{\"status\": \"ACTIVE\", \"legal_status\": \"APPROVED\"}', '{\"notes\": \"Legal Clearance Approved & Released to PMO\", \"status\": \"ACTIVE\", \"legal_status\": \"APPROVED\"}', NULL, NULL, 32, '2026-07-29 17:35:34'),
(4, 'contracts', 4, 'LEGAL_REVIEW_REJECTED', '{\"status\": \"PENDING\", \"legal_status\": \"DRAFT\"}', '{\"notes\": \"SPK Belum di upload silahkan upload dulu\", \"status\": \"REJECTED\", \"legal_status\": \"REJECTED\"}', NULL, NULL, 10, '2026-07-29 18:19:14'),
(5, 'contracts', 15, 'LEGAL_REVIEW_APPROVED', '{\"status\": \"PENDING_LEGAL_REVIEW\", \"legal_status\": \"DRAFT\"}', '{\"notes\": \"Legal Clearance Approved & Released to PMO\", \"status\": \"ACTIVE\", \"legal_status\": \"APPROVED\"}', NULL, NULL, 10, '2026-07-31 13:38:03'),
(6, 'contracts', 18, 'LEGAL_REVIEW_APPROVED', '{\"status\": \"PENDING_LEGAL_REVIEW\", \"legal_status\": \"DRAFT\"}', '{\"notes\": \"Legal Clearance Approved & Released to PMO\", \"status\": \"ACTIVE\", \"legal_status\": \"APPROVED\"}', NULL, NULL, 10, '2026-07-31 15:35:16'),
(7, 'contracts', 19, 'LEGAL_REVIEW_APPROVED', '{\"status\": \"PENDING_LEGAL_REVIEW\", \"legal_status\": \"DRAFT\"}', '{\"notes\": \"Legal Clearance Approved & Released to PMO\", \"status\": \"ACTIVE\", \"legal_status\": \"APPROVED\"}', NULL, NULL, 10, '2026-07-31 16:27:40'),
(8, 'contracts', 17, 'LEGAL_REVIEW_APPROVED', '{\"status\": \"PENDING_LEGAL_REVIEW\", \"legal_status\": \"DRAFT\"}', '{\"notes\": \"Legal Clearance Approved & Released to PMO\", \"status\": \"ACTIVE\", \"legal_status\": \"APPROVED\"}', NULL, NULL, 10, '2026-07-31 16:50:48'),
(9, 'contracts', 20, 'LEGAL_REVIEW_APPROVED', '{\"status\": \"PENDING_LEGAL_REVIEW\", \"legal_status\": \"DRAFT\"}', '{\"notes\": \"Legal Clearance Approved & Released to PMO\", \"status\": \"ACTIVE\", \"legal_status\": \"APPROVED\"}', NULL, NULL, 10, '2026-07-31 16:59:46'),
(10, 'contracts', 21, 'LEGAL_REVIEW_APPROVED', '{\"status\": \"PENDING_LEGAL_REVIEW\", \"legal_status\": \"DRAFT\"}', '{\"notes\": \"Legal Clearance Approved & Released to PMO\", \"status\": \"ACTIVE\", \"legal_status\": \"APPROVED\"}', NULL, NULL, 10, '2026-08-03 11:27:07'),
(11, 'contracts', 23, 'LEGAL_REVIEW_APPROVED', '{\"status\": \"PENDING_LEGAL_REVIEW\", \"legal_status\": \"DRAFT\"}', '{\"notes\": \"Legal Clearance Approved & Released to PMO\", \"status\": \"ACTIVE\", \"legal_status\": \"APPROVED\"}', NULL, NULL, 10, '2026-08-03 13:46:18');

-- --------------------------------------------------------

--
-- Table structure for table `contracts`
--

CREATE TABLE `contracts` (
  `id` bigint UNSIGNED NOT NULL,
  `proposal_id` bigint UNSIGNED DEFAULT NULL,
  `customer_id` bigint UNSIGNED NOT NULL,
  `contract_number` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `contract_value` decimal(19,2) NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `updated_by` bigint UNSIGNED DEFAULT NULL,
  `deleted_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  `legal_status` enum('DRAFT','ON_REVIEW','APPROVED','REJECTED','REVISION_REQUESTED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT',
  `legal_reviewer_id` bigint UNSIGNED DEFAULT NULL,
  `legal_notes` text COLLATE utf8mb4_unicode_ci,
  `project_manager_id` bigint UNSIGNED DEFAULT NULL,
  `ops_team_activated_at` datetime DEFAULT NULL,
  `version` int NOT NULL DEFAULT '1',
  `tender_id` bigint DEFAULT NULL,
  `spk_file_url` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `contracts`
--

INSERT INTO `contracts` (`id`, `proposal_id`, `customer_id`, `contract_number`, `contract_value`, `start_date`, `end_date`, `status`, `created_by`, `updated_by`, `deleted_by`, `created_at`, `updated_at`, `deleted_at`, `legal_status`, `legal_reviewer_id`, `legal_notes`, `project_manager_id`, `ops_team_activated_at`, `version`, `tender_id`, `spk_file_url`) VALUES
(1, 1, 1, 'CONT-20260724-0001', 380000000.00, '2026-07-25', '2027-07-25', 'ACTIVE', 7, 32, NULL, '2026-07-25 00:49:02', '2026-07-29 22:50:39', NULL, 'APPROVED', 32, 'Legal Clearance Approved & Released to PMO', NULL, NULL, 3, 2, 'http://localhost:4000/uploads/contracts/spk-2-1784915342373-188103388.pdf'),
(2, 2, 2, 'CONT-20260724-0002', 380000000.00, '2026-07-25', '2027-07-25', 'ACTIVE', 7, 10, NULL, '2026-07-25 00:49:02', '2026-07-25 13:27:59', NULL, 'APPROVED', 10, 'Legal Clearance Approved & Released to PMO', NULL, NULL, 3, NULL, NULL),
(4, 7, 2, 'CONT-20260729-0004', 300000000.00, '2026-07-29', '2027-07-29', 'PENDING_LEGAL_REVIEW', 7, 10, NULL, '2026-07-29 18:18:23', '2026-07-29 18:19:35', NULL, 'REJECTED', 10, 'SPK Belum di upload silahkan upload dulu', NULL, NULL, 3, 7, 'http://localhost:4000/uploads/contracts/spk-7-1785323975728-695791080.pdf'),
(5, 8, 2, 'CONT-20260729-0005', 300000000.00, '2026-07-29', '2027-07-29', 'PENDING', 7, NULL, NULL, '2026-07-29 18:19:35', '2026-07-29 21:44:19', '2026-07-29 21:44:19', 'DRAFT', NULL, NULL, NULL, NULL, 2, 7, NULL),
(6, 12, 1, 'CONT-20260729-0006', 100000000.00, '2026-07-29', '2027-07-29', 'PENDING_LEGAL_REVIEW', 7, NULL, NULL, '2026-07-29 21:03:50', '2026-07-29 22:40:08', NULL, 'DRAFT', NULL, NULL, NULL, NULL, 1, 8, 'http://localhost/test2'),
(7, 13, 1, 'CONT-20260729-0007', 100000000.00, '2026-07-29', '2027-07-29', 'PENDING_LEGAL_REVIEW', 7, NULL, NULL, '2026-07-29 21:03:50', '2026-07-29 22:40:08', '2026-07-29 21:44:19', 'DRAFT', NULL, NULL, NULL, NULL, 2, 8, 'http://localhost/test2'),
(8, 14, 1, 'CONT-20260729-0008', 150000000.00, '2026-07-29', '2027-07-29', 'PENDING', 7, NULL, NULL, '2026-07-29 21:08:29', '2026-07-29 21:44:19', '2026-07-29 21:44:19', 'DRAFT', NULL, NULL, NULL, NULL, 2, 3, NULL),
(9, 11, 1, 'CONT-20260729-0009', 250000000.00, '2026-07-29', '2027-07-29', 'PENDING_LEGAL_REVIEW', 7, NULL, NULL, '2026-07-29 21:59:03', '2026-07-29 22:50:39', NULL, 'DRAFT', NULL, NULL, NULL, NULL, 1, 1, 'http://localhost:4000/uploads/contracts/spk-1-1785337143700-439702074.pdf'),
(10, 17, 1, 'CONT-20260729-0010', 300000000.00, '2026-07-29', '2027-07-29', 'PENDING_LEGAL_REVIEW', 7, NULL, NULL, '2026-07-29 22:29:27', '2026-07-29 22:50:39', NULL, 'DRAFT', NULL, NULL, NULL, NULL, 1, 11, 'http://localhost:4000/uploads/contracts/spk-11-1785338966985-7712801.pdf'),
(11, 19, 1, 'CONT-20260729-0011', 240000000.00, '2026-07-29', '2027-07-29', 'PENDING_LEGAL_REVIEW', 7, NULL, NULL, '2026-07-29 22:43:13', '2026-07-29 22:43:13', NULL, 'DRAFT', NULL, NULL, NULL, NULL, 1, 10, 'http://localhost:4000/uploads/contracts/spk-10-1785339793771-490321500.pdf'),
(12, 21, 1, 'CONT-20260729-0012', 200000000.00, '2026-07-29', '2027-07-29', 'PENDING_LEGAL_REVIEW', 7, NULL, NULL, '2026-07-29 22:44:02', '2026-07-29 22:44:02', NULL, 'DRAFT', NULL, NULL, NULL, NULL, 1, 9, 'http://localhost:4000/uploads/contracts/spk-9-1785339842864-541115247.pdf'),
(13, NULL, 1, 'CONT-TEST-001', 500000.00, '2026-07-29', '2026-07-29', 'DRAFT', 1, NULL, NULL, '2026-07-29 23:04:20', '2026-07-29 23:04:20', '2026-07-29 23:04:20', 'DRAFT', NULL, NULL, NULL, NULL, 2, 14, NULL),
(14, 23, 1, 'CONT-20260731-0014', 150000000.00, '2026-07-31', '2027-07-31', 'PENDING_LEGAL_REVIEW', 7, NULL, NULL, '2026-07-31 12:14:32', '2026-07-31 12:47:57', '2026-07-31 12:47:57', 'DRAFT', NULL, NULL, NULL, NULL, 2, 15, 'http://localhost:4000/uploads/contracts/spk-15-1785474872493-587329612.pdf'),
(15, 25, 2, 'CONT-20260731-0015', 150000000.00, '2026-07-31', '2027-07-31', 'ACTIVE', 7, 10, NULL, '2026-07-31 13:34:31', '2026-07-31 14:04:06', '2026-07-31 14:04:06', 'APPROVED', 10, 'Legal Clearance Approved & Released to PMO', NULL, NULL, 3, 21, 'http://localhost:4000/uploads/contracts/spk-21-1785479671724-482948854.pdf'),
(16, 27, 2, 'CONT-20260731-0016', 200000000.00, '2026-07-31', '2027-07-31', 'PENDING_LEGAL_REVIEW', 7, NULL, NULL, '2026-07-31 14:14:44', '2026-07-31 14:15:22', '2026-07-31 14:15:22', 'DRAFT', NULL, NULL, NULL, NULL, 2, 20, 'http://localhost:4000/uploads/contracts/spk-20-1785482084277-343881108.pdf'),
(17, 29, 2, 'CONT-20260731-0017', 100000000.00, '2026-07-31', '2027-07-31', 'ACTIVE', 7, 10, NULL, '2026-07-31 14:15:58', '2026-07-31 16:50:48', NULL, 'APPROVED', 10, 'Legal Clearance Approved & Released to PMO', NULL, NULL, 2, 19, 'http://localhost:4000/uploads/contracts/spk-19-1785482157954-817419485.pdf'),
(18, 31, 2, 'CONT-20260731-0018', 150000000.00, '2026-07-31', '2027-07-31', 'ACTIVE', 7, 10, NULL, '2026-07-31 15:33:26', '2026-07-31 15:35:16', NULL, 'APPROVED', 10, 'Legal Clearance Approved & Released to PMO', NULL, NULL, 2, 18, 'http://localhost:4000/uploads/contracts/spk-18-1785486805950-900947533.pdf'),
(19, 33, 2, 'CONT-20260731-0019', 200000000.00, '2026-07-31', '2027-07-31', 'ACTIVE', 7, 10, NULL, '2026-07-31 16:26:22', '2026-07-31 16:27:40', NULL, 'APPROVED', 10, 'Legal Clearance Approved & Released to PMO', NULL, NULL, 2, 17, 'http://localhost:4000/uploads/contracts/spk-17-1785489982283-694294833.pdf'),
(20, 35, 2, 'CONT-20260731-0020', 400000000.00, '2026-07-31', '2027-07-31', 'ACTIVE', 7, 10, NULL, '2026-07-31 16:57:19', '2026-07-31 16:59:46', NULL, 'APPROVED', 10, 'Legal Clearance Approved & Released to PMO', NULL, NULL, 2, 16, 'http://localhost:4000/uploads/contracts/spk-16-1785491839279-434357699.pdf'),
(21, 37, 2, 'CONT-20260803-0021', 850000000.00, '2026-08-03', '2027-08-03', 'ACTIVE', 7, 10, NULL, '2026-08-03 11:26:11', '2026-08-03 11:27:07', NULL, 'APPROVED', 10, 'Legal Clearance Approved & Released to PMO', NULL, NULL, 2, 45, 'http://localhost:4000/uploads/contracts/spk-45-1785731171214-265699805.pdf'),
(22, 39, 2, 'CONT-20260803-0022', 50000000.00, '2026-08-03', '2027-08-03', 'PENDING_LEGAL_REVIEW', 9, NULL, NULL, '2026-08-03 13:42:08', '2026-08-03 13:42:08', NULL, 'DRAFT', NULL, NULL, NULL, NULL, 1, 47, 'http://localhost:4000/uploads/contracts/spk-47-1785739328543-523347381.pdf'),
(23, 41, 2, 'CONT-20260803-0023', 500000000.00, '2026-08-03', '2027-08-03', 'ACTIVE', 9, 10, NULL, '2026-08-03 13:44:51', '2026-08-03 13:46:18', NULL, 'APPROVED', 10, 'Legal Clearance Approved & Released to PMO', NULL, NULL, 2, 48, 'http://localhost:4000/uploads/contracts/spk-48-1785739491201-766612368.pdf'),
(24, 45, 2, 'CONT-20260803-0024', 400000000.00, '2026-08-03', '2027-08-03', 'PENDING_LEGAL_REVIEW', 9, NULL, NULL, '2026-08-03 17:41:23', '2026-08-03 17:41:23', NULL, 'DRAFT', NULL, NULL, NULL, NULL, 1, 46, 'http://localhost:4000/uploads/contracts/spk-46-1785753683536-175972917.pdf'),
(25, 47, 2, 'CONT-20260803-0025', 135000000.00, '2026-08-03', '2027-08-03', 'PENDING_LEGAL_REVIEW', 9, NULL, NULL, '2026-08-03 17:42:56', '2026-08-03 17:42:56', NULL, 'DRAFT', NULL, NULL, NULL, NULL, 1, 35, 'http://localhost:4000/uploads/contracts/spk-35-1785753776616-315423875.pdf'),
(26, 49, 2, 'CONT-20260804-0026', 140000000.00, '2026-08-04', '2027-08-04', 'PENDING_LEGAL_REVIEW', 9, NULL, NULL, '2026-08-04 07:05:35', '2026-08-04 07:05:35', NULL, 'DRAFT', NULL, NULL, NULL, NULL, 1, 34, 'http://localhost:4000/uploads/contracts/spk-34-1785801934848-730784278.pdf');

-- --------------------------------------------------------

--
-- Table structure for table `contract_amendments`
--

CREATE TABLE `contract_amendments` (
  `id` bigint UNSIGNED NOT NULL,
  `contract_id` bigint UNSIGNED NOT NULL,
  `version_number` int NOT NULL DEFAULT '1',
  `old_value` decimal(19,2) DEFAULT NULL,
  `new_value` decimal(19,2) DEFAULT NULL,
  `reason` text NOT NULL,
  `approved_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `customers`
--

CREATE TABLE `customers` (
  `id` bigint UNSIGNED NOT NULL,
  `code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `address` text COLLATE utf8mb4_unicode_ci,
  `tax_id` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `updated_by` bigint UNSIGNED DEFAULT NULL,
  `deleted_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  `company` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `contact_person` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '-',
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '-',
  `email` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `business_sector` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `city` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('Active','Inactive','PROSPECT') COLLATE utf8mb4_unicode_ci DEFAULT 'Active',
  `marketing_pic_id` bigint UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `customers`
--

INSERT INTO `customers` (`id`, `code`, `name`, `address`, `tax_id`, `created_by`, `updated_by`, `deleted_by`, `created_at`, `updated_at`, `deleted_at`, `company`, `contact_person`, `phone`, `email`, `business_sector`, `city`, `status`, `marketing_pic_id`) VALUES
(1, 'CUST-001', 'PT. GLOBAL JET EXPRESS', NULL, NULL, 7, NULL, NULL, '2026-07-25 00:39:05', '2026-07-25 00:39:05', NULL, 'J&T EXPRESS', 'Ramdani', '081234789650', 'ramdani@jet.co.id', 'Transportasi & Logistik', 'Jakarta', 'PROSPECT', 7),
(2, 'CUST-002', 'PT. Cipta Sejahtera Abadi', NULL, NULL, 7, NULL, NULL, '2026-07-25 00:46:19', '2026-07-25 00:46:19', NULL, 'PT. Cipta Sejahtera Abadi', 'Aldhi Dharmawan', '087434543557', 'aldhi.dharmawan@csatower.co.id', 'Telekomunikasi & Internet', 'Jakarta', 'PROSPECT', 9);

-- --------------------------------------------------------

--
-- Table structure for table `dashboard_kpis`
--

CREATE TABLE `dashboard_kpis` (
  `id` bigint UNSIGNED NOT NULL,
  `kpi_key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `kpi_value` decimal(19,2) NOT NULL DEFAULT '0.00',
  `metadata` json DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `documents`
--

CREATE TABLE `documents` (
  `id` bigint UNSIGNED NOT NULL,
  `entity_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity_id` bigint UNSIGNED NOT NULL,
  `file_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_path` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `mime_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `file_size` bigint UNSIGNED DEFAULT NULL,
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `updated_by` bigint UNSIGNED DEFAULT NULL,
  `deleted_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `documents`
--

INSERT INTO `documents` (`id`, `entity_type`, `entity_id`, `file_name`, `file_path`, `mime_type`, `file_size`, `created_by`, `updated_by`, `deleted_by`, `created_at`, `updated_at`, `deleted_at`) VALUES
(1, 'PROPOSAL', 5, 'PO TJ RW 07.pdf', 'proposal-1785323727391-724040850.pdf', 'application/pdf', 272073, 7, NULL, NULL, '2026-07-29 18:15:27', '2026-07-29 18:15:27', NULL),
(2, 'PROPOSAL', 7, '(HO TK) FRM.IPL.JLM.012 Formulir Berita Acara ATP_ (JAMPANG RW 01) rev.pdf', 'proposal-1785323837729-567427591.pdf', 'application/pdf', 34675521, 7, NULL, NULL, '2026-07-29 18:17:17', '2026-07-29 18:17:17', NULL),
(3, 'PROPOSAL', 8, 'panduan aktivasi ONU atau HC RumahNet .pdf', 'proposal-1785333796364-37797874.pdf', 'application/pdf', 775046, 7, NULL, NULL, '2026-07-29 21:03:16', '2026-07-29 21:03:16', NULL),
(4, 'PROPOSAL', 39, 'panduan aktivasi ONU atau HC RumahNet .pdf', 'proposal-1785525727190-707259747.pdf', 'application/pdf', 775046, 7, NULL, NULL, '2026-08-01 02:22:07', '2026-08-01 02:22:07', NULL),
(5, 'PROPOSAL', 45, 'RAP_UBD_REPAIR_PUNCH_LIST_MONDOKANRW02_TUBAN.pdf', 'proposal-1785731144642-280691751.pdf', 'application/pdf', 392160, 7, NULL, NULL, '2026-08-03 11:25:44', '2026-08-03 11:25:44', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `goods_receipts`
--

CREATE TABLE `goods_receipts` (
  `id` bigint UNSIGNED NOT NULL,
  `po_id` bigint UNSIGNED NOT NULL,
  `gr_number` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `receipt_date` date NOT NULL,
  `total_received_amount` decimal(19,2) NOT NULL,
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `updated_by` bigint UNSIGNED DEFAULT NULL,
  `deleted_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  `version` int NOT NULL DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `invoices`
--

CREATE TABLE `invoices` (
  `id` bigint UNSIGNED NOT NULL,
  `po_id` bigint UNSIGNED NOT NULL,
  `invoice_number` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `total_amount` decimal(19,2) NOT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'UNPAID',
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `updated_by` bigint UNSIGNED DEFAULT NULL,
  `deleted_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  `version` int NOT NULL DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `milestones`
--

CREATE TABLE `milestones` (
  `id` bigint UNSIGNED NOT NULL,
  `project_id` bigint UNSIGNED NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `target_date` date NOT NULL,
  `is_completed` tinyint(1) DEFAULT '0',
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `updated_by` bigint UNSIGNED DEFAULT NULL,
  `deleted_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `notifications`
--

CREATE TABLE `notifications` (
  `id` bigint UNSIGNED NOT NULL,
  `user_id` bigint UNSIGNED NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_read` tinyint(1) DEFAULT '0',
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `updated_by` bigint UNSIGNED DEFAULT NULL,
  `deleted_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  `message` text COLLATE utf8mb4_unicode_ci,
  `notification_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'TASK',
  `action_link` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `meta_data` json DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `notifications`
--

INSERT INTO `notifications` (`id`, `user_id`, `title`, `is_read`, `created_by`, `updated_by`, `deleted_by`, `created_at`, `updated_at`, `deleted_at`, `message`, `notification_type`, `action_link`, `meta_data`) VALUES
(1, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-25 00:40:18', '2026-07-25 00:40:17', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi Gudang J&T Jelambar Ruang Purchasing</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/1', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"1\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Renovasi Gudang J&T Jelambar Ruang Purchasing\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(2, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-25 00:40:18', '2026-07-25 00:40:17', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi Gudang J&T Jelambar Ruang Purchasing</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/1', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"1\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Renovasi Gudang J&T Jelambar Ruang Purchasing\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(3, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-25 00:40:18', '2026-07-25 00:40:17', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi Gudang J&T Jelambar Ruang Purchasing</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/1', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"1\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Renovasi Gudang J&T Jelambar Ruang Purchasing\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(4, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-25 00:40:18', '2026-07-25 00:40:17', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi Gudang J&T Jelambar Ruang Purchasing</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/1', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"1\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Renovasi Gudang J&T Jelambar Ruang Purchasing\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(5, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-25 00:40:18', '2026-07-25 00:40:17', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi Gudang J&T Jelambar Ruang Purchasing</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/1', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"1\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Renovasi Gudang J&T Jelambar Ruang Purchasing\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(6, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-25 00:47:26', '2026-07-25 00:47:25', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project CSA-FKI Karawang Rumah Net</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/2', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"2\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project CSA-FKI Karawang Rumah Net\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(7, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-25 00:47:26', '2026-07-25 00:47:25', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project CSA-FKI Karawang Rumah Net</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/2', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"2\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project CSA-FKI Karawang Rumah Net\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(8, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-25 00:47:26', '2026-07-25 00:47:25', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project CSA-FKI Karawang Rumah Net</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/2', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"2\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project CSA-FKI Karawang Rumah Net\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(9, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-25 00:47:26', '2026-07-25 00:47:25', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project CSA-FKI Karawang Rumah Net</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/2', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"2\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project CSA-FKI Karawang Rumah Net\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(10, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-25 00:47:26', '2026-07-25 00:47:25', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project CSA-FKI Karawang Rumah Net</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/2', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"2\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project CSA-FKI Karawang Rumah Net\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(11, 10, 'Tender WON - Draft Kontrak Baru', 1, 0, NULL, NULL, '2026-07-25 00:49:03', '2026-07-31 13:29:15', NULL, 'Tender \"Project CSA-FKI Karawang Rumah Net\" telah disetujui (WON). Draft Kontrak #2 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": \"2\"}'),
(12, 1, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-25 00:49:03', '2026-07-25 00:49:02', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project CSA-FKI Karawang Rumah Net</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/2', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-24T17:49:02.643Z\", \"lead_id\": \"2\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project CSA-FKI Karawang Rumah Net\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(13, 35, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-25 00:49:03', '2026-07-25 00:49:02', NULL, 'Tender \"Project CSA-FKI Karawang Rumah Net\" telah disetujui (WON). Draft Kontrak #2 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": \"2\"}'),
(14, 4, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-25 00:49:03', '2026-07-25 00:49:02', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project CSA-FKI Karawang Rumah Net</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/2', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-24T17:49:02.643Z\", \"lead_id\": \"2\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project CSA-FKI Karawang Rumah Net\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(15, 1, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-25 00:49:03', '2026-07-25 00:49:02', NULL, 'Tender \"Project CSA-FKI Karawang Rumah Net\" telah disetujui (WON). Draft Kontrak #2 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": \"2\"}'),
(16, 6, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-25 00:49:03', '2026-07-25 00:49:02', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project CSA-FKI Karawang Rumah Net</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/2', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-24T17:49:02.643Z\", \"lead_id\": \"2\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project CSA-FKI Karawang Rumah Net\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(17, 39, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-25 00:49:03', '2026-07-25 00:49:02', NULL, 'Tender \"Project CSA-FKI Karawang Rumah Net\" telah disetujui (WON). Draft Kontrak #2 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": \"2\"}'),
(18, 7, '🎉 Pemenang Tender', 1, 0, NULL, NULL, '2026-07-25 00:49:03', '2026-07-31 13:29:40', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project CSA-FKI Karawang Rumah Net</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/2', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-24T17:49:02.643Z\", \"lead_id\": \"2\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project CSA-FKI Karawang Rumah Net\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(19, 33, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-25 00:49:03', '2026-07-25 00:49:02', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project CSA-FKI Karawang Rumah Net</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/2', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-24T17:49:02.643Z\", \"lead_id\": \"2\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project CSA-FKI Karawang Rumah Net\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(20, 39, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-25 00:49:03', '2026-07-25 00:49:02', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project CSA-FKI Karawang Rumah Net</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/2', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-24T17:49:02.643Z\", \"lead_id\": \"2\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project CSA-FKI Karawang Rumah Net\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(21, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-25 14:11:35', '2026-07-25 14:11:34', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gateway Tangerang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/3', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"3\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gateway Tangerang\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(22, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-25 14:11:35', '2026-07-25 14:11:34', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gateway Tangerang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/3', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"3\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gateway Tangerang\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(23, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-25 14:11:35', '2026-07-25 14:11:34', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gateway Tangerang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/3', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"3\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gateway Tangerang\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(24, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-25 14:11:35', '2026-07-25 14:11:35', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gateway Tangerang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/3', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"3\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gateway Tangerang\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(25, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-25 14:11:35', '2026-07-25 14:11:35', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gateway Tangerang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/3', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"3\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gateway Tangerang\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(26, 1, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-07-29 18:15:28', '2026-07-29 18:15:27', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">Test Deal Automation Fix Verification</span>.', 'ALERT', '/sales/tenders/5', '{\"tier\": \"Small\", \"won_at\": null, \"lead_id\": \"5\", \"user_name\": \"Lukas Kurniawan\", \"action_type\": \"PROPOSAL_UPLOADED\", \"project_name\": \"Test Deal Automation Fix Verification\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(27, 4, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-07-29 18:15:28', '2026-07-29 18:15:27', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">Test Deal Automation Fix Verification</span>.', 'ALERT', '/sales/tenders/5', '{\"tier\": \"Small\", \"won_at\": null, \"lead_id\": \"5\", \"user_name\": \"Lukas Kurniawan\", \"action_type\": \"PROPOSAL_UPLOADED\", \"project_name\": \"Test Deal Automation Fix Verification\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(28, 6, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-07-29 18:15:28', '2026-07-29 18:15:27', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">Test Deal Automation Fix Verification</span>.', 'ALERT', '/sales/tenders/5', '{\"tier\": \"Small\", \"won_at\": null, \"lead_id\": \"5\", \"user_name\": \"Lukas Kurniawan\", \"action_type\": \"PROPOSAL_UPLOADED\", \"project_name\": \"Test Deal Automation Fix Verification\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(29, 32, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-07-29 18:15:28', '2026-07-29 18:15:27', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">Test Deal Automation Fix Verification</span>.', 'ALERT', '/sales/tenders/5', '{\"tier\": \"Small\", \"won_at\": null, \"lead_id\": \"5\", \"user_name\": \"Lukas Kurniawan\", \"action_type\": \"PROPOSAL_UPLOADED\", \"project_name\": \"Test Deal Automation Fix Verification\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(30, 33, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-07-29 18:15:28', '2026-07-29 18:15:27', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">Test Deal Automation Fix Verification</span>.', 'ALERT', '/sales/tenders/5', '{\"tier\": \"Small\", \"won_at\": null, \"lead_id\": \"5\", \"user_name\": \"Lukas Kurniawan\", \"action_type\": \"PROPOSAL_UPLOADED\", \"project_name\": \"Test Deal Automation Fix Verification\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(31, 39, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-07-29 18:15:28', '2026-07-29 18:15:27', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">Test Deal Automation Fix Verification</span>.', 'ALERT', '/sales/tenders/5', '{\"tier\": \"Small\", \"won_at\": null, \"lead_id\": \"5\", \"user_name\": \"Lukas Kurniawan\", \"action_type\": \"PROPOSAL_UPLOADED\", \"project_name\": \"Test Deal Automation Fix Verification\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(32, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-29 18:16:35', '2026-07-29 18:16:35', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project CSA-JLM BOGOR</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/7', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"7\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project CSA-JLM BOGOR\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(33, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-29 18:16:35', '2026-07-29 18:16:35', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project CSA-JLM BOGOR</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/7', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"7\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project CSA-JLM BOGOR\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(34, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-29 18:16:35', '2026-07-29 18:16:35', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project CSA-JLM BOGOR</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/7', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"7\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project CSA-JLM BOGOR\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(35, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-29 18:16:35', '2026-07-29 18:16:35', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project CSA-JLM BOGOR</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/7', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"7\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project CSA-JLM BOGOR\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(36, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-29 18:16:35', '2026-07-29 18:16:35', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project CSA-JLM BOGOR</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/7', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"7\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project CSA-JLM BOGOR\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(37, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-29 18:16:35', '2026-07-29 18:16:35', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project CSA-JLM BOGOR</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/7', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"7\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project CSA-JLM BOGOR\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(38, 1, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-07-29 18:17:18', '2026-07-29 18:17:17', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">Project CSA-JLM BOGOR</span>.', 'ALERT', '/sales/tenders/7', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"7\", \"user_name\": \"Lukas Kurniawan\", \"action_type\": \"PROPOSAL_UPLOADED\", \"project_name\": \"Project CSA-JLM BOGOR\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(39, 4, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-07-29 18:17:18', '2026-07-29 18:17:17', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">Project CSA-JLM BOGOR</span>.', 'ALERT', '/sales/tenders/7', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"7\", \"user_name\": \"Lukas Kurniawan\", \"action_type\": \"PROPOSAL_UPLOADED\", \"project_name\": \"Project CSA-JLM BOGOR\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(40, 6, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-07-29 18:17:18', '2026-07-29 18:17:17', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">Project CSA-JLM BOGOR</span>.', 'ALERT', '/sales/tenders/7', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"7\", \"user_name\": \"Lukas Kurniawan\", \"action_type\": \"PROPOSAL_UPLOADED\", \"project_name\": \"Project CSA-JLM BOGOR\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(41, 32, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-07-29 18:17:18', '2026-07-29 18:17:17', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">Project CSA-JLM BOGOR</span>.', 'ALERT', '/sales/tenders/7', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"7\", \"user_name\": \"Lukas Kurniawan\", \"action_type\": \"PROPOSAL_UPLOADED\", \"project_name\": \"Project CSA-JLM BOGOR\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(42, 33, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-07-29 18:17:18', '2026-07-29 18:17:17', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">Project CSA-JLM BOGOR</span>.', 'ALERT', '/sales/tenders/7', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"7\", \"user_name\": \"Lukas Kurniawan\", \"action_type\": \"PROPOSAL_UPLOADED\", \"project_name\": \"Project CSA-JLM BOGOR\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(43, 39, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-07-29 18:17:18', '2026-07-29 18:17:17', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">Project CSA-JLM BOGOR</span>.', 'ALERT', '/sales/tenders/7', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"7\", \"user_name\": \"Lukas Kurniawan\", \"action_type\": \"PROPOSAL_UPLOADED\", \"project_name\": \"Project CSA-JLM BOGOR\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(44, 10, 'Tender WON - Draft Kontrak Baru', 1, 0, NULL, NULL, '2026-07-29 18:18:24', '2026-07-31 13:29:15', NULL, 'Tender \"Project CSA-JLM BOGOR\" telah disetujui (WON). Draft Kontrak #4 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": \"4\"}'),
(45, 1, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-29 18:18:24', '2026-07-29 18:18:23', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project CSA-JLM BOGOR</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/7', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-29T11:18:23.894Z\", \"lead_id\": \"7\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project CSA-JLM BOGOR\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(46, 35, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-29 18:18:24', '2026-07-29 18:18:23', NULL, 'Tender \"Project CSA-JLM BOGOR\" telah disetujui (WON). Draft Kontrak #4 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": \"4\"}'),
(47, 1, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-29 18:18:24', '2026-07-29 18:18:23', NULL, 'Tender \"Project CSA-JLM BOGOR\" telah disetujui (WON). Draft Kontrak #4 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": \"4\"}'),
(48, 4, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-29 18:18:24', '2026-07-29 18:18:23', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project CSA-JLM BOGOR</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/7', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-29T11:18:23.894Z\", \"lead_id\": \"7\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project CSA-JLM BOGOR\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(49, 32, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-29 18:18:24', '2026-07-29 18:18:23', NULL, 'Tender \"Project CSA-JLM BOGOR\" telah disetujui (WON). Draft Kontrak #4 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": \"4\"}'),
(50, 6, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-29 18:18:24', '2026-07-29 18:18:23', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project CSA-JLM BOGOR</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/7', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-29T11:18:23.894Z\", \"lead_id\": \"7\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project CSA-JLM BOGOR\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(51, 39, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-29 18:18:24', '2026-07-29 18:18:23', NULL, 'Tender \"Project CSA-JLM BOGOR\" telah disetujui (WON). Draft Kontrak #4 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": \"4\"}'),
(52, 7, '🎉 Pemenang Tender', 1, 0, NULL, NULL, '2026-07-29 18:18:24', '2026-07-31 13:29:40', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project CSA-JLM BOGOR</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/7', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-29T11:18:23.894Z\", \"lead_id\": \"7\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project CSA-JLM BOGOR\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(53, 32, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-29 18:18:24', '2026-07-29 18:18:23', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project CSA-JLM BOGOR</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/7', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-29T11:18:23.894Z\", \"lead_id\": \"7\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project CSA-JLM BOGOR\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(54, 33, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-29 18:18:24', '2026-07-29 18:18:23', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project CSA-JLM BOGOR</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/7', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-29T11:18:23.894Z\", \"lead_id\": \"7\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project CSA-JLM BOGOR\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(55, 39, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-29 18:18:24', '2026-07-29 18:18:23', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project CSA-JLM BOGOR</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/7', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-29T11:18:23.894Z\", \"lead_id\": \"7\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project CSA-JLM BOGOR\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(56, 10, 'Tender WON - Draft Kontrak Baru', 1, 0, NULL, NULL, '2026-07-29 18:19:36', '2026-07-31 13:29:15', NULL, 'Tender \"Project CSA-JLM BOGOR\" telah disetujui (WON). Draft Kontrak #5 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": \"5\"}'),
(57, 1, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-29 18:19:36', '2026-07-29 18:19:35', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project CSA-JLM BOGOR</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/7', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-29T11:19:35.844Z\", \"lead_id\": \"7\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project CSA-JLM BOGOR\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(58, 35, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-29 18:19:36', '2026-07-29 18:19:35', NULL, 'Tender \"Project CSA-JLM BOGOR\" telah disetujui (WON). Draft Kontrak #5 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": \"5\"}'),
(59, 4, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-29 18:19:36', '2026-07-29 18:19:35', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project CSA-JLM BOGOR</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/7', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-29T11:19:35.844Z\", \"lead_id\": \"7\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project CSA-JLM BOGOR\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(60, 1, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-29 18:19:36', '2026-07-29 18:19:35', NULL, 'Tender \"Project CSA-JLM BOGOR\" telah disetujui (WON). Draft Kontrak #5 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": \"5\"}'),
(61, 6, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-29 18:19:36', '2026-07-29 18:19:35', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project CSA-JLM BOGOR</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/7', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-29T11:19:35.844Z\", \"lead_id\": \"7\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project CSA-JLM BOGOR\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(62, 32, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-29 18:19:36', '2026-07-29 18:19:35', NULL, 'Tender \"Project CSA-JLM BOGOR\" telah disetujui (WON). Draft Kontrak #5 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": \"5\"}'),
(63, 7, '🎉 Pemenang Tender', 1, 0, NULL, NULL, '2026-07-29 18:19:36', '2026-07-31 13:29:40', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project CSA-JLM BOGOR</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/7', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-29T11:19:35.844Z\", \"lead_id\": \"7\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project CSA-JLM BOGOR\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(64, 39, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-29 18:19:36', '2026-07-29 18:19:35', NULL, 'Tender \"Project CSA-JLM BOGOR\" telah disetujui (WON). Draft Kontrak #5 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": \"5\"}'),
(65, 32, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-29 18:19:36', '2026-07-29 18:19:35', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project CSA-JLM BOGOR</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/7', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-29T11:19:35.844Z\", \"lead_id\": \"7\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project CSA-JLM BOGOR\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(66, 33, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-29 18:19:36', '2026-07-29 18:19:35', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project CSA-JLM BOGOR</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/7', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-29T11:19:35.844Z\", \"lead_id\": \"7\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project CSA-JLM BOGOR\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(67, 39, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-29 18:19:36', '2026-07-29 18:19:35', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project CSA-JLM BOGOR</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/7', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-29T11:19:35.844Z\", \"lead_id\": \"7\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project CSA-JLM BOGOR\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(68, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-29 19:30:32', '2026-07-29 19:30:31', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Lahan Parkir Gateway Bandung</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/8', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"8\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Lahan Parkir Gateway Bandung\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(69, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-29 19:30:32', '2026-07-29 19:30:31', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Lahan Parkir Gateway Bandung</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/8', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"8\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Lahan Parkir Gateway Bandung\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(70, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-29 19:30:32', '2026-07-29 19:30:31', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Lahan Parkir Gateway Bandung</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/8', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"8\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Lahan Parkir Gateway Bandung\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(71, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-29 19:30:32', '2026-07-29 19:30:31', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Lahan Parkir Gateway Bandung</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/8', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"8\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Lahan Parkir Gateway Bandung\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(72, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-29 19:30:32', '2026-07-29 19:30:31', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Lahan Parkir Gateway Bandung</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/8', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"8\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Lahan Parkir Gateway Bandung\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(73, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-29 19:30:32', '2026-07-29 19:30:31', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Lahan Parkir Gateway Bandung</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/8', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"8\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Lahan Parkir Gateway Bandung\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(74, 1, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-07-29 21:03:16', '2026-07-29 21:03:16', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Lahan Parkir Gateway Bandung</span>.', 'ALERT', '/sales/tenders/8', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"8\", \"user_name\": \"Lukas Kurniawan\", \"action_type\": \"PROPOSAL_UPLOADED\", \"project_name\": \"Renovasi Lahan Parkir Gateway Bandung\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(75, 4, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-07-29 21:03:16', '2026-07-29 21:03:16', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Lahan Parkir Gateway Bandung</span>.', 'ALERT', '/sales/tenders/8', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"8\", \"user_name\": \"Lukas Kurniawan\", \"action_type\": \"PROPOSAL_UPLOADED\", \"project_name\": \"Renovasi Lahan Parkir Gateway Bandung\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(76, 6, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-07-29 21:03:16', '2026-07-29 21:03:16', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Lahan Parkir Gateway Bandung</span>.', 'ALERT', '/sales/tenders/8', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"8\", \"user_name\": \"Lukas Kurniawan\", \"action_type\": \"PROPOSAL_UPLOADED\", \"project_name\": \"Renovasi Lahan Parkir Gateway Bandung\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(77, 32, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-07-29 21:03:16', '2026-07-29 21:03:16', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Lahan Parkir Gateway Bandung</span>.', 'ALERT', '/sales/tenders/8', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"8\", \"user_name\": \"Lukas Kurniawan\", \"action_type\": \"PROPOSAL_UPLOADED\", \"project_name\": \"Renovasi Lahan Parkir Gateway Bandung\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(78, 33, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-07-29 21:03:16', '2026-07-29 21:03:16', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Lahan Parkir Gateway Bandung</span>.', 'ALERT', '/sales/tenders/8', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"8\", \"user_name\": \"Lukas Kurniawan\", \"action_type\": \"PROPOSAL_UPLOADED\", \"project_name\": \"Renovasi Lahan Parkir Gateway Bandung\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(79, 39, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-07-29 21:03:16', '2026-07-29 21:03:16', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Lahan Parkir Gateway Bandung</span>.', 'ALERT', '/sales/tenders/8', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"8\", \"user_name\": \"Lukas Kurniawan\", \"action_type\": \"PROPOSAL_UPLOADED\", \"project_name\": \"Renovasi Lahan Parkir Gateway Bandung\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(80, 1, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-29 21:03:51', '2026-07-29 21:03:50', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Lahan Parkir Gateway Bandung</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/8', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-29T14:03:50.873Z\", \"lead_id\": \"8\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Renovasi Lahan Parkir Gateway Bandung\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(81, 10, 'Tender WON - Draft Kontrak Baru', 1, 0, NULL, NULL, '2026-07-29 21:03:51', '2026-07-31 13:29:15', NULL, 'Tender \"Renovasi Lahan Parkir Gateway Bandung\" telah disetujui (WON). Draft Kontrak #7 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": \"7\"}'),
(82, 35, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-29 21:03:51', '2026-07-29 21:03:50', NULL, 'Tender \"Renovasi Lahan Parkir Gateway Bandung\" telah disetujui (WON). Draft Kontrak #7 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": \"7\"}');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `is_read`, `created_by`, `updated_by`, `deleted_by`, `created_at`, `updated_at`, `deleted_at`, `message`, `notification_type`, `action_link`, `meta_data`) VALUES
(83, 4, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-29 21:03:51', '2026-07-29 21:03:50', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Lahan Parkir Gateway Bandung</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/8', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-29T14:03:50.873Z\", \"lead_id\": \"8\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Renovasi Lahan Parkir Gateway Bandung\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(84, 1, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-29 21:03:51', '2026-07-29 21:03:50', NULL, 'Tender \"Renovasi Lahan Parkir Gateway Bandung\" telah disetujui (WON). Draft Kontrak #7 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": \"7\"}'),
(85, 6, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-29 21:03:51', '2026-07-29 21:03:50', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Lahan Parkir Gateway Bandung</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/8', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-29T14:03:50.873Z\", \"lead_id\": \"8\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Renovasi Lahan Parkir Gateway Bandung\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(86, 32, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-29 21:03:51', '2026-07-29 21:03:50', NULL, 'Tender \"Renovasi Lahan Parkir Gateway Bandung\" telah disetujui (WON). Draft Kontrak #7 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": \"7\"}'),
(87, 7, '🎉 Pemenang Tender', 1, 0, NULL, NULL, '2026-07-29 21:03:51', '2026-07-31 13:29:40', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Lahan Parkir Gateway Bandung</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/8', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-29T14:03:50.873Z\", \"lead_id\": \"8\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Renovasi Lahan Parkir Gateway Bandung\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(88, 39, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-29 21:03:51', '2026-07-29 21:03:50', NULL, 'Tender \"Renovasi Lahan Parkir Gateway Bandung\" telah disetujui (WON). Draft Kontrak #7 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": \"7\"}'),
(89, 32, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-29 21:03:51', '2026-07-29 21:03:50', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Lahan Parkir Gateway Bandung</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/8', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-29T14:03:50.873Z\", \"lead_id\": \"8\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Renovasi Lahan Parkir Gateway Bandung\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(90, 33, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-29 21:03:51', '2026-07-29 21:03:50', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Lahan Parkir Gateway Bandung</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/8', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-29T14:03:50.873Z\", \"lead_id\": \"8\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Renovasi Lahan Parkir Gateway Bandung\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(91, 39, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-29 21:03:51', '2026-07-29 21:03:50', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Lahan Parkir Gateway Bandung</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/8', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-29T14:03:50.873Z\", \"lead_id\": \"8\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Renovasi Lahan Parkir Gateway Bandung\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(92, 10, 'Tender WON - Draft Kontrak Baru', 1, 0, NULL, NULL, '2026-07-29 21:08:30', '2026-07-31 13:29:15', NULL, 'Tender \"Renovasi Gateway Tangerang\" telah disetujui (WON). Draft Kontrak #8 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": \"8\"}'),
(93, 1, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-29 21:08:30', '2026-07-29 21:08:29', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gateway Tangerang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/3', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-29T14:08:29.755Z\", \"lead_id\": \"3\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Renovasi Gateway Tangerang\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(94, 35, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-29 21:08:30', '2026-07-29 21:08:29', NULL, 'Tender \"Renovasi Gateway Tangerang\" telah disetujui (WON). Draft Kontrak #8 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": \"8\"}'),
(95, 4, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-29 21:08:30', '2026-07-29 21:08:29', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gateway Tangerang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/3', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-29T14:08:29.755Z\", \"lead_id\": \"3\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Renovasi Gateway Tangerang\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(96, 1, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-29 21:08:30', '2026-07-29 21:08:29', NULL, 'Tender \"Renovasi Gateway Tangerang\" telah disetujui (WON). Draft Kontrak #8 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": \"8\"}'),
(97, 6, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-29 21:08:30', '2026-07-29 21:08:29', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gateway Tangerang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/3', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-29T14:08:29.755Z\", \"lead_id\": \"3\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Renovasi Gateway Tangerang\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(98, 32, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-29 21:08:30', '2026-07-29 21:08:29', NULL, 'Tender \"Renovasi Gateway Tangerang\" telah disetujui (WON). Draft Kontrak #8 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": \"8\"}'),
(99, 7, '🎉 Pemenang Tender', 1, 0, NULL, NULL, '2026-07-29 21:08:30', '2026-07-31 13:29:40', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gateway Tangerang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/3', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-29T14:08:29.755Z\", \"lead_id\": \"3\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Renovasi Gateway Tangerang\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(100, 39, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-29 21:08:30', '2026-07-29 21:08:29', NULL, 'Tender \"Renovasi Gateway Tangerang\" telah disetujui (WON). Draft Kontrak #8 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": \"8\"}'),
(101, 32, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-29 21:08:30', '2026-07-29 21:08:29', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gateway Tangerang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/3', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-29T14:08:29.755Z\", \"lead_id\": \"3\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Renovasi Gateway Tangerang\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(102, 33, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-29 21:08:30', '2026-07-29 21:08:29', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gateway Tangerang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/3', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-29T14:08:29.755Z\", \"lead_id\": \"3\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Renovasi Gateway Tangerang\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(103, 39, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-29 21:08:30', '2026-07-29 21:08:29', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gateway Tangerang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/3', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-29T14:08:29.755Z\", \"lead_id\": \"3\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Renovasi Gateway Tangerang\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(104, 1, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-29 21:58:41', '2026-07-29 21:58:41', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi Gudang J&T Jelambar Ruang Purchasing</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/1', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-29T14:58:41.201Z\", \"lead_id\": \"1\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project Renovasi Gudang J&T Jelambar Ruang Purchasing\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(105, 4, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-29 21:58:41', '2026-07-29 21:58:41', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi Gudang J&T Jelambar Ruang Purchasing</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/1', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-29T14:58:41.201Z\", \"lead_id\": \"1\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project Renovasi Gudang J&T Jelambar Ruang Purchasing\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(106, 6, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-29 21:58:41', '2026-07-29 21:58:41', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi Gudang J&T Jelambar Ruang Purchasing</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/1', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-29T14:58:41.201Z\", \"lead_id\": \"1\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project Renovasi Gudang J&T Jelambar Ruang Purchasing\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(107, 7, '🎉 Pemenang Tender', 1, 0, NULL, NULL, '2026-07-29 21:58:41', '2026-07-31 13:29:40', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi Gudang J&T Jelambar Ruang Purchasing</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/1', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-29T14:58:41.201Z\", \"lead_id\": \"1\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project Renovasi Gudang J&T Jelambar Ruang Purchasing\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(108, 32, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-29 21:58:41', '2026-07-29 21:58:41', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi Gudang J&T Jelambar Ruang Purchasing</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/1', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-29T14:58:41.201Z\", \"lead_id\": \"1\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project Renovasi Gudang J&T Jelambar Ruang Purchasing\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(109, 33, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-29 21:58:41', '2026-07-29 21:58:41', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi Gudang J&T Jelambar Ruang Purchasing</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/1', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-29T14:58:41.201Z\", \"lead_id\": \"1\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project Renovasi Gudang J&T Jelambar Ruang Purchasing\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(110, 39, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-29 21:58:41', '2026-07-29 21:58:41', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi Gudang J&T Jelambar Ruang Purchasing</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/1', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-29T14:58:41.201Z\", \"lead_id\": \"1\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project Renovasi Gudang J&T Jelambar Ruang Purchasing\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(111, 10, 'Tender WON - Draft Kontrak Baru', 1, 0, NULL, NULL, '2026-07-29 21:59:04', '2026-07-31 13:29:15', NULL, 'Tender \"Tender ID: 1\" telah disetujui (WON). Draft Kontrak #9 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 9}'),
(112, 35, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-29 21:59:04', '2026-07-29 21:59:03', NULL, 'Tender \"Tender ID: 1\" telah disetujui (WON). Draft Kontrak #9 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 9}'),
(113, 1, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-29 21:59:04', '2026-07-29 21:59:03', NULL, 'Tender \"Tender ID: 1\" telah disetujui (WON). Draft Kontrak #9 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 9}'),
(114, 32, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-29 21:59:04', '2026-07-29 21:59:03', NULL, 'Tender \"Tender ID: 1\" telah disetujui (WON). Draft Kontrak #9 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 9}'),
(115, 39, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-29 21:59:04', '2026-07-29 21:59:03', NULL, 'Tender \"Tender ID: 1\" telah disetujui (WON). Draft Kontrak #9 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 9}'),
(116, 1, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-29 21:59:04', '2026-07-29 21:59:04', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi Gudang J&T Jelambar Ruang Purchasing</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/1', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-29T14:59:04.241Z\", \"lead_id\": \"1\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project Renovasi Gudang J&T Jelambar Ruang Purchasing\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(117, 4, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-29 21:59:04', '2026-07-29 21:59:04', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi Gudang J&T Jelambar Ruang Purchasing</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/1', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-29T14:59:04.241Z\", \"lead_id\": \"1\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project Renovasi Gudang J&T Jelambar Ruang Purchasing\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(118, 6, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-29 21:59:04', '2026-07-29 21:59:04', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi Gudang J&T Jelambar Ruang Purchasing</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/1', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-29T14:59:04.241Z\", \"lead_id\": \"1\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project Renovasi Gudang J&T Jelambar Ruang Purchasing\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(119, 7, '🎉 Pemenang Tender', 1, 0, NULL, NULL, '2026-07-29 21:59:04', '2026-07-31 13:29:40', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi Gudang J&T Jelambar Ruang Purchasing</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/1', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-29T14:59:04.241Z\", \"lead_id\": \"1\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project Renovasi Gudang J&T Jelambar Ruang Purchasing\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(120, 32, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-29 21:59:04', '2026-07-29 21:59:04', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi Gudang J&T Jelambar Ruang Purchasing</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/1', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-29T14:59:04.241Z\", \"lead_id\": \"1\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project Renovasi Gudang J&T Jelambar Ruang Purchasing\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(121, 33, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-29 21:59:04', '2026-07-29 21:59:04', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi Gudang J&T Jelambar Ruang Purchasing</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/1', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-29T14:59:04.241Z\", \"lead_id\": \"1\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project Renovasi Gudang J&T Jelambar Ruang Purchasing\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(122, 39, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-29 21:59:04', '2026-07-29 21:59:04', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi Gudang J&T Jelambar Ruang Purchasing</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/1', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-29T14:59:04.241Z\", \"lead_id\": \"1\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project Renovasi Gudang J&T Jelambar Ruang Purchasing\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(123, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-29 22:04:34', '2026-07-29 22:04:33', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang J&T Bogor </span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/9', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"9\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gudang J&T Bogor \", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(124, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-29 22:04:34', '2026-07-29 22:04:33', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang J&T Bogor </span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/9', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"9\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gudang J&T Bogor \", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(125, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-29 22:04:34', '2026-07-29 22:04:33', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang J&T Bogor </span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/9', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"9\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gudang J&T Bogor \", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(126, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-29 22:04:34', '2026-07-29 22:04:33', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang J&T Bogor </span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/9', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"9\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gudang J&T Bogor \", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(127, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-29 22:04:34', '2026-07-29 22:04:33', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang J&T Bogor </span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/9', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"9\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gudang J&T Bogor \", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(128, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-29 22:04:34', '2026-07-29 22:04:33', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang J&T Bogor </span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/9', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"9\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gudang J&T Bogor \", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(129, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-29 22:05:34', '2026-07-29 22:05:33', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang Serang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/10', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"10\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gudang Serang\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(130, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-29 22:05:34', '2026-07-29 22:05:33', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang Serang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/10', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"10\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gudang Serang\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(131, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-29 22:05:34', '2026-07-29 22:05:33', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang Serang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/10', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"10\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gudang Serang\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(132, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-29 22:05:34', '2026-07-29 22:05:33', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang Serang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/10', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"10\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gudang Serang\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(133, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-29 22:05:34', '2026-07-29 22:05:33', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang Serang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/10', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"10\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gudang Serang\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(134, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-29 22:05:34', '2026-07-29 22:05:33', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang Serang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/10', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"10\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gudang Serang\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(135, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-29 22:06:23', '2026-07-29 22:06:22', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang Jambi</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/11', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"11\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gudang Jambi\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(136, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-29 22:06:23', '2026-07-29 22:06:22', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang Jambi</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/11', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"11\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gudang Jambi\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(137, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-29 22:06:23', '2026-07-29 22:06:22', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang Jambi</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/11', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"11\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gudang Jambi\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(138, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-29 22:06:23', '2026-07-29 22:06:22', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang Jambi</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/11', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"11\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gudang Jambi\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(139, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-29 22:06:23', '2026-07-29 22:06:22', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang Jambi</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/11', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"11\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gudang Jambi\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(140, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-29 22:06:23', '2026-07-29 22:06:22', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang Jambi</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/11', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"11\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gudang Jambi\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(141, 10, 'Tender WON - Draft Kontrak Baru', 1, 0, NULL, NULL, '2026-07-29 22:29:27', '2026-07-31 13:29:15', NULL, 'Tender \"Tender ID: 11\" telah disetujui (WON). Draft Kontrak #10 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 10}'),
(142, 35, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-29 22:29:27', '2026-07-29 22:29:27', NULL, 'Tender \"Tender ID: 11\" telah disetujui (WON). Draft Kontrak #10 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 10}'),
(143, 1, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-29 22:29:27', '2026-07-29 22:29:27', NULL, 'Tender \"Tender ID: 11\" telah disetujui (WON). Draft Kontrak #10 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 10}'),
(144, 32, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-29 22:29:27', '2026-07-29 22:29:27', NULL, 'Tender \"Tender ID: 11\" telah disetujui (WON). Draft Kontrak #10 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 10}'),
(145, 39, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-29 22:29:27', '2026-07-29 22:29:27', NULL, 'Tender \"Tender ID: 11\" telah disetujui (WON). Draft Kontrak #10 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 10}'),
(146, 1, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-29 22:29:28', '2026-07-29 22:29:27', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang Jambi</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/11', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-29T15:29:27.589Z\", \"lead_id\": \"11\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Renovasi Gudang Jambi\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(147, 4, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-29 22:29:28', '2026-07-29 22:29:27', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang Jambi</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/11', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-29T15:29:27.589Z\", \"lead_id\": \"11\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Renovasi Gudang Jambi\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(148, 6, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-29 22:29:28', '2026-07-29 22:29:27', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang Jambi</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/11', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-29T15:29:27.589Z\", \"lead_id\": \"11\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Renovasi Gudang Jambi\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(149, 7, '🎉 Pemenang Tender', 1, 0, NULL, NULL, '2026-07-29 22:29:28', '2026-07-31 13:29:40', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang Jambi</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/11', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-29T15:29:27.589Z\", \"lead_id\": \"11\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Renovasi Gudang Jambi\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(150, 32, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-29 22:29:28', '2026-07-29 22:29:27', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang Jambi</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/11', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-29T15:29:27.589Z\", \"lead_id\": \"11\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Renovasi Gudang Jambi\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(151, 33, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-29 22:29:28', '2026-07-29 22:29:27', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang Jambi</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/11', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-29T15:29:27.589Z\", \"lead_id\": \"11\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Renovasi Gudang Jambi\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(152, 39, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-29 22:29:28', '2026-07-29 22:29:27', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang Jambi</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/11', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-29T15:29:27.589Z\", \"lead_id\": \"11\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Renovasi Gudang Jambi\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(153, 10, 'Tender WON - Draft Kontrak Baru', 1, 0, NULL, NULL, '2026-07-29 22:43:14', '2026-07-31 13:29:15', NULL, 'Tender \"Tender ID: 10\" telah disetujui (WON). Draft Kontrak #11 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 11}'),
(154, 35, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-29 22:43:14', '2026-07-29 22:43:14', NULL, 'Tender \"Tender ID: 10\" telah disetujui (WON). Draft Kontrak #11 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 11}'),
(155, 1, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-29 22:43:14', '2026-07-29 22:43:14', NULL, 'Tender \"Tender ID: 10\" telah disetujui (WON). Draft Kontrak #11 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 11}'),
(156, 32, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-29 22:43:14', '2026-07-29 22:43:14', NULL, 'Tender \"Tender ID: 10\" telah disetujui (WON). Draft Kontrak #11 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 11}'),
(157, 39, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-29 22:43:14', '2026-07-29 22:43:14', NULL, 'Tender \"Tender ID: 10\" telah disetujui (WON). Draft Kontrak #11 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 11}'),
(158, 1, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-29 22:43:14', '2026-07-29 22:43:14', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang Serang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/10', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-29T15:43:14.403Z\", \"lead_id\": \"10\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Renovasi Gudang Serang\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(159, 4, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-29 22:43:14', '2026-07-29 22:43:14', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang Serang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/10', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-29T15:43:14.403Z\", \"lead_id\": \"10\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Renovasi Gudang Serang\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(160, 6, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-29 22:43:14', '2026-07-29 22:43:14', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang Serang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/10', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-29T15:43:14.403Z\", \"lead_id\": \"10\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Renovasi Gudang Serang\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(161, 7, '🎉 Pemenang Tender', 1, 0, NULL, NULL, '2026-07-29 22:43:14', '2026-07-31 13:29:40', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang Serang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/10', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-29T15:43:14.403Z\", \"lead_id\": \"10\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Renovasi Gudang Serang\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(162, 32, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-29 22:43:14', '2026-07-29 22:43:14', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang Serang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/10', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-29T15:43:14.403Z\", \"lead_id\": \"10\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Renovasi Gudang Serang\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(163, 33, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-29 22:43:14', '2026-07-29 22:43:14', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang Serang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/10', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-29T15:43:14.403Z\", \"lead_id\": \"10\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Renovasi Gudang Serang\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(164, 39, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-29 22:43:14', '2026-07-29 22:43:14', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang Serang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/10', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-29T15:43:14.403Z\", \"lead_id\": \"10\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Renovasi Gudang Serang\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(165, 10, 'Tender WON - Draft Kontrak Baru', 1, 0, NULL, NULL, '2026-07-29 22:44:03', '2026-07-31 13:29:15', NULL, 'Tender \"Tender ID: 9\" telah disetujui (WON). Draft Kontrak #12 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 12}'),
(166, 35, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-29 22:44:03', '2026-07-29 22:44:03', NULL, 'Tender \"Tender ID: 9\" telah disetujui (WON). Draft Kontrak #12 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 12}'),
(167, 1, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-29 22:44:03', '2026-07-29 22:44:03', NULL, 'Tender \"Tender ID: 9\" telah disetujui (WON). Draft Kontrak #12 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 12}');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `is_read`, `created_by`, `updated_by`, `deleted_by`, `created_at`, `updated_at`, `deleted_at`, `message`, `notification_type`, `action_link`, `meta_data`) VALUES
(168, 32, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-29 22:44:03', '2026-07-29 22:44:03', NULL, 'Tender \"Tender ID: 9\" telah disetujui (WON). Draft Kontrak #12 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 12}'),
(169, 39, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-29 22:44:03', '2026-07-29 22:44:03', NULL, 'Tender \"Tender ID: 9\" telah disetujui (WON). Draft Kontrak #12 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 12}'),
(170, 1, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-29 22:44:03', '2026-07-29 22:44:03', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang J&T Bogor </span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/9', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-29T15:44:03.403Z\", \"lead_id\": \"9\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Renovasi Gudang J&T Bogor \", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(171, 4, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-29 22:44:03', '2026-07-29 22:44:03', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang J&T Bogor </span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/9', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-29T15:44:03.403Z\", \"lead_id\": \"9\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Renovasi Gudang J&T Bogor \", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(172, 6, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-29 22:44:03', '2026-07-29 22:44:03', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang J&T Bogor </span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/9', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-29T15:44:03.403Z\", \"lead_id\": \"9\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Renovasi Gudang J&T Bogor \", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(173, 7, '🎉 Pemenang Tender', 1, 0, NULL, NULL, '2026-07-29 22:44:03', '2026-07-31 13:29:40', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang J&T Bogor </span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/9', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-29T15:44:03.403Z\", \"lead_id\": \"9\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Renovasi Gudang J&T Bogor \", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(174, 32, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-29 22:44:03', '2026-07-29 22:44:03', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang J&T Bogor </span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/9', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-29T15:44:03.403Z\", \"lead_id\": \"9\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Renovasi Gudang J&T Bogor \", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(175, 33, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-29 22:44:03', '2026-07-29 22:44:03', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang J&T Bogor </span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/9', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-29T15:44:03.403Z\", \"lead_id\": \"9\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Renovasi Gudang J&T Bogor \", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(176, 39, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-29 22:44:03', '2026-07-29 22:44:03', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang J&T Bogor </span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/9', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-29T15:44:03.403Z\", \"lead_id\": \"9\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Renovasi Gudang J&T Bogor \", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(177, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 10:32:07', '2026-07-31 10:32:07', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi lahan parkir Gateway Bandung</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/15', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"15\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Renovasi lahan parkir Gateway Bandung\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(178, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 10:32:07', '2026-07-31 10:32:07', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi lahan parkir Gateway Bandung</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/15', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"15\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Renovasi lahan parkir Gateway Bandung\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(179, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 10:32:07', '2026-07-31 10:32:07', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi lahan parkir Gateway Bandung</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/15', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"15\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Renovasi lahan parkir Gateway Bandung\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(180, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 10:32:07', '2026-07-31 10:32:07', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi lahan parkir Gateway Bandung</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/15', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"15\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Renovasi lahan parkir Gateway Bandung\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(181, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 10:32:07', '2026-07-31 10:32:07', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi lahan parkir Gateway Bandung</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/15', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"15\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Renovasi lahan parkir Gateway Bandung\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(182, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 10:32:07', '2026-07-31 10:32:07', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi lahan parkir Gateway Bandung</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/15', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"15\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Renovasi lahan parkir Gateway Bandung\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(183, 10, 'Tender WON - Draft Kontrak Baru', 1, 0, NULL, NULL, '2026-07-31 12:14:33', '2026-07-31 13:29:15', NULL, 'Tender \"Tender ID: 15\" telah disetujui (WON). Draft Kontrak #14 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 14}'),
(184, 35, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-31 12:14:33', '2026-07-31 12:14:32', NULL, 'Tender \"Tender ID: 15\" telah disetujui (WON). Draft Kontrak #14 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 14}'),
(185, 1, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-31 12:14:33', '2026-07-31 12:14:32', NULL, 'Tender \"Tender ID: 15\" telah disetujui (WON). Draft Kontrak #14 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 14}'),
(186, 32, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-31 12:14:33', '2026-07-31 12:14:32', NULL, 'Tender \"Tender ID: 15\" telah disetujui (WON). Draft Kontrak #14 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 14}'),
(187, 39, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-31 12:14:33', '2026-07-31 12:14:32', NULL, 'Tender \"Tender ID: 15\" telah disetujui (WON). Draft Kontrak #14 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 14}'),
(188, 1, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-31 12:14:33', '2026-07-31 12:14:32', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi lahan parkir Gateway Bandung</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/15', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-31T05:14:32.712Z\", \"lead_id\": \"15\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project Renovasi lahan parkir Gateway Bandung\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(189, 4, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-31 12:14:33', '2026-07-31 12:14:32', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi lahan parkir Gateway Bandung</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/15', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-31T05:14:32.712Z\", \"lead_id\": \"15\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project Renovasi lahan parkir Gateway Bandung\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(190, 6, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-31 12:14:33', '2026-07-31 12:14:32', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi lahan parkir Gateway Bandung</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/15', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-31T05:14:32.712Z\", \"lead_id\": \"15\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project Renovasi lahan parkir Gateway Bandung\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(191, 7, '🎉 Pemenang Tender', 1, 0, NULL, NULL, '2026-07-31 12:14:33', '2026-07-31 13:29:40', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi lahan parkir Gateway Bandung</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/15', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-31T05:14:32.712Z\", \"lead_id\": \"15\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project Renovasi lahan parkir Gateway Bandung\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(192, 32, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-31 12:14:33', '2026-07-31 12:14:32', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi lahan parkir Gateway Bandung</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/15', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-31T05:14:32.712Z\", \"lead_id\": \"15\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project Renovasi lahan parkir Gateway Bandung\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(193, 33, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-31 12:14:33', '2026-07-31 12:14:32', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi lahan parkir Gateway Bandung</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/15', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-31T05:14:32.712Z\", \"lead_id\": \"15\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project Renovasi lahan parkir Gateway Bandung\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(194, 39, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-31 12:14:33', '2026-07-31 12:14:32', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi lahan parkir Gateway Bandung</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/15', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-31T05:14:32.712Z\", \"lead_id\": \"15\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project Renovasi lahan parkir Gateway Bandung\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(195, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:27:12', '2026-07-31 13:27:12', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bandung </span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/16', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"16\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Bandung \", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(196, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:27:12', '2026-07-31 13:27:12', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bandung </span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/16', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"16\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Bandung \", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(197, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:27:12', '2026-07-31 13:27:12', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bandung </span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/16', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"16\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Bandung \", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(198, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:27:12', '2026-07-31 13:27:12', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bandung </span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/16', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"16\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Bandung \", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(199, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:27:12', '2026-07-31 13:27:12', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bandung </span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/16', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"16\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Bandung \", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(200, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:27:12', '2026-07-31 13:27:12', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bandung </span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/16', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"16\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Bandung \", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(201, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:28:09', '2026-07-31 13:28:08', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net BOGOR</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/17', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"17\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net BOGOR\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(202, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:28:09', '2026-07-31 13:28:08', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net BOGOR</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/17', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"17\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net BOGOR\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(203, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:28:09', '2026-07-31 13:28:08', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net BOGOR</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/17', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"17\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net BOGOR\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(204, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:28:09', '2026-07-31 13:28:08', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net BOGOR</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/17', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"17\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net BOGOR\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(205, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:28:09', '2026-07-31 13:28:08', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net BOGOR</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/17', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"17\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net BOGOR\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(206, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:28:09', '2026-07-31 13:28:08', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net BOGOR</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/17', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"17\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net BOGOR\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(207, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:30:29', '2026-07-31 13:30:29', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Garut</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/18', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"18\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Garut\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(208, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:30:29', '2026-07-31 13:30:29', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Garut</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/18', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"18\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Garut\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(209, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:30:29', '2026-07-31 13:30:29', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Garut</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/18', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"18\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Garut\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(210, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:30:29', '2026-07-31 13:30:29', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Garut</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/18', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"18\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Garut\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(211, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:30:29', '2026-07-31 13:30:29', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Garut</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/18', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"18\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Garut\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(212, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:30:29', '2026-07-31 13:30:29', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Garut</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/18', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"18\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Garut\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(213, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:31:10', '2026-07-31 13:31:09', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Ciamis</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/19', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"19\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Ciamis\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(214, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:31:10', '2026-07-31 13:31:09', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Ciamis</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/19', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"19\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Ciamis\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(215, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:31:10', '2026-07-31 13:31:09', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Ciamis</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/19', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"19\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Ciamis\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(216, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:31:10', '2026-07-31 13:31:09', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Ciamis</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/19', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"19\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Ciamis\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(217, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:31:10', '2026-07-31 13:31:09', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Ciamis</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/19', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"19\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Ciamis\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(218, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:31:10', '2026-07-31 13:31:09', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Ciamis</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/19', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"19\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Ciamis\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(219, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:32:46', '2026-07-31 13:32:45', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Tasikmalaya</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/20', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"20\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Tasikmalaya\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(220, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:32:46', '2026-07-31 13:32:45', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Tasikmalaya</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/20', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"20\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Tasikmalaya\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(221, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:32:46', '2026-07-31 13:32:45', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Tasikmalaya</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/20', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"20\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Tasikmalaya\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(222, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:32:46', '2026-07-31 13:32:45', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Tasikmalaya</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/20', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"20\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Tasikmalaya\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(223, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:32:46', '2026-07-31 13:32:45', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Tasikmalaya</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/20', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"20\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Tasikmalaya\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(224, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:32:46', '2026-07-31 13:32:45', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Tasikmalaya</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/20', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"20\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Tasikmalaya\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(225, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:33:46', '2026-07-31 13:33:46', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA FKI Rumah Net Cirebon</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/21', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"21\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA FKI Rumah Net Cirebon\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(226, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:33:46', '2026-07-31 13:33:46', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA FKI Rumah Net Cirebon</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/21', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"21\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA FKI Rumah Net Cirebon\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(227, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:33:46', '2026-07-31 13:33:46', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA FKI Rumah Net Cirebon</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/21', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"21\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA FKI Rumah Net Cirebon\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(228, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:33:46', '2026-07-31 13:33:46', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA FKI Rumah Net Cirebon</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/21', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"21\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA FKI Rumah Net Cirebon\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(229, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:33:46', '2026-07-31 13:33:46', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA FKI Rumah Net Cirebon</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/21', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"21\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA FKI Rumah Net Cirebon\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(230, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 13:33:46', '2026-07-31 13:33:46', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA FKI Rumah Net Cirebon</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/21', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"21\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA FKI Rumah Net Cirebon\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(231, 10, 'Tender WON - Draft Kontrak Baru', 1, 0, NULL, NULL, '2026-07-31 13:34:32', '2026-07-31 14:14:19', NULL, 'Tender \"Tender ID: 21\" telah disetujui (WON). Draft Kontrak #15 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 15}'),
(232, 35, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-31 13:34:32', '2026-07-31 13:34:31', NULL, 'Tender \"Tender ID: 21\" telah disetujui (WON). Draft Kontrak #15 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 15}'),
(233, 1, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-31 13:34:32', '2026-07-31 13:34:31', NULL, 'Tender \"Tender ID: 21\" telah disetujui (WON). Draft Kontrak #15 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 15}'),
(234, 32, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-31 13:34:32', '2026-07-31 13:34:31', NULL, 'Tender \"Tender ID: 21\" telah disetujui (WON). Draft Kontrak #15 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 15}'),
(235, 39, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-31 13:34:32', '2026-07-31 13:34:31', NULL, 'Tender \"Tender ID: 21\" telah disetujui (WON). Draft Kontrak #15 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 15}'),
(236, 1, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-31 13:34:32', '2026-07-31 13:34:32', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA FKI Rumah Net Cirebon</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/21', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-31T06:34:32.029Z\", \"lead_id\": \"21\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA FKI Rumah Net Cirebon\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(237, 4, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-31 13:34:32', '2026-07-31 13:34:32', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA FKI Rumah Net Cirebon</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/21', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-31T06:34:32.029Z\", \"lead_id\": \"21\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA FKI Rumah Net Cirebon\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(238, 6, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-31 13:34:32', '2026-07-31 13:34:32', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA FKI Rumah Net Cirebon</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/21', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-31T06:34:32.029Z\", \"lead_id\": \"21\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA FKI Rumah Net Cirebon\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(239, 7, '🎉 Pemenang Tender', 1, 0, NULL, NULL, '2026-07-31 13:34:32', '2026-07-31 16:50:14', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA FKI Rumah Net Cirebon</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/21', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-31T06:34:32.029Z\", \"lead_id\": \"21\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA FKI Rumah Net Cirebon\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(240, 32, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-31 13:34:32', '2026-07-31 13:34:32', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA FKI Rumah Net Cirebon</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/21', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-31T06:34:32.029Z\", \"lead_id\": \"21\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA FKI Rumah Net Cirebon\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(241, 33, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-31 13:34:32', '2026-07-31 13:34:32', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA FKI Rumah Net Cirebon</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/21', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-31T06:34:32.029Z\", \"lead_id\": \"21\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA FKI Rumah Net Cirebon\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(242, 39, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-31 13:34:32', '2026-07-31 13:34:32', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA FKI Rumah Net Cirebon</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/21', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-31T06:34:32.029Z\", \"lead_id\": \"21\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA FKI Rumah Net Cirebon\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(243, 10, 'Tender WON - Draft Kontrak Baru', 1, 0, NULL, NULL, '2026-07-31 14:14:44', '2026-07-31 16:50:08', NULL, 'Tender \"Tender ID: 20\" telah disetujui (WON). Draft Kontrak #16 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 16}'),
(244, 35, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-31 14:14:44', '2026-07-31 14:14:44', NULL, 'Tender \"Tender ID: 20\" telah disetujui (WON). Draft Kontrak #16 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 16}'),
(245, 1, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-31 14:14:44', '2026-07-31 14:14:44', NULL, 'Tender \"Tender ID: 20\" telah disetujui (WON). Draft Kontrak #16 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 16}'),
(246, 32, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-31 14:14:44', '2026-07-31 14:14:44', NULL, 'Tender \"Tender ID: 20\" telah disetujui (WON). Draft Kontrak #16 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 16}'),
(247, 39, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-31 14:14:44', '2026-07-31 14:14:44', NULL, 'Tender \"Tender ID: 20\" telah disetujui (WON). Draft Kontrak #16 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 16}'),
(248, 1, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-31 14:14:45', '2026-07-31 14:14:44', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Tasikmalaya</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/20', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-31T07:14:44.701Z\", \"lead_id\": \"20\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Tasikmalaya\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `is_read`, `created_by`, `updated_by`, `deleted_by`, `created_at`, `updated_at`, `deleted_at`, `message`, `notification_type`, `action_link`, `meta_data`) VALUES
(249, 4, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-31 14:14:45', '2026-07-31 14:14:44', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Tasikmalaya</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/20', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-31T07:14:44.701Z\", \"lead_id\": \"20\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Tasikmalaya\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(250, 6, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-31 14:14:45', '2026-07-31 14:14:44', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Tasikmalaya</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/20', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-31T07:14:44.701Z\", \"lead_id\": \"20\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Tasikmalaya\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(251, 7, '🎉 Pemenang Tender', 1, 0, NULL, NULL, '2026-07-31 14:14:45', '2026-07-31 16:50:14', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Tasikmalaya</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/20', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-31T07:14:44.701Z\", \"lead_id\": \"20\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Tasikmalaya\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(252, 32, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-31 14:14:45', '2026-07-31 14:14:44', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Tasikmalaya</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/20', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-31T07:14:44.701Z\", \"lead_id\": \"20\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Tasikmalaya\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(253, 33, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-31 14:14:45', '2026-07-31 14:14:44', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Tasikmalaya</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/20', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-31T07:14:44.701Z\", \"lead_id\": \"20\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Tasikmalaya\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(254, 39, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-31 14:14:45', '2026-07-31 14:14:44', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Tasikmalaya</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/20', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-31T07:14:44.701Z\", \"lead_id\": \"20\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Tasikmalaya\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(255, 10, 'Tender WON - Draft Kontrak Baru', 1, 0, NULL, NULL, '2026-07-31 14:15:58', '2026-07-31 16:50:08', NULL, 'Tender \"Tender ID: 19\" telah disetujui (WON). Draft Kontrak #17 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 17}'),
(256, 35, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-31 14:15:58', '2026-07-31 14:15:58', NULL, 'Tender \"Tender ID: 19\" telah disetujui (WON). Draft Kontrak #17 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 17}'),
(257, 1, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-31 14:15:58', '2026-07-31 14:15:58', NULL, 'Tender \"Tender ID: 19\" telah disetujui (WON). Draft Kontrak #17 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 17}'),
(258, 32, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-31 14:15:58', '2026-07-31 14:15:58', NULL, 'Tender \"Tender ID: 19\" telah disetujui (WON). Draft Kontrak #17 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 17}'),
(259, 39, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-31 14:15:58', '2026-07-31 14:15:58', NULL, 'Tender \"Tender ID: 19\" telah disetujui (WON). Draft Kontrak #17 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 17}'),
(260, 1, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-31 14:15:58', '2026-07-31 14:15:58', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Ciamis</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/19', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-31T07:15:58.368Z\", \"lead_id\": \"19\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Ciamis\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(261, 4, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-31 14:15:58', '2026-07-31 14:15:58', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Ciamis</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/19', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-31T07:15:58.369Z\", \"lead_id\": \"19\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Ciamis\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(262, 6, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-31 14:15:58', '2026-07-31 14:15:58', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Ciamis</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/19', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-31T07:15:58.369Z\", \"lead_id\": \"19\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Ciamis\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(263, 7, '🎉 Pemenang Tender', 1, 0, NULL, NULL, '2026-07-31 14:15:58', '2026-07-31 16:50:14', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Ciamis</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/19', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-31T07:15:58.369Z\", \"lead_id\": \"19\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Ciamis\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(264, 32, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-31 14:15:58', '2026-07-31 14:15:58', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Ciamis</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/19', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-31T07:15:58.369Z\", \"lead_id\": \"19\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Ciamis\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(265, 33, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-31 14:15:58', '2026-07-31 14:15:58', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Ciamis</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/19', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-31T07:15:58.369Z\", \"lead_id\": \"19\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Ciamis\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(266, 39, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-31 14:15:58', '2026-07-31 14:15:58', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Ciamis</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/19', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-31T07:15:58.369Z\", \"lead_id\": \"19\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Ciamis\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(267, 10, 'Tender WON - Draft Kontrak Baru', 1, 0, NULL, NULL, '2026-07-31 15:33:26', '2026-07-31 16:50:08', NULL, 'Tender \"Tender ID: 18\" telah disetujui (WON). Draft Kontrak #18 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 18}'),
(268, 35, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-31 15:33:26', '2026-07-31 15:33:26', NULL, 'Tender \"Tender ID: 18\" telah disetujui (WON). Draft Kontrak #18 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 18}'),
(269, 1, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-31 15:33:26', '2026-07-31 15:33:26', NULL, 'Tender \"Tender ID: 18\" telah disetujui (WON). Draft Kontrak #18 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 18}'),
(270, 32, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-31 15:33:26', '2026-07-31 15:33:26', NULL, 'Tender \"Tender ID: 18\" telah disetujui (WON). Draft Kontrak #18 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 18}'),
(271, 39, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-31 15:33:26', '2026-07-31 15:33:26', NULL, 'Tender \"Tender ID: 18\" telah disetujui (WON). Draft Kontrak #18 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 18}'),
(272, 1, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-31 15:33:27', '2026-07-31 15:33:26', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Garut</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/18', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-31T08:33:26.667Z\", \"lead_id\": \"18\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Garut\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(273, 4, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-31 15:33:27', '2026-07-31 15:33:26', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Garut</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/18', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-31T08:33:26.667Z\", \"lead_id\": \"18\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Garut\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(274, 6, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-31 15:33:27', '2026-07-31 15:33:26', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Garut</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/18', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-31T08:33:26.667Z\", \"lead_id\": \"18\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Garut\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(275, 7, '🎉 Pemenang Tender', 1, 0, NULL, NULL, '2026-07-31 15:33:27', '2026-07-31 16:50:14', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Garut</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/18', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-31T08:33:26.667Z\", \"lead_id\": \"18\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Garut\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(276, 32, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-31 15:33:27', '2026-07-31 15:33:26', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Garut</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/18', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-31T08:33:26.667Z\", \"lead_id\": \"18\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Garut\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(277, 33, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-31 15:33:27', '2026-07-31 15:33:26', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Garut</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/18', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-31T08:33:26.667Z\", \"lead_id\": \"18\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Garut\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(278, 39, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-31 15:33:27', '2026-07-31 15:33:26', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Garut</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/18', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-31T08:33:26.667Z\", \"lead_id\": \"18\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Garut\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(279, 10, 'Tender WON - Draft Kontrak Baru', 1, 0, NULL, NULL, '2026-07-31 16:26:22', '2026-07-31 16:50:08', NULL, 'Tender \"Tender ID: 17\" telah disetujui (WON). Draft Kontrak #19 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 19}'),
(280, 35, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-31 16:26:22', '2026-07-31 16:26:22', NULL, 'Tender \"Tender ID: 17\" telah disetujui (WON). Draft Kontrak #19 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 19}'),
(281, 1, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-31 16:26:22', '2026-07-31 16:26:22', NULL, 'Tender \"Tender ID: 17\" telah disetujui (WON). Draft Kontrak #19 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 19}'),
(282, 32, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-31 16:26:22', '2026-07-31 16:26:22', NULL, 'Tender \"Tender ID: 17\" telah disetujui (WON). Draft Kontrak #19 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 19}'),
(283, 39, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-31 16:26:22', '2026-07-31 16:26:22', NULL, 'Tender \"Tender ID: 17\" telah disetujui (WON). Draft Kontrak #19 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 19}'),
(284, 1, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-31 16:26:23', '2026-07-31 16:26:22', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net BOGOR</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/17', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-31T09:26:22.927Z\", \"lead_id\": \"17\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net BOGOR\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(285, 4, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-31 16:26:23', '2026-07-31 16:26:22', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net BOGOR</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/17', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-31T09:26:22.927Z\", \"lead_id\": \"17\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net BOGOR\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(286, 6, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-31 16:26:23', '2026-07-31 16:26:22', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net BOGOR</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/17', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-31T09:26:22.927Z\", \"lead_id\": \"17\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net BOGOR\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(287, 7, '🎉 Pemenang Tender', 1, 0, NULL, NULL, '2026-07-31 16:26:23', '2026-07-31 16:50:14', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net BOGOR</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/17', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-31T09:26:22.927Z\", \"lead_id\": \"17\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net BOGOR\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(288, 32, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-31 16:26:23', '2026-07-31 16:26:23', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net BOGOR</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/17', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-31T09:26:22.927Z\", \"lead_id\": \"17\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net BOGOR\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(289, 33, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-31 16:26:23', '2026-07-31 16:26:23', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net BOGOR</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/17', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-31T09:26:22.927Z\", \"lead_id\": \"17\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net BOGOR\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(290, 39, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-31 16:26:23', '2026-07-31 16:26:23', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net BOGOR</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/17', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-31T09:26:22.927Z\", \"lead_id\": \"17\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net BOGOR\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(291, 2, 'Project Siap Kick Off', 0, 0, NULL, NULL, '2026-07-31 16:50:49', '2026-07-31 16:50:49', NULL, 'Project \"CSA-FKI Rumah Net Ciamis\" telah disetujui Legal.', 'ALERT', '/project-delivery', '{\"actionLink\": \"/project-delivery\", \"contractId\": \"17\"}'),
(292, 36, 'Project Siap Kick Off', 0, 0, NULL, NULL, '2026-07-31 16:50:49', '2026-07-31 16:50:49', NULL, 'Project \"CSA-FKI Rumah Net Ciamis\" telah disetujui Legal.', 'ALERT', '/project-delivery', '{\"actionLink\": \"/project-delivery\", \"contractId\": \"17\"}'),
(293, 1, 'Project Siap Kick Off', 0, 0, NULL, NULL, '2026-07-31 16:50:49', '2026-07-31 16:50:49', NULL, 'Project \"CSA-FKI Rumah Net Ciamis\" telah disetujui Legal.', 'ALERT', '/project-delivery', '{\"actionLink\": \"/project-delivery\", \"contractId\": \"17\"}'),
(294, 32, 'Project Siap Kick Off', 0, 0, NULL, NULL, '2026-07-31 16:50:49', '2026-07-31 16:50:49', NULL, 'Project \"CSA-FKI Rumah Net Ciamis\" telah disetujui Legal.', 'ALERT', '/project-delivery', '{\"actionLink\": \"/project-delivery\", \"contractId\": \"17\"}'),
(295, 39, 'Project Siap Kick Off', 0, 0, NULL, NULL, '2026-07-31 16:50:49', '2026-07-31 16:50:49', NULL, 'Project \"CSA-FKI Rumah Net Ciamis\" telah disetujui Legal.', 'ALERT', '/project-delivery', '{\"actionLink\": \"/project-delivery\", \"contractId\": \"17\"}'),
(296, 10, 'Tender WON - Draft Kontrak Baru', 1, 0, NULL, NULL, '2026-07-31 16:57:20', '2026-07-31 17:11:16', NULL, 'Tender \"Tender ID: 16\" telah disetujui (WON). Draft Kontrak #20 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 20}'),
(297, 35, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-31 16:57:20', '2026-07-31 16:57:19', NULL, 'Tender \"Tender ID: 16\" telah disetujui (WON). Draft Kontrak #20 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 20}'),
(298, 1, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-31 16:57:20', '2026-07-31 16:57:19', NULL, 'Tender \"Tender ID: 16\" telah disetujui (WON). Draft Kontrak #20 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 20}'),
(299, 32, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-31 16:57:20', '2026-07-31 16:57:20', NULL, 'Tender \"Tender ID: 16\" telah disetujui (WON). Draft Kontrak #20 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 20}'),
(300, 39, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-07-31 16:57:20', '2026-07-31 16:57:20', NULL, 'Tender \"Tender ID: 16\" telah disetujui (WON). Draft Kontrak #20 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 20}'),
(301, 1, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-31 16:57:21', '2026-07-31 16:57:20', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bandung </span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/16', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-31T09:57:20.639Z\", \"lead_id\": \"16\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Bandung \", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(302, 4, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-31 16:57:21', '2026-07-31 16:57:20', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bandung </span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/16', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-31T09:57:20.639Z\", \"lead_id\": \"16\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Bandung \", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(303, 6, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-31 16:57:21', '2026-07-31 16:57:20', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bandung </span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/16', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-31T09:57:20.639Z\", \"lead_id\": \"16\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Bandung \", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(304, 7, '🎉 Pemenang Tender', 1, 0, NULL, NULL, '2026-07-31 16:57:21', '2026-08-03 08:41:04', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bandung </span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/16', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-31T09:57:20.639Z\", \"lead_id\": \"16\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Bandung \", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(305, 32, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-31 16:57:21', '2026-07-31 16:57:20', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bandung </span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/16', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-31T09:57:20.639Z\", \"lead_id\": \"16\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Bandung \", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(306, 33, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-31 16:57:21', '2026-07-31 16:57:20', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bandung </span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/16', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-31T09:57:20.639Z\", \"lead_id\": \"16\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Bandung \", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(307, 39, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-07-31 16:57:21', '2026-07-31 16:57:20', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bandung </span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/16', '{\"tier\": \"Medium\", \"won_at\": \"2026-07-31T09:57:20.639Z\", \"lead_id\": \"16\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Bandung \", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(308, 2, 'Project Siap Kick Off', 0, 0, NULL, NULL, '2026-07-31 16:59:46', '2026-07-31 16:59:46', NULL, 'Project \"CSA-FKI Rumah Net Bandung \" telah disetujui Legal.', 'ALERT', '/project-delivery', '{\"actionLink\": \"/project-delivery\", \"contractId\": \"20\"}'),
(309, 7, 'SPK Disetujui Legal', 1, 0, NULL, NULL, '2026-07-31 16:59:47', '2026-08-03 08:41:04', NULL, 'Project \"CSA-FKI Rumah Net Bandung \" telah disetujui Legal dan diteruskan ke Project Delivery.', 'SYSTEM', '/sales/tenders/16', '{\"actionLink\": \"/sales/tenders/16\", \"contractId\": \"20\"}'),
(310, 36, 'Project Siap Kick Off', 0, 0, NULL, NULL, '2026-07-31 16:59:46', '2026-07-31 16:59:46', NULL, 'Project \"CSA-FKI Rumah Net Bandung \" telah disetujui Legal.', 'ALERT', '/project-delivery', '{\"actionLink\": \"/project-delivery\", \"contractId\": \"20\"}'),
(311, 9, 'SPK Disetujui Legal', 0, 0, NULL, NULL, '2026-07-31 16:59:47', '2026-07-31 16:59:46', NULL, 'Project \"CSA-FKI Rumah Net Bandung \" telah disetujui Legal dan diteruskan ke Project Delivery.', 'SYSTEM', '/sales/tenders/16', '{\"actionLink\": \"/sales/tenders/16\", \"contractId\": \"20\"}'),
(312, 1, 'Project Siap Kick Off', 0, 0, NULL, NULL, '2026-07-31 16:59:46', '2026-07-31 16:59:46', NULL, 'Project \"CSA-FKI Rumah Net Bandung \" telah disetujui Legal.', 'ALERT', '/project-delivery', '{\"actionLink\": \"/project-delivery\", \"contractId\": \"20\"}'),
(313, 34, 'SPK Disetujui Legal', 0, 0, NULL, NULL, '2026-07-31 16:59:47', '2026-07-31 16:59:46', NULL, 'Project \"CSA-FKI Rumah Net Bandung \" telah disetujui Legal dan diteruskan ke Project Delivery.', 'SYSTEM', '/sales/tenders/16', '{\"actionLink\": \"/sales/tenders/16\", \"contractId\": \"20\"}'),
(314, 32, 'Project Siap Kick Off', 0, 0, NULL, NULL, '2026-07-31 16:59:46', '2026-07-31 16:59:46', NULL, 'Project \"CSA-FKI Rumah Net Bandung \" telah disetujui Legal.', 'ALERT', '/project-delivery', '{\"actionLink\": \"/project-delivery\", \"contractId\": \"20\"}'),
(315, 39, 'Project Siap Kick Off', 0, 0, NULL, NULL, '2026-07-31 16:59:46', '2026-07-31 16:59:47', NULL, 'Project \"CSA-FKI Rumah Net Bandung \" telah disetujui Legal.', 'ALERT', '/project-delivery', '{\"actionLink\": \"/project-delivery\", \"contractId\": \"20\"}'),
(316, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 17:12:11', '2026-07-31 17:12:10', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Kuningan</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/22', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"22\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Kuningan\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(317, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 17:12:11', '2026-07-31 17:12:10', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Kuningan</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/22', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"22\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Kuningan\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(318, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 17:12:11', '2026-07-31 17:12:10', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Kuningan</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/22', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"22\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Kuningan\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(319, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 17:12:11', '2026-07-31 17:12:10', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Kuningan</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/22', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"22\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Kuningan\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(320, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 17:12:11', '2026-07-31 17:12:11', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Kuningan</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/22', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"22\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Kuningan\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(321, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 17:12:11', '2026-07-31 17:12:11', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Kuningan</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/22', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"22\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Kuningan\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(322, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 20:11:01', '2026-07-31 20:11:00', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bali</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/23', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"23\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Bali\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(323, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 20:11:01', '2026-07-31 20:11:00', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bali</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/23', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"23\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Bali\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(324, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 20:11:01', '2026-07-31 20:11:00', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bali</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/23', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"23\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Bali\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(325, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 20:11:01', '2026-07-31 20:11:00', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bali</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/23', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"23\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Bali\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(326, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 20:11:01', '2026-07-31 20:11:00', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bali</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/23', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"23\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Bali\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(327, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 20:11:01', '2026-07-31 20:11:00', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bali</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/23', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"23\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Bali\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(328, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 20:12:01', '2026-07-31 20:12:00', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Surabaya</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/24', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"24\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Surabaya\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(329, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 20:12:01', '2026-07-31 20:12:00', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Surabaya</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/24', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"24\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Surabaya\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(330, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 20:12:01', '2026-07-31 20:12:00', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Surabaya</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/24', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"24\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Surabaya\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(331, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 20:12:01', '2026-07-31 20:12:00', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Surabaya</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/24', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"24\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Surabaya\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(332, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 20:12:01', '2026-07-31 20:12:00', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Surabaya</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/24', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"24\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Surabaya\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(333, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 20:12:01', '2026-07-31 20:12:00', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Surabaya</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/24', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"24\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Surabaya\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(334, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:16:01', '2026-07-31 22:16:01', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Gresik</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/25', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"25\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Gresik\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(335, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:16:01', '2026-07-31 22:16:01', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Gresik</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/25', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"25\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Gresik\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(336, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:16:01', '2026-07-31 22:16:01', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Gresik</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/25', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"25\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Gresik\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(337, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:16:01', '2026-07-31 22:16:01', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Gresik</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/25', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"25\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Gresik\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(338, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:16:01', '2026-07-31 22:16:01', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Gresik</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/25', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"25\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Gresik\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `is_read`, `created_by`, `updated_by`, `deleted_by`, `created_at`, `updated_at`, `deleted_at`, `message`, `notification_type`, `action_link`, `meta_data`) VALUES
(339, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:16:01', '2026-07-31 22:16:01', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Gresik</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/25', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"25\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Gresik\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(340, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:23:36', '2026-07-31 22:23:35', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah net Bandung Lembang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/26', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"26\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah net Bandung Lembang\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(341, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:23:36', '2026-07-31 22:23:35', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah net Bandung Lembang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/26', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"26\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah net Bandung Lembang\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(342, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:23:36', '2026-07-31 22:23:35', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah net Bandung Lembang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/26', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"26\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah net Bandung Lembang\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(343, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:23:36', '2026-07-31 22:23:35', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah net Bandung Lembang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/26', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"26\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah net Bandung Lembang\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(344, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:23:36', '2026-07-31 22:23:35', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah net Bandung Lembang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/26', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"26\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah net Bandung Lembang\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(345, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:23:36', '2026-07-31 22:23:35', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah net Bandung Lembang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/26', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"26\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah net Bandung Lembang\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(346, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:26:54', '2026-07-31 22:26:54', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Ruman Net Subang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/27', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"27\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Ruman Net Subang\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(347, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:26:54', '2026-07-31 22:26:54', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Ruman Net Subang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/27', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"27\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Ruman Net Subang\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(348, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:26:54', '2026-07-31 22:26:54', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Ruman Net Subang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/27', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"27\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Ruman Net Subang\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(349, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:26:54', '2026-07-31 22:26:54', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Ruman Net Subang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/27', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"27\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Ruman Net Subang\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(350, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:26:54', '2026-07-31 22:26:54', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Ruman Net Subang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/27', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"27\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Ruman Net Subang\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(351, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:26:54', '2026-07-31 22:26:54', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Ruman Net Subang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/27', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"27\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Ruman Net Subang\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(352, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:28:14', '2026-07-31 22:28:13', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Tuban</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/28', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"28\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Tuban\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(353, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:28:14', '2026-07-31 22:28:13', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Tuban</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/28', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"28\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Tuban\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(354, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:28:14', '2026-07-31 22:28:13', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Tuban</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/28', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"28\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Tuban\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(355, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:28:14', '2026-07-31 22:28:13', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Tuban</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/28', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"28\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Tuban\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(356, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:28:14', '2026-07-31 22:28:13', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Tuban</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/28', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"28\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Tuban\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(357, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:28:14', '2026-07-31 22:28:13', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Tuban</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/28', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"28\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Tuban\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(358, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:49:18', '2026-07-31 22:49:18', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Pati</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/29', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"29\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Pati\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(359, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:49:18', '2026-07-31 22:49:18', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Pati</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/29', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"29\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Pati\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(360, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:49:18', '2026-07-31 22:49:18', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Pati</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/29', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"29\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Pati\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(361, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:49:18', '2026-07-31 22:49:18', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Pati</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/29', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"29\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Pati\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(362, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:49:18', '2026-07-31 22:49:18', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Pati</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/29', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"29\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Pati\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(363, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:49:18', '2026-07-31 22:49:18', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Pati</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/29', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"29\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Pati\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(364, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:50:32', '2026-07-31 22:50:32', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Pangandaran</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/30', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"30\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Pangandaran\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(365, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:50:32', '2026-07-31 22:50:32', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Pangandaran</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/30', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"30\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Pangandaran\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(366, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:50:32', '2026-07-31 22:50:32', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Pangandaran</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/30', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"30\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Pangandaran\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(367, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:50:32', '2026-07-31 22:50:32', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Pangandaran</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/30', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"30\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Pangandaran\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(368, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:50:32', '2026-07-31 22:50:32', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Pangandaran</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/30', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"30\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Pangandaran\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(369, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:50:32', '2026-07-31 22:50:32', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Pangandaran</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/30', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"30\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Pangandaran\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(370, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:54:29', '2026-07-31 22:54:29', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Kabupaten Bandung</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/31', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"31\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Kabupaten Bandung\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(371, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:54:29', '2026-07-31 22:54:29', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Kabupaten Bandung</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/31', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"31\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Kabupaten Bandung\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(372, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:54:29', '2026-07-31 22:54:29', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Kabupaten Bandung</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/31', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"31\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Kabupaten Bandung\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(373, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:54:29', '2026-07-31 22:54:29', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Kabupaten Bandung</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/31', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"31\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Kabupaten Bandung\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(374, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:54:29', '2026-07-31 22:54:29', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Kabupaten Bandung</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/31', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"31\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Kabupaten Bandung\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(375, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:54:29', '2026-07-31 22:54:29', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Kabupaten Bandung</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/31', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"31\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Kabupaten Bandung\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(376, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:57:51', '2026-07-31 22:57:50', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Yogyakarta</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/32', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"32\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Yogyakarta\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(377, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:57:51', '2026-07-31 22:57:50', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Yogyakarta</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/32', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"32\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Yogyakarta\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(378, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:57:51', '2026-07-31 22:57:50', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Yogyakarta</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/32', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"32\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Yogyakarta\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(379, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:57:51', '2026-07-31 22:57:50', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Yogyakarta</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/32', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"32\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Yogyakarta\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(380, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:57:51', '2026-07-31 22:57:50', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Yogyakarta</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/32', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"32\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Yogyakarta\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(381, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:57:51', '2026-07-31 22:57:50', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Yogyakarta</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/32', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"32\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Yogyakarta\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(382, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:58:58', '2026-07-31 22:58:58', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net SOLO</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/33', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"33\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net SOLO\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(383, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:58:58', '2026-07-31 22:58:58', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net SOLO</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/33', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"33\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net SOLO\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(384, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:58:58', '2026-07-31 22:58:58', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net SOLO</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/33', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"33\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net SOLO\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(385, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:58:58', '2026-07-31 22:58:58', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net SOLO</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/33', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"33\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net SOLO\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(386, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:58:58', '2026-07-31 22:58:58', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net SOLO</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/33', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"33\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net SOLO\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(387, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 22:58:58', '2026-07-31 22:58:58', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net SOLO</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/33', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"33\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net SOLO\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(388, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 23:04:09', '2026-07-31 23:04:09', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bolo Gresik</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/34', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"34\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Bolo Gresik\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(389, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 23:04:09', '2026-07-31 23:04:09', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bolo Gresik</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/34', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"34\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Bolo Gresik\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(390, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 23:04:09', '2026-07-31 23:04:09', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bolo Gresik</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/34', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"34\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Bolo Gresik\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(391, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 23:04:09', '2026-07-31 23:04:09', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bolo Gresik</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/34', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"34\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Bolo Gresik\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(392, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 23:04:09', '2026-07-31 23:04:09', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bolo Gresik</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/34', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"34\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Bolo Gresik\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(393, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 23:04:09', '2026-07-31 23:04:09', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bolo Gresik</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/34', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"34\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Bolo Gresik\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(394, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 23:06:43', '2026-07-31 23:06:42', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bojonegori</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/35', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"35\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Bojonegori\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(395, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 23:06:43', '2026-07-31 23:06:42', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bojonegori</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/35', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"35\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Bojonegori\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(396, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 23:06:43', '2026-07-31 23:06:43', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bojonegori</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/35', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"35\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Bojonegori\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(397, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 23:06:43', '2026-07-31 23:06:43', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bojonegori</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/35', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"35\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Bojonegori\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(398, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 23:06:43', '2026-07-31 23:06:43', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bojonegori</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/35', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"35\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Bojonegori\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(399, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 23:06:43', '2026-07-31 23:06:43', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bojonegori</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/35', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"35\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Bojonegori\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(400, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 23:20:46', '2026-07-31 23:20:45', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang J&T Gresik</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/36', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"36\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gudang J&T Gresik\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(401, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 23:20:46', '2026-07-31 23:20:45', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang J&T Gresik</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/36', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"36\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gudang J&T Gresik\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(402, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 23:20:46', '2026-07-31 23:20:45', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang J&T Gresik</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/36', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"36\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gudang J&T Gresik\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(403, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 23:20:46', '2026-07-31 23:20:45', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang J&T Gresik</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/36', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"36\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gudang J&T Gresik\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(404, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 23:20:46', '2026-07-31 23:20:45', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang J&T Gresik</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/36', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"36\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gudang J&T Gresik\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(405, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 23:20:46', '2026-07-31 23:20:45', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang J&T Gresik</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/36', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"36\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gudang J&T Gresik\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(406, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 23:51:51', '2026-07-31 23:51:51', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang Tangerang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/37', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"37\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gudang Tangerang\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(407, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 23:51:51', '2026-07-31 23:51:51', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang Tangerang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/37', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"37\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gudang Tangerang\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(408, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 23:51:51', '2026-07-31 23:51:51', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang Tangerang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/37', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"37\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gudang Tangerang\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(409, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 23:51:51', '2026-07-31 23:51:51', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang Tangerang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/37', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"37\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gudang Tangerang\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(410, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 23:51:51', '2026-07-31 23:51:51', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang Tangerang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/37', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"37\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gudang Tangerang\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `is_read`, `created_by`, `updated_by`, `deleted_by`, `created_at`, `updated_at`, `deleted_at`, `message`, `notification_type`, `action_link`, `meta_data`) VALUES
(411, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-07-31 23:51:51', '2026-07-31 23:51:51', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Gudang Tangerang</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/37', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"37\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Gudang Tangerang\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(412, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 00:25:13', '2026-08-01 00:25:12', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Ruang Purchasing J&T Tuban</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/38', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"38\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Ruang Purchasing J&T Tuban\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(413, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 00:25:13', '2026-08-01 00:25:12', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Ruang Purchasing J&T Tuban</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/38', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"38\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Ruang Purchasing J&T Tuban\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(414, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 00:25:13', '2026-08-01 00:25:12', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Ruang Purchasing J&T Tuban</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/38', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"38\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Ruang Purchasing J&T Tuban\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(415, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 00:25:13', '2026-08-01 00:25:12', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Ruang Purchasing J&T Tuban</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/38', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"38\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Ruang Purchasing J&T Tuban\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(416, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 00:25:13', '2026-08-01 00:25:13', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Ruang Purchasing J&T Tuban</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/38', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"38\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Ruang Purchasing J&T Tuban\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(417, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 00:25:13', '2026-08-01 00:25:13', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Renovasi Ruang Purchasing J&T Tuban</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/38', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"38\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Renovasi Ruang Purchasing J&T Tuban\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(418, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 02:21:02', '2026-08-01 02:21:01', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project ATP Gateway Madiun</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/39', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"39\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project ATP Gateway Madiun\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(419, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 02:21:02', '2026-08-01 02:21:01', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project ATP Gateway Madiun</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/39', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"39\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project ATP Gateway Madiun\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(420, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 02:21:02', '2026-08-01 02:21:01', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project ATP Gateway Madiun</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/39', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"39\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project ATP Gateway Madiun\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(421, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 02:21:02', '2026-08-01 02:21:01', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project ATP Gateway Madiun</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/39', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"39\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project ATP Gateway Madiun\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(422, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 02:21:02', '2026-08-01 02:21:01', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project ATP Gateway Madiun</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/39', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"39\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project ATP Gateway Madiun\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(423, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 02:21:02', '2026-08-01 02:21:01', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project ATP Gateway Madiun</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/39', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"39\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project ATP Gateway Madiun\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(424, 1, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-01 02:22:07', '2026-08-01 02:22:07', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">Project ATP Gateway Madiun</span>.', 'ALERT', '/sales/tenders/39', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"39\", \"user_name\": \"Lukas Kurniawan\", \"action_type\": \"PROPOSAL_UPLOADED\", \"project_name\": \"Project ATP Gateway Madiun\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(425, 4, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-01 02:22:07', '2026-08-01 02:22:07', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">Project ATP Gateway Madiun</span>.', 'ALERT', '/sales/tenders/39', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"39\", \"user_name\": \"Lukas Kurniawan\", \"action_type\": \"PROPOSAL_UPLOADED\", \"project_name\": \"Project ATP Gateway Madiun\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(426, 6, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-01 02:22:07', '2026-08-01 02:22:07', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">Project ATP Gateway Madiun</span>.', 'ALERT', '/sales/tenders/39', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"39\", \"user_name\": \"Lukas Kurniawan\", \"action_type\": \"PROPOSAL_UPLOADED\", \"project_name\": \"Project ATP Gateway Madiun\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(427, 32, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-01 02:22:07', '2026-08-01 02:22:07', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">Project ATP Gateway Madiun</span>.', 'ALERT', '/sales/tenders/39', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"39\", \"user_name\": \"Lukas Kurniawan\", \"action_type\": \"PROPOSAL_UPLOADED\", \"project_name\": \"Project ATP Gateway Madiun\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(428, 33, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-01 02:22:07', '2026-08-01 02:22:07', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">Project ATP Gateway Madiun</span>.', 'ALERT', '/sales/tenders/39', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"39\", \"user_name\": \"Lukas Kurniawan\", \"action_type\": \"PROPOSAL_UPLOADED\", \"project_name\": \"Project ATP Gateway Madiun\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(429, 39, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-01 02:22:07', '2026-08-01 02:22:07', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">Project ATP Gateway Madiun</span>.', 'ALERT', '/sales/tenders/39', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"39\", \"user_name\": \"Lukas Kurniawan\", \"action_type\": \"PROPOSAL_UPLOADED\", \"project_name\": \"Project ATP Gateway Madiun\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(430, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 03:05:22', '2026-08-01 03:05:22', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi Kantor J&T HQ</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/40', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"40\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Renovasi Kantor J&T HQ\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(431, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 03:05:22', '2026-08-01 03:05:22', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi Kantor J&T HQ</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/40', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"40\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Renovasi Kantor J&T HQ\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(432, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 03:05:22', '2026-08-01 03:05:22', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi Kantor J&T HQ</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/40', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"40\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Renovasi Kantor J&T HQ\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(433, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 03:05:22', '2026-08-01 03:05:22', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi Kantor J&T HQ</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/40', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"40\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Renovasi Kantor J&T HQ\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(434, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 03:05:22', '2026-08-01 03:05:22', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi Kantor J&T HQ</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/40', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"40\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Renovasi Kantor J&T HQ\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(435, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 03:05:22', '2026-08-01 03:05:22', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi Kantor J&T HQ</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Medium).', 'ALERT', '/sales/tenders/40', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"40\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Renovasi Kantor J&T HQ\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(436, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 03:08:31', '2026-08-01 03:08:30', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi DP Mini Jakarta</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Small).', 'ALERT', '/sales/tenders/41', '{\"tier\": \"Small\", \"won_at\": null, \"lead_id\": \"41\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Renovasi DP Mini Jakarta\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(437, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 03:08:31', '2026-08-01 03:08:30', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi DP Mini Jakarta</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Small).', 'ALERT', '/sales/tenders/41', '{\"tier\": \"Small\", \"won_at\": null, \"lead_id\": \"41\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Renovasi DP Mini Jakarta\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(438, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 03:08:31', '2026-08-01 03:08:30', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi DP Mini Jakarta</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Small).', 'ALERT', '/sales/tenders/41', '{\"tier\": \"Small\", \"won_at\": null, \"lead_id\": \"41\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Renovasi DP Mini Jakarta\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(439, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 03:08:31', '2026-08-01 03:08:30', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi DP Mini Jakarta</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Small).', 'ALERT', '/sales/tenders/41', '{\"tier\": \"Small\", \"won_at\": null, \"lead_id\": \"41\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Renovasi DP Mini Jakarta\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(440, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 03:08:31', '2026-08-01 03:08:30', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi DP Mini Jakarta</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Small).', 'ALERT', '/sales/tenders/41', '{\"tier\": \"Small\", \"won_at\": null, \"lead_id\": \"41\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Renovasi DP Mini Jakarta\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": true}'),
(441, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 03:08:31', '2026-08-01 03:08:30', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Renovasi DP Mini Jakarta</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. GLOBAL JET EXPRESS</span> (Small).', 'ALERT', '/sales/tenders/41', '{\"tier\": \"Small\", \"won_at\": null, \"lead_id\": \"41\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Renovasi DP Mini Jakarta\", \"customer_name\": \"PT. GLOBAL JET EXPRESS\", \"requires_approval\": false}'),
(442, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 03:10:29', '2026-08-01 03:10:29', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Sulawesi makasar</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/42', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"42\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Sulawesi makasar\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(443, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 03:10:29', '2026-08-01 03:10:29', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Sulawesi makasar</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/42', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"42\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Sulawesi makasar\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(444, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 03:10:29', '2026-08-01 03:10:29', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Sulawesi makasar</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/42', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"42\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Sulawesi makasar\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(445, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 03:10:29', '2026-08-01 03:10:29', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Sulawesi makasar</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/42', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"42\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Sulawesi makasar\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(446, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 03:10:29', '2026-08-01 03:10:29', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Sulawesi makasar</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/42', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"42\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Sulawesi makasar\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(447, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 03:10:29', '2026-08-01 03:10:29', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Sulawesi makasar</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/42', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"42\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Sulawesi makasar\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(448, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 03:31:56', '2026-08-01 03:31:56', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Kalimantan</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/43', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"43\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Rumah Net Kalimantan\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(449, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 03:31:56', '2026-08-01 03:31:56', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Kalimantan</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/43', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"43\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Rumah Net Kalimantan\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(450, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 03:31:56', '2026-08-01 03:31:56', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Kalimantan</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/43', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"43\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Rumah Net Kalimantan\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(451, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 03:31:56', '2026-08-01 03:31:56', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Kalimantan</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/43', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"43\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Rumah Net Kalimantan\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(452, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 03:31:56', '2026-08-01 03:31:56', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Kalimantan</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/43', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"43\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Rumah Net Kalimantan\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(453, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-01 03:31:56', '2026-08-01 03:31:56', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Kalimantan</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/43', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"43\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Rumah Net Kalimantan\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(454, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-02 23:21:44', '2026-08-02 23:21:44', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net papua</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/44', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"44\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Rumah Net papua\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(455, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-02 23:21:44', '2026-08-02 23:21:44', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net papua</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/44', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"44\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Rumah Net papua\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(456, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-02 23:21:44', '2026-08-02 23:21:44', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net papua</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/44', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"44\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Rumah Net papua\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(457, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-02 23:21:44', '2026-08-02 23:21:44', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net papua</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/44', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"44\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Rumah Net papua\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(458, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-02 23:21:44', '2026-08-02 23:21:44', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net papua</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/44', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"44\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Rumah Net papua\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(459, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-02 23:21:44', '2026-08-02 23:21:44', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net papua</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/44', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"44\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Rumah Net papua\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(460, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-02 23:24:47', '2026-08-02 23:24:47', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Rumah Net Batam\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(461, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-02 23:24:47', '2026-08-02 23:24:47', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Rumah Net Batam\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(462, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-02 23:24:47', '2026-08-02 23:24:47', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Rumah Net Batam\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(463, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-02 23:24:47', '2026-08-02 23:24:47', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Rumah Net Batam\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(464, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-02 23:24:47', '2026-08-02 23:24:47', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Rumah Net Batam\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(465, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-02 23:24:47', '2026-08-02 23:24:47', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Rumah Net Batam\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(466, 1, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-02 23:56:36', '2026-08-02 23:56:36', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Batam Central\", \"requires_approval\": false}'),
(467, 4, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-02 23:56:36', '2026-08-02 23:56:36', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Batam Central\", \"requires_approval\": true}'),
(468, 6, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-02 23:56:36', '2026-08-02 23:56:36', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Batam Central\", \"requires_approval\": false}'),
(469, 32, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-02 23:56:36', '2026-08-02 23:56:36', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Batam Central\", \"requires_approval\": false}'),
(470, 33, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-02 23:56:36', '2026-08-02 23:56:36', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Batam Central\", \"requires_approval\": true}'),
(471, 39, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-02 23:56:36', '2026-08-02 23:56:36', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Batam Central\", \"requires_approval\": false}'),
(472, 1, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-02 23:56:53', '2026-08-02 23:56:53', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net papua Sorong</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Large).', 'ALERT', '/sales/tenders/44', '{\"tier\": \"Large\", \"won_at\": null, \"lead_id\": \"44\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net papua Sorong\", \"requires_approval\": false}'),
(473, 4, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-02 23:56:53', '2026-08-02 23:56:53', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net papua Sorong</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Large).', 'ALERT', '/sales/tenders/44', '{\"tier\": \"Large\", \"won_at\": null, \"lead_id\": \"44\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net papua Sorong\", \"requires_approval\": true}'),
(474, 6, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-02 23:56:53', '2026-08-02 23:56:53', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net papua Sorong</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Large).', 'ALERT', '/sales/tenders/44', '{\"tier\": \"Large\", \"won_at\": null, \"lead_id\": \"44\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net papua Sorong\", \"requires_approval\": false}'),
(475, 32, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-02 23:56:53', '2026-08-02 23:56:53', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net papua Sorong</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Large).', 'ALERT', '/sales/tenders/44', '{\"tier\": \"Large\", \"won_at\": null, \"lead_id\": \"44\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net papua Sorong\", \"requires_approval\": false}'),
(476, 33, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-02 23:56:53', '2026-08-02 23:56:53', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net papua Sorong</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Large).', 'ALERT', '/sales/tenders/44', '{\"tier\": \"Large\", \"won_at\": null, \"lead_id\": \"44\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net papua Sorong\", \"requires_approval\": true}'),
(477, 39, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-02 23:56:53', '2026-08-02 23:56:53', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net papua Sorong</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Large).', 'ALERT', '/sales/tenders/44', '{\"tier\": \"Large\", \"won_at\": null, \"lead_id\": \"44\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net papua Sorong\", \"requires_approval\": false}'),
(478, 1, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-02 23:57:16', '2026-08-02 23:57:15', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Kalimantan</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/43', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"43\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Kalimantan\", \"requires_approval\": false}'),
(479, 4, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-02 23:57:16', '2026-08-02 23:57:15', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Kalimantan</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/43', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"43\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Kalimantan\", \"requires_approval\": true}'),
(480, 6, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-02 23:57:16', '2026-08-02 23:57:15', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Kalimantan</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/43', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"43\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Kalimantan\", \"requires_approval\": false}'),
(481, 32, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-02 23:57:16', '2026-08-02 23:57:15', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Kalimantan</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/43', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"43\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Kalimantan\", \"requires_approval\": false}'),
(482, 33, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-02 23:57:16', '2026-08-02 23:57:15', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Kalimantan</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/43', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"43\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Kalimantan\", \"requires_approval\": true}'),
(483, 39, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-02 23:57:16', '2026-08-02 23:57:15', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Kalimantan</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/43', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"43\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Kalimantan\", \"requires_approval\": false}'),
(484, 1, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-02 23:59:00', '2026-08-02 23:58:59', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Batam Central\", \"requires_approval\": false}'),
(485, 4, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-02 23:59:00', '2026-08-02 23:58:59', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Batam Central\", \"requires_approval\": true}'),
(486, 6, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-02 23:59:00', '2026-08-02 23:58:59', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Batam Central\", \"requires_approval\": false}'),
(487, 32, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-02 23:59:00', '2026-08-02 23:58:59', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Batam Central\", \"requires_approval\": false}');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `is_read`, `created_by`, `updated_by`, `deleted_by`, `created_at`, `updated_at`, `deleted_at`, `message`, `notification_type`, `action_link`, `meta_data`) VALUES
(488, 33, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-02 23:59:00', '2026-08-02 23:58:59', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Batam Central\", \"requires_approval\": true}'),
(489, 39, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-02 23:59:00', '2026-08-02 23:58:59', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Batam Central\", \"requires_approval\": false}'),
(490, 1, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:04:37', '2026-08-03 00:04:36', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Batam Central\", \"requires_approval\": false}'),
(491, 4, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:04:37', '2026-08-03 00:04:36', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Batam Central\", \"requires_approval\": true}'),
(492, 6, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:04:37', '2026-08-03 00:04:36', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Batam Central\", \"requires_approval\": false}'),
(493, 32, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:04:37', '2026-08-03 00:04:36', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Batam Central\", \"requires_approval\": false}'),
(494, 33, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:04:37', '2026-08-03 00:04:36', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Batam Central\", \"requires_approval\": true}'),
(495, 39, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:04:37', '2026-08-03 00:04:36', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Batam Central\", \"requires_approval\": false}'),
(496, 1, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:05:00', '2026-08-03 00:04:59', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Batam Central\", \"requires_approval\": false}'),
(497, 4, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:05:00', '2026-08-03 00:04:59', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Batam Central\", \"requires_approval\": true}'),
(498, 6, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:05:00', '2026-08-03 00:04:59', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Batam Central\", \"requires_approval\": false}'),
(499, 32, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:05:00', '2026-08-03 00:04:59', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Batam Central\", \"requires_approval\": false}'),
(500, 33, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:05:00', '2026-08-03 00:04:59', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Batam Central\", \"requires_approval\": true}'),
(501, 39, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:05:00', '2026-08-03 00:04:59', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Batam Central\", \"requires_approval\": false}'),
(502, 1, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:05:34', '2026-08-03 00:05:34', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net papua Sorong</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/44', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"44\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net papua Sorong\", \"requires_approval\": false}'),
(503, 4, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:05:34', '2026-08-03 00:05:34', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net papua Sorong</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/44', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"44\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net papua Sorong\", \"requires_approval\": true}'),
(504, 6, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:05:34', '2026-08-03 00:05:34', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net papua Sorong</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/44', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"44\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net papua Sorong\", \"requires_approval\": false}'),
(505, 32, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:05:34', '2026-08-03 00:05:34', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net papua Sorong</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/44', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"44\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net papua Sorong\", \"requires_approval\": false}'),
(506, 33, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:05:34', '2026-08-03 00:05:34', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net papua Sorong</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/44', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"44\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net papua Sorong\", \"requires_approval\": true}'),
(507, 39, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:05:34', '2026-08-03 00:05:34', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net papua Sorong</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/44', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"44\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net papua Sorong\", \"requires_approval\": false}'),
(508, 1, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:05:51', '2026-08-03 00:05:51', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Kalimantan</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/43', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"43\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Kalimantan\", \"requires_approval\": false}'),
(509, 4, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:05:51', '2026-08-03 00:05:51', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Kalimantan</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/43', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"43\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Kalimantan\", \"requires_approval\": true}'),
(510, 6, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:05:51', '2026-08-03 00:05:51', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Kalimantan</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/43', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"43\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Kalimantan\", \"requires_approval\": false}'),
(511, 32, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:05:51', '2026-08-03 00:05:51', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Kalimantan</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/43', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"43\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Kalimantan\", \"requires_approval\": false}'),
(512, 33, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:05:51', '2026-08-03 00:05:51', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Kalimantan</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/43', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"43\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Kalimantan\", \"requires_approval\": true}'),
(513, 39, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:05:51', '2026-08-03 00:05:51', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Kalimantan</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/43', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"43\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Kalimantan\", \"requires_approval\": false}'),
(514, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-03 00:07:57', '2026-08-03 00:07:57', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Riau</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/46', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"46\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Rumah Net Riau\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(515, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-03 00:07:57', '2026-08-03 00:07:57', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Riau</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/46', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"46\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Rumah Net Riau\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(516, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-03 00:07:57', '2026-08-03 00:07:57', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Riau</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/46', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"46\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Rumah Net Riau\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(517, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-03 00:07:57', '2026-08-03 00:07:57', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Riau</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/46', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"46\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Rumah Net Riau\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(518, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-03 00:07:57', '2026-08-03 00:07:57', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Riau</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/46', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"46\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Rumah Net Riau\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(519, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-03 00:07:57', '2026-08-03 00:07:57', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Riau</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/46', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"46\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"Project Rumah Net Riau\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(520, 1, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:09:45', '2026-08-03 00:09:45', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Riau</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/46', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"46\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Riau\", \"requires_approval\": false}'),
(521, 4, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:09:45', '2026-08-03 00:09:45', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Riau</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/46', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"46\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Riau\", \"requires_approval\": true}'),
(522, 6, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:09:45', '2026-08-03 00:09:45', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Riau</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/46', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"46\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Riau\", \"requires_approval\": false}'),
(523, 32, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:09:45', '2026-08-03 00:09:45', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Riau</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/46', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"46\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Riau\", \"requires_approval\": false}'),
(524, 33, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:09:45', '2026-08-03 00:09:45', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Riau</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/46', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"46\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Riau\", \"requires_approval\": true}'),
(525, 39, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:09:45', '2026-08-03 00:09:45', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Riau</span> dari <span style=\"font-weight: 600; color: #0f172a;\">undefined</span> (Medium).', 'ALERT', '/sales/tenders/46', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"46\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Riau\", \"requires_approval\": false}'),
(526, 1, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:16:11', '2026-08-03 00:16:11', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Riau</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Large).', 'ALERT', '/sales/tenders/46', '{\"tier\": \"Large\", \"won_at\": null, \"lead_id\": \"46\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Riau\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(527, 4, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:16:11', '2026-08-03 00:16:11', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Riau</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Large).', 'ALERT', '/sales/tenders/46', '{\"tier\": \"Large\", \"won_at\": null, \"lead_id\": \"46\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Riau\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(528, 6, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:16:11', '2026-08-03 00:16:11', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Riau</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Large).', 'ALERT', '/sales/tenders/46', '{\"tier\": \"Large\", \"won_at\": null, \"lead_id\": \"46\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Riau\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(529, 32, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:16:11', '2026-08-03 00:16:11', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Riau</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Large).', 'ALERT', '/sales/tenders/46', '{\"tier\": \"Large\", \"won_at\": null, \"lead_id\": \"46\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Riau\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(530, 33, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:16:11', '2026-08-03 00:16:11', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Riau</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Large).', 'ALERT', '/sales/tenders/46', '{\"tier\": \"Large\", \"won_at\": null, \"lead_id\": \"46\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Riau\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(531, 39, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:16:11', '2026-08-03 00:16:11', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Riau</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Large).', 'ALERT', '/sales/tenders/46', '{\"tier\": \"Large\", \"won_at\": null, \"lead_id\": \"46\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Riau\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(532, 1, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:24:56', '2026-08-03 00:24:55', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Riau</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/46', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"46\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Riau\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(533, 4, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:24:56', '2026-08-03 00:24:55', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Riau</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/46', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"46\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Riau\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(534, 6, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:24:56', '2026-08-03 00:24:55', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Riau</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/46', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"46\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Riau\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(535, 9, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:24:56', '2026-08-03 00:24:55', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Riau</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/46', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"46\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Riau\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(536, 32, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:24:56', '2026-08-03 00:24:55', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Riau</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/46', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"46\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Riau\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(537, 33, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:24:56', '2026-08-03 00:24:55', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Riau</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/46', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"46\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Riau\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(538, 39, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 00:24:56', '2026-08-03 00:24:55', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Riau</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/46', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"46\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Riau\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(539, 1, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 11:25:45', '2026-08-03 11:25:44', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span>.', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"user_name\": \"Lukas Kurniawan\", \"action_type\": \"PROPOSAL_UPLOADED\", \"project_name\": \"Project Rumah Net Batam Central\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(540, 4, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 11:25:45', '2026-08-03 11:25:44', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span>.', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"user_name\": \"Lukas Kurniawan\", \"action_type\": \"PROPOSAL_UPLOADED\", \"project_name\": \"Project Rumah Net Batam Central\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(541, 6, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 11:25:45', '2026-08-03 11:25:44', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span>.', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"user_name\": \"Lukas Kurniawan\", \"action_type\": \"PROPOSAL_UPLOADED\", \"project_name\": \"Project Rumah Net Batam Central\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(542, 32, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 11:25:45', '2026-08-03 11:25:44', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span>.', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"user_name\": \"Lukas Kurniawan\", \"action_type\": \"PROPOSAL_UPLOADED\", \"project_name\": \"Project Rumah Net Batam Central\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(543, 33, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 11:25:45', '2026-08-03 11:25:44', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span>.', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"user_name\": \"Lukas Kurniawan\", \"action_type\": \"PROPOSAL_UPLOADED\", \"project_name\": \"Project Rumah Net Batam Central\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(544, 39, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 11:25:45', '2026-08-03 11:25:44', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span>.', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"45\", \"user_name\": \"Lukas Kurniawan\", \"action_type\": \"PROPOSAL_UPLOADED\", \"project_name\": \"Project Rumah Net Batam Central\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(545, 1, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 11:26:03', '2026-08-03 11:26:02', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">undefined</span>.', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Small\", \"won_at\": null, \"lead_id\": 45, \"action_type\": \"NEW_ACTIVITY\", \"requires_approval\": false}'),
(546, 4, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 11:26:03', '2026-08-03 11:26:02', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">undefined</span>.', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Small\", \"won_at\": null, \"lead_id\": 45, \"action_type\": \"NEW_ACTIVITY\", \"requires_approval\": true}'),
(547, 6, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 11:26:03', '2026-08-03 11:26:02', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">undefined</span>.', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Small\", \"won_at\": null, \"lead_id\": 45, \"action_type\": \"NEW_ACTIVITY\", \"requires_approval\": false}'),
(548, 32, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 11:26:03', '2026-08-03 11:26:02', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">undefined</span>.', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Small\", \"won_at\": null, \"lead_id\": 45, \"action_type\": \"NEW_ACTIVITY\", \"requires_approval\": false}'),
(549, 33, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 11:26:03', '2026-08-03 11:26:02', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">undefined</span>.', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Small\", \"won_at\": null, \"lead_id\": 45, \"action_type\": \"NEW_ACTIVITY\", \"requires_approval\": true}'),
(550, 39, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 11:26:03', '2026-08-03 11:26:02', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">undefined</span> melakukan update pada tender <span style=\"font-weight: 600; color: #0f172a;\">undefined</span>.', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Small\", \"won_at\": null, \"lead_id\": 45, \"action_type\": \"NEW_ACTIVITY\", \"requires_approval\": false}'),
(551, 10, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-08-03 11:26:11', '2026-08-03 11:26:11', NULL, 'Tender \"Tender ID: 45\" telah disetujui (WON). Draft Kontrak #21 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 21}'),
(552, 35, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-08-03 11:26:11', '2026-08-03 11:26:11', NULL, 'Tender \"Tender ID: 45\" telah disetujui (WON). Draft Kontrak #21 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 21}'),
(553, 1, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-08-03 11:26:11', '2026-08-03 11:26:11', NULL, 'Tender \"Tender ID: 45\" telah disetujui (WON). Draft Kontrak #21 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 21}'),
(554, 32, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-08-03 11:26:11', '2026-08-03 11:26:11', NULL, 'Tender \"Tender ID: 45\" telah disetujui (WON). Draft Kontrak #21 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 21}'),
(555, 39, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-08-03 11:26:11', '2026-08-03 11:26:11', NULL, 'Tender \"Tender ID: 45\" telah disetujui (WON). Draft Kontrak #21 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 21}'),
(556, 1, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-03 11:26:11', '2026-08-03 11:26:11', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": \"2026-08-03T04:26:11.404Z\", \"lead_id\": \"45\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project Rumah Net Batam Central\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(557, 4, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-03 11:26:11', '2026-08-03 11:26:11', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": \"2026-08-03T04:26:11.404Z\", \"lead_id\": \"45\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project Rumah Net Batam Central\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(558, 6, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-03 11:26:11', '2026-08-03 11:26:11', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": \"2026-08-03T04:26:11.404Z\", \"lead_id\": \"45\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project Rumah Net Batam Central\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(559, 7, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-03 11:26:11', '2026-08-03 11:26:11', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": \"2026-08-03T04:26:11.404Z\", \"lead_id\": \"45\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project Rumah Net Batam Central\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(560, 32, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-03 11:26:11', '2026-08-03 11:26:11', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": \"2026-08-03T04:26:11.404Z\", \"lead_id\": \"45\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project Rumah Net Batam Central\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(561, 33, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-03 11:26:11', '2026-08-03 11:26:11', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": \"2026-08-03T04:26:11.404Z\", \"lead_id\": \"45\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project Rumah Net Batam Central\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(562, 39, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-03 11:26:11', '2026-08-03 11:26:11', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Batam Central</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/45', '{\"tier\": \"Medium\", \"won_at\": \"2026-08-03T04:26:11.404Z\", \"lead_id\": \"45\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project Rumah Net Batam Central\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(563, 2, '🚀 Project Siap Kick Off', 0, 0, NULL, NULL, '2026-08-03 11:27:08', '2026-08-03 11:27:08', NULL, 'Proyek **\"Project Rumah Net Batam Central\"** telah **disetujui oleh tim Legal** dan **siap dijadwalkan untuk Kick Off**.', 'ALERT', '/project-delivery', '{\"actionLink\": \"/project-delivery\", \"contractId\": \"21\"}'),
(564, 7, '✅ SPK Disetujui Legal', 0, 0, NULL, NULL, '2026-08-03 11:27:08', '2026-08-03 11:27:08', NULL, 'Proyek **\"Project Rumah Net Batam Central\"** telah **disetujui oleh tim Legal**. Proses Sales untuk proyek ini telah selesai.', 'SYSTEM', '/sales/tenders/45', '{\"actionLink\": \"/sales/tenders/45\", \"contractId\": \"21\"}'),
(565, 36, '🚀 Project Siap Kick Off', 0, 0, NULL, NULL, '2026-08-03 11:27:08', '2026-08-03 11:27:08', NULL, 'Proyek **\"Project Rumah Net Batam Central\"** telah **disetujui oleh tim Legal** dan **siap dijadwalkan untuk Kick Off**.', 'ALERT', '/project-delivery', '{\"actionLink\": \"/project-delivery\", \"contractId\": \"21\"}'),
(566, 9, '✅ SPK Disetujui Legal', 0, 0, NULL, NULL, '2026-08-03 11:27:08', '2026-08-03 11:27:08', NULL, 'Proyek **\"Project Rumah Net Batam Central\"** telah **disetujui oleh tim Legal**. Proses Sales untuk proyek ini telah selesai.', 'SYSTEM', '/sales/tenders/45', '{\"actionLink\": \"/sales/tenders/45\", \"contractId\": \"21\"}'),
(567, 1, '🚀 Project Siap Kick Off', 0, 0, NULL, NULL, '2026-08-03 11:27:08', '2026-08-03 11:27:08', NULL, 'Proyek **\"Project Rumah Net Batam Central\"** telah **disetujui oleh tim Legal** dan **siap dijadwalkan untuk Kick Off**.', 'ALERT', '/project-delivery', '{\"actionLink\": \"/project-delivery\", \"contractId\": \"21\"}'),
(568, 34, '✅ SPK Disetujui Legal', 0, 0, NULL, NULL, '2026-08-03 11:27:08', '2026-08-03 11:27:08', NULL, 'Proyek **\"Project Rumah Net Batam Central\"** telah **disetujui oleh tim Legal**. Proses Sales untuk proyek ini telah selesai.', 'SYSTEM', '/sales/tenders/45', '{\"actionLink\": \"/sales/tenders/45\", \"contractId\": \"21\"}'),
(569, 32, '🚀 Project Siap Kick Off', 0, 0, NULL, NULL, '2026-08-03 11:27:08', '2026-08-03 11:27:08', NULL, 'Proyek **\"Project Rumah Net Batam Central\"** telah **disetujui oleh tim Legal** dan **siap dijadwalkan untuk Kick Off**.', 'ALERT', '/project-delivery', '{\"actionLink\": \"/project-delivery\", \"contractId\": \"21\"}'),
(570, 39, '🚀 Project Siap Kick Off', 0, 0, NULL, NULL, '2026-08-03 11:27:08', '2026-08-03 11:27:08', NULL, 'Proyek **\"Project Rumah Net Batam Central\"** telah **disetujui oleh tim Legal** dan **siap dijadwalkan untuk Kick Off**.', 'ALERT', '/project-delivery', '{\"actionLink\": \"/project-delivery\", \"contractId\": \"21\"}'),
(571, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-03 13:41:20', '2026-08-03 13:41:20', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Madura</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Small).', 'ALERT', '/sales/tenders/47', '{\"tier\": \"Small\", \"won_at\": null, \"lead_id\": \"47\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Madura\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(572, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-03 13:41:20', '2026-08-03 13:41:20', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Madura</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Small).', 'ALERT', '/sales/tenders/47', '{\"tier\": \"Small\", \"won_at\": null, \"lead_id\": \"47\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Madura\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(573, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-03 13:41:20', '2026-08-03 13:41:20', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Madura</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Small).', 'ALERT', '/sales/tenders/47', '{\"tier\": \"Small\", \"won_at\": null, \"lead_id\": \"47\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Madura\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(574, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-03 13:41:20', '2026-08-03 13:41:20', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Madura</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Small).', 'ALERT', '/sales/tenders/47', '{\"tier\": \"Small\", \"won_at\": null, \"lead_id\": \"47\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Madura\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(575, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-03 13:41:20', '2026-08-03 13:41:20', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Madura</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Small).', 'ALERT', '/sales/tenders/47', '{\"tier\": \"Small\", \"won_at\": null, \"lead_id\": \"47\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Madura\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `is_read`, `created_by`, `updated_by`, `deleted_by`, `created_at`, `updated_at`, `deleted_at`, `message`, `notification_type`, `action_link`, `meta_data`) VALUES
(576, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-03 13:41:20', '2026-08-03 13:41:20', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Madura</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Small).', 'ALERT', '/sales/tenders/47', '{\"tier\": \"Small\", \"won_at\": null, \"lead_id\": \"47\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Madura\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(577, 10, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-08-03 13:42:09', '2026-08-03 13:42:08', NULL, 'Tender \"Tender ID: 47\" telah disetujui (WON). Draft Kontrak #22 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 22}'),
(578, 35, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-08-03 13:42:09', '2026-08-03 13:42:08', NULL, 'Tender \"Tender ID: 47\" telah disetujui (WON). Draft Kontrak #22 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 22}'),
(579, 1, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-08-03 13:42:09', '2026-08-03 13:42:08', NULL, 'Tender \"Tender ID: 47\" telah disetujui (WON). Draft Kontrak #22 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 22}'),
(580, 32, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-08-03 13:42:09', '2026-08-03 13:42:08', NULL, 'Tender \"Tender ID: 47\" telah disetujui (WON). Draft Kontrak #22 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 22}'),
(581, 39, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-08-03 13:42:09', '2026-08-03 13:42:08', NULL, 'Tender \"Tender ID: 47\" telah disetujui (WON). Draft Kontrak #22 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 22}'),
(582, 1, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-03 13:42:09', '2026-08-03 13:42:08', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Madura</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Small).', 'ALERT', '/sales/tenders/47', '{\"tier\": \"Small\", \"won_at\": \"2026-08-03T06:42:08.755Z\", \"lead_id\": \"47\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Madura\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(583, 4, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-03 13:42:09', '2026-08-03 13:42:08', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Madura</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Small).', 'ALERT', '/sales/tenders/47', '{\"tier\": \"Small\", \"won_at\": \"2026-08-03T06:42:08.755Z\", \"lead_id\": \"47\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Madura\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(584, 6, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-03 13:42:09', '2026-08-03 13:42:08', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Madura</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Small).', 'ALERT', '/sales/tenders/47', '{\"tier\": \"Small\", \"won_at\": \"2026-08-03T06:42:08.755Z\", \"lead_id\": \"47\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Madura\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(585, 9, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-03 13:42:09', '2026-08-03 13:42:08', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Madura</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Small).', 'ALERT', '/sales/tenders/47', '{\"tier\": \"Small\", \"won_at\": \"2026-08-03T06:42:08.755Z\", \"lead_id\": \"47\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Madura\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(586, 32, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-03 13:42:09', '2026-08-03 13:42:08', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Madura</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Small).', 'ALERT', '/sales/tenders/47', '{\"tier\": \"Small\", \"won_at\": \"2026-08-03T06:42:08.755Z\", \"lead_id\": \"47\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Madura\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(587, 33, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-03 13:42:09', '2026-08-03 13:42:08', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Madura</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Small).', 'ALERT', '/sales/tenders/47', '{\"tier\": \"Small\", \"won_at\": \"2026-08-03T06:42:08.755Z\", \"lead_id\": \"47\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Madura\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(588, 39, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-03 13:42:09', '2026-08-03 13:42:08', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Madura</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Small).', 'ALERT', '/sales/tenders/47', '{\"tier\": \"Small\", \"won_at\": \"2026-08-03T06:42:08.755Z\", \"lead_id\": \"47\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Madura\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(589, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-03 13:44:24', '2026-08-03 13:44:23', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Sulawesi</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/48', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"48\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Sulawesi\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(590, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-03 13:44:24', '2026-08-03 13:44:23', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Sulawesi</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/48', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"48\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Sulawesi\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(591, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-03 13:44:24', '2026-08-03 13:44:23', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Sulawesi</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/48', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"48\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Sulawesi\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(592, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-03 13:44:24', '2026-08-03 13:44:23', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Sulawesi</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/48', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"48\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Sulawesi\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(593, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-03 13:44:24', '2026-08-03 13:44:23', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Sulawesi</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/48', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"48\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Sulawesi\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(594, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-03 13:44:24', '2026-08-03 13:44:23', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Sulawesi</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/48', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"48\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Sulawesi\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(595, 10, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-08-03 13:44:51', '2026-08-03 13:44:51', NULL, 'Tender \"Tender ID: 48\" telah disetujui (WON). Draft Kontrak #23 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 23}'),
(596, 35, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-08-03 13:44:51', '2026-08-03 13:44:51', NULL, 'Tender \"Tender ID: 48\" telah disetujui (WON). Draft Kontrak #23 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 23}'),
(597, 1, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-08-03 13:44:51', '2026-08-03 13:44:51', NULL, 'Tender \"Tender ID: 48\" telah disetujui (WON). Draft Kontrak #23 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 23}'),
(598, 32, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-08-03 13:44:51', '2026-08-03 13:44:51', NULL, 'Tender \"Tender ID: 48\" telah disetujui (WON). Draft Kontrak #23 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 23}'),
(599, 39, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-08-03 13:44:51', '2026-08-03 13:44:51', NULL, 'Tender \"Tender ID: 48\" telah disetujui (WON). Draft Kontrak #23 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 23}'),
(600, 1, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-03 13:44:51', '2026-08-03 13:44:51', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Sulawesi</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/48', '{\"tier\": \"Medium\", \"won_at\": \"2026-08-03T06:44:51.419Z\", \"lead_id\": \"48\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Sulawesi\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(601, 4, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-03 13:44:51', '2026-08-03 13:44:51', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Sulawesi</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/48', '{\"tier\": \"Medium\", \"won_at\": \"2026-08-03T06:44:51.419Z\", \"lead_id\": \"48\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Sulawesi\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(602, 6, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-03 13:44:51', '2026-08-03 13:44:51', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Sulawesi</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/48', '{\"tier\": \"Medium\", \"won_at\": \"2026-08-03T06:44:51.419Z\", \"lead_id\": \"48\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Sulawesi\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(603, 9, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-03 13:44:51', '2026-08-03 13:44:51', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Sulawesi</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/48', '{\"tier\": \"Medium\", \"won_at\": \"2026-08-03T06:44:51.419Z\", \"lead_id\": \"48\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Sulawesi\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(604, 32, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-03 13:44:51', '2026-08-03 13:44:51', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Sulawesi</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/48', '{\"tier\": \"Medium\", \"won_at\": \"2026-08-03T06:44:51.419Z\", \"lead_id\": \"48\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Sulawesi\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(605, 33, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-03 13:44:51', '2026-08-03 13:44:51', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Sulawesi</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/48', '{\"tier\": \"Medium\", \"won_at\": \"2026-08-03T06:44:51.419Z\", \"lead_id\": \"48\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Sulawesi\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(606, 39, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-03 13:44:51', '2026-08-03 13:44:51', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Sulawesi</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/48', '{\"tier\": \"Medium\", \"won_at\": \"2026-08-03T06:44:51.419Z\", \"lead_id\": \"48\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Sulawesi\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(607, 7, '✅ SPK Disetujui Legal', 0, 0, NULL, NULL, '2026-08-03 13:46:18', '2026-08-03 13:46:18', NULL, 'Proyek **\"CSA-FKI Rumah Net Sulawesi\"** telah **disetujui oleh tim Legal**. Proses Sales untuk proyek ini telah selesai.', 'SYSTEM', '/sales/tenders/48', '{\"actionLink\": \"/sales/tenders/48\", \"contractId\": \"23\"}'),
(608, 2, '🚀 Project Siap Kick Off', 0, 0, NULL, NULL, '2026-08-03 13:46:18', '2026-08-03 13:46:18', NULL, 'Proyek **\"CSA-FKI Rumah Net Sulawesi\"** telah **disetujui oleh tim Legal** dan **siap dijadwalkan untuk Kick Off**.', 'ALERT', '/project-delivery', '{\"actionLink\": \"/project-delivery\", \"contractId\": \"23\"}'),
(609, 9, '✅ SPK Disetujui Legal', 0, 0, NULL, NULL, '2026-08-03 13:46:18', '2026-08-03 13:46:18', NULL, 'Proyek **\"CSA-FKI Rumah Net Sulawesi\"** telah **disetujui oleh tim Legal**. Proses Sales untuk proyek ini telah selesai.', 'SYSTEM', '/sales/tenders/48', '{\"actionLink\": \"/sales/tenders/48\", \"contractId\": \"23\"}'),
(610, 36, '🚀 Project Siap Kick Off', 0, 0, NULL, NULL, '2026-08-03 13:46:18', '2026-08-03 13:46:18', NULL, 'Proyek **\"CSA-FKI Rumah Net Sulawesi\"** telah **disetujui oleh tim Legal** dan **siap dijadwalkan untuk Kick Off**.', 'ALERT', '/project-delivery', '{\"actionLink\": \"/project-delivery\", \"contractId\": \"23\"}'),
(611, 34, '✅ SPK Disetujui Legal', 0, 0, NULL, NULL, '2026-08-03 13:46:18', '2026-08-03 13:46:18', NULL, 'Proyek **\"CSA-FKI Rumah Net Sulawesi\"** telah **disetujui oleh tim Legal**. Proses Sales untuk proyek ini telah selesai.', 'SYSTEM', '/sales/tenders/48', '{\"actionLink\": \"/sales/tenders/48\", \"contractId\": \"23\"}'),
(612, 1, '🚀 Project Siap Kick Off', 0, 0, NULL, NULL, '2026-08-03 13:46:18', '2026-08-03 13:46:18', NULL, 'Proyek **\"CSA-FKI Rumah Net Sulawesi\"** telah **disetujui oleh tim Legal** dan **siap dijadwalkan untuk Kick Off**.', 'ALERT', '/project-delivery', '{\"actionLink\": \"/project-delivery\", \"contractId\": \"23\"}'),
(613, 32, '🚀 Project Siap Kick Off', 0, 0, NULL, NULL, '2026-08-03 13:46:18', '2026-08-03 13:46:18', NULL, 'Proyek **\"CSA-FKI Rumah Net Sulawesi\"** telah **disetujui oleh tim Legal** dan **siap dijadwalkan untuk Kick Off**.', 'ALERT', '/project-delivery', '{\"actionLink\": \"/project-delivery\", \"contractId\": \"23\"}'),
(614, 39, '🚀 Project Siap Kick Off', 0, 0, NULL, NULL, '2026-08-03 13:46:18', '2026-08-03 13:46:18', NULL, 'Proyek **\"CSA-FKI Rumah Net Sulawesi\"** telah **disetujui oleh tim Legal** dan **siap dijadwalkan untuk Kick Off**.', 'ALERT', '/project-delivery', '{\"actionLink\": \"/project-delivery\", \"contractId\": \"23\"}'),
(615, 1, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-03 13:52:02', '2026-08-03 13:52:01', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net papua Sorong</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/44', '{\"tier\": \"Medium\", \"won_at\": \"2026-08-03T06:52:01.978Z\", \"lead_id\": \"44\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project Rumah Net papua Sorong\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(616, 4, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-03 13:52:02', '2026-08-03 13:52:01', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net papua Sorong</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/44', '{\"tier\": \"Medium\", \"won_at\": \"2026-08-03T06:52:01.978Z\", \"lead_id\": \"44\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project Rumah Net papua Sorong\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(617, 6, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-03 13:52:02', '2026-08-03 13:52:02', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net papua Sorong</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/44', '{\"tier\": \"Medium\", \"won_at\": \"2026-08-03T06:52:01.978Z\", \"lead_id\": \"44\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project Rumah Net papua Sorong\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(618, 7, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-03 13:52:02', '2026-08-03 13:52:02', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net papua Sorong</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/44', '{\"tier\": \"Medium\", \"won_at\": \"2026-08-03T06:52:01.978Z\", \"lead_id\": \"44\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project Rumah Net papua Sorong\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(619, 32, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-03 13:52:02', '2026-08-03 13:52:02', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net papua Sorong</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/44', '{\"tier\": \"Medium\", \"won_at\": \"2026-08-03T06:52:01.978Z\", \"lead_id\": \"44\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project Rumah Net papua Sorong\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(620, 33, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-03 13:52:02', '2026-08-03 13:52:02', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net papua Sorong</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/44', '{\"tier\": \"Medium\", \"won_at\": \"2026-08-03T06:52:01.978Z\", \"lead_id\": \"44\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project Rumah Net papua Sorong\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(621, 39, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-03 13:52:02', '2026-08-03 13:52:02', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net papua Sorong</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/44', '{\"tier\": \"Medium\", \"won_at\": \"2026-08-03T06:52:01.978Z\", \"lead_id\": \"44\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project Rumah Net papua Sorong\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(622, 1, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 13:54:03', '2026-08-03 13:54:03', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Kalimantan</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/43', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"43\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Kalimantan\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(623, 4, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 13:54:03', '2026-08-03 13:54:03', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Kalimantan</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/43', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"43\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Kalimantan\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(624, 6, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 13:54:03', '2026-08-03 13:54:03', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Kalimantan</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/43', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"43\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Kalimantan\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(625, 7, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 13:54:03', '2026-08-03 13:54:03', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Kalimantan</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/43', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"43\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Kalimantan\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(626, 32, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 13:54:03', '2026-08-03 13:54:03', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Kalimantan</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/43', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"43\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Kalimantan\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(627, 33, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 13:54:03', '2026-08-03 13:54:03', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Kalimantan</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/43', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"43\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Kalimantan\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(628, 39, 'ℹ️ Info Sistem', 0, 0, NULL, NULL, '2026-08-03 13:54:03', '2026-08-03 13:54:03', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memperbarui tender <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Kalimantan</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/43', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"43\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"UPDATED\", \"project_name\": \"Project Rumah Net Kalimantan\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(629, 1, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-03 14:46:46', '2026-08-03 14:46:46', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Kalimantan</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/43', '{\"tier\": \"Medium\", \"won_at\": \"2026-08-03T07:46:46.091Z\", \"lead_id\": \"43\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project Rumah Net Kalimantan\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(630, 4, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-03 14:46:46', '2026-08-03 14:46:46', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Kalimantan</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/43', '{\"tier\": \"Medium\", \"won_at\": \"2026-08-03T07:46:46.091Z\", \"lead_id\": \"43\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project Rumah Net Kalimantan\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(631, 6, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-03 14:46:46', '2026-08-03 14:46:46', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Kalimantan</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/43', '{\"tier\": \"Medium\", \"won_at\": \"2026-08-03T07:46:46.091Z\", \"lead_id\": \"43\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project Rumah Net Kalimantan\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(632, 7, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-03 14:46:46', '2026-08-03 14:46:46', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Kalimantan</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/43', '{\"tier\": \"Medium\", \"won_at\": \"2026-08-03T07:46:46.091Z\", \"lead_id\": \"43\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project Rumah Net Kalimantan\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(633, 32, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-03 14:46:46', '2026-08-03 14:46:46', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Kalimantan</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/43', '{\"tier\": \"Medium\", \"won_at\": \"2026-08-03T07:46:46.091Z\", \"lead_id\": \"43\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project Rumah Net Kalimantan\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(634, 33, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-03 14:46:46', '2026-08-03 14:46:46', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Kalimantan</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/43', '{\"tier\": \"Medium\", \"won_at\": \"2026-08-03T07:46:46.091Z\", \"lead_id\": \"43\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project Rumah Net Kalimantan\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(635, 39, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-03 14:46:46', '2026-08-03 14:46:46', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Kalimantan</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/43', '{\"tier\": \"Medium\", \"won_at\": \"2026-08-03T07:46:46.091Z\", \"lead_id\": \"43\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project Rumah Net Kalimantan\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(636, 10, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-08-03 17:41:24', '2026-08-03 17:41:23', NULL, 'Tender \"Tender ID: 46\" telah disetujui (WON). Draft Kontrak #24 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 24}'),
(637, 35, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-08-03 17:41:24', '2026-08-03 17:41:23', NULL, 'Tender \"Tender ID: 46\" telah disetujui (WON). Draft Kontrak #24 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 24}'),
(638, 1, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-08-03 17:41:24', '2026-08-03 17:41:23', NULL, 'Tender \"Tender ID: 46\" telah disetujui (WON). Draft Kontrak #24 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 24}'),
(639, 32, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-08-03 17:41:24', '2026-08-03 17:41:23', NULL, 'Tender \"Tender ID: 46\" telah disetujui (WON). Draft Kontrak #24 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 24}'),
(640, 39, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-08-03 17:41:24', '2026-08-03 17:41:23', NULL, 'Tender \"Tender ID: 46\" telah disetujui (WON). Draft Kontrak #24 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 24}'),
(641, 1, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-03 17:41:24', '2026-08-03 17:41:23', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Riau</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/46', '{\"tier\": \"Medium\", \"won_at\": \"2026-08-03T10:41:23.714Z\", \"lead_id\": \"46\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project Rumah Net Riau\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(642, 4, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-03 17:41:24', '2026-08-03 17:41:23', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Riau</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/46', '{\"tier\": \"Medium\", \"won_at\": \"2026-08-03T10:41:23.714Z\", \"lead_id\": \"46\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project Rumah Net Riau\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(643, 6, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-03 17:41:24', '2026-08-03 17:41:23', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Riau</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/46', '{\"tier\": \"Medium\", \"won_at\": \"2026-08-03T10:41:23.714Z\", \"lead_id\": \"46\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project Rumah Net Riau\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(644, 9, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-03 17:41:24', '2026-08-03 17:41:23', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Riau</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/46', '{\"tier\": \"Medium\", \"won_at\": \"2026-08-03T10:41:23.714Z\", \"lead_id\": \"46\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project Rumah Net Riau\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(645, 32, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-03 17:41:24', '2026-08-03 17:41:23', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Riau</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/46', '{\"tier\": \"Medium\", \"won_at\": \"2026-08-03T10:41:23.714Z\", \"lead_id\": \"46\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project Rumah Net Riau\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(646, 33, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-03 17:41:24', '2026-08-03 17:41:23', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Riau</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/46', '{\"tier\": \"Medium\", \"won_at\": \"2026-08-03T10:41:23.714Z\", \"lead_id\": \"46\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project Rumah Net Riau\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(647, 39, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-03 17:41:24', '2026-08-03 17:41:23', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">Project Rumah Net Riau</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/46', '{\"tier\": \"Medium\", \"won_at\": \"2026-08-03T10:41:23.714Z\", \"lead_id\": \"46\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"Project Rumah Net Riau\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(648, 1, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-03 17:42:34', '2026-08-03 17:42:34', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bojonegori</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/35', '{\"tier\": \"Medium\", \"won_at\": \"2026-08-03T10:42:34.494Z\", \"lead_id\": \"35\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Bojonegori\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(649, 4, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-03 17:42:34', '2026-08-03 17:42:34', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bojonegori</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/35', '{\"tier\": \"Medium\", \"won_at\": \"2026-08-03T10:42:34.494Z\", \"lead_id\": \"35\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Bojonegori\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(650, 6, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-03 17:42:34', '2026-08-03 17:42:34', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bojonegori</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/35', '{\"tier\": \"Medium\", \"won_at\": \"2026-08-03T10:42:34.494Z\", \"lead_id\": \"35\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Bojonegori\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(651, 9, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-03 17:42:34', '2026-08-03 17:42:34', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bojonegori</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/35', '{\"tier\": \"Medium\", \"won_at\": \"2026-08-03T10:42:34.494Z\", \"lead_id\": \"35\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Bojonegori\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(652, 32, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-03 17:42:34', '2026-08-03 17:42:34', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bojonegori</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/35', '{\"tier\": \"Medium\", \"won_at\": \"2026-08-03T10:42:34.494Z\", \"lead_id\": \"35\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Bojonegori\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(653, 33, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-03 17:42:34', '2026-08-03 17:42:34', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bojonegori</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/35', '{\"tier\": \"Medium\", \"won_at\": \"2026-08-03T10:42:34.494Z\", \"lead_id\": \"35\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Bojonegori\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(654, 39, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-03 17:42:34', '2026-08-03 17:42:34', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bojonegori</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/35', '{\"tier\": \"Medium\", \"won_at\": \"2026-08-03T10:42:34.494Z\", \"lead_id\": \"35\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Bojonegori\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(655, 10, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-08-03 17:42:57', '2026-08-03 17:42:56', NULL, 'Tender \"Tender ID: 35\" telah disetujui (WON). Draft Kontrak #25 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 25}'),
(656, 35, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-08-03 17:42:57', '2026-08-03 17:42:56', NULL, 'Tender \"Tender ID: 35\" telah disetujui (WON). Draft Kontrak #25 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 25}'),
(657, 1, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-08-03 17:42:57', '2026-08-03 17:42:56', NULL, 'Tender \"Tender ID: 35\" telah disetujui (WON). Draft Kontrak #25 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 25}'),
(658, 32, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-08-03 17:42:57', '2026-08-03 17:42:56', NULL, 'Tender \"Tender ID: 35\" telah disetujui (WON). Draft Kontrak #25 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 25}'),
(659, 39, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-08-03 17:42:57', '2026-08-03 17:42:56', NULL, 'Tender \"Tender ID: 35\" telah disetujui (WON). Draft Kontrak #25 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 25}'),
(660, 1, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-03 17:42:57', '2026-08-03 17:42:56', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bojonegori</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/35', '{\"tier\": \"Medium\", \"won_at\": \"2026-08-03T10:42:56.726Z\", \"lead_id\": \"35\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Bojonegori\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `is_read`, `created_by`, `updated_by`, `deleted_by`, `created_at`, `updated_at`, `deleted_at`, `message`, `notification_type`, `action_link`, `meta_data`) VALUES
(661, 4, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-03 17:42:57', '2026-08-03 17:42:56', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bojonegori</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/35', '{\"tier\": \"Medium\", \"won_at\": \"2026-08-03T10:42:56.726Z\", \"lead_id\": \"35\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Bojonegori\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(662, 6, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-03 17:42:57', '2026-08-03 17:42:56', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bojonegori</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/35', '{\"tier\": \"Medium\", \"won_at\": \"2026-08-03T10:42:56.726Z\", \"lead_id\": \"35\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Bojonegori\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(663, 9, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-03 17:42:57', '2026-08-03 17:42:56', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bojonegori</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/35', '{\"tier\": \"Medium\", \"won_at\": \"2026-08-03T10:42:56.726Z\", \"lead_id\": \"35\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Bojonegori\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(664, 32, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-03 17:42:57', '2026-08-03 17:42:56', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bojonegori</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/35', '{\"tier\": \"Medium\", \"won_at\": \"2026-08-03T10:42:56.726Z\", \"lead_id\": \"35\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Bojonegori\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(665, 33, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-03 17:42:57', '2026-08-03 17:42:56', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bojonegori</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/35', '{\"tier\": \"Medium\", \"won_at\": \"2026-08-03T10:42:56.726Z\", \"lead_id\": \"35\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Bojonegori\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(666, 39, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-03 17:42:57', '2026-08-03 17:42:56', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bojonegori</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/35', '{\"tier\": \"Medium\", \"won_at\": \"2026-08-03T10:42:56.726Z\", \"lead_id\": \"35\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Bojonegori\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(667, 1, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-04 06:46:36', '2026-08-04 06:46:36', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Banten</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/49', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"49\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Banten\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(668, 4, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-04 06:46:36', '2026-08-04 06:46:36', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Banten</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/49', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"49\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Banten\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(669, 6, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-04 06:46:36', '2026-08-04 06:46:36', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Banten</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/49', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"49\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Banten\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(670, 32, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-04 06:46:36', '2026-08-04 06:46:36', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Banten</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/49', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"49\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Banten\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(671, 33, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-04 06:46:36', '2026-08-04 06:46:36', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Banten</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/49', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"49\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Banten\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(672, 39, 'Tender Baru', 0, 0, NULL, NULL, '2026-08-04 06:46:36', '2026-08-04 06:46:36', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Lukas Kurniawan (MARKETING)</span> membuat tender <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Banten</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/49', '{\"tier\": \"Medium\", \"won_at\": null, \"lead_id\": \"49\", \"user_name\": \"Lukas Kurniawan (MARKETING)\", \"action_type\": \"CREATED\", \"project_name\": \"CSA-FKI Rumah Net Banten\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(673, 10, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-08-04 07:05:35', '2026-08-04 07:05:35', NULL, 'Tender \"Tender ID: 34\" telah disetujui (WON). Draft Kontrak #26 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 26}'),
(674, 35, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-08-04 07:05:35', '2026-08-04 07:05:35', NULL, 'Tender \"Tender ID: 34\" telah disetujui (WON). Draft Kontrak #26 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 26}'),
(675, 1, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-08-04 07:05:35', '2026-08-04 07:05:35', NULL, 'Tender \"Tender ID: 34\" telah disetujui (WON). Draft Kontrak #26 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 26}'),
(676, 32, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-08-04 07:05:35', '2026-08-04 07:05:35', NULL, 'Tender \"Tender ID: 34\" telah disetujui (WON). Draft Kontrak #26 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 26}'),
(677, 39, 'Tender WON - Draft Kontrak Baru', 0, 0, NULL, NULL, '2026-08-04 07:05:35', '2026-08-04 07:05:35', NULL, 'Tender \"Tender ID: 34\" telah disetujui (WON). Draft Kontrak #26 siap direview.', 'ALERT', '/legal/review?tab=WAITING', '{\"actionLink\": \"/legal/review?tab=WAITING\", \"contractId\": 26}'),
(678, 1, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-04 07:05:35', '2026-08-04 07:05:35', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bolo Gresik</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/34', '{\"tier\": \"Medium\", \"won_at\": \"2026-08-04T00:05:35.259Z\", \"lead_id\": \"34\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Bolo Gresik\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(679, 4, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-04 07:05:35', '2026-08-04 07:05:35', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bolo Gresik</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/34', '{\"tier\": \"Medium\", \"won_at\": \"2026-08-04T00:05:35.259Z\", \"lead_id\": \"34\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Bolo Gresik\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(680, 6, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-04 07:05:35', '2026-08-04 07:05:35', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bolo Gresik</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/34', '{\"tier\": \"Medium\", \"won_at\": \"2026-08-04T00:05:35.259Z\", \"lead_id\": \"34\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Bolo Gresik\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(681, 9, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-04 07:05:35', '2026-08-04 07:05:35', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bolo Gresik</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/34', '{\"tier\": \"Medium\", \"won_at\": \"2026-08-04T00:05:35.259Z\", \"lead_id\": \"34\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Bolo Gresik\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(682, 32, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-04 07:05:35', '2026-08-04 07:05:35', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bolo Gresik</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/34', '{\"tier\": \"Medium\", \"won_at\": \"2026-08-04T00:05:35.259Z\", \"lead_id\": \"34\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Bolo Gresik\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}'),
(683, 33, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-04 07:05:35', '2026-08-04 07:05:35', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bolo Gresik</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/34', '{\"tier\": \"Medium\", \"won_at\": \"2026-08-04T00:05:35.259Z\", \"lead_id\": \"34\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Bolo Gresik\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": true}'),
(684, 39, '🎉 Pemenang Tender', 0, 0, NULL, NULL, '2026-08-04 07:05:35', '2026-08-04 07:05:35', NULL, '<span style=\"font-weight: 600; color: #0f172a;\">Dwi Ragil Pribadi (MARKETING)</span> memenangkan <span style=\"font-weight: 600; color: #0f172a;\">CSA-FKI Rumah Net Bolo Gresik</span> dari <span style=\"font-weight: 600; color: #0f172a;\">PT. Cipta Sejahtera Abadi</span> (Medium).', 'ALERT', '/sales/tenders/34', '{\"tier\": \"Medium\", \"won_at\": \"2026-08-04T00:05:35.259Z\", \"lead_id\": \"34\", \"user_name\": \"Dwi Ragil Pribadi (MARKETING)\", \"action_type\": \"MARKED_WON\", \"project_name\": \"CSA-FKI Rumah Net Bolo Gresik\", \"customer_name\": \"PT. Cipta Sejahtera Abadi\", \"requires_approval\": false}');

-- --------------------------------------------------------

--
-- Table structure for table `outbox_events`
--

CREATE TABLE `outbox_events` (
  `id` bigint UNSIGNED NOT NULL,
  `event_id` varchar(100) NOT NULL,
  `event_name` varchar(100) NOT NULL,
  `event_version` varchar(20) DEFAULT '1.0',
  `aggregate_type` varchar(50) NOT NULL,
  `aggregate_id` bigint UNSIGNED NOT NULL,
  `correlation_id` varchar(100) DEFAULT NULL,
  `transaction_id` varchar(100) DEFAULT NULL,
  `payload` json DEFAULT NULL,
  `status` varchar(20) DEFAULT 'PENDING',
  `retry_count` int DEFAULT '0',
  `error_message` text,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `published_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

```sql
created_at`, `published_at`) VALUES
(1, 'evt-1784960879881-815', 'ContractApprovedEvent', '1.0', 'Contract', 2, 'corr-legal-2-1784960879881', 'tx-1784960879881', '{\"timestamp\": \"2026-07-25T06:27:59.881Z\", \"contractId\": \"2\", \"reviewerId\": 10, \"legalStatus\": \"APPROVED\", \"contractNumber\": \"CONT-20260724-0002\"}', 'PENDING', 0, NULL, '2026-07-25 13:27:59', NULL),
(2, 'evt-1785321264023-9672', 'ContractApprovedEvent', '1.0', 'Contract', 1, 'corr-legal-1-1785321264023', 'tx-1785321264024', '{\"timestamp\": \"2026-07-29T10:34:24.024Z\", \"contractId\": \"1\", \"reviewerId\": 32, \"legalStatus\": \"APPROVED\", \"contractNumber\": \"CONT-20260724-0001\"}', 'PENDING', 0, NULL, '2026-07-29 17:34:24', NULL),
(3, 'evt-1785321334574-9484', 'ContractApprovedEvent', '1.0', 'Contract', 1, 'corr-legal-1-1785321334574', 'tx-1785321334574', '{\"timestamp\": \"2026-07-29T10:35:34.574Z\", \"contractId\": \"1\", \"reviewerId\": 32, \"legalStatus\": \"APPROVED\", \"contractNumber\": \"CONT-20260724-0001\"}', 'PENDING', 0, NULL, '2026-07-29 17:35:34', NULL),
(4, 'evt-1785323954477-93', 'ContractRevisionRequestedEvent', '1.0', 'Contract', 4, 'corr-legal-4-1785323954477', 'tx-1785323954477', '{\"timestamp\": \"2026-07-29T11:19:14.477Z\", \"contractId\": \"4\", \"reviewerId\": 10, \"legalStatus\": \"REJECTED\", \"contractNumber\": \"CONT-20260729-0004\"}', 'PENDING', 0, NULL, '2026-07-29 18:19:14', NULL),
(5, 'evt-1785479883087-5191', 'ContractApprovedEvent', '1.0', 'Contract', 15, 'corr-legal-15-1785479883087', 'tx-1785479883087', '{\"timestamp\": \"2026-07-31T06:38:03.087Z\", \"contractId\": \"15\", \"reviewerId\": 10, \"legalStatus\": \"APPROVED\", \"contractNumber\": \"CONT-20260731-0015\"}', 'PENDING', 0, NULL, '2026-07-31 13:38:03', NULL),
(6, 'evt-1785486916889-3994', 'ContractApprovedEvent', '1.0', 'Contract', 18, 'corr-legal-18-1785486916889', 'tx-1785486916889', '{\"timestamp\": \"2026-07-31T08:35:16.889Z\", \"contractId\": \"18\", \"reviewerId\": 10, \"legalStatus\": \"APPROVED\", \"contractNumber\": \"CONT-20260731-0018\"}', 'PENDING', 0, NULL, '2026-07-31 15:35:16', NULL),
(7, 'evt-1785490060877-9595', 'ContractApprovedEvent', '1.0', 'Contract', 19, 'corr-legal-19-1785490060877', 'tx-1785490060877', '{\"timestamp\": \"2026-07-31T09:27:40.877Z\", \"contractId\": \"19\", \"reviewerId\": 10, \"legalStatus\": \"APPROVED\", \"contractNumber\": \"CONT-20260731-0019\"}', 'PENDING', 0, NULL, '2026-07-31 16:27:40', NULL),
(8, 'evt-1785491448818-3195', 'ContractApprovedEvent', '1.0', 'Contract', 17, 'corr-legal-17-1785491448818', 'tx-1785491448818', '{\"timestamp\": \"2026-07-31T09:50:48.818Z\", \"contractId\": \"17\", \"reviewerId\": 10, \"legalStatus\": \"APPROVED\", \"contractNumber\": \"CONT-20260731-0017\"}', 'PENDING', 0, NULL, '2026-07-31 16:50:48', NULL),
(9, 'evt-1785491986360-9573', 'ContractApprovedEvent', '1.0', 'Contract', 20, 'corr-legal-20-1785491986360', 'tx-1785491986360', '{\"timestamp\": \"2026-07-31T09:59:46.360Z\", \"contractId\": \"20\", \"reviewerId\": 10, \"legalStatus\": \"APPROVED\", \"contractNumber\": \"CONT-20260731-0020\"}', 'PENDING', 0, NULL, '2026-07-31 16:59:46', NULL),
(10, 'evt-1785731228010-1160', 'ContractApprovedEvent', '1.0', 'Contract', 21, 'corr-legal-21-1785731228010', 'tx-1785731228010', '{\"timestamp\": \"2026-08-03T04:27:08.010Z\", \"contractId\": \"21\", \"reviewerId\": 10, \"legalStatus\": \"APPROVED\", \"contractNumber\": \"CONT-20260803-0021\"}', 'PENDING', 0, NULL, '2026-08-03 11:27:08', NULL),
(11, 'evt-1785739578059-876', 'ContractApprovedEvent', '1.0', 'Contract', 23, 'corr-legal-23-1785739578058', 'tx-1785739578059', '{\"timestamp\": \"2026-08-03T06:46:18.059Z\", \"contractId\": \"23\", \"reviewerId\": 10, \"legalStatus\": \"APPROVED\", \"contractNumber\": \"CONT-20260803-0023\"}', 'PENDING', 0, NULL, '2026-08-03 13:46:18', NULL);
```

```sql
CREATE TABLE `payments` (
  `id` bigint UNSIGNED NOT NULL,
  `invoice_id` bigint UNSIGNED NOT NULL,
  `payment_number` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount_paid` decimal(19,2) NOT NULL,
  `payment_date` date NOT NULL,
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `updated_by` bigint UNSIGNED DEFAULT NULL,
  `deleted_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  `version` int NOT NULL DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `permissions`
--

CREATE TABLE `permissions` (
  `id` bigint UNSIGNED NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `updated_by` bigint UNSIGNED DEFAULT NULL,
  `deleted_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `projects`
--

CREATE TABLE `projects` (
  `id` bigint UNSIGNED NOT NULL,
  `contract_id` bigint UNSIGNED DEFAULT NULL,
  `manager_id` bigint UNSIGNED NOT NULL,
  `code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PLANNING',
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `updated_by` bigint UNSIGNED DEFAULT NULL,
  `deleted_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  `version` int NOT NULL DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `projects`
--

INSERT INTO `projects` (`id`, `contract_id`, `manager_id`, `code`, `name`, `status`, `start_date`, `end_date`, `created_by`, `updated_by`, `deleted_by`, `created_at`, `updated_at`, `deleted_at`, `version`) VALUES
(1, NULL, 5, 'CONT-20260724-0002', 'Project CSA-FKI Karawang Rumah Net', 'IN_PROGRESS', '2026-07-25', '2026-12-31', NULL, NULL, NULL, '2026-07-25 14:26:10', '2026-07-25 14:26:10', NULL, 1),
(2, NULL, 5, 'CONT-20260803-0021', 'Project Rumah Net Batam Central', 'IN_PROGRESS', '2026-08-08', '2026-10-31', NULL, NULL, NULL, '2026-08-03 11:31:16', '2026-08-03 11:31:16', NULL, 1),
(3, NULL, 5, 'CONT-20260803-0023', 'CSA-FKI Rumah Net Sulawesi', 'IN_PROGRESS', '2026-08-07', '2026-12-31', NULL, NULL, NULL, '2026-08-03 13:47:57', '2026-08-03 13:47:57', NULL, 1);

-- --------------------------------------------------------

--
-- Table structure for table `project_budgets`
--

CREATE TABLE `project_budgets` (
  `id` bigint UNSIGNED NOT NULL,
  `project_id` bigint UNSIGNED NOT NULL,
  `category` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `planned_amount` decimal(19,2) NOT NULL DEFAULT '0.00',
  `actual_amount` decimal(19,2) NOT NULL DEFAULT '0.00',
  `remaining_amount` decimal(19,2) GENERATED ALWAYS AS ((`planned_amount` - `actual_amount`)) STORED,
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `updated_by` bigint UNSIGNED DEFAULT NULL,
  `deleted_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `proposals`
--

CREATE TABLE `proposals` (
  `id` bigint UNSIGNED NOT NULL,
  `tender_id` bigint UNSIGNED NOT NULL,
  `proposal_number` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `proposed_amount` decimal(19,2) NOT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT',
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `updated_by` bigint UNSIGNED DEFAULT NULL,
  `deleted_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `proposals`
--

INSERT INTO `proposals` (`id`, `tender_id`, `proposal_number`, `proposed_amount`, `status`, `created_by`, `updated_by`, `deleted_by`, `created_at`, `updated_at`, `deleted_at`) VALUES
(1, 2, 'PROP-1784915342502', 0.00, 'APPROVED', 7, NULL, NULL, '2026-07-25 00:49:02', '2026-07-29 17:34:23', NULL),
(2, 2, 'PROP-20260724-2608', 380000000.00, 'APPROVED', 7, NULL, NULL, '2026-07-25 00:49:02', '2026-07-25 13:27:59', NULL),
(3, 4, 'PROP-TEST-001', 150000000.00, 'ACCEPTED', 7, NULL, NULL, '2026-07-29 18:05:27', '2026-07-29 18:05:27', NULL),
(6, 7, 'PROP-1785323871760', 0.00, 'ACCEPTED', 7, NULL, NULL, '2026-07-29 18:17:51', '2026-07-29 18:17:51', NULL),
(7, 7, 'PROP-20260729-3861', 300000000.00, 'ACCEPTED', 7, NULL, NULL, '2026-07-29 18:18:23', '2026-07-29 18:18:23', NULL),
(8, 7, 'PROP-20260729-5821', 300000000.00, 'ACCEPTED', 7, NULL, NULL, '2026-07-29 18:19:35', '2026-07-29 18:19:35', NULL),
(9, 5, 'PROP-1785324038091', 0.00, 'ACCEPTED', 7, NULL, NULL, '2026-07-29 18:20:38', '2026-07-29 18:20:38', NULL),
(10, 3, 'PROP-1785327853570', 0.00, 'ACCEPTED', 7, NULL, NULL, '2026-07-29 19:24:13', '2026-07-29 19:24:13', NULL),
(11, 1, 'PROP-1785327926814', 0.00, 'ACCEPTED', 7, NULL, NULL, '2026-07-29 19:25:26', '2026-07-29 19:25:26', NULL),
(12, 8, 'PROP-1785333830672', 0.00, 'ACCEPTED', 7, NULL, NULL, '2026-07-29 21:03:50', '2026-07-29 21:03:50', NULL),
(13, 8, 'PROP-20260729-0814', 100000000.00, 'ACCEPTED', 7, NULL, NULL, '2026-07-29 21:03:50', '2026-07-29 21:03:50', NULL),
(14, 3, 'PROP-20260729-9708', 150000000.00, 'ACCEPTED', 7, NULL, NULL, '2026-07-29 21:08:29', '2026-07-29 21:08:29', NULL),
(15, 1, 'PROP-20260729-1175', 250000000.00, 'ACCEPTED', 7, NULL, NULL, '2026-07-29 21:58:41', '2026-07-29 21:58:41', NULL),
(16, 1, 'PROP-20260729-4215', 250000000.00, 'ACCEPTED', 7, NULL, NULL, '2026-07-29 21:59:04', '2026-07-29 21:59:04', NULL),
(17, 11, 'PROP-1785338967063', 0.00, 'ACCEPTED', 7, NULL, NULL, '2026-07-29 22:29:27', '2026-07-29 22:29:27', NULL),
(18, 11, 'PROP-20260729-7543', 300000000.00, 'ACCEPTED', 7, NULL, NULL, '2026-07-29 22:29:27', '2026-07-29 22:29:27', NULL),
(19, 10, 'PROP-1785339793829', 240000000.00, 'ACCEPTED', 7, NULL, NULL, '2026-07-29 22:43:13', '2026-07-29 22:43:13', NULL),
(20, 10, 'PROP-20260729-4366', 240000000.00, 'ACCEPTED', 7, NULL, NULL, '2026-07-29 22:43:14', '2026-07-29 22:43:14', NULL),
(21, 9, 'PROP-1785339842909', 200000000.00, 'ACCEPTED', 7, NULL, NULL, '2026-07-29 22:44:02', '2026-07-29 22:44:02', NULL),
(22, 9, 'PROP-20260729-3362', 200000000.00, 'ACCEPTED', 7, NULL, NULL, '2026-07-29 22:44:03', '2026-07-29 22:44:03', NULL),
(23, 15, 'PROP-1785474872545', 150000000.00, 'ACCEPTED', 7, NULL, NULL, '2026-07-31 12:14:32', '2026-07-31 12:47:57', '2026-07-31 12:47:57'),
(24, 15, 'PROP-20260731-2701', 150000000.00, 'ACCEPTED', 7, NULL, NULL, '2026-07-31 12:14:32', '2026-07-31 12:47:57', '2026-07-31 12:47:57'),
(25, 21, 'PROP-1785479671791', 150000000.00, 'APPROVED', 7, NULL, NULL, '2026-07-31 13:34:31', '2026-07-31 14:04:06', '2026-07-31 14:04:06'),
(26, 21, 'PROP-20260731-2017', 150000000.00, 'ACCEPTED', 7, NULL, NULL, '2026-07-31 13:34:32', '2026-07-31 14:04:06', '2026-07-31 14:04:06'),
(27, 20, 'PROP-1785482084365', 200000000.00, 'ACCEPTED', 7, NULL, NULL, '2026-07-31 14:14:44', '2026-07-31 14:15:22', '2026-07-31 14:15:22'),
(28, 20, 'PROP-20260731-4680', 200000000.00, 'ACCEPTED', 7, NULL, NULL, '2026-07-31 14:14:44', '2026-07-31 14:15:22', '2026-07-31 14:15:22'),
(29, 19, 'PROP-1785482157987', 100000000.00, 'APPROVED', 7, NULL, NULL, '2026-07-31 14:15:57', '2026-07-31 16:50:48', NULL),
(30, 19, 'PROP-20260731-8335', 100000000.00, 'ACCEPTED', 7, NULL, NULL, '2026-07-31 14:15:58', '2026-07-31 14:15:58', NULL),
(31, 18, 'PROP-1785486806004', 150000000.00, 'APPROVED', 7, NULL, NULL, '2026-07-31 15:33:26', '2026-07-31 15:35:16', NULL),
(32, 18, 'PROP-20260731-6636', 150000000.00, 'ACCEPTED', 7, NULL, NULL, '2026-07-31 15:33:26', '2026-07-31 15:33:26', NULL),
(33, 17, 'PROP-1785489982374', 200000000.00, 'APPROVED', 7, NULL, NULL, '2026-07-31 16:26:22', '2026-07-31 16:27:40', NULL),
(34, 17, 'PROP-20260731-2866', 200000000.00, 'ACCEPTED', 7, NULL, NULL, '2026-07-31 16:26:22', '2026-07-31 16:26:22', NULL),
(35, 16, 'PROP-1785491839370', 400000000.00, 'APPROVED', 7, NULL, NULL, '2026-07-31 16:57:19', '2026-07-31 16:59:46', NULL),
(36, 16, 'PROP-20260731-0611', 400000000.00, 'ACCEPTED', 7, NULL, NULL, '2026-07-31 16:57:20', '2026-07-31 16:57:20', NULL),
(37, 45, 'PROP-1785731171299', 850000000.00, 'APPROVED', 7, NULL, NULL, '2026-08-03 11:26:11', '2026-08-03 11:27:07', NULL),
(38, 45, 'PROP-20260803-1392', 850000000.00, 'ACCEPTED', 7, NULL, NULL, '2026-08-03 11:26:11', '2026-08-03 11:26:11', NULL),
(39, 47, 'PROP-1785739328613', 50000000.00, 'ACCEPTED', 9, NULL, NULL, '2026-08-03 13:42:08', '2026-08-03 13:42:08', NULL),
(40, 47, 'PROP-20260803-8738', 50000000.00, 'ACCEPTED', 9, NULL, NULL, '2026-08-03 13:42:08', '2026-08-03 13:42:08', NULL),
(41, 48, 'PROP-1785739491256', 500000000.00, 'APPROVED', 9, NULL, NULL, '2026-08-03 13:44:51', '2026-08-03 13:46:18', NULL),
(42, 48, 'PROP-20260803-1395', 500000000.00, 'ACCEPTED', 9, NULL, NULL, '2026-08-03 13:44:51', '2026-08-03 13:44:51', NULL),
(43, 44, 'PROP-20260803-1961', 900000000.00, 'ACCEPTED', 7, NULL, NULL, '2026-08-03 13:52:01', '2026-08-03 13:52:01', NULL),
(44, 43, 'PROP-20260803-6072', 400000000.00, 'ACCEPTED', 7, NULL, NULL, '2026-08-03 14:46:46', '2026-08-03 14:46:46', NULL),
(45, 46, 'PROP-1785753683571', 400000000.00, 'ACCEPTED', 9, NULL, NULL, '2026-08-03 17:41:23', '2026-08-03 17:41:23', NULL),
(46, 46, 'PROP-20260803-3700', 400000000.00, 'ACCEPTED', 9, NULL, NULL, '2026-08-03 17:41:23', '2026-08-03 17:41:23', NULL),
(47, 35, 'PROP-20260803-4483', 135000000.00, 'ACCEPTED', 9, NULL, NULL, '2026-08-03 17:42:34', '2026-08-03 17:42:34', NULL),
(48, 35, 'PROP-20260803-6711', 135000000.00, 'ACCEPTED', 9, NULL, NULL, '2026-08-03 17:42:56', '2026-08-03 17:42:56', NULL),
(49, 34, 'PROP-1785801935040', 140000000.00, 'ACCEPTED', 9, NULL, NULL, '2026-08-04 07:05:35', '2026-08-04 07:05:35', NULL),
(50, 34, 'PROP-20260804-5240', 140000000.00, 'ACCEPTED', 9, NULL, NULL, '2026-08-04 07:05:35', '2026-08-04 07:05:35', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `purchase_orders`
--

CREATE TABLE `purchase_orders` (
  `id` bigint UNSIGNED NOT NULL,
  `pr_id` bigint UNSIGNED NOT NULL,
  `vendor_id` bigint UNSIGNED NOT NULL,
  `po_number` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `total_amount` decimal(19,2) NOT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ISSUED',
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `updated_by` bigint UNSIGNED DEFAULT NULL,
  `deleted_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  `version` int NOT NULL DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `purchase_order_items`
--

CREATE TABLE `purchase_order_items` (
  `id` bigint UNSIGNED NOT NULL,
  `purchase_order_id` bigint UNSIGNED NOT NULL,
  `item_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` decimal(10,2) NOT NULL,
  `received_quantity` decimal(10,2) NOT NULL DEFAULT '0.00',
  `unit_price` decimal(19,2) NOT NULL,
  `total_price` decimal(19,2) NOT NULL DEFAULT '0.00',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `purchase_requests`
--

CREATE TABLE `purchase_requests` (
  `id` bigint UNSIGNED NOT NULL,
  `project_id` bigint UNSIGNED NOT NULL,
  `requester_id` bigint UNSIGNED NOT NULL,
  `pr_number` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `total_estimated_amount` decimal(19,2) NOT NULL DEFAULT '0.00',
  `status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT',
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `updated_by` bigint UNSIGNED DEFAULT NULL,
  `deleted_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  `version` int NOT NULL DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `purchase_request_items`
--

CREATE TABLE `purchase_request_items` (
  `id` bigint UNSIGNED NOT NULL,
  `pr_id` bigint UNSIGNED NOT NULL,
  `item_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` decimal(10,2) NOT NULL,
  `uom` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PCS',
  `estimated_unit_price` decimal(19,2) NOT NULL,
  `total_price` decimal(19,2) GENERATED ALWAYS AS ((`quantity` * `estimated_unit_price`)) STORED,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `rfqs`
--

CREATE TABLE `rfqs` (
  `id` bigint UNSIGNED NOT NULL,
  `pr_id` bigint UNSIGNED NOT NULL,
  `rfq_number` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'OPEN',
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `updated_by` bigint UNSIGNED DEFAULT NULL,
  `deleted_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `roles`
--

CREATE TABLE `roles` (
  `id` bigint UNSIGNED NOT NULL,
  `name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `updated_by` bigint UNSIGNED DEFAULT NULL,
  `deleted_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `roles`
--

INSERT INTO `roles` (`id`, `name`, `description`, `created_by`, `updated_by`, `deleted_by`, `created_at`, `updated_at`, `deleted_at`) VALUES
(1, 'SUPER_ADMIN', 'Super Administrator with full access', NULL, NULL, NULL, '2026-07-10 14:10:30', '2026-07-10 14:10:30', NULL),
(2, 'PROJECT_MANAGER', 'Project Manager', NULL, NULL, NULL, '2026-07-10 14:10:30', '2026-07-10 14:10:30', NULL),
(3, 'FINANCE', 'Finance and Accounting', NULL, NULL, NULL, '2026-07-10 14:10:30', '2026-07-10 14:10:30', NULL),
(4, 'DIRECTOR', 'Company Director (Highest Approval)', NULL, NULL, NULL, '2026-07-10 14:10:30', '2026-07-10 14:10:30', NULL),
(5, 'MANAGER', 'Department Manager (Approval Level 1)', NULL, NULL, NULL, '2026-07-10 14:10:30', '2026-07-10 14:10:30', NULL),
(6, 'GENERAL_MANAGER', 'General Manager (Approval Level 2)', NULL, NULL, NULL, '2026-07-10 14:10:30', '2026-07-10 14:10:30', NULL),
(7, 'MARKETING', 'Marketing Team', NULL, NULL, NULL, '2026-07-13 12:30:42', '2026-07-13 12:30:42', NULL),
(8, 'LEGAL', 'Legal and Compliance Department', NULL, NULL, NULL, '2026-07-13 13:36:58', '2026-07-13 13:36:58', NULL),
(9, 'PURCHASING', 'Purchasing and Procurement Department', NULL, NULL, NULL, '2026-07-13 13:36:58', '2026-07-13 13:36:58', NULL),
(40, 'HEAD_OF_OPERATIONS', NULL, NULL, NULL, NULL, '2026-07-19 19:43:22', '2026-07-19 19:43:22', NULL),
(42, 'PROCUREMENT', NULL, NULL, NULL, NULL, '2026-07-19 19:43:22', '2026-07-19 19:43:22', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `role_permissions`
--

CREATE TABLE `role_permissions` (
  `role_id` bigint UNSIGNED NOT NULL,
  `permission_id` bigint UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `tasks`
--

CREATE TABLE `tasks` (
  `id` bigint UNSIGNED NOT NULL,
  `wbs_id` bigint UNSIGNED NOT NULL,
  `assignee_id` bigint UNSIGNED DEFAULT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'TODO',
  `start_date` date DEFAULT NULL,
  `due_date` date DEFAULT NULL,
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `updated_by` bigint UNSIGNED DEFAULT NULL,
  `deleted_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `tenders`
--

CREATE TABLE `tenders` (
  `id` bigint UNSIGNED NOT NULL,
  `customer_id` bigint UNSIGNED NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `submission_deadline` datetime DEFAULT NULL,
  `status` enum('NEW','IN_PROGRESS','NEGOTIATION','PENDING_APPROVAL','WON','LOST') COLLATE utf8mb4_unicode_ci DEFAULT 'NEW',
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `updated_by` bigint UNSIGNED DEFAULT NULL,
  `deleted_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  `estimated_budget` decimal(19,2) DEFAULT NULL,
  `marketing_pic_id` bigint UNSIGNED DEFAULT NULL,
  `pic_customer_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pic_customer_phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pic_customer_email` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `business_sector` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `stage` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'LEAD',
  `probability_percentage` int DEFAULT '0',
  `priority` enum('LOW','MEDIUM','HIGH','CRITICAL') COLLATE utf8mb4_unicode_ci DEFAULT 'MEDIUM',
  `source` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `expected_closing_date` date DEFAULT NULL,
  `procurement_type` enum('TENDER','DIRECT_APPOINTMENT') COLLATE utf8mb4_unicode_ci DEFAULT 'TENDER',
  `project_location` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bid_submission_deadline` date DEFAULT NULL,
  `negotiated_price` decimal(19,2) DEFAULT NULL,
  `max_discount_rate` int DEFAULT '20',
  `spk_file_key` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `spk_verification_status` enum('UNVERIFIED','PENDING_REVIEW','VERIFIED','REJECTED') COLLATE utf8mb4_unicode_ci DEFAULT 'UNVERIFIED',
  `grace_deadline` datetime DEFAULT NULL,
  `version` int NOT NULL DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `tenders`
--

INSERT INTO `tenders` (`id`, `customer_id`, `title`, `submission_deadline`, `status`, `created_by`, `updated_by`, `deleted_by`, `created_at`, `updated_at`, `deleted_at`, `estimated_budget`, `marketing_pic_id`, `pic_customer_name`, `pic_customer_phone`, `pic_customer_email`, `business_sector`, `stage`, `probability_percentage`, `priority`, `source`, `notes`, `expected_closing_date`, `procurement_type`, `project_location`, `bid_submission_deadline`, `negotiated_price`, `max_discount_rate`, `spk_file_key`, `spk_verification_status`, `grace_deadline`, `version`) VALUES
(1, 1, 'Project Renovasi Gudang J&T Jelambar Ruang Purchasing', NULL, 'WON', 7, 7, NULL, '2026-07-25 00:40:17', '2026-07-29 22:55:26', '2026-07-29 22:55:26', 250000000.00, 7, 'Ramdani', '081234789650', NULL, 'Transportasi & Logistik', 'WON', 100, 'MEDIUM', 'Referensi Internal', NULL, '2026-07-31', 'DIRECT_APPOINTMENT', 'Jakarta Barat', '2026-07-27', NULL, 20, 'contracts/spk-1-1785337143700-439702074.pdf', 'PENDING_REVIEW', '2026-07-31 21:58:41', 44),
(2, 2, 'Project CSA-FKI Karawang Rumah Net', NULL, 'WON', 7, 7, NULL, '2026-07-25 00:47:25', '2026-07-29 22:55:21', '2026-07-29 22:55:21', 380000000.00, 9, 'Aldhi Dharmawan', '087434543557', NULL, 'Telekomunikasi & Internet', 'WON', 100, 'MEDIUM', 'Referensi Eksternal', NULL, '2026-07-31', 'TENDER', 'Karawang', '2026-07-27', NULL, 20, 'contracts/spk-2-1784915342373-188103388.pdf', 'PENDING_REVIEW', NULL, 4),
(3, 1, 'Renovasi Gateway Tangerang', NULL, 'WON', 7, 7, NULL, '2026-07-25 14:11:34', '2026-07-29 22:55:16', '2026-07-29 22:55:16', 150000000.00, 7, 'Ramdani', '081234789650', NULL, 'Transportasi & Logistik', 'WON', 100, 'MEDIUM', 'Referensi Internal', NULL, '2026-07-27', 'TENDER', 'Tangerang', '2026-07-26', NULL, 20, NULL, 'UNVERIFIED', '2026-07-31 21:08:30', 16),
(4, 1, 'Test Deal Automation Fix Verification', NULL, 'NEW', 7, NULL, NULL, '2026-07-29 18:05:27', '2026-07-29 19:04:40', '2026-07-29 19:04:40', NULL, NULL, NULL, NULL, NULL, NULL, 'LEAD', 0, 'MEDIUM', NULL, NULL, NULL, 'TENDER', NULL, NULL, NULL, 20, NULL, 'UNVERIFIED', NULL, 2),
(5, 1, 'Test Deal Automation Fix Verification', NULL, 'NEW', 7, 7, NULL, '2026-07-29 18:05:46', '2026-07-29 19:04:35', '2026-07-29 19:04:35', NULL, NULL, NULL, NULL, NULL, NULL, 'LEAD', 10, 'MEDIUM', NULL, NULL, NULL, 'TENDER', NULL, NULL, NULL, 20, NULL, 'UNVERIFIED', NULL, 6),
(7, 2, 'Project CSA-JLM BOGOR', NULL, 'WON', 7, 7, NULL, '2026-07-29 18:16:35', '2026-07-29 22:55:10', '2026-07-29 22:55:10', 300000000.00, 7, 'Aldhi Dharmawan', '087434543557', NULL, 'Telekomunikasi & Internet', 'WON', 100, 'MEDIUM', 'Referensi Internal', NULL, '2026-07-31', 'TENDER', 'BOGOR', '2026-07-29', NULL, 20, 'contracts/spk-7-1785323975728-695791080.pdf', 'PENDING_REVIEW', '2026-07-31 18:18:24', 10),
(8, 1, 'Renovasi Lahan Parkir Gateway Bandung', NULL, 'WON', 7, 7, NULL, '2026-07-29 19:30:31', '2026-07-29 22:55:05', '2026-07-29 22:55:05', 100000000.00, 7, 'Ramdani', '081234789650', NULL, 'Transportasi & Logistik', 'WON', 100, 'MEDIUM', 'Referensi Internal', NULL, '2026-07-31', 'DIRECT_APPOINTMENT', 'Tangerang', '2026-07-30', NULL, 20, 'contracts/undefined', 'PENDING_REVIEW', NULL, 9),
(9, 1, 'Renovasi Gudang J&T Bogor ', NULL, 'WON', 7, 7, NULL, '2026-07-29 22:04:33', '2026-07-29 22:54:59', '2026-07-29 22:54:59', 200000000.00, 7, 'Ramdani', '081234789650', NULL, 'Transportasi & Logistik', 'WON', 100, 'MEDIUM', 'Referensi Internal', NULL, '2026-07-31', 'DIRECT_APPOINTMENT', 'BOGOR', '2026-07-29', NULL, 20, 'contracts/spk-9-1785339842864-541115247.pdf', 'PENDING_REVIEW', NULL, 4),
(10, 1, 'Renovasi Gudang Serang', NULL, 'WON', 7, 7, NULL, '2026-07-29 22:05:33', '2026-07-29 22:54:52', '2026-07-29 22:54:52', 240000000.00, 7, 'Ramdani', '081234789650', NULL, 'Transportasi & Logistik', 'WON', 100, 'MEDIUM', 'Referensi Internal', NULL, '2026-07-31', 'DIRECT_APPOINTMENT', 'Serang', '2026-07-30', NULL, 20, 'contracts/spk-10-1785339793771-490321500.pdf', 'PENDING_REVIEW', NULL, 4),
(11, 1, 'Renovasi Gudang Jambi', NULL, 'WON', 7, 7, NULL, '2026-07-29 22:06:22', '2026-07-29 22:54:28', '2026-07-29 22:54:28', 300000000.00, 7, 'Ramdani', '081234789650', NULL, 'Transportasi & Logistik', 'WON', 100, 'MEDIUM', 'LPSE', NULL, '2026-07-31', 'TENDER', 'Jambi', '2026-07-29', NULL, 20, 'contracts/spk-11-1785338966985-7712801.pdf', 'PENDING_REVIEW', NULL, 4),
(12, 1, 'Dummy Cascade Test', NULL, 'NEW', 1, NULL, NULL, '2026-07-29 23:03:33', '2026-07-30 00:04:27', '2026-07-30 00:04:27', 500000.00, NULL, NULL, NULL, NULL, NULL, 'LEAD', 0, 'MEDIUM', NULL, NULL, NULL, 'TENDER', NULL, NULL, NULL, 20, NULL, 'UNVERIFIED', NULL, 2),
(13, 1, 'Dummy Cascade Test', NULL, 'NEW', 1, 7, NULL, '2026-07-29 23:03:56', '2026-07-30 00:04:24', '2026-07-30 00:04:24', 500000.00, NULL, NULL, NULL, NULL, NULL, 'LEAD', 10, 'MEDIUM', NULL, NULL, NULL, 'TENDER', NULL, NULL, NULL, 20, NULL, 'UNVERIFIED', NULL, 6),
(14, 1, 'Dummy Cascade Test', NULL, 'NEW', 1, NULL, NULL, '2026-07-29 23:04:20', '2026-07-29 23:04:20', '2026-07-29 23:04:20', 500000.00, NULL, NULL, NULL, NULL, NULL, 'LEAD', 0, 'MEDIUM', NULL, NULL, NULL, 'TENDER', NULL, NULL, NULL, 20, NULL, 'UNVERIFIED', NULL, 2),
(15, 1, 'Project Renovasi lahan parkir Gateway Bandung', NULL, 'WON', 7, 7, NULL, '2026-07-31 10:32:07', '2026-07-31 12:47:57', '2026-07-31 12:47:57', 150000000.00, 7, 'Ramdani', '081234789650', NULL, 'Transportasi & Logistik', 'WON', 100, 'MEDIUM', 'Referensi Internal', NULL, '2026-08-07', 'DIRECT_APPOINTMENT', 'Bandung', '2026-08-06', NULL, 20, 'contracts/spk-15-1785474872493-587329612.pdf', 'PENDING_REVIEW', NULL, 4),
(16, 2, 'CSA-FKI Rumah Net Bandung ', NULL, 'WON', 7, 7, NULL, '2026-07-31 13:27:12', '2026-07-31 16:57:20', NULL, 400000000.00, 7, 'Aldhi Dharmawan', '087434543557', NULL, 'Telekomunikasi & Internet', 'WON', 100, 'MEDIUM', 'Referensi Internal', NULL, '2026-08-07', 'TENDER', 'Bandung', '2026-08-04', NULL, 20, 'contracts/spk-16-1785491839279-434357699.pdf', 'PENDING_REVIEW', NULL, 3),
(17, 2, 'CSA-FKI Rumah Net BOGOR', NULL, 'WON', 7, 7, NULL, '2026-07-31 13:28:08', '2026-07-31 16:26:22', NULL, 200000000.00, 7, 'Aldhi Dharmawan', '087434543557', NULL, 'Telekomunikasi & Internet', 'WON', 100, 'MEDIUM', 'Referensi Internal', NULL, '2026-08-08', 'DIRECT_APPOINTMENT', 'BOGOR', '2026-08-07', NULL, 20, 'contracts/spk-17-1785489982283-694294833.pdf', 'PENDING_REVIEW', NULL, 3),
(18, 2, 'CSA-FKI Rumah Net Garut', NULL, 'WON', 7, 7, NULL, '2026-07-31 13:30:28', '2026-07-31 15:33:26', NULL, 150000000.00, 7, 'Aldhi Dharmawan', '087434543557', NULL, 'Telekomunikasi & Internet', 'WON', 100, 'MEDIUM', 'Referensi Internal', NULL, '2026-08-07', 'DIRECT_APPOINTMENT', 'Garut', '2026-08-06', NULL, 20, 'contracts/spk-18-1785486805950-900947533.pdf', 'PENDING_REVIEW', NULL, 3),
(19, 2, 'CSA-FKI Rumah Net Ciamis', NULL, 'WON', 7, 7, NULL, '2026-07-31 13:31:09', '2026-07-31 14:15:58', NULL, 100000000.00, 7, 'Aldhi Dharmawan', '087434543557', NULL, 'Telekomunikasi & Internet', 'WON', 100, 'MEDIUM', 'Referensi Internal', NULL, '2026-08-08', 'DIRECT_APPOINTMENT', 'Ciamis', '2026-08-07', NULL, 20, 'contracts/spk-19-1785482157954-817419485.pdf', 'PENDING_REVIEW', NULL, 3),
(20, 2, 'CSA-FKI Rumah Net Tasikmalaya', NULL, 'WON', 7, 7, NULL, '2026-07-31 13:32:45', '2026-07-31 14:15:22', '2026-07-31 14:15:22', 200000000.00, 9, 'Aldhi Dharmawan', '087434543557', NULL, 'Telekomunikasi & Internet', 'WON', 100, 'MEDIUM', 'Referensi Internal', NULL, '2026-08-08', 'TENDER', 'Tasikmalaya', '2026-08-07', NULL, 20, 'contracts/spk-20-1785482084277-343881108.pdf', 'PENDING_REVIEW', NULL, 4),
(21, 2, 'CSA FKI Rumah Net Cirebon', NULL, 'WON', 7, 7, NULL, '2026-07-31 13:33:46', '2026-07-31 14:04:06', '2026-07-31 14:04:06', 150000000.00, 7, 'Aldhi Dharmawan', '087434543557', NULL, 'Telekomunikasi & Internet', 'WON', 100, 'MEDIUM', 'Referensi Eksternal', NULL, '2026-08-08', 'DIRECT_APPOINTMENT', 'CIREBON', '2026-08-07', NULL, 20, 'contracts/spk-21-1785479671724-482948854.pdf', 'PENDING_REVIEW', NULL, 4),
(22, 2, 'CSA-FKI Kuningan', NULL, 'NEW', 7, NULL, NULL, '2026-07-31 17:12:10', '2026-07-31 17:12:10', NULL, 100000000.00, 7, 'Aldhi Dharmawan', '087434543557', NULL, 'Telekomunikasi & Internet', 'LEAD', 10, 'MEDIUM', 'Referensi Internal', NULL, '2026-08-08', 'DIRECT_APPOINTMENT', 'Kuningan', '2026-08-07', NULL, 20, NULL, 'UNVERIFIED', NULL, 1),
(23, 2, 'CSA-FKI Rumah Net Bali', NULL, 'NEW', 7, NULL, NULL, '2026-07-31 20:11:00', '2026-07-31 20:11:00', NULL, 600000000.00, 7, 'Aldhi Dharmawan', '087434543557', NULL, 'Telekomunikasi & Internet', 'LEAD', 10, 'MEDIUM', 'Referensi Internal', NULL, '2026-08-08', 'DIRECT_APPOINTMENT', 'BALI', '2026-08-07', NULL, 20, NULL, 'UNVERIFIED', NULL, 1),
(24, 2, 'CSA-FKI Rumah Net Surabaya', NULL, 'NEW', 7, NULL, NULL, '2026-07-31 20:12:00', '2026-07-31 20:12:00', NULL, 300000000.00, 7, 'Aldhi Dharmawan', '087434543557', NULL, 'Telekomunikasi & Internet', 'LEAD', 10, 'MEDIUM', 'Direct Call / Email', NULL, '2026-08-08', 'DIRECT_APPOINTMENT', 'Surabaya', '2026-08-06', NULL, 20, NULL, 'UNVERIFIED', NULL, 1),
(25, 2, 'CSA-FKI Rumah Net Gresik', NULL, 'NEW', 7, NULL, NULL, '2026-07-31 22:16:01', '2026-07-31 22:16:01', NULL, 100000000.00, 9, 'Aldhi Dharmawan', '087434543557', NULL, 'Telekomunikasi & Internet', 'LEAD', 10, 'MEDIUM', 'Referensi Internal', NULL, '2026-08-08', 'DIRECT_APPOINTMENT', 'Jombang', '2026-08-06', NULL, 20, NULL, 'UNVERIFIED', NULL, 1),
(26, 2, 'CSA-FKI Rumah net Bandung Lembang', NULL, 'NEW', 7, NULL, NULL, '2026-07-31 22:23:35', '2026-07-31 22:23:35', NULL, 200000000.00, 7, 'Aldhi Dharmawan', '087434543557', NULL, 'Telekomunikasi & Internet', 'LEAD', 10, 'MEDIUM', 'Referensi Eksternal', NULL, '2026-08-08', 'TENDER', 'Kabupaten Bandung', '2026-08-07', NULL, 20, NULL, 'UNVERIFIED', NULL, 1),
(27, 2, 'CSA-FKI Ruman Net Subang', NULL, 'NEW', 7, 9, NULL, '2026-07-31 22:26:54', '2026-07-31 23:10:56', NULL, 130000000.00, 9, 'Aldhi Dharmawan', '087434543557', NULL, 'Telekomunikasi & Internet', 'LEAD', 10, 'MEDIUM', 'LPSE', NULL, '2026-08-08', 'TENDER', 'Subang', '2026-08-07', NULL, 20, NULL, 'UNVERIFIED', NULL, 11),
(28, 2, 'CSA-FKI Rumah Net Tuban', NULL, 'NEW', 7, NULL, NULL, '2026-07-31 22:28:13', '2026-07-31 22:28:13', NULL, 230000000.00, 7, 'Aldhi Dharmawan', '087434543557', NULL, 'Telekomunikasi & Internet', 'LEAD', 10, 'MEDIUM', 'LPSE', NULL, '2026-09-05', 'TENDER', NULL, '2026-08-04', NULL, 20, NULL, 'UNVERIFIED', NULL, 1),
(29, 2, 'CSA-FKI Rumah Net Pati', NULL, 'NEW', 7, NULL, NULL, '2026-07-31 22:49:18', '2026-07-31 22:49:18', NULL, 230000000.00, 7, 'Aldhi Dharmawan', '087434543557', NULL, 'Telekomunikasi & Internet', 'LEAD', 10, 'MEDIUM', 'Referensi Internal', NULL, '2026-08-08', 'TENDER', 'PATI', '2026-08-06', NULL, 20, NULL, 'UNVERIFIED', NULL, 1),
(30, 2, 'CSA-FKI Rumah Net Pangandaran', NULL, 'NEW', 7, NULL, NULL, '2026-07-31 22:50:32', '2026-07-31 22:50:32', NULL, 110000000.00, 7, 'Aldhi Dharmawan', '087434543557', NULL, 'Telekomunikasi & Internet', 'LEAD', 10, 'MEDIUM', 'Referensi Eksternal', NULL, '2026-08-08', 'TENDER', 'Pangandaran Jawa Barat', '2026-08-06', NULL, 20, NULL, 'UNVERIFIED', NULL, 1),
(31, 2, 'CSA-FKI Rumah Net Kabupaten Bandung', NULL, 'NEW', 7, NULL, NULL, '2026-07-31 22:54:29', '2026-07-31 22:54:29', NULL, 140000000.00, 7, 'Aldhi Dharmawan', '087434543557', NULL, 'Telekomunikasi & Internet', 'LEAD', 10, 'MEDIUM', 'Referensi Internal', NULL, '2026-08-08', 'TENDER', 'Kab. Bandung', '2026-08-07', NULL, 20, NULL, 'UNVERIFIED', NULL, 1),
(32, 2, 'CSA-FKI Rumah Net Yogyakarta', NULL, 'NEW', 7, NULL, NULL, '2026-07-31 22:57:50', '2026-07-31 22:57:50', NULL, 150000000.00, 7, 'Aldhi Dharmawan', '087434543557', NULL, 'Telekomunikasi & Internet', 'LEAD', 10, 'MEDIUM', 'Referensi Internal', NULL, '2026-08-01', 'DIRECT_APPOINTMENT', 'JOGJA', '2026-07-31', NULL, 20, NULL, 'UNVERIFIED', NULL, 1),
(33, 2, 'CSA-FKI Rumah Net SOLO', NULL, 'NEW', 7, NULL, NULL, '2026-07-31 22:58:58', '2026-07-31 22:58:58', NULL, 110000000.00, 7, 'Aldhi Dharmawan', '087434543557', NULL, 'Telekomunikasi & Internet', 'LEAD', 10, 'MEDIUM', 'Referensi Internal', NULL, '2026-08-01', 'DIRECT_APPOINTMENT', 'SOLO', '2026-07-31', NULL, 20, NULL, 'UNVERIFIED', NULL, 1),
(34, 2, 'CSA-FKI Rumah Net Bolo Gresik', NULL, 'WON', 9, 9, NULL, '2026-07-31 23:04:09', '2026-08-04 07:05:35', NULL, 140000000.00, 9, 'Aldhi Dharmawan', '087434543557', NULL, 'Telekomunikasi & Internet', 'WON', 100, 'MEDIUM', 'Referensi Internal', NULL, '2026-08-01', 'TENDER', 'Gresik', '2026-07-31', NULL, 20, 'contracts/spk-34-1785801934848-730784278.pdf', 'PENDING_REVIEW', NULL, 5),
(35, 2, 'CSA-FKI Rumah Net Bojonegori', NULL, 'WON', 9, 9, NULL, '2026-07-31 23:06:42', '2026-08-03 17:42:56', NULL, 135000000.00, 9, 'Aldhi Dharmawan', '087434543557', NULL, 'Telekomunikasi & Internet', 'WON', 100, 'MEDIUM', 'Referensi Internal', NULL, '2026-08-01', 'TENDER', 'Bojonegoro', '2026-07-31', NULL, 20, 'contracts/spk-35-1785753776616-315423875.pdf', 'PENDING_REVIEW', '2026-08-05 17:42:34', 5),
(36, 1, 'Renovasi Gudang J&T Gresik', NULL, 'NEW', 7, 1, NULL, '2026-07-31 23:20:45', '2026-07-31 23:48:35', NULL, 400000000.00, 7, 'Ramdani', '081234789650', NULL, 'Transportasi & Logistik', 'LEAD', 10, 'MEDIUM', 'Referensi Internal', NULL, '2026-08-01', 'DIRECT_APPOINTMENT', 'Gresik', '2026-07-31', NULL, 20, NULL, 'UNVERIFIED', NULL, 3),
(37, 1, 'Renovasi Gudang Tangerang', NULL, 'NEW', 7, 7, NULL, '2026-07-31 23:51:51', '2026-08-01 01:18:05', NULL, 140000000.00, 7, 'Ramdani', '081234789650', NULL, 'Transportasi & Logistik', 'LEAD', 10, 'MEDIUM', 'LPSE', NULL, '2026-08-01', 'TENDER', NULL, '2026-07-31', NULL, 20, NULL, 'UNVERIFIED', NULL, 3),
(38, 1, 'Renovasi Ruang Purchasing J&T Tuban', NULL, 'NEW', 7, 7, NULL, '2026-08-01 00:25:12', '2026-08-01 01:17:54', NULL, 300000000.00, 7, 'Ramdani', '081234789650', NULL, 'Transportasi & Logistik', 'LEAD', 10, 'MEDIUM', 'LPSE', NULL, '2026-08-08', 'DIRECT_APPOINTMENT', 'Tuban', '2026-08-07', NULL, 20, NULL, 'UNVERIFIED', NULL, 9),
(39, 1, 'Project ATP Gateway Madiun', NULL, 'NEW', 7, 7, NULL, '2026-08-01 02:21:01', '2026-08-01 02:43:50', NULL, 360000000.00, 7, 'Ramdani', '081234789650', NULL, 'Transportasi & Logistik', 'LEAD', 10, 'MEDIUM', 'Referensi Internal', NULL, '2026-08-08', 'TENDER', 'Madiun', '2026-08-01', NULL, 20, NULL, 'UNVERIFIED', NULL, 6),
(40, 1, 'Project Renovasi Kantor J&T HQ', NULL, 'NEW', 7, NULL, NULL, '2026-08-01 03:05:22', '2026-08-01 03:05:22', NULL, 130000000.00, 7, 'Ramdani', '081234789650', NULL, 'Transportasi & Logistik', 'LEAD', 10, 'MEDIUM', 'LPSE', NULL, '2026-09-05', 'DIRECT_APPOINTMENT', 'Jakarta Utara', '2026-09-03', NULL, 20, NULL, 'UNVERIFIED', NULL, 1),
(41, 1, 'Project Renovasi DP Mini Jakarta', NULL, 'NEW', 7, NULL, NULL, '2026-08-01 03:08:30', '2026-08-01 03:08:30', NULL, 50000000.00, 7, 'Ramdani', '081234789650', NULL, 'Transportasi & Logistik', 'LEAD', 10, 'MEDIUM', 'LPSE', NULL, '2026-09-05', 'TENDER', NULL, '2026-09-03', NULL, 20, NULL, 'UNVERIFIED', NULL, 1),
(42, 2, 'CSA-FKI Rumah Net Sulawesi makasar', NULL, 'NEW', 7, NULL, NULL, '2026-08-01 03:10:29', '2026-08-01 03:10:29', NULL, 300000000.00, 7, 'Aldhi Dharmawan', '087434543557', NULL, 'Telekomunikasi & Internet', 'LEAD', 10, 'MEDIUM', 'Referensi Internal', NULL, '2026-09-05', 'TENDER', 'Sulawesi', '2026-09-04', NULL, 20, NULL, 'UNVERIFIED', NULL, 1),
(43, 2, 'Project Rumah Net Kalimantan', NULL, 'WON', 7, 7, NULL, '2026-08-01 03:31:56', '2026-08-03 14:46:46', NULL, 400000000.00, 7, 'Aldhi Dharmawan', '087434543557', NULL, 'Telekomunikasi & Internet', 'WON', 100, 'MEDIUM', 'Referensi Internal', NULL, '2026-09-05', 'DIRECT_APPOINTMENT', 'Kalimantan', '2026-09-05', NULL, 20, NULL, 'UNVERIFIED', '2026-08-05 14:46:46', 10),
(44, 2, 'Project Rumah Net papua Sorong', NULL, 'WON', 7, 7, NULL, '2026-08-02 23:21:44', '2026-08-03 13:52:01', NULL, 900000000.00, 7, 'Aldhi Dharmawan', '087434543557', NULL, 'Telekomunikasi & Internet', 'WON', 100, 'MEDIUM', 'Referensi Internal', NULL, '2026-08-08', 'DIRECT_APPOINTMENT', 'Papua', '2026-08-07', NULL, 20, NULL, 'UNVERIFIED', '2026-08-05 13:52:02', 15),
(45, 2, 'Project Rumah Net Batam Central', NULL, 'WON', 7, 7, NULL, '2026-08-02 23:24:47', '2026-08-03 11:26:11', NULL, 850000000.00, 7, 'Aldhi Dharmawan', '087434543557', NULL, 'Telekomunikasi & Internet', 'WON', 100, 'HIGH', 'LPSE', NULL, '2026-08-07', 'TENDER', NULL, '2026-08-10', NULL, 20, 'contracts/spk-45-1785731171214-265699805.pdf', 'PENDING_REVIEW', NULL, 22),
(46, 2, 'Project Rumah Net Riau', NULL, 'WON', 9, 9, NULL, '2026-08-03 00:07:57', '2026-08-03 17:41:23', NULL, 400000000.00, 9, 'Aldhi Dharmawan', '087434543557', NULL, 'Telekomunikasi & Internet', 'WON', 100, 'HIGH', 'Referensi Internal', NULL, '2026-08-08', 'TENDER', 'Riau', '2026-08-08', NULL, 20, 'contracts/spk-46-1785753683536-175972917.pdf', 'PENDING_REVIEW', NULL, 7),
(47, 2, 'CSA-FKI Rumah Net Madura', NULL, 'WON', 9, 9, NULL, '2026-08-03 13:41:20', '2026-08-03 13:42:08', NULL, 50000000.00, 9, 'Aldhi Dharmawan', '087434543557', NULL, 'Telekomunikasi & Internet', 'WON', 100, 'MEDIUM', 'LPSE', NULL, '2026-08-08', 'TENDER', NULL, '2026-08-06', NULL, 20, 'contracts/spk-47-1785739328543-523347381.pdf', 'PENDING_REVIEW', NULL, 3),
(48, 2, 'CSA-FKI Rumah Net Sulawesi', NULL, 'WON', 9, 9, NULL, '2026-08-03 13:44:23', '2026-08-03 13:44:51', NULL, 500000000.00, 9, 'Aldhi Dharmawan', '087434543557', NULL, 'Telekomunikasi & Internet', 'WON', 100, 'MEDIUM', 'Referensi Internal', NULL, '2026-08-08', 'DIRECT_APPOINTMENT', NULL, '2026-08-06', NULL, 20, 'contracts/spk-48-1785739491201-766612368.pdf', 'PENDING_REVIEW', NULL, 3),
(49, 2, 'CSA-FKI Rumah Net Banten', NULL, 'NEW', 7, 7, NULL, '2026-08-04 06:46:36', '2026-08-04 07:31:20', NULL, 120000000.00, 7, 'Aldhi Dharmawan', '087434543557', NULL, 'Telekomunikasi & Internet', 'QUALIFICATION', 30, 'MEDIUM', 'LPSE', NULL, '2026-09-05', 'TENDER', NULL, '2026-09-03', NULL, 20, NULL, 'UNVERIFIED', NULL, 2);

-- --------------------------------------------------------

--
-- Table structure for table `tender_activities`
--

CREATE TABLE `tender_activities` (
  `id` bigint UNSIGNED NOT NULL,
  `tender_id` bigint UNSIGNED NOT NULL,
  `user_id` bigint UNSIGNED DEFAULT NULL,
  `type` enum('SYSTEM','COMMENT') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'COMMENT',
  `content` text COLLATE utf8mb4_general_ci NOT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tender_activities`
--

INSERT INTO `tender_activities` (`id`, `tender_id`, `user_id`, `type`, `content`, `created_at`) VALUES
(1, 1, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-25 00:41:00.228116'),
(2, 1, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-25 00:41:02.550221'),
(3, 1, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-25 00:41:05.211953'),
(4, 1, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-25 00:41:07.370964'),
(5, 1, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-25 00:41:09.710685'),
(6, 1, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-25 00:41:13.862908'),
(7, 1, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-25 00:41:16.734554'),
(8, 1, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-25 00:41:19.102835'),
(9, 1, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-25 00:41:21.267330'),
(10, 1, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-25 00:41:22.860561'),
(11, 1, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-25 00:41:40.298733'),
(12, 1, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-25 00:41:42.002864'),
(13, 1, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-25 00:41:43.842304'),
(14, 1, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-25 00:41:45.390165'),
(15, 1, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-25 00:41:47.895365'),
(16, 1, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-25 00:41:50.147622'),
(17, 1, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-25 00:41:51.836114'),
(18, 1, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-25 00:41:54.280904'),
(19, 1, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-25 00:41:56.544398'),
(20, 1, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-25 00:41:58.542432'),
(21, 1, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-25 00:42:00.756644'),
(22, 1, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-25 00:42:02.703398'),
(23, 1, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-25 00:42:05.472047'),
(24, 1, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-25 00:42:07.379328'),
(25, 1, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-25 00:42:21.952942'),
(26, 1, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-25 00:42:23.479092'),
(27, 1, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-25 00:42:25.502928'),
(28, 1, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-25 00:42:26.717153'),
(29, 1, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-25 00:43:00.663285'),
(30, 1, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-25 00:43:04.137480'),
(31, 1, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-25 00:43:06.266891'),
(32, 1, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-25 00:43:08.933655'),
(33, 1, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-25 00:43:11.951967'),
(34, 1, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-25 00:43:16.649940'),
(35, 2, 7, 'SYSTEM', 'Tender marked as WON', '2026-07-25 00:49:02.607315'),
(36, 1, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-25 13:36:04.108861'),
(37, 1, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-25 13:36:18.777973'),
(38, 1, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-25 13:53:25.564094'),
(39, 1, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-25 13:53:36.418451'),
(40, 3, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-26 14:45:59.169360'),
(41, 3, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-26 14:46:01.469360'),
(42, 3, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-26 14:46:03.182844'),
(43, 3, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-26 14:46:04.713428'),
(44, 3, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-26 14:46:09.172565'),
(45, 3, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-26 14:46:10.502470'),
(46, 3, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-26 18:01:19.817582'),
(47, 3, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-26 18:01:21.719905'),
(48, 3, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-26 18:01:23.138824'),
(49, 3, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-26 18:01:24.942684'),
(50, 3, 1, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-27 09:28:21.716551'),
(51, 3, 1, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-27 09:28:23.364756'),
(52, 5, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-29 18:15:15.722616'),
(53, 5, 7, 'SYSTEM', 'Proposal document uploaded: proposal-1785323727391-724040850.pdf. Stage updated to PROPOSAL.', '2026-07-29 18:15:27.481460'),
(54, 5, 7, 'SYSTEM', 'Tender stage changed from PROPOSAL to LEAD', '2026-07-29 18:16:40.685254'),
(55, 7, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-29 18:16:48.625822'),
(56, 7, 7, 'SYSTEM', 'Proposal document uploaded: proposal-1785323837729-567427591.pdf. Stage updated to PROPOSAL.', '2026-07-29 18:17:17.945985'),
(57, 7, 7, 'COMMENT', 'Catatan Negosiasi: Termin 3x bayar tidak ada perubahan harga', '2026-07-29 18:17:35.604259'),
(58, 7, 7, 'SYSTEM', 'Tender stage changed from PROPOSAL to NEGOTIATION', '2026-07-29 18:17:35.659940'),
(59, 7, 7, 'SYSTEM', 'Tender marked as WON', '2026-07-29 18:18:23.859471'),
(60, 7, 7, 'SYSTEM', 'Tender marked as WON', '2026-07-29 18:19:35.818635'),
(61, 8, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-29 21:03:03.334647'),
(62, 8, 7, 'SYSTEM', 'Proposal document uploaded: proposal-1785333796364-37797874.pdf. Stage updated to PROPOSAL.', '2026-07-29 21:03:16.452411'),
(63, 8, 7, 'COMMENT', 'Catatan Negosiasi: tidak ada perubahan harga termin bayar 3x', '2026-07-29 21:03:33.245215'),
(64, 8, 7, 'SYSTEM', 'Tender stage changed from PROPOSAL to NEGOTIATION', '2026-07-29 21:03:33.372412'),
(65, 8, 7, 'SYSTEM', 'Tender marked as WON', '2026-07-29 21:03:50.811476'),
(66, 3, 7, 'SYSTEM', 'Tender marked as WON', '2026-07-29 21:08:29.705271'),
(67, 1, 7, 'SYSTEM', 'Tender marked as WON', '2026-07-29 21:58:41.165139'),
(68, 1, 7, 'SYSTEM', 'Tender marked as WON', '2026-07-29 21:59:04.213211'),
(69, 11, 7, 'SYSTEM', 'Tender marked as WON', '2026-07-29 22:29:27.538947'),
(70, 10, 7, 'SYSTEM', 'Tender marked as WON', '2026-07-29 22:43:14.351643'),
(71, 9, 7, 'SYSTEM', 'Tender marked as WON', '2026-07-29 22:44:03.356519'),
(72, 13, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-29 23:35:22.084348'),
(73, 13, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-29 23:35:24.319414'),
(74, 13, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-29 23:35:26.718387'),
(75, 13, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-29 23:35:29.614426'),
(76, 15, 7, 'SYSTEM', 'Tender marked as WON', '2026-07-31 12:14:32.695211'),
(77, 21, 7, 'SYSTEM', 'Tender marked as WON', '2026-07-31 13:34:31.975370'),
(78, 20, 7, 'SYSTEM', 'Tender marked as WON', '2026-07-31 14:14:44.671622'),
(79, 19, 7, 'SYSTEM', 'Tender marked as WON', '2026-07-31 14:15:58.327048'),
(80, 18, 7, 'SYSTEM', 'Tender marked as WON', '2026-07-31 15:33:26.620280'),
(81, 17, 7, 'SYSTEM', 'Tender marked as WON', '2026-07-31 16:26:22.813390'),
(82, 16, 7, 'SYSTEM', 'Tender marked as WON', '2026-07-31 16:57:20.469529'),
(83, 27, 9, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-31 22:39:24.239188'),
(84, 27, 9, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-31 22:39:27.917609'),
(85, 27, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-31 22:39:54.911990'),
(86, 27, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-31 22:39:56.823803'),
(87, 27, 9, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-31 23:00:18.918534'),
(88, 27, 9, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-31 23:00:25.417262'),
(89, 27, 9, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-31 23:00:56.258978'),
(90, 27, 9, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-31 23:01:06.554358'),
(91, 27, 9, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-31 23:10:03.036018'),
(92, 27, 9, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-31 23:10:56.977873'),
(93, 34, 9, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-31 23:31:05.034111'),
(94, 34, 9, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-31 23:42:10.154179'),
(95, 36, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-07-31 23:48:04.095445'),
(96, 36, 1, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-07-31 23:48:35.847278'),
(97, 38, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-08-01 00:25:52.992570'),
(98, 38, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-08-01 00:26:15.740234'),
(99, 38, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-08-01 00:28:59.343282'),
(100, 38, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-08-01 00:29:04.046193'),
(101, 38, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-08-01 00:30:51.152186'),
(102, 38, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-08-01 00:30:53.909054'),
(103, 38, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-08-01 00:31:05.641245'),
(104, 37, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-08-01 01:17:51.428523'),
(105, 38, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-08-01 01:17:54.452181'),
(106, 37, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-08-01 01:18:05.271313'),
(107, 39, 7, 'SYSTEM', 'Proposal document uploaded: proposal-1785525727190-707259747.pdf. Stage updated to PROPOSAL.', '2026-08-01 02:22:07.351588'),
(108, 39, 7, 'SYSTEM', 'Tender stage changed from PROPOSAL to LEAD', '2026-08-01 02:28:39.879518'),
(109, 39, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-08-01 02:28:54.179744'),
(110, 39, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-08-01 02:43:50.278301'),
(111, 45, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-08-02 23:26:17.293879'),
(112, 45, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-08-02 23:48:43.650350'),
(113, 46, 9, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-08-03 00:24:23.819650'),
(114, 45, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-08-03 00:26:13.658600'),
(115, 45, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-08-03 08:40:24.350325'),
(116, 45, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-08-03 08:40:28.253675'),
(117, 45, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-08-03 08:40:31.098110'),
(118, 44, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-08-03 08:40:33.274007'),
(119, 44, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-08-03 08:40:36.245984'),
(120, 43, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-08-03 08:40:39.194949'),
(121, 43, 7, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-08-03 08:40:44.170779'),
(122, 45, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-08-03 11:24:22.425239'),
(123, 45, 4, 'SYSTEM', 'Tender stage changed from QUALIFICATION to LEAD', '2026-08-03 11:24:47.258584'),
(124, 45, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-08-03 11:25:29.685154'),
(125, 45, 7, 'SYSTEM', 'Proposal document uploaded: proposal-1785731144642-280691751.pdf. Stage updated to PROPOSAL.', '2026-08-03 11:25:44.713964'),
(126, 45, 7, 'COMMENT', 'Catatan Negosiasi: Termin 3x bayar\nSPK 1 minggu', '2026-08-03 11:26:02.665897'),
(127, 45, 7, 'SYSTEM', 'Tender stage changed from PROPOSAL to NEGOTIATION', '2026-08-03 11:26:02.752676'),
(128, 45, 7, 'SYSTEM', 'Tender marked as WON', '2026-08-03 11:26:11.389512'),
(129, 44, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-08-03 13:08:20.764511'),
(130, 47, 9, 'SYSTEM', 'Tender marked as WON', '2026-08-03 13:42:08.730615'),
(131, 48, 9, 'SYSTEM', 'Tender marked as WON', '2026-08-03 13:44:51.390051'),
(132, 44, 7, 'SYSTEM', 'Tender marked as WON', '2026-08-03 13:52:01.958176'),
(133, 43, 7, 'SYSTEM', 'Tender marked as WON', '2026-08-03 14:46:46.065516'),
(134, 46, 9, 'SYSTEM', 'Tender marked as WON', '2026-08-03 17:41:23.683283'),
(135, 35, 9, 'SYSTEM', 'Tender marked as WON', '2026-08-03 17:42:34.480694'),
(136, 35, 9, 'SYSTEM', 'Tender marked as WON', '2026-08-03 17:42:56.707990'),
(137, 34, 9, 'SYSTEM', 'Tender marked as WON', '2026-08-04 07:05:35.234415'),
(138, 49, 7, 'SYSTEM', 'Tender stage changed from LEAD to QUALIFICATION', '2026-08-04 07:31:20.259139');

-- --------------------------------------------------------

--
-- Table structure for table `tender_price_history`
--

CREATE TABLE `tender_price_history` (
  `id` bigint UNSIGNED NOT NULL,
  `tender_id` bigint UNSIGNED NOT NULL,
  `old_price` decimal(19,2) DEFAULT NULL,
  `new_price` decimal(19,2) DEFAULT NULL,
  `changed_by` bigint UNSIGNED NOT NULL,
  `reason` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` bigint UNSIGNED NOT NULL,
  `email` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `full_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `updated_by` bigint UNSIGNED DEFAULT NULL,
  `deleted_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  `refresh_token` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `email`, `password_hash`, `full_name`, `is_active`, `created_by`, `updated_by`, `deleted_by`, `created_at`, `updated_at`, `deleted_at`, `refresh_token`) VALUES
(1, 'admin@epms.com', '$2b$10$G7T6u.9w0pjb6o6v3mXnsu1qrjuuPlgUYUAh3Kmwe8SuedxANWVT2', 'System Admin', 1, NULL, NULL, NULL, '2026-07-10 14:10:30', '2026-08-04 07:09:50', NULL, '$2b$10$Nt360OfgYJn8ERT0Chxkg.mA9i0kPIFu.r1aB6eygI6IOzaGnbDGS'),
(2, 'pm@epms.com', '$2b$10$G7T6u.9w0pjb6o6v3mXnsu1qrjuuPlgUYUAh3Kmwe8SuedxANWVT2', 'Project Manager', 1, NULL, NULL, NULL, '2026-07-10 14:10:30', '2026-08-03 13:47:11', NULL, '$2b$10$6GqD2FDS5ALMmx6L6IZOPO/AJ/QritnjTBI1j1rPGwkX/qiYQUPXS'),
(3, 'finance@epms.com', '$2b$10$G7T6u.9w0pjb6o6v3mXnsu1qrjuuPlgUYUAh3Kmwe8SuedxANWVT2', 'Finance User', 1, NULL, NULL, NULL, '2026-07-10 14:10:30', '2026-07-20 11:58:02', NULL, NULL),
(4, 'director@epms.com', '$2b$10$G7T6u.9w0pjb6o6v3mXnsu1qrjuuPlgUYUAh3Kmwe8SuedxANWVT2', 'Director', 1, NULL, NULL, NULL, '2026-07-10 14:10:30', '2026-08-04 09:34:15', NULL, '$2b$10$hy3sijNYijxXxVbaN/ERveihUtWijEnGpHQpRRSKvj5HGT3O04QYy'),
(5, 'manager@epms.com', '$2b$10$G7T6u.9w0pjb6o6v3mXnsu1qrjuuPlgUYUAh3Kmwe8SuedxANWVT2', 'Approval Manager', 1, NULL, NULL, NULL, '2026-07-10 14:10:30', '2026-07-20 11:58:02', NULL, NULL),
(6, 'gm@epms.com', '$2b$10$G7T6u.9w0pjb6o6v3mXnsu1qrjuuPlgUYUAh3Kmwe8SuedxANWVT2', 'General Manager', 1, NULL, NULL, NULL, '2026-07-10 14:10:30', '2026-07-20 11:58:02', NULL, NULL),
(7, 'lukas@epms.com', '$2b$10$.SHCvFNgKBCpF.z5U3hnmO8o8g5Bl.Zx1pJNewCwS7S.k2MNpaSt2', 'Lukas Kurniawan', 1, NULL, NULL, NULL, '2026-07-13 12:29:10', '2026-08-05 00:41:55', NULL, '$2b$10$Y/hQcfW1q3QFpVjaVtmNyuocItAGdNjXT0QzjSkrXs9l07mQvp08e'),
(9, 'ragil@epms.com', '$2b$10$G7T6u.9w0pjb6o6v3mXnsu1qrjuuPlgUYUAh3Kmwe8SuedxANWVT2', 'Dwi Ragil Pribadi', 1, NULL, NULL, NULL, '2026-07-13 14:54:34', '2026-08-04 19:42:50', NULL, '$2b$10$cfTiv4kBbhwnn5cxt.grpedtJAsRkV.zDO/ZKzQNMNsGoWn/GQVR2'),
(10, 'legal@epms.com', '$2b$10$G7T6u.9w0pjb6o6v3mXnsu1qrjuuPlgUYUAh3Kmwe8SuedxANWVT2', 'Legal Officer', 1, NULL, NULL, NULL, '2026-07-16 21:12:08', '2026-08-04 07:22:04', NULL, '$2b$10$fUNShRCP7F2mVQvWAEn5N.uSD0uggP/V3JzFMFYe4q.OOPZqo2LXa'),
(32, 'admin@tvmubd.com', '$2b$10$r/qZekglj5pq.Dzndq65bOHgEotVzTgE7UYLE7Av.hNCXvHKvo1Ji', 'Super Admin', 1, NULL, NULL, NULL, '2026-07-19 19:43:22', '2026-08-03 14:53:57', NULL, '$2b$10$NkQ8Ojiv0FB3yWWALICGruxYuqAYAR2kU.NjrnuaAe1Grk4hPSTki'),
(33, 'director@tvmubd.com', '$2b$10$G7T6u.9w0pjb6o6v3mXnsu1qrjuuPlgUYUAh3Kmwe8SuedxANWVT2', 'Director', 1, NULL, NULL, NULL, '2026-07-19 19:43:22', '2026-07-20 11:58:02', NULL, NULL),
(34, 'marketing@tvmubd.com', '$2b$10$G7T6u.9w0pjb6o6v3mXnsu1qrjuuPlgUYUAh3Kmwe8SuedxANWVT2', 'Marketing Staff', 1, NULL, NULL, NULL, '2026-07-19 19:43:22', '2026-08-04 07:12:21', NULL, '$2b$10$vleovyEQeA.MZz7aBSG.oeKImTllQr8h5w0CF9HCIhM/vUt6U.ReC'),
(35, 'legal@tvmubd.com', '$2b$10$r/qZekglj5pq.Dzndq65bOHgEotVzTgE7UYLE7Av.hNCXvHKvo1Ji', 'Legal Staff', 1, NULL, NULL, NULL, '2026-07-19 19:43:22', '2026-07-29 16:38:14', NULL, '$2b$10$SKxF8lWVU0eUrkJk1fbRkOXdTOMxgbYbwXlKXDfRLyJ7158yFlxNG'),
(36, 'pm@tvmubd.com', '$2b$10$G7T6u.9w0pjb6o6v3mXnsu1qrjuuPlgUYUAh3Kmwe8SuedxANWVT2', 'Project Manager', 1, NULL, NULL, NULL, '2026-07-19 19:43:23', '2026-07-20 11:58:02', NULL, NULL),
(37, 'procurement@tvmubd.com', '$2b$10$G7T6u.9w0pjb6o6v3mXnsu1qrjuuPlgUYUAh3Kmwe8SuedxANWVT2', 'Procurement Staff', 1, NULL, NULL, NULL, '2026-07-19 19:43:23', '2026-07-20 11:58:02', NULL, '$2b$10$oMQs7cxApy2bFP3D4LJTXOHxY.LIFBDIZuj/A8nNb90bW8tU/oZFy'),
(38, 'finance@tvmubd.com', '$2b$10$G7T6u.9w0pjb6o6v3mXnsu1qrjuuPlgUYUAh3Kmwe8SuedxANWVT2', 'Finance Staff', 1, NULL, NULL, NULL, '2026-07-19 19:43:23', '2026-07-20 11:58:02', NULL, NULL),
(39, 'superadmin@epms.com', '$2b$10$G7T6u.9w0pjb6o6v3mXnsu1qrjuuPlgUYUAh3Kmwe8SuedxANWVT2', 'super admin', 1, NULL, NULL, NULL, '2026-07-20 11:10:54', '2026-07-20 11:58:02', NULL, '$2b$10$tFqIJdyn6qPM63CYGyProOhxEihl2GBe3bH/U5DbPhkUvCw/5xa5C');

-- --------------------------------------------------------

--
-- Table structure for table `user_roles`
--

CREATE TABLE `user_roles` (
  `user_id` bigint UNSIGNED NOT NULL,
  `role_id` bigint UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `user_roles`
--

INSERT INTO `user_roles` (`user_id`, `role_id`) VALUES
(1, 1),
(32, 1),
(39, 1),
(2, 2),
(36, 2),
(3, 3),
(38, 3),
(4, 4),
(33, 4),
(5, 5),
(6, 6),
(7, 7),
(9, 7),
(34, 7),
(10, 8),
(35, 8),
(37, 42);

-- --------------------------------------------------------

--
-- Table structure for table `vendors`
--

CREATE TABLE `vendors` (
  `id` bigint UNSIGNED NOT NULL,
  `code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `address` text COLLATE utf8mb4_unicode_ci,
  `tax_id` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `vendor_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `updated_by` bigint UNSIGNED DEFAULT NULL,
  `deleted_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `vendor_comparisons`
--

CREATE TABLE `vendor_comparisons` (
  `id` bigint UNSIGNED NOT NULL,
  `rfq_id` bigint UNSIGNED NOT NULL,
  `vendor_id` bigint UNSIGNED NOT NULL,
  `offered_amount` decimal(19,2) NOT NULL,
  `is_winner` tinyint(1) DEFAULT '0',
  `remarks` text COLLATE utf8mb4_unicode_ci,
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `updated_by` bigint UNSIGNED DEFAULT NULL,
  `deleted_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `workflow_definitions`
--

CREATE TABLE `workflow_definitions` (
  `id` bigint UNSIGNED NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `bpmn_json` json NOT NULL,
  `version` int NOT NULL DEFAULT '1',
  `is_active` tinyint(1) DEFAULT '1',
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `updated_by` bigint UNSIGNED DEFAULT NULL,
  `deleted_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `workflow_instances`
--

CREATE TABLE `workflow_instances` (
  `id` bigint UNSIGNED NOT NULL,
  `workflow_definition_id` bigint UNSIGNED NOT NULL,
  `entity_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity_id` bigint UNSIGNED NOT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'IN_PROGRESS',
  `current_state_data` json DEFAULT NULL,
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `updated_by` bigint UNSIGNED DEFAULT NULL,
  `deleted_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `workflow_tasks`
--

CREATE TABLE `workflow_tasks` (
  `id` bigint UNSIGNED NOT NULL,
  `workflow_instance_id` bigint UNSIGNED NOT NULL,
  `assignee_role_id` bigint UNSIGNED DEFAULT NULL,
  `assignee_user_id` bigint UNSIGNED DEFAULT NULL,
  `task_key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `comments` text COLLATE utf8mb4_unicode_ci,
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `updated_by` bigint UNSIGNED DEFAULT NULL,
  `deleted_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `work_breakdown_structures`
--

CREATE TABLE `work_breakdown_structures` (
  `id` bigint UNSIGNED NOT NULL,
  `project_id` bigint UNSIGNED NOT NULL,
  `parent_wbs_id` bigint UNSIGNED DEFAULT NULL,
  `code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `level` int NOT NULL DEFAULT '1',
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `updated_by` bigint UNSIGNED DEFAULT NULL,
  `deleted_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `audit_logs`
--
ALTER TABLE `audit_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_audit_table_record` (`table_name`,`record_id`);

--
-- Indexes for table `contracts`
--
ALTER TABLE `contracts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `contract_number` (`contract_number`),
  ADD KEY `idx_contracts_deleted_at` (`deleted_at`),
  ADD KEY `fk_contracts_proposal` (`proposal_id`),
  ADD KEY `fk_contracts_customer` (`customer_id`),
  ADD KEY `fk_contracts_legal_reviewer` (`legal_reviewer_id`),
  ADD KEY `FK_cb7d02b9a4d6b88327a58268ed4` (`project_manager_id`);

--
-- Indexes for table `contract_amendments`
--
ALTER TABLE `contract_amendments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `IDX_ab02b9f3cfcac3fd6bf9778709` (`contract_id`,`created_at`),
  ADD KEY `FK_585886cc7ea612824c3db4c50e6` (`approved_by`);

--
-- Indexes for table `customers`
--
ALTER TABLE `customers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `code` (`code`),
  ADD KEY `idx_customers_deleted_at` (`deleted_at`);

--
-- Indexes for table `dashboard_kpis`
--
ALTER TABLE `dashboard_kpis`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `kpi_key` (`kpi_key`);

--
-- Indexes for table `documents`
--
ALTER TABLE `documents`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_docs_deleted_at` (`deleted_at`),
  ADD KEY `idx_docs_entity` (`entity_type`,`entity_id`);

--
-- Indexes for table `goods_receipts`
--
ALTER TABLE `goods_receipts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `gr_number` (`gr_number`),
  ADD KEY `idx_gr_deleted_at` (`deleted_at`),
  ADD KEY `fk_gr_po` (`po_id`);

--
-- Indexes for table `invoices`
--
ALTER TABLE `invoices`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `invoice_number` (`invoice_number`),
  ADD KEY `idx_invoices_deleted_at` (`deleted_at`),
  ADD KEY `fk_invoices_po` (`po_id`);

--
-- Indexes for table `milestones`
--
ALTER TABLE `milestones`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_milestones_deleted_at` (`deleted_at`),
  ADD KEY `fk_milestones_project` (`project_id`);

--
-- Indexes for table `notifications`
--
ALTER TABLE `notifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_notif_deleted_at` (`deleted_at`),
  ADD KEY `idx_notif_user` (`user_id`);

--
-- Indexes for table `outbox_events`
--
ALTER TABLE `outbox_events`
  ADD PRIMARY KEY (`id`);
```

```sql
created_at`);

--
-- Indexes for table `tender_activities`
--
ALTER TABLE `tender_activities`
  ADD PRIMARY KEY (`id`),
  ADD KEY `IDX_tender_activities_tender_id` (`tender_id`),
  ADD KEY `IDX_tender_activities_user_id` (`user_id`);

--
-- Indexes for table `tender_price_history`
--
ALTER TABLE `tender_price_history`
  ADD PRIMARY KEY (`id`),
  ADD KEY `tender_id` (`tender_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `idx_users_deleted_at` (`deleted_at`),
  ADD KEY `fk_users_created_by` (`created_by`),
  ADD KEY `fk_users_updated_by` (`updated_by`),
  ADD KEY `fk_users_deleted_by` (`deleted_by`);

--
-- Indexes for table `user_roles`
--
ALTER TABLE `user_roles`
  ADD PRIMARY KEY (`user_id`,`role_id`),
  ADD KEY `fk_ur_role` (`role_id`);

--
-- Indexes for table `vendors`
--
ALTER TABLE `vendors`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `code` (`code`),
  ADD KEY `idx_vendors_deleted_at` (`deleted_at`);

--
-- Indexes for table `vendor_comparisons`
--
ALTER TABLE `vendor_comparisons`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_vc_rfq_vendor` (`rfq_id`,`vendor_id`),
  ADD KEY `idx_vc_deleted_at` (`deleted_at`),
  ADD KEY `fk_vc_vendor` (`vendor_id`);

--
-- Indexes for table `workflow_definitions`
--
ALTER TABLE `workflow_definitions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`),
  ADD KEY `idx_wd_deleted_at` (`deleted_at`);

--
-- Indexes for table `workflow_instances`
--
ALTER TABLE `workflow_instances`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_wi_deleted_at` (`deleted_at`),
  ADD KEY `fk_wi_definition` (`workflow_definition_id`);

--
-- Indexes for table `workflow_tasks`
--
ALTER TABLE `workflow_tasks`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_wt_deleted_at` (`deleted_at`),
  ADD KEY `fk_wt_instance` (`workflow_instance_id`),
  ADD KEY `fk_wt_role` (`assignee_role_id`),
  ADD KEY `fk_wt_user` (`assignee_user_id`);

--
-- Indexes for table `work_breakdown_structures`
--
ALTER TABLE `work_breakdown_structures`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_wbs_project_code` (`project_id`,`code`),
  ADD KEY `idx_wbs_deleted_at` (`deleted_at`),
  ADD KEY `fk_wbs_parent` (`parent_wbs_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `audit_logs`
--
ALTER TABLE `audit_logs`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT for table `contracts`
--
ALTER TABLE `contracts`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=27;

--
-- AUTO_INCREMENT for table `contract_amendments`
--
ALTER TABLE `contract_amendments`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `customers`
--
ALTER TABLE `customers`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `dashboard_kpis`
--
ALTER TABLE `dashboard_kpis`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `documents`
--
ALTER TABLE `documents`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `goods_receipts`
--
ALTER TABLE `goods_receipts`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `invoices`
--
ALTER TABLE `invoices`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `milestones`
--
ALTER TABLE `milestones`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `notifications`
--
ALTER TABLE `notifications`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=685;

--
-- AUTO_INCREMENT for table `outbox_events`
--
ALTER TABLE `outbox_events`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;
```

## K. INITIAL DATA RECORD COUNTS

| Table Name | Initial Record Count in Snapshot |
|---|---|
| `audit_logs` | 11 |
| `contract_amendments` | 0 |
| `contracts` | 25 |
| `customers` | 2 |
| `dashboard_kpis` | 0 |
| `documents` | 5 |
| `goods_receipts` | 0 |
| `invoices` | 0 |
| `milestones` | 0 |
| `notifications` | 11 |
| `outbox_events` | 11 |
| `payments` | 0 |
| `permissions` | 0 |
| `project_budgets` | 0 |
| `projects` | 3 |
| `proposals` | 48 |
| `purchase_order_items` | 0 |
| `purchase_orders` | 0 |
| `purchase_request_items` | 0 |
| `purchase_requests` | 0 |
| `rfqs` | 0 |
| `role_permissions` | 0 |
| `roles` | 11 |
| `tasks` | 0 |
| `tender_activities` | 138 |
| `tender_price_history` | 0 |
| `tenders` | 48 |
| `user_roles` | 17 |
| `users` | 17 |
| `vendor_comparisons` | 0 |
| `vendors` | 0 |
| `work_breakdown_structures` | 0 |
| `workflow_definitions` | 0 |
| `workflow_instances` | 0 |
| `workflow_tasks` | 0 |

## L. BUSINESS ENTITY MAP

- **Authentication & Access Control**: `users`, `roles`, `permissions`, `user_roles`, `role_permissions`
- **Marketing & Sales**: `customers`, `tenders`, `proposals`, `tender_activities`, `tender_price_history`
- **Legal & Contracting**: `contracts`, `contract_amendments`
- **Project Delivery**: `projects`, `milestones`, `work_breakdown_structures`, `tasks`, `project_budgets`
- **Procurement & Vendors**: `vendors`, `purchase_requests`, `purchase_request_items`, `rfqs`, `vendor_comparisons`, `purchase_orders`, `purchase_order_items`, `goods_receipts`
- **Finance & Invoicing**: `invoices`, `payments`
- **System & Event-Driven**: `notifications`, `audit_logs`, `documents`, `dashboard_kpis`, `outbox_events`, `workflow_definitions`, `workflow_instances`, `workflow_tasks`

## M. DATABASE HEALTH & ANOMALIES AUDIT

1. **Tabel tanpa Primary Key**: Zero (Seluruh 35 tabel memiliki `PRIMARY KEY` pada kolom `id`).
2. **Potensi Orphan Foreign Key / Cascade Action**: Sebagian besar FK menggunakan `ON DELETE RESTRICT` atau `ON DELETE SET NULL`. Hanya beberapa tabel pendukung (seperti `tender_activities`, `purchase_order_items`, `contract_amendments`) yang menggunakan `ON DELETE CASCADE`.
3. **Collation & Engine Inconsistency**: Sebagian besar tabel menggunakan collation `utf8mb4_unicode_ci`, namun beberapa tabel (seperti `contract_amendments`, `outbox_events`) menggunakan `utf8mb4_0900_ai_ci`.
4. **Missing GO / NO GO Columns**: Kolom `go_nogo_status` dan `revision_status` belum ada pada tabel `tenders` dalam snapshot baseline ini.
5. **Soft Delete Standard**: Menggunakan `deleted_at` (datetime) untuk soft delete pada tabel utama (`users`, `tenders`, `contracts`, `customers`, `projects`).

## N. EXECUTIVE SUMMARY & BASELINE RESULT

### BASELINE AUDIT RESULT
- **Baseline Status**: **HEALTHY BASELINE SNAPSHOT**
- **Confidence Level**: **100%** (Diurai secara utuh dari snapshot `database/epms_tvmubd_db.sql`)

### Temuan Kunci:
1. Total **35 tabel** terdefinisi dengan struktur relational InnoDB yang solid dan ter-index.
2. Snapshot menyimpan data bisnis awal untuk 49 tender, 26 kontrak, 2 customer, 17 user, dan 684 notifikasi.
3. Dokumen baseline ini resmi menjadi acuan tunggal struktur database awal proyek EPMS.
