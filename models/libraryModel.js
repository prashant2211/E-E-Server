const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const libraryBookSchema = new Schema({
  InstutionCode: {
    type: String,
    required: true,
    index: true
  },
  Book_Title: {
    type: String,
    required: true
  },
  Author: {
    type: String,
    required: true
  },
  ISBN: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  Publisher: String,
  Publication_Year: Number,
  Category: {
    type: String,
    index: true
  },
  Language: {
    type: String,
    default: 'English'
  },
  Total_Copies: {
    type: Number,
    required: true,
    default: 1
  },
  Available_Copies: {
    type: Number,
    required: true,
    default: 1
  },
  Price: Number,
  Shelf_Number: String,
  Rack_Number: String,
  Description: String,
  Status: {
    type: Boolean,
    default: true,
    index: true
  },
  Created_At: {
    type: Date,
    default: Date.now
  },
  Updated_At: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

const libraryTransactionSchema = new Schema({
  InstutionCode: {
    type: String,
    required: true,
    index: true
  },
  Book_Id: {
    type: Schema.Types.ObjectId,
    ref: 'LibraryBook',
    required: true,
    index: true
  },
  Registration_Number: {
    type: String,
    required: true,
    index: true
  },
  Issue_Date: {
    type: Date,
    required: true,
    default: Date.now
  },
  Due_Date: {
    type: Date,
    required: true
  },
  Return_Date: Date,
  Fine_Amount: {
    type: Number,
    default: 0
  },
  Status: {
    type: String,
    enum: ['Issued', 'Returned', 'Overdue'],
    default: 'Issued',
    index: true
  },
  Remarks: String,
  Issued_By: {
    type: String,
    required: true
  },
  Returned_By: String,
  Created_At: {
    type: Date,
    default: Date.now
  },
  Updated_At: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for performance
libraryBookSchema.index({ InstutionCode: 1, Status: 1 });
libraryBookSchema.index({ InstutionCode: 1, Category: 1 });
libraryBookSchema.index({ Book_Title: 'text', Author: 'text' });

libraryTransactionSchema.index({ InstutionCode: 1, Status: 1 });
libraryTransactionSchema.index({ Registration_Number: 1, Status: 1 });
libraryTransactionSchema.index({ Due_Date: 1, Status: 1 });

const LibraryBook = mongoose.model('LibraryBook', libraryBookSchema);
const LibraryTransaction = mongoose.model('LibraryTransaction', libraryTransactionSchema);

module.exports = {
  LibraryBook,
  LibraryTransaction
};

