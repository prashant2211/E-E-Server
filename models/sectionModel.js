const mongoose      = require('mongoose')
const { type } = require('os')

const Schema        = mongoose.Schema

const sectionSchema = new Schema({
    ClassCode:{
        type: String,
        required: true
    },
     InstutionCode:{
        type: String,
        required: true
    },
    SectionCode:{
        type: String,
        required: true,
        unique: true,
    },
    NumberOfStudent : {
        type: Number,
        require : true
    },
    SectionName : {
        type: String,
        required: true
    },
     SessionTeacherName : {
        type: String,
        required: true
    },
    
},
{timestamps:true}
)
//classSchema.index({ Class_Code: 1}, { unique: true });

const Section = mongoose.model('Section',sectionSchema)

module.exports = Section; 