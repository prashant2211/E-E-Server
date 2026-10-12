const { LibraryBook, LibraryTransaction } = require('../models/libraryModel');
const { logger } = require('../utils/logger');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/response');
const { cache } = require('../utils/cache');
const { getPermissionSet } = require('./permissionAssinment');

/**
 * Get all books with pagination and search
 */
const getAllBooks = async (req, res) => {
  try {
    const permissionsResult = await getPermissionSet(req);
    const allowedRoles = ['Admin', 'Library Staff', 'SuperAdmin'];
    
    if (!allowedRoles.includes(req.user?.UserType) && 
        !permissionsResult.library?.split("-").includes('R')) {
      return res.status(403).json({
        code: 403,
        success: false,
        message: 'You do not have permission to view books. Only Admin and Library Staff can access this.'
      });
    }

    const page = parseInt(req.query.PageNumber) || 1;
    const limit = parseInt(req.query.PageSize) || 10;
    const skip = (page - 1) * limit;
    const searchText = req.query.SearchText || '';
    const category = req.query.category;

    let searchCondition = {
      InstutionCode: req.user.InstutionCode,
      Status: true
    };

    if (category) {
      searchCondition.Category = category;
    }

    if (searchText) {
      searchCondition.$or = [
        { Book_Title: { $regex: searchText, $options: 'i' } },
        { Author: { $regex: searchText, $options: 'i' } },
        { ISBN: { $regex: searchText, $options: 'i' } }
      ];
    }

    const cacheKey = `books:${req.user.InstutionCode}:${page}:${limit}:${category}:${searchText}`;
    const cached = cache.get(cacheKey);

    if (cached) {
      return successResponse(res, cached.data, 'Books retrieved successfully');
    }

    const [books, totalCount] = await Promise.all([
      LibraryBook.find(searchCondition)
        .select('-__v')
        .sort({ Book_Title: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      LibraryBook.countDocuments(searchCondition)
    ]);

    const result = { data: books, pagination: { page, pageSize: limit, total: totalCount } };
    cache.set(cacheKey, result, 300);

    return paginatedResponse(res, books, {
      page,
      pageSize: limit,
      total: totalCount
    }, 'Books retrieved successfully');

  } catch (error) {
    logger.error('Error fetching books:', error);
    return errorResponse(res, 'Failed to fetch books', 500);
  }
};

/**
 * Get book by ID
 */
const getBookById = async (req, res) => {
  try {
    const bookId = req.query.bookId || req.params.bookId;

    if (!bookId) {
      return errorResponse(res, 'Please provide Book ID', 400);
    }

    const cacheKey = `book:${bookId}`;
    const cached = cache.get(cacheKey);

    if (cached) {
      return successResponse(res, cached, 'Book retrieved successfully');
    }

    const book = await LibraryBook.findOne({
      _id: bookId,
      InstutionCode: req.user.InstutionCode
    }).select('-__v').lean();

    if (!book) {
      return errorResponse(res, 'Book not found', 404);
    }

    cache.set(cacheKey, book, 300);
    return successResponse(res, book, 'Book retrieved successfully');

  } catch (error) {
    logger.error('Error fetching book:', error);
    return errorResponse(res, 'Failed to fetch book', 500);
  }
};

/**
 * Add new book
 */
const addBook = async (req, res) => {
  try {
    const permissionsResult = await getPermissionSet(req);
    const allowedRoles = ['Admin', 'Library Staff', 'SuperAdmin'];
    
    if (!allowedRoles.includes(req.user?.UserType) && 
        !permissionsResult.library?.split("-").includes('W')) {
      return res.status(403).json({
        code: 403,
        success: false,
        message: 'You do not have permission to add books. Only Admin and Library Staff can access this.'
      });
    }

    const bookData = {
      ...req.body,
      InstutionCode: req.user.InstutionCode,
      Available_Copies: req.body.Total_Copies || req.body.Available_Copies || 1
    };

    if (bookData.Total_Copies && !bookData.Available_Copies) {
      bookData.Available_Copies = bookData.Total_Copies;
    }

    const book = await LibraryBook.create(bookData);

    // Clear cache
    cache.delete(`books:${req.user.InstutionCode}:*`);

    return successResponse(res, book, 'Book added successfully', 201);

  } catch (error) {
    logger.error('Error adding book:', error);
    if (error.code === 11000) {
      return errorResponse(res, 'Book with this ISBN already exists', 400);
    }
    return errorResponse(res, 'Failed to add book', 500);
  }
};

/**
 * Update book
 */
const updateBook = async (req, res) => {
  try {
    const permissionsResult = await getPermissionSet(req);
    const allowedRoles = ['Admin', 'Library Staff', 'SuperAdmin'];
    
    if (!allowedRoles.includes(req.user?.UserType) && 
        !permissionsResult.library?.split("-").includes('E')) {
      return res.status(403).json({
        code: 403,
        success: false,
        message: 'You do not have permission to update books. Only Admin and Library Staff can access this.'
      });
    }

    const bookId = req.params.id || req.body.bookId || req.body._id;

    if (!bookId) {
      return errorResponse(res, 'Please provide Book ID', 400);
    }

    const updateData = { ...req.body };
    delete updateData.bookId;
    delete updateData._id;
    delete updateData.InstutionCode;

    const book = await LibraryBook.findOneAndUpdate(
      { _id: bookId, InstutionCode: req.user.InstutionCode },
      updateData,
      { new: true, runValidators: true }
    ).select('-__v');

    if (!book) {
      return errorResponse(res, 'Book not found', 404);
    }

    cache.delete(`book:${bookId}`);
    cache.delete(`books:${req.user.InstutionCode}:*`);

    return successResponse(res, book, 'Book updated successfully');

  } catch (error) {
    logger.error('Error updating book:', error);
    return errorResponse(res, 'Failed to update book', 500);
  }
};

/**
 * Delete book
 */
const deleteBook = async (req, res) => {
  try {
    const permissionsResult = await getPermissionSet(req);
    const allowedRoles = ['Admin', 'Library Staff', 'SuperAdmin'];
    
    if (!allowedRoles.includes(req.user?.UserType) && 
        !permissionsResult.library?.split("-").includes('D')) {
      return res.status(403).json({
        code: 403,
        success: false,
        message: 'You do not have permission to delete books. Only Admin and Library Staff can access this.'
      });
    }

    const bookId = req.params.id || req.body.bookId;

    if (!bookId) {
      return errorResponse(res, 'Please provide Book ID', 400);
    }

    const book = await LibraryBook.findOneAndDelete({
      _id: bookId,
      InstutionCode: req.user.InstutionCode
    });

    if (!book) {
      return errorResponse(res, 'Book not found', 404);
    }

    cache.delete(`book:${bookId}`);
    cache.delete(`books:${req.user.InstutionCode}:*`);

    return successResponse(res, null, 'Book deleted successfully');

  } catch (error) {
    logger.error('Error deleting book:', error);
    return errorResponse(res, 'Failed to delete book', 500);
  }
};

/**
 * Issue book
 */
const issueBook = async (req, res) => {
  try {
    const permissionsResult = await getPermissionSet(req);
    const allowedRoles = ['Admin', 'Library Staff', 'SuperAdmin'];
    
    if (!allowedRoles.includes(req.user?.UserType) && 
        !permissionsResult.library?.split("-").includes('W')) {
      return res.status(403).json({
        code: 403,
        success: false,
        message: 'You do not have permission to issue books. Only Admin and Library Staff can access this.'
      });
    }

    const { bookId, registrationNumber, dueDate } = req.body;

    if (!bookId || !registrationNumber || !dueDate) {
      return errorResponse(res, 'Please provide bookId, registrationNumber, and dueDate', 400);
    }

    // Check book availability
    const book = await LibraryBook.findOne({
      _id: bookId,
      InstutionCode: req.user.InstutionCode
    });

    if (!book) {
      return errorResponse(res, 'Book not found', 404);
    }

    if (book.Available_Copies <= 0) {
      return errorResponse(res, 'Book is not available', 400);
    }

    // Check if already issued
    const existingIssue = await LibraryTransaction.findOne({
      Book_Id: bookId,
      Registration_Number: registrationNumber,
      Status: 'Issued'
    });

    if (existingIssue) {
      return errorResponse(res, 'Book already issued to this student', 400);
    }

    // Create transaction
    const transaction = await LibraryTransaction.create({
      InstutionCode: req.user.InstutionCode,
      Book_Id: bookId,
      Registration_Number: registrationNumber,
      Due_Date: new Date(dueDate),
      Issued_By: req.user.FirstName + ' ' + req.user.LastName,
      Status: 'Issued'
    });

    // Update book availability
    book.Available_Copies -= 1;
    await book.save();

    cache.delete(`book:${bookId}`);
    cache.delete(`transactions:${req.user.InstutionCode}:*`);

    return successResponse(res, transaction, 'Book issued successfully', 201);

  } catch (error) {
    logger.error('Error issuing book:', error);
    return errorResponse(res, 'Failed to issue book', 500);
  }
};

/**
 * Return book
 */
const returnBook = async (req, res) => {
  try {
    const permissionsResult = await getPermissionSet(req);
    const allowedRoles = ['Admin', 'Library Staff', 'SuperAdmin'];
    
    if (!allowedRoles.includes(req.user?.UserType) && 
        !permissionsResult.library?.split("-").includes('W')) {
      return res.status(403).json({
        code: 403,
        success: false,
        message: 'You do not have permission to return books. Only Admin and Library Staff can access this.'
      });
    }

    const { transactionId } = req.body;

    if (!transactionId) {
      return errorResponse(res, 'Please provide Transaction ID', 400);
    }

    const transaction = await LibraryTransaction.findOne({
      _id: transactionId,
      InstutionCode: req.user.InstutionCode,
      Status: 'Issued'
    });

    if (!transaction) {
      return errorResponse(res, 'Transaction not found or already returned', 404);
    }

    // Calculate fine if overdue
    const returnDate = new Date();
    const dueDate = new Date(transaction.Due_Date);
    let fineAmount = 0;

    if (returnDate > dueDate) {
      const daysOverdue = Math.ceil((returnDate - dueDate) / (1000 * 60 * 60 * 24));
      fineAmount = daysOverdue * 10; // ₹10 per day
    }

    // Update transaction
    transaction.Return_Date = returnDate;
    transaction.Fine_Amount = fineAmount;
    transaction.Status = fineAmount > 0 ? 'Overdue' : 'Returned';
    transaction.Returned_By = req.user.FirstName + ' ' + req.user.LastName;
    await transaction.save();

    // Update book availability
    const book = await LibraryBook.findById(transaction.Book_Id);
    if (book) {
      book.Available_Copies += 1;
      await book.save();
      cache.delete(`book:${transaction.Book_Id}`);
    }

    cache.delete(`transactions:${req.user.InstutionCode}:*`);

    return successResponse(res, transaction, 'Book returned successfully');

  } catch (error) {
    logger.error('Error returning book:', error);
    return errorResponse(res, 'Failed to return book', 500);
  }
};

/**
 * Get all transactions
 */
const getAllTransactions = async (req, res) => {
  try {
    const permissionsResult = await getPermissionSet(req);
    const allowedRoles = ['Admin', 'Library Staff', 'SuperAdmin'];
    
    if (!allowedRoles.includes(req.user?.UserType) && 
        !permissionsResult.library?.split("-").includes('R')) {
      return res.status(403).json({
        code: 403,
        success: false,
        message: 'You do not have permission to view transactions. Only Admin and Library Staff can access this.'
      });
    }

    const page = parseInt(req.query.PageNumber) || 1;
    const limit = parseInt(req.query.PageSize) || 10;
    const skip = (page - 1) * limit;
    const status = req.query.status;
    const registrationNumber = req.query.registrationNumber;

    let searchCondition = {
      InstutionCode: req.user.InstutionCode
    };

    if (status) {
      searchCondition.Status = status;
    }

    if (registrationNumber) {
      searchCondition.Registration_Number = registrationNumber;
    }

    const [transactions, totalCount] = await Promise.all([
      LibraryTransaction.find(searchCondition)
        .populate('Book_Id', 'Book_Title Author ISBN')
        .select('-__v')
        .sort({ Issue_Date: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      LibraryTransaction.countDocuments(searchCondition)
    ]);

    return paginatedResponse(res, transactions, {
      page,
      pageSize: limit,
      total: totalCount
    }, 'Transactions retrieved successfully');

  } catch (error) {
    logger.error('Error fetching transactions:', error);
    return errorResponse(res, 'Failed to fetch transactions', 500);
  }
};

module.exports = {
  getAllBooks,
  getBookById,
  addBook,
  updateBook,
  deleteBook,
  issueBook,
  returnBook,
  getAllTransactions
};

