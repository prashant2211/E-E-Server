const tcModel           = require('../models/transferCertificateModel');


const store = async (req, res, next) => {
    try {
        // Fetch permissions and check if the user has the necessary permissions
        // const permissionsResult = await getPermissionSet(req);
       /* if (!permissionsResult.teachers.split("-").includes('W')) {
            return res.json({
                code: 401,
                success: false,
                message: 'You do not have the necessary permissions to access this resource. Please contact your administrator'
            });
        }*/
       
      
        // Create the tcModel object
        const tc = new tcModel({
            SchoolCode: req.body.SchoolCode,
            RegistrationNumber: req.body.RegistrationNumber,
            InstutionId: req.user.InstutionCode,
            TCNumber: req.body.TCNumber,
            StudentName: req.body.StudentName,
            FatherName: req.body.FatherName,
            MotherName: req.body.MotherName,
            DOB : req.body.DOB, 
            Nationality: req.body.Nationality, 
            Religions: req.body.Religions,
            Category: req.body.Category,
            lastStudyClass: req.body.LastStudyClass,
            PromotedToNextClass: req.body.PromotedToNextClass,
            DateOfAdmission: req.body.DateOfAdmission, 
            DateofLeaving: req.body.DateofLeaving,
            Reason: req.body.Reason,
            WorkingDays:req.body.WorkingDays, 
            AttendentDays: req.body.AttendentDays,
            Conduct: req.body.Conduct,
            CoCaricularActivity: req.body.CoCaricularActivity,
            Achievement: req.body.Achievement, 
            Remarks: req.body.Remarks

        });

        // Save the teacher object
        await tc.save();
      
  


       /////////////////////////////////////////////////

        // Send the verification email
        // const url = 'www.educationaleternity.com';
        // const fullName = `${req.body.First_Name} ${req.body.Last_Name}`;
       // await emailVerification(req.body.Email, fullName, req.user.InstutionName, req.body.Email, req.body.Password, url);

        // Respond with success
        return res.status(201).json({
            success: true,
            message: 'TC added successfully!',
            code: 201
        });
    } catch (error) {
        // Handle any errors that occur during the process
        return res.status(500).json({
            success: false,
            message: `Error: ${error.message || error}`,
            code: 500
        });
    }
};


module.exports = {
    store
  }