# AI-Native Business Stack — SME Edition
## Engineering & Business Brief v1.0

> **Audience:** Software Engineers, Solution Architects, Product Managers  
> **Purpose:** Complete reference for building an AI-Native ERP for Startups & SMEs  
> **Philosophy:** Traditional ERP = modules → screens → workflow. AI-Native ERP = modules → tools → agents → decisions

---

## Table of Contents

1. [Core Philosophy & Architecture](#1-core-philosophy--architecture)
2. [Shared Data Model (BaseEntity)](#2-shared-data-model-baseentity)
3. [Module 1 — Core / Master Data](#3-module-1--core--master-data)
4. [Module 2 — Finance & Accounting](#4-module-2--finance--accounting)
5. [Module 3 — Sales / CRM](#5-module-3--sales--crm)
6. [Module 4 — Procurement](#6-module-4--procurement)
7. [Module 5 — Inventory / Operations](#7-module-5--inventory--operations)
8. [Module 6 — Project / Task Management](#8-module-6--project--task-management)
9. [Module 7 — HR / People](#9-module-7--hr--people)
10. [Module 8 — Documents & Contracts](#10-module-8--documents--contracts)
11. [Module 9 — Analytics / Intelligence](#11-module-9--analytics--intelligence)
12. [Module 10 — Automation / AI Agents Layer](#12-module-10--automation--ai-agents-layer)
13. [Cross-Module Integration Map](#13-cross-module-integration-map)
14. [API & Security Standards](#14-api--security-standards)
15. [Tech Stack Recommendations](#15-tech-stack-recommendations)
16. [Implementation Phasing](#16-implementation-phasing)
17. [Open Questions for Engineering Team](#17-open-questions-for-engineering-team)

---

## 1. Core Philosophy & Architecture

### 1.1 The Fundamental Shift

Every module in this system must expose its data and operations as **callable tools** — not just UI screens. This makes every business function accessible to AI agents, humans, and external systems through the same interface.

```
Traditional ERP:    User → UI Screen → Business Logic → Database
AI-Native ERP:      Agent/User → Tool Registry → Business Logic → Database
                                        ↕
                               Event Bus (async)
                                        ↕
                              Other Modules / Agents
```

### 1.2 Architectural Layers

| Layer | Components | Responsibility |
|---|---|---|
| **Interface Layer** | Web UI, Mobile, Chat Interface | Human interaction and approval workflows |
| **API Gateway** | REST + GraphQL, Auth, RBAC | Unified access point for humans and agents |
| **AI Orchestration** | Supervisor Agent, Tool Registry, Memory Store | Route tasks, manage agent state and memory |
| **Business Logic** | 10 Module Services | Core ERP rules and process execution |
| **Event Bus** | Kafka / NATS JetStream | Async communication between all services |
| **Data Layer** | PostgreSQL + pgvector, Redis, S3 | Persistence, embeddings, cache, files |
| **Integration Layer** | Webhook manager, External API connectors | Banks, tax APIs, email, payment gateways |

### 1.3 Tool Registry Pattern

Every module registers its operations as tools with a schema the AI can call:

```typescript
// Example tool definition
{
  name: "finance.create_invoice",
  description: "Create a new customer invoice",
  input_schema: {
    customer_id: "UUID",
    line_items: "LineItem[]",
    due_date: "ISO8601 date",
    payment_terms: "string"
  },
  requires_approval: false,
  risk_level: "medium",
  audit_required: true
}
```

> ⚠️ **Critical Rule:** Every tool that mutates data must accept an `idempotency_key`. AI agents may retry failed calls — without idempotency, duplicates will corrupt business data.

---

## 2. Shared Data Model (BaseEntity)

All entities across all modules **must** extend BaseEntity. This is non-negotiable — it enables cross-module AI reasoning, audit trails, and the HITL framework.

```typescript
interface BaseEntity {
  id: UUID                          // globally unique, immutable
  org_id: UUID                      // multi-tenancy isolation
  created_at: Timestamp
  updated_at: Timestamp
  created_by: UUID                  // user_id or agent_id
  updated_by: UUID
  status: string                    // each entity defines valid enum values
  deleted_at: Timestamp | null      // soft delete — never hard delete
  deleted_by: UUID | null
  
  // AI-Native fields — mandatory for all entities
  audit_log: AuditEntry[]           // every state change with actor + reason
  ai_annotations: AIAnnotation[]   // agent notes, flags, confidence scores
  human_approval_status: 
    "not_required" | "pending" | "approved" | "rejected"
  tags: string[]                    // flexible classification for AI retrieval
  embedding_id: UUID | null         // reference to vector DB record
}

interface AuditEntry {
  timestamp: Timestamp
  actor_id: UUID                    // user or agent
  actor_type: "human" | "agent"
  action: string
  old_value: JSON | null
  new_value: JSON | null
  reason: string
  ip_address: string | null
}

interface AIAnnotation {
  agent_id: string
  timestamp: Timestamp
  annotation_type: "flag" | "suggestion" | "warning" | "insight"
  content: string
  confidence_score: number          // 0.0 – 1.0
  resolved: boolean
  resolved_by: UUID | null
}
```

### Database-Level Enforcement

```sql
-- Row-level security on every table
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON invoices
  USING (org_id = current_setting('app.current_org_id')::uuid);

-- All monetary values stored as integer (smallest currency unit)
-- NEVER use FLOAT for money. Use INTEGER (cents/satang) or DECIMAL(19,4)
amount_satang INTEGER NOT NULL  -- ✅ correct
amount FLOAT                    -- ❌ never
```

---

## 3. Module 1 — Core / Master Data

The central hub. All other modules reference entities here — they never duplicate master data.

### 3.1 Entity: Customer

```typescript
interface Customer extends BaseEntity {
  // Identity
  customer_code: string             // auto-generated, unique per org: CUST-000001
  display_name: string
  legal_name: string | null         // for tax documents
  customer_type: "individual" | "company"
  
  // Classification
  industry: string | null
  customer_tier: "standard" | "silver" | "gold" | "enterprise"
  account_manager_id: UUID | null
  
  // Financials
  currency: string                  // ISO 4217, e.g. "THB", "USD"
  credit_limit: integer             // in smallest currency unit
  payment_terms: string             // e.g. "NET30", "NET60", "COD"
  tax_id: string | null
  
  // Contact
  primary_contact_id: UUID | null   // → Contact entity
  billing_address_id: UUID          // → Address entity
  shipping_addresses: UUID[]
  
  // Communication preferences
  preferred_language: string
  do_not_contact: boolean
  communication_channels: ("email" | "phone" | "line" | "sms")[]
  
  // Relationship
  parent_customer_id: UUID | null   // for corporate group hierarchies
}
```

**Business Rules:**
- `customer_code` is auto-generated and immutable after creation
- Duplicate detection: check `tax_id` and `legal_name` (normalized) before creating — prompt user to merge if match found
- Credit limit of 0 = no credit (COD only). Null = unlimited credit
- Soft delete only — customer records are referenced by financial history forever

### 3.2 Entity: Vendor / Supplier

```typescript
interface Vendor extends BaseEntity {
  vendor_code: string               // VND-000001
  display_name: string
  legal_name: string
  vendor_type: "supplier" | "contractor" | "service_provider" | "freelancer"
  
  // Approval
  is_approved: boolean              // must pass approval checklist before PO can be issued
  approved_by: UUID | null
  approved_at: Timestamp | null
  blacklisted: boolean
  blacklist_reason: string | null
  
  // Performance
  rating: number                    // 1.0 – 5.0, computed from GRN quality + delivery + accuracy
  on_time_delivery_rate: number     // 0.0 – 1.0
  quality_rejection_rate: number    // 0.0 – 1.0
  
  // Commercial
  payment_terms: string
  currency: string
  credit_period_days: integer
  bank_details: EncryptedJSON       // encrypted at rest — PII
  tax_id: string
  
  // Operational
  lead_time_days: integer
  minimum_order_value: integer | null
  preferred_contact_id: UUID
}
```

### 3.3 Entity: Product / Service

```typescript
interface Product extends BaseEntity {
  sku: string                       // unique per org, immutable
  name: string
  description: string
  product_type: "physical" | "service" | "digital" | "subscription"
  
  // Pricing (store in smallest currency unit)
  base_price: integer
  currency: string
  pricing_tiers: PricingTier[]      // volume discounts
  
  // Categorization
  category_id: UUID
  brand: string | null
  unit_of_measure: string           // "each", "kg", "hour", "month"
  
  // Inventory (physical products only)
  track_inventory: boolean
  reorder_point: integer | null
  reorder_quantity: integer | null
  preferred_vendor_id: UUID | null
  
  // Tax
  tax_category: string              // links to Tax module configuration
  is_taxable: boolean
  
  // Status
  is_active: boolean
  is_purchasable: boolean
  is_sellable: boolean
}
```

### 3.4 Entity: Employee

```typescript
interface Employee extends BaseEntity {
  employee_id: string               // EMP-000001
  
  // Identity (PII — encrypted at rest)
  full_name: string
  national_id: EncryptedString
  date_of_birth: EncryptedDate
  
  // Employment
  employment_type: "full_time" | "part_time" | "contract" | "intern"
  department_id: UUID
  position_id: UUID
  manager_id: UUID | null
  hire_date: Date
  probation_end_date: Date | null
  termination_date: Date | null
  termination_reason: string | null
  
  // Work
  work_location: "office" | "remote" | "hybrid" | "field"
  work_schedule_id: UUID
  
  // Compensation (PII — encrypted)
  base_salary: EncryptedInteger
  salary_currency: string
  pay_frequency: "monthly" | "bi_weekly" | "weekly"
  bank_account: EncryptedJSON
  tax_id: EncryptedString
}
```

### 3.5 Other Master Entities (Summary)

| Entity | Key Fields | Purpose |
|---|---|---|
| **Asset** | asset_code, name, category, purchase_date, purchase_value, current_value, depreciation_method, location_id, assigned_to | Fixed asset tracking and depreciation |
| **Location** | code, name, location_type (office/warehouse/store), address, parent_location_id, is_active | Physical locations for inventory and HR |
| **Contract** | contract_no, contract_type, party_id, party_type, start_date, end_date, value, renewal_type, document_id | Master contract registry across all modules |
| **Address** | street, city, state, postal_code, country_code, address_type, is_default | Reusable address component |
| **Contact** | full_name, email, phone, job_title, linked_entity_id, linked_entity_type | Contacts for customers, vendors, partners |

### 3.6 Data Deduplication Strategy

```
On CREATE of Customer, Vendor, or Employee:
1. Normalize name: lowercase, strip punctuation, remove common words (Co., Ltd.)
2. Check exact match on: tax_id, email
3. Run fuzzy match (Jaro-Winkler ≥ 0.92) on normalized_name
4. If match found:
   a. Score < 0.95 → warn user, show potential duplicate, allow proceed
   b. Score ≥ 0.95 → block and require user to confirm or merge
5. On merge: audit both records, move all references, soft-delete the duplicate
```

---

## 4. Module 2 — Finance & Accounting

> ⚠️ **Critical:** This module holds the source of truth for all financial data. Errors here have legal and tax consequences. AI agents assist but never bypass accounting rules.

### 4.1 Chart of Accounts Structure

```
Assets (1xxx)
  ├── Current Assets (11xx)
  │   ├── Cash & Cash Equivalents (1100)
  │   ├── Accounts Receivable (1200)
  │   └── Inventory (1300)
  └── Fixed Assets (12xx)
      └── Property, Plant & Equipment (1210)

Liabilities (2xxx)
  ├── Current Liabilities (21xx)
  │   ├── Accounts Payable (2100)
  │   └── Tax Payable (2200)
  └── Long-term Liabilities (22xx)

Equity (3xxx)
  ├── Share Capital (3100)
  └── Retained Earnings (3200)

Revenue (4xxx)
  ├── Sales Revenue (4100)
  └── Service Revenue (4200)

Expenses (5xxx)
  ├── Cost of Goods Sold (5100)
  ├── Salaries & Wages (5200)
  └── Operating Expenses (5300)
```

**Account Entity:**
```typescript
interface Account {
  account_code: string              // immutable
  account_name: string
  account_type: "asset" | "liability" | "equity" | "revenue" | "expense"
  parent_account_id: UUID | null    // max 5 levels deep
  is_header: boolean                // header accounts cannot receive postings
  normal_balance: "debit" | "credit"
  currency: string
  is_active: boolean
  cost_center_required: boolean
}
```

### 4.2 Journal Entry — The Core Principle

```typescript
interface JournalEntry extends BaseEntity {
  entry_no: string                  // JE-2026-000001
  entry_date: Date
  posting_date: Date
  fiscal_period_id: UUID
  reference: string
  description: string
  entry_type: "manual" | "system" | "recurring" | "reversal"
  source_module: string             // "AR" | "AP" | "Payroll" | "Inventory" etc.
  source_document_id: UUID | null
  lines: JournalLine[]
  is_posted: boolean                // once posted: immutable forever
  reversal_of: UUID | null
}

interface JournalLine {
  account_id: UUID
  debit_amount: integer             // in smallest currency unit, always positive
  credit_amount: integer            // in smallest currency unit, always positive
  cost_center_id: UUID | null
  project_id: UUID | null
  description: string
}
```

**Immutable Business Rules:**
- `sum(debit_amount) MUST === sum(credit_amount)` — enforced at service layer before DB write
- Once `is_posted = true`: no edits, no deletes. Corrections via reversing entry only
- Cannot post to a closed fiscal period
- System-generated entries (from AR, AP, Payroll, Inventory) are created automatically — engineers must implement hooks in each module

### 4.3 Accounts Receivable (AR) Cycle

```
Customer Order → Invoice Created → Invoice Sent → Payment Received → Reconciled → Closed

Invoice statuses: draft → sent → partially_paid → fully_paid → overdue → written_off | voided
```

```typescript
interface Invoice extends BaseEntity {
  invoice_no: string                // INV-2026-000001, auto-generated, immutable
  customer_id: UUID
  sales_order_id: UUID | null
  
  issue_date: Date
  due_date: Date
  payment_terms: string
  
  line_items: InvoiceLineItem[]
  subtotal: integer
  discount_amount: integer
  tax_lines: TaxLine[]
  total_amount: integer
  amount_paid: integer
  outstanding_balance: integer      // computed: total - amount_paid
  
  payment_status: "unpaid" | "partial" | "paid" | "overdue"
  currency: string
  exchange_rate: decimal | null     // if foreign currency
  
  // Delivery
  sent_at: Timestamp | null
  sent_via: "email" | "portal" | "print" | null
  viewed_at: Timestamp | null
}
```

**AR Business Rules:**
- `invoice_no` is sequential and immutable after creation
- Tax must be re-calculated server-side on every save — never trust client-submitted tax amount
- Partial payments allowed — `outstanding_balance` updates atomically with each payment
- Overdue status triggered automatically when `due_date < today AND payment_status != "paid"`
- Voiding an invoice requires a reason and creates a reversing Journal Entry automatically

### 4.4 Accounts Payable (AP) Cycle

```
Vendor Bill Received → OCR Extraction → 3-Way Match → Approval → Payment Scheduled → Paid → Reconciled

Bill statuses: draft → pending_match → matched | discrepancy → approved → scheduled → paid
```

**3-Way Match Logic:**
```
Match: Vendor Bill ↔ Purchase Order ↔ Goods Receipt Note

For each line item:
  if |bill_qty - grn_qty| / grn_qty > tolerance_pct → FLAG discrepancy
  if |bill_unit_price - po_unit_price| / po_unit_price > tolerance_pct → FLAG discrepancy

Default tolerance: 2% (configurable per org)
If all lines pass: auto-approve
If any line fails: route to Procurement team with discrepancy report
```

### 4.5 AI Agents — Finance

#### Agent: Cashflow Forecast Agent

| Field | Detail |
|---|---|
| **Trigger** | Daily at 06:00, or on-demand |
| **Input** | Open AR by due date, scheduled AP payments, historical collection rates per customer, bank balances |
| **Actions** | 1. Sum expected AR inflows by week (applying per-customer collection probability). 2. Sum scheduled AP outflows. 3. Apply 13-week rolling forecast. 4. Identify weeks where projected balance < minimum threshold (configurable). 5. Generate best-case / base / worst-case scenarios. |
| **Output** | Cashflow forecast report with weekly breakdown, alert if any week projects negative or below minimum |
| **Human Approval** | No — read-only analysis. Alert sent to Finance Manager for review |

#### Agent: Invoice Matching Agent

| Field | Detail |
|---|---|
| **Trigger** | New payment received in bank feed, or manual payment entry |
| **Input** | Payment amount, date, reference text, payer bank details, open invoices |
| **Actions** | 1. Exact match: amount + reference number → auto-reconcile. 2. Fuzzy match: amount within 1% + payer name similarity > 0.85 → suggest match for human confirmation. 3. No match → flag as unreconciled, alert AR team. |
| **Output** | Reconciliation result — matched or flagged |
| **Human Approval** | Exact match: No. Fuzzy match: Yes — one-click confirmation |

#### Agent: Expense Anomaly Detection Agent

| Field | Detail |
|---|---|
| **Trigger** | Every new expense or vendor bill posted |
| **Input** | Transaction amount, account, vendor, description, historical transactions for same account/vendor |
| **Actions** | 1. Compare amount vs. 3-month average for same account+vendor (flag if > 2 std deviations). 2. Check for duplicates: same vendor + amount + date within 30 days. 3. Check expense policy: category limits per employee role. 4. Add annotation to entity with confidence score. |
| **Output** | Annotation on the transaction, alert to Finance Manager if high confidence anomaly |
| **Human Approval** | No — annotation only. Finance Manager decides to investigate |

---

## 5. Module 3 — Sales / CRM

### 5.1 Lead Lifecycle

```
Capture → New → Contacted → Qualified → [Converted to Opportunity] | Disqualified

Lead sources: web_form, referral, event, cold_outreach, social, import
```

```typescript
interface Lead extends BaseEntity {
  // Identity
  full_name: string
  email: string
  phone: string | null
  company_name: string | null
  job_title: string | null
  
  // Classification
  source: string
  source_detail: string | null      // e.g. campaign name, referrer
  lead_status: "new" | "contacted" | "qualified" | "disqualified" | "converted"
  disqualification_reason: string | null
  
  // Scoring (AI-maintained)
  lead_score: integer               // 0 – 100, computed by Lead Scoring Agent
  score_breakdown: JSON             // factors and weights
  
  // Assignment
  assigned_to: UUID | null
  assigned_at: Timestamp | null
  
  // Activity
  last_contacted_at: Timestamp | null
  next_follow_up_at: Timestamp | null
  
  // Conversion
  converted_at: Timestamp | null
  converted_to_contact_id: UUID | null
  converted_to_account_id: UUID | null
  converted_to_opportunity_id: UUID | null
}
```

### 5.2 Opportunity Pipeline

```
Stages and default win probability:
  Prospecting      10%
  Qualification    20%
  Proposal         40%
  Negotiation      70%
  Closed-Won      100%
  Closed-Lost       0%
```

**Stage Progression Rules:**
- Opportunities move **forward only** — no rolling back. Use Closed-Lost for dead deals
- Re-opened deals = new Opportunity record with reference to original
- Closed-Lost requires `lost_reason` from configurable picklist (mandatory)
- Win/loss data feeds Pipeline Forecast Agent and product roadmap analysis

```typescript
interface Opportunity extends BaseEntity {
  title: string
  account_id: UUID
  primary_contact_id: UUID | null
  
  stage: OpportunityStage
  probability: integer              // 0 – 100, can be manually overridden
  estimated_value: integer
  currency: string
  
  expected_close_date: Date
  actual_close_date: Date | null
  
  lost_reason: string | null        // required if stage = Closed-Lost
  lost_to_competitor: string | null
  
  owner_id: UUID
  team_members: UUID[]
  
  // Links
  quote_ids: UUID[]
  contract_ids: UUID[]
}
```

### 5.3 Quotation Rules

```typescript
interface Quote extends BaseEntity {
  quote_no: string                  // QT-2026-000001
  opportunity_id: UUID | null
  account_id: UUID
  contact_id: UUID | null
  
  valid_until: Date
  line_items: QuoteLineItem[]
  subtotal: integer
  discount_amount: integer
  discount_pct: decimal
  tax_lines: TaxLine[]
  total_amount: integer
  
  status: "draft" | "pending_approval" | "sent" | "accepted" | "rejected" | "expired"
  sent_at: Timestamp | null
  viewed_at: Timestamp | null
  responded_at: Timestamp | null
  
  version: integer                  // v1, v2, v3 — previous versions preserved
  parent_quote_id: UUID | null      // for revised quotes
}
```

**Business Rules:**
- Discount > configurable threshold (default 15%) → `status = pending_approval` → route to Sales Manager → HITL
- `valid_until` expiry: auto-set status to `expired`. Expired quotes cannot be accepted
- Accepted quote → auto-create Sales Order
- All quote versions are preserved. Active version is the highest version with status ≠ expired/rejected

### 5.4 AI Agents — Sales / CRM

#### Agent: Lead Scoring Agent

| Field | Detail |
|---|---|
| **Trigger** | New lead created, or lead data updated |
| **Input** | Lead fields, company firmographic data (can enrich via web search), interaction history |
| **Actions** | 1. Score on: company size fit (20pts), industry fit (20pts), engagement level (20pts), source quality (15pts), budget signals (15pts), timing signals (10pts). 2. Auto-assign to sales rep based on territory + industry rules. 3. Suggest priority next action. |
| **Output** | `lead_score` (0–100), `score_breakdown`, `suggested_next_action` |
| **Human Approval** | No |

#### Agent: Revenue Prediction Agent

| Field | Detail |
|---|---|
| **Trigger** | Weekly Monday 08:00, or on-demand |
| **Input** | All open opportunities with stage, value, probability, close date; historical win rates by rep/industry/deal size |
| **Actions** | 1. Weighted pipeline = sum(value × probability) per rep and total. 2. Adjust probability using historical win rate (ML or weighted average). 3. Compute committed / upside / downside forecast. 4. Identify pipeline gaps vs. monthly/quarterly quota. |
| **Output** | Forecast report per rep and total, gap analysis, pipeline health score |
| **Human Approval** | No — report only |

#### Agent: Upsell / Cross-sell Recommendation Agent

| Field | Detail |
|---|---|
| **Trigger** | Monthly, or when Sales Order is created |
| **Input** | Account purchase history, product catalog, similar customer purchase patterns |
| **Actions** | 1. Identify products commonly bought together with recent purchases. 2. Compare account's product mix against similar accounts. 3. Flag products in catalog not yet purchased by this account. 4. Score recommendations by revenue potential × likelihood. |
| **Output** | Ranked recommendation list added to account's AI annotations, alert to account manager |
| **Human Approval** | No |

#### Agent: Churn Risk Agent

| Field | Detail |
|---|---|
| **Trigger** | Monthly, or when account has no activity > 60 days |
| **Input** | Purchase recency/frequency/value (RFV), support ticket volume, contract renewal date, account age |
| **Actions** | 1. Compute RFV score. 2. Compute churn risk score (0–100). 3. High risk (>70): trigger Customer Success outreach task. 4. Medium risk (40–70): alert account manager. |
| **Output** | Churn risk score on account, task created for CS team if high risk |
| **Human Approval** | No — task creation only, human decides how to respond |

---

## 6. Module 4 — Procurement

### 6.1 Procure-to-Pay Cycle

```
Need identified → Purchase Requisition → Approval → Purchase Order → Sent to Vendor
→ Goods/Service Received (GRN) → Vendor Bill received → 3-Way Match → Payment
```

### 6.2 Purchase Requisition

```typescript
interface PurchaseRequisition extends BaseEntity {
  pr_no: string                     // PR-2026-000001
  requested_by: UUID
  department_id: UUID
  
  line_items: PRLineItem[]
  total_estimated_value: integer
  currency: string
  
  required_by_date: Date
  justification: string
  priority: "low" | "medium" | "high" | "urgent"
  
  status: "draft" | "submitted" | "approved" | "rejected" | "converted" | "cancelled"
  
  // Approval chain
  approval_steps: ApprovalStep[]    // multi-level approval based on value thresholds
  current_approver_id: UUID | null
  rejected_reason: string | null
  
  // Conversion
  po_ids: UUID[]                    // may convert to multiple POs (different vendors)
}
```

**Approval Thresholds (configurable per org):**
```
< 5,000 THB     → Direct Manager approval
5,000–50,000    → Manager + Department Head
50,000–500,000  → Manager + Dept Head + Finance Manager
> 500,000       → Above + CEO / Board approval
```

### 6.3 Purchase Order

```typescript
interface PurchaseOrder extends BaseEntity {
  po_no: string                     // PO-2026-000001
  version: integer                  // amendments create new version
  
  vendor_id: UUID
  pr_id: UUID | null
  contract_id: UUID | null
  
  line_items: POLineItem[]
  subtotal: integer
  tax_amount: integer
  total_amount: integer
  currency: string
  
  delivery_address_id: UUID
  expected_delivery_date: Date
  payment_terms: string
  
  status: "draft" | "sent" | "confirmed" | "partial_received" | "fully_received" | "closed" | "cancelled"
  
  sent_at: Timestamp | null
  confirmed_at: Timestamp | null
  vendor_reference: string | null   // vendor's own PO/order number
}
```

**PO Amendment Rules:**
- Once `status = confirmed`: amendments require new version (PO-001-v2)
- All versions preserved in history
- Amendments that increase value by > threshold require re-approval
- Vendor must re-confirm amended PO before it is active

### 6.4 3-Way Matching Algorithm

```python
def three_way_match(bill, po, grn, tolerance_pct=0.02):
    discrepancies = []
    
    for bill_line in bill.line_items:
        po_line = find_matching_po_line(bill_line, po)
        grn_line = find_matching_grn_line(bill_line, grn)
        
        if not po_line or not grn_line:
            discrepancies.append(DiscrepancyType.LINE_NOT_FOUND)
            continue
        
        # Quantity check: bill qty must not exceed GRN qty
        if bill_line.qty > grn_line.received_qty * (1 + tolerance_pct):
            discrepancies.append(DiscrepancyType.QUANTITY_MISMATCH)
        
        # Price check: bill price vs PO price
        price_variance = abs(bill_line.unit_price - po_line.unit_price) / po_line.unit_price
        if price_variance > tolerance_pct:
            discrepancies.append(DiscrepancyType.PRICE_MISMATCH)
    
    if not discrepancies:
        return MatchResult.PASS  # auto-approve for payment
    else:
        return MatchResult.FAIL, discrepancies  # route to procurement team
```

### 6.5 AI Agents — Procurement

#### Agent: Supplier Risk Analysis Agent

| Field | Detail |
|---|---|
| **Trigger** | New vendor onboarding, monthly review, or on GRN quality issue |
| **Input** | Vendor performance metrics (delivery rate, quality rejection rate, invoice accuracy), financial stability signals, market data |
| **Actions** | 1. Compute composite risk score (0–100). 2. Flag: single-source risk (only one supplier for critical SKU). 3. Flag: vendor concentration risk (>40% of spend to one vendor). 4. Monitor for news/signals of vendor financial distress. 5. Recommend alternate vendors. |
| **Output** | Risk score and breakdown on vendor record, alert to Procurement Manager |
| **Human Approval** | No |

#### Agent: Price Benchmarking Agent

| Field | Detail |
|---|---|
| **Trigger** | When creating PO, or on demand |
| **Input** | Line items with descriptions, historical PO prices for same SKU/vendor, market price data (if external feed available) |
| **Actions** | 1. Compare requested price vs. last 3 PO prices for same SKU. 2. Calculate price trend (increasing/decreasing). 3. Flag if price is > 10% above historical average. 4. Suggest negotiation points. |
| **Output** | Price analysis annotation on PO, saving opportunity estimate |
| **Human Approval** | No |

---

## 7. Module 5 — Inventory / Operations

### 7.1 Stock State Model

```
For every SKU at every Location:

on_hand_qty     = physical stock present
reserved_qty    = committed to open Sales Orders
available_qty   = on_hand - reserved  ← what can actually be sold/used
in_transit_qty  = on open POs, not yet received
reorder_point   = threshold that triggers reorder
```

> ⚠️ **Critical Rule:** `available_qty` must never go negative unless the SKU has `allow_negative_stock = true`. Sales Order allocation must check `available_qty` atomically (use DB-level transaction with SELECT FOR UPDATE).

### 7.2 Stock Movement Entity

Every change in stock **must** create a StockMovement record. Stock is never updated directly.

```typescript
interface StockMovement extends BaseEntity {
  movement_type: 
    "receipt"       // goods received from vendor (GRN)
    | "issue"       // goods issued to Sales Order / Production
    | "transfer"    // between locations/warehouses
    | "adjustment"  // stock count correction
    | "return_in"   // customer return received
    | "return_out"  // return to vendor
    | "write_off"   // damaged / expired stock removal
  
  sku_id: UUID
  from_location_id: UUID | null
  to_location_id: UUID | null
  quantity: integer                 // always positive
  unit_cost: integer                // for valuation
  total_cost: integer
  
  reference_type: "PO" | "SO" | "PR_Transfer" | "Adjustment" | "Manual"
  reference_id: UUID | null
  
  moved_by: UUID
  notes: string | null
  
  // Auto-generated by system:
  resulting_on_hand: integer        // stock level after this movement
  valuation_impact: integer         // journal entry amount
}
```

### 7.3 Inventory Valuation

| Method | Description | When to use |
|---|---|---|
| **FIFO** | First in, first out. Oldest cost used first. | Perishables, items with expiry |
| **AVCO** | Running weighted average cost. Recalculates on every receipt. | Commodities, fungible goods |
| **Specific ID** | Each unit tracked individually with its own cost. | High-value unique items |

> ⚠️ Every stock movement that changes inventory value must automatically create a Journal Entry in Finance. This is a mandatory system-generated entry — engineers must implement this hook.

### 7.4 AI Agents — Inventory

#### Agent: Demand Forecasting Agent

| Field | Detail |
|---|---|
| **Trigger** | Weekly, or when sales velocity changes significantly |
| **Input** | 12-month sales history per SKU, seasonality patterns, confirmed Sales Orders, open Quotes, marketing calendar |
| **Actions** | 1. Apply time-series forecasting (simple exponential smoothing or Prophet). 2. Detect seasonality and adjust. 3. Incorporate pipeline data from CRM (confirmed orders weight 100%, quotes by probability). 4. Compute recommended reorder_point and reorder_qty. 5. Flag slow-moving SKUs (< 1 sale/month for 3 months). 6. Flag dead stock (0 movement > 6 months). |
| **Output** | Updated reorder recommendations per SKU, slow/dead stock report |
| **Human Approval** | No — recommendations only. Procurement Manager approves reorder |

#### Agent: Stockout Prediction Agent

| Field | Detail |
|---|---|
| **Trigger** | Real-time on every stock movement |
| **Input** | Current available_qty, daily sales velocity (30-day average), open Sales Orders (reserved_qty), POs in transit |
| **Actions** | 1. Calculate days-of-stock-remaining = available_qty / daily_velocity. 2. If days_remaining < vendor lead_time_days + safety_buffer → trigger reorder alert. 3. Check if open PO will arrive in time. If not → escalate urgency. |
| **Output** | Alert to Procurement + Operations, urgency-flagged reorder recommendation |
| **Human Approval** | Alert: No. Auto-create PO: configurable (on/off per org) |

---

## 8. Module 6 — Project / Task Management

### 8.1 Project Entity

```typescript
interface Project extends BaseEntity {
  project_code: string              // PROJ-2026-001
  name: string
  description: string
  
  project_type: "internal" | "client" | "capex" | "r_and_d"
  client_account_id: UUID | null
  linked_sales_order_id: UUID | null
  linked_contract_id: UUID | null
  
  status: "planning" | "active" | "on_hold" | "completed" | "cancelled"
  
  start_date: Date
  end_date: Date
  actual_start_date: Date | null
  actual_end_date: Date | null
  
  project_manager_id: UUID
  team_member_ids: UUID[]
  
  // Budget (links to Finance)
  budget_amount: integer
  currency: string
  cost_center_id: UUID              // Finance cost center for journal entries
  actual_cost: integer              // computed from approved Time Entries + POs
  committed_cost: integer           // open POs linked to this project
  
  // Health (AI-maintained)
  health_status: "green" | "amber" | "red"
  schedule_performance_index: decimal  // SPI = earned_value / planned_value
  cost_performance_index: decimal      // CPI = earned_value / actual_cost
}
```

### 8.2 Milestone → Invoice Trigger

```
Milestone marked complete → [If is_billable = true] → 
  System creates DRAFT Invoice in Finance module →
  Finance Manager reviews and approves →
  Invoice sent to client
```

> ⚠️ The milestone billing trigger must be implemented as a cross-module event, not a direct function call. Finance module subscribes to `project.milestone.completed` event on the event bus.

### 8.3 Time Entry Rules

```typescript
interface TimeEntry extends BaseEntity {
  employee_id: UUID
  project_id: UUID
  task_id: UUID | null
  
  date: Date
  hours: decimal                    // in 0.25h increments (15-min minimum)
  description: string
  
  is_billable: boolean
  billing_rate: integer | null      // override rate, else use project/client rate
  
  status: "draft" | "submitted" | "approved" | "rejected"
  approved_by: UUID | null
}
```

**Business Rules:**
- Time entries allowed for current week and prior week only
- Historical correction (> 1 week old) requires manager approval + reason
- Approved billable time entries auto-create journal entry: Debit WIP / Credit Labor Cost
- Resource utilisation > 100% in any week triggers Resource Conflict alert

### 8.4 AI Agents — Projects

#### Agent: Project Health Agent

| Field | Detail |
|---|---|
| **Trigger** | Daily 07:00 for all active projects |
| **Input** | Milestone completion status, budget vs. actual, team utilisation, task completion rates |
| **Actions** | 1. Compute SPI (Schedule Performance Index) and CPI (Cost Performance Index). 2. Set health_status: Green (SPI>0.9, CPI>0.9), Amber (either < 0.9), Red (either < 0.75 or budget > 90%). 3. Identify upcoming milestones at risk (due within 14 days, <50% task completion). 4. Generate project health digest. |
| **Output** | Updated health_status on project, weekly digest to Project Manager and PMO |
| **Human Approval** | No |

#### Agent: Deadline Prediction Agent

| Field | Detail |
|---|---|
| **Trigger** | Weekly, or when significant task updates occur |
| **Input** | Open tasks with estimates, actual hours logged, team capacity, historical velocity |
| **Actions** | 1. Compute earned value (% complete × planned hours). 2. Project completion date based on current velocity. 3. If projected date > planned end_date → alert PM with number of days at risk. 4. Suggest: scope reduction, resource increase, or timeline extension. |
| **Output** | Completion forecast annotation on project, alert if at risk |
| **Human Approval** | No |

---

## 9. Module 7 — HR / People

> ⚠️ Payroll is legally binding. Every payroll run must have mandatory dual human approval (HR Manager + Finance Manager) before any payment is processed. No exceptions. AI prepares — humans approve.

### 9.1 Payroll Engine

```typescript
interface PayrollRun extends BaseEntity {
  period_start: Date
  period_end: Date
  pay_date: Date
  
  status: "draft" | "under_hr_review" | "hr_approved" | "under_finance_review" | "finance_approved" | "processing" | "paid"
  
  payslips: Payslip[]
  
  // Totals
  total_gross: integer
  total_statutory_deductions: integer
  total_voluntary_deductions: integer
  total_employer_contributions: integer
  total_net: integer
  
  // Approval chain — both required
  hr_approved_by: UUID | null
  hr_approved_at: Timestamp | null
  finance_approved_by: UUID | null
  finance_approved_at: Timestamp | null
  
  // Sanity check flags (AI-generated)
  anomaly_flags: PayrollAnomaly[]
}
```

**Payroll Calculation Order:**
```
1. Base salary (prorated if mid-period hire/termination)
2. + Allowances (housing, transport, meal — per contract)
3. + Overtime (hours × overtime_rate × multiplier per labor law)
4. + Bonus (if applicable for period)
5. - Leave without pay deductions
6. - Employee statutory deductions (social security, income tax)
7. = Net pay

System also calculates (but does not deduct from employee):
8. Employer social security contribution
9. Employer pension/provident fund contribution
```

> ⚠️ Income tax must be calculated using the correct progressive tax bracket table for the employee's country. Never hardcode tax rates — store them in a configurable Tax Rules table with effective dates.

### 9.2 Recruitment Pipeline

```
Job Opening → Applications received → CV Screening → Interview → Assessment → Offer → Hire
```

```typescript
interface JobOpening extends BaseEntity {
  position_id: UUID
  department_id: UUID
  
  title: string
  description: string
  requirements: string
  
  employment_type: string
  salary_range_min: integer | null  // encrypted
  salary_range_max: integer | null  // encrypted
  
  status: "draft" | "open" | "on_hold" | "closed" | "filled"
  published_at: Timestamp | null
  closing_date: Date | null
  
  hiring_manager_id: UUID
  recruiter_id: UUID | null
  
  applicant_ids: UUID[]
}

interface Applicant extends BaseEntity {
  job_opening_id: UUID
  
  full_name: string
  email: string
  phone: string | null
  
  resume_document_id: UUID          // stored in Documents module
  cover_letter: string | null
  
  stage: "applied" | "screening" | "interview_1" | "interview_2" | "assessment" | "offer" | "hired" | "rejected" | "withdrawn"
  rejection_reason: string | null
  
  ai_score: integer | null          // 0–100, from Resume Screening Agent
  ai_summary: string | null
  
  interview_ids: UUID[]
  offer_id: UUID | null
}
```

### 9.3 AI Agents — HR

#### Agent: Resume Screening Agent

| Field | Detail |
|---|---|
| **Trigger** | New applicant submits application |
| **Input** | Resume (PDF from Documents module), job description, requirements, ideal candidate profile |
| **Actions** | 1. Extract: skills, years of experience, education, past roles. 2. Score against job requirements (keyword match + semantic similarity). 3. Flag: missing must-have requirements. 4. Generate structured summary for recruiter. |
| **Output** | `ai_score`, `ai_summary` on Applicant record, ranked applicant list for recruiter |
| **Human Approval** | No — recruiter makes final screening decision |

#### Agent: Attrition Prediction Agent

| Field | Detail |
|---|---|
| **Trigger** | Monthly |
| **Input** | Tenure, recent performance scores, salary vs. market (if data available), leave usage patterns, manager changes, project assignments, peer comparison |
| **Actions** | 1. Score each active employee on attrition risk (0–100). 2. High risk (>70): alert HR Manager and direct manager confidentially. 3. Identify risk factors for each flagged employee. 4. Suggest retention actions. |
| **Output** | Attrition risk score on employee record (accessible to HR only, RBAC-protected), confidential alert |
| **Human Approval** | No |

---

## 10. Module 8 — Documents & Contracts

### 10.1 Document Entity

```typescript
interface Document extends BaseEntity {
  // Identity
  document_name: string
  document_type: string             // "contract" | "invoice" | "receipt" | "policy" | "proposal" | "nda" | "other"
  
  // Storage
  file_key: string                  // S3 object key
  file_size: integer                // bytes
  mime_type: string
  checksum: string                  // SHA-256, for integrity verification
  
  // Version control
  version: integer                  // 1, 2, 3...
  parent_document_id: UUID | null   // original document this is a version of
  version_notes: string | null
  is_current_version: boolean
  
  // Classification
  folder_path: string               // hierarchical: "/Contracts/Vendors/2026"
  metadata: JSON                    // flexible key-value for AI indexing
  confidentiality: "public" | "internal" | "confidential" | "restricted"
  
  // Links to business entities
  linked_entities: LinkedEntity[]   // {entity_type, entity_id}
  
  // Workflow
  approval_status: "not_required" | "pending" | "approved" | "rejected"
  approval_steps: ApprovalStep[]
  signed_at: Timestamp | null
  signed_by: UUID | null
  esign_provider_ref: string | null // DocuSign / HelloSign reference
}
```

### 10.2 Contract Lifecycle

```
Draft → Internal Review → [Approval] → Sent to Counter-party → Negotiation 
→ Final Version → Signing → Active → [Renewal Reminder] → Renewed | Expired | Terminated
```

```typescript
interface Contract extends BaseEntity {
  contract_no: string               // CNT-2026-000001
  title: string
  contract_type: "sales" | "purchase" | "employment" | "nda" | "partnership" | "lease" | "service"
  
  // Parties
  our_signatory_id: UUID
  counter_party_id: UUID
  counter_party_type: "customer" | "vendor" | "employee" | "partner"
  
  // Terms
  start_date: Date
  end_date: Date | null
  is_evergreen: boolean             // auto-renews until terminated
  total_value: integer | null
  currency: string
  
  // Renewal
  renewal_type: "auto" | "manual" | "none"
  renewal_notice_days: integer      // days before expiry to send renewal reminder
  renewal_reminder_sent_at: Timestamp | null
  
  // Document
  document_id: UUID                 // links to Document entity
  
  // AI-extracted fields
  key_clauses: Clause[]             // extracted by Contract Analysis Agent
  obligations: Obligation[]         // deadlines and deliverables extracted by AI
  risk_flags: RiskFlag[]
}
```

### 10.3 AI Agents — Documents

#### Agent: Contract Analysis Agent

| Field | Detail |
|---|---|
| **Trigger** | New contract document uploaded, or on demand |
| **Input** | Contract PDF/DOCX from storage |
| **Actions** | 1. Extract: parties, dates, value, payment terms, termination clauses, penalty clauses, auto-renewal terms. 2. Flag non-standard or high-risk clauses (unlimited liability, one-sided termination rights, IP assignment). 3. Summarize contract in plain language. 4. Create Obligation records for key deadlines. |
| **Output** | Populated `key_clauses`, `obligations`, `risk_flags` on Contract, plain-language summary in annotations |
| **Human Approval** | No — analysis only. Legal/management reviews flags |

#### Agent: Obligation Tracking Agent

| Field | Detail |
|---|---|
| **Trigger** | Daily, checking all active contracts |
| **Input** | Contract obligations with due dates, completion status |
| **Actions** | 1. Check obligations due within 30, 14, 7, 1 days. 2. Send reminders to responsible owner. 3. Flag overdue obligations as high priority. 4. Check contract renewal_notice_days and send renewal alert. |
| **Output** | Reminder notifications, overdue flags |
| **Human Approval** | No |

---

## 11. Module 9 — Analytics / Intelligence

### 11.1 KPI Dashboard Architecture

The analytics layer is **read-only** — it aggregates data from all modules but never writes to them. All KPIs are computed from module data, not stored separately (except for performance-critical aggregations which are pre-computed and cached).

**Core KPIs by Domain:**

| Domain | KPIs |
|---|---|
| **Finance** | Cash balance, AR outstanding, AP due, Revenue MTD/YTD, Gross margin %, Burn rate (startup) |
| **Sales** | Pipeline value, Win rate, Avg deal size, Sales cycle length, Quota attainment %, MRR/ARR (subscription) |
| **Procurement** | Spend MTD, POs pending approval, Overdue deliveries, Cost savings vs. benchmark |
| **Inventory** | Inventory turnover ratio, Stockout incidents, Slow-moving stock value, GMROI |
| **Projects** | Active project count, % On-schedule, % On-budget, Billable utilisation %, Revenue recognition |
| **HR** | Headcount, Attrition rate MTD, Avg time-to-hire, Overtime cost, Leave utilisation |

### 11.2 Profitability Analysis

The analytics engine must support profitability slicing at multiple dimensions:

```
Profitability by:
  - Customer (Revenue - Direct costs - Allocated overhead)
  - Product / SKU (Revenue - COGS - Selling costs)
  - Project (Revenue - Labor costs - Material costs - Overhead allocation)
  - Department / Cost Center (Revenue attributed - All costs)
  - Geographic region / Channel
```

All profitability calculations require cost allocation rules configured by Finance (fixed allocation keys or activity-based).

### 11.3 AI Agents — Analytics

#### Agent: Executive Summary Agent

| Field | Detail |
|---|---|
| **Trigger** | Daily at 07:00 |
| **Input** | Yesterday's transactions and events across all modules |
| **Actions** | 1. Compute daily deltas on all core KPIs. 2. Surface top 3 items requiring attention (overdue AR, low stock, stalled deals, budget overruns). 3. Highlight notable events (large deal won, payroll anomaly, contract expiring). 4. Generate 3-paragraph plain-language summary. |
| **Output** | Daily digest pushed to executives via email/LINE/Slack |
| **Human Approval** | No |

#### Agent: Anomaly Detection Agent (Cross-Module)

| Field | Detail |
|---|---|
| **Trigger** | Every transaction posted across any module |
| **Input** | Transaction details, historical patterns for same account/vendor/employee/project |
| **Actions** | 1. Compare against 90-day historical baseline (mean + std deviation). 2. Flag statistical outliers (> 2.5σ). 3. Run duplicate detection across Finance, Procurement, Expenses. 4. Apply module-specific rules (e.g. expense over policy limit, PO over vendor credit). 5. Score confidence and severity. |
| **Output** | Annotation on source entity, alert to module owner if high severity |
| **Human Approval** | No — alert only |

---

## 12. Module 10 — Automation / AI Agents Layer

### 12.1 Agent Architecture

```
User / Event
     ↓
Supervisor Agent
  - Understands intent
  - Routes to domain agent(s)
  - Manages multi-step workflows
  - Enforces HITL rules
     ↓
Domain Agents (one per module):
  Finance Agent | Sales Agent | Procurement Agent
  HR Agent | Operations Agent | Document Agent
     ↓
Tool Registry
  - finance.create_invoice
  - sales.update_opportunity_stage
  - procurement.create_po
  - inventory.check_stock
  - hr.approve_leave
  - ... (every mutating operation is a registered tool)
     ↓
Business Logic Layer (same code path as human UI)
```

### 12.2 Agent Memory Architecture

```typescript
// Short-term memory (Redis — expires per session)
interface AgentSession {
  session_id: UUID
  org_id: UUID
  user_id: UUID
  conversation_history: Message[]   // last N turns
  working_context: JSON             // entities in focus this session
  pending_approvals: PendingAction[]
  ttl: integer                      // seconds
}

// Long-term memory (pgvector — persistent)
interface AgentMemory {
  id: UUID
  org_id: UUID
  memory_type: "decision" | "preference" | "document" | "business_fact"
  content: string                   // plain text
  embedding: vector(1536)           // OpenAI/Anthropic embedding
  source_entity_type: string
  source_entity_id: UUID
  created_at: Timestamp
  relevance_decay_at: Timestamp | null
}
```

### 12.3 Human-in-the-Loop (HITL) Framework

Every agent action is classified by risk level before execution:

| Risk Level | Definition | Behavior |
|---|---|---|
| **Low** | Read-only, informational, sending reminders | Execute immediately, log action |
| **Medium** | Creates records, sends external communications | Execute with notification to owner |
| **High** | Financial transactions, approvals, external commitments | Queue for human approval before execution |
| **Critical** | Payroll, large financial transactions, data deletion | Mandatory dual human approval |

**HITL Decision Table:**

| Action | Risk | Auto-execute? | Requires Approval From |
|---|---|---|---|
| Generate AR invoice (< 50k THB) | Medium | Yes | — |
| Generate AR invoice (> 50k THB) | High | No | Finance Manager |
| Send payment reminder (≤ 3 sent) | Low | Yes | — |
| Send payment reminder (> 3 sent) | Medium | No | AR Manager |
| Create reorder PO (< threshold) | Medium | Configurable | — |
| Create reorder PO (> threshold) | High | No | Procurement Manager |
| Auto-approve matched vendor bill | Medium | Yes (if 3WM pass) | — |
| Payroll run execution | Critical | No | HR Manager + Finance Manager |
| Apply discount > 15% on quote | High | No | Sales Manager |
| Employee termination processing | Critical | No | HR Manager + Legal |
| Contract commitment > 500k THB | Critical | No | CEO / CFO |
| Data deletion / bulk update | Critical | No | System Admin + Owner |
| AI confidence score < 0.70 | Any | No | Relevant module owner |

### 12.4 Natural Language Interface

```
User input (any language)
  ↓
Intent Classification
  - Query: "What is our AR outstanding?" → read tool calls
  - Command: "Create a PO for 100 units of SKU-001" → guided workflow
  - Analysis: "Why did our expenses spike in March?" → analytics + explanation
  ↓
RBAC Check
  - Same permissions as UI — NL interface does NOT bypass access control
  ↓
Tool Execution (with HITL if required)
  ↓
Response in user's language with data
```

**NL Query Examples and Expected Behavior:**

| User Says | Agent Does |
|---|---|
| "Show me all overdue invoices" | Queries AR with filter: `payment_status=overdue`, returns formatted list |
| "What's our cash position today?" | Queries bank accounts + unreconciled payments, returns cash summary |
| "Who are our top 5 customers by revenue this year?" | Queries Finance + CRM, joins revenue by customer, returns ranked list |
| "Create a purchase order for 50 units of SKU-001 from our preferred vendor" | Retrieves preferred vendor for SKU-001, creates draft PO, shows for confirmation |
| "Approve the leave request from John Smith" | Finds pending leave request, verifies user has approval authority, presents for one-click approval |
| "Draft a follow-up email for the Acme Corp opportunity" | Retrieves opportunity context, drafts personalized email, presents for edit and send approval |

### 12.5 Agent Safety & Guardrails

```typescript
interface AgentGuardrails {
  // Confidence threshold — below this, always escalate to human
  min_confidence_to_auto_execute: 0.75
  
  // Financial limits — actions above these go to HITL regardless
  auto_execute_financial_limit: 50_000  // THB
  
  // Rate limiting — prevent agent loops
  max_actions_per_session: 20
  max_financial_actions_per_hour: 5
  
  // Prohibited actions — agents can NEVER do these
  prohibited: [
    "delete_journal_entry",
    "modify_posted_journal_entry",
    "delete_employee_record",
    "change_bank_account_details",
    "access_other_org_data",
    "bypass_rbac",
  ]
  
  // All agent actions are logged regardless of outcome
  audit_all_actions: true
  log_reasoning_chain: true         // store the LLM reasoning, not just the decision
}
```

---

## 13. Cross-Module Integration Map

### 13.1 Event Bus — Key Events and Subscribers

| Event | Published By | Subscribed By | Action Taken |
|---|---|---|---|
| `sales_order.confirmed` | Sales/CRM | Inventory | Reserve stock for order |
| `sales_order.confirmed` | Sales/CRM | Finance | Create draft AR Invoice |
| `sales_order.confirmed` | Sales/CRM | Documents | Generate delivery note |
| `grn.completed` | Procurement | Inventory | Increase stock on-hand |
| `grn.completed` | Procurement | Finance | Trigger 3-way match check |
| `invoice.paid` | Finance | Sales/CRM | Update customer payment history |
| `milestone.completed` | Projects | Finance | Create draft milestone invoice |
| `timesheet.approved` | Projects | Finance | Post labor cost journal entry |
| `stock_movement.created` | Inventory | Finance | Post inventory valuation entry |
| `payroll_run.finance_approved` | HR | Finance | Post payroll journal entries |
| `employee.terminated` | HR | Projects | Release resource assignments |
| `employee.terminated` | HR | Finance | Trigger final pay calculation |
| `contract.expiring_soon` | Documents | Sales/CRM | Alert account manager for renewal |
| `po.sent` | Procurement | Documents | Attach PO PDF to vendor record |
| `vendor_bill.received` | Finance | Procurement | Trigger 3-way match |
| `lead.qualified` | Sales/CRM | Documents | Trigger NDA / proposal template |

### 13.2 Entity Relationship Map

```
Customer ──────────── Contact (many)
Customer ──────────── Address (many)
Customer ──────────── Contract (many)
Customer ──────────── Invoice (many)       [Finance]
Customer ──────────── Opportunity (many)   [CRM]
Customer ──────────── SalesOrder (many)    [CRM]
Customer ──────────── Document (many)      [Documents]

Vendor ─────────────── Contact (many)
Vendor ─────────────── Contract (many)
Vendor ─────────────── PurchaseOrder (many)
Vendor ─────────────── Bill (many)         [Finance]

Product ────────────── InvoiceLineItem     [Finance]
Product ────────────── POLineItem          [Procurement]
Product ────────────── StockMovement       [Inventory]
Product ────────────── QuoteLineItem       [CRM]

Employee ───────────── Department
Employee ───────────── Position
Employee ───────────── LeaveRequest        [HR]
Employee ───────────── TimeEntry           [Projects]
Employee ───────────── Payslip             [HR]
Employee ───────────── Expense             [Finance]

Project ────────────── Task (many)
Project ────────────── Milestone (many)
Project ────────────── TimeEntry (many)
Project ────────────── BudgetLine (many)
Project ────────────── CostCenter          [Finance]
Project ────────────── SalesOrder          [CRM]
```

---

## 14. API & Security Standards

### 14.1 API Response Envelope

All endpoints return:
```json
{
  "data": { },
  "meta": {
    "page": 1,
    "per_page": 50,
    "total": 243,
    "request_id": "uuid"
  },
  "errors": []
}
```

### 14.2 Webhook Event Format

```json
{
  "event_id": "uuid",
  "event_type": "invoice.payment_received",
  "org_id": "uuid",
  "entity_type": "Invoice",
  "entity_id": "uuid",
  "actor_id": "uuid",
  "actor_type": "human | agent",
  "timestamp": "2026-03-14T10:00:00Z",
  "changed_fields": ["payment_status", "amount_paid", "outstanding_balance"],
  "payload": { }
}
```

### 14.3 Security Requirements

| Requirement | Implementation |
|---|---|
| **Multi-tenancy** | Row-level security via PostgreSQL RLS. `org_id` in every table. |
| **RBAC** | Field-level, not just entity-level. Implemented at API layer, not only UI. |
| **PII encryption** | `national_id`, `bank_account`, `salary`, `tax_id` — AES-256 at rest, masked in API response unless explicitly permitted |
| **AI API proxying** | All LLM API calls go through internal proxy that strips `org_id` and PII before transmission |
| **MFA enforcement** | Required for: payroll approval, bank detail changes, admin configuration, bulk deletes |
| **Audit logging** | Every mutating API call logged with actor, timestamp, old value, new value |
| **Agent action logging** | Full reasoning chain (prompt + response) stored for every AI action, 90-day retention minimum |
| **Secret management** | No secrets in code or environment variables. Use Vault or cloud secret manager |
| **API rate limiting** | Per org and per user. AI agent calls have separate tighter limits |

---

## 15. Tech Stack Recommendations

| Layer | Recommended | Rationale |
|---|---|---|
| **Backend API** | Node.js (TypeScript) + Fastify or Python (FastAPI) | TypeScript for type safety across full stack; FastAPI for ML-heavy orgs |
| **Primary Database** | PostgreSQL 16+ | Mature, reliable, supports RLS, JSONB, pgvector |
| **Vector Search** | pgvector extension | Keep it simple — same DB. Upgrade to Qdrant if query volume demands |
| **Cache** | Redis | Session storage, agent short-term memory, rate limiting, idempotency keys |
| **Event Bus** | NATS JetStream (SME) or Apache Kafka (scale) | NATS is simpler to operate at SME scale |
| **LLM Provider** | Anthropic Claude (claude-sonnet-4-5 for agents, claude-haiku-4-5 for classification) | Strong reasoning, long context, tool use |
| **Document Storage** | S3-compatible (AWS S3 or MinIO self-hosted) | Standard, cost-effective, durable |
| **Frontend** | React + TypeScript + Shadcn/ui | Component quality, accessibility, active ecosystem |
| **AI Framework** | LangGraph or custom agent loop | LangGraph for complex multi-step workflows |
| **Infrastructure** | Docker + Kubernetes (scale) or Railway/Fly.io (early stage) | Start simple, migrate to K8s when justified |
| **Observability** | OpenTelemetry + Grafana + Loki | Full stack: traces, metrics, logs |
| **Auth** | Auth0 or Clerk (managed) or custom JWT + refresh tokens | Managed reduces security risk for auth |

---

## 16. Implementation Phasing

| Phase | Duration | Scope | Exit Criteria |
|---|---|---|---|
| **Phase 1 — Foundation** | Months 1–3 | Multi-tenancy, Auth/RBAC, Core/Master Data, Finance (GL, AR, AP, basic reports), API framework, Event bus | Finance team can run end-to-end AR/AP cycle. All module tests passing. |
| **Phase 2 — Revenue & Procurement** | Months 4–6 | Sales/CRM (Lead → SO), Procurement (PR → PO → GRN → 3WM), Inventory basics, Finance integration (auto journal entries) | Sales team manages pipeline. Procurement runs procure-to-pay. Finance sees real-time impact. |
| **Phase 3 — People & Operations** | Months 7–9 | HR/People (records, leave, payroll engine), Project/Task management, Time tracking, Milestone billing, Documents & Contracts | HR can process payroll with HITL approval. Project costs flow to Finance. Contract lifecycle managed. |
| **Phase 4 — AI Layer** | Months 10–12 | All domain AI agents (per specs above), Natural Language Interface, Semantic search, Cross-module anomaly detection, HITL approval workflows | At least 3 agents live per module. NL interface handles 80% of common queries. Full HITL audit trail. |
| **Phase 5 — Integration & Scale** | Months 13–15 | Bank feed integration, Payment gateways, Tax authority APIs, Communication platform webhooks, Analytics/BI module, Performance optimization, Security audit | System handles 10× load. External integrations live. Penetration test passed. |

---

## 17. Open Questions for Engineering Team

Resolve these before or early in Phase 1. Document decisions as ADRs (Architecture Decision Records).

1. **LLM Provider & Cost Model:** Single provider (Anthropic Claude) or multi-provider with fallback? Who owns API key management? How is LLM cost attributed per tenant?

2. **Agent Framework:** Custom agent loop vs. LangGraph? Custom = more control + maintenance. LangGraph = faster to build + harder to debug at scale.

3. **Payroll Tax Engine:** Build configurable rules engine in-house (complex, flexible) or integrate third-party tax API (Avalara, country-specific)? In-house requires ongoing maintenance as tax laws change.

4. **Real-time vs. Eventual Consistency:** Define per operation. Stock reservation = real-time (SELECT FOR UPDATE). Report generation = eventual. AI annotations = eventual. Where exactly is the boundary?

5. **Multi-currency in Phase 1?:** Multi-currency affects every monetary field and calculation. Defer to Phase 2? If deferred, design DB schema to support it (include `currency` and `exchange_rate` fields from day one even if not implemented).

6. **Data Residency:** Do customers require data in specific regions? Constrains cloud provider choice and LLM API routing (cannot send data to US if customer requires EU residency).

7. **Mobile / Offline:** Does the system need offline capability for field operations (inventory counting, time entry)? Major architectural impact — requires local-first database and sync engine.

8. **White-label / Multi-product:** Single product or platform? White-label requires: per-tenant domain, custom branding, feature flag system, custom UI theming engine.

9. **Accounting Standards:** Which countries must be supported at launch? Tax rules, statutory deduction rates, reporting formats vary significantly by country.

10. **Agent Observability:** How do we monitor agent decision quality over time? Need evaluation framework to detect when agents start making poor decisions due to data drift or model changes.

---

## 18. Interface Layer — API, CLI, MCP, SDK & Webhooks

> **Design Principle:** UI is just one of many interfaces. Every capability exposed in the UI must be equally accessible via API, CLI, and MCP. This is what makes the system truly AI-Native — any tool, any agent, any developer can integrate without friction.

```
┌─────────────────────────────────────────────────────────────┐
│                    Interface Layer                          │
│                                                             │
│   Web UI │ REST API │ GraphQL │ CLI │ MCP │ Webhooks │ SDK  │
└──────────────────────────┬──────────────────────────────────┘
                           │
                    API Gateway (single entry point)
                    - Auth / API Key validation
                    - RBAC enforcement
                    - Rate limiting
                    - Idempotency key handling
                    - Audit logging
                           │
                    Business Logic Layer (shared)
                    - Same code path for ALL interfaces
                    - No interface gets special privileges
```

> ⚠️ **Critical Rule:** The Business Logic Layer must be interface-agnostic. Logic must never live in the UI controller or CLI command handler. Every rule, validation, and permission check must execute identically regardless of how the request arrived.

---

### 18.1 REST API

The primary integration interface. Designed for developers building integrations, custom apps, and automation scripts.

#### Design Standards

```
Base URL:   https://api.yourerp.com/v1
Auth:       Bearer token (OAuth 2.0) or API Key (header: X-API-Key)
Format:     JSON
Versioning: URL path versioning (/v1/, /v2/) — never break existing versions
```

#### URL Structure

```
GET    /v1/{module}/{resource}           list with filtering + pagination
GET    /v1/{module}/{resource}/{id}      single record
POST   /v1/{module}/{resource}           create
PATCH  /v1/{module}/{resource}/{id}      partial update
DELETE /v1/{module}/{resource}/{id}      soft delete

Examples:
GET    /v1/finance/invoices?status=overdue&customer_id=uuid&page=1&per_page=50
POST   /v1/finance/invoices
GET    /v1/sales/opportunities?stage=Proposal&owner_id=uuid
PATCH  /v1/procurement/purchase-orders/uuid
GET    /v1/inventory/products/uuid/stock-levels
POST   /v1/hr/leave-requests
GET    /v1/analytics/kpis?domain=finance&period=mtd
```

#### API Key Management

```typescript
interface APIKey {
  key_id: UUID
  org_id: UUID
  name: string                    // "Shopify Integration", "Accounting Export"
  key_prefix: string              // shown in UI: "erpk_live_abc..."
  key_hash: string                // bcrypt hash — never store plaintext
  
  // Scoping — principle of least privilege
  scopes: string[]                // ["finance:read", "inventory:write", "hr:read"]
  allowed_ips: string[]           // optional IP whitelist
  
  expires_at: Timestamp | null
  last_used_at: Timestamp | null
  created_by: UUID
  is_active: boolean
}
```

**Scope Format:** `{module}:{permission}`

| Scope | Access |
|---|---|
| `finance:read` | Read all Finance data |
| `finance:write` | Create and update Finance records |
| `finance:admin` | Includes delete, period closing, configuration |
| `sales:read` | Read CRM/Sales data |
| `inventory:read` | Read stock levels, movements |
| `inventory:write` | Create stock movements |
| `hr:read` | Read employee records (PII masked by default) |
| `hr:payroll` | Access salary and payroll data (requires explicit grant) |
| `*:read` | Read all modules |
| `*:write` | Write all modules |

#### Rate Limiting Headers

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 847
X-RateLimit-Reset: 1710000000
X-RateLimit-Window: 3600

Default limits (configurable per API key tier):
  Standard:    1,000 req/hour
  Premium:     10,000 req/hour
  Agent keys:  5,000 req/hour (separate bucket for AI agent traffic)
```

#### Filtering, Sorting, Field Selection

```
# Filter
GET /v1/finance/invoices?status=overdue&customer_id=uuid&due_date_before=2026-03-01

# Sort
GET /v1/finance/invoices?sort=-due_date          # descending
GET /v1/sales/opportunities?sort=estimated_value  # ascending

# Field selection (reduces payload for AI agents — fetch only what's needed)
GET /v1/finance/invoices?fields=id,invoice_no,total_amount,outstanding_balance,customer_id

# Expand relations (avoid N+1)
GET /v1/finance/invoices?expand=customer,line_items
```

#### Idempotency (mandatory for all POST/PATCH)

```http
POST /v1/finance/invoices
Idempotency-Key: client-generated-uuid-here
Content-Type: application/json

{
  "customer_id": "uuid",
  "line_items": [...],
  "due_date": "2026-04-15"
}
```

- Server stores idempotency key + response for 24 hours (Redis)
- Duplicate request with same key → return cached response, no double-create
- Required for all AI agent POST/PATCH calls — agents may retry on timeout

---

### 18.2 GraphQL API

For complex queries that need flexible data fetching — particularly useful for dashboards and reporting integrations that need joins across multiple modules.

```graphql
# Example: Dashboard query — fetch everything in one round trip
query DashboardSummary($orgId: ID!, $period: PeriodInput!) {
  finance {
    cashBalance
    arOutstanding(period: $period) { total, overdue, current }
    apDue(nextDays: 30) { total, count }
    revenue(period: $period) { total, vsLastPeriod }
  }
  sales {
    pipelineValue(stages: [Proposal, Negotiation])
    dealsClosingThisMonth { id, title, value, probability }
    winRateMTD
  }
  inventory {
    stockAlerts { sku, name, availableQty, reorderPoint }
  }
  projects {
    activeCount
    atRisk { id, name, healthStatus, daysOverdue }
  }
}
```

**GraphQL-specific rules:**
- Maximum query depth: 5 levels
- Maximum query complexity: 100 (computed by field weights)
- Introspection disabled in production (security)
- Persisted queries required for production clients (prevents arbitrary query injection)

---

### 18.3 CLI (Command Line Interface)

For developers, DevOps, and power users. Enables scripting, automation, cron jobs, and server-side workflows without a browser.

#### Installation

```bash
# macOS / Linux
brew install erp-cli
# or
curl -sSL https://cli.yourerp.com/install.sh | bash

# Windows
winget install YourERP.CLI

# Node.js (cross-platform)
npm install -g @yourerp/cli
```

#### Authentication

```bash
# Interactive login (opens browser for OAuth)
erp auth login

# API Key (for CI/CD and scripts)
erp auth set-key erpk_live_xxxxxxxxxxxx

# Verify
erp auth whoami
# → Authenticated as: John Smith (john@company.com)
# → Org: Acme Corp (acme)
# → Scopes: finance:read, sales:read, inventory:write
```

#### Command Structure

```
erp [module] [resource] [action] [flags]

Modules:    finance, sales, procurement, inventory, projects, hr, docs, analytics, agent
Resources:  invoices, bills, payments, leads, opportunities, orders, products, employees, ...
Actions:    list, get, create, update, delete, approve, export
```

#### Example Commands

```bash
# Finance
erp finance invoices list --status overdue --format table
erp finance invoices get INV-2026-000123
erp finance invoices create --customer-id uuid --from-file invoice.json
erp finance invoices export --period 2026-Q1 --format csv > q1_invoices.csv

# Sales
erp sales opportunities list --stage Proposal --sort -value
erp sales leads import --file leads.csv --map-fields field_mapping.json

# Inventory
erp inventory products list --low-stock          # available_qty <= reorder_point
erp inventory stock-movements create \
  --type adjustment --sku SKU-001 --qty 50 --reason "Stock count correction"

# Procurement
erp procurement purchase-orders list --status pending_confirmation
erp procurement purchase-orders approve PO-2026-000045

# HR
erp hr employees list --department Engineering --format json
erp hr payroll runs list --status under_finance_review

# Analytics
erp analytics kpis --domain finance --period mtd
erp analytics report --type profit-loss --period 2026-Q1 --format pdf > pl_q1.pdf

# Agent — natural language via CLI
erp agent ask "What is our current cash position?"
erp agent ask "List all overdue invoices over 100,000 THB"
erp agent run "Send payment reminders to all customers overdue more than 7 days" --dry-run
erp agent run "Create a reorder PO for all SKUs below reorder point" --approve-all

# Automation / scripting
erp finance invoices list --status overdue --format json | \
  jq '.data[] | select(.outstanding_balance > 100000)' | \
  erp agent run --stdin "Send escalation email for each invoice"
```

#### Output Formats

```bash
--format table    # human-readable (default for interactive)
--format json     # machine-readable (default when piped)
--format csv      # for spreadsheet export
--format yaml     # for config/template files
```

#### Config File

```yaml
# ~/.erp/config.yaml
default_org: acme
default_format: table
api_endpoint: https://api.yourerp.com
profiles:
  production:
    api_key: erpk_live_xxx
  staging:
    api_key: erpk_test_xxx
    api_endpoint: https://api-staging.yourerp.com
```

---

### 18.4 MCP Server (Model Context Protocol)

**This is the most important interface for AI-Native design.** MCP allows external AI tools — Claude Desktop, Cursor, Copilot, custom agents — to connect directly to the ERP and use it as a context source and action executor.

When MCP is connected, Claude Desktop can answer: *"What deals are closing this month?"* or *"Approve the leave request from John"* directly from the chat — without the user opening the ERP UI.

#### MCP Server Architecture

```
Claude Desktop / Cursor / Any MCP-compatible AI tool
    ↓ (MCP protocol over SSE or stdio)
ERP MCP Server
    ↓ (internal API call with org + user context)
API Gateway → Business Logic → Database
```

#### MCP Server Implementation

```typescript
import { MCPServer, Tool, Resource } from "@modelcontextprotocol/sdk";

const server = new MCPServer({
  name: "yourerp",
  version: "1.0.0",
  description: "AI-Native ERP — access business data and execute workflows"
});

// ── RESOURCES (read-only data sources) ──────────────────────

server.addResource({
  uri: "erp://finance/invoices/overdue",
  name: "Overdue Invoices",
  description: "All invoices past due date with outstanding balance",
  mimeType: "application/json",
  handler: async (ctx) => {
    return await financeService.getOverdueInvoices(ctx.orgId);
  }
});

server.addResource({
  uri: "erp://sales/pipeline",
  name: "Sales Pipeline",
  description: "Current opportunities by stage with values and probabilities",
  mimeType: "application/json",
  handler: async (ctx) => {
    return await salesService.getPipelineSummary(ctx.orgId);
  }
});

server.addResource({
  uri: "erp://analytics/daily-summary",
  name: "Daily Business Summary",
  description: "Executive summary: cash, AR, AP, pipeline, headcount, alerts",
  mimeType: "application/json",
  handler: async (ctx) => {
    return await analyticsService.getDailySummary(ctx.orgId);
  }
});

// ── TOOLS (actions AI can execute) ──────────────────────────

server.addTool({
  name: "search_business_data",
  description: "Semantic search across all ERP data — invoices, customers, products, contracts, etc.",
  inputSchema: {
    query: { type: "string", description: "Natural language search query" },
    modules: { type: "array", items: { type: "string" }, description: "Limit to specific modules" },
    limit: { type: "number", default: 10 }
  },
  handler: async (input, ctx) => {
    return await searchService.semanticSearch(input.query, {
      orgId: ctx.orgId,
      modules: input.modules,
      userId: ctx.userId   // RBAC applied — returns only data user can see
    });
  }
});

server.addTool({
  name: "get_customer",
  description: "Get full customer profile including AR balance, open orders, and interaction history",
  inputSchema: {
    customer_id: { type: "string" }
  },
  handler: async (input, ctx) => {
    return await customerService.getFullProfile(input.customer_id, ctx.orgId);
  }
});

server.addTool({
  name: "create_invoice",
  description: "Create a new customer invoice. Returns draft invoice for review.",
  inputSchema: {
    customer_id: { type: "string" },
    line_items: { type: "array" },
    due_date: { type: "string" },
    notes: { type: "string" }
  },
  riskLevel: "medium",
  requiresConfirmation: true,    // AI must show draft to user before submitting
  handler: async (input, ctx) => {
    return await invoiceService.createDraft(input, ctx.orgId, ctx.userId);
  }
});

server.addTool({
  name: "approve_leave_request",
  description: "Approve or reject an employee leave request",
  inputSchema: {
    leave_request_id: { type: "string" },
    action: { type: "string", enum: ["approve", "reject"] },
    reason: { type: "string" }
  },
  riskLevel: "high",
  requiresConfirmation: true,
  handler: async (input, ctx) => {
    // RBAC: only managers can approve their direct reports' leave
    return await hrService.processLeaveApproval(input, ctx.orgId, ctx.userId);
  }
});

server.addTool({
  name: "run_report",
  description: "Generate a financial or operational report",
  inputSchema: {
    report_type: { type: "string", enum: ["profit_loss", "balance_sheet", "cash_flow", "ar_aging", "inventory_valuation"] },
    period_start: { type: "string" },
    period_end: { type: "string" },
    format: { type: "string", enum: ["json", "pdf"] }
  },
  handler: async (input, ctx) => {
    return await reportingService.generate(input, ctx.orgId);
  }
});
```

#### MCP Tool Categories

| Category | Tools | Risk Level |
|---|---|---|
| **Query & Search** | `search_business_data`, `get_customer`, `get_vendor`, `check_stock`, `get_invoice`, `get_opportunity` | Low |
| **Analytics** | `get_kpis`, `run_report`, `get_cashflow_forecast`, `get_pipeline_forecast` | Low |
| **Create (draft)** | `create_invoice`, `create_purchase_order`, `create_leave_request`, `create_task` | Medium |
| **Approve / Action** | `approve_leave_request`, `approve_purchase_order`, `approve_expense`, `send_invoice` | High |
| **Update** | `update_opportunity_stage`, `update_task_status`, `update_stock` | Medium–High |
| **Agent triggers** | `trigger_cashflow_forecast`, `trigger_reorder_check`, `send_payment_reminders` | Medium |

#### MCP Connection Setup (User-facing)

```
Settings → Integrations → MCP → Generate MCP Token

Config for Claude Desktop (claude_desktop_config.json):
{
  "mcpServers": {
    "yourerp": {
      "command": "npx",
      "args": ["-y", "@yourerp/mcp-server"],
      "env": {
        "ERP_MCP_TOKEN": "mcp_xxxxxxxxxxxxxxxx",
        "ERP_ORG": "acme"
      }
    }
  }
}
```

> ⚠️ **MCP Security Rules:**
> - MCP tokens are scoped per user — the connected AI sees only what that user is permitted to see
> - All MCP tool calls go through the same RBAC layer as the UI and REST API
> - High-risk tools (`requiresConfirmation: true`) must display the action to the user and wait for explicit confirmation before executing
> - All MCP actions appear in the org's audit log with `actor_type: "mcp_agent"` and the connected tool name

---

### 18.5 Webhooks (Outbound Events)

For push-based integrations — the ERP notifies external systems when things happen, without polling.

#### Webhook Configuration

```typescript
interface WebhookEndpoint {
  id: UUID
  org_id: UUID
  name: string                      // "Notify Shopify on stock change"
  url: string                       // HTTPS only
  secret: string                    // HMAC-SHA256 signing secret (shown once)
  
  // Event subscriptions
  events: string[]                  // ["invoice.created", "invoice.paid", "stock.low"]
  
  // Filtering (optional)
  filters: JSON                     // e.g. {"module": "finance", "amount_gt": 100000}
  
  status: "active" | "paused" | "failing"
  failure_count: integer
  last_success_at: Timestamp | null
  last_failure_at: Timestamp | null
}
```

#### Webhook Event Catalog

```
finance.invoice.created
finance.invoice.sent
finance.invoice.paid
finance.invoice.overdue
finance.bill.matched           ← 3-way match passed
finance.bill.discrepancy       ← 3-way match failed
finance.payment.received

sales.lead.created
sales.lead.qualified
sales.opportunity.stage_changed
sales.quote.accepted
sales.order.confirmed

procurement.po.sent
procurement.po.confirmed
procurement.grn.completed

inventory.stock.low            ← available_qty ≤ reorder_point
inventory.stock.movement

projects.milestone.completed
projects.project.health_changed

hr.leave.approved
hr.payroll.run.paid

documents.contract.expiring    ← N days before expiry
documents.contract.signed

agent.action.completed         ← AI agent completed an automated action
agent.action.needs_approval    ← AI agent queued action for human review
```

#### Webhook Payload & Security

```http
POST https://your-system.com/erp-webhook
Content-Type: application/json
X-ERP-Event: finance.invoice.paid
X-ERP-Delivery: uuid
X-ERP-Signature: sha256=hmac_of_body_with_secret
X-ERP-Timestamp: 1710000000

{
  "event_id": "uuid",
  "event_type": "finance.invoice.paid",
  "org_id": "uuid",
  "timestamp": "2026-03-14T10:00:00Z",
  "entity_type": "Invoice",
  "entity_id": "uuid",
  "actor_id": "uuid",
  "actor_type": "human",
  "data": {
    "invoice_no": "INV-2026-000123",
    "customer_id": "uuid",
    "amount_paid": 150000,
    "currency": "THB",
    "payment_date": "2026-03-14"
  }
}
```

**Delivery guarantees:**
- At-least-once delivery (idempotency key in payload for receiver deduplication)
- Retry: exponential backoff — 1m, 5m, 30m, 2h, 8h, 24h (max 6 retries)
- After 6 failures: webhook paused, alert sent to org admin
- Delivery logs stored 30 days — manual replay available from UI

---

### 18.6 SDK

TypeScript/JavaScript SDK for developers building on top of the platform.

```typescript
// Installation
// npm install @yourerp/sdk

import { ERPClient } from "@yourerp/sdk";

const erp = new ERPClient({
  apiKey: process.env.ERP_API_KEY,
  orgId: process.env.ERP_ORG_ID,
  // optional:
  baseUrl: "https://api.yourerp.com/v1",
  timeout: 30_000,
  retries: 3,
});

// Type-safe access to all modules
const invoice = await erp.finance.invoices.create({
  customerId: "uuid",
  lineItems: [{ productId: "uuid", quantity: 5, unitPrice: 10000 }],
  dueDate: "2026-04-15",
}, {
  idempotencyKey: crypto.randomUUID()  // auto-generated if not provided
});

// Filtering and pagination
const overdueInvoices = await erp.finance.invoices.list({
  filters: { status: "overdue", dueDateBefore: "2026-03-01" },
  sort: "-due_date",
  fields: ["id", "invoice_no", "outstanding_balance", "customer_id"],
  page: 1,
  perPage: 100
});

// Webhook listener (for server-side)
const webhookHandler = erp.webhooks.createHandler({
  secret: process.env.ERP_WEBHOOK_SECRET,
  onEvent: {
    "finance.invoice.paid": async (event) => {
      console.log(`Invoice ${event.data.invoice_no} paid`);
      await updateCRM(event.data.customer_id);
    },
    "inventory.stock.low": async (event) => {
      await notifyProcurementTeam(event.data);
    }
  }
});

// Express middleware
app.post("/erp-webhook", express.raw({ type: "application/json" }), webhookHandler);
```

---

### 18.7 Interface Capability Matrix

| Capability | Web UI | REST API | GraphQL | CLI | MCP | Webhook | SDK |
|---|---|---|---|---|---|---|---|
| Read data | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ |
| Create records | ✅ | ✅ | — | ✅ | ✅ | — | ✅ |
| Update records | ✅ | ✅ | — | ✅ | ✅ | — | ✅ |
| Approve workflows | ✅ | ✅ | — | ✅ | ✅ | — | ✅ |
| NL query | ✅ | — | — | ✅ | ✅ | — | — |
| Receive event push | — | — | ✅ (subscription) | — | — | ✅ | ✅ |
| Bulk operations | — | ✅ | — | ✅ | — | — | ✅ |
| Export reports | ✅ | ✅ | — | ✅ | ✅ | — | ✅ |
| Scripting / automation | — | ✅ | — | ✅ | — | — | ✅ |
| AI tool integration | — | — | — | — | ✅ | — | — |
| RBAC enforced | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Audit logged | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

### 18.8 Common Integration Patterns

#### Pattern 1: E-commerce → ERP (Shopify / WooCommerce)

```
Shopify order confirmed
  → Shopify sends webhook to ERP webhook receiver
  → ERP creates Sales Order
  → Inventory reserves stock (event: sales_order.confirmed)
  → Finance creates draft invoice (event: sales_order.confirmed)
  → On shipment: Inventory issues stock, Finance posts COGS entry
  → On payment: Finance reconciles payment
```

#### Pattern 2: Accounting Software Sync (existing accounting tools)

```
ERP Finance module ←→ External accounting (Xero / QuickBooks)
  → ERP is source of truth for operations
  → Nightly sync via API: push journal entries, invoices, payments
  → Or: replace external accounting entirely — ERP Finance is the GL
```

#### Pattern 3: AI Assistant Integration (Claude Desktop via MCP)

```
User asks Claude Desktop: "Do we have enough stock to fulfill the Acme order?"
  → Claude calls MCP tool: check_stock(sku_ids, quantities)
  → MCP server queries Inventory module
  → Returns: available_qty per SKU vs. required
  → Claude answers in natural language with recommendation
```

#### Pattern 4: CI/CD Pipeline Integration (CLI)

```bash
# In deployment script or cron job
#!/bin/bash

# Daily: send payment reminders for overdue invoices
erp finance invoices list --status overdue --format json | \
  erp agent run "Send polite payment reminder to each customer" \
  --dry-run             # Preview first
  
# Confirm and execute
erp finance invoices list --status overdue --format json | \
  erp agent run "Send polite payment reminder to each customer" \
  --auto-approve        # Skip HITL for this pre-approved workflow
```

---

*End of AI-Native Business Stack Engineering Brief v1.1*  
*Questions → Product Owner before starting implementation of affected module*  
*All sections marked ⚠️ contain rules that require business stakeholder sign-off before change*
