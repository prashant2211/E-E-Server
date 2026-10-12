const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Inventory Item Schema
const inventoryItemSchema = new Schema({
    InstutionCode: {
        type: String,
        required: true,
        index: true
    },
    Item_Name: {
        type: String,
        required: true
    },
    Item_Code: {
        type: String,
        unique: true,
        sparse: true
    },
    Category: {
        type: String,
        required: true,
        enum: ['Stationery', 'Lab Equipment', 'Sports Equipment', 'IT Equipment', 'Furniture', 'Library Books', 'Transport Parts', 'Hostel Supplies', 'Maintenance Supplies', 'Food Supplies', 'Other']
    },
    Description: {
        type: String
    },
    Unit: {
        type: String,
        required: true,
        enum: ['Piece', 'Box', 'Set', 'Pack', 'Dozen', 'Kg', 'Liter', 'Meter', 'Other']
    },
    Current_Stock: {
        type: Number,
        required: true,
        default: 0,
        min: 0
    },
    Minimum_Stock: {
        type: Number,
        default: 0,
        min: 0
    },
    Maximum_Stock: {
        type: Number,
        default: 0,
        min: 0
    },
    Unit_Price: {
        type: Number,
        default: 0,
        min: 0
    },
    Total_Value: {
        type: Number,
        default: 0,
        min: 0
    },
    Location: {
        type: String,
        required: true
    },
    Supplier_Name: {
        type: String
    },
    Supplier_Contact: {
        type: String
    },
    Purchase_Date: {
        type: Date
    },
    Expiry_Date: {
        type: Date
    },
    Status: {
        type: String,
        enum: ['Active', 'Inactive', 'Disposed', 'Damaged'],
        default: 'Active'
    },
    Barcode: {
        type: String,
        unique: true,
        sparse: true
    },
    QR_Code: {
        type: String
    },
    Notes: {
        type: String
    },
    Invoice_URL: {
        type: String
    },
    Invoice_FileId: {
        type: String
    },
    Invoice_FileName: {
        type: String
    }
}, {
    timestamps: true
});

// Inventory Transaction Schema
const inventoryTransactionSchema = new Schema({
    InstutionCode: {
        type: String,
        required: true,
        index: true
    },
    Item_Id: {
        type: Schema.Types.ObjectId,
        ref: 'InventoryItem',
        required: true,
        index: true
    },
    Transaction_Type: {
        type: String,
        required: true,
        enum: ['Purchase', 'Issue', 'Return', 'Adjustment', 'Transfer', 'Disposal', 'Damage']
    },
    Quantity: {
        type: Number,
        required: true,
        min: 0
    },
    Unit_Price: {
        type: Number,
        default: 0,
        min: 0
    },
    Total_Amount: {
        type: Number,
        default: 0,
        min: 0
    },
    Issued_To: {
        UserType: {
            type: String,
            enum: ['Student', 'Teacher', 'Staff', 'Class', 'Department', 'Other']
        },
        UserId: {
            type: Schema.Types.ObjectId
        },
        UserName: {
            type: String
        }
    },
    Issued_By: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    Return_Date: {
        type: Date
    },
    Expected_Return_Date: {
        type: Date
    },
    Status: {
        type: String,
        enum: ['Pending', 'Completed', 'Overdue', 'Cancelled'],
        default: 'Completed'
    },
    Location_From: {
        type: String
    },
    Location_To: {
        type: String
    },
    Notes: {
        type: String
    },
    Reference_Number: {
        type: String
    },
    Invoice_URL: {
        type: String
    },
    Invoice_FileId: {
        type: String
    },
    Invoice_FileName: {
        type: String
    }
}, {
    timestamps: true
});

// Inventory Category Schema
const inventoryCategorySchema = new Schema({
    InstutionCode: {
        type: String,
        required: true,
        index: true
    },
    Category_Name: {
        type: String,
        required: true
    },
    Description: {
        type: String
    },
    Status: {
        type: String,
        enum: ['Active', 'Inactive'],
        default: 'Active'
    }
}, {
    timestamps: true
});

// Create indexes
inventoryItemSchema.index({ InstutionCode: 1, Category: 1 });
inventoryItemSchema.index({ InstutionCode: 1, Status: 1 });
inventoryItemSchema.index({ InstutionCode: 1, Item_Name: 1 });
inventoryTransactionSchema.index({ InstutionCode: 1, Transaction_Type: 1 });
inventoryTransactionSchema.index({ InstutionCode: 1, Status: 1 });
inventoryTransactionSchema.index({ Item_Id: 1, Transaction_Type: 1 });

const InventoryItem = mongoose.model('InventoryItem', inventoryItemSchema);
const InventoryTransaction = mongoose.model('InventoryTransaction', inventoryTransactionSchema);
const InventoryCategory = mongoose.model('InventoryCategory', inventoryCategorySchema);

module.exports = {
    InventoryItem,
    InventoryTransaction,
    InventoryCategory
};

