const toAmt = (val) => {
  if (val === null || val === undefined) return 0
  const n = parseFloat(String(val).replace(/,/g, '').trim())
  return Number.isNaN(n) ? 0 : n
}

const normFreq = (value, fallback = 'monthly') => {
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

const OTHER_FEE_PREFIX = 'OtherFee__'

const slugifyOtherFeeName = (name) =>
  String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '') || 'fee'

const otherFeeSubtypeKey = (name, index = 0) => {
  const slug = slugifyOtherFeeName(name)
  return slug ? `${OTHER_FEE_PREFIX}${slug}` : `${OTHER_FEE_PREFIX}fee_${index + 1}`
}

const isOtherFeeSubtypeKey = (key) => {
  const k = String(key || '')
  return k.startsWith(OTHER_FEE_PREFIX) || k === 'OtherFee'
}

const normalizeSubtypeRow = (item, index = 0) => {
  const name = String(item?.name || item?.label || '').trim()
  const amount = toAmt(item?.amount)
  if (!name || amount <= 0) return null
  const frequency = normFreq(item?.frequency, 'monthly')
  const key = String(item?.key || '').trim() || otherFeeSubtypeKey(name, index)
  return { name, amount, frequency, key }
}

/** Parse OtherFee JSON (or legacy numeric string) from fee structure. */
const parseOtherFeeSubtypes = (structure) => {
  const raw = structure?.OtherFee
  if (raw === null || raw === undefined || raw === '') return []

  const rawStr = String(raw).trim()
  if (rawStr.startsWith('[') || rawStr.startsWith('{')) {
    try {
      const parsed = JSON.parse(rawStr)
      const list = Array.isArray(parsed) ? parsed : parsed?.items || []
      return list
        .map((item, idx) => normalizeSubtypeRow(item, idx))
        .filter(Boolean)
    } catch {
      return []
    }
  }

  const legacyAmount = toAmt(rawStr)
  if (legacyAmount <= 0) return []

  return [
    {
      name: 'Other Fee',
      amount: legacyAmount,
      frequency: normFreq(structure?.OtherFeeFrequency, 'monthly'),
      key: 'OtherFee',
    },
  ]
}

const serializeOtherFeeSubtypes = (subtypes) => {
  const list = (Array.isArray(subtypes) ? subtypes : [])
    .map((item, idx) => normalizeSubtypeRow(item, idx))
    .filter(Boolean)
  return list.length ? JSON.stringify(list) : '[]'
}

const sumOtherFeeSubtypesByFrequency = (structure, frequency) =>
  parseOtherFeeSubtypes(structure)
    .filter((item) => item.frequency === frequency)
    .reduce((sum, item) => sum + item.amount, 0)

const parseOtherFeeBreakdown = (payment) => {
  const raw = payment?.OtherFeeBreakdown
  if (!raw) return []
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item, idx) => normalizeSubtypeRow(item, idx))
      .filter(Boolean)
  } catch {
    return []
  }
}

const serializeOtherFeeBreakdown = (items) => {
  const list = (Array.isArray(items) ? items : [])
    .map((item, idx) => normalizeSubtypeRow(item, idx))
    .filter(Boolean)
  return list.length ? JSON.stringify(list) : ''
}

const getOtherSubtypeAmountOnPayment = (payment, headKey) => {
  const breakdown = parseOtherFeeBreakdown(payment)
  const match = breakdown.find((b) => b.key === headKey)
  if (match) return match.amount
  if (headKey === 'OtherFee') return toAmt(payment?.OtherFee)
  return 0
}

module.exports = {
  OTHER_FEE_PREFIX,
  otherFeeSubtypeKey,
  isOtherFeeSubtypeKey,
  parseOtherFeeSubtypes,
  serializeOtherFeeSubtypes,
  sumOtherFeeSubtypesByFrequency,
  parseOtherFeeBreakdown,
  serializeOtherFeeBreakdown,
  getOtherSubtypeAmountOnPayment,
}
