const mongoose      = require('mongoose')
const { type } = require('os')

const Schema        = mongoose.Schema

const facultyChatSchema = new Schema({

    InstutionId:{
        type: String
    },
    StudentId:{
        type: String
    },
    Chat : {
        type: Array,
    },
},
{timestamps:true}
)

const facultyChatModel = mongoose.model('FacultyChat',facultyChatSchema)

module.exports = facultyChatModel; 