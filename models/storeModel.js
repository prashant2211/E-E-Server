const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const STORE_CATEGORIES = [
  'Stationery',
  'Books',
  'Notebooks',
  'Uniform',
  'Dress',
  'Shoes',
  'Socks',
  'Belt & Tie',
  'Bags',
  'Sports',
  'Art & Craft',
  'Lab',
  'ID & Badge',
  'Other',
];

const STORE_UNITS = ['Piece', 'Pair', 'Set', 'Pack', 'Dozen', 'Box', 'Meter', 'Kg', 'Other'];
const STORE_GENDERS = ['Boys', 'Girls', 'Unisex', 'NA'];
const PAYMENT_MODES = ['Cash', 'UPI', 'QR', 'Bank Transfer', 'Cheque', 'Card', 'Mixed'];
const SALE_STATUSES = ['Completed', 'Cancelled'];
const PAYMENT_STATUSES = ['Paid', 'Partial', 'Unpaid'];
const BUYER_TYPES = ['Student', 'Walk-in', 'Parent', 'Staff', 'Other'];

const storeItemSchema = new Schema(
  {
    InstutionCode: { type: String, required: true, index: true },
    ItemCode: { type: String, required: true },
    Name: { type: String, required: true, trim: true },
    Category: { type: String, required: true, enum: STORE_CATEGORIES },
    Description: { type: String, default: '' },
    Variant: { type: String, default: '' },
    Size: { type: String, default: '' },
    Color: { type: String, default: '' },
    Gender: { type: String, enum: STORE_GENDERS, default: 'NA' },
    Unit: { type: String, enum: STORE_UNITS, default: 'Piece' },
    HsnCode: { type: String, default: '' },
    Barcode: { type: String, default: '' },
    AcademicYear: { type: String, default: '' },
    CostPrice: { type: Number, default: 0, min: 0 },
    SellingPrice: { type: Number, required: true, min: 0 },
    GstPercent: { type: Number, default: 0, min: 0, max: 28 },
    StockQty: { type: Number, default: 0, min: 0 },
    MinStock: { type: Number, default: 2, min: 0 },
    Status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    CreatedBy: { type: String, default: '' },
    UpdatedBy: { type: String, default: '' },
  },
  { timestamps: true }
);

storeItemSchema.index({ InstutionCode: 1, ItemCode: 1 }, { unique: true });
storeItemSchema.index({ InstutionCode: 1, Category: 1, Status: 1 });
storeItemSchema.index({ InstutionCode: 1, Name: 1 });

const storeSaleItemSchema = new Schema(
  {
    ItemId: { type: Schema.Types.ObjectId, ref: 'StoreItem' },
    ItemCode: { type: String, default: '' },
    Name: { type: String, required: true },
    Category: { type: String, default: '' },
    Variant: { type: String, default: '' },
    Size: { type: String, default: '' },
    Unit: { type: String, default: 'Piece' },
    Qty: { type: Number, required: true, min: 1 },
    UnitPrice: { type: Number, required: true, min: 0 },
    GstPercent: { type: Number, default: 0, min: 0 },
    LineDiscount: { type: Number, default: 0, min: 0 },
    LineGross: { type: Number, default: 0, min: 0 },
    AllocatedBillDiscount: { type: Number, default: 0, min: 0 },
    Taxable: { type: Number, default: 0, min: 0 },
    LineGst: { type: Number, default: 0, min: 0 },
    LineTotal: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const storePaymentSchema = new Schema(
  {
    Amount: { type: Number, required: true, min: 0 },
    Mode: { type: String, enum: PAYMENT_MODES, required: true },
    Reference: { type: String, default: '' },
    Notes: { type: String, default: '' },
    CollectedBy: { type: String, default: '' },
    CollectedByUserType: { type: String, default: '' },
    CollectedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const storeSaleSchema = new Schema(
  {
    InstutionCode: { type: String, required: true, index: true },
    BillNo: { type: String, required: true },
    SaleDate: { type: Date, default: Date.now },
    BuyerType: { type: String, enum: BUYER_TYPES, default: 'Student' },
    StudentId: { type: Schema.Types.ObjectId, ref: 'Student' },
    RegistrationNumber: { type: String, default: '' },
    StudentName: { type: String, default: '' },
    ClassName: { type: String, default: '' },
    Section: { type: String, default: '' },
    BuyerName: { type: String, default: '' },
    ContactNumber: { type: String, default: '' },
    Items: { type: [storeSaleItemSchema], default: [] },
    SubTotal: { type: Number, default: 0, min: 0 },
    LineDiscountTotal: { type: Number, default: 0, min: 0 },
    BillDiscount: { type: Number, default: 0, min: 0 },
    TaxableTotal: { type: Number, default: 0, min: 0 },
    GstTotal: { type: Number, default: 0, min: 0 },
    GrandTotal: { type: Number, default: 0, min: 0 },
    AmountReceived: { type: Number, default: 0, min: 0 },
    PaidAmount: { type: Number, default: 0, min: 0 },
    ChangeReturned: { type: Number, default: 0, min: 0 },
    BalanceAmount: { type: Number, default: 0, min: 0 },
    PaymentMode: { type: String, enum: PAYMENT_MODES, default: 'Cash' },
    PaymentReference: { type: String, default: '' },
    PaymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'Unpaid' },
    Status: { type: String, enum: SALE_STATUSES, default: 'Completed' },
    Payments: { type: [storePaymentSchema], default: [] },
    Notes: { type: String, default: '' },
    CollectedBy: { type: String, default: '' },
    CollectedByUserType: { type: String, default: '' },
    CancelledBy: { type: String, default: '' },
    CancelledAt: { type: Date },
    CancelReason: { type: String, default: '' },
  },
  { timestamps: true }
);

storeSaleSchema.index({ InstutionCode: 1, BillNo: 1 }, { unique: true });
storeSaleSchema.index({ InstutionCode: 1, SaleDate: -1 });
storeSaleSchema.index({ InstutionCode: 1, RegistrationNumber: 1 });
storeSaleSchema.index({ InstutionCode: 1, PaymentStatus: 1, Status: 1 });

const storeStockLedgerSchema = new Schema(
  {
    InstutionCode: { type: String, required: true, index: true },
    ItemId: { type: Schema.Types.ObjectId, ref: 'StoreItem', required: true },
    ItemCode: { type: String, default: '' },
    Type: {
      type: String,
      enum: ['In', 'Out', 'Adjustment', 'Return'],
      required: true,
    },
    Qty: { type: Number, required: true },
    BalanceAfter: { type: Number, default: 0 },
    UnitCost: { type: Number, default: 0 },
    Reference: { type: String, default: '' },
    Notes: { type: String, default: '' },
    CreatedBy: { type: String, default: '' },
  },
  { timestamps: true }
);

storeStockLedgerSchema.index({ InstutionCode: 1, ItemId: 1, createdAt: -1 });

const StoreItem = mongoose.model('StoreItem', storeItemSchema);
const StoreSale = mongoose.model('StoreSale', storeSaleSchema);
const StoreStockLedger = mongoose.model('StoreStockLedger', storeStockLedgerSchema);

module.exports = {
  StoreItem,
  StoreSale,
  StoreStockLedger,
  STORE_CATEGORIES,
  STORE_UNITS,
  STORE_GENDERS,
  PAYMENT_MODES,
  SALE_STATUSES,
  PAYMENT_STATUSES,
  BUYER_TYPES,
};
