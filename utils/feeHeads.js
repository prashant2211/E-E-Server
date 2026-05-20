/**
 * Fee head definitions and helpers for structure, collection, and pending calculations.
 */
const FEE_HEADS = [
  { key: 'TutionFee', label: 'Tuition Fee', defaultFrequency: 'monthly' },
  { key: 'LibraryFee', label: 'Library Fee', defaultFrequency: 'monthly' },
  { key: 'ActivityFee', label: 'Activity Fee', defaultFrequency: 'monthly' },
  { key: 'ExamFee', label: 'Examination Fee', defaultFrequency: 'yearly' },
  { key: 'UniformFee', label: 'Uniform Fee', defaultFrequency: 'yearly' },
  { key: 'ProspectusFee', label: 'Prospectus Fee', defaultFrequency: 'yearly' },
  { key: 'AdmissionFee', label: 'Admission Fee', defaultFrequency: 'yearly' },
  { key: 'TransportFee', label: 'Transport Fee', defaultFrequency: 'monthly' },
  { key: 'OtherFee', label: 'Other Fee', defaultFrequency: 'monthly' },
]

const FREQUENCY_FIELDS = {
  TutionFee: 'TutionFeeFrequency',
  LibraryFee: 'LibraryFeeFrequency',
  ActivityFee: 'ActivityFeeFrequency',
  ExamFee: 'ExamFeeFrequency',
  UniformFee: 'UniformFeeFrequency',
  ProspectusFee: 'ProspectusFeeFrequency',
  AdmissionFee: 'AdmissionFeeFrequency',
  TransportFee: 'TransportFeeFrequency',
  OtherFee: 'OtherFeeFrequency',
}

const toAmount = (val) => {
  if (val === null || val === undefined) return 0
  const n = parseFloat(String(val).replace(/,/g, '').trim())
  return Number.isNaN(n) ? 0 : n
}

const normalizeFrequency = (value, fallback = 'monthly') => {
  const v = String(value || fallback).trim().toLowerCase()
  if (v === 'yearly' || v === 'annual' || v === 'once' || v === 'one-time' || v === 'onetime') {
    return 'yearly'
  }
  return 'monthly'
}

const getHeadFrequency = (structure, headKey) => {
  const field = FREQUENCY_FIELDS[headKey]
  const fromStructure = field && structure ? structure[field] : null
  const head = FEE_HEADS.find((h) => h.key === headKey)
  return normalizeFrequency(fromStructure, head?.defaultFrequency || 'monthly')
}

const getHeadAmount = (structure, headKey) => {
  if (!structure) return 0
  return toAmount(structure[headKey])
}

/** Sync lookup from a preloaded structures array (analytics / batch jobs). */
const findFeeStructureFromList = (structures, className, section = '') => {
  if (!className || !Array.isArray(structures)) return null
  const sectionNorm = String(section || '').trim()
  if (sectionNorm) {
    const bySection = structures.find(
      (fs) => fs.Class === className && String(fs.Section || '').trim() === sectionNorm
    )
    if (bySection) return bySection
  }
  return (
    structures.find(
      (fs) => fs.Class === className && !String(fs.Section || '').trim()
    ) || null
  )
}

const findFeeStructure = async (feeStructureModel, instutionId, className, section = '') => {
  if (!instutionId || !className) return null
  const sectionNorm = String(section || '').trim()
  if (sectionNorm) {
    const bySection = await feeStructureModel
      .findOne({ InstutionId: instutionId, Class: className, Section: sectionNorm })
      .lean()
    if (bySection) return bySection
  }
  return feeStructureModel
    .findOne({
      InstutionId: instutionId,
      Class: className,
      $or: [{ Section: '' }, { Section: { $exists: false } }, { Section: null }],
    })
    .lean()
}

const buildHeadsFromStructure = (structure) =>
  FEE_HEADS.map((head) => {
    const amount = getHeadAmount(structure, head.key)
    const frequency = getHeadFrequency(structure, head.key)
    return {
      key: head.key,
      label: head.label,
      amount,
      frequency,
      frequencyLabel: frequency === 'yearly' ? 'Once per year' : 'Monthly',
    }
  }).filter((h) => h.amount > 0)

const sumHeadsByFrequency = (structure, frequency) => {
  const computed = FEE_HEADS.reduce((sum, head) => {
    if (getHeadFrequency(structure, head.key) !== frequency) return sum
    return sum + getHeadAmount(structure, head.key)
  }, 0)
  if (computed > 0) return computed
  if (frequency === 'monthly') return toAmount(structure?.MonthlyTotal)
  if (frequency === 'yearly') return toAmount(structure?.YearlyTotal)
  return 0
}

/** Sum fee head amounts on a payment record for one billing cycle (monthly / yearly). */
const sumHeadsByFrequencyOnPayment = (payment, structure, frequency) => {
  if (!payment || !structure) return 0
  return FEE_HEADS.reduce((sum, head) => {
    if (getHeadFrequency(structure, head.key) !== frequency) return sum
    return sum + getHeadAmount(payment, head.key)
  }, 0)
}

const paymentCountsAsPaid = (payment) =>
  payment &&
  payment.Status === 'Success' &&
  (!payment.VerificationStatus ||
    payment.VerificationStatus === '' ||
    payment.VerificationStatus === 'Approved')

const headPaidOnPayment = (payment, headKey) => getHeadAmount(payment, headKey) > 0

const parseSelectedFeeHeads = (body = {}) => {
  if (Array.isArray(body.SelectedFeeHeads) && body.SelectedFeeHeads.length > 0) {
    return body.SelectedFeeHeads.map((k) => String(k).trim()).filter(Boolean)
  }
  if (typeof body.SelectedFeeHeads === 'string' && body.SelectedFeeHeads.trim()) {
    try {
      const parsed = JSON.parse(body.SelectedFeeHeads)
      if (Array.isArray(parsed)) return parsed.map((k) => String(k).trim()).filter(Boolean)
    } catch {
      return body.SelectedFeeHeads.split(',').map((k) => String(k).trim()).filter(Boolean)
    }
  }
  return []
}

/** Legacy FeeType → fee head keys when SelectedFeeHeads not sent */
const legacyFeeTypeToHeads = (feeType, structure) => {
  const type = String(feeType || '').trim()
  const allHeads = buildHeadsFromStructure(structure)
  if (!type || type === 'Monthly') {
    return allHeads.filter((h) => h.frequency === 'monthly').map((h) => h.key)
  }
  if (type === 'Admission') {
    return allHeads.filter((h) => h.key === 'AdmissionFee').map((h) => h.key)
  }
  if (type === 'Transport') {
    return allHeads.filter((h) => h.key === 'TransportFee').map((h) => h.key)
  }
  if (type === 'Other') {
    return allHeads.filter((h) => h.key === 'OtherFee').map((h) => h.key)
  }
  return allHeads.map((h) => h.key)
}

const resolveSelectedHeadKeys = (body, structure) => {
  const explicit = parseSelectedFeeHeads(body)
  if (explicit.length > 0) return explicit
  return legacyFeeTypeToHeads(body.FeeType, structure)
}

const amountsForSelectedHeads = (structure, selectedKeys) => {
  const amounts = {}
  let total = 0
  let monthlyTotal = 0
  let yearlyTotal = 0
  FEE_HEADS.forEach((head) => {
    const selected = selectedKeys.includes(head.key)
    const amt = selected ? getHeadAmount(structure, head.key) : 0
    amounts[head.key] = amt
    total += amt
    if (selected && amt > 0) {
      if (getHeadFrequency(structure, head.key) === 'yearly') {
        yearlyTotal += amt
      } else {
        monthlyTotal += amt
      }
    }
  })
  return { amounts, total, monthlyTotal, yearlyTotal }
}

const sumSelectedHeadsFromHeads = (heads, selectedKeys, frequency = null) =>
  heads
    .filter((h) => selectedKeys.includes(h.key))
    .filter((h) => !frequency || h.frequency === frequency)
    .reduce((sum, h) => sum + h.amount, 0)

const feeTypeLabelFromHeads = (selectedKeys) => {
  const labels = FEE_HEADS.filter((h) => selectedKeys.includes(h.key)).map((h) => h.label)
  return labels.length ? labels.join(', ') : 'Fee payment'
}

const computeDueContext = ({ structure, payments = [], month = '', academicYear = '' }) => {
  const heads = buildHeadsFromStructure(structure)
  const paidPayments = payments.filter(paymentCountsAsPaid)

  const enrichedHeads = heads.map((head) => {
    let isPaidForPeriod = false
    if (head.frequency === 'monthly') {
      isPaidForPeriod = paidPayments.some(
        (p) => headPaidOnPayment(p, head.key) && (!month || String(p.Month || '') === month)
      )
    } else {
      isPaidForPeriod = paidPayments.some(
        (p) =>
          headPaidOnPayment(p, head.key) &&
          (!academicYear || String(p.AcademicYear || '') === academicYear)
      )
    }
    return {
      ...head,
      isPaidForPeriod,
      isDue: !isPaidForPeriod,
    }
  })

  const monthlyDue = enrichedHeads
    .filter((h) => h.frequency === 'monthly' && h.isDue)
    .reduce((s, h) => s + h.amount, 0)

  const yearlyDue = enrichedHeads
    .filter((h) => h.frequency === 'yearly' && h.isDue)
    .reduce((s, h) => s + h.amount, 0)

  /** Current-month bucket: monthly dues only (excludes yearly one-time fees) */
  const currentMonthFee = monthlyDue
  const defaultSelectedKeys = enrichedHeads
    .filter((h) => h.frequency === 'monthly' && h.isDue)
    .map((h) => h.key)

  return {
    heads: enrichedHeads,
    monthlyDue,
    yearlyDue,
    currentMonthFee,
    /** @deprecated use currentMonthFee — kept for older clients */
    currentPeriodDue: currentMonthFee,
    defaultSelectedKeys,
    monthlyTotal: sumHeadsByFrequency(structure, 'monthly'),
    yearlyTotal: sumHeadsByFrequency(structure, 'yearly'),
  }
}

/**
 * Payment settlement for fee collection UI.
 * totalDue = previousBalance + selected monthly + selected yearly (after discounts)
 * totalRemainingAfterPayment = totalDue − paid
 */
const computePaymentSettlement = ({
  previousBalance = 0,
  /** @deprecated alias */
  previousMonthlyPending = null,
  monthlyTotal = 0,
  yearlyTotal = 0,
  scholarship = 0,
  concession = 0,
  paid = 0,
}) => {
  const prevBal =
    previousMonthlyPending != null && previousBalance === 0
      ? toAmount(previousMonthlyPending)
      : toAmount(previousBalance)

  const discount = toAmount(scholarship) + toAmount(concession)
  const monthlyGross = toAmount(monthlyTotal)
  const yearlyGross = toAmount(yearlyTotal)
  const monthlyNet = Math.max(0, monthlyGross - Math.min(discount, monthlyGross))
  const discountLeft = Math.max(0, discount - monthlyGross)
  const yearlyNet = Math.max(0, yearlyGross - discountLeft)

  const totalDueBeforePayment = prevBal + monthlyNet + yearlyNet
  const paidAmount = toAmount(paid)
  const totalRemainingAfterPayment = Math.max(0, totalDueBeforePayment - paidAmount)

  return {
    previousBalance: prevBal,
    monthlyNet,
    yearlyNet,
    totalDueBeforePayment,
    totalRemainingAfterPayment,
    /** Monthly-only portion still owed (analytics / replay) */
    newMonthlyPending: Math.max(0, monthlyNet - Math.min(paidAmount, monthlyNet)),
  }
}

/** Balance carried forward from the most recent successful payment. */
const getPreviousBalanceCarriedForward = (
  payments = [],
  { excludePaymentId = null, fallback = 0 } = {}
) => {
  const paid = payments
    .filter(paymentCountsAsPaid)
    .filter((p) => !excludePaymentId || String(p._id || '') !== String(excludePaymentId))

  if (!paid.length) {
    return toAmount(fallback)
  }

  const sorted = [...paid].sort((a, b) => paymentSortTime(b) - paymentSortTime(a))
  return toAmount(sorted[0].PendingAmount)
}

const paymentSortTime = (payment) => {
  if (payment?.createdAt) return new Date(payment.createdAt).getTime()
  const dateStr = String(payment?.Date || '').trim()
  const timeStr = String(payment?.Time || '').trim()
  if (dateStr) {
    const parsed = Date.parse(`${dateStr} ${timeStr}`.trim())
    if (!Number.isNaN(parsed)) return parsed
  }
  return 0
}

const getSelectedKeysFromPayment = (payment, structure) => {
  if (!payment) return []
  if (Array.isArray(payment.SelectedFeeHeads) && payment.SelectedFeeHeads.length) {
    return payment.SelectedFeeHeads.map((k) => String(k).trim()).filter(Boolean)
  }
  if (!structure) return []
  return FEE_HEADS.filter((head) => getHeadAmount(payment, head.key) > 0).map((head) => head.key)
}

/**
 * Replay payment history with monthly/yearly split so legacy PendingAmount (often included yearly) is corrected.
 */
const recomputeMonthlyArrears = (structure, payments = [], { excludePaymentId = null } = {}) => {
  if (!structure) return 0

  const paid = payments
    .filter(paymentCountsAsPaid)
    .filter((p) => !excludePaymentId || String(p._id || '') !== String(excludePaymentId))
    .sort((a, b) => paymentSortTime(a) - paymentSortTime(b))

  let monthlyPending = 0
  paid.forEach((payment) => {
    const selectedKeys = getSelectedKeysFromPayment(payment, structure)
    const { monthlyTotal, yearlyTotal } = amountsForSelectedHeads(structure, selectedKeys)
    const settlement = computePaymentSettlement({
      previousBalance: monthlyPending,
      monthlyTotal,
      yearlyTotal,
      scholarship: payment.ScholarshipAmount,
      concession: payment.ConcessionAmount,
      paid: payment.PaidAmount,
    })
    monthlyPending = settlement.totalRemainingAfterPayment
  })

  return monthlyPending
}

/** Strip yearly fees only when fallback equals full structure total (legacy bad data). */
const sanitizeMonthlyFallback = (structure, fallback) => {
  const fb = toAmount(fallback)
  if (!structure || fb <= 0) return 0
  const monthly = sumHeadsByFrequency(structure, 'monthly')
  const yearly = sumHeadsByFrequency(structure, 'yearly')
  const grand = monthly + yearly
  if (yearly > 0 && grand > 0 && fb >= grand - 1) {
    return Math.max(0, fb - yearly)
  }
  return fb
}

/**
 * Monthly pending only — never includes optional yearly fees.
 */
const getPreviousMonthlyPending = (
  payments = [],
  { structure = null, excludePaymentId = null, fallback = 0 } = {}
) => {
  if (structure) {
    const replayed = recomputeMonthlyArrears(structure, payments, { excludePaymentId })
    const paid = payments.filter(
      (p) =>
        paymentCountsAsPaid(p) &&
        (!excludePaymentId || String(p._id || '') !== String(excludePaymentId))
    )
    if (paid.length > 0) {
      return replayed
    }
    return sanitizeMonthlyFallback(structure, fallback)
  }

  const paid = payments
    .filter(paymentCountsAsPaid)
    .filter((p) => !excludePaymentId || String(p._id || '') !== String(excludePaymentId))

  if (!paid.length) {
    return toAmount(fallback)
  }

  const sorted = [...paid].sort((a, b) => paymentSortTime(b) - paymentSortTime(a))
  return toAmount(sorted[0].PendingAmount)
}

/**
 * Institution-wide current-month pending: unpaid monthly heads only (yearly excluded).
 */
const computeInstitutionMonthlyPending = ({
  students = [],
  structures = [],
  paymentsByStudent = new Map(),
  month = '',
  academicYear = '',
}) => {
  let currentMonthPending = 0
  let currentMonthExpected = 0
  let studentsWithCurrentMonthPending = 0

  students.forEach((student) => {
    const reg = student.Registration_Number
    if (!reg) return
    const structure = findFeeStructureFromList(structures, student.Class, student.Section || '')
    if (!structure) return

    currentMonthExpected += sumHeadsByFrequency(structure, 'monthly')

    const payments = paymentsByStudent.get(reg) || []
    const { monthlyDue } = computeDueContext({
      structure,
      payments,
      month,
      academicYear,
    })
    if (monthlyDue > 0) studentsWithCurrentMonthPending += 1
    currentMonthPending += monthlyDue
  })

  return { currentMonthPending, currentMonthExpected, studentsWithCurrentMonthPending }
}

module.exports = {
  FEE_HEADS,
  FREQUENCY_FIELDS,
  toAmount,
  normalizeFrequency,
  getHeadFrequency,
  getHeadAmount,
  findFeeStructure,
  findFeeStructureFromList,
  buildHeadsFromStructure,
  sumHeadsByFrequency,
  sumHeadsByFrequencyOnPayment,
  computeInstitutionMonthlyPending,
  parseSelectedFeeHeads,
  legacyFeeTypeToHeads,
  resolveSelectedHeadKeys,
  amountsForSelectedHeads,
  sumSelectedHeadsFromHeads,
  feeTypeLabelFromHeads,
  computeDueContext,
  paymentCountsAsPaid,
  getSelectedKeysFromPayment,
  recomputeMonthlyArrears,
  sanitizeMonthlyFallback,
  getPreviousMonthlyPending,
  getPreviousBalanceCarriedForward,
  computePaymentSettlement,
}
