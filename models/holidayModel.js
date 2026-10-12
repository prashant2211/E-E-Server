const mongoose      = require('mongoose')
const { type } = require('os')

const Schema        = mongoose.Schema

const holoidaySchema = new Schema({

    InstutionId:{
        type: String
    },
    Holidays : {
        type: Array,
    },
},
{timestamps:true}
)

const holidaysModel = mongoose.model('Holidays',holoidaySchema)

module.exports = holidaysModel; 