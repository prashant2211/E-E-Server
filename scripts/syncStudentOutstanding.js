/**
 * Recalculate OutstandingAmount for one school from its own monthly ledger only.
 * Does not include other schools, yearly heads, or stale stored lumps.
 *
 * Usage: node scripts/syncStudentOutstanding.js PAL-005
 */
require('dotenv').config()
const mongoose = require('mongoose')
const studentModel = require('../models/studentModel')
const feeStructureModel = require('../models/feeStructureModel')
const feePaymentModel = require('../models/feePaymentModel')
const {
  findFeeStructureFromList,
  computeStudentTotalPayable,
  currentMonthKey,
  toAmount,
} = require('../utils/feeHeads')

const instCode = String(process.argv[2] || 'PAL-005').trim()
const write = process.argv.includes('--write')

const main = async () => {
  await mongoose.connect(process.env.DBCONNECTIONURL)
  const month = currentMonthKey()

  const students = await studentModel
    .find({ InstutionCode: instCode, Status: true })
    .select('First_Name Last_Name Class Section Registration_Number OutstandingAmount InstutionCode Status')
    .lean()
  const structures = await feeStructureModel.find({ InstutionId: instCode }).lean()
  const schoolRegs = students.map((s) => String(s.Registration_Number || '').trim()).filter(Boolean)
  const payments = schoolRegs.length
    ? await feePaymentModel
        .find({
          InstutionId: instCode,
          StudentId: { $in: schoolRegs },
        })
        .lean()
    : []

  const byReg = new Map()
  payments.forEach((p) => {
    if (String(p.InstutionId || '').trim() !== instCode) return
    const id = String(p.StudentId || '').trim()
    if (!id) return
    if (!byReg.has(id)) byReg.set(id, [])
    byReg.get(id).push(p)
  })

  let sumStored = 0
  let sumLedger = 0
  let sumArrears = 0
  let sumCurrent = 0
  let updated = 0
  const samples = []

  for (const s of students) {
    const reg = String(s.Registration_Number || '').trim()
    const structure = findFeeStructureFromList(structures, s.Class, s.Section || '')
    const payable = computeStudentTotalPayable(structure, byReg.get(reg) || [], { month })
    const stored = toAmount(s.OutstandingAmount)
    sumStored += stored
    sumLedger += payable.outstanding
    sumArrears += payable.arrears
    sumCurrent += payable.currentMonthDue
    if (samples.length < 5) {
      samples.push({
        name: `${s.First_Name || ''} ${s.Last_Name || ''}`.trim(),
        class: s.Class,
        stored,
        ledger: payable.outstanding,
        arrears: payable.arrears,
        current: payable.currentMonthDue,
      })
    }
    if (write && String(s.OutstandingAmount) !== String(payable.outstanding)) {
      await studentModel.updateOne(
        { _id: s._id, InstutionCode: instCode },
        { OutstandingAmount: String(payable.outstanding) }
      )
      updated += 1
    }
  }

  console.log(
    JSON.stringify(
      {
        instCode,
        month,
        write,
        activeStudents: students.length,
        paymentRows: payments.length,
        sumStored,
        sumLedger,
        sumArrears,
        sumCurrentMonth: sumCurrent,
        updated,
        samples,
      },
      null,
      2
    )
  )

  await mongoose.connection.close()
}

main().catch(async (err) => {
  console.error(err)
  try {
    await mongoose.connection.close()
  } catch (_) {
    /* ignore */
  }
  process.exit(1)
})
