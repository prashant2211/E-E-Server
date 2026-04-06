const { response } = require('express')
const salaryModel = require('../models/StaffSalaryDetails')


// Add payment details
const store = (req, res, next) => {
    const payable = ['pf_Amount','pf_Employer','insurance','children_education_allowance',
                     'leave_travel_allowance','Basic','HRA','other_Allowance','bonus',
                     'professional_Tax','TDS','income_Tax','salary_Arrears',
                     'special_Allowance','variable_pay'];
    const earning = ['Basic','HRA','special_Allowance','leave_travel_allowance','other_Allowance',
                     'children_education_allowance','bonus'];
    const deduction = ['pf_Amount','professional_Tax','insurance','TDS','income_Tax'];

    let grossEarning = 0;
    let grossdeduction = 0;
    let ctc = 0;


    Object.entries(req.body).forEach(([key, value]) => {
        if (payable.includes(key)) {
            if (earning.includes(key)) {
                grossEarning = grossEarning + value;
            }
            if (deduction.includes(key)) {
                grossdeduction = grossdeduction + value;
            }
          //  console.log(`'pf_Amount' is present in the payable array.`);
          }

       // console.log(`${key}: ${value}`);
    });

  if(req.body.ctc == 0){
    ctc = grossEarning +grossdeduction;
  }else{
    ctc = req.body.ctc;
  }
  console.log(`ctc -=-  ${ctc}`);
  grossEarning = grossEarning/12;
  grossdeduction = grossdeduction/12;
    console.log(`grossEarning = ${grossEarning}`);
    console.log(`grossdeduction = ${grossdeduction}`);
    
        let salaryDetails = new salaryModel({
            Staff_Code                   : req.body.staff_code.trim(),
            Staff_Name                   : req.body.employee_name,
            Designation                  : req.body.Designation,
            DOJ                          : req.body.DOJ,
            Bank_Name                    : req.body.Bank_Name,
            Account_Number               : req.body.account_number,
            IFSC_Code                    : req.body.IFSC_code,
            Branch_Name                  : req.body.branch_name,
            Pan_Number                   : req.body.pan_number,
            PF_UAN                       : req.body.pf_UAN,
            PF_Number                    : req.body.pf_Number,
            PF_Amount                    : req.body.pf_Amount,
            PF_Employer                  : req.body.pf_Employer,
            Insurance                    : req.body.insurance,
            Children_Education_Allowance : req.body.children_education_allowance,
            Leave_Travel_Allowance       : req.body.leave_travel_allowance,
            LOP_Days                     : req.body.LOP_Days,
            Total_Working_Days           : req.body.total_Working_Days,
            Basic                        : req.body.Basic,
            HRA                          : req.body.HRA,
            Other_Allowance              : req.body.other_Allowance,
            Bonus                        : req.body.bonus,
            Professional_Tax             : req.body.professional_Tax,
            TDS                          : req.body.TDS,
            Income_Tax                   : req.body.income_Tax,
            Salary_Arrears               : req.body.salary_Arrears,
            Special_Allowance            : req.body.special_Allowance,
            Variable_Pay                 : req.body.variable_pay,
            CTC                          : ctc,
            Gross_Earning                : grossEarning,  // Monthly
            Gross_Deduction              : grossdeduction,   // Monthly
            Pending_Amount               : req.body.pending_amount
        })
        salaryDetails.save()
            .then(response => {
                res.json({
                    success: true,
                    message: 'Salary Details added Successfully!',
                    code: 200
                });
            })
            .catch(error => {
                if (error.code === 11000) {
                    res.json({
                        success: false,
                        message: 'Duplicate record found!',
                        code: 409
                    });
                }else{
                    res.json({
                        success: false,
                        message: `${error}`,
                        code: 500
                    });
                }
                
            });
    }



// Get payment Record

const show = (req, res, next) => {
    let empId = req.query.staff_code;
    salaryModel.findOne({ Staff_code: empId })  // Use findOne to query by staff_code
        .then(data => {
            if (data) {
                res.json({
                    success: true,
                    message: "Data retrieved successfully",
                    code: 200,
                    data: data
                });
            } else {
                res.json({
                    success: false,
                    message: "No data found",
                    code: 404
                });
            }
        })
        .catch(error => {
            res.json({
                message: `${error}`,
                status: 500
            });
        });
};




    module.exports = {
         show, store
    }