const { response } = require('express')
const feeStructureModel = require('../models/feeStructureModel')
const {
  STANDARD_FEE_HEADS,
  normalizeFrequency,
  sumHeadsByFrequency,
  buildHeadsFromStructure,
} = require('../utils/feeHeads')
const { serializeOtherFeeSubtypes } = require('../utils/otherFeeSubtypes')

const buildFrequencyPayload = (body, existing = {}) => {
  const payload = {}
  STANDARD_FEE_HEADS.forEach((head) => {
    const freqField = `${head.key}Frequency`
    const raw = body[freqField] !== undefined ? body[freqField] : existing[freqField]
    payload[freqField] = normalizeFrequency(raw, head.defaultFrequency)
  })
  return payload
}

const readStandardAmount = (body, key, fallback = 0) =>
  Number(body[key] !== undefined ? body[key] : fallback) || 0

const resolveOtherFeeJson = (body, existing = null) => {
  if (Array.isArray(body.OtherFeeSubtypes)) {
    return serializeOtherFeeSubtypes(body.OtherFeeSubtypes)
  }
  if (body.OtherFee !== undefined && body.OtherFee !== null && body.OtherFee !== '') {
    const raw = String(body.OtherFee).trim()
    if (raw.startsWith('[') || raw.startsWith('{')) return raw
    return serializeOtherFeeSubtypes([
      {
        name: 'Other Fee',
        amount: Number(body.OtherFee) || 0,
        frequency: body.OtherFeeFrequency || existing?.OtherFeeFrequency || 'monthly',
        key: 'OtherFee',
      },
    ])
  }
  return existing?.OtherFee || '[]'
}

const buildStructurePayload = (body, existing = null) => {
  const tution = readStandardAmount(body, 'TutionFee', existing?.TutionFee ?? 0)
  const library = readStandardAmount(body, 'LibraryFee', existing?.LibraryFee ?? 0)
  const activity = readStandardAmount(body, 'ActivityFee', existing?.ActivityFee ?? 0)
  const exam = readStandardAmount(body, 'ExamFee', existing?.ExamFee ?? 0)
  const uniform = readStandardAmount(body, 'UniformFee', existing?.UniformFee ?? 0)
  const prospectus = readStandardAmount(body, 'ProspectusFee', existing?.ProspectusFee ?? 0)
  const admission = readStandardAmount(body, 'AdmissionFee', existing?.AdmissionFee ?? 0)
  const transport = readStandardAmount(body, 'TransportFee', existing?.TransportFee ?? 0)
  const otherFeeJson = resolveOtherFeeJson(body, existing)
  const frequencyPayload = buildFrequencyPayload(body, existing || {})

  const structureForTotals = {
    TutionFee: tution.toString(),
    LibraryFee: library.toString(),
    ActivityFee: activity.toString(),
    ExamFee: exam.toString(),
    UniformFee: uniform.toString(),
    ProspectusFee: prospectus.toString(),
    AdmissionFee: admission.toString(),
    TransportFee: transport.toString(),
    OtherFee: otherFeeJson,
    ...frequencyPayload,
  }

  const monthlyTotal = sumHeadsByFrequency(structureForTotals, 'monthly')
  const yearlyTotal = sumHeadsByFrequency(structureForTotals, 'yearly')
  const totalfee = buildHeadsFromStructure(structureForTotals).reduce((sum, head) => sum + head.amount, 0)

  return {
    Class: body.Class ?? existing?.Class,
    Section: body.Section !== undefined ? body.Section || '' : existing?.Section || '',
    TutionFee: tution.toString(),
    LibraryFee: library.toString(),
    ActivityFee: activity.toString(),
    ExamFee: exam.toString(),
    UniformFee: uniform.toString(),
    ProspectusFee: prospectus.toString(),
    AdmissionFee: admission.toString(),
    TransportFee: transport.toString(),
    OtherFee: otherFeeJson,
    Total: totalfee.toString(),
    MonthlyTotal: monthlyTotal.toString(),
    YearlyTotal: yearlyTotal.toString(),
    ...frequencyPayload,
  }
}

const store = (req, res, next) => {
  const payload = buildStructurePayload(req.body)

  const feeStructure = new feeStructureModel({
    InstutionId: req.user.InstutionCode,
    ...payload,
  })
  feeStructure
    .save()
    .then((response) => {
      res.status(201).json({
        success: true,
        message: 'Fee structure saved successfully!',
        code: 201,
        data: response,
      })
    })
    .catch((error) => {
      res.status(500).json({
        success: false,
        message: error.message,
        code: 500,
      })
    })
}

const show = async (req, res, next) => {
  try {
    const filter = {
      InstutionId: req.user.InstutionCode,
    }
    if (req.query.Class) {
      filter.Class = req.query.Class
    }
    if (req.query.Section) {
      filter.Section = req.query.Section
    }

    const feeStructureRecord = await feeStructureModel.find(filter)

    res.status(200).json({
      success: true,
      message: 'Fee structure fetched successfully!',
      code: 200,
      data: feeStructureRecord,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
      code: 500,
    })
  }
}

const update = async (req, res) => {
  try {
    const id = req.body._id || req.body.feeStructureId
    if (!id) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Fee structure id (_id) is required',
      })
    }

    const existing = await feeStructureModel.findById(id)
    if (!existing || existing.InstutionId !== req.user.InstutionCode) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'Fee structure not found',
      })
    }

    const payload = buildStructurePayload(req.body, existing)

    const updated = await feeStructureModel.findByIdAndUpdate(
      id,
      { $set: payload },
      { new: true }
    )

    res.status(200).json({
      success: true,
      message: 'Fee structure updated successfully!',
      code: 200,
      data: updated,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
      code: 500,
    })
  }
}

module.exports = {
  store,
  show,
  update,
}
