/**
 * Money value object using bigint to represent satang (สตางค์).
 * 100 satang = ฿1.00. Never use number or parseFloat for monetary values.
 * Architecture reference: AR18
 */
export interface Money {
  /** Amount in satang (smallest unit). 100 satang = ฿1.00 */
  readonly amount: bigint;
  /** ISO 4217 currency code — only THB is supported */
  readonly currency: 'THB';
}

/** Construct a Money value from satang */
export function makeMoney(amount: bigint): Money {
  return { amount, currency: 'THB' };
}

/** Construct a Money value from baht (float-free: pass integer baht and satang separately) */
export function fromBaht(baht: bigint, satang: bigint = 0n): Money {
  return { amount: baht * 100n + satang, currency: 'THB' };
}
