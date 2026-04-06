const feeDetailsModel = require('../models/studentFeeDetailsModel')

const institutionFilter = (req) => {
  if (req.user.UserType === 'SuperAdmin' && req.query.InstutionCode) {
    return { InstutionCode: String(req.query.InstutionCode).trim() }
  }
  if (req.user.InstutionCode) {
    return { InstutionCode: req.user.InstutionCode }
  }
  return null
}

const assertTenantDoc = (doc, req) => {
  if (!doc) return false
  if (req.user.UserType === 'SuperAdmin') return true
  if (!doc.InstutionCode) return true
  return doc.InstutionCode === req.user.InstutionCode
}

const index = (req, res, next) => {
  const filter = institutionFilter(req)
  if (!filter) {
    return res.status(403).json({
      success: false,
      code: 403,
      message: 'Institution context required',
    })
  }
  feeDetailsModel
    .find(filter)
    .then((response) => {
      res.json({
        response,
      })
    })
    .catch(() => {
      res.status(500).json({
        message: 'An error occured!',
      })
    })
}

const show = (req, res, next) => {
  const feeDetailId = req.body.feeDetailId
  feeDetailsModel
    .findById(feeDetailId)
    .then((doc) => {
      if (!doc || !assertTenantDoc(doc, req)) {
        return res.status(404).json({ message: 'Record not found', success: false })
      }
      res.json({
        response: doc,
      })
    })
    .catch(() => {
      res.status(500).json({
        message: 'An error occured!',
      })
    })
}

const store = (req, res, next) => {
  if (!req.user.InstutionCode && req.user.UserType !== 'SuperAdmin') {
    return res.status(403).json({ success: false, message: 'Institution context required' })
  }
  const instutionCode =
    req.user.UserType === 'SuperAdmin' && req.body.InstutionCode
      ? req.body.InstutionCode
      : req.user.InstutionCode

  const feeDetails = new feeDetailsModel({
    InstutionCode: instutionCode || undefined,
    Student_Name: req.body.Student_Name,
    Class: req.body.Class,
    Student_RollNumber: req.body.Student_RollNumber,
    Month: req.body.Month,
    Total_Pending_Fee: req.body.Total_Pending_Fee,
    Tution_fee: req.body.Tution_fee,
    Payment_status: req.body.Payment_status,
    Lumsum_Amount: req.body.Lumsum_Amount,
    Payment_Date: req.body.Payment_Date,
    Payment_Mode: req.body.Payment_Mode,
  })
  feeDetails
    .save()
    .then(() => {
      res.json({
        message: 'fee Payment sucessfully!',
      })
    })
    .catch(() => {
      res.status(500).json({
        message: 'An error occured!',
      })
    })
}

const update = async (req, res, next) => {
  try {
    const feeDetailId = req.body.feeDetailId
    const updateData = {
      Student_Name: req.body.Student_Name,
      Class: req.body.Class,
      Student_RollNumber: req.body.Student_RollNumber,
      Month: req.body.Month,
      Total_Pending_Fee: req.body.Total_Pending_Fee,
      Tution_fee: req.body.Tution_fee,
      Payment_status: req.body.Payment_status,
      Lumsum_Amount: req.body.Lumsum_Amount,
      Payment_Date: req.body.Payment_Date,
      Payment_Mode: req.body.Payment_Mode,
    }
    const doc = await feeDetailsModel.findById(feeDetailId)
    if (!doc || !assertTenantDoc(doc, req)) {
      return res.status(404).json({ message: 'Record not found', success: false })
    }
    await feeDetailsModel.findByIdAndUpdate(feeDetailId, { $set: updateData })
    res.json({
      message: 'fee payment details updated sucessfully',
    })
  } catch (e) {
    res.status(500).json({
      message: ' An error occured',
    })
  }
}

const destroy = async (req, res, next) => {
  try {
    const feeDetailId = req.body.feeDetailId
    const doc = await feeDetailsModel.findById(feeDetailId)
    if (!doc || !assertTenantDoc(doc, req)) {
      return res.status(404).json({ message: 'Record not found', success: false })
    }
    await feeDetailsModel.findByIdAndDelete(feeDetailId)
    res.json({
      message: 'fee payment Deleted sucessfully',
    })
  } catch (e) {
    res.status(500).json({
      message: 'An error occured!',
    })
  }
}

module.exports = {
  index,
  show,
  store,
  update,
  destroy,
}
