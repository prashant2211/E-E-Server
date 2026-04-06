const { response } = require('express')
const salaryPaymentModel = require('../models/staffSalaryPaymentDetails')
const salaryModel = require('../models/StaffSalaryDetails')


// Get salary details
const salDetails = async (empId) => {
    
    try {
        const data = await salaryModel.findOne({ Staff_Code: empId });
        if (data) {
            return data;  // Return the found data
        } else {
            return null;  // Return null if no data is found
        }
    } catch (error) {
        console.error('Error fetching salary details:', error);
        throw new Error('Error fetching salary details');
    }
};


// Add payment details
const store = async (req, res, next) => {
    try {
        console.log('inside store');

        let gettingSalary = req.body.monthly_salary;
        const salaryData = await salDetails(req.body.employee_code);

        if (!salaryData) {
            return res.status(404).json({
                success: false,
                message: 'Salary details not found for the given employee code',
                code: 404
            });
        }

        let pendingAmount = (Number(salaryData.Monthly_Salary) - Number(req.body.paid_amount)) + Number(salaryData.Pending_Amount);
        console.log('pendingAmount = ', pendingAmount);

        // Create new salary payment record
        let salaryDetails = new salaryPaymentModel({
            Employee_Code: req.body.employee_code,
            Instution_Code: req.body.instution_code,
            Instution_Name: req.body.instution_name,
            Employee_Name: salaryData.Staff_Name,
            Month: req.body.month,
            Monthly_Salary: salaryData.Monthly_Salary,
            Total_Pending_Amount: Number(pendingAmount),
            Paid_Amount: req.body.paid_amount,
            Payment_Status: req.body.payment_status,
            Payment_Date: req.body.payment_date,
            Payment_Mode: req.body.payment_mode,
        });

        // Save salary details
        await salaryDetails.save();

        // Update pending amount after inserting salary details
        await updatePaymentDetails(pendingAmount, salaryData._id);

        res.json({
            success: true,
            message: 'Salary Details added and updated successfully!',
            code: 200
        });
    } catch (error) {
        console.error('Error in store:', error);
        res.status(500).json({ message: `Error: ${error.message}` });
    }
}

// Update payment details
const updatePaymentDetails = async (pendingAmount, empCode) => {
    try {
        let salaryDetails = { 
            Pending_Amount: pendingAmount
        };
        console.log('Updating record with empCode:', empCode);

        // Ensure the update operation is awaited
        await salaryModel.findByIdAndUpdate(empCode, { $set: salaryDetails });

        console.log('Pending amount updated successfully.');
    } catch (error) {
        console.error('Error updating payment details:', error);
        throw new Error('Failed to update payment details');
    }
}


module.exports = {
     store
}