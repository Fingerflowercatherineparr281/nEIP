/**
 * neip ap payment — Accounts Payable payment commands.
 *
 * Commands:
 *   neip ap payment list    — list bill payments (paginated)
 *   neip ap payment create  — record a new bill payment interactively
 */

import { createInterface } from 'node:readline';
import { Command } from 'commander';
import { api } from '../../lib/api-client.js';
import { printError, printSuccess } from '../../output/formatter.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Supported payment methods. */
type PaymentMethod = 'bank_transfer' | 'check' | 'credit_card' | 'cash' | 'other';

/** An allocation of a payment against a specific bill. */
interface BillPaymentAllocation {
  billId: string;
  amount: number;
}

/** Payload sent to record a bill payment. */
interface CreateBillPaymentPayload {
  vendorId: string;
  paymentDate: string;
  amount: number;
  method: PaymentMethod;
  reference: string;
  notes: string;
  allocations: BillPaymentAllocation[];
}

/** Response shape for a bill payment resource. */
interface BillPayment {
  id: string;
  paymentNumber: string;
  vendorId: string;
  paymentDate: string;
  amount: number;
  method: PaymentMethod;
  reference: string;
  status: 'unallocated' | 'partially_allocated' | 'fully_allocated' | 'voided';
  allocatedAmount: number;
  unallocatedAmount: number;
  createdAt: string;
}

/** Paginated list response wrapper (API returns items/total/limit/offset). */
interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore?: boolean;
}

/** Options accepted by `ap payment list`. */
interface ApPaymentListOptions {
  page: string;
  pageSize: string;
  vendorId?: string;
  status?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_METHODS: PaymentMethod[] = [
  'bank_transfer',
  'check',
  'credit_card',
  'cash',
  'other',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Read a single line from stdin with a prompt. */
function promptLine(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/** Return today's date in YYYY-MM-DD format. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function apPaymentList(options: ApPaymentListOptions): Promise<void> {
  const pageNum = parseInt(options.page, 10);
  const pageSizeNum = parseInt(options.pageSize, 10);
  const params: Record<string, string> = {
    limit: options.pageSize,
    offset: String((pageNum - 1) * pageSizeNum),
  };

  if (options.vendorId !== undefined && options.vendorId !== '') {
    params['vendorId'] = options.vendorId;
  }
  if (options.status !== undefined && options.status !== '') {
    params['status'] = options.status;
  }

  const result = await api.get<PaginatedResponse<BillPayment>>('/api/v1/bill-payments', params);

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  const { items, total, limit, offset } = result.data;
  const page = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit) || 1;

  printSuccess(
    items,
    `Showing ${String(items.length)} of ${String(total)} payments (page ${String(page)}/${String(totalPages)})`,
  );
}

async function apPaymentCreate(): Promise<void> {
  process.stdout.write('Recording a new bill payment. Enter details below.\n');

  const vendorId = await promptLine('Vendor ID: ');
  const paymentDateInput = await promptLine(`Payment date (YYYY-MM-DD) [${today()}]: `);
  const amountStr = await promptLine('Payment amount: ');
  const methodInput = await promptLine(`Payment method (${VALID_METHODS.join(' | ')}): `);
  const reference = await promptLine('Reference / cheque number (optional): ');
  const notes = await promptLine('Notes (optional): ');

  if (vendorId === '') {
    printError('Vendor ID is required.');
    process.exit(1);
  }

  const amount = Number(amountStr);
  if (Number.isNaN(amount) || amount <= 0) {
    printError('Payment amount must be a positive number.');
    process.exit(1);
  }

  if (!VALID_METHODS.includes(methodInput as PaymentMethod)) {
    printError(`Invalid payment method "${methodInput}". Must be one of: ${VALID_METHODS.join(', ')}`);
    process.exit(1);
  }

  const paymentDate = paymentDateInput === '' ? today() : paymentDateInput;
  const method = methodInput as PaymentMethod;

  // Collect bill allocations (optional)
  const allocations: BillPaymentAllocation[] = [];
  process.stdout.write('\nAllocate to bills (leave Bill ID blank to skip):\n');

  let remainingAmount = amount;
  for (;;) {
    if (remainingAmount <= 0) {
      process.stdout.write('  Payment fully allocated.\n');
      break;
    }

    const billId = await promptLine(`  Bill ID (${String(remainingAmount.toFixed(2))} remaining): `);
    if (billId === '') break;

    const allocationAmountStr = await promptLine(`  Amount to allocate (max ${String(remainingAmount.toFixed(2))}): `);
    const allocationAmount = Number(
      allocationAmountStr === '' ? String(remainingAmount) : allocationAmountStr,
    );

    if (Number.isNaN(allocationAmount) || allocationAmount <= 0) {
      printError('Allocation amount must be a positive number.');
      process.exit(1);
    }
    if (allocationAmount > remainingAmount) {
      printError(
        `Allocation amount exceeds remaining unallocated balance of ${String(remainingAmount.toFixed(2))}.`,
      );
      process.exit(1);
    }

    allocations.push({ billId, amount: allocationAmount });
    remainingAmount -= allocationAmount;
  }

  const payload: CreateBillPaymentPayload = {
    vendorId,
    paymentDate,
    amount,
    method,
    reference,
    notes,
    allocations,
  };

  const result = await api.post<{ data: BillPayment }>('/api/v1/bill-payments', payload);

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  printSuccess(result.data.data, `Bill payment ${result.data.data.paymentNumber} recorded.`);
}

// ---------------------------------------------------------------------------
// Command builder
// ---------------------------------------------------------------------------

/**
 * Build the `ap payment` sub-command group.
 */
export function buildApPaymentCommand(): Command {
  const payment = new Command('payment')
    .description('จัดการการจ่ายชำระเจ้าหนี้ (AP) — Accounts Payable bill payment operations')
    .addHelpText('after', `
Examples:
  $ neip ap payment create                       # บันทึกการจ่ายชำระบิล (interactive)
  $ neip ap payment list                         # แสดงการจ่ายชำระทั้งหมด
  $ neip ap payment list --status unallocated    # เฉพาะที่ยังไม่จัดสรร
  $ neip ap payment list --vendor-id <id>        # กรองตามผู้ขาย

Payment methods: bank_transfer, check, credit_card, cash, other
  `);

  payment
    .command('list')
    .description('แสดงรายการการจ่ายชำระบิล — List bill payments with optional pagination and filters')
    .option('--page <number>', 'หน้าที่ — Page number', '1')
    .option('--page-size <number>', 'จำนวนต่อหน้า — Number of payments per page', '20')
    .option('--vendor-id <id>', 'กรองตาม vendor ID — Filter by vendor ID')
    .option(
      '--status <status>',
      'กรองตามสถานะ: unallocated/partially_allocated/fully_allocated/voided',
    )
    .action(async (options: ApPaymentListOptions) => {
      await apPaymentList(options);
    });

  payment
    .command('create')
    .description('บันทึกการจ่ายชำระบิล (interactive) — Record a new bill payment interactively')
    .action(async () => {
      await apPaymentCreate();
    });

  return payment;
}
