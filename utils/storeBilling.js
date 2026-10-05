/**
 * School store billing — single source of truth.
 * GST is applied after line + bill discounts (taxable value), then rounded to paise.
 */

const roundMoney = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
};

const clampNonNegative = (value) => roundMoney(Math.max(0, Number(value) || 0));

const normalizeQty = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
};

/**
 * @param {{
 *   lines: Array<{ qty: number, unitPrice: number, gstPercent?: number, lineDiscount?: number }>,
 *   billDiscount?: number,
 *   amountReceived?: number
 * }} input
 */
const computeStoreBill = ({ lines = [], billDiscount = 0, amountReceived = 0 } = {}) => {
  const computedLines = (Array.isArray(lines) ? lines : []).map((line) => {
    const qty = normalizeQty(line.qty);
    const unitPrice = clampNonNegative(line.unitPrice);
    const gstPercent = Math.min(28, clampNonNegative(line.gstPercent));
    const lineGross = roundMoney(qty * unitPrice);
    const lineDiscount = Math.min(clampNonNegative(line.lineDiscount), lineGross);
    const lineAfterDiscount = roundMoney(lineGross - lineDiscount);

    return {
      qty,
      unitPrice,
      gstPercent,
      lineDiscount,
      lineGross,
      lineAfterDiscount,
    };
  }).filter((line) => line.qty > 0);

  const subtotal = roundMoney(computedLines.reduce((sum, line) => sum + line.lineGross, 0));
  const lineDiscountTotal = roundMoney(
    computedLines.reduce((sum, line) => sum + line.lineDiscount, 0)
  );
  const afterLineDiscount = roundMoney(
    computedLines.reduce((sum, line) => sum + line.lineAfterDiscount, 0)
  );
  const billDiscountClamped = Math.min(clampNonNegative(billDiscount), afterLineDiscount);

  let allocatedSoFar = 0;
  const finalLines = computedLines.map((line, index) => {
    const isLast = index === computedLines.length - 1;
    const share = afterLineDiscount > 0 ? line.lineAfterDiscount / afterLineDiscount : 0;
    const allocatedBillDiscount = isLast
      ? roundMoney(billDiscountClamped - allocatedSoFar)
      : roundMoney(billDiscountClamped * share);
    allocatedSoFar = roundMoney(allocatedSoFar + allocatedBillDiscount);

    const taxable = roundMoney(Math.max(0, line.lineAfterDiscount - allocatedBillDiscount));
    const lineGst = roundMoney((taxable * line.gstPercent) / 100);
    const lineTotal = roundMoney(taxable + lineGst);

    return {
      ...line,
      allocatedBillDiscount,
      taxable,
      lineGst,
      lineTotal,
    };
  });

  const taxableTotal = roundMoney(finalLines.reduce((sum, line) => sum + line.taxable, 0));
  const gstTotal = roundMoney(finalLines.reduce((sum, line) => sum + line.lineGst, 0));
  const grandTotal = roundMoney(taxableTotal + gstTotal);

  const received = clampNonNegative(amountReceived);
  const paidAmount = Math.min(received, grandTotal);
  const changeReturned = roundMoney(Math.max(0, received - grandTotal));
  const balanceAmount = roundMoney(Math.max(0, grandTotal - paidAmount));

  let paymentStatus = 'Unpaid';
  if (grandTotal === 0 || paidAmount >= grandTotal) paymentStatus = 'Paid';
  else if (paidAmount > 0) paymentStatus = 'Partial';

  return {
    lines: finalLines,
    subtotal,
    lineDiscountTotal,
    billDiscount: billDiscountClamped,
    taxableTotal,
    gstTotal,
    grandTotal,
    amountReceived: received,
    paidAmount: roundMoney(paidAmount),
    changeReturned,
    balanceAmount,
    paymentStatus,
  };
};

module.exports = {
  roundMoney,
  clampNonNegative,
  normalizeQty,
  computeStoreBill,
};
