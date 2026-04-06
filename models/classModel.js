const mongoose      = require('mongoose')
const { type } = require('os')

const Schema        = mongoose.Schema

const classSchema = new Schema({
    ClassCode:{
        type: String,
        unique: true,
    },
    InstutionCode:{
        type: String,
        required: true,
    },
     Session:{
        type: String,
        required: true
    },
    Number_Of_Student : {
        type: Number
    },
    ClassName : {
        type: String,
        required: true
    },
    Session_Start_Day: {
        type: Date
    },
    Session_End_Day: {
        type: Date
    },
    Subject_List_Teacher_Code: {
        type: [{
            Subject: {
                type: String,
                required: false
            },
            Teacher_Code: {
                type: String,
                default: ''
            },
            Teacher_Name: {
                type: String,
                default: ''
            },
            Teacher_Id: {
                type: Schema.Types.ObjectId,
                ref: 'Teacher',
                default: null
            }
        }],
        default: [],
        required: false
    }
},
{timestamps:true}
)

// ClassCode is unique globally - format: INST-CODE-CLASSNAME-YY
// Only duplicate if entire ClassCode matches exactly
// Note: The unique: true on the field definition above also creates an index
// This explicit index ensures it's properly created
// classSchema.index({ ClassCode: 1 }, { unique: true, name: 'ClassCode_unique_index' });

const Class = mongoose.model('Class',classSchema)

module.exports = Class; 