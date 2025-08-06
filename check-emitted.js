const mongoose = require('mongoose');
const Lead = require('./models/Lead');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/admin_portal')
  .then(async () => {
    const emittedLeads = await Lead.countDocuments({ emittedAt: { $exists: true, $ne: null } });
    console.log('Emitted leads today:', emittedLeads);
    
    const totalLeads = await Lead.countDocuments({});
    console.log('Total leads in database:', totalLeads);
    
    const sampleLead = await Lead.findOne({});
    console.log('Sample lead:', sampleLead ? sampleLead.name : 'No leads found');
    
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  }); 