const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authenticate');
const libraryController = require('../controller/libraryController');

// Transaction Management - MUST come before /books/:id to avoid route conflict
router.get('/transactions', authenticate, libraryController.getAllTransactions);
router.post('/issue', authenticate, libraryController.issueBook);
router.post('/return', authenticate, libraryController.returnBook);

// Book Management - RESTful routes
router.get('/books', authenticate, libraryController.getAllBooks);
router.post('/books', authenticate, libraryController.addBook);
router.get('/books/:id', authenticate, libraryController.getBookById);
router.patch('/books/:id', authenticate, libraryController.updateBook);
router.delete('/books/:id', authenticate, libraryController.deleteBook);

// Legacy routes for backward compatibility
router.get('/get-all-books', authenticate, libraryController.getAllBooks);
router.get('/get-byid-book', authenticate, libraryController.getBookById);
router.post('/add-book', authenticate, libraryController.addBook);
router.patch('/update-book', authenticate, libraryController.updateBook);
router.delete('/delete-book', authenticate, libraryController.deleteBook);
router.get('/get-all-transactions', authenticate, libraryController.getAllTransactions);

module.exports = router;

