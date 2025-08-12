const connectDB = require('../config/database');
const Lead = require('../models/Lead');

// Connect to MongoDB
connectDB();

async function checkLeadNames() {
    try {
        console.log('Checking all lead names in database...');
        
        // Get all leads
        const allLeads = await Lead.find({}).limit(20);
        
        console.log(`Found ${allLeads.length} leads (showing first 20):`);
        console.log('='.repeat(80));
        
        allLeads.forEach((lead, index) => {
            console.log(`${index + 1}. ID: ${lead._id}`);
            console.log(`   Name: "${lead.name}" (length: ${lead.name ? lead.name.length : 0})`);
            console.log(`   Mobile: "${lead.mobile}"`);
            console.log(`   Source: "${lead.source}"`);
            console.log(`   Emitted: ${lead.emittedAt ? 'Yes' : 'No'}`);
            console.log('   ' + '-'.repeat(40));
        });
        
        // Check for leads with problematic names
        const problematicLeads = await Lead.find({
            $or: [
                { name: { $regex: /^\s*$/ } }, // Only whitespace
                { name: { $regex: /^unknown/i } }, // Contains "unknown"
                { name: { $regex: /^test/i } }, // Contains "test"
                { name: { $lt: 2 } } // Very short names
            ]
        });
        
        if (problematicLeads.length > 0) {
            console.log(`\nFound ${problematicLeads.length} leads with potentially problematic names:`);
            problematicLeads.forEach((lead, index) => {
                console.log(`${index + 1}. "${lead.name}" (ID: ${lead._id})`);
            });
        } else {
            console.log('\nNo leads with problematic names found.');
        }
        
        // Check total count
        const totalLeads = await Lead.countDocuments({});
        console.log(`\nTotal leads in database: ${totalLeads}`);
        
    } catch (error) {
        console.error('Error checking lead names:', error);
    } finally {
        process.exit(0);
    }
}

// Run the check
checkLeadNames();
