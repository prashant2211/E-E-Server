const { computeStoreBill, roundMoney } = require('../utils/storeBilling');

const assertEqual = (actual, expected, label) => {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
};

const cases = [
  {
    name: '3 notebooks at 20, full cash',
    input: { lines: [{ qty: 3, unitPrice: 20 }], amountReceived: 60 },
    expect: { grandTotal: 60, paidAmount: 60, balanceAmount: 0, changeReturned: 0, paymentStatus: 'Paid', gstTotal: 0 },
  },
  {
    name: 'uniform with 5% GST',
    input: { lines: [{ qty: 1, unitPrice: 450, gstPercent: 5 }], amountReceived: 472.5 },
    expect: { taxableTotal: 450, gstTotal: 22.5, grandTotal: 472.5, paymentStatus: 'Paid' },
  },
  {
    name: 'mixed GST + bill discount allocated to last paise',
    input: {
      lines: [
        { qty: 2, unitPrice: 100, gstPercent: 0 },
        { qty: 1, unitPrice: 50, gstPercent: 5 },
      ],
      billDiscount: 10,
      amountReceived: 242.4,
    },
    expect: { subtotal: 250, billDiscount: 10, taxableTotal: 240, gstTotal: 2.4, grandTotal: 242.4 },
  },
  {
    name: 'line discount then GST',
    input: { lines: [{ qty: 2, unitPrice: 100, gstPercent: 12, lineDiscount: 20 }], amountReceived: 201.6 },
    expect: { subtotal: 200, lineDiscountTotal: 20, taxableTotal: 180, gstTotal: 21.6, grandTotal: 201.6 },
  },
  {
    name: 'cash overpay returns change',
    input: { lines: [{ qty: 1, unitPrice: 430 }], amountReceived: 500 },
    expect: { grandTotal: 430, paidAmount: 430, changeReturned: 70, balanceAmount: 0 },
  },
  {
    name: 'partial village credit sale',
    input: { lines: [{ qty: 1, unitPrice: 800 }], amountReceived: 300 },
    expect: { grandTotal: 800, paidAmount: 300, balanceAmount: 500, paymentStatus: 'Partial' },
  },
  {
    name: 'discount cannot exceed bill',
    input: { lines: [{ qty: 1, unitPrice: 50 }], billDiscount: 80 },
    expect: { billDiscount: 50, grandTotal: 0, paymentStatus: 'Paid' },
  },
  {
    name: 'zero qty ignored',
    input: { lines: [{ qty: 0, unitPrice: 20 }, { qty: 2, unitPrice: 15 }] },
    expect: { subtotal: 30, grandTotal: 30 },
  },
  {
    name: 'paise rounding 3 x 10.33',
    input: { lines: [{ qty: 3, unitPrice: 10.33 }] },
    expect: { subtotal: 30.99, grandTotal: 30.99 },
  },
];

cases.forEach((testCase) => {
  const result = computeStoreBill(testCase.input);
  Object.entries(testCase.expect).forEach(([key, value]) => {
    assertEqual(result[key], value, `${testCase.name} → ${key}`);
  });
});

const leftover = computeStoreBill({
  lines: [
    { qty: 1, unitPrice: 10, gstPercent: 5 },
    { qty: 1, unitPrice: 10, gstPercent: 12 },
    { qty: 1, unitPrice: 10, gstPercent: 18 },
  ],
  billDiscount: 1,
});
assertEqual(leftover.billDiscount, 1, '3-line bill discount stays 1');
assertEqual(
  leftover.lines.reduce((sum, line) => roundMoney(sum + line.allocatedBillDiscount), 0),
  1,
  'allocated discount sums to bill discount'
);
assertEqual(leftover.grandTotal, leftover.taxableTotal + leftover.gstTotal, 'grand = taxable + gst');

console.log(`Verified ${cases.length + 1} store billing scenarios`);
