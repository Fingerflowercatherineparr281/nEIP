/**
 * TFAC (Thai Federation of Accounting Professions) standard chart of accounts seed.
 *
 * Architecture reference: Story 2.5.
 *
 * Account code ranges:
 *   1xxx — Asset (สินทรัพย์)
 *   2xxx — Liability (หนี้สิน)
 *   3xxx — Equity (ส่วนของผู้ถือหุ้น)
 *   4xxx — Revenue (รายได้)
 *   5xxx — Expense (ค่าใช้จ่าย)
 */

export interface TfacAccount {
  readonly code: string;
  readonly nameTh: string;
  readonly nameEn: string;
  readonly accountType: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
}

/**
 * Standard TFAC chart of accounts entries used to seed a new tenant.
 */
export const tfacChartOfAccounts: ReadonlyArray<TfacAccount> = [
  // -------------------------------------------------------------------------
  // 1xxx — Assets (สินทรัพย์)
  // -------------------------------------------------------------------------
  { code: '1100', nameTh: 'เงินสดและรายการเทียบเท่าเงินสด', nameEn: 'Cash and Cash Equivalents', accountType: 'asset' },
  { code: '1110', nameTh: 'เงินสด', nameEn: 'Cash on Hand', accountType: 'asset' },
  { code: '1120', nameTh: 'เงินฝากธนาคาร', nameEn: 'Cash at Bank', accountType: 'asset' },
  { code: '1130', nameTh: 'เงินสดย่อย', nameEn: 'Petty Cash', accountType: 'asset' },
  { code: '1200', nameTh: 'ลูกหนี้การค้า', nameEn: 'Accounts Receivable', accountType: 'asset' },
  { code: '1210', nameTh: 'ลูกหนี้การค้า - ทั่วไป', nameEn: 'Trade Receivables - General', accountType: 'asset' },
  { code: '1220', nameTh: 'ค่าเผื่อหนี้สงสัยจะสูญ', nameEn: 'Allowance for Doubtful Accounts', accountType: 'asset' },
  { code: '1300', nameTh: 'สินค้าคงเหลือ', nameEn: 'Inventories', accountType: 'asset' },
  { code: '1310', nameTh: 'สินค้าสำเร็จรูป', nameEn: 'Finished Goods', accountType: 'asset' },
  { code: '1320', nameTh: 'วัตถุดิบ', nameEn: 'Raw Materials', accountType: 'asset' },
  { code: '1330', nameTh: 'งานระหว่างทำ', nameEn: 'Work in Progress', accountType: 'asset' },
  { code: '1400', nameTh: 'สินทรัพย์หมุนเวียนอื่น', nameEn: 'Other Current Assets', accountType: 'asset' },
  { code: '1410', nameTh: 'ภาษีซื้อ', nameEn: 'Input VAT', accountType: 'asset' },
  { code: '1420', nameTh: 'ภาษีซื้อยังไม่ถึงกำหนด', nameEn: 'Prepaid Input VAT', accountType: 'asset' },
  { code: '1430', nameTh: 'ค่าใช้จ่ายจ่ายล่วงหน้า', nameEn: 'Prepaid Expenses', accountType: 'asset' },
  { code: '1500', nameTh: 'ที่ดิน อาคาร และอุปกรณ์', nameEn: 'Property, Plant and Equipment', accountType: 'asset' },
  { code: '1510', nameTh: 'ที่ดิน', nameEn: 'Land', accountType: 'asset' },
  { code: '1520', nameTh: 'อาคาร', nameEn: 'Buildings', accountType: 'asset' },
  { code: '1530', nameTh: 'อุปกรณ์สำนักงาน', nameEn: 'Office Equipment', accountType: 'asset' },
  { code: '1540', nameTh: 'ยานพาหนะ', nameEn: 'Vehicles', accountType: 'asset' },
  { code: '1550', nameTh: 'ค่าเสื่อมราคาสะสม', nameEn: 'Accumulated Depreciation', accountType: 'asset' },
  { code: '1600', nameTh: 'สินทรัพย์ไม่มีตัวตน', nameEn: 'Intangible Assets', accountType: 'asset' },
  { code: '1610', nameTh: 'ค่าลิขสิทธิ์ซอฟต์แวร์', nameEn: 'Software Licenses', accountType: 'asset' },

  // -------------------------------------------------------------------------
  // 2xxx — Liabilities (หนี้สิน)
  // -------------------------------------------------------------------------
  { code: '2100', nameTh: 'เจ้าหนี้การค้า', nameEn: 'Accounts Payable', accountType: 'liability' },
  { code: '2110', nameTh: 'เจ้าหนี้การค้า - ทั่วไป', nameEn: 'Trade Payables - General', accountType: 'liability' },
  { code: '2200', nameTh: 'หนี้สินหมุนเวียนอื่น', nameEn: 'Other Current Liabilities', accountType: 'liability' },
  { code: '2210', nameTh: 'ภาษีขาย', nameEn: 'Output VAT', accountType: 'liability' },
  { code: '2220', nameTh: 'ภาษีหัก ณ ที่จ่าย', nameEn: 'Withholding Tax Payable', accountType: 'liability' },
  { code: '2230', nameTh: 'ค่าใช้จ่ายค้างจ่าย', nameEn: 'Accrued Expenses', accountType: 'liability' },
  { code: '2240', nameTh: 'รายได้รับล่วงหน้า', nameEn: 'Unearned Revenue', accountType: 'liability' },
  { code: '2250', nameTh: 'เงินเดือนค้างจ่าย', nameEn: 'Salaries Payable', accountType: 'liability' },
  { code: '2260', nameTh: 'ประกันสังคมค้างจ่าย', nameEn: 'Social Security Payable', accountType: 'liability' },
  { code: '2300', nameTh: 'เงินกู้ยืมระยะสั้น', nameEn: 'Short-term Loans', accountType: 'liability' },
  { code: '2400', nameTh: 'เงินกู้ยืมระยะยาว', nameEn: 'Long-term Loans', accountType: 'liability' },

  // -------------------------------------------------------------------------
  // 3xxx — Equity (ส่วนของผู้ถือหุ้น)
  // -------------------------------------------------------------------------
  { code: '3100', nameTh: 'ทุนจดทะเบียน', nameEn: 'Registered Capital', accountType: 'equity' },
  { code: '3110', nameTh: 'ทุนที่ออกและชำระแล้ว', nameEn: 'Issued and Paid-up Capital', accountType: 'equity' },
  { code: '3200', nameTh: 'กำไรสะสม', nameEn: 'Retained Earnings', accountType: 'equity' },
  { code: '3210', nameTh: 'กำไรสะสม - จัดสรรแล้ว', nameEn: 'Retained Earnings - Appropriated', accountType: 'equity' },
  { code: '3220', nameTh: 'กำไรสะสม - ยังไม่ได้จัดสรร', nameEn: 'Retained Earnings - Unappropriated', accountType: 'equity' },
  { code: '3300', nameTh: 'กำไร (ขาดทุน) สุทธิประจำปี', nameEn: 'Net Profit (Loss) for the Year', accountType: 'equity' },

  // -------------------------------------------------------------------------
  // 4xxx — Revenue (รายได้)
  // -------------------------------------------------------------------------
  { code: '4100', nameTh: 'รายได้จากการขาย', nameEn: 'Sales Revenue', accountType: 'revenue' },
  { code: '4110', nameTh: 'รายได้จากการขายสินค้า', nameEn: 'Revenue from Sale of Goods', accountType: 'revenue' },
  { code: '4120', nameTh: 'รายได้จากการให้บริการ', nameEn: 'Service Revenue', accountType: 'revenue' },
  { code: '4130', nameTh: 'รับคืนและส่วนลดจ่าย', nameEn: 'Sales Returns and Allowances', accountType: 'revenue' },
  { code: '4200', nameTh: 'รายได้อื่น', nameEn: 'Other Income', accountType: 'revenue' },
  { code: '4210', nameTh: 'ดอกเบี้ยรับ', nameEn: 'Interest Income', accountType: 'revenue' },
  { code: '4220', nameTh: 'กำไรจากอัตราแลกเปลี่ยน', nameEn: 'Foreign Exchange Gain', accountType: 'revenue' },
  { code: '4230', nameTh: 'กำไรจากการจำหน่ายสินทรัพย์', nameEn: 'Gain on Disposal of Assets', accountType: 'revenue' },

  // -------------------------------------------------------------------------
  // 5xxx — Expenses (ค่าใช้จ่าย)
  // -------------------------------------------------------------------------
  { code: '5100', nameTh: 'ต้นทุนขาย', nameEn: 'Cost of Goods Sold', accountType: 'expense' },
  { code: '5110', nameTh: 'ต้นทุนสินค้าที่ขาย', nameEn: 'Cost of Goods Sold - Merchandise', accountType: 'expense' },
  { code: '5120', nameTh: 'ต้นทุนบริการ', nameEn: 'Cost of Services', accountType: 'expense' },
  { code: '5200', nameTh: 'ค่าใช้จ่ายในการขาย', nameEn: 'Selling Expenses', accountType: 'expense' },
  { code: '5210', nameTh: 'เงินเดือน - ฝ่ายขาย', nameEn: 'Salaries - Sales', accountType: 'expense' },
  { code: '5220', nameTh: 'ค่าโฆษณา', nameEn: 'Advertising Expense', accountType: 'expense' },
  { code: '5230', nameTh: 'ค่าขนส่ง', nameEn: 'Delivery Expense', accountType: 'expense' },
  { code: '5300', nameTh: 'ค่าใช้จ่ายในการบริหาร', nameEn: 'Administrative Expenses', accountType: 'expense' },
  { code: '5310', nameTh: 'เงินเดือน - ฝ่ายบริหาร', nameEn: 'Salaries - Administration', accountType: 'expense' },
  { code: '5320', nameTh: 'ค่าเช่าสำนักงาน', nameEn: 'Office Rent', accountType: 'expense' },
  { code: '5330', nameTh: 'ค่าสาธารณูปโภค', nameEn: 'Utilities Expense', accountType: 'expense' },
  { code: '5340', nameTh: 'ค่าเสื่อมราคา', nameEn: 'Depreciation Expense', accountType: 'expense' },
  { code: '5350', nameTh: 'ค่าประกันสังคม', nameEn: 'Social Security Expense', accountType: 'expense' },
  { code: '5360', nameTh: 'ค่าใช้จ่ายเบ็ดเตล็ด', nameEn: 'Miscellaneous Expense', accountType: 'expense' },
  { code: '5400', nameTh: 'ค่าใช้จ่ายทางการเงิน', nameEn: 'Finance Costs', accountType: 'expense' },
  { code: '5410', nameTh: 'ดอกเบี้ยจ่าย', nameEn: 'Interest Expense', accountType: 'expense' },
  { code: '5420', nameTh: 'ขาดทุนจากอัตราแลกเปลี่ยน', nameEn: 'Foreign Exchange Loss', accountType: 'expense' },
  { code: '5500', nameTh: 'ค่าใช้จ่ายภาษีเงินได้', nameEn: 'Income Tax Expense', accountType: 'expense' },
] as const;
