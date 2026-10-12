const express = require('express');
const router = express.Router();
const multer = require('multer');
const inventoryController = require('../controller/inventoryController');
const authenticate = require('../middleware/authenticate');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Item Management Routes
router.get('/items', authenticate, inventoryController.getAllItems);
// Low Stock Alert - MUST come before /items/:id to avoid route conflict
router.get('/items/low-stock', authenticate, inventoryController.getLowStockItems);
router.get('/items/:id', authenticate, inventoryController.getItemById);
router.post('/items', authenticate, inventoryController.createItem);
router.patch('/items/:id', authenticate, inventoryController.updateItem);
router.delete('/items/:id', authenticate, inventoryController.deleteItem);

// Transaction Routes
router.post('/transactions', authenticate, inventoryController.createTransaction);
router.get('/transactions', authenticate, inventoryController.getAllTransactions);

// Statistics
router.get('/stats', authenticate, inventoryController.getInventoryStats);

// Invoice Upload
router.post('/items/:id/invoice', authenticate, upload.single('invoice'), inventoryController.uploadInvoice);
router.post('/transactions/:id/invoice', authenticate, upload.single('invoice'), inventoryController.uploadTransactionInvoice);

module.exports = router;

