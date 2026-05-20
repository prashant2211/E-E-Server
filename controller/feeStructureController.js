const { response } = require('express')
const feeStructureModel = require('../models/feeStructureModel')
const { FEE_HEADS, normalizeFrequency, sumHeadsByFrequency } = require('../utils/feeHeads')

const buildFrequencyPayload = (body, existing = {}) => {
  const payload = {}
  FEE_HEADS.forEach((head) => {
    const freqField = `${head.key}Frequency`
    const raw = body[freqField] !== undefined ? body[freqField] : existing[freqField]
    payload[freqField] = normalizeFrequency(raw, head.defaultFrequency)
  })
  return payload
}

const store = (req, res, next) => {
  const tution = Number(req.body.TutionFee || 0) || 0
  const library = Number(req.body.LibraryFee || 0) || 0
  const activity = Number(req.body.ActivityFee || 0) || 0
  const exam = Number(req.body.ExamFee || 0) || 0
  const uniform = Number(req.body.UniformFee || 0) || 0
  const prospectus = Number(req.body.ProspectusFee || 0) || 0
  const admission = Number(req.body.AdmissionFee || 0) || 0
  const transport = Number(req.body.TransportFee || 0) || 0
  const other = Number(req.body.OtherFee || 0) || 0

  const totalfee =
    tution + library + activity + exam + uniform + prospectus + admission + transport + other

  const frequencyPayload = buildFrequencyPayload(req.body)
  const structureForTotals = {
    TutionFee: tution.toString(),
    LibraryFee: library.toString(),
    ActivityFee: activity.toString(),
    ExamFee: exam.toString(),
    UniformFee: uniform.toString(),
    ProspectusFee: prospectus.toString(),
    AdmissionFee: admission.toString(),
    TransportFee: transport.toString(),
    OtherFee: other.toString(),
    ...frequencyPayload,
  }
  const monthlyTotal = sumHeadsByFrequency(structureForTotals, 'monthly')
  const yearlyTotal = sumHeadsByFrequency(structureForTotals, 'yearly')

  const feeStructure = new feeStructureModel({
    InstutionId: req.user.InstutionCode,
    Class: req.body.Class,
    Section: req.body.Section || '',
    TutionFee: tution.toString(),
    LibraryFee: library.toString(),
    ActivityFee: activity.toString(),
    ExamFee: exam.toString(),
    UniformFee: uniform.toString(),
    ProspectusFee: prospectus.toString(),
    AdmissionFee: admission.toString(),
    TransportFee: transport.toString(),
    OtherFee: other.toString(),
    Total: totalfee.toString(),
    MonthlyTotal: monthlyTotal.toString(),
    YearlyTotal: yearlyTotal.toString(),
    ...frequencyPayload,
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

    const tution = Number(req.body.TutionFee ?? existing.TutionFee ?? 0) || 0
    const library = Number(req.body.LibraryFee ?? existing.LibraryFee ?? 0) || 0
    const activity = Number(req.body.ActivityFee ?? existing.ActivityFee ?? 0) || 0
    const exam = Number(req.body.ExamFee ?? existing.ExamFee ?? 0) || 0
    const uniform = Number(req.body.UniformFee ?? existing.UniformFee ?? 0) || 0
    const prospectus = Number(req.body.ProspectusFee ?? existing.ProspectusFee ?? 0) || 0
    const admission = Number(req.body.AdmissionFee ?? existing.AdmissionFee ?? 0) || 0
    const transport = Number(req.body.TransportFee ?? existing.TransportFee ?? 0) || 0
    const other = Number(req.body.OtherFee ?? existing.OtherFee ?? 0) || 0

    const totalfee =
      tution + library + activity + exam + uniform + prospectus + admission + transport + other

    const frequencyPayload = buildFrequencyPayload(req.body, existing)
    const structureForTotals = {
      TutionFee: tution.toString(),
      LibraryFee: library.toString(),
      ActivityFee: activity.toString(),
      ExamFee: exam.toString(),
      UniformFee: uniform.toString(),
      ProspectusFee: prospectus.toString(),
      AdmissionFee: admission.toString(),
      TransportFee: transport.toString(),
      OtherFee: other.toString(),
      ...frequencyPayload,
    }
    const monthlyTotal = sumHeadsByFrequency(structureForTotals, 'monthly')
    const yearlyTotal = sumHeadsByFrequency(structureForTotals, 'yearly')

    const updated = await feeStructureModel.findByIdAndUpdate(
      id,
      {
        $set: {
          Class: req.body.Class ?? existing.Class,
          Section: req.body.Section !== undefined ? req.body.Section || '' : existing.Section,
          TutionFee: tution.toString(),
          LibraryFee: library.toString(),
          ActivityFee: activity.toString(),
          ExamFee: exam.toString(),
          UniformFee: uniform.toString(),
          ProspectusFee: prospectus.toString(),
          AdmissionFee: admission.toString(),
          TransportFee: transport.toString(),
          OtherFee: other.toString(),
          Total: totalfee.toString(),
          MonthlyTotal: monthlyTotal.toString(),
          YearlyTotal: yearlyTotal.toString(),
          ...frequencyPayload,
        },
      },
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
