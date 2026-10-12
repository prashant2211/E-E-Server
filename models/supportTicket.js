const mongoose = require('mongoose');
const Schema = mongoose.Schema;


const supportTicketSchema = new Schema({
   Staff_Code: {
       type: String,
       required: false
   },
   Instution_Code: {
       type: String,
       required: true
   },
   Instution_Name: {
    type: String,
    required: true
    },
    Ticket_Number: {
        type: String,
        required: false,
        unique: true
    },
   Subject: {
       type: String,
       required: true
   },
   Ticket_Type: {
       type: String,
       required: false,
      
   },
   Priority: {
    type: String,
    required: false,
   
    },
   Description: {
       type: String,
       required: true
   },
   Date: {
       type: [String],
       required: true
   },
   Time: {
       type: String,
       required: true
   },
   IP: {
    type: String
},
   
  
}, { timestamps: true });

//supportTicketSchema.index({ Staff_Code: 1, Contact_Number: 1, Email: 1}, { unique: true });

const Teacher = mongoose.model('SupportTickets', supportTicketSchema);


module.exports = Teacher;