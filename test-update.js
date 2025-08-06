const mongoose = require('mongoose');
const Lead = require('./models/Lead');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/admin_portal')
  .then(async () => {
    console.log('Connected to MongoDB');
    
    // Get a sample lead
    const sampleLead = await Lead.findOne({});
    console.log('Sample lead:', sampleLead._id, sampleLead.name);
    
    // Try to update it
    const updateResult = await Lead.findByIdAndUpdate(sampleLead._id, {
      source: 'Facebook',
      emittedAt: new Date()
    });
    
    console.log('Update result:', updateResult);
    
    // Check if it was updated
    const updatedLead = await Lead.findById(sampleLead._id);
    console.log('Updated lead:', updatedLead.emittedAt);
    
    // Count emitted leads
    const emittedCount = await Lead.countDocuments({ emittedAt: { $exists: true, $ne: null } });
    console.log('Emitted leads count:', emittedCount);
    
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  }); 