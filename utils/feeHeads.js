/**
 * Fee head definitions and helpers for structure, collection, and pending calculations.
 */
/** Virtual fee type: prior outstanding balance (not in fee structure document). */
const PENDING_FEE_KEY = 'PendingFee'
const PENDING_FEE_LABEL = 'Pending Fee'

const {
  isOtherFeeSubtypeKey,
  parseOtherFeeSubtypes,
  parseOtherFeeBreakdown,
  getOtherSubtypeAmountOnPayment,
} = require('./otherFeeSubtypes')

const STANDARD_FEE_HEADS = [
  { key: 'TutionFee', label: 'Tuition Fee', defaultFrequency: 'monthly' },
  { key: 'LibraryFee', label: 'Library Fee', defaultFrequency: 'monthly' },
  { key: 'ActivityFee', label: 'Activity Fee', defaultFrequency: 'monthly' },
  { key: 'ExamFee', label: 'Examination Fee', defaultFrequency: 'yearly' },
  { key: 'UniformFee', label: 'Uniform Fee', defaultFrequency: 'yearly' },
  { key: 'ProspectusFee', label: 'Prospectus Fee', defaultFrequency: 'yearly' },
  { key: 'AdmissionFee', label: 'Admission Fee', defaultFrequency: 'yearly' },
  { key: 'TransportFee', label: 'Transport Fee', defaultFrequency: 'monthly' },
]

/** Includes legacy OtherFee head key for payment compatibility. */
const FEE_HEADS = [
  ...STANDARD_FEE_HEADS,
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
  const v = String(value ?? fallback ?? '').trim().toLowerCase()
  if (!v) return fallback === 'yearly' ? 'yearly' : 'monthly'
  if (
    v === 'yearly' ||
    v === 'annual' ||
    v === 'annually' ||
    v === 'once' ||
    v === 'one-time' ||
    v === 'onetime' ||
    v === 'once per year' ||
    v === 'once/year' ||
    v.includes('year')
  ) {
    return 'yearly'
  }
  return 'monthly'
}

const getHeadFrequency = (structure, headKey) => {
  if (isOtherFeeSubtypeKey(headKey)) {
    const subtypes = parseOtherFeeSubtypes(structure)
    const match = subtypes.find((s) => s.key === headKey)
    if (match) return match.frequency
    if (headKey === 'OtherFee' && subtypes.length === 1) return subtypes[0].frequency
  }
  const field = FREQUENCY_FIELDS[headKey]
  const fromStructure = field && structure ? structure[field] : null
  const head = FEE_HEADS.find((h) => h.key === headKey)
  return normalizeFrequency(fromStructure, head?.defaultFrequency || 'monthly')
}

const getHeadAmount = (structure, headKey) => {
  if (!structure) return 0
  if (isOtherFeeSubtypeKey(headKey)) {
    const subtypes = parseOtherFeeSubtypes(structure)
    const match = subtypes.find((s) => s.key === headKey)
    if (match) return match.amount
    if (headKey === 'OtherFee') {
      return subtypes.reduce((sum, s) => sum + s.amount, 0)
    }
    return 0
  }
  return toAmount(structure[headKey])
}

const structuresForClass = (structures, className) => {
  const classNorm = String(className || '').trim()
  if (!classNorm || !Array.isArray(structures)) return []
  const exact = structures.filter((fs) => String(fs.Class || '').trim() === classNorm)
  if (exact.length) return exact
  const lower = classNorm.toLowerCase()
  return structures.filter((fs) => String(fs.Class || '').trim().toLowerCase() === lower)
}

/** Sync lookup from a preloaded structures array (analytics / batch jobs). */
const findFeeStructureFromList = (structures, className, section = '') => {
  const pool = structuresForClass(structures, className)
  if (!pool.length) return null
  const sectionNorm = String(section || '').trim()
  if (sectionNorm) {
    const bySection = pool.find((fs) => String(fs.Section || '').trim() === sectionNorm)
    if (bySection) return bySection
    const sectionLower = sectionNorm.toLowerCase()
    const bySectionCI = pool.find(
      (fs) => String(fs.Section || '').trim().toLowerCase() === sectionLower
    )
    if (bySectionCI) return bySectionCI
  }
  return pool.find((fs) => !String(fs.Section || '').trim()) || pool[0] || null
}

const findFeeStructure = async (feeStructureModel, instutionId, className, section = '') => {
  if (!instutionId || !className) return null
  const classNorm = String(className).trim()
  const sectionNorm = String(section || '').trim()
  if (sectionNorm) {
    const bySection = await feeStructureModel
      .findOne({ InstutionId: instutionId, Class: classNorm, Section: sectionNorm })
      .lean()
    if (bySection) return bySection
  }
  const classLevel = await feeStructureModel
    .findOne({
      InstutionId: instutionId,
      Class: classNorm,
      $or: [{ Section: '' }, { Section: { $exists: false } }, { Section: null }],
    })
    .lean()
  if (classLevel) return classLevel
  return feeStructureModel.findOne({ InstutionId: instutionId, Class: classNorm }).lean()
}

const buildHeadsFromStructure = (structure) => {
  const standard = STANDARD_FEE_HEADS.map((head) => {
    const amount = getHeadAmount(structure, head.key)
    const frequency = getHeadFrequency(structure, head.key)
    return {
      key: head.key,
      label: head.label,
      amount,
      frequency,
      frequencyLabel: frequency === 'yearly' ? 'Once per year' : 'Monthly',
      isOtherSubtype: false,
    }
  }).filter((h) => h.amount > 0)

  const otherSubtypes = parseOtherFeeSubtypes(structure).map((item) => ({
    key: item.key,
    label: item.name,
    amount: item.amount,
    frequency: item.frequency,
    frequencyLabel: item.frequency === 'yearly' ? 'Once per year' : 'Monthly',
    isOtherSubtype: true,
  }))

  return [...standard, ...otherSubtypes]
}

const getMarkedMonthlyHeads = (structure) =>
  buildHeadsFromStructure(structure).filter((h) => h.frequency === 'monthly' && h.amount > 0)

const sumHeadsByFrequency = (structure, frequency) =>
  buildHeadsFromStructure(structure)
    .filter((h) => h.frequency === frequency)
    .reduce((sum, h) => sum + h.amount, 0)

/** Sum fee head amounts on a payment record for one billing cycle (monthly / yearly). */
const sumHeadsByFrequencyOnPayment = (payment, structure, frequency) => {
  if (!payment || !structure) return 0
  let sum = STANDARD_FEE_HEADS.reduce((acc, head) => {
    if (getHeadFrequency(structure, head.key) !== frequency) return acc
    return acc + getHeadAmount(payment, head.key)
  }, 0)
  parseOtherFeeBreakdown(payment)
    .filter((item) => item.frequency === frequency)
    .forEach((item) => {
      sum += item.amount
    })
  if (sum <= 0 && frequency === 'monthly') {
    const legacyOther = toAmount(payment.OtherFee)
    const breakdown = parseOtherFeeBreakdown(payment)
    if (legacyOther > 0 && breakdown.length === 0) {
      const monthlyOtherDue = parseOtherFeeSubtypes(structure)
        .filter((s) => s.frequency === 'monthly')
        .reduce((a, s) => a + s.amount, 0)
      if (monthlyOtherDue > 0) sum += Math.min(legacyOther, monthlyOtherDue)
    }
  }
  return sum
}

const paymentCountsAsPaid = (payment) =>
  payment &&
  payment.Status === 'Success' &&
  (!payment.VerificationStatus ||
    payment.VerificationStatus === '' ||
    payment.VerificationStatus === 'Approved')

const headPaidOnPayment = (payment, headKey) => {
  if (isOtherFeeSubtypeKey(headKey)) {
    return getOtherSubtypeAmountOnPayment(payment, headKey) > 0
  }
  return getHeadAmount(payment, headKey) > 0
}

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
    return allHeads.filter((h) => h.isOtherSubtype || h.key === 'OtherFee').map((h) => h.key)
  }
  return allHeads.map((h) => h.key)
}

const filterStructureHeadKeys = (selectedKeys) =>
  (Array.isArray(selectedKeys) ? selectedKeys : []).filter((k) => k && k !== PENDING_FEE_KEY)

const buildPendingFeeHead = (outstandingAmount) => {
  const amount = toAmount(outstandingAmount)
  if (amount <= 0) return null
  return {
    key: PENDING_FEE_KEY,
    label: PENDING_FEE_LABEL,
    amount,
    frequency: 'arrears',
    frequencyLabel: 'Outstanding balance',
    isDue: true,
    isPaidForPeriod: false,
  }
}

const resolveSelectedHeadKeys = (body, structure) => {
  const explicit = parseSelectedFeeHeads(body)
  if (explicit.length > 0) return explicit
  return legacyFeeTypeToHeads(body.FeeType, structure)
}

const amountsForSelectedHeads = (structure, selectedKeys) => {
  const structureKeys = filterStructureHeadKeys(selectedKeys)
  const amounts = {}
  STANDARD_FEE_HEADS.forEach((head) => {
    amounts[head.key] = 0
  })
  amounts.OtherFee = 0

  let total = 0
  let monthlyTotal = 0
  let yearlyTotal = 0
  const otherFeeBreakdown = []

  buildHeadsFromStructure(structure).forEach((head) => {
    if (!structureKeys.includes(head.key)) return
    const amt = head.amount
    if (head.isOtherSubtype || isOtherFeeSubtypeKey(head.key)) {
      otherFeeBreakdown.push({
        key: head.key,
        name: head.label,
        amount: amt,
        frequency: head.frequency,
      })
      amounts.OtherFee += amt
    } else {
      amounts[head.key] = amt
    }
    total += amt
    if (head.frequency === 'yearly') yearlyTotal += amt
    else monthlyTotal += amt
  })

  return { amounts, total, monthlyTotal, yearlyTotal, otherFeeBreakdown }
}

const sumSelectedHeadsFromHeads = (heads, selectedKeys, frequency = null) =>
  heads
    .filter((h) => selectedKeys.includes(h.key))
    .filter((h) => !frequency || h.frequency === frequency)
    .reduce((sum, h) => sum + h.amount, 0)

const feeTypeLabelFromHeads = (selectedKeys, structure = null) => {
  const keys = Array.isArray(selectedKeys) ? selectedKeys : []
  if (structure) {
    const heads = buildHeadsFromStructure(structure)
    const labels = heads.filter((h) => keys.includes(h.key)).map((h) => h.label)
    if (keys.includes(PENDING_FEE_KEY)) labels.push(PENDING_FEE_LABEL)
    return labels.length ? labels.join(', ') : 'Fee payment'
  }
  const labels = FEE_HEADS.filter((h) => keys.includes(h.key)).map((h) => h.label)
  if (keys.includes(PENDING_FEE_KEY)) labels.push(PENDING_FEE_LABEL)
  return labels.length ? labels.join(', ') : 'Fee payment'
}

const computeDueContext = ({ structure, payments = [], month = '', academicYear = '' }) => {
  const heads = buildHeadsFromStructure(structure)
  const paidPayments = payments.filter(paymentCountsAsPaid)
  const advanceCoveredMonths = getAdvanceCoveredMonths(paidPayments)
  const monthAdvanceCovered = month && advanceCoveredMonths.has(String(month).trim())

  const enrichedHeads = heads.map((head) => {
    let isPaidForPeriod = false
    if (head.frequency === 'monthly') {
      if (monthAdvanceCovered) {
        isPaidForPeriod = true
      } else {
        isPaidForPeriod = paidPayments.some(
          (p) => headPaidOnPayment(p, head.key) && (!month || String(p.Month || '') === month)
        )
      }
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

/** Fee head keys in selectedKeys that are already paid for the current period/month. */
const getAlreadyPaidSelectedHeads = (heads = [], selectedKeys = []) =>
  filterStructureHeadKeys(selectedKeys).filter((key) => {
    const head = heads.find((h) => h.key === key)
    return Boolean(head?.isPaidForPeriod)
  })

const alreadyPaidHeadLabels = (heads = [], selectedKeys = []) =>
  getAlreadyPaidSelectedHeads(heads, selectedKeys).map((key) => {
    const head = heads.find((h) => h.key === key)
    return head?.label || key
  })

/**
 * Payment settlement for fee collection UI.
 * totalDue = previousBalance + selected monthly + selected yearly (after discounts)
 * totalRemainingAfterPayment = totalDue − paid
 */
const computePaymentSettlement = ({
  previousBalance = 0,
  monthlyTotal = 0,
  yearlyTotal = 0,
  scholarship = 0,
  concession = 0,
  paid = 0,
}) => {
  const prevBal = toAmount(previousBalance)

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
  const keys = STANDARD_FEE_HEADS.filter((head) => getHeadAmount(payment, head.key) > 0).map(
    (head) => head.key
  )
  parseOtherFeeBreakdown(payment).forEach((item) => keys.push(item.key))
  if (toAmount(payment.OtherFee) > 0 && parseOtherFeeBreakdown(payment).length === 0) {
    keys.push('OtherFee')
  }
  return keys
}

const listMonthsInclusive = (fromKey, toKey) => {
  const from = String(fromKey || '').trim()
  const to = String(toKey || '').trim()
  if (!from || !to || from > to) return []
  const months = []
  let cursor = from
  let guard = 0
  while (cursor <= to && guard < 36) {
    months.push(cursor)
    cursor = addMonthsToKey(cursor, 1)
    guard += 1
  }
  return months
}

/** SYSTEM-billed months before the current collection month. */
const getPastBilledMonths = (payments = [], currentMonth = '') => {
  const current = String(currentMonth || currentMonthKey()).trim()
  return [
    ...new Set(
      (Array.isArray(payments) ? payments : [])
        .filter((p) => isSystemMonthlyGeneration(p))
        .map((p) => String(p.Month || '').trim())
        .filter((m) => m && m < current)
    ),
  ].sort()
}

const hasSuccessfulMonthlyPaymentForMonth = (payments = [], month = '', structure = null) => {
  const monthKey = String(month || '').trim()
  if (!monthKey) return false
  return (Array.isArray(payments) ? payments : []).filter(paymentCountsAsPaid).some((p) => {
    if (p?.IsAdvancePayment) return false
    if (String(p.Month || '').trim() !== monthKey) return false
    const keys = filterStructureHeadKeys(getSelectedKeysFromPayment(p, structure))
    return keys.some((k) => getHeadFrequency(structure, k) === 'monthly')
  })
}

const paymentCreditsMonthlyLedger = (payment, structure) => {
  const paidPlusDiscount =
    toAmount(payment?.PaidAmount) +
    toAmount(payment?.ScholarshipAmount) +
    toAmount(payment?.ConcessionAmount)
  const explicitHeads = Array.isArray(payment?.SelectedFeeHeads)
    ? payment.SelectedFeeHeads.map((k) => String(k).trim()).filter(Boolean)
    : []
  const includesPending = explicitHeads.includes(PENDING_FEE_KEY)
  let selectedKeys = filterStructureHeadKeys(getSelectedKeysFromPayment(payment, structure))
  if (!explicitHeads.length) {
    selectedKeys = selectedKeys.filter((k) => getHeadFrequency(structure, k) === 'monthly')
  }
  const { monthlyTotal, yearlyTotal } = amountsForSelectedHeads(structure, selectedKeys)
  const yearlyPart = explicitHeads.length ? yearlyTotal : 0
  return {
    includesPending,
    monthlySelected: monthlyTotal,
    credit: Math.max(0, paidPlusDiscount - yearlyPart),
  }
}

/**
 * Apply a payment to the monthly ledger only. Yearly heads never stay in outstanding.
 */
const monthlyOutstandingAfterPayment = ({
  previousBalance = 0,
  monthlyTotal = 0,
  yearlyTotal = 0,
  scholarship = 0,
  concession = 0,
  paid = 0,
}) => {
  const settlement = computePaymentSettlement({
    previousBalance,
    monthlyTotal,
    yearlyTotal: 0,
    scholarship,
    concession,
    paid,
  })
  return settlement.totalRemainingAfterPayment
}

/**
 * Previous-month monthly arrears only.
 * Each generated month is owed once. Later "Pending Fee" collections reduce leftover arrears.
 * Yearly heads never enter this number.
 */
const computeMonthlyArrears = (structure, payments = [], currentMonth = '') => {
  if (!structure) return 0
  const monthlyAmount = sumHeadsByFrequency(structure, 'monthly')
  if (monthlyAmount <= 0) return 0

  const relevant = Array.isArray(payments) ? payments : []
  const current = String(currentMonth || currentMonthKey()).trim()
  let arrears = 0

  getPastBilledMonths(relevant, current).forEach((monthKey) => {
    if (isMonthAdvanceCovered(relevant, monthKey)) return
    const monthPays = relevant.filter(
      (p) =>
        paymentCountsAsPaid(p) &&
        !p?.IsAdvancePayment &&
        String(p.Month || '').trim() === monthKey
    )
    if (!monthPays.length) {
      arrears += monthlyAmount
      return
    }
    const credited = monthPays.reduce((sum, p) => {
      const { credit, monthlySelected } = paymentCreditsMonthlyLedger(p, structure)
      const towardThisMonth = monthlySelected > 0 ? Math.min(credit, monthlyAmount) : 0
      return sum + towardThisMonth
    }, 0)
    arrears += Math.max(0, monthlyAmount - credited)
  })

  relevant
    .filter((p) => paymentCountsAsPaid(p) && !p?.IsAdvancePayment)
    .forEach((p) => {
      const { includesPending, monthlySelected, credit } = paymentCreditsMonthlyLedger(p, structure)
      if (!includesPending) return
      arrears = Math.max(0, arrears - Math.max(0, credit - monthlySelected))
    })

  return arrears
}

const recomputeMonthlyArrears = (
  structure,
  payments = [],
  { excludePaymentId = null, month = '' } = {}
) => {
  const relevant = (Array.isArray(payments) ? payments : []).filter(
    (p) => !excludePaymentId || String(p._id || '') !== String(excludePaymentId)
  )
  return computeMonthlyArrears(structure, relevant, month || currentMonthKey())
}

/** Total monthly outstanding = previous unpaid months + unpaid current-month monthly heads. */
const computeTotalMonthlyOutstanding = (
  structure,
  payments = [],
  { excludePaymentId = null, month = '', academicYear = '' } = {}
) => {
  const relevant = (Array.isArray(payments) ? payments : []).filter(
    (p) => !excludePaymentId || String(p._id || '') !== String(excludePaymentId)
  )
  const current = String(month || currentMonthKey()).trim()
  const arrears = computeMonthlyArrears(structure, relevant, current)
  const { monthlyDue } = computeDueContext({
    structure,
    payments: relevant,
    month: current,
    academicYear,
  })
  return {
    arrears,
    currentMonthDue: monthlyDue,
    outstanding: arrears + monthlyDue,
  }
}

/**
 * Amount the student needs to pay now for this school only:
 * unpaid SYSTEM-billed previous months + unpaid current-month monthly fee.
 * Yearly heads never enter this number.
 * student.OutstandingAmount is not used — it historically mixed yearly and stale totals.
 */
const computeStudentTotalPayable = (
  structure,
  payments = [],
  { excludePaymentId = null, month = '', academicYear = '' } = {}
) => {
  if (!structure) {
    return { arrears: 0, currentMonthDue: 0, outstanding: 0 }
  }
  return computeTotalMonthlyOutstanding(structure, payments, {
    excludePaymentId,
    month,
    academicYear,
  })
}

/** Reduce the student running outstanding after a collection. Yearly heads do not reduce it. */
const applyPaymentToStudentOutstanding = ({
  storedOutstanding = 0,
  paid = 0,
  scholarship = 0,
  concession = 0,
  yearlyAmount = 0,
  currentMonthAlreadyInStored = false,
  includesPending = false,
}) => {
  const credit = Math.max(
    0,
    toAmount(paid) + toAmount(scholarship) + toAmount(concession) - toAmount(yearlyAmount)
  )
  const stored = toAmount(storedOutstanding)
  if (currentMonthAlreadyInStored || includesPending) {
    return Math.max(0, stored - credit)
  }
  return stored
}

/**
 * Strip non-arrears amounts from student.OutstandingAmount fallback.
 * - Legacy rows that stored yearly fees in outstanding
 * - Monthly fee job billing that duplicated current-month dues on OutstandingAmount
 */
const sanitizeMonthlyFallback = (
  structure,
  fallback,
  { currentMonthDue = 0, payments = [], month = '' } = {}
) => {
  let fb = toAmount(fallback)
  if (!structure || fb <= 0) return 0
  const monthly = sumHeadsByFrequency(structure, 'monthly')
  const yearly = sumHeadsByFrequency(structure, 'yearly')
  const grand = monthly + yearly
  if (yearly > 0 && grand > 0 && fb >= grand - 1) {
    fb = Math.max(0, fb - yearly)
  }

  const due = toAmount(currentMonthDue)
  const monthKey = String(month || '').trim()
  const hasSystemMonthlyBill =
    monthKey &&
    (Array.isArray(payments) ? payments : []).some(
      (p) =>
        String(p.PaymentMode || '') === 'SYSTEM' &&
        String(p.Month || '') === monthKey &&
        String(p.FeeType || '') === 'Monthly'
    )

  // Outstanding on student record often equals current-month billing only (monthly job / legacy).
  // Do not treat that as arrears when it matches this month's monthly due.
  if (due > 0 && fb > 0 && Math.abs(fb - due) <= 1) {
    fb = 0
  } else if (due > 0 && fb > due + 1) {
    fb = Math.max(0, fb - due)
  } else if (hasSystemMonthlyBill && due > 0 && fb > 0) {
    fb = Math.max(0, fb - due)
  }

  return fb
}

/**
 * Monthly pending only — never includes optional yearly fees.
 * Unpaid previous months (after fee generation) become Pending Fee.
 * Yearly heads stay on the current-year due list and do not carry forward.
 */
const getPreviousMonthlyPending = (
  payments = [],
  {
    structure = null,
    excludePaymentId = null,
    fallback = 0,
    currentMonthDue = 0,
    month = '',
  } = {}
) => {
  if (structure) {
    const payable = computeStudentTotalPayable(structure, payments, {
      excludePaymentId,
      month: month || currentMonthKey(),
      storedOutstanding: fallback,
    })
    return Math.max(0, payable.outstanding - payable.currentMonthDue)
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
    const reg = String(student.Registration_Number || '').trim()
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

/** School/class total due: previous arrears + unpaid current-month monthly fee. */
const sumStudentsPayable = ({
  students = [],
  structures = [],
  paymentsByStudent = new Map(),
  month = '',
  academicYear = '',
}) => {
  let totalPayable = 0
  let studentsWithDue = 0
  students.forEach((student) => {
    const reg = String(student.Registration_Number || '').trim()
    if (!reg) return
    const structure = findFeeStructureFromList(structures, student.Class, student.Section || '')
    const payments = paymentsByStudent.get(reg) || []
    const { outstanding } = computeStudentTotalPayable(structure, payments, {
      month,
      academicYear,
      storedOutstanding: student.OutstandingAmount,
    })
    if (outstanding > 0) studentsWithDue += 1
    totalPayable += outstanding
  })
  return { totalPayable, studentsWithDue }
}

const currentMonthKey = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

const addMonthsToKey = (yyyyMm, delta = 1) => {
  const parts = String(yyyyMm || '').trim().split('-')
  if (parts.length < 2) return currentMonthKey()
  let y = Number(parts[0])
  let m = Number(parts[1])
  if (!Number.isFinite(y) || !Number.isFinite(m)) return currentMonthKey()
  m += delta
  while (m > 12) {
    m -= 12
    y += 1
  }
  while (m < 1) {
    m += 12
    y -= 1
  }
  return `${y}-${String(m).padStart(2, '0')}`
}

const formatMonthLabel = (yyyyMm) => {
  const parts = String(yyyyMm || '').split('-')
  if (parts.length < 2) return String(yyyyMm || '')
  const names = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ]
  const m = Number(parts[1])
  return `${names[m - 1] || parts[1]} ${parts[0]}`
}

/** All YYYY-MM months prepaid via successful advance fee payments. */
const getAdvanceCoveredMonths = (payments = []) => {
  const months = new Set()
  ;(Array.isArray(payments) ? payments : [])
    .filter(paymentCountsAsPaid)
    .forEach((p) => {
      if (!p?.IsAdvancePayment) return
      const list = Array.isArray(p.AdvanceMonthsCovered) ? p.AdvanceMonthsCovered : []
      list.forEach((raw) => {
        const key = String(raw || '').trim()
        if (key) months.add(key)
      })
    })
  return months
}

const isMonthAdvanceCovered = (payments = [], month = '') => {
  const key = String(month || '').trim()
  if (!key) return false
  return getAdvanceCoveredMonths(payments).has(key)
}

/** SYSTEM monthly fee generation row (Status is often Pending, not Success). */
const isSystemMonthlyGeneration = (payment, month = '') => {
  if (!payment) return false
  const monthKey = String(month || '').trim()
  const payMonth = String(payment.Month || '').trim()
  return (
    String(payment.PaymentMode || '') === 'SYSTEM' &&
    String(payment.FeeType || '') === 'Monthly' &&
    (!monthKey || payMonth === monthKey)
  )
}

const getMonthPrepayAmount = (structure, payments, month, academicYear) => {
  const ctx = computeDueContext({ structure, payments, month, academicYear })
  if (ctx.monthlyDue > 0) return ctx.monthlyDue
  if (ctx.monthlyTotal > 0 && !isMonthAdvanceCovered(payments, month)) {
    const anyMonthlyUnpaid = ctx.heads.some(
      (h) => h.frequency === 'monthly' && h.amount > 0 && !h.isPaidForPeriod
    )
    if (anyMonthlyUnpaid) return ctx.monthlyTotal
  }
  return 0
}

/** Next N months eligible for advance prepayment (skips paid / already prepaid). */
const listPrepayableMonths = ({
  structure,
  payments = [],
  startMonth = '',
  count = 1,
  academicYear = '',
  maxScan = 36,
}) => {
  const list = []
  let cursor = String(startMonth || currentMonthKey()).trim()
  let guard = 0
  while (list.length < count && guard < maxScan) {
    const amount = getMonthPrepayAmount(structure, payments, cursor, academicYear)
    if (amount > 0) {
      list.push({
        month: cursor,
        label: formatMonthLabel(cursor),
        amount,
        monthlyTotal: sumHeadsByFrequency(structure, 'monthly'),
      })
    }
    cursor = addMonthsToKey(cursor, 1)
    guard += 1
  }
  return list
}

const buildAdvanceQuote = ({
  structure,
  payments = [],
  academicYear = '',
  mode = 'months',
  monthsCount = 1,
  customAmount = 0,
  startMonth = '',
  creditBalance = 0,
}) => {
  const start = String(startMonth || currentMonthKey()).trim()
  const monthlyPerMonth = sumHeadsByFrequency(structure, 'monthly')
  const existingAdvanceMonths = [...getAdvanceCoveredMonths(payments)].sort()
  let months = []
  let addedCredit = 0

  if (mode === 'amount') {
    let remaining = toAmount(customAmount)
    let cursor = start
    let guard = 0
    while (remaining > 0.009 && guard < 36) {
      const monthAmount = getMonthPrepayAmount(structure, payments, cursor, academicYear)
      if (monthAmount > 0) {
        if (remaining + 0.009 >= monthAmount) {
          months.push({
            month: cursor,
            label: formatMonthLabel(cursor),
            amount: monthAmount,
            monthlyTotal: monthlyPerMonth,
          })
          remaining -= monthAmount
          cursor = addMonthsToKey(cursor, 1)
        } else {
          addedCredit = remaining
          remaining = 0
          break
        }
      } else {
        cursor = addMonthsToKey(cursor, 1)
      }
      guard += 1
    }
    if (remaining > 0.009 && months.length === 0) {
      addedCredit += remaining
    }
  } else {
    const n = Math.max(1, Math.min(24, Math.floor(toAmount(monthsCount))))
    months = listPrepayableMonths({
      structure,
      payments,
      startMonth: start,
      count: n,
      academicYear,
    })
  }

  const totalDue = months.reduce((sum, m) => sum + toAmount(m.amount), 0)
  const newCreditBalance = toAmount(creditBalance) + addedCredit

  return {
    startMonth: start,
    mode,
    months,
    monthsCount: months.length,
    monthlyPerMonth,
    totalDue,
    addedCredit,
    newCreditBalance,
    existingAdvanceMonths,
    existingCreditBalance: toAmount(creditBalance),
    coveredLabels: months.map((m) => m.label).join(', '),
    feeBreakdown: buildHeadsFromStructure(structure)
      .filter((h) => h.frequency === 'monthly' && h.amount > 0)
      .map((h) => ({ key: h.key, label: h.label, amount: h.amount })),
  }
}

const buildAdvanceFeeTypeLabel = (months = []) => {
  if (!months.length) return 'Advance Fee'
  if (months.length === 1) return `Advance Fee (${formatMonthLabel(months[0])})`
  return `Advance Fee (${formatMonthLabel(months[0])} – ${formatMonthLabel(months[months.length - 1])})`
}

module.exports = {
  PENDING_FEE_KEY,
  PENDING_FEE_LABEL,
  STANDARD_FEE_HEADS,
  FEE_HEADS,
  FREQUENCY_FIELDS,
  filterStructureHeadKeys,
  buildPendingFeeHead,
  toAmount,
  normalizeFrequency,
  getHeadFrequency,
  getHeadAmount,
  findFeeStructure,
  findFeeStructureFromList,
  buildHeadsFromStructure,
  getMarkedMonthlyHeads,
  sumHeadsByFrequency,
  sumHeadsByFrequencyOnPayment,
  computeInstitutionMonthlyPending,
  sumStudentsPayable,
  parseSelectedFeeHeads,
  legacyFeeTypeToHeads,
  resolveSelectedHeadKeys,
  amountsForSelectedHeads,
  sumSelectedHeadsFromHeads,
  feeTypeLabelFromHeads,
  computeDueContext,
  getAlreadyPaidSelectedHeads,
  alreadyPaidHeadLabels,
  paymentCountsAsPaid,
  getSelectedKeysFromPayment,
  recomputeMonthlyArrears,
  computeMonthlyArrears,
  computeTotalMonthlyOutstanding,
  computeStudentTotalPayable,
  applyPaymentToStudentOutstanding,
  sanitizeMonthlyFallback,
  getPreviousMonthlyPending,
  monthlyOutstandingAfterPayment,
  getPastBilledMonths,
  getPreviousBalanceCarriedForward,
  computePaymentSettlement,
  currentMonthKey,
  addMonthsToKey,
  formatMonthLabel,
  getAdvanceCoveredMonths,
  isMonthAdvanceCovered,
  isSystemMonthlyGeneration,
  listPrepayableMonths,
  buildAdvanceQuote,
  buildAdvanceFeeTypeLabel,
  parseOtherFeeSubtypes: require('./otherFeeSubtypes').parseOtherFeeSubtypes,
}
