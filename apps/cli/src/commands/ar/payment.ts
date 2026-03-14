/**
 * neip ar payment — Accounts Receivable payment commands.
 *
 * Commands:
 *   neip ar payment create   — record a new customer payment interactively
 *   neip ar payment list     — list recorded payments (paginated)
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

/** An allocation of a payment against a specific invoice. */
interface PaymentAllocation {
  invoiceId: string;
  amount: number;
}

/** Payload sent to record a payment. */
interface CreatePaymentPayload {
  customerId: string;
  paymentDate: string;
  amount: number;
  method: PaymentMethod;
  reference: string;
  notes: string;
  allocations: PaymentAllocation[];
}

/** Response shape for a payment resource. */
interface Payment {
  id: string;
  paymentNumber: string;
  customerId: string;
  paymentDate: string;
  amount: number;
  method: PaymentMethod;
  reference: string;
  status: 'unallocated' | 'partially_allocated' | 'fully_allocated' | 'voided';
  allocatedAmount: number;
  unallocatedAmount: number;
  createdAt: string;
}

/** Paginated list response wrapper. */
interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Options accepted by `ar payment list`. */
interface PaymentListOptions {
  page: string;
  pageSize: string;
  customerId?: string;
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

async function paymentCreate(): Promise<void> {
  process.stdout.write('Recording a new payment. Enter details below.\n');

  const customerId = await promptLine('Customer ID: ');
  const paymentDateInput = await promptLine(`Payment date (YYYY-MM-DD) [${today()}]: `);
  const amountStr = await promptLine('Payment amount: ');
  const methodInput = await promptLine(`Payment method (${VALID_METHODS.join(' | ')}): `);
  const reference = await promptLine('Reference / cheque number (optional): ');
  const notes = await promptLine('Notes (optional): ');

  if (customerId === '') {
    printError('Customer ID is required.');
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

  // Collect invoice allocations (optional)
  const allocations: PaymentAllocation[] = [];
  process.stdout.write('\nAllocate to invoices (leave Invoice ID blank to skip):\n');

  let remainingAmount = amount;
  for (;;) {
    if (remainingAmount <= 0) {
      process.stdout.write('  Payment fully allocated.\n');
      break;
    }

    const invoiceId = await promptLine(`  Invoice ID (${String(remainingAmount.toFixed(2))} remaining): `);
    if (invoiceId === '') break;

    const allocationAmountStr = await promptLine(`  Amount to allocate (max ${String(remainingAmount.toFixed(2))}): `);
    const allocationAmount = Number(allocationAmountStr === '' ? String(remainingAmount) : allocationAmountStr);

    if (Number.isNaN(allocationAmount) || allocationAmount <= 0) {
      printError('Allocation amount must be a positive number.');
      process.exit(1);
    }
    if (allocationAmount > remainingAmount) {
      printError(`Allocation amount exceeds remaining unallocated balance of ${String(remainingAmount.toFixed(2))}.`);
      process.exit(1);
    }

    allocations.push({ invoiceId, amount: allocationAmount });
    remainingAmount -= allocationAmount;
  }

  const payload: CreatePaymentPayload = {
    customerId,
    paymentDate,
    amount,
    method,
    reference,
    notes,
    allocations,
  };

  const result = await api.post<{ data: Payment }>(
    '/api/v1/ar/payments',
    payload,
  );

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  printSuccess(result.data.data, `Payment ${result.data.data.paymentNumber} recorded.`);
}

async function paymentList(options: PaymentListOptions): Promise<void> {
  const params: Record<string, string> = {
    page: options.page,
    pageSize: options.pageSize,
  };

  if (options.customerId !== undefined && options.customerId !== '') {
    params['customerId'] = options.customerId;
  }
  if (options.status !== undefined && options.status !== '') {
    params['status'] = options.status;
  }

  const result = await api.get<PaginatedResponse<Payment>>(
    '/api/v1/ar/payments',
    params,
  );

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  const { data, total, page, pageSize } = result.data;

  printSuccess(
    data,
    `Showing ${String(data.length)} of ${String(total)} payments (page ${String(page)}/${String(Math.ceil(total / pageSize))})`,
  );
}

// ---------------------------------------------------------------------------
// Command builder
// ---------------------------------------------------------------------------

/**
 * Build the `ar payment` sub-command group.
 */
export function buildPaymentCommand(): Command {
  const payment = new Command('payment').description('Accounts Receivable payment operations');

  payment
    .command('create')
    .description('Record a new customer payment interactively')
    .action(async () => {
      await paymentCreate();
    });

  payment
    .command('list')
    .description('List payments with optional pagination and filters')
    .option('--page <number>', 'Page number (1-based)', '1')
    .option('--page-size <number>', 'Number of payments per page', '20')
    .option('--customer-id <id>', 'Filter by customer ID')
    .option('--status <status>', 'Filter by allocation status: unallocated, partially_allocated, fully_allocated, voided')
    .action(async (options: PaymentListOptions) => {
      await paymentList(options);
    });

  return payment;
}
