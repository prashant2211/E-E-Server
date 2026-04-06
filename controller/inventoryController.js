const { InventoryItem, InventoryTransaction, InventoryCategory } = require('../models/inventoryModel');
const { logger } = require('../utils/logger');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/response');
const { cache } = require('../utils/cache');
const { getPermissionSet } = require('./permissionAssinment');

/**
 * Get all inventory items with pagination and search
 */
const getAllItems = async (req, res) => {
  try {
    const permissionsResult = await getPermissionSet(req);
    const allowedRoles = ['Admin', 'Inventory Staff', 'SuperAdmin'];
    
    if (!allowedRoles.includes(req.user?.UserType) && 
        !permissionsResult.inventory?.split("-").includes('R')) {
      return res.status(403).json({
        code: 403,
        success: false,
        message: 'You do not have permission to view inventory. Only Admin and Inventory Staff can access this.'
      });
    }

    const page = parseInt(req.query.PageNumber) || 1;
    const limit = parseInt(req.query.PageSize) || 10;
    const skip = (page - 1) * limit;
    const searchText = req.query.SearchText || '';
    const category = req.query.category;
    const status = req.query.status;

    let searchCondition = {
      InstutionCode: req.user?.InstutionCode,
    };

    if (category) {
      searchCondition.Category = category;
    }

    if (status) {
      searchCondition.Status = status;
    }

    if (searchText) {
      searchCondition.$or = [
        { Item_Name: { $regex: searchText, $options: 'i' } },
        { Item_Code: { $regex: searchText, $options: 'i' } },
        { Description: { $regex: searchText, $options: 'i' } },
        { Location: { $regex: searchText, $options: 'i' } }
      ];
    }

    const cacheKey = `inventory:${req.user?.InstutionCode}:${page}:${limit}:${category}:${status}:${searchText}`;
    const cached = cache.get(cacheKey);

    if (cached) {
      return successResponse(res, cached.data, 'Inventory items retrieved successfully');
    }

    const [items, totalCount] = await Promise.all([
      InventoryItem.find(searchCondition)
        .select('-__v')
        .sort({ Item_Name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      InventoryItem.countDocuments(searchCondition)
    ]);

    const result = {
      items,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalItems: totalCount,
        itemsPerPage: limit
      }
    };

    cache.set(cacheKey, { data: result }, 300); // Cache for 5 minutes

    return successResponse(res, result, 'Inventory items retrieved successfully');
  } catch (error) {
    logger.error('Error fetching inventory items:', error);
    return errorResponse(res, 'Failed to fetch inventory items', 500);
  }
};

/**
 * Get single inventory item by ID
 */
const getItemById = async (req, res) => {
  try {
    const permissionsResult = await getPermissionSet(req);
    const allowedRoles = ['Admin', 'Inventory Staff', 'SuperAdmin'];
    
    if (!allowedRoles.includes(req.user?.UserType) && 
        !permissionsResult.inventory?.split("-").includes('R')) {
      return res.status(403).json({
        code: 403,
        success: false,
        message: 'You do not have permission to view inventory items.'
      });
    }

    const itemId = req.params.id || req.query.itemId;
    const item = await InventoryItem.findOne({
      _id: itemId,
      InstutionCode: req.user?.InstutionCode
    }).lean();

    if (!item) {
      return errorResponse(res, 'Inventory item not found', 404);
    }

    return successResponse(res, item, 'Inventory item retrieved successfully');
  } catch (error) {
    logger.error('Error fetching inventory item:', error);
    return errorResponse(res, 'Failed to fetch inventory item', 500);
  }
};

/**
 * Create new inventory item
 */
const createItem = async (req, res) => {
  try {
    const permissionsResult = await getPermissionSet(req);
    const allowedRoles = ['Admin', 'Inventory Staff', 'SuperAdmin'];
    
    if (!allowedRoles.includes(req.user?.UserType) && 
        !permissionsResult.inventory?.split("-").includes('W')) {
      return res.status(403).json({
        code: 403,
        success: false,
        message: 'You do not have permission to create inventory items. Only Admin and Inventory Staff can access this.'
      });
    }

    const itemData = {
      ...req.body,
      InstutionCode: req.user?.InstutionCode || req.body.InstutionCode,
      Total_Value: (req.body.Current_Stock || 0) * (req.body.Unit_Price || 0)
    };

    // Generate item code if not provided
    if (!itemData.Item_Code) {
      const count = await InventoryItem.countDocuments({ InstutionCode: itemData.InstutionCode });
      itemData.Item_Code = `INV-${itemData.InstutionCode}-${String(count + 1).padStart(4, '0')}`;
    }

    const newItem = new InventoryItem(itemData);
    const savedItem = await newItem.save();

    // Clear cache
    cache.clear(`inventory:${req.user?.InstutionCode}`);

    return successResponse(res, savedItem, 'Inventory item created successfully', 201);
  } catch (error) {
    logger.error('Error creating inventory item:', error);
    if (error.code === 11000) {
      return errorResponse(res, 'Item code or barcode already exists', 400);
    }
    return errorResponse(res, 'Failed to create inventory item', 500);
  }
};

/**
 * Update inventory item
 */
const updateItem = async (req, res) => {
  try {
    const permissionsResult = await getPermissionSet(req);
    const allowedRoles = ['Admin', 'Inventory Staff', 'SuperAdmin'];
    
    if (!allowedRoles.includes(req.user?.UserType) && 
        !permissionsResult.inventory?.split("-").includes('E')) {
      return res.status(403).json({
        code: 403,
        success: false,
        message: 'You do not have permission to update inventory items. Only Admin and Inventory Staff can access this.'
      });
    }

    const itemId = req.params.id || req.body.itemId;
    const updateData = { ...req.body };

    // Recalculate total value if stock or price changed
    if (updateData.Current_Stock !== undefined || updateData.Unit_Price !== undefined) {
      const existingItem = await InventoryItem.findById(itemId);
      if (existingItem) {
        const stock = updateData.Current_Stock !== undefined ? updateData.Current_Stock : existingItem.Current_Stock;
        const price = updateData.Unit_Price !== undefined ? updateData.Unit_Price : existingItem.Unit_Price;
        updateData.Total_Value = stock * price;
      }
    }

    const updatedItem = await InventoryItem.findOneAndUpdate(
      { _id: itemId, InstutionCode: req.user?.InstutionCode },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updatedItem) {
      return errorResponse(res, 'Inventory item not found', 404);
    }

    // Clear cache
    cache.clear(`inventory:${req.user?.InstutionCode}`);

    return successResponse(res, updatedItem, 'Inventory item updated successfully');
  } catch (error) {
    logger.error('Error updating inventory item:', error);
    return errorResponse(res, 'Failed to update inventory item', 500);
  }
};

/**
 * Delete inventory item
 */
const deleteItem = async (req, res) => {
  try {
    const permissionsResult = await getPermissionSet(req);
    const allowedRoles = ['Admin', 'Inventory Staff', 'SuperAdmin'];
    
    if (!allowedRoles.includes(req.user?.UserType) && 
        !permissionsResult.inventory?.split("-").includes('D')) {
      return res.status(403).json({
        code: 403,
        success: false,
        message: 'You do not have permission to delete inventory items. Only Admin and Inventory Staff can access this.'
      });
    }

    const itemId = req.params.id || req.body.itemId;
    const deletedItem = await InventoryItem.findOneAndDelete({
      _id: itemId,
      InstutionCode: req.user?.InstutionCode
    });

    if (!deletedItem) {
      return errorResponse(res, 'Inventory item not found', 404);
    }

    // Clear cache
    cache.clear(`inventory:${req.user?.InstutionCode}`);

    return successResponse(res, deletedItem, 'Inventory item deleted successfully');
  } catch (error) {
    logger.error('Error deleting inventory item:', error);
    return errorResponse(res, 'Failed to delete inventory item', 500);
  }
};

/**
 * Get low stock items
 */
const getLowStockItems = async (req, res) => {
  try {
    const permissionsResult = await getPermissionSet(req);
    const allowedRoles = ['Admin', 'Inventory Staff', 'SuperAdmin'];
    
    if (!allowedRoles.includes(req.user?.UserType) && 
        !permissionsResult.inventory?.split("-").includes('R')) {
      return res.status(403).json({
        code: 403,
        success: false,
        message: 'You do not have permission to view inventory reports.'
      });
    }

    const items = await InventoryItem.find({
      InstutionCode: req.user?.InstutionCode,
      Status: 'Active',
      Minimum_Stock: { $gt: 0 }, // Only check items with minimum stock set
      $expr: {
        $lte: ['$Current_Stock', '$Minimum_Stock']
      }
    }).lean();

    return successResponse(res, items, 'Low stock items retrieved successfully');
  } catch (error) {
    logger.error('Error fetching low stock items:', error);
    return errorResponse(res, 'Failed to fetch low stock items', 500);
  }
};

/**
 * Create inventory transaction (Issue/Return/Purchase/etc.)
 */
const createTransaction = async (req, res) => {
  try {
    const permissionsResult = await getPermissionSet(req);
    const allowedRoles = ['Admin', 'Inventory Staff', 'SuperAdmin'];
    
    if (!allowedRoles.includes(req.user?.UserType) && 
        !permissionsResult.inventory?.split("-").includes('W')) {
      return res.status(403).json({
        code: 403,
        success: false,
        message: 'You do not have permission to create inventory transactions.'
      });
    }

    const transactionData = {
      ...req.body,
      InstutionCode: req.user?.InstutionCode,
      Issued_By: req.user?._id
    };

    // Calculate total amount
    transactionData.Total_Amount = (transactionData.Quantity || 0) * (transactionData.Unit_Price || 0);

    // Generate reference number if not provided
    if (!transactionData.Reference_Number) {
      const count = await InventoryTransaction.countDocuments({ InstutionCode: transactionData.InstutionCode });
      transactionData.Reference_Number = `TXN-${transactionData.InstutionCode}-${String(count + 1).padStart(6, '0')}`;
    }

    const transaction = new InventoryTransaction(transactionData);
    const savedTransaction = await transaction.save();

    // Update item stock based on transaction type
    if (transactionData.Transaction_Type === 'Purchase' || transactionData.Transaction_Type === 'Return') {
      await InventoryItem.findByIdAndUpdate(
        transactionData.Item_Id,
        { $inc: { Current_Stock: transactionData.Quantity } }
      );
    } else if (transactionData.Transaction_Type === 'Issue' || transactionData.Transaction_Type === 'Disposal' || transactionData.Transaction_Type === 'Damage') {
      await InventoryItem.findByIdAndUpdate(
        transactionData.Item_Id,
        { $inc: { Current_Stock: -transactionData.Quantity } }
      );
    }

    // Clear cache
    cache.clear(`inventory:${req.user?.InstutionCode}`);

    return successResponse(res, savedTransaction, 'Transaction created successfully', 201);
  } catch (error) {
    logger.error('Error creating transaction:', error);
    return errorResponse(res, 'Failed to create transaction', 500);
  }
};

/**
 * Get all transactions
 */
const getAllTransactions = async (req, res) => {
  try {
    const permissionsResult = await getPermissionSet(req);
    const allowedRoles = ['Admin', 'Inventory Staff', 'SuperAdmin'];
    
    if (!allowedRoles.includes(req.user?.UserType) && 
        !permissionsResult.inventory?.split("-").includes('R')) {
      return res.status(403).json({
        code: 403,
        success: false,
        message: 'You do not have permission to view transactions.'
      });
    }

    const page = parseInt(req.query.PageNumber) || 1;
    const limit = parseInt(req.query.PageSize) || 10;
    const skip = (page - 1) * limit;
    const transactionType = req.query.transactionType;
    const itemId = req.query.itemId;

    let searchCondition = {
      InstutionCode: req.user?.InstutionCode
    };

    if (transactionType) {
      searchCondition.Transaction_Type = transactionType;
    }

    if (itemId) {
      searchCondition.Item_Id = itemId;
    }

    const [transactions, totalCount] = await Promise.all([
      InventoryTransaction.find(searchCondition)
        .populate('Item_Id', 'Item_Name Item_Code Category')
        .populate('Issued_By', 'FirstName LastName')
        .select('-__v')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      InventoryTransaction.countDocuments(searchCondition)
    ]);

    const result = {
      transactions,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalItems: totalCount,
        itemsPerPage: limit
      }
    };

    return successResponse(res, result, 'Transactions retrieved successfully');
  } catch (error) {
    logger.error('Error fetching transactions:', error);
    return errorResponse(res, 'Failed to fetch transactions', 500);
  }
};

/**
 * Get inventory statistics
 */
const getInventoryStats = async (req, res) => {
  try {
    const permissionsResult = await getPermissionSet(req);
    const allowedRoles = ['Admin', 'Inventory Staff', 'SuperAdmin'];
    
    if (!allowedRoles.includes(req.user?.UserType) && 
        !permissionsResult.inventory?.split("-").includes('R')) {
      return res.status(403).json({
        code: 403,
        success: false,
        message: 'You do not have permission to view inventory statistics.'
      });
    }

    const [totalItems, lowStockCount, totalValue, categoryCount] = await Promise.all([
      InventoryItem.countDocuments({ InstutionCode: req.user?.InstutionCode, Status: 'Active' }),
      InventoryItem.countDocuments({
        InstutionCode: req.user?.InstutionCode,
        Status: 'Active',
        $expr: { $lte: ['$Current_Stock', '$Minimum_Stock'] }
      }),
      InventoryItem.aggregate([
        { $match: { InstutionCode: req.user?.InstutionCode, Status: 'Active' } },
        { $group: { _id: null, total: { $sum: '$Total_Value' } } }
      ]),
      InventoryItem.distinct('Category', { InstutionCode: req.user?.InstutionCode, Status: 'Active' })
    ]);

    const stats = {
      totalItems,
      lowStockCount,
      totalValue: totalValue[0]?.total || 0,
      categoryCount: categoryCount.length,
      pendingIssues: await InventoryTransaction.countDocuments({
        InstutionCode: req.user?.InstutionCode,
        Transaction_Type: 'Issue',
        Status: 'Pending'
      }),
      overdueReturns: await InventoryTransaction.countDocuments({
        InstutionCode: req.user?.InstutionCode,
        Transaction_Type: 'Issue',
        Status: 'Overdue'
      })
    };

    return successResponse(res, stats, 'Inventory statistics retrieved successfully');
  } catch (error) {
    logger.error('Error fetching inventory statistics:', error);
    return errorResponse(res, 'Failed to fetch inventory statistics', 500);
  }
};

/**
 * Upload invoice for inventory transaction
 */
const uploadTransactionInvoice = async (req, res) => {
  try {
    const permissionsResult = await getPermissionSet(req);
    const allowedRoles = ['Admin', 'Inventory Staff', 'SuperAdmin'];
    
    if (!allowedRoles.includes(req.user?.UserType) && 
        !permissionsResult.inventory?.split("-").includes('W')) {
      return res.status(403).json({
        code: 403,
        success: false,
        message: 'You do not have permission to upload invoices. Only Admin and Inventory Staff can access this.'
      });
    }

    if (!req.files || req.files.length === 0) {
      return errorResponse(res, 'No file uploaded', 400);
    }

    const transactionId = req.params.id || req.body.transactionId;
    if (!transactionId) {
      return errorResponse(res, 'Transaction ID is required', 400);
    }

    // Check if transaction exists
    const transaction = await InventoryTransaction.findOne({
      _id: transactionId,
      InstutionCode: req.user?.InstutionCode
    });

    if (!transaction) {
      return errorResponse(res, 'Transaction not found', 404);
    }

    const { authorize, uploadFile } = require('../utils/googleDriveHelper');
    const authClient = await authorize();

    const file = req.files[0];
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `Transaction-Invoice-${transaction.Reference_Number || transactionId}-${timestamp}-${file.originalname}`;

    // Upload to Google Drive in school-specific folder
    const uploadedFile = await uploadFile(
      authClient,
      file.buffer,
      fileName,
      req.user.InstutionCode,
      'Invoices'
    );

    // Update transaction with invoice information
    const updatedTransaction = await InventoryTransaction.findByIdAndUpdate(
      transactionId,
      {
        $set: {
          Invoice_URL: uploadedFile.webViewLink,
          Invoice_FileId: uploadedFile.id,
          Invoice_FileName: file.originalname
        }
      },
      { new: true }
    ).populate('Item_Id', 'Item_Name Item_Code');

    return successResponse(res, {
      transaction: updatedTransaction,
      invoice: {
        fileId: uploadedFile.id,
        fileName: uploadedFile.name,
        webViewLink: uploadedFile.webViewLink,
        webContentLink: uploadedFile.webContentLink
      }
    }, 'Invoice uploaded successfully');
  } catch (error) {
    logger.error('Error uploading transaction invoice:', error);
    return errorResponse(res, 'Failed to upload invoice', 500);
  }
};

/**
 * Upload invoice for inventory item
 */
const uploadInvoice = async (req, res) => {
  try {
    const permissionsResult = await getPermissionSet(req);
    const allowedRoles = ['Admin', 'Inventory Staff', 'SuperAdmin'];
    
    if (!allowedRoles.includes(req.user?.UserType) && 
        !permissionsResult.inventory?.split("-").includes('W')) {
      return res.status(403).json({
        code: 403,
        success: false,
        message: 'You do not have permission to upload invoices. Only Admin and Inventory Staff can access this.'
      });
    }

    if (!req.files || req.files.length === 0) {
      return errorResponse(res, 'No file uploaded', 400);
    }

    const itemId = req.params.id || req.body.itemId;
    if (!itemId) {
      return errorResponse(res, 'Item ID is required', 400);
    }

    // Check if item exists
    const item = await InventoryItem.findOne({
      _id: itemId,
      InstutionCode: req.user?.InstutionCode
    });

    if (!item) {
      return errorResponse(res, 'Inventory item not found', 404);
    }

    const { authorize, uploadFile } = require('../utils/googleDriveHelper');
    const authClient = await authorize();

    const file = req.files[0];
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `Invoice-${item.Item_Code || itemId}-${timestamp}-${file.originalname}`;

    // Upload to Google Drive in school-specific folder
    const uploadedFile = await uploadFile(
      authClient,
      file.buffer,
      fileName,
      req.user.InstutionCode,
      'Invoices'
    );

    // Update item with invoice information
    const updatedItem = await InventoryItem.findByIdAndUpdate(
      itemId,
      {
        $set: {
          Invoice_URL: uploadedFile.webViewLink,
          Invoice_FileId: uploadedFile.id,
          Invoice_FileName: file.originalname
        }
      },
      { new: true }
    );

    // Clear cache
    cache.clear(`inventory:${req.user?.InstutionCode}`);

    return successResponse(res, {
      item: updatedItem,
      invoice: {
        fileId: uploadedFile.id,
        fileName: uploadedFile.name,
        webViewLink: uploadedFile.webViewLink,
        webContentLink: uploadedFile.webContentLink
      }
    }, 'Invoice uploaded successfully');
  } catch (error) {
    logger.error('Error uploading invoice:', error);
    return errorResponse(res, 'Failed to upload invoice', 500);
  }
};

module.exports = {
  getAllItems,
  getItemById,
  createItem,
  updateItem,
  deleteItem,
  getLowStockItems,
  createTransaction,
  getAllTransactions,
  getInventoryStats,
  uploadInvoice,
  uploadTransactionInvoice
};

