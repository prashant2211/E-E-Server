const { response } = require('express')
const supportTicket = require('../models/supportTicket')
const { getPermissionSet } = require('./permissionAssinment');
require('dotenv').config();
const nodemailer = require('nodemailer');
const mongoErrorMessages = require('./mongoErrors.json');

// Add student to dataBase
const store = async (req, res, next) => {
    const permissionsResult = await getPermissionSet(req);
    if(permissionsResult.students.split("-").includes('W')){

      // Get the current date and time
      const currentDate = new Date();
      const date = currentDate.toLocaleDateString();  
      const time = currentDate.toLocaleTimeString(); 
      const ticketId = await generateSupportId(req.user.InstutionCode);

    let support = new supportTicket({
        Staff_Code: req.user.MemberId,
        Instution_Code: req.user.InstutionCode,
        Instution_Name: req.user.InstutionName,
        Ticket_Number : ticketId,
        Subject: req.body.Subject,
        Ticket_Type: req.body.TicketType,
        Description: req.body.Description,
        Priority: req.body.Priority,
        Date: date,
        Time: time,
        IP: ''//req.body.IP,
      
    })
    support.save()
        .then(response => {
            emailVerification(ticketId, req.user.InstutionCode, req.user.InstutionName, req.body.Subject, req.body.Description, req.body.TicketType, req.body.Priority)
            res.status(200).json({
                success: true,
                message: 'Ticket created successfully!',
                code: 200
            });
        })
        .catch(error => {
            const matchedKey = Object.keys(mongoErrorMessages).find(key => error.message.includes(key));
            const errorMessage = matchedKey ? mongoErrorMessages[matchedKey] : error.message;
            res.status(401).json({
                code: 401,
                success: true,
                message: errorMessage,
                error: errorMessage
            });
        });
    }
    else{
        res.status(403).json({
            code: 403,
            success: false,
            message: 'You do not have the necessary permissions to access this resource. Please contact your administrator'
        })
    }
}


const generateSupportId = async (instutionId) => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numeric = '0123456789';
    const charactersLength = characters.length;
    const numericLength = numeric.length;
    instutionId = `${instutionId}_`;
    for (let i = 0; i < 5; i++) {
        instutionId += `${numeric.charAt(Math.floor(Math.random() * numericLength))}`;
    }
     for (let i = 0; i < 5; i++) {
        instutionId += `${numeric.charAt(Math.floor(Math.random() * numericLength))}`;
    }
    for (let i = 0; i < 5; i++) {
        instutionId += `${numeric.charAt(Math.floor(Math.random() * numericLength))}`;
    }
     return instutionId;
};



const emailVerification = async (TicketId, InstitutionCode, InstitutionName, TicketSubject, Description, TicketType, priority) => {
  
    const util = require('util');
    const mailStructure = `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Ticket Raised Notification</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                color: #333;
                margin: 0;
                padding: 0;
            }
            .email-container {
                width: 100%;
                background-color: #f7f7f7;
                padding: 20px;
            }
            .email-content {
                background-color: #ffffff;
                padding: 20px;
                border-radius: 5px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .email-header {
                font-size: 24px;
                font-weight: bold;
                color: #007BFF;
                margin-bottom: 10px;
            }
            .email-body {
                font-size: 16px;
                line-height: 1.6;
                margin-bottom: 20px;
            }
            .email-footer {
                font-size: 14px;
                color: #888;
            }
            .ticket-details {
                background-color: #f1f1f1;
                padding: 10px;
                border-radius: 5px;
                margin-bottom: 20px;
            }
            .ticket-details p {
                margin: 5px 0;
            }
            .button {
                background-color: #007BFF;
                color: white;
                padding: 10px 20px;
                text-decoration: none;
                border-radius: 5px;
                font-weight: bold;
            }
        </style>
    </head>
    <body>
        <div class="email-container">
            <div class="email-content">
                <div class="email-header">
                    Ticket Raised for ${TicketSubject} - Ticket #${TicketId}
                </div>
    
                <div class="email-body">
                    <p>I hope this message finds you well.</p>
                    <p>We would like to inform you that a new ticket has been raised regarding the following issue:</p>
    
                    <div class="ticket-details">
                        <p><strong>Ticket ID:</strong> ${TicketId}</p>
                        <p><strong>Institution Code:</strong> ${InstitutionCode}</p>
                        <p><strong>Institution Name:</strong> ${InstitutionName}</p>
                        <p><strong>Ticket Subject:</strong> ${TicketSubject}</p>
                        <p><strong>Ticket Description:</strong> ${Description}</p>
                        <p><strong>Ticket Type:</strong> ${TicketType}</p>
                        <p><strong>Priority Level:</strong> ${priority}</p>
                    </div>
    
    
                    <p>Thank you for your support and cooperation.</p>
    

                </div>
    
               
            </div>
        </div>
    </body>
    </html>
    `;
    

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.ORGANIZATION_EMAIL,
            pass: process.env.ORGANIZATION_PASSWORD,
        },
    });

    // Promisify sendMail
    const sendMail = util.promisify(transporter.sendMail).bind(transporter);

    try {
        const emailOptions = {
            from: process.env.ORGANIZATION_EMAIL,
            to: 'admin@educationaleternity.com',
            subject: `Support Ticket - ${TicketId}`,
            html: mailStructure,
        };

        await sendMail(emailOptions); // Await email sending
        return true; // Success
    } catch (error) {
        console.error('Error sending email:', error);
        return false; // Failure
    }
};


module.exports = {
 store
}