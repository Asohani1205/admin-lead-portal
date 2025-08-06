const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        default: ''
    },
    mobile: {
        type: String,
        required: true,
        default: ''
    },
    address: {
        type: String,
        required: true,
        default: ''
    },
    city: {
        type: String,
        required: true,
        default: 'Indore'
    },
    source: {
        type: String,
        required: true,
        enum: ['Facebook', 'Instagram', 'LinkedIn', 'Google', 'Website'],
        default: 'Website'
    },
    status: {
        type: String,
        required: true,
        enum: ['New', 'Contacted', 'Qualified', 'Lost', 'Converted'],
        default: 'New'
    },
    priority: {
        type: String,
        required: true,
        enum: ['High', 'Medium', 'Low'],
        default: 'Medium'
    },
    price: {
        type: Number,
        required: true,
        default: 0
    },
    propertyType: {
        type: String,
        required: true,
        enum: ['Apartment', 'Villa', 'Plot', 'Independent House', 'Commercial'],
        default: 'Apartment'
    },
    locality: {
        type: String,
        required: true,
        default: 'Vijay Nagar'
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    emittedAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true,
    toJSON: {
        transform: function(doc, ret) {
            // Remove any undefined values
            Object.keys(ret).forEach(key => {
                if (ret[key] === undefined) {
                    ret[key] = '';
                }
            });
            return ret;
        }
    }
});

module.exports = mongoose.model('Lead', leadSchema); 