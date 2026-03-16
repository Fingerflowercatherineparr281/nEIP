# แผนทดสอบระบบ nEIP ERP — Thai SME Edition
## Test Plan v1.0 | ระดับ: Pre-IPO / Big 4 Audit Ready

---

| รายการ | รายละเอียด |
|--------|-----------|
| ชื่อเอกสาร | Master Test Plan — nEIP ERP System |
| เวอร์ชัน | 1.0.0 |
| วันที่จัดทำ | 15 มีนาคม 2569 (2026-03-15) |
| จัดทำโดย | QA Engineering Team |
| สถานะ | Draft for Review |
| ระดับความลับ | Internal — Confidential |

---

## สารบัญ

1. บทนำ
2. แนวทางการทดสอบ
3. แผนทดสอบรายโมดูล
4. ทดสอบวงจรธุรกิจ (Business Cycle Tests)
5. ทดสอบความปลอดภัย
6. ทดสอบประสิทธิภาพ
7. ทดสอบการปฏิบัติตามกฎหมาย
8. เกณฑ์การผ่านการทดสอบ (Exit Criteria)
9. Risk Matrix
10. Sign-off Checklist

---

## 1. บทนำ (Introduction)

### 1.1 วัตถุประสงค์ของแผนทดสอบ

เอกสารฉบับนี้กำหนดกลยุทธ์ แนวทาง ขอบเขต และเกณฑ์ความสำเร็จสำหรับการทดสอบระบบ nEIP ERP ซึ่งเป็นระบบบริหารจัดการธุรกิจสำหรับ SME ไทย โดยครอบคลุมการทดสอบในทุกมิติตั้งแต่ระดับ Unit Test จนถึง End-to-End Business Cycle Test เพื่อให้มั่นใจว่า:

- ระบบทำงานถูกต้องตามข้อกำหนดทางธุรกิจและกฎหมายไทย
- ข้อมูลทางบัญชีมีความถูกต้อง สมบูรณ์ และตรวจสอบได้ (Audit Trail)
- ระบบปลอดภัยและรักษาความเป็นส่วนตัวของข้อมูล (PDPA Compliant)
- ประสิทธิภาพของระบบเป็นไปตามมาตรฐานที่กำหนด
- ระบบพร้อมสำหรับการใช้งานจริงในระดับ Production

### 1.2 ขอบเขต (Scope)

**โมดูลที่อยู่ในขอบเขตการทดสอบ:**

| กลุ่มโมดูล | รหัส | ชื่อโมดูล |
|-----------|------|----------|
| Finance | FI-GL | General Ledger (บัญชีแยกประเภท) |
| Finance | FI-AR | Accounts Receivable (ลูกหนี้การค้า) |
| Finance | FI-AP | Accounts Payable (เจ้าหนี้การค้า) |
| Finance | FI-AA | Fixed Assets (สินทรัพย์ถาวร) |
| Finance | FI-BL | Bank Reconciliation (กระทบยอดธนาคาร) |
| Finance | FI-TV | WHT Certificate (ใบหัก ณ ที่จ่าย ภ.ง.ด.3/53) |
| Finance | FI-TX | Tax Engine (VAT / WHT) |
| Controlling | CO-CC | Cost Centers (ศูนย์ต้นทุน) |
| Controlling | CO-PC | Profit Centers (ศูนย์กำไร) |
| Controlling | CO-BG | Budgeting (งบประมาณ) |
| Sales | SD-QT | Quotation (ใบเสนอราคา) |
| Sales | SD-SO | Sales Order (ใบสั่งขาย) |
| Sales | SD-DO | Delivery Note (ใบส่งของ) |
| Sales | SD-IV | Invoice (ใบแจ้งหนี้) |
| Sales | SD-RC | Receipt (ใบเสร็จรับเงิน) |
| Sales | SD-CN | Credit Note (ใบลดหนี้) |
| Sales | SD-PM | Payment (การรับชำระเงิน) |
| Procurement | MM-PO | Purchase Order (ใบสั่งซื้อ) |
| Inventory | MM-PR | Products (สินค้า/SKU) |
| Inventory | MM-WH | Warehouses (คลังสินค้า) |
| Inventory | MM-SM | Stock Movements (การเคลื่อนไหวสินค้า) |
| HR | HR-DP | Departments (แผนก) |
| HR | HR-EM | Employees (พนักงาน) |
| HR | HR-PY | Payroll (เงินเดือน) |
| HR | HR-LV | Leave Management (การลา) |
| CRM | CRM-CT | Contacts (ผู้ติดต่อ) |
| Reporting | RPT | Reports (รายงาน) |
| System | SYS-AU | Auth (การพิสูจน์ตัวตน) |
| System | SYS-RB | RBAC (การจัดการสิทธิ์) |
| System | SYS-MT | Multi-tenant (RLS) |
| System | SYS-WH | Webhooks / Import / Export |

**ช่องทางที่ทดสอบ:**
- REST API (Fastify — `/api/v1/...`)
- Web UI (Next.js / React)
- CLI (`neip` command)

**ไม่อยู่ในขอบเขต:**
- Third-party payment gateway integration (Stripe, PromptPay)
- Email delivery infrastructure (SMTP relay)
- AI/Agent layer (HITL Queue) — ทดสอบแยกต่างหาก
- Mobile native apps

### 1.3 เกณฑ์การผ่าน/ไม่ผ่าน (Pass/Fail Criteria)

#### เกณฑ์ผ่าน (Pass Criteria)

| เกณฑ์ | เป้าหมาย |
|-------|---------|
| Critical bugs outstanding | 0 |
| High severity bugs outstanding | 0 |
| Medium severity bugs outstanding | < 5 (พร้อม mitigation plan) |
| Test case execution rate | ≥ 95% |
| Test case pass rate | ≥ 98% |
| Code coverage (unit + integration) | ≥ 80% |
| Business cycle E2E tests | ผ่านทุก scenario 100% |
| Security scan (OWASP ZAP) | ไม่มี Critical/High vulnerability |
| Performance targets | ผ่านทุก SLA |
| Thai compliance checks | ผ่าน 100% |

#### เกณฑ์ไม่ผ่าน (Fail Criteria)

- มี Critical bug ที่ยังค้างอยู่แม้เพียง 1 รายการ
- ข้อมูลทางบัญชีไม่สมดุล (Debit ≠ Credit) ในกรณีใดๆ
- RLS ถูก bypass ข้ามเทนแนนต์ได้
- การคำนวณภาษี VAT หรือ WHT ผิดพลาด
- Payroll SSC คำนวณเกินหรือต่ำกว่า 750 THB cap
- ข้อมูลรหัสผ่านถูกจัดเก็บใน plain text

---

## 2. แนวทางการทดสอบ (Test Approach)

### 2.1 ระดับการทดสอบ (Testing Levels)

```
┌─────────────────────────────────────────────────────────────┐
│                    PRODUCTION MONITORING                    │
├─────────────────────────────────────────────────────────────┤
│              UAT (User Acceptance Testing)                  │
├─────────────────────────────────────────────────────────────┤
│         PERFORMANCE + SECURITY + COMPLIANCE TESTING         │
├─────────────────────────────────────────────────────────────┤
│              SYSTEM / END-TO-END TESTING                    │
├─────────────────────────────────────────────────────────────┤
│              INTEGRATION TESTING (API + DB)                 │
├─────────────────────────────────────────────────────────────┤
│                    UNIT TESTING                             │
└─────────────────────────────────────────────────────────────┘
```

| ระดับ | เครื่องมือ | ผู้รับผิดชอบ | เป้าหมาย Coverage |
|------|----------|------------|-----------------|
| Unit Test | Vitest | Developer | ≥ 85% ต่อ package |
| Integration Test | Vitest + supertest | Developer + QA | ≥ 80% |
| System / E2E | Playwright | QA | Business flows 100% |
| Performance | k6 | DevOps + QA | ตาม SLA table |
| Security | OWASP ZAP + manual | Security Engineer | OWASP Top 10 |
| UAT | Manual + Playwright | Business Owner | Sign-off ทุก module |

### 2.2 เครื่องมือที่ใช้ (Tools)

| หมวด | เครื่องมือ | วัตถุประสงค์ |
|-----|----------|------------|
| Unit/Integration | Vitest 3.x | Test runner, coverage (v8) |
| E2E Web | Playwright 1.x | Browser automation, screenshot |
| E2E API | curl / supertest | HTTP request automation |
| CLI | Jest / Vitest | CLI command testing |
| Performance | k6 | Load, stress, spike testing |
| Security | OWASP ZAP, sqlmap | Vulnerability scanning |
| Code Coverage | @vitest/coverage-v8 | Istanbul-compatible reports |
| Test Management | สร้างจาก Markdown → Notion | เก็บผลการทดสอบ |
| CI/CD | GitHub Actions | Automated test pipeline |
| Defect Tracking | GitHub Issues + Labels | Bug lifecycle management |

### 2.3 สภาพแวดล้อมการทดสอบ (Environments)

| Environment | วัตถุประสงค์ | ข้อมูล | ผู้เข้าถึง |
|------------|------------|-------|---------|
| `dev` | Unit + Integration tests | Seed data (faker) | Developer |
| `staging` | System + E2E + Performance | Anonymized production-like | QA + PO |
| `uat` | UAT + Sign-off | Business scenario data | Business Owner |
| `production` | Smoke tests post-deploy | Live data | DevOps only |

### 2.4 Test Data Strategy

- **Monetary values:** ทุก amount ใช้ `bigint` หน่วย satang (1 THB = 100 satang) เพื่อหลีกเลี่ยง floating-point error
- **Thai dates:** ทดสอบทั้ง Buddhist Era (พ.ศ.) และ Christian Era (ค.ศ.) — ปี 2568/2026
- **Tax IDs:** ใช้ test TIN รูปแบบ 13 หลักที่ถูกต้อง (0-1234567890-1)
- **Multi-tenant:** ทดสอบด้วย ≥ 3 tenants ขนาน เพื่อยืนยัน RLS isolation
- **Boundary values:** 0 satang, 1 satang, 999,999,999,999 satang (≈ 10 พันล้านบาท)

### 2.5 CI/CD Integration

```yaml
# Pipeline stages
test:unit      → vitest run --coverage          (PR gate)
test:lint      → eslint + tsc --noEmit           (PR gate)
test:integration → vitest run --config vitest.integration.config.ts  (PR gate)
test:e2e       → playwright test                 (staging deploy)
test:security  → zap-scan.sh + npm audit         (weekly + pre-release)
test:performance → k6 run scripts/load-test.js   (pre-release)
```

---

## 3. แผนทดสอบรายโมดูล (Module Test Plans)

> **คำอธิบายคอลัมน์:**
> - **รหัส** = รหัสกรณีทดสอบ (format: MODULE-NNN)
> - **ช่องทาง** = API / Web / CLI / ALL
> - **ระดับ** = Critical / High / Medium / Low

---

### 3.1 FI-GL: General Ledger (บัญชีแยกประเภท)

#### 3.1.1 Chart of Accounts (ผังบัญชี)

| รหัส | กรณีทดสอบ | ขั้นตอน | ข้อมูลทดสอบ | ผลที่คาดหวัง | ช่องทาง | ระดับ |
|------|-----------|---------|-------------|-------------|---------|-------|
| GL-001 | สร้างบัญชีใหม่ (Happy Path) | POST /gl/accounts พร้อมข้อมูลครบถ้วน | code:"1100", name:"เงินสด", type:"asset" | HTTP 201, id ถูกสร้าง, document_number ถูกกำหนด | API | Critical |
| GL-002 | สร้างบัญชีซ้ำ code | POST /gl/accounts ด้วย code ที่มีอยู่แล้ว | code:"1100" (ซ้ำ) | HTTP 409 Conflict, error.code = "CONFLICT" | API | Critical |
| GL-003 | ดึงรายการบัญชีทั้งหมด | GET /gl/accounts | — | HTTP 200, array ของบัญชี, pagination fields ครบ | API | High |
| GL-004 | ค้นหาบัญชีตาม type | GET /gl/accounts?type=asset | — | เฉพาะบัญชีประเภท asset | API | Medium |
| GL-005 | สร้างบัญชีไม่มี code | POST /gl/accounts ไม่ส่ง code | body ไม่มี code | HTTP 400, validation error | API | High |
| GL-006 | สร้างบัญชีด้วยภาษาไทย | POST /gl/accounts | name:"เงินสดและรายการเทียบเท่าเงินสด", description:"Thai text with special chars ก-๙" | HTTP 201, name บันทึกถูกต้อง | API | High |
| GL-007 | Tenant isolation — บัญชี | GET /gl/accounts ด้วย token ของ Tenant B | บัญชีของ Tenant A | HTTP 200 ผลลัพธ์ว่าง (ไม่รั่วข้ามเทนแนนต์) | API | Critical |
| GL-008 | ลบบัญชีที่มี JE อ้างอิง | DELETE /gl/accounts/:id | account มี journal_entry_lines | HTTP 409 หรือ 400 — ไม่อนุญาตให้ลบ | API | Critical |
| GL-009 | แสดง Chart of Accounts บน Web | เปิด /accounting/chart-of-accounts | — | ตารางแสดง accounts ครบถ้วน, filter ทำงาน | Web | High |
| GL-010 | สร้างบัญชีผ่าน CLI | `neip gl accounts create --code 2100 --name "เจ้าหนี้"` | — | Output แสดง success + id | CLI | Medium |

#### 3.1.2 Journal Entries (รายการบันทึกบัญชี)

| รหัส | กรณีทดสอบ | ขั้นตอน | ข้อมูลทดสอบ | ผลที่คาดหวัง | ช่องทาง | ระดับ |
|------|-----------|---------|-------------|-------------|---------|-------|
| GL-011 | สร้าง JE สมดุล (Happy Path) | POST /journal-entries พร้อม lines สมดุล | debit:"10000", credit:"10000" (satang) | HTTP 201, status="draft", debit=credit | API | Critical |
| GL-012 | สร้าง JE ไม่สมดุล | POST /journal-entries | debit:"10000", credit:"9999" | HTTP 400, "Journal entry is not balanced" | API | Critical |
| GL-013 | Post JE draft | POST /journal-entries/:id/post | JE ที่ status="draft" | HTTP 200, status="posted", posted_at ถูกกำหนด | API | Critical |
| GL-014 | Post JE ที่ posted แล้ว | POST /journal-entries/:id/post | JE ที่ status="posted" | HTTP 409, ไม่อนุญาต double-post | API | Critical |
| GL-015 | Reverse JE posted | POST /journal-entries/:id/reverse | JE ที่ status="posted" | HTTP 201, JE ใหม่สร้าง (reversal), ต้นฉบับ status="reversed" | API | Critical |
| GL-016 | Reverse JE draft | POST /journal-entries/:id/reverse | JE ที่ status="draft" | HTTP 409, ไม่สามารถ reverse draft | API | High |
| GL-017 | Reverse JE ที่ reversed แล้ว | POST /journal-entries/:id/reverse | JE status="reversed" | HTTP 409 | API | High |
| GL-018 | JE มี lines น้อยกว่า 2 รายการ | POST /journal-entries | lines: [1 item เท่านั้น] | HTTP 400, "minimum 2 lines" | API | Critical |
| GL-019 | JE ปิดงวดแล้ว (closed period) | POST /journal-entries | fiscalPeriod = period ที่ closed | HTTP 409, "Period is closed" | API | Critical |
| GL-020 | Idempotency Key — JE | POST /journal-entries 2 ครั้ง พร้อม X-Idempotency-Key เดียวกัน | key: "test-idem-001" | ครั้งที่ 2 return HTTP 200 พร้อม JE เดิม (ไม่สร้างซ้ำ) | API | Critical |
| GL-021 | JE Amount = 0 satang | POST /journal-entries | debit:"0", credit:"0" | HTTP 400, amount ต้องมากกว่า 0 | API | High |
| GL-022 | JE Amount ขนาดใหญ่มาก | POST /journal-entries | debit:"999999999999" (bigint) | HTTP 201, บันทึกถูกต้อง (bigint support) | API | High |
| GL-023 | ไม่มี permission gl:journal:create | POST /journal-entries ด้วย role ที่ไม่มีสิทธิ์ | token ของ user role Viewer | HTTP 403 Forbidden | API | Critical |
| GL-024 | แสดง JE บน Web | เปิด /accounting/journal-entries/:id | posted JE | แสดง lines, status, posted_at, audit trail | Web | High |
| GL-025 | Audit log สร้างเมื่อ post JE | ตรวจสอบ audit_logs หลัง POST /journal-entries/:id/post | — | record ใน audit_logs: action="post", entity_type="journal_entry" | API | Critical |

#### 3.1.3 Fiscal Years / Periods (ปีบัญชี / งวดบัญชี)

| รหัส | กรณีทดสอบ | ขั้นตอน | ข้อมูลทดสอบ | ผลที่คาดหวัง | ช่องทาง | ระดับ |
|------|-----------|---------|-------------|-------------|---------|-------|
| GL-026 | สร้าง Fiscal Year | POST /gl/fiscal-years | year: 2026, start: "2026-01-01", end: "2026-12-31" | HTTP 201, 12 periods ถูกสร้างอัตโนมัติ | API | Critical |
| GL-027 | ปิด Fiscal Period | POST /gl/fiscal-periods/:id/close | period ที่ open | HTTP 200, status="closed" | API | Critical |
| GL-028 | เปิด Period ที่ closed แล้ว | POST /gl/fiscal-periods/:id/reopen | period ที่ closed | HTTP 200 หรือ 409 ตาม policy (require permission) | API | High |
| GL-029 | ปิด Year ที่ยังมี open periods | POST /gl/fiscal-years/:id/close | year ที่มี period open | HTTP 409, "ยังมี open periods" | API | Critical |

---

### 3.2 FI-AR: Accounts Receivable (ลูกหนี้การค้า)

#### 3.2.1 AR Invoices (ใบแจ้งหนี้)

| รหัส | กรณีทดสอบ | ขั้นตอน | ข้อมูลทดสอบ | ผลที่คาดหวัง | ช่องทาง | ระดับ |
|------|-----------|---------|-------------|-------------|---------|-------|
| AR-001 | สร้าง Invoice พร้อม VAT 7% | POST /ar/invoices | amount: 100,000 satang, vat_rate: 7% | HTTP 201, vat_amount=7,000, total=107,000 satang | API | Critical |
| AR-002 | Post Invoice (draft → posted) | POST /ar/invoices/:id/post | Invoice status="draft" | HTTP 200, status="posted", JE ถูกสร้าง (Dr AR / Cr Revenue + VAT) | API | Critical |
| AR-003 | Void Invoice ที่ posted | POST /ar/invoices/:id/void | Invoice status="posted", ไม่มี payment | HTTP 200, status="voided", reversal JE ถูกสร้าง | API | Critical |
| AR-004 | Void Invoice ที่มี payment แล้ว | POST /ar/invoices/:id/void | Invoice มี payment linked | HTTP 409, "Invoice has been partially or fully paid" | API | Critical |
| AR-005 | Invoice VAT ผิดรูปแบบ | POST /ar/invoices | vat_rate: 15 (ไม่ใช่ 7%) | HTTP 400 หรือ warning — ตรวจสอบ rate | API | High |
| AR-006 | Invoice ไม่มี customer | POST /ar/invoices | ไม่ส่ง customer_id | HTTP 400, "customer_id required" | API | High |
| AR-007 | Invoice ยอดรวม 0 บาท | POST /ar/invoices | lines ทุกรายการ amount=0 | HTTP 400, "Invoice total must be > 0" | API | High |
| AR-008 | Invoice ลูกค้าต่างเทนแนนต์ | POST /ar/invoices | customer_id ของ Tenant B ใน request Tenant A | HTTP 404 (customer not found in tenant) | API | Critical |
| AR-009 | ดูรายการ Invoice บน Web | /ar/invoices | — | ตารางแสดง status badges, amount formatted, วันที่ครบ | Web | High |
| AR-010 | Export Invoice PDF | GET /ar/invoices/:id/pdf | posted Invoice | PDF ดาวน์โหลดได้, มีเลข Invoice, ชื่อบริษัท, VAT, ยอดรวม | API/Web | High |

#### 3.2.2 AR Payments (การรับชำระเงิน)

| รหัส | กรณีทดสอบ | ขั้นตอน | ข้อมูลทดสอบ | ผลที่คาดหวัง | ช่องทาง | ระดับ |
|------|-----------|---------|-------------|-------------|---------|-------|
| AR-011 | รับชำระเงินเต็มจำนวน | POST /ar/payments | amount = total invoice, invoice_id | HTTP 201, invoice status → "paid", JE: Dr Bank / Cr AR | API | Critical |
| AR-012 | รับชำระบางส่วน (Partial) | POST /ar/payments | amount < total invoice | HTTP 201, invoice status → "partially_paid", outstanding balance อัปเดต | API | Critical |
| AR-013 | รับชำระเกินยอด | POST /ar/payments | amount > total invoice | HTTP 400 หรือ over-payment handling | API | High |
| AR-014 | Payment Matching หลาย Invoice | POST /ar/payments | amount ตรงกับผลรวมหลาย invoices | HTTP 201, ทุก invoice ถูก matched | API | High |
| AR-015 | Void Payment | POST /ar/payments/:id/void | payment ที่ issued | HTTP 200, invoice กลับสู่ outstanding, reversal JE | API | Critical |
| AR-016 | Double-submit Payment | POST /ar/payments 2 ครั้ง พร้อมกัน | amount, invoice_id เดียวกัน | ชำระได้เพียง 1 ครั้ง (concurrency guard) | API | Critical |

---

### 3.3 FI-AP: Accounts Payable (เจ้าหนี้การค้า)

| รหัส | กรณีทดสอบ | ขั้นตอน | ข้อมูลทดสอบ | ผลที่คาดหวัง | ช่องทาง | ระดับ |
|------|-----------|---------|-------------|-------------|---------|-------|
| AP-001 | สร้าง Bill จาก PO | POST /ap/bills (linked to PO) | po_id ที่ status="received" | HTTP 201, bill สร้างจาก PO lines, amounts ตรงกัน | API | Critical |
| AP-002 | สร้าง Bill อิสระ | POST /ap/bills ไม่ link PO | vendor_id, lines, due_date | HTTP 201, status="draft" | API | High |
| AP-003 | Approve Bill | POST /ap/bills/:id/approve | bill status="draft" | HTTP 200, status="approved", JE: Dr Expense / Cr AP | API | Critical |
| AP-004 | Bill Payment พร้อม WHT | POST /ap/bill-payments | bill_id, wht_rate=3%, amount | HTTP 201, wht_certificate ถูกสร้างอัตโนมัติ, payment = net amount | API | Critical |
| AP-005 | Bill Payment เกินวงเงิน | POST /ap/bill-payments | amount > bill outstanding | HTTP 400 | API | High |
| AP-006 | ลบ Bill ที่ approved แล้ว | DELETE /ap/bills/:id | status="approved" | HTTP 409, ไม่อนุญาต | API | Critical |
| AP-007 | AP Aging คำนวณถูกต้อง | GET /reports/ap-aging | bills ที่เลยวันครบกำหนด 30, 60, 90 วัน | แต่ละ bucket ถูกต้อง (0-30, 31-60, 61-90, 90+ วัน) | API | Critical |
| AP-008 | Tenant isolation — Vendor | GET /ap/vendors ด้วย Tenant B token | vendors ของ Tenant A | ผลลัพธ์ว่าง | API | Critical |

---

### 3.4 FI-AA: Fixed Assets (สินทรัพย์ถาวร)

| รหัส | กรณีทดสอบ | ขั้นตอน | ข้อมูลทดสอบ | ผลที่คาดหวัง | ช่องทาง | ระดับ |
|------|-----------|---------|-------------|-------------|---------|-------|
| AA-001 | ลงทะเบียนสินทรัพย์ใหม่ | POST /fixed-assets | purchase_cost: 500,000 THB, useful_life_months: 60, method: "straight_line" | HTTP 201, net_book_value = purchase_cost | API | Critical |
| AA-002 | คำนวณค่าเสื่อมราคา (Straight Line) | POST /fixed-assets/:id/depreciate | month: 1 | ค่าเสื่อม = (500,000 - salvage) / 60 ต่อเดือน, accumulated_depreciation อัปเดต | API | Critical |
| AA-003 | คำนวณค่าเสื่อมราคา (Declining Balance) | POST /fixed-assets/:id/depreciate | method="declining_balance", rate=20% | ค่าเสื่อม = NBV × rate, บันทึกถูกต้อง | API | Critical |
| AA-004 | ค่าเสื่อมไม่เกิน NBV | POST /fixed-assets/:id/depreciate (เดือนสุดท้าย) | accumulated ≈ purchase_cost | ค่าเสื่อมเดือนสุดท้ายถูก cap ที่ NBV เหลือ | API | Critical |
| AA-005 | จำหน่ายสินทรัพย์ (Disposal) | POST /fixed-assets/:id/dispose | disposal_amount: 200,000 THB, disposal_date | HTTP 200, status="disposed", gain/loss JE ถูกสร้าง | API | Critical |
| AA-006 | จำหน่ายสินทรัพย์ที่ disposed แล้ว | POST /fixed-assets/:id/dispose | status="disposed" | HTTP 409 | API | High |
| AA-007 | Fixed Asset Register Report | GET /reports/fixed-asset-register | — | ทุก asset แสดง: cost, accumulated_depreciation, NBV, status | API | High |
| AA-008 | สร้างสินทรัพย์ useful_life = 0 | POST /fixed-assets | useful_life_months: 0 | HTTP 400, validation error | API | High |
| AA-009 | ค่าเสื่อมสร้าง JE อัตโนมัติ | POST /fixed-assets/:id/depreciate | — | JE: Dr Depreciation Expense / Cr Accumulated Depreciation ถูกสร้าง | API | Critical |
| AA-010 | สินทรัพย์ salvage_value เกิน cost | POST /fixed-assets | salvage_value > purchase_cost | HTTP 400 | API | High |

---

### 3.5 FI-BL: Bank Reconciliation (กระทบยอดธนาคาร)

| รหัส | กรณีทดสอบ | ขั้นตอน | ข้อมูลทดสอบ | ผลที่คาดหวัง | ช่องทาง | ระดับ |
|------|-----------|---------|-------------|-------------|---------|-------|
| BL-001 | สร้าง Bank Account | POST /bank/accounts | name:"กสิกร เลขที่ xxx", currency:"THB" | HTTP 201 | API | High |
| BL-002 | Import Bank Statement (CSV) | POST /bank/accounts/:id/import | CSV ที่ถูกต้อง 50 รายการ | HTTP 200, 50 transactions นำเข้า, duplicates ไม่ถูกสร้างซ้ำ | API | Critical |
| BL-003 | Import CSV รูปแบบผิด | POST /bank/accounts/:id/import | CSV ไม่มี header | HTTP 400, parsing error details | API | High |
| BL-004 | Match Bank Transaction กับ Payment | POST /bank/transactions/:id/match | transaction_id + payment_id | HTTP 200, transaction status="matched" | API | Critical |
| BL-005 | Reconciliation Report สมดุล | GET /bank/accounts/:id/reconciliation | หลัง match ทุกรายการ | GL balance = Bank statement balance | API | Critical |
| BL-006 | Unmatched transactions alert | GET /bank/transactions?status=unmatched | — | list รายการที่ยังไม่ match พร้อม aging | API | High |
| BL-007 | Duplicate import detection | Import CSV เดิม 2 ครั้ง | transactions เดิม | ครั้งที่ 2 skip duplicates, report จำนวน skipped | API | Critical |

---

### 3.6 FI-TX: Tax Engine (VAT / WHT)

| รหัส | กรณีทดสอบ | ขั้นตอน | ข้อมูลทดสอบ | ผลที่คาดหวัง | ช่องทาง | ระดับ |
|------|-----------|---------|-------------|-------------|---------|-------|
| TX-001 | คำนวณ VAT 7% บน exclusive amount | calculateVAT(100000, "exclusive") | base: 100,000 satang | vat: 7,000, total: 107,000 satang | Unit | Critical |
| TX-002 | คำนวณ VAT 7% บน inclusive amount | calculateVAT(107000, "inclusive") | total: 107,000 satang | vat: 7,000, base: 100,000 satang | Unit | Critical |
| TX-003 | คำนวณ WHT 3% (ประเภท 3 — ค่าบริการ) | calculateWHT(100000, income_type:"3") | base: 100,000 satang | wht: 3,000 satang | Unit | Critical |
| TX-004 | คำนวณ WHT 5% (ประเภท 2 — ค่าเช่า) | calculateWHT(100000, income_type:"2") | base: 100,000 satang | wht: 5,000 satang | Unit | Critical |
| TX-005 | คำนวณ WHT 15% (เงินปันผล) | calculateWHT(100000, income_type:"4") | base: 100,000 satang | wht: 15,000 satang | Unit | Critical |
| TX-006 | VAT บน amount = 0 | calculateVAT(0, "exclusive") | base: 0 | vat: 0, total: 0 | Unit | High |
| TX-007 | Rounding — satang rounding | calculateTaxAmount(100001, 7) | base: 100,001 satang | วิธี round ถูกต้อง (floor/round per TRD rule) | Unit | Critical |
| TX-008 | Thai Buddhist Era date | formatThaiDate("2026-03-15") | — | "15 มีนาคม 2569" | Unit | Critical |
| TX-009 | Tax Rate จาก DB | TaxRateService.getRate("vat") | tenant ที่มี tax_rates | return rate ถูกต้องจาก DB | Integration | High |
| TX-010 | WHT Certificate ภ.ง.ด.3 | POST /wht draft → issued | payer/payee TIN 13 หลัก, income_type, amount | certificate_number ถูกกำหนด, ทุก field ถูกต้อง | API | Critical |
| TX-011 | WHT Certificate ภ.ง.ด.53 | POST /wht certificate_type="pnd53" | juristic person payee | HTTP 201, certificate_type="pnd53" | API | Critical |
| TX-012 | Void WHT Certificate | POST /wht/:id/void | status="issued" | HTTP 200, status="voided" | API | Critical |
| TX-013 | File WHT Certificate | POST /wht/:id/file | status="issued" | HTTP 200, status="filed", filed_at ถูกกำหนด | API | Critical |
| TX-014 | WHT Summary Report | GET /reports/wht-summary?month=3&year=2026 | — | รายการทุก certificate ของเดือน, ยอดรวม wht_amount | API | Critical |
| TX-015 | WHT rate ไม่ถูกต้อง (0 basis points) | POST /wht | wht_rate_basis_points: 0 | HTTP 400 | API | High |


---

### 3.7 CO: Controlling (Cost Centers / Profit Centers / Budgets)

| รหัส | กรณีทดสอบ | ขั้นตอน | ข้อมูลทดสอบ | ผลที่คาดหวัง | ช่องทาง | ระดับ |
|------|-----------|---------|-------------|-------------|---------|-------|
| CO-001 | สร้าง Cost Center | POST /cost-centers | code:"CC01", name:"ฝ่ายขาย" | HTTP 201 | API | High |
| CO-002 | Cost Center code ซ้ำ | POST /cost-centers | code ซ้ำกับที่มีอยู่ | HTTP 409 | API | High |
| CO-003 | สร้าง Profit Center | POST /profit-centers | code:"PC01", name:"สาขากรุงเทพ" | HTTP 201 | API | High |
| CO-004 | ตั้งงบประมาณรายบัญชี | POST /budgets | account_id, fiscal_year:2026, amount_satang | HTTP 201 | API | High |
| CO-005 | งบประมาณซ้ำ (same account + year) | POST /budgets | account_id + fiscal_year ซ้ำ | HTTP 409, unique constraint | API | Critical |
| CO-006 | Budget Variance Report | GET /reports/budget-variance?year=2026 | — | actual vs budget per account, variance %, คอลัมน์ครบ | API | Critical |
| CO-007 | Budget Variance รายงานไม่มีงบ | GET /reports/budget-variance?year=2025 | ปีที่ไม่มีงบ | HTTP 200, empty dataset หรือ message | API | Medium |
| CO-008 | Budget amount = 0 | POST /budgets | amount_satang: 0 | HTTP 400 หรือ allowed (policy decision — ต้องระบุ) | API | Medium |

---

### 3.8 SD-QT: Quotation (ใบเสนอราคา)

| รหัส | กรณีทดสอบ | ขั้นตอน | ข้อมูลทดสอบ | ผลที่คาดหวัง | ช่องทาง | ระดับ |
|------|-----------|---------|-------------|-------------|---------|-------|
| QT-001 | สร้าง Quotation (draft) | POST /quotations | customer_id, lines, valid_until | HTTP 201, status="draft", document_number ถูกกำหนด | API | Critical |
| QT-002 | ส่ง Quotation (draft → sent) | POST /quotations/:id/send | status="draft" | HTTP 200, status="sent" | API | Critical |
| QT-003 | Approve Quotation (sent → approved) | POST /quotations/:id/approve | status="sent" | HTTP 200, status="approved" | API | Critical |
| QT-004 | Reject Quotation | POST /quotations/:id/reject | status="sent" | HTTP 200, status="rejected" | API | High |
| QT-005 | Convert QT → Invoice | POST /quotations/:id/convert | status="approved" | HTTP 201, Invoice ใหม่สร้างจาก QT lines, QT status="converted" | API | Critical |
| QT-006 | Convert QT ที่ rejected | POST /quotations/:id/convert | status="rejected" | HTTP 409, invalid state transition | API | Critical |
| QT-007 | QT หมดอายุ (expired) | ตรวจสอบ status เมื่อ valid_until < today | valid_until: เมื่อวานนี้ | status="expired" (cron หรือ lazy eval) | API | High |
| QT-008 | QT ไม่มี lines | POST /quotations | lines: [] | HTTP 400 | API | High |
| QT-009 | QT transition ไม่ถูกต้อง (draft → approved) | POST /quotations/:id/approve | status="draft" (ข้าม sent) | HTTP 409, invalid transition | API | Critical |
| QT-010 | แสดง QT บน Web พร้อม status badge | /quotations/:id | — | status badge ถูกสี, lines ครบ, valid_until แสดง | Web | High |

---

### 3.9 SD-SO: Sales Order (ใบสั่งขาย)

| รหัส | กรณีทดสอบ | ขั้นตอน | ข้อมูลทดสอบ | ผลที่คาดหวัง | ช่องทาง | ระดับ |
|------|-----------|---------|-------------|-------------|---------|-------|
| SO-001 | สร้าง SO (draft) | POST /sales-orders | customer_id, lines | HTTP 201, status="draft" | API | Critical |
| SO-002 | Confirm SO (draft → confirmed) | POST /sales-orders/:id/confirm | status="draft" | HTTP 200, status="confirmed" | API | Critical |
| SO-003 | สร้าง DO จาก SO | POST /delivery-notes จาก SO | so_id ที่ confirmed | HTTP 201, DO สร้างพร้อม lines จาก SO | API | Critical |
| SO-004 | Cancel SO ที่ confirmed | POST /sales-orders/:id/cancel | status="confirmed" | HTTP 200, status="cancelled" | API | High |
| SO-005 | Cancel SO ที่ delivered แล้ว | POST /sales-orders/:id/cancel | status="delivered" | HTTP 409 | API | Critical |
| SO-006 | SO ตรวจสอบ stock เพียงพอ | POST /sales-orders | qty เกิน stock ปัจจุบัน | Warning หรือ block (ตาม business policy) | API | High |

---

### 3.10 SD-DO: Delivery Note (ใบส่งของ)

| รหัส | กรณีทดสอบ | ขั้นตอน | ข้อมูลทดสอบ | ผลที่คาดหวัง | ช่องทาง | ระดับ |
|------|-----------|---------|-------------|-------------|---------|-------|
| DO-001 | สร้าง Delivery Note | POST /delivery-notes | so_id, lines | HTTP 201, status="draft" | API | Critical |
| DO-002 | Mark Delivered (draft → delivered) | POST /delivery-notes/:id/deliver | status="draft" | HTTP 200, status="delivered", stock movement ถูกสร้าง (issue) | API | Critical |
| DO-003 | Stock movement เกิดเมื่อ deliver | POST /delivery-notes/:id/deliver | — | stock_movement: type="issue", qty ลดจาก warehouse | API | Critical |
| DO-004 | Deliver โดยไม่มี stock | POST /delivery-notes/:id/deliver | stock = 0 สำหรับ product | HTTP 409 หรือ warning | API | High |

---

### 3.11 SD-RC: Receipt (ใบเสร็จรับเงิน)

| รหัส | กรณีทดสอบ | ขั้นตอน | ข้อมูลทดสอบ | ผลที่คาดหวัง | ช่องทาง | ระดับ |
|------|-----------|---------|-------------|-------------|---------|-------|
| RC-001 | ออกใบเสร็จ | POST /receipts | payment_id, invoice_id | HTTP 201, status="issued", receipt_number ถูกกำหนด | API | Critical |
| RC-002 | Void ใบเสร็จ | POST /receipts/:id/void | status="issued" | HTTP 200, status="voided" | API | Critical |
| RC-003 | Void ใบเสร็จที่ voided แล้ว | POST /receipts/:id/void | status="voided" | HTTP 409 | API | High |
| RC-004 | Receipt PDF export | GET /receipts/:id/pdf | status="issued" | PDF ดาวน์โหลดได้, เลขที่ใบเสร็จ, วันที่, ยอดชำระ ครบ | API | High |

---

### 3.12 SD-CN: Credit Note (ใบลดหนี้)

| รหัส | กรณีทดสอบ | ขั้นตอน | ข้อมูลทดสอบ | ผลที่คาดหวัง | ช่องทาง | ระดับ |
|------|-----------|---------|-------------|-------------|---------|-------|
| CN-001 | สร้าง Credit Note (draft) | POST /credit-notes | invoice_id, reason, amount | HTTP 201, status="draft" | API | Critical |
| CN-002 | Issue Credit Note (draft → issued) | POST /credit-notes/:id/issue | status="draft" | HTTP 200, status="issued", JE reversal ถูกสร้าง | API | Critical |
| CN-003 | Void Credit Note | POST /credit-notes/:id/void | status="issued" | HTTP 200, status="voided" | API | Critical |
| CN-004 | CN มียอดเกิน Invoice | POST /credit-notes | cn_amount > invoice_total | HTTP 400 | API | Critical |
| CN-005 | CN link ไปยัง voided Invoice | POST /credit-notes | invoice_id ที่ status="voided" | HTTP 409 | API | High |

---

### 3.13 MM-PO: Purchase Order (ใบสั่งซื้อ)

| รหัส | กรณีทดสอบ | ขั้นตอน | ข้อมูลทดสอบ | ผลที่คาดหวัง | ช่องทาง | ระดับ |
|------|-----------|---------|-------------|-------------|---------|-------|
| PO-001 | สร้าง PO (draft) | POST /purchase-orders | vendor_id, lines, expected_delivery | HTTP 201, status="draft" | API | Critical |
| PO-002 | ส่ง PO (draft → sent) | POST /purchase-orders/:id/send | status="draft" | HTTP 200, status="sent" | API | Critical |
| PO-003 | รับสินค้า (sent → received) | POST /purchase-orders/:id/receive | status="sent", received_qty per line | HTTP 200, status="received", stock_movement: type="receive" ถูกสร้าง | API | Critical |
| PO-004 | Convert PO → Bill | POST /purchase-orders/:id/convert-to-bill | status="received" | HTTP 201, Bill สร้างจาก PO lines, PO status="converted" | API | Critical |
| PO-005 | PO Partial Receive | POST /purchase-orders/:id/receive | received_qty < ordered_qty | HTTP 200, PO status="partially_received" | API | High |
| PO-006 | PO ไม่มี vendor | POST /purchase-orders | ไม่ส่ง vendor_id | HTTP 400 | API | High |
| PO-007 | รับสินค้า PO ที่ converted แล้ว | POST /purchase-orders/:id/receive | status="converted" | HTTP 409 | API | Critical |

---

### 3.14 MM Inventory: Products / Warehouses / Stock Movements

| รหัส | กรณีทดสอบ | ขั้นตอน | ข้อมูลทดสอบ | ผลที่คาดหวัง | ช่องทาง | ระดับ |
|------|-----------|---------|-------------|-------------|---------|-------|
| INV-001 | สร้าง Product (SKU) | POST /products | sku:"SKU001", name:"สินค้าทดสอบ", cost_satang, selling_price_satang, min_stock:10 | HTTP 201 | API | High |
| INV-002 | SKU ซ้ำ | POST /products | sku ที่มีอยู่แล้ว | HTTP 409 | API | High |
| INV-003 | สร้าง Warehouse | POST /warehouses | code:"WH01", name:"คลังกรุงเทพ" | HTTP 201 | API | High |
| INV-004 | รับสินค้าเข้าคลัง (receive) | POST /stock-movements | type:"receive", product_id, warehouse_id, qty:100 | HTTP 201, stock level เพิ่มขึ้น 100 | API | Critical |
| INV-005 | เบิกสินค้า (issue) | POST /stock-movements | type:"issue", qty:50 | HTTP 201, stock level ลดลง 50 | API | Critical |
| INV-006 | เบิกสินค้าเกิน stock | POST /stock-movements | type:"issue", qty > current_stock | HTTP 409, "Insufficient stock" | API | Critical |
| INV-007 | โอนย้ายสินค้า (transfer) | POST /stock-movements | type:"transfer", from_warehouse, to_warehouse, qty | HTTP 201, from ลดลง, to เพิ่มขึ้น, net balance ไม่เปลี่ยน | API | Critical |
| INV-008 | ปรับยอด (adjust) | POST /stock-movements | type:"adjust", qty: -5 (negative) | HTTP 201, stock ลดตามที่ปรับ | API | High |
| INV-009 | Low Stock Alert | GET /reports/low-stock | product min_stock=10, current_stock=5 | product ปรากฏใน report | API | High |
| INV-010 | Inventory Valuation (FIFO/Average) | GET /reports/stock-valuation | — | ยอดรวมมูลค่าสินค้าถูกต้อง per warehouse | API | Critical |
| INV-011 | Stock Movement Audit Trail | สร้าง movement แล้วดู audit_logs | — | audit log record ทุก movement: user, timestamp, qty, type | API | Critical |
| INV-012 | Transfer ระหว่าง Tenant ไม่ได้ | POST /stock-movements | warehouse_id ของ Tenant อื่น | HTTP 404 | API | Critical |

---

### 3.15 HR: Departments / Employees

| รหัส | กรณีทดสอบ | ขั้นตอน | ข้อมูลทดสอบ | ผลที่คาดหวัง | ช่องทาง | ระดับ |
|------|-----------|---------|-------------|-------------|---------|-------|
| HR-001 | สร้าง Department | POST /departments | code:"SALE", name:"ฝ่ายขาย" | HTTP 201 | API | Medium |
| HR-002 | จ้างพนักงานใหม่ | POST /employees | first_name_th, last_name_th, national_id, hire_date, department_id, salary_satang | HTTP 201, status="active" | API | Critical |
| HR-003 | National ID ซ้ำ | POST /employees | national_id ที่มีอยู่แล้ว | HTTP 409 | API | Critical |
| HR-004 | National ID รูปแบบผิด | POST /employees | national_id: "1234" (ไม่ใช่ 13 หลัก) | HTTP 400 | API | High |
| HR-005 | ลาออกพนักงาน | POST /employees/:id/resign | status="active", resign_date | HTTP 200, status="resigned" | API | High |
| HR-006 | พนักงานที่ resigned ไม่อยู่ใน payroll | POST /payroll/:id/calculate | employee resigned ก่อน pay_period | พนักงานไม่ถูกรวมในการคำนวณ | API | Critical |
| HR-007 | ข้อมูลชื่อภาษาไทย | POST /employees | first_name_th:"สมชาย", last_name_th:"ใจดี" | บันทึกและดึงข้อมูลถูกต้อง, ไม่มี encoding error | API | High |

---

### 3.16 HR-PY: Payroll (เงินเดือน)

| รหัส | กรณีทดสอบ | ขั้นตอน | ข้อมูลทดสอบ | ผลที่คาดหวัง | ช่องทาง | ระดับ |
|------|-----------|---------|-------------|-------------|---------|-------|
| PY-001 | สร้าง Payroll Run | POST /payroll | pay_period_start, pay_period_end, run_date | HTTP 201, status="draft" | API | Critical |
| PY-002 | คำนวณ Payroll | POST /payroll/:id/calculate | status="draft", employees active | HTTP 200, status="calculated", items สร้าง per employee | API | Critical |
| PY-003 | SSC คำนวณถูกต้อง — เงินเดือน 15,000 บาท | POST /payroll/:id/calculate | salary: 1,500,000 satang | SSC employee = 75,000 satang (750 THB — cap), SSC employer = 75,000 satang | API | Critical |
| PY-004 | SSC คำนวณถูกต้อง — เงินเดือน 10,000 บาท | POST /payroll/:id/calculate | salary: 1,000,000 satang | SSC = 50,000 satang (10,000 × 5% = 500 THB — ต่ำกว่า cap) | API | Critical |
| PY-005 | SSC คำนวณถูกต้อง — เงินเดือน 20,000 บาท | POST /payroll/:id/calculate | salary: 2,000,000 satang | SSC = 75,000 satang (cap ที่ 750 THB) | API | Critical |
| PY-006 | PIT คำนวณ (เงินเดือน 50,000 บาท/เดือน) | POST /payroll/:id/calculate | salary: 5,000,000 satang/month | PIT คำนวณตาม bracket ที่กำหนดใน calcPIT() | API | Critical |
| PY-007 | Approve Payroll | POST /payroll/:id/approve | status="calculated" | HTTP 200, status="approved", approved_by ถูกบันทึก | API | Critical |
| PY-008 | Pay Payroll | POST /payroll/:id/pay | status="approved" | HTTP 200, status="paid", JE: Dr Salary Expense / Cr Cash ถูกสร้าง | API | Critical |
| PY-009 | Payroll JE balance check | หลัง POST /payroll/:id/pay | — | JE debit = JE credit = total_net_satang + total_employer_ssc_satang | API | Critical |
| PY-010 | Approve payroll ที่ไม่ใช่ calculated | POST /payroll/:id/approve | status="draft" | HTTP 409, invalid transition | API | Critical |
| PY-011 | Double-calculate Payroll | POST /payroll/:id/calculate 2 ครั้ง | status="calculated" | HTTP 409, ไม่ recalculate | API | High |
| PY-012 | Payslip per employee | GET /payroll/:id/payslips | — | แต่ละ employee มี: gross, ssc_employee, pit, net | API | High |
| PY-013 | ปรับรายการ Payroll item | PUT /payroll/:id/items/:itemId | bonus_satang: 50,000 | item อัปเดต, total recalculate | API | High |
| PY-014 | Payroll ไม่มีพนักงาน active | POST /payroll/:id/calculate | ไม่มี active employee ใน tenant | HTTP 200, total_gross=0 หรือ warning | API | Medium |
| PY-015 | ไม่มีสิทธิ์ hr:payroll:approve | POST /payroll/:id/approve | role ที่ไม่มีสิทธิ์ | HTTP 403 | API | Critical |

---

### 3.17 HR-LV: Leave Management (การลา)

| รหัส | กรณีทดสอบ | ขั้นตอน | ข้อมูลทดสอบ | ผลที่คาดหวัง | ช่องทาง | ระดับ |
|------|-----------|---------|-------------|-------------|---------|-------|
| LV-001 | สร้าง Leave Type | POST /leave/types | name:"ลาพักร้อน", days_allowed:10 | HTTP 201 | API | Medium |
| LV-002 | ยื่นคำขอลา | POST /leave/requests | employee_id, type_id, start_date, end_date | HTTP 201, status="pending" | API | High |
| LV-003 | Approve การลา | POST /leave/requests/:id/approve | status="pending" | HTTP 200, status="approved", balance ลดลง | API | High |
| LV-004 | Reject การลา | POST /leave/requests/:id/reject | status="pending", reason | HTTP 200, status="rejected", balance ไม่เปลี่ยน | API | High |
| LV-005 | ลาเกินวันที่เหลือ | POST /leave/requests | days > leave balance | HTTP 400, "Insufficient leave balance" | API | High |
| LV-006 | วันลาทับซ้อน | POST /leave/requests | ช่วงวันที่ทับกับ request ที่ approved อยู่แล้ว | HTTP 409, "Overlapping leave request" | API | High |
| LV-007 | ยอด leave balance คำนวณถูกต้อง | GET /employees/:id/leave-balance | หลัง approve 3 วัน จาก 10 วัน | balance = 7 วัน | API | Critical |

---

### 3.18 CRM: Contacts (ผู้ติดต่อ)

| รหัส | กรณีทดสอบ | ขั้นตอน | ข้อมูลทดสอบ | ผลที่คาดหวัง | ช่องทาง | ระดับ |
|------|-----------|---------|-------------|-------------|---------|-------|
| CRM-001 | สร้าง Contact (ลูกค้า) | POST /contacts | type:"customer", name_th, tax_id, address_th ครบถ้วน | HTTP 201 | API | High |
| CRM-002 | สร้าง Contact (Vendor) | POST /contacts | type:"vendor" | HTTP 201 | API | High |
| CRM-003 | สร้าง Contact (both) | POST /contacts | type:"both" | HTTP 201, สามารถใช้ใน AR และ AP | API | High |
| CRM-004 | Tax ID ซ้ำ | POST /contacts | tax_id ที่มีอยู่ใน tenant | HTTP 409 | API | High |
| CRM-005 | ที่อยู่ภาษาไทย | POST /contacts | address_th ครบถ้วน (บ้านเลขที่, ถนน, ตำบล, อำเภอ, จังหวัด, รหัสไปรษณีย์) | บันทึกถูกต้อง | API | High |
| CRM-006 | ลบ Contact ที่มี Invoice อ้างอิง | DELETE /contacts/:id | มี invoice linked | HTTP 409 | API | Critical |
| CRM-007 | ค้นหา Contact ด้วยภาษาไทย | GET /contacts?search=สมชาย | — | ผลลัพธ์ถูกต้อง (Thai full-text search) | API | High |

---

### 3.19 SYS-AU: Authentication (การพิสูจน์ตัวตน)

| รหัส | กรณีทดสอบ | ขั้นตอน | ข้อมูลทดสอบ | ผลที่คาดหวัง | ช่องทาง | ระดับ |
|------|-----------|---------|-------------|-------------|---------|-------|
| AUTH-001 | Register user ใหม่ | POST /auth/register | email, password (≥8 chars), tenant_name | HTTP 201, JWT token คืนกลับ, password ไม่ถูกเก็บ plain text | API | Critical |
| AUTH-002 | Login สำเร็จ | POST /auth/login | email, password ถูกต้อง | HTTP 200, access_token + refresh_token | API | Critical |
| AUTH-003 | Login password ผิด | POST /auth/login | password ผิด | HTTP 401, "Invalid credentials" (ไม่บอกว่า email หรือ password ผิด) | API | Critical |
| AUTH-004 | Login email ไม่มีในระบบ | POST /auth/login | email ที่ไม่มี | HTTP 401 (same message as wrong password — prevent enumeration) | API | Critical |
| AUTH-005 | Refresh Token | POST /auth/refresh | valid refresh_token | HTTP 200, access_token ใหม่ | API | Critical |
| AUTH-006 | Refresh Token หมดอายุ | POST /auth/refresh | expired refresh_token | HTTP 401 | API | Critical |
| AUTH-007 | Logout | POST /auth/logout | valid access_token | HTTP 200, token blacklisted | API | High |
| AUTH-008 | ใช้ token หลัง logout | ใช้ access_token ที่ logout แล้ว | — | HTTP 401 | API | Critical |
| AUTH-009 | Request ไม่มี Authorization header | GET /gl/accounts ไม่ส่ง Bearer token | — | HTTP 401 | API | Critical |
| AUTH-010 | Token ปลอม (tampered) | ส่ง JWT ที่แก้ไข payload | — | HTTP 401, signature invalid | API | Critical |

---

### 3.20 SYS-RB: RBAC (Role-Based Access Control)

| รหัส | กรณีทดสอบ | ขั้นตอน | ข้อมูลทดสอบ | ผลที่คาดหวัง | ช่องทาง | ระดับ |
|------|-----------|---------|-------------|-------------|---------|-------|
| RBAC-001 | Owner มีสิทธิ์ทุกอย่าง | ทดสอบทุก endpoint ด้วย Owner role | — | ทุก endpoint ตอบสนองตามปกติ | API | Critical |
| RBAC-002 | Accountant ไม่มีสิทธิ์ HR | POST /payroll ด้วย Accountant role | — | HTTP 403 | API | Critical |
| RBAC-003 | Viewer ไม่มีสิทธิ์ CREATE | POST /gl/accounts ด้วย Viewer role | — | HTTP 403 | API | Critical |
| RBAC-004 | ตรวจสอบ permission ทุก 140+ permission | Script ทดสอบ matrix | role × permission | ทุก permission enforce ถูกต้อง | API | Critical |
| RBAC-005 | สร้าง Custom Role | POST /roles | name:"Payroll Manager", permissions:["hr:payroll:*"] | HTTP 201, role ใช้งานได้ | API | High |
| RBAC-006 | ลบ Role ที่มี user ใช้งาน | DELETE /roles/:id | role มี user assigned | HTTP 409 | API | High |

---

### 3.21 SYS-MT: Multi-tenant Isolation (RLS)

| รหัส | กรณีทดสอบ | ขั้นตอน | ข้อมูลทดสอบ | ผลที่คาดหวัง | ช่องทาง | ระดับ |
|------|-----------|---------|-------------|-------------|---------|-------|
| MT-001 | Tenant A ไม่เห็นข้อมูล Tenant B — Invoices | GET /ar/invoices ด้วย Tenant A token | invoice ของ Tenant B | HTTP 200, response array ว่าง | API | Critical |
| MT-002 | Tenant A ไม่สามารถอ่าน GL ของ Tenant B | GET /gl/accounts ด้วย token Tenant A | accounts ของ Tenant B | HTTP 200, empty (RLS block) | API | Critical |
| MT-003 | Cross-tenant reference ใน FK | POST /ar/invoices ด้วย customer_id ของ Tenant B | — | HTTP 404 (FK constraint + RLS) | API | Critical |
| MT-004 | Concurrent operations — 3 tenants | รัน identical operations พร้อมกัน 3 tenants | — | ข้อมูลแต่ละ tenant ไม่ปะปนกัน | API | Critical |
| MT-005 | SQL Injection ใน tenant_id header | X-Tenant-ID: "'; DROP TABLE tenants;--" | — | HTTP 400, ไม่ execute SQL | API | Critical |

---

### 3.22 RPT: Reports (รายงาน)

| รหัส | กรณีทดสอบ | ขั้นตอน | ข้อมูลทดสอบ | ผลที่คาดหวัง | ช่องทาง | ระดับ |
|------|-----------|---------|-------------|-------------|---------|-------|
| RPT-001 | Trial Balance สมดุล | GET /reports/trial-balance?year=2026&period=3 | JE posted ทั้งหมด | total debit = total credit | API | Critical |
| RPT-002 | Income Statement ถูกต้อง | GET /reports/income-statement?year=2026 | Revenue + Expense accounts | Net Income = Revenue - COGS - Expenses | API | Critical |
| RPT-003 | Balance Sheet สมดุล | GET /reports/balance-sheet?year=2026&period=3 | — | Assets = Liabilities + Equity | API | Critical |
| RPT-004 | AR Aging Report | GET /reports/ar-aging | invoices ครบ aging bucket | buckets 0-30, 31-60, 61-90, 90+ วัน ถูกต้อง | API | Critical |
| RPT-005 | P&L Comparison YoY | GET /reports/pnl-comparison?type=yoy | — | เปรียบเทียบ 2025 vs 2026, variance % | API | High |
| RPT-006 | P&L Comparison MoM | GET /reports/pnl-comparison?type=mom | — | เปรียบเทียบ month-1 vs month | API | High |
| RPT-007 | Budget Variance Report | GET /reports/budget-variance?year=2026 | budgets + actuals | actual vs budget + variance per account | API | Critical |
| RPT-008 | Dashboard — Executive | GET /dashboard/executive | — | KPIs ครบ: Revenue, AR, AP, Cash | API/Web | High |
| RPT-009 | รายงานปิดงวด — ไม่มีข้อมูล | GET /reports/trial-balance?year=2030&period=1 | — | HTTP 200, empty dataset (ไม่ใช่ error) | API | Medium |
| RPT-010 | Export รายงานเป็น Excel | GET /reports/trial-balance?format=xlsx | — | .xlsx ดาวน์โหลดได้, column headers ถูกต้อง | API | Medium |

---

### 3.23 SYS-WH: Webhooks / Import / Export

| รหัส | กรณีทดสอบ | ขั้นตอน | ข้อมูลทดสอบ | ผลที่คาดหวัง | ช่องทาง | ระดับ |
|------|-----------|---------|-------------|-------------|---------|-------|
| WH-001 | สร้าง Webhook endpoint | POST /webhooks | url, events:["invoice.posted"] | HTTP 201 | API | Medium |
| WH-002 | Webhook fire เมื่อ Invoice posted | POST /ar/invoices/:id/post | webhook registered for invoice.posted | HTTP POST ส่งไปยัง webhook url พร้อม payload | API | High |
| WH-003 | Webhook retry เมื่อ endpoint ล้มเหลว | endpoint คืน HTTP 500 | — | retry ตาม backoff policy | API | Medium |
| WH-004 | Import Contacts CSV | POST /import/contacts | CSV 100 rows | HTTP 200, 100 contacts สร้าง, report errors | API | Medium |
| WH-005 | Import CSV encoding TIS-620 | POST /import | CSV ที่ encode TIS-620 | Thai characters ถูก decode ถูกต้อง | API | High |
| WH-006 | Export Contacts | GET /export/contacts?format=csv | — | CSV ดาวน์โหลดได้, ทุก field ครบ | API | Medium |


---

## 4. ทดสอบวงจรธุรกิจ (Business Cycle Tests)

> กรณีทดสอบ End-to-End ต่อไปนี้ทดสอบ flow ตั้งแต่ต้นจนจบ ผ่านทุก interface (API → JE → Report) โดยไม่อนุญาตให้ข้าม step

---

### Scenario 1: วงจรขาย (Sales Cycle)

**เส้นทาง:** Quotation → Sales Order → Delivery Note → Invoice → Payment → Receipt → Month-end Close

| ขั้น | รหัส | การกระทำ | ข้อมูลทดสอบ | ผลที่คาดหวัง | ช่องทาง |
|-----|------|---------|-------------|-------------|---------|
| 1 | E2E-SC-01 | สร้าง Contact ลูกค้า | name:"บริษัท ทดสอบ จำกัด", tax_id:"0105560000001", type:"customer" | customer_id ถูกสร้าง | API |
| 2 | E2E-SC-02 | สร้าง Product | sku:"P001", name:"สินค้า A", cost: 50,000 sat, sell: 100,000 sat | product_id ถูกสร้าง | API |
| 3 | E2E-SC-03 | รับสินค้าเข้าคลัง | type:"receive", qty:50, warehouse_id | stock level = 50 | API |
| 4 | E2E-SC-04 | สร้าง Quotation (draft) | customer_id, lines:[{product_id, qty:10, unit_price:100,000}], vat:7% | QT draft, total = 1,070,000 sat | API |
| 5 | E2E-SC-05 | ส่ง Quotation | POST /quotations/:id/send | status="sent" | API |
| 6 | E2E-SC-06 | Approve Quotation | POST /quotations/:id/approve | status="approved" | API |
| 7 | E2E-SC-07 | Convert QT → Sales Order | POST /quotations/:id/convert | SO สร้าง, status="draft", lines ตรงกับ QT | API |
| 8 | E2E-SC-08 | Confirm Sales Order | POST /sales-orders/:id/confirm | status="confirmed" | API |
| 9 | E2E-SC-09 | สร้าง Delivery Note จาก SO | POST /delivery-notes ด้วย so_id | DN draft, lines ตรงกับ SO | API |
| 10 | E2E-SC-10 | Mark Delivered | POST /delivery-notes/:id/deliver | status="delivered", stock movement: issue 10 units, stock = 40 | API |
| 11 | E2E-SC-11 | สร้าง Invoice จาก SO | POST /ar/invoices ด้วย so_id | Invoice draft, subtotal=1,000,000, vat=70,000, total=1,070,000 sat | API |
| 12 | E2E-SC-12 | Post Invoice | POST /ar/invoices/:id/post | status="posted", JE: Dr AR 1,070,000 / Cr Revenue 1,000,000 / Cr VAT Payable 70,000 | API |
| 13 | E2E-SC-13 | รับชำระเงิน | POST /ar/payments | amount=1,070,000, invoice_id | payment created, invoice → "paid" | API |
| 14 | E2E-SC-14 | ออกใบเสร็จ | POST /receipts | payment_id, invoice_id | Receipt issued, JE: Dr Bank / Cr AR | API |
| 15 | E2E-SC-15 | ตรวจสอบ Trial Balance | GET /reports/trial-balance | ณ สิ้นเดือน | Debit = Credit, AR balance = 0, Revenue = 1,000,000 | API |
| 16 | E2E-SC-16 | ปิดงวด | POST /gl/fiscal-periods/:id/close | period ปัจจุบัน | period status = "closed" |  API |
| 17 | E2E-SC-17 | Income Statement ถูกต้อง | GET /reports/income-statement | — | Revenue: 1,000,000 sat, COGS: 500,000 sat (10 × 50,000), Gross Profit: 500,000 sat | API |

**เกณฑ์ผ่าน Scenario 1:**
- ทุก 17 ขั้นตอนสำเร็จโดยไม่มี error
- JE ทุกรายการสมดุล (debit = credit)
- Stock level ถูกต้อง (50 → 40)
- Trial Balance สมดุล
- AR outstanding = 0 หลังรับชำระ

---

### Scenario 2: วงจรซื้อ (Purchase Cycle)

**เส้นทาง:** Purchase Order → Receive → Bill → Bill Payment → WHT Certificate → Month-end Close

| ขั้น | รหัส | การกระทำ | ข้อมูลทดสอบ | ผลที่คาดหวัง | ช่องทาง |
|-----|------|---------|-------------|-------------|---------|
| 1 | E2E-PC-01 | สร้าง Vendor Contact | type:"vendor", tax_id:"0105560000002" | vendor_id ถูกสร้าง | API |
| 2 | E2E-PC-02 | สร้าง Purchase Order | vendor_id, lines:[{product_id, qty:100, unit_price:50,000}], expected_delivery | PO draft, total=5,000,000 sat | API |
| 3 | E2E-PC-03 | ส่ง PO | POST /purchase-orders/:id/send | status="sent" | API |
| 4 | E2E-PC-04 | รับสินค้า | POST /purchase-orders/:id/receive | received_qty=100 | status="received", stock movement: receive 100 units | API |
| 5 | E2E-PC-05 | Convert PO → Bill | POST /purchase-orders/:id/convert-to-bill | Bill draft, lines ตรงกับ PO | API |
| 6 | E2E-PC-06 | Approve Bill | POST /ap/bills/:id/approve | status="approved", JE: Dr Inventory/Expense / Cr AP | API |
| 7 | E2E-PC-07 | จ่ายบิลพร้อม WHT 3% | POST /ap/bill-payments | bill_id, wht_rate_bp:300, payment: 4,850,000 sat (net) | payment created, WHT cert สร้าง: income=5,000,000, wht=150,000 | API |
| 8 | E2E-PC-08 | JE ชำระเงิน | ตรวจสอบ JE อัตโนมัติ | — | Dr AP 5,000,000 / Cr Bank 4,850,000 / Cr WHT Payable 150,000 | API |
| 9 | E2E-PC-09 | Issue WHT Certificate | POST /wht/:id/issue | status="issued", document_number ถูกกำหนด | API |
| 10 | E2E-PC-10 | WHT Summary Report | GET /reports/wht-summary?month=3&year=2026 | certificate ปรากฏ, wht_amount=150,000 | API |
| 11 | E2E-PC-11 | AP Aging = 0 หลังชำระ | GET /reports/ap-aging | bill ที่ชำระแล้ว | bill ไม่ปรากฏใน outstanding | API |

**เกณฑ์ผ่าน Scenario 2:**
- WHT คำนวณถูกต้อง: 5,000,000 × 3% = 150,000 satang
- JE สมดุลทุกรายการ
- AP outstanding = 0 หลังชำระ
- WHT Certificate ถูก issue สำเร็จ

---

### Scenario 3: วงจรบัญชี (Accounting Cycle)

**เส้นทาง:** Journal Entry → Post → Trial Balance → Adjusting Entries → Financial Statements → Close Period → Close Year

| ขั้น | รหัส | การกระทำ | ข้อมูลทดสอบ | ผลที่คาดหวัง | ช่องทาง |
|-----|------|---------|-------------|-------------|---------|
| 1 | E2E-AC-01 | สร้าง Fiscal Year 2026 | POST /gl/fiscal-years | year:2026, 12 periods สร้างอัตโนมัติ | API |
| 2 | E2E-AC-02 | บันทึก JE ซื้อสินค้า | Dr Inventory, Cr AP | debit=credit=500,000 sat | status="draft" | API |
| 3 | E2E-AC-03 | Post JE | POST /journal-entries/:id/post | status="posted" | API |
| 4 | E2E-AC-04 | Trial Balance งวด 1 | GET /reports/trial-balance?year=2026&period=1 | Total Debit = Total Credit | API |
| 5 | E2E-AC-05 | บันทึก Adjusting Entry (Prepaid → Expense) | Dr Prepaid Expense / Cr Cash | balance sheet ปรับ | API |
| 6 | E2E-AC-06 | Post Adjusting Entry | POST /journal-entries/:id/post | status="posted" | API |
| 7 | E2E-AC-07 | Income Statement งวด 1 | GET /reports/income-statement | ผลรวม Revenue, Expense ถูกต้อง | API |
| 8 | E2E-AC-08 | Balance Sheet งวด 1 | GET /reports/balance-sheet | Assets = Liabilities + Equity | API |
| 9 | E2E-AC-09 | ปิดงวด 1–11 | POST /gl/fiscal-periods/:id/close × 11 | ทุก period status="closed" | API |
| 10 | E2E-AC-10 | ป้องกัน JE ในงวดที่ปิดแล้ว | POST /journal-entries ใน period ที่ closed | HTTP 409 | API |
| 11 | E2E-AC-11 | ปิดปีบัญชี | POST /gl/fiscal-years/:id/close | status="closed", Closing JEs สร้าง (Revenue/Expense → Retained Earnings) | API |
| 12 | E2E-AC-12 | Balance Sheet หลังปิดปี | GET /reports/balance-sheet | Retained Earnings อัปเดตถูกต้อง | API |

---

### Scenario 4: วงจร HR (HR Cycle)

**เส้นทาง:** จ้าง → Payroll → จ่าย → ลา → ลาออก

| ขั้น | รหัส | การกระทำ | ข้อมูลทดสอบ | ผลที่คาดหวัง | ช่องทาง |
|-----|------|---------|-------------|-------------|---------|
| 1 | E2E-HR-01 | สร้าง Department | code:"IT", name:"ฝ่ายไอที" | dept_id ถูกสร้าง | API |
| 2 | E2E-HR-02 | จ้างพนักงาน | first_name_th:"สมชาย", salary:1,500,000 sat, dept_id | emp_id, status="active" | API |
| 3 | E2E-HR-03 | สร้าง Leave Types | ลาพักร้อน (10 วัน), ลากิจ (3 วัน), ลาป่วย (30 วัน) | leave_type_ids ถูกสร้าง | API |
| 4 | E2E-HR-04 | สร้าง Payroll Run มีนาคม 2026 | pay_period: 2026-03-01 to 2026-03-31 | run_id, status="draft" | API |
| 5 | E2E-HR-05 | Calculate Payroll | POST /payroll/:id/calculate | gross=1,500,000, ssc=75,000, net=1,400,000+PIT deduction | API |
| 6 | E2E-HR-06 | ตรวจสอบ SSC cap | item สมชาย | ssc_employee = 75,000 sat (= 750 THB ≤ cap) | API |
| 7 | E2E-HR-07 | Approve Payroll | POST /payroll/:id/approve | status="approved" | API |
| 8 | E2E-HR-08 | Pay Payroll | POST /payroll/:id/pay | status="paid", JE สร้าง | API |
| 9 | E2E-HR-09 | ยื่นขอลาพักร้อน 3 วัน | POST /leave/requests | employee_id, type:"vacation", 3 days | request pending | API |
| 10 | E2E-HR-10 | Approve การลา | POST /leave/requests/:id/approve | status="approved", balance: 10 → 7 วัน | API |
| 11 | E2E-HR-11 | ลาออกพนักงาน | POST /employees/:id/resign | resign_date: 2026-06-30 | status="resigned" | API |
| 12 | E2E-HR-12 | ไม่รวมพนักงานใน Payroll หลังลาออก | POST /payroll/calculate (กรกฎาคม) | สมชาย resigned | สมชายไม่อยู่ใน payroll items | API |

---

### Scenario 5: วงจรสินค้าคงคลัง (Inventory Cycle)

| ขั้น | รหัส | การกระทำ | ข้อมูลทดสอบ | ผลที่คาดหวัง | ช่องทาง |
|-----|------|---------|-------------|-------------|---------|
| 1 | E2E-INV-01 | สร้าง Product | sku:"WIDGET-A", cost:20,000 sat, min_stock:5 | product_id | API |
| 2 | E2E-INV-02 | สร้าง Warehouse | code:"WH-BKK", name:"คลังกรุงเทพ" | warehouse_id | API |
| 3 | E2E-INV-03 | รับสินค้าเข้าคลัง (50 ชิ้น) | type:"receive", qty:50 | stock = 50, movement logged | API |
| 4 | E2E-INV-04 | ขายผ่าน SO + DO (20 ชิ้น) | SO → Deliver → DO.deliver | stock = 30, issue movement | API |
| 5 | E2E-INV-05 | โอนสินค้าไป WH-CNX (10 ชิ้น) | type:"transfer", from:WH-BKK, to:WH-CNX | WH-BKK = 20, WH-CNX = 10 | API |
| 6 | E2E-INV-06 | ตรวจสอบยอดรวมคงคลัง | GET /inventory/levels | total across warehouses = 30 | API |
| 7 | E2E-INV-07 | เบิกจนเกือบหมด (17 ชิ้น จาก WH-BKK) | type:"issue", qty:17, warehouse:WH-BKK | WH-BKK = 3, Low Stock Alert ทำงาน (3 < min_stock:5) | API |
| 8 | E2E-INV-08 | Low Stock Report | GET /reports/low-stock | WIDGET-A ปรากฏ (stock 3 < min 5) | API |
| 9 | E2E-INV-09 | Stock Valuation | GET /reports/stock-valuation | total value = 30 × 20,000 = 600,000 sat | API |
| 10 | E2E-INV-10 | ปรับยอด Audit | POST /stock-movements | type:"adjust", qty:+2 (after physical count) | WH-BKK = 5, movement type="adjust" logged | API |

---

## 5. ทดสอบความปลอดภัย (Security Test Plan)

### 5.1 Authentication Security

| รหัส | กรณีทดสอบ | วิธีทดสอบ | ผลที่คาดหวัง | ระดับ |
|------|-----------|---------|-------------|-------|
| SEC-001 | Brute Force Protection | POST /auth/login 20 ครั้งด้วย password ผิด | Rate limit ทำงาน (HTTP 429) หลัง N attempts | Critical |
| SEC-002 | JWT Algorithm Confusion (alg:none) | ส่ง JWT ที่ alg:"none" | HTTP 401, reject token | Critical |
| SEC-003 | JWT Expiry Enforcement | ใช้ access_token ที่หมดอายุ | HTTP 401 | Critical |
| SEC-004 | Refresh Token Rotation | ใช้ refresh_token ที่ใช้แล้ว (replay) | HTTP 401, token already consumed | Critical |
| SEC-005 | Password Hashing | ตรวจสอบ users table ใน DB | password field ต้องเป็น bcrypt/argon2 hash (ไม่ใช่ plain text) | Critical |
| SEC-006 | Password Policy | POST /auth/register | password "123" ถูก reject | High |
| SEC-007 | Concurrent Session Limit | Login จาก 10 devices พร้อมกัน | ทุก session ทำงานอิสระ (หรือ limit ตาม policy) | Medium |

### 5.2 Authorization Security

| รหัส | กรณีทดสอบ | วิธีทดสอบ | ผลที่คาดหวัง | ระดับ |
|------|-----------|---------|-------------|-------|
| SEC-010 | Horizontal Privilege Escalation | User A เข้าถึง resource ของ User B ใน tenant เดียวกัน | HTTP 403 | Critical |
| SEC-011 | Vertical Privilege Escalation | Accountant เรียก Owner-only endpoint | HTTP 403 | Critical |
| SEC-012 | RBAC Enforcement — ทุก endpoint | Matrix test: role × endpoint × method | 140+ permissions enforce ครบ | Critical |
| SEC-013 | Direct Object Reference | GET /ar/invoices/:id ด้วย invoice_id ของ tenant อื่น | HTTP 404 (RLS หรือ application check) | Critical |
| SEC-014 | Mass Assignment | POST /ar/invoices ด้วย field tenant_id: "other-tenant" | tenant_id ถูก ignore (from JWT, not body) | Critical |

### 5.3 Multi-tenant Isolation

| รหัส | กรณีทดสอบ | วิธีทดสอบ | ผลที่คาดหวัง | ระดับ |
|------|-----------|---------|-------------|-------|
| SEC-020 | RLS — SELECT isolation | Query ตรง DB โดยไม่มี tenant_id filter | RLS policy ป้องกัน ข้อมูลถูก filter โดย PostgreSQL | Critical |
| SEC-021 | RLS — INSERT isolation | INSERT ไม่มี tenant_id | PostgreSQL RLS block หรือ app assign tenant_id จาก JWT | Critical |
| SEC-022 | Tenant ID spoofing via header | X-Tenant-ID: "other-tenant-uuid" | Server ใช้ tenant จาก JWT เท่านั้น | Critical |
| SEC-023 | Aggregated data leak | GET /reports/dashboard | dashboard แสดงเฉพาะข้อมูลของ tenant ตัวเอง | Critical |

### 5.4 Input Validation & Injection

| รหัส | กรณีทดสอบ | วิธีทดสอบ | ผลที่คาดหวัง | ระดับ |
|------|-----------|---------|-------------|-------|
| SEC-030 | SQL Injection — search param | GET /contacts?search=' OR 1=1-- | HTTP 200, ผลลัพธ์ปกติ (parameterized query) | Critical |
| SEC-031 | SQL Injection — ID param | GET /ar/invoices/' OR '1'='1 | HTTP 400 หรือ 404, ไม่ execute SQL | Critical |
| SEC-032 | XSS — stored via name field | POST /contacts name: `<script>alert(1)</script>` | ข้อมูลถูก escape เมื่อแสดงบน Web | High |
| SEC-033 | XSS — reflected via error | GET endpoint ด้วย param `<img onerror=alert(1)>` | HTTP 400, ไม่ reflect HTML | High |
| SEC-034 | Path Traversal — file import | POST /import filename: "../../etc/passwd" | HTTP 400, ไม่เข้าถึง filesystem | High |
| SEC-035 | XXE Injection — XML import | Import XML ที่มี external entity | XXE blocked, ไม่อ่าน server files | High |
| SEC-036 | Mass upload DoS | POST /import CSV ขนาด 100MB | HTTP 413 หรือ 400, limit enforced | Medium |
| SEC-037 | Negative amount injection | POST /ar/payments amount: -1000000 | HTTP 400, amount ต้องเป็น positive | Critical |

### 5.5 Sensitive Data Protection

| รหัส | กรณีทดสอบ | วิธีทดสอบ | ผลที่คาดหวัง | ระดับ |
|------|-----------|---------|-------------|-------|
| SEC-040 | Password ไม่แสดงใน response | GET /users/:id | password field ไม่อยู่ใน JSON response | Critical |
| SEC-041 | API Keys encrypted in DB | ตรวจสอบ webhooks table | secret field เป็น encrypted value ไม่ใช่ plain text | High |
| SEC-042 | WHT PII (TIN) ใน logs | ตรวจสอบ application logs | tax_id ไม่ถูก log ใน plain text | High |
| SEC-043 | HTTPS enforcement | HTTP request ไปยัง API | Redirect 301 → HTTPS หรือ refuse HTTP | High |
| SEC-044 | Security Headers | GET /api/v1/health | X-Content-Type-Options, X-Frame-Options, Strict-Transport-Security ใน response | High |

### 5.6 Audit Trail Completeness

| รหัส | กรณีทดสอบ | วิธีทดสอบ | ผลที่คาดหวัง | ระดับ |
|------|-----------|---------|-------------|-------|
| SEC-050 | Audit log — POST JE | POST /journal-entries/:id/post | audit_logs: action="post", entity_type="journal_entry", user_id, tenant_id, timestamp | Critical |
| SEC-051 | Audit log — Void Invoice | POST /ar/invoices/:id/void | audit_logs: action="void", เก็บ before/after snapshot | Critical |
| SEC-052 | Audit log — Pay Payroll | POST /payroll/:id/pay | audit record พร้อม amount | Critical |
| SEC-053 | Audit log immutability | UPDATE audit_logs | ไม่อนุญาต (no UPDATE privilege on table) | Critical |
| SEC-054 | ลบ Audit log ไม่ได้ | DELETE audit_logs | ไม่อนุญาต | Critical |

---

## 6. ทดสอบประสิทธิภาพ (Performance Test Plan)

### 6.1 API Response Time Targets (P95 under normal load)

| หมวด Endpoint | SLA Target (P95) | Concurrent Users | เครื่องมือ |
|--------------|-----------------|-----------------|----------|
| Health check | < 50ms | 100 | k6 |
| Authentication (login/refresh) | < 200ms | 50 | k6 |
| List endpoints (paginated) | < 500ms | 50 | k6 |
| Single record fetch | < 200ms | 100 | k6 |
| Create / Update mutations | < 500ms | 50 | k6 |
| Post Journal Entry (with JE validation) | < 1,000ms | 20 | k6 |
| Calculate Payroll (100 employees) | < 5,000ms | 5 | k6 |
| Trial Balance report | < 3,000ms | 10 | k6 |
| Income Statement report | < 3,000ms | 10 | k6 |
| Balance Sheet report | < 3,000ms | 10 | k6 |
| Dashboard (Executive) | < 2,000ms | 20 | k6 |
| WHT Summary report | < 2,000ms | 10 | k6 |
| Stock Valuation report | < 3,000ms | 10 | k6 |
| Import CSV (100 rows) | < 10,000ms | 5 | k6 |

### 6.2 Concurrent User Targets

| Scenario | Virtual Users | Duration | Accept Rate |
|----------|--------------|---------|-------------|
| Normal business hours | 50 VU | 10 min | ≥ 99% success |
| Peak load (month-end) | 200 VU | 5 min | ≥ 99% success |
| Stress test | 500 VU | 2 min | graceful degradation |
| Spike test | 0 → 300 VU in 30s | — | no crash, < 2s recovery |
| Endurance test | 30 VU | 2 hours | no memory leak, P95 stable |

### 6.3 Database Performance Targets

| Query Type | Target | เกณฑ์ |
|-----------|--------|-------|
| Journal entry lines (1M rows) | < 500ms | EXPLAIN ANALYZE |
| AR Aging calculation | < 2,000ms | EXPLAIN ANALYZE |
| Trial Balance aggregation | < 1,500ms | Covering indexes |
| Stock movement history (per product) | < 300ms | Index on product_id + tenant_id |
| Audit log insert | < 50ms | Async / non-blocking |

### 6.4 Performance Test Scenarios (k6 Scripts)

```javascript
// ตัวอย่าง k6 test สำหรับ Trial Balance
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 10 },   // ramp up
    { duration: '3m', target: 10 },   // steady state
    { duration: '1m', target: 0 },    // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'],   // P95 < 3s
    http_req_failed: ['rate<0.01'],       // < 1% errors
  },
};

export default function () {
  const res = http.get(
    `${__ENV.BASE_URL}/api/v1/reports/trial-balance?year=2026&period=3`,
    { headers: { Authorization: `Bearer ${__ENV.TOKEN}` } }
  );
  check(res, { 'status 200': (r) => r.status === 200 });
}
```

---

## 7. ทดสอบการปฏิบัติตามกฎหมาย (Compliance Test Plan)

### 7.1 Thai Tax Compliance

| รหัส | รายการตรวจสอบ | วิธีทดสอบ | เกณฑ์ผ่าน | อ้างอิงกฎหมาย |
|------|-------------|---------|---------|--------------|
| COMP-001 | VAT Rate = 7% | คำนวณ VAT บน Invoice | vat_amount = base × 0.07 (rounded ตาม กรมสรรพากร) | ประมวลรัษฎากร มาตรา 80 |
| COMP-002 | VAT ใบกำกับภาษี fields ครบ | GET /ar/invoices/:id/pdf | มี: ชื่อผู้ขาย, เลขทะเบียนภาษี, วันที่, รายการ, ราคา, VAT, ยอดรวม | กฎกระทรวง ฉบับที่ 189 |
| COMP-003 | WHT ประเภท 1 (เงินเดือน) = 0-35% | calcWHT income_type="1" | อัตราถูกต้องตาม bracket | มาตรา 50(1) |
| COMP-004 | WHT ประเภท 2 (ค่าเช่า) = 5% | calcWHT income_type="2" | rate = 5% (500 bp) | มาตรา 50(5) |
| COMP-005 | WHT ประเภท 3 (ค่าบริการ) = 3% | calcWHT income_type="3" | rate = 3% (300 bp) | มาตรา 50(4) |
| COMP-006 | WHT ประเภท 4 (เงินปันผล) = 10% | calcWHT income_type="4" | rate = 10% (1000 bp) | มาตรา 50(4) |
| COMP-007 | ภ.ง.ด.3 — payer fields ครบ | GET /wht/:id | payer_name, payer_tax_id (13 หลัก) ครบ | กฎหมาย WHT ไทย |
| COMP-008 | ภ.ง.ด.53 — juristic person | POST /wht certificate_type="pnd53" | certificate_type="pnd53", payee_tax_id 13 หลัก | กฎหมาย WHT ไทย |
| COMP-009 | Buddhist Era (พ.ศ.) ในเอกสาร | GET Invoice PDF, WHT Certificate | วันที่แสดงเป็น พ.ศ. (2026 → 2569) | มาตรฐานไทย |
| COMP-010 | Tax ID 13 หลัก validation | POST /contacts, POST /wht | tax_id ไม่ครบ 13 หลัก → HTTP 400 | กรมสรรพากร |

### 7.2 ประกันสังคม (Social Security Contribution)

| รหัส | รายการตรวจสอบ | วิธีทดสอบ | เกณฑ์ผ่าน | อ้างอิง |
|------|-------------|---------|---------|--------|
| COMP-020 | SSC Rate = 5% | calcSSC(salary) | rate = 5.0% | พ.ร.บ.ประกันสังคม มาตรา 46 |
| COMP-021 | SSC Cap = 750 THB | calcSSC(salary ≥ 15,000 THB) | SSC ≤ 75,000 satang | พ.ร.บ.ประกันสังคม |
| COMP-022 | SSC Salary Cap = 15,000 THB | calcSSC(20,000 THB) | SSC = 750 THB (ไม่ใช่ 1,000) | พ.ร.บ.ประกันสังคม |
| COMP-023 | SSC Employee = Employer | Payroll calculation | total_employer_ssc = total_employee_ssc | กฎหมายประกันสังคม |
| COMP-024 | พนักงานต่างด้าว SSC | Employee nationality != "TH" | ตรวจสอบ policy (ขึ้นกับ visa type) | กฎหมายแรงงาน |

### 7.3 PDPA (พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562)

| รหัส | รายการตรวจสอบ | วิธีทดสอบ | เกณฑ์ผ่าน |
|------|-------------|---------|---------|
| COMP-030 | ข้อมูลส่วนบุคคลพนักงาน (national_id) ไม่รั่วข้ามเทนแนนต์ | RLS isolation test | ข้อมูลแยก tenant สมบูรณ์ |
| COMP-031 | สิทธิ์การเข้าถึงข้อมูลส่วนบุคคล | ตรวจสอบ RBAC permission | เฉพาะ HR roles เข้าถึง national_id, salary |
| COMP-032 | Audit log การเข้าถึงข้อมูลส่วนบุคคล | ตรวจสอบ audit_logs | ทุก access ต่อ national_id ถูกบันทึก |
| COMP-033 | Data Retention | Policy documentation | กำหนดนโยบาย retention period สำหรับ HR data |
| COMP-034 | ลบข้อมูลตาม Right to Erasure | DELETE /employees/:id | soft delete + anonymize PII fields |

### 7.4 มาตรฐานการบัญชีไทย (TFAC/NPAEs)

| รหัส | รายการตรวจสอบ | วิธีทดสอบ | เกณฑ์ผ่าน |
|------|-------------|---------|---------|
| COMP-040 | Balance Sheet — Assets = Liabilities + Equity | GET /reports/balance-sheet | equation สมดุลทุกกรณี |
| COMP-041 | Income Statement — ยอดสะสม YTD ถูกต้อง | เปรียบเทียบ sum(monthly) กับ YTD | ตรงกัน |
| COMP-042 | Depreciation Method — Straight Line ถูกต้อง | Monthly depreciation × useful_life | = purchase_cost - salvage_value |
| COMP-043 | JE Posted Immutability | UPDATE/DELETE journal_entries WHERE status='posted' | ระบบ reject (ทำได้เฉพาะ reverse) |
| COMP-044 | Chart of Accounts ประเภทบัญชีถูกต้อง | account_type: asset/liability/equity/revenue/expense | ไม่สามารถกำหนดค่า type ผิดประเภท |

---

## 8. เกณฑ์การผ่านการทดสอบ (Exit Criteria)

### 8.1 สรุปเกณฑ์ทั้งหมด

| หมวด | เกณฑ์ | เป้าหมาย | วิธีวัด |
|-----|-------|---------|-------|
| Bug Severity | Critical bugs outstanding | 0 | Defect tracker |
| Bug Severity | High bugs outstanding | 0 | Defect tracker |
| Bug Severity | Medium bugs (with mitigation) | < 5 | Defect tracker |
| Test Execution | Test cases executed | ≥ 95% of planned | Test report |
| Test Execution | Test cases passed | ≥ 98% | Test report |
| Coverage | Code coverage (unit + integration) | ≥ 80% | vitest coverage-v8 |
| Business Cycles | E2E scenarios passed | 5/5 (100%) | E2E test report |
| Performance | All P95 SLAs met | 100% | k6 report |
| Security | OWASP Top 10 findings | 0 Critical, 0 High | ZAP scan report |
| Compliance | Thai tax calculations correct | 100% | Compliance checklist |
| Compliance | PDPA controls in place | 100% | Privacy audit |
| Audit Trail | All mutations logged | 100% | Audit log review |
| Multi-tenant | RLS isolation verified | No leaks detected | Security scan |

### 8.2 Defect Severity Classification

| ระดับ | คำนิยาม | ตัวอย่าง | SLA แก้ไข |
|------|--------|---------|---------|
| **Critical** | ระบบล้มเหลว / ข้อมูลบัญชีผิดพลาด / Security breach | JE ไม่สมดุล, RLS bypass, payroll คำนวณผิด | 24 ชั่วโมง |
| **High** | Feature หลักใช้งานไม่ได้ / ไม่เป็นไปตามกฎหมาย | VAT คำนวณผิด, WHT ไม่สร้าง certificate | 3 วันทำการ |
| **Medium** | Feature ใช้งานได้บางส่วน / UI ผิดพลาดแต่ workaround มี | Report แสดงผิด column, PDF format ผิด | 1 สัปดาห์ |
| **Low** | Cosmetic / Nice-to-have | สี UI ผิด, ข้อความ typo | ก่อน next release |

### 8.3 Go/No-Go Decision Matrix

| เงื่อนไข | Go | No-Go |
|---------|----|----|
| Critical bugs = 0 | ✓ | ✗ |
| High bugs = 0 | ✓ | ✗ |
| Medium bugs < 5 พร้อม mitigation | ✓ | ✗ |
| Business cycle E2E: 5/5 passed | ✓ | ✗ |
| Trial Balance สมดุล 100% | ✓ | ✗ |
| Security scan: 0 Critical/High | ✓ | ✗ |
| Thai compliance 100% | ✓ | ✗ |
| Performance SLAs ผ่าน | ✓ | ✗ |
| Regression suite ผ่าน ≥ 98% | ✓ | ✗ |
| Sign-off จาก Business Owner | ✓ | ✗ |


---

## 9. Risk Matrix (เมทริกซ์ความเสี่ยง)

### 9.1 Risk Assessment

| รหัส | ความเสี่ยง | โอกาสเกิด (1-5) | ผลกระทบ (1-5) | Risk Score | ระดับ | มาตรการลดความเสี่ยง |
|------|-----------|---------------|-------------|-----------|------|-------------------|
| RISK-001 | Journal Entry ไม่สมดุล (Debit ≠ Credit) ผ่านสู่ Production | 2 | 5 | 10 | High | Unit test ทุก JE creation, DB constraint check, pre-post validation |
| RISK-002 | RLS Bypass — ข้อมูลรั่วข้ามเทนแนนต์ | 2 | 5 | 10 | High | Automated RLS isolation tests, code review, penetration test |
| RISK-003 | Payroll SSC คำนวณผิดเกิน/ต่ำกว่า cap 750 THB | 3 | 5 | 15 | Critical | Unit tests ครอบคลุม boundary (14,999 / 15,000 / 15,001 THB) |
| RISK-004 | VAT 7% คำนวณผิดเนื่องจาก floating-point | 3 | 4 | 12 | High | ใช้ bigint satang ทุก calculation, ห้ามใช้ float/double |
| RISK-005 | WHT Certificate ไม่สร้างอัตโนมัติเมื่อจ่ายบิล | 3 | 4 | 12 | High | Integration test PO → Bill → Payment → WHT flow |
| RISK-006 | Audit Trail หายหรือไม่สมบูรณ์ | 2 | 5 | 10 | High | Middleware hook test, mutation coverage 100% |
| RISK-007 | Stock movement ลด stock ลบ (negative stock) | 3 | 3 | 9 | Medium | Pre-check stock level ก่อน issue, constraint ใน application layer |
| RISK-008 | Buddhist Era date แสดงผิดในเอกสาร PDF | 3 | 3 | 9 | Medium | Unit test formatThaiDate() ทุก edge case |
| RISK-009 | Depreciation คำนวณเกิน NBV (over-depreciation) | 2 | 4 | 8 | Medium | Cap check ในทุก depreciation calculation |
| RISK-010 | Double-submit race condition (ชำระ invoice 2 ครั้ง) | 3 | 4 | 12 | High | Idempotency key, DB unique constraint, concurrency test |
| RISK-011 | Performance degradation เมื่อ data volume สูง (>1M rows) | 3 | 4 | 12 | High | Index review, query EXPLAIN, endurance test |
| RISK-012 | CSV Import — Thai encoding error (TIS-620 vs UTF-8) | 4 | 3 | 12 | High | Test ทั้ง TIS-620 และ UTF-8, auto-detect encoding |
| RISK-013 | Fiscal period ถูกปิดโดยไม่ตั้งใจ | 2 | 4 | 8 | Medium | Permission guard: gl:period:close (Owner only), confirmation dialog บน Web |
| RISK-014 | Employee resign แต่ยังถูกรวมใน payroll | 2 | 4 | 8 | Medium | Integration test: resign → calculate payroll |
| RISK-015 | PDPA: national_id / salary รั่วใน API response ไม่มีสิทธิ์ | 2 | 5 | 10 | High | Field-level permission, response scrubbing test |

### 9.2 Risk Matrix Visualization

```
  Impact
    5  | RISK-001  RISK-002  RISK-003
       | RISK-006  RISK-015
    4  | RISK-004  RISK-005  RISK-010  RISK-011
       | RISK-013  RISK-014
    3  | RISK-007  RISK-008  RISK-012
    2  | RISK-009
    1  |
       +---+------+------+------+------
           1      2      3      4      5  --> Likelihood

Legend: Critical (>=12) | High (8-11) | Medium (4-7) | Low (1-3)
```

---

## 10. Sign-off Checklist (รายการตรวจสอบก่อน Go-Live)

### 10.1 Test Execution Sign-off

| # | รายการ | ผู้รับผิดชอบ | สถานะ | วันที่ Sign-off | หมายเหตุ |
|---|-------|------------|------|--------------|---------|
| 1 | Unit tests ผ่าน ≥ 85% coverage ทุก package | Tech Lead | [ ] | — | — |
| 2 | Integration tests ผ่าน — GL, AR, AP, HR, Inventory | QA Lead | [ ] | — | — |
| 3 | E2E Business Cycle 1 (Sales Cycle) ผ่าน | QA | [ ] | — | — |
| 4 | E2E Business Cycle 2 (Purchase Cycle) ผ่าน | QA | [ ] | — | — |
| 5 | E2E Business Cycle 3 (Accounting Cycle) ผ่าน | QA | [ ] | — | — |
| 6 | E2E Business Cycle 4 (HR Cycle) ผ่าน | QA | [ ] | — | — |
| 7 | E2E Business Cycle 5 (Inventory Cycle) ผ่าน | QA | [ ] | — | — |
| 8 | Security scan — 0 Critical, 0 High | Security Engineer | [ ] | — | — |
| 9 | Performance tests — ทุก SLA ผ่าน | DevOps | [ ] | — | — |
| 10 | Thai tax compliance 100% verified | Finance Lead | [ ] | — | — |
| 11 | PDPA controls verified | DPO / Legal | [ ] | — | — |
| 12 | Audit trail completeness verified | QA / Auditor | [ ] | — | — |
| 13 | Multi-tenant RLS isolation verified | Security Engineer | [ ] | — | — |
| 14 | RBAC 140+ permissions tested | QA | [ ] | — | — |
| 15 | All Critical/High bugs closed | QA Lead | [ ] | — | — |

### 10.2 Infrastructure & Operations Sign-off

| # | รายการ | ผู้รับผิดชอบ | สถานะ | วันที่ Sign-off |
|---|-------|------------|------|--------------|
| 16 | Database backup verified (ทดสอบ restore) | DBA | [ ] | — |
| 17 | Database indexes reviewed + EXPLAIN ANALYZE | DBA | [ ] | — |
| 18 | RLS policies enabled บน ทุก table ใน production | DBA | [ ] | — |
| 19 | SSL/TLS certificate valid | DevOps | [ ] | — |
| 20 | Environment variables / secrets ใน vault (ไม่อยู่ใน .env commit) | DevOps | [ ] | — |
| 21 | Monitoring + alerting configured (Prometheus/Grafana) | DevOps | [ ] | — |
| 22 | Log aggregation configured (ไม่มี PII ใน logs) | DevOps | [ ] | — |
| 23 | Disaster recovery plan documented + tested | Architect | [ ] | — |
| 24 | Rate limiting configured บน API | DevOps | [ ] | — |
| 25 | Database connection pooling configured | DBA | [ ] | — |

### 10.3 Business Sign-off

| # | รายการ | ผู้รับผิดชอบ | สถานะ | วันที่ Sign-off |
|---|-------|------------|------|--------------|
| 26 | UAT — Finance module ผ่าน | CFO / Finance Manager | [ ] | — |
| 27 | UAT — HR module ผ่าน | HR Manager | [ ] | — |
| 28 | UAT — Sales module ผ่าน | Sales Manager | [ ] | — |
| 29 | UAT — Procurement module ผ่าน | Procurement Manager | [ ] | — |
| 30 | UAT — Reporting ผ่าน | Finance Director | [ ] | — |
| 31 | User documentation / training complete | Product Owner | [ ] | — |
| 32 | Data migration plan reviewed + tested | Data Team | [ ] | — |
| 33 | Rollback plan documented และ tested | Tech Lead | [ ] | — |
| 34 | Go-Live support plan (Hypercare period) | Product + Engineering | [ ] | — |
| 35 | **FINAL GO-LIVE APPROVAL** | CTO + CFO | [ ] | — |

---

## ภาคผนวก (Appendices)

### ภาคผนวก A: Test Case Count Summary

| โมดูล | จำนวน Test Cases | Critical | High | Medium | Low |
|------|----------------|---------|------|--------|-----|
| FI-GL | 29 | 16 | 9 | 4 | 0 |
| FI-AR | 16 | 10 | 5 | 1 | 0 |
| FI-AP | 8 | 5 | 3 | 0 | 0 |
| FI-AA | 10 | 7 | 3 | 0 | 0 |
| FI-BL | 7 | 4 | 3 | 0 | 0 |
| FI-TX/WHT | 15 | 10 | 4 | 1 | 0 |
| CO | 8 | 3 | 3 | 2 | 0 |
| SD-QT | 10 | 5 | 4 | 1 | 0 |
| SD-SO | 6 | 4 | 2 | 0 | 0 |
| SD-DO | 4 | 3 | 1 | 0 | 0 |
| SD-RC | 4 | 2 | 2 | 0 | 0 |
| SD-CN | 5 | 4 | 1 | 0 | 0 |
| MM-PO | 7 | 5 | 2 | 0 | 0 |
| MM-INV | 12 | 7 | 5 | 0 | 0 |
| HR-Employees | 7 | 3 | 4 | 0 | 0 |
| HR-Payroll | 15 | 10 | 4 | 1 | 0 |
| HR-Leave | 7 | 2 | 5 | 0 | 0 |
| CRM | 7 | 3 | 4 | 0 | 0 |
| Auth | 10 | 9 | 1 | 0 | 0 |
| RBAC | 6 | 4 | 2 | 0 | 0 |
| Multi-tenant | 5 | 5 | 0 | 0 | 0 |
| Reports | 10 | 5 | 3 | 2 | 0 |
| Webhooks/Import | 6 | 0 | 3 | 3 | 0 |
| Business Cycles (E2E) | 44 | 30 | 14 | 0 | 0 |
| Security | 30 | 20 | 9 | 1 | 0 |
| Performance | 14 | 5 | 6 | 3 | 0 |
| Compliance | 24 | 15 | 7 | 2 | 0 |
| **รวมทั้งหมด** | **326** | **195** | **112** | **21** | **0** |

### ภาคผนวก B: ตารางสถานะการเปลี่ยนแปลง (State Transition Matrix)

#### B.1 Journal Entry

| สถานะ ปัจจุบัน | → draft | → posted | → reversed | ไม่อนุญาต |
|--------------|---------|---------|-----------|---------|
| draft | — | POST /post ✓ | — | ลบได้ |
| posted | — | — | POST /reverse ✓ | แก้ไข |
| reversed | — | — | — | ทุกการเปลี่ยนแปลง |

#### B.2 Invoice (AR)

| สถานะปัจจุบัน | → draft | → posted | → voided |
|-------------|---------|---------|---------|
| draft | — | POST /post ✓ | POST /void ✓ |
| posted | — | — | POST /void ✓ (ถ้าไม่มี payment) |
| voided | — | — | — |

#### B.3 Quotation

| สถานะปัจจุบัน | → draft | → sent | → approved | → rejected | → converted | → expired |
|-------------|---------|-------|-----------|-----------|-----------|---------|
| draft | — | ✓ | — | — | — | — |
| sent | — | — | ✓ | ✓ | — | ✓ (auto) |
| approved | — | — | — | — | ✓ | — |
| rejected | — | — | — | — | — | — |
| converted | — | — | — | — | — | — |
| expired | — | — | — | — | — | — |

#### B.4 Payroll Run

| สถานะปัจจุบัน | → draft | → calculated | → approved | → paid |
|-------------|---------|------------|-----------|------|
| draft | — | POST /calculate ✓ | — | — |
| calculated | — | — | POST /approve ✓ | — |
| approved | — | — | — | POST /pay ✓ |
| paid | — | — | — | — |

#### B.5 WHT Certificate

| สถานะปัจจุบัน | → draft | → issued | → filed | → voided |
|-------------|---------|---------|--------|---------|
| draft | — | POST /issue ✓ | — | POST /void ✓ |
| issued | — | — | POST /file ✓ | POST /void ✓ |
| filed | — | — | — | — |
| voided | — | — | — | — |

### ภาคผนวก C: Thai Compliance Reference

| รายการ | ค่าที่กำหนด | แหล่งอ้างอิง |
|-------|-----------|------------|
| VAT Standard Rate | 7% | ประมวลรัษฎากร มาตรา 80 |
| WHT ค่าจ้าง/บริการ | 3% | มาตรา 50(4) |
| WHT ค่าเช่า | 5% | มาตรา 50(5) |
| WHT เงินปันผล | 10% | มาตรา 50(4) |
| SSC Rate (employee) | 5% | พ.ร.บ.ประกันสังคม มาตรา 46 |
| SSC Rate (employer) | 5% | พ.ร.บ.ประกันสังคม มาตรา 46 |
| SSC Salary Cap | 15,000 THB | กฎกระทรวงประกันสังคม |
| SSC Max Contribution | 750 THB | กฎกระทรวงประกันสังคม |
| Buddhist Era Offset | +543 years | ค.ศ. + 543 = พ.ศ. |
| Tax ID Format | 13 digits | กรมสรรพากร |

### ภาคผนวก D: Test Environment Configuration

```yaml
# Test Environment — Staging
DATABASE_URL: postgresql://user:***@staging-db:5432/neip_staging
JWT_SECRET: [from vault]
NODE_ENV: test
LOG_LEVEL: info

# Test Tenants
TENANT_A_ID: "test-tenant-alpha-uuid"
TENANT_B_ID: "test-tenant-beta-uuid"
TENANT_C_ID: "test-tenant-gamma-uuid"

# Test Users (per tenant)
OWNER_EMAIL:      "owner@test-alpha.com"
ACCOUNTANT_EMAIL: "accountant@test-alpha.com"
HR_EMAIL:         "hr@test-alpha.com"
VIEWER_EMAIL:     "viewer@test-alpha.com"
```

### ภาคผนวก E: Defect Tracking Template

```markdown
## Bug Report

**รหัส:** BUG-XXXX
**วันที่พบ:** YYYY-MM-DD
**ผู้พบ:** [ชื่อ]
**โมดูล:** [GL / AR / AP / etc.]
**Severity:** Critical / High / Medium / Low
**Priority:** P1 / P2 / P3 / P4
**สภาพแวดล้อม:** dev / staging / production

### ขั้นตอนการทำซ้ำ (Steps to Reproduce)
1. ...
2. ...

### ผลที่ได้รับจริง (Actual Result)
...

### ผลที่คาดหวัง (Expected Result)
...

### หลักฐาน (Evidence)
- Screenshot / log snippet
- curl command ที่ใช้ทดสอบ

### Root Cause Analysis
...

### Fix Plan
...

### Test Cases ที่ต้องเพิ่ม
...
```

---

*เอกสารนี้จัดทำเมื่อ 15 มีนาคม 2569 (2026-03-15)*
*ต้องได้รับการ review และ update ทุก sprint หรือเมื่อมีการเปลี่ยนแปลง requirement*
*เวอร์ชันถัดไปจะ update หลัง UAT round 1 เสร็จสิ้น*

