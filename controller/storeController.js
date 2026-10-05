const mongoose = require('mongoose');
const Student = require('../models/studentModel');
const {
  StoreItem,
  StoreSale,
  StoreStockLedger,
  STORE_CATEGORIES,
  STORE_UNITS,
  STORE_GENDERS,
  PAYMENT_MODES,
  BUYER_TYPES,
} = require('../models/storeModel');
const { computeStoreBill, roundMoney, clampNonNegative, normalizeQty } = require('../utils/storeBilling');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/response');
const { logger } = require('../utils/logger');

const normalizeUserType = (userType) =>
  String(userType || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');

const canSellStore = (user) => {
  const userType = normalizeUserType(user?.UserType);
  return (
    userType === 'admin' ||
    userType === 'superadmin' ||
    userType === 'accountant' ||
    userType === 'accountscoordinator' ||
    userType === 'accountcoordinator'
  );
};

const requireSeller = (req, res) => {
  if (!canSellStore(req.user)) {
    errorResponse(res, 'Only Admin or Accountant can sell store items or manage stock.', 403);
    return false;
  }
  return true;
};

const institutionCodeOf = (req) => String(req.user?.InstutionCode || '').trim();

const actorNameOf = (req) =>
  String(req.user?.Name || req.user?.UserName || req.user?.MemberId || req.user?.UserType || '').trim();

const nextSequence = async (Model, instutionCode, field, prefix) => {
  const year = new Date().getFullYear();
  const yearPrefix = `${prefix}${instutionCode}-${year}-`;
  const latest = await Model.findOne({
    InstutionCode: instutionCode,
    [field]: { $regex: `^${yearPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}` },
  })
    .sort({ [field]: -1 })
    .select(field)
    .lean();

  let seq = 1;
  if (latest?.[field]) {
    const raw = String(latest[field]).split('-').pop();
    const parsed = parseInt(raw, 10);
    if (Number.isFinite(parsed)) seq = parsed + 1;
  }
  return `${yearPrefix}${String(seq).padStart(6, '0')}`;
};

const publicItem = (item) => ({
  _id: item._id,
  ItemCode: item.ItemCode,
  Name: item.Name,
  Category: item.Category,
  Description: item.Description,
  Variant: item.Variant,
  Size: item.Size,
  Color: item.Color,
  Gender: item.Gender,
  Unit: item.Unit,
  SellingPrice: item.SellingPrice,
  GstPercent: item.GstPercent,
  StockQty: item.StockQty,
  MinStock: item.MinStock,
  Status: item.Status,
  AcademicYear: item.AcademicYear,
  InStock: Number(item.StockQty) > 0,
  LowStock: Number(item.StockQty) > 0 && Number(item.StockQty) <= Number(item.MinStock || 0),
});

const staffItem = (item) => ({
  ...publicItem(item),
  CostPrice: item.CostPrice,
  HsnCode: item.HsnCode,
  Barcode: item.Barcode,
  CreatedBy: item.CreatedBy,
  UpdatedBy: item.UpdatedBy,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
});

const mapSale = (sale) => sale;

const restoreStockForSale = async (sale, actor, reason) => {
  for (const line of sale.Items || []) {
    if (!line.ItemId || !line.Qty) continue;
    const updated = await StoreItem.findOneAndUpdate(
      { _id: line.ItemId, InstutionCode: sale.InstutionCode },
      { $inc: { StockQty: line.Qty } },
      { new: true }
    );
    await StoreStockLedger.create({
      InstutionCode: sale.InstutionCode,
      ItemId: line.ItemId,
      ItemCode: line.ItemCode,
      Type: 'Return',
      Qty: line.Qty,
      BalanceAfter: updated?.StockQty || 0,
      Reference: sale.BillNo,
      Notes: reason || 'Sale cancelled',
      CreatedBy: actor,
    });
  }
};

const decrementStockForLines = async (instutionCode, lines, billNo, actor) => {
  const decremented = [];
  try {
    for (const line of lines) {
      const updated = await StoreItem.findOneAndUpdate(
        {
          _id: line.ItemId,
          InstutionCode: instutionCode,
          Status: 'Active',
          StockQty: { $gte: line.qty },
        },
        { $inc: { StockQty: -line.qty } },
        { new: true }
      );

      if (!updated) {
        throw new Error(`Insufficient stock for ${line.Name || 'item'}.`);
      }

      await StoreStockLedger.create({
        InstutionCode: instutionCode,
        ItemId: line.ItemId,
        ItemCode: updated.ItemCode,
        Type: 'Out',
        Qty: line.qty,
        BalanceAfter: updated.StockQty,
        Reference: billNo,
        Notes: 'Store sale',
        CreatedBy: actor,
      });

      decremented.push({ itemId: line.ItemId, qty: line.qty, name: updated.Name });
    }
    return decremented;
  } catch (error) {
    for (const done of decremented.reverse()) {
      await StoreItem.findOneAndUpdate(
        { _id: done.itemId, InstutionCode: instutionCode },
        { $inc: { StockQty: done.qty } }
      );
    }
    throw error;
  }
};

const getMeta = async (req, res) => {
  return successResponse(
    res,
    {
      categories: STORE_CATEGORIES,
      units: STORE_UNITS,
      genders: STORE_GENDERS,
      paymentModes: PAYMENT_MODES,
      buyerTypes: BUYER_TYPES,
      canSell: canSellStore(req.user),
    },
    'Store metadata retrieved'
  );
};

const getItems = async (req, res) => {
  try {
    const instutionCode = institutionCodeOf(req);
    if (!instutionCode) return errorResponse(res, 'Institution context is required.', 400);

    const seller = canSellStore(req.user);
    const page = Math.max(1, parseInt(req.query.PageNumber, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.PageSize, 10) || 50));
    const skip = (page - 1) * limit;
    const searchText = String(req.query.SearchText || '').trim();
    const category = String(req.query.category || '').trim();
    const status = String(req.query.status || '').trim();
    const lowStock = String(req.query.lowStock || '') === 'true';

    const filter = { InstutionCode: instutionCode };
    if (!seller) filter.Status = 'Active';
    else if (status) filter.Status = status;
    if (category) filter.Category = category;
    if (searchText) {
      filter.$or = [
        { Name: { $regex: searchText, $options: 'i' } },
        { ItemCode: { $regex: searchText, $options: 'i' } },
        { Variant: { $regex: searchText, $options: 'i' } },
        { Size: { $regex: searchText, $options: 'i' } },
        { Barcode: { $regex: searchText, $options: 'i' } },
      ];
    }
    if (lowStock) {
      filter.$expr = { $lte: ['$StockQty', '$MinStock'] };
    }

    const [items, total] = await Promise.all([
      StoreItem.find(filter).sort({ Category: 1, Name: 1, Size: 1 }).skip(skip).limit(limit).lean(),
      StoreItem.countDocuments(filter),
    ]);

    const mapped = items.map((item) => (seller ? staffItem(item) : publicItem(item)));
    return paginatedResponse(res, mapped, { page, pageSize: limit, total }, 'Store items retrieved');
  } catch (error) {
    logger.error('getStoreItems failed', { error: error.message });
    return errorResponse(res, 'Failed to load store items.', 500);
  }
};

const createItem = async (req, res) => {
  try {
    if (!requireSeller(req, res)) return;
    const instutionCode = institutionCodeOf(req);
    if (!instutionCode) return errorResponse(res, 'Institution context is required.', 400);

    const name = String(req.body.Name || '').trim();
    const category = String(req.body.Category || '').trim();
    const sellingPrice = clampNonNegative(req.body.SellingPrice);
    if (!name) return errorResponse(res, 'Item name is required.');
    if (!STORE_CATEGORIES.includes(category)) return errorResponse(res, 'Please choose a valid category.');
    if (sellingPrice <= 0) return errorResponse(res, 'Selling price must be greater than 0.');

    const itemCode = String(req.body.ItemCode || '').trim() || (await nextSequence(StoreItem, instutionCode, 'ItemCode', 'ITM-'));
    const openingStock = Math.max(0, normalizeQty(req.body.StockQty));

    const item = await StoreItem.create({
      InstutionCode: instutionCode,
      ItemCode: itemCode,
      Name: name,
      Category: category,
      Description: String(req.body.Description || '').trim(),
      Variant: String(req.body.Variant || '').trim(),
      Size: String(req.body.Size || '').trim(),
      Color: String(req.body.Color || '').trim(),
      Gender: STORE_GENDERS.includes(req.body.Gender) ? req.body.Gender : 'NA',
      Unit: STORE_UNITS.includes(req.body.Unit) ? req.body.Unit : 'Piece',
      HsnCode: String(req.body.HsnCode || '').trim(),
      Barcode: String(req.body.Barcode || '').trim(),
      AcademicYear: String(req.body.AcademicYear || '').trim(),
      CostPrice: clampNonNegative(req.body.CostPrice),
      SellingPrice: sellingPrice,
      GstPercent: Math.min(28, clampNonNegative(req.body.GstPercent)),
      StockQty: openingStock,
      MinStock: Math.max(0, normalizeQty(req.body.MinStock ?? 2)),
      Status: req.body.Status === 'Inactive' ? 'Inactive' : 'Active',
      CreatedBy: actorNameOf(req),
      UpdatedBy: actorNameOf(req),
    });

    if (openingStock > 0) {
      await StoreStockLedger.create({
        InstutionCode: instutionCode,
        ItemId: item._id,
        ItemCode: item.ItemCode,
        Type: 'In',
        Qty: openingStock,
        BalanceAfter: openingStock,
        UnitCost: item.CostPrice,
        Reference: item.ItemCode,
        Notes: 'Opening stock',
        CreatedBy: actorNameOf(req),
      });
    }

    return successResponse(res, staffItem(item.toObject()), 'Store item added', 201);
  } catch (error) {
    if (error?.code === 11000) {
      return errorResponse(res, 'Item code already exists for this school.');
    }
    logger.error('createStoreItem failed', { error: error.message });
    return errorResponse(res, 'Failed to add store item.', 500);
  }
};

const updateItem = async (req, res) => {
  try {
    if (!requireSeller(req, res)) return;
    const instutionCode = institutionCodeOf(req);
    const itemId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(itemId)) return errorResponse(res, 'Invalid item id.');

    const item = await StoreItem.findOne({ _id: itemId, InstutionCode: instutionCode });
    if (!item) return errorResponse(res, 'Store item not found.', 404);

    const next = { ...req.body };
    if (next.Name !== undefined) {
      next.Name = String(next.Name).trim();
      if (!next.Name) return errorResponse(res, 'Item name is required.');
    }
    if (next.Category !== undefined && !STORE_CATEGORIES.includes(next.Category)) {
      return errorResponse(res, 'Please choose a valid category.');
    }
    if (next.SellingPrice !== undefined) {
      next.SellingPrice = clampNonNegative(next.SellingPrice);
      if (next.SellingPrice <= 0) return errorResponse(res, 'Selling price must be greater than 0.');
    }
    if (next.CostPrice !== undefined) next.CostPrice = clampNonNegative(next.CostPrice);
    if (next.GstPercent !== undefined) next.GstPercent = Math.min(28, clampNonNegative(next.GstPercent));
    if (next.MinStock !== undefined) next.MinStock = Math.max(0, normalizeQty(next.MinStock));
    if (next.StockQty !== undefined) delete next.StockQty;
    if (next.ItemCode !== undefined) delete next.ItemCode;

    Object.assign(item, next, { UpdatedBy: actorNameOf(req) });
    await item.save();
    return successResponse(res, staffItem(item.toObject()), 'Store item updated');
  } catch (error) {
    logger.error('updateStoreItem failed', { error: error.message });
    return errorResponse(res, 'Failed to update store item.', 500);
  }
};

const addStock = async (req, res) => {
  try {
    if (!requireSeller(req, res)) return;
    const instutionCode = institutionCodeOf(req);
    const itemId = req.params.id;
    const qty = normalizeQty(req.body.Qty);
    if (!qty) return errorResponse(res, 'Stock quantity must be at least 1.');

    const item = await StoreItem.findOne({ _id: itemId, InstutionCode: instutionCode });
    if (!item) return errorResponse(res, 'Store item not found.', 404);

    const unitCost = req.body.UnitCost !== undefined ? clampNonNegative(req.body.UnitCost) : item.CostPrice;
    const previousQty = Number(item.StockQty) || 0;
    const previousCost = Number(item.CostPrice) || 0;
    item.StockQty = previousQty + qty;
    if (unitCost > 0 && qty > 0) {
      const totalCost = previousQty * previousCost + qty * unitCost;
      item.CostPrice = previousQty + qty > 0 ? roundMoney(totalCost / (previousQty + qty)) : unitCost;
    }
    item.UpdatedBy = actorNameOf(req);
    await item.save();

    await StoreStockLedger.create({
      InstutionCode: instutionCode,
      ItemId: item._id,
      ItemCode: item.ItemCode,
      Type: 'In',
      Qty: qty,
      BalanceAfter: item.StockQty,
      UnitCost: unitCost,
      Reference: String(req.body.Reference || item.ItemCode).trim(),
      Notes: String(req.body.Notes || 'Stock received').trim(),
      CreatedBy: actorNameOf(req),
    });

    return successResponse(res, staffItem(item.toObject()), 'Stock added');
  } catch (error) {
    logger.error('addStoreStock failed', { error: error.message });
    return errorResponse(res, 'Failed to add stock.', 500);
  }
};

const adjustStock = async (req, res) => {
  try {
    if (!requireSeller(req, res)) return;
    const instutionCode = institutionCodeOf(req);
    const itemId = req.params.id;
    const qty = Number(req.body.Qty);
    const reason = String(req.body.Reason || '').trim();
    if (!Number.isFinite(qty) || qty === 0) return errorResponse(res, 'Adjustment quantity cannot be 0.');
    if (!reason) return errorResponse(res, 'Please enter a reason for stock adjustment.');

    const item = await StoreItem.findOne({ _id: itemId, InstutionCode: instutionCode });
    if (!item) return errorResponse(res, 'Store item not found.', 404);

    const nextQty = (Number(item.StockQty) || 0) + qty;
    if (nextQty < 0) return errorResponse(res, 'Adjustment would make stock negative.');

    item.StockQty = nextQty;
    item.UpdatedBy = actorNameOf(req);
    await item.save();

    await StoreStockLedger.create({
      InstutionCode: instutionCode,
      ItemId: item._id,
      ItemCode: item.ItemCode,
      Type: 'Adjustment',
      Qty: qty,
      BalanceAfter: item.StockQty,
      Reference: item.ItemCode,
      Notes: reason,
      CreatedBy: actorNameOf(req),
    });

    return successResponse(res, staffItem(item.toObject()), 'Stock adjusted');
  } catch (error) {
    logger.error('adjustStoreStock failed', { error: error.message });
    return errorResponse(res, 'Failed to adjust stock.', 500);
  }
};

const resolveBuyer = async (req, instutionCode) => {
  const buyerType = BUYER_TYPES.includes(req.body.BuyerType) ? req.body.BuyerType : 'Student';
  const registrationNumber = String(req.body.RegistrationNumber || '').trim();
  let student = null;

  if (buyerType === 'Student' && registrationNumber) {
    student = await Student.findOne({
      InstutionCode: instutionCode,
      Registration_Number: registrationNumber,
    }).lean();
    if (!student) {
      return { error: 'Student not found for this registration number.' };
    }
  }

  const studentName = student
    ? `${student.First_Name || ''} ${student.Last_Name || ''}`.trim()
    : String(req.body.StudentName || req.body.BuyerName || '').trim();

  if (buyerType === 'Student' && !student && !studentName) {
    return { error: 'Select a student or enter the buyer name.' };
  }
  if (buyerType !== 'Student' && !String(req.body.BuyerName || studentName).trim()) {
    return { error: 'Buyer name is required for walk-in / parent sales.' };
  }

  return {
    buyerType,
    student,
    RegistrationNumber: student?.Registration_Number || registrationNumber,
    StudentName: studentName,
    ClassName: student?.Class || String(req.body.ClassName || '').trim(),
    Section: student?.Section || String(req.body.Section || '').trim(),
    BuyerName: String(req.body.BuyerName || studentName).trim(),
    ContactNumber: String(req.body.ContactNumber || student?.Contact_Number || '').trim(),
    StudentId: student?._id || null,
  };
};

const createSale = async (req, res) => {
  try {
    if (!requireSeller(req, res)) return;
    const instutionCode = institutionCodeOf(req);
    if (!instutionCode) return errorResponse(res, 'Institution context is required.', 400);

    const rawLines = Array.isArray(req.body.Items) ? req.body.Items : [];
    if (!rawLines.length) return errorResponse(res, 'Add at least one item to the bill.');

    const paymentMode = PAYMENT_MODES.includes(req.body.PaymentMode) ? req.body.PaymentMode : 'Cash';
    const buyer = await resolveBuyer(req, instutionCode);
    if (buyer.error) return errorResponse(res, buyer.error);

    const itemIds = rawLines
      .map((line) => line.ItemId)
      .filter((id) => mongoose.Types.ObjectId.isValid(id));
    const dbItems = await StoreItem.find({
      _id: { $in: itemIds },
      InstutionCode: instutionCode,
    }).lean();
    const itemMap = new Map(dbItems.map((item) => [String(item._id), item]));

    const prepared = [];
    for (const line of rawLines) {
      const dbItem = itemMap.get(String(line.ItemId));
      if (!dbItem) return errorResponse(res, 'One or more items were not found.');
      if (dbItem.Status !== 'Active') return errorResponse(res, `${dbItem.Name} is inactive and cannot be sold.`);

      const qty = normalizeQty(line.Qty);
      if (!qty) return errorResponse(res, `Invalid quantity for ${dbItem.Name}.`);
      if (qty > Number(dbItem.StockQty || 0)) {
        return errorResponse(res, `${dbItem.Name} has only ${dbItem.StockQty} ${dbItem.Unit || 'in stock'}.`);
      }

      const overridePrice = line.UnitPrice !== undefined && line.UnitPrice !== null && line.UnitPrice !== '';
      const unitPrice = overridePrice ? clampNonNegative(line.UnitPrice) : clampNonNegative(dbItem.SellingPrice);
      if (unitPrice <= 0) return errorResponse(res, `Selling price missing for ${dbItem.Name}.`);

      prepared.push({
        ItemId: dbItem._id,
        ItemCode: dbItem.ItemCode,
        Name: dbItem.Name,
        Category: dbItem.Category,
        Variant: dbItem.Variant,
        Size: dbItem.Size,
        Unit: dbItem.Unit,
        qty,
        unitPrice,
        gstPercent: dbItem.GstPercent,
        lineDiscount: clampNonNegative(line.LineDiscount),
      });
    }

    const bill = computeStoreBill({
      lines: prepared,
      billDiscount: req.body.BillDiscount,
      amountReceived: req.body.AmountReceived ?? req.body.PaidAmount,
    });
    if (!bill.lines.length || bill.grandTotal < 0) {
      return errorResponse(res, 'Bill calculation failed. Please review quantities and prices.');
    }

    const saleItems = bill.lines.map((line, index) => ({
      ItemId: prepared[index].ItemId,
      ItemCode: prepared[index].ItemCode,
      Name: prepared[index].Name,
      Category: prepared[index].Category,
      Variant: prepared[index].Variant,
      Size: prepared[index].Size,
      Unit: prepared[index].Unit,
      Qty: line.qty,
      UnitPrice: line.unitPrice,
      GstPercent: line.gstPercent,
      LineDiscount: line.lineDiscount,
      LineGross: line.lineGross,
      AllocatedBillDiscount: line.allocatedBillDiscount,
      Taxable: line.taxable,
      LineGst: line.lineGst,
      LineTotal: line.lineTotal,
    }));

    const firstPaymentAmount = bill.paidAmount;
    let sale = null;
    let lastError = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const billNo = await nextSequence(StoreSale, instutionCode, 'BillNo', 'ST-');
      let stockTaken = false;
      try {
        await decrementStockForLines(instutionCode, prepared, billNo, actorNameOf(req));
        stockTaken = true;
        sale = await StoreSale.create({
      InstutionCode: instutionCode,
      BillNo: billNo,
      SaleDate: req.body.SaleDate ? new Date(req.body.SaleDate) : new Date(),
      BuyerType: buyer.buyerType,
      StudentId: buyer.StudentId,
      RegistrationNumber: buyer.RegistrationNumber,
      StudentName: buyer.StudentName,
      ClassName: buyer.ClassName,
      Section: buyer.Section,
      BuyerName: buyer.BuyerName,
      ContactNumber: buyer.ContactNumber,
      Items: saleItems,
      SubTotal: bill.subtotal,
      LineDiscountTotal: bill.lineDiscountTotal,
      BillDiscount: bill.billDiscount,
      TaxableTotal: bill.taxableTotal,
      GstTotal: bill.gstTotal,
      GrandTotal: bill.grandTotal,
      AmountReceived: bill.amountReceived,
      PaidAmount: bill.paidAmount,
      ChangeReturned: bill.changeReturned,
      BalanceAmount: bill.balanceAmount,
      PaymentMode: paymentMode,
      PaymentReference: String(req.body.PaymentReference || '').trim(),
      PaymentStatus: bill.paymentStatus,
      Status: 'Completed',
      Payments:
        firstPaymentAmount > 0
          ? [
              {
                Amount: firstPaymentAmount,
                Mode: paymentMode,
                Reference: String(req.body.PaymentReference || '').trim(),
                Notes: String(req.body.Notes || '').trim(),
                CollectedBy: actorNameOf(req),
                CollectedByUserType: req.user?.UserType,
                CollectedAt: new Date(),
              },
            ]
          : [],
      Notes: String(req.body.Notes || '').trim(),
      CollectedBy: actorNameOf(req),
      CollectedByUserType: req.user?.UserType,
    });
        break;
      } catch (error) {
        lastError = error;
        if (stockTaken) {
          await restoreStockForSale(
            { InstutionCode: instutionCode, Items: saleItems, BillNo: billNo },
            actorNameOf(req),
            'Sale create rolled back'
          );
        }
        if (error?.code === 11000) {
          continue;
        }
        throw error;
      }
    }

    if (!sale) {
      throw lastError || new Error('Could not create a unique bill number. Please try again.');
    }

    return successResponse(res, sale, 'Sale completed', 201);
  } catch (error) {
    logger.error('createStoreSale failed', { error: error.message });
    return errorResponse(res, error.message || 'Failed to complete sale.', 400);
  }
};

const getSales = async (req, res) => {
  try {
    if (!requireSeller(req, res)) return;
    const instutionCode = institutionCodeOf(req);
    const page = Math.max(1, parseInt(req.query.PageNumber, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.PageSize, 10) || 20));
    const skip = (page - 1) * limit;
    const searchText = String(req.query.SearchText || '').trim();
    const paymentStatus = String(req.query.paymentStatus || '').trim();
    const status = String(req.query.status || '').trim();
    const from = req.query.from ? new Date(req.query.from) : null;
    const to = req.query.to ? new Date(req.query.to) : null;

    const filter = { InstutionCode: instutionCode };
    if (paymentStatus) filter.PaymentStatus = paymentStatus;
    if (status) filter.Status = status;
    if (from || to) {
      filter.SaleDate = {};
      if (from && !Number.isNaN(from.getTime())) filter.SaleDate.$gte = from;
      if (to && !Number.isNaN(to.getTime())) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        filter.SaleDate.$lte = end;
      }
    }
    if (searchText) {
      filter.$or = [
        { BillNo: { $regex: searchText, $options: 'i' } },
        { StudentName: { $regex: searchText, $options: 'i' } },
        { RegistrationNumber: { $regex: searchText, $options: 'i' } },
        { BuyerName: { $regex: searchText, $options: 'i' } },
      ];
    }

    const [sales, total] = await Promise.all([
      StoreSale.find(filter).sort({ SaleDate: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
      StoreSale.countDocuments(filter),
    ]);

    return paginatedResponse(res, sales.map(mapSale), { page, pageSize: limit, total }, 'Store sales retrieved');
  } catch (error) {
    logger.error('getStoreSales failed', { error: error.message });
    return errorResponse(res, 'Failed to load sales.', 500);
  }
};

const getSaleById = async (req, res) => {
  try {
    if (!requireSeller(req, res)) return;
    const sale = await StoreSale.findOne({
      _id: req.params.id,
      InstutionCode: institutionCodeOf(req),
    }).lean();
    if (!sale) return errorResponse(res, 'Sale not found.', 404);
    return successResponse(res, sale, 'Sale retrieved');
  } catch (error) {
    logger.error('getStoreSale failed', { error: error.message });
    return errorResponse(res, 'Failed to load sale.', 500);
  }
};

const collectPayment = async (req, res) => {
  try {
    if (!requireSeller(req, res)) return;
    const instutionCode = institutionCodeOf(req);
    const sale = await StoreSale.findOne({ _id: req.params.id, InstutionCode: instutionCode });
    if (!sale) return errorResponse(res, 'Sale not found.', 404);
    if (sale.Status === 'Cancelled') return errorResponse(res, 'Cannot collect payment on a cancelled bill.');
    if (sale.BalanceAmount <= 0) return errorResponse(res, 'This bill is already fully paid.');

    const amount = clampNonNegative(req.body.Amount);
    if (amount <= 0) return errorResponse(res, 'Payment amount must be greater than 0.');
    const applied = Math.min(amount, sale.BalanceAmount);
    const mode = PAYMENT_MODES.includes(req.body.PaymentMode) ? req.body.PaymentMode : sale.PaymentMode;

    sale.PaidAmount = roundMoney(sale.PaidAmount + applied);
    sale.AmountReceived = roundMoney(sale.AmountReceived + amount);
    sale.BalanceAmount = roundMoney(Math.max(0, sale.GrandTotal - sale.PaidAmount));
    sale.PaymentStatus = sale.BalanceAmount > 0 ? 'Partial' : 'Paid';
    if (sale.PaidAmount >= sale.GrandTotal) sale.ChangeReturned = roundMoney(Math.max(0, sale.AmountReceived - sale.GrandTotal));
    sale.Payments.push({
      Amount: applied,
      Mode: mode,
      Reference: String(req.body.PaymentReference || '').trim(),
      Notes: String(req.body.Notes || '').trim(),
      CollectedBy: actorNameOf(req),
      CollectedByUserType: req.user?.UserType,
      CollectedAt: new Date(),
    });
    await sale.save();
    return successResponse(res, sale, 'Payment collected');
  } catch (error) {
    logger.error('collectStorePayment failed', { error: error.message });
    return errorResponse(res, 'Failed to collect payment.', 500);
  }
};

const cancelSale = async (req, res) => {
  try {
    if (!requireSeller(req, res)) return;
    const instutionCode = institutionCodeOf(req);
    const sale = await StoreSale.findOne({ _id: req.params.id, InstutionCode: instutionCode });
    if (!sale) return errorResponse(res, 'Sale not found.', 404);
    if (sale.Status === 'Cancelled') return errorResponse(res, 'This bill is already cancelled.');

    const reason = String(req.body.Reason || '').trim();
    if (!reason) return errorResponse(res, 'Please enter a cancel reason.');

    await restoreStockForSale(sale, actorNameOf(req), reason);
    sale.Status = 'Cancelled';
    sale.CancelledBy = actorNameOf(req);
    sale.CancelledAt = new Date();
    sale.CancelReason = reason;
    sale.PaymentStatus = sale.PaidAmount > 0 ? sale.PaymentStatus : 'Unpaid';
    await sale.save();
    return successResponse(res, sale, 'Sale cancelled and stock restored');
  } catch (error) {
    logger.error('cancelStoreSale failed', { error: error.message });
    return errorResponse(res, 'Failed to cancel sale.', 500);
  }
};

const getStats = async (req, res) => {
  try {
    if (!requireSeller(req, res)) return;
    const instutionCode = institutionCodeOf(req);
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const [itemCount, lowStock, todayAgg, monthAgg, pendingDue] = await Promise.all([
      StoreItem.countDocuments({ InstutionCode: instutionCode, Status: 'Active' }),
      StoreItem.countDocuments({
        InstutionCode: instutionCode,
        Status: 'Active',
        $expr: { $lte: ['$StockQty', '$MinStock'] },
      }),
      StoreSale.aggregate([
        { $match: { InstutionCode: instutionCode, Status: 'Completed', SaleDate: { $gte: start } } },
        {
          $group: {
            _id: null,
            bills: { $sum: 1 },
            sales: { $sum: '$GrandTotal' },
            collected: { $sum: '$PaidAmount' },
          },
        },
      ]),
      StoreSale.aggregate([
        {
          $match: {
            InstutionCode: instutionCode,
            Status: 'Completed',
            SaleDate: { $gte: new Date(start.getFullYear(), start.getMonth(), 1) },
          },
        },
        {
          $group: {
            _id: '$PaymentMode',
            amount: { $sum: '$PaidAmount' },
            bills: { $sum: 1 },
          },
        },
      ]),
      StoreSale.aggregate([
        { $match: { InstutionCode: instutionCode, Status: 'Completed', BalanceAmount: { $gt: 0 } } },
        { $group: { _id: null, due: { $sum: '$BalanceAmount' }, bills: { $sum: 1 } } },
      ]),
    ]);

    const today = todayAgg[0] || { bills: 0, sales: 0, collected: 0 };
    const due = pendingDue[0] || { due: 0, bills: 0 };

    return successResponse(
      res,
      {
        activeItems: itemCount,
        lowStock,
        todayBills: today.bills,
        todaySales: roundMoney(today.sales),
        todayCollected: roundMoney(today.collected),
        monthByMode: monthAgg,
        pendingDue: roundMoney(due.due),
        pendingBills: due.bills,
        canSell: true,
      },
      'Store stats retrieved'
    );
  } catch (error) {
    logger.error('getStoreStats failed', { error: error.message });
    return errorResponse(res, 'Failed to load store stats.', 500);
  }
};

module.exports = {
  getMeta,
  getItems,
  createItem,
  updateItem,
  addStock,
  adjustStock,
  createSale,
  getSales,
  getSaleById,
  collectPayment,
  cancelSale,
  getStats,
  canSellStore,
};
