const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authenticate');
const storeController = require('../controller/storeController');

router.get('/meta', authenticate, storeController.getMeta);
router.get('/items', authenticate, storeController.getItems);
router.post('/items', authenticate, storeController.createItem);
router.patch('/items/:id', authenticate, storeController.updateItem);
router.post('/items/:id/stock', authenticate, storeController.addStock);
router.post('/items/:id/adjust', authenticate, storeController.adjustStock);

router.get('/sales', authenticate, storeController.getSales);
router.get('/sales/:id', authenticate, storeController.getSaleById);
router.post('/sales', authenticate, storeController.createSale);
router.post('/sales/:id/collect', authenticate, storeController.collectPayment);
router.post('/sales/:id/cancel', authenticate, storeController.cancelSale);

router.get('/stats', authenticate, storeController.getStats);

module.exports = router;
