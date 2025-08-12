const connectDB = require('../config/database');
const Lead = require('../models/Lead');

// Connect to MongoDB
connectDB();

async function checkShortNames() {
    try {
        console.log('Checking for leads with very short names...');
        
        // Find leads with very short names (less than 3 characters after trimming)
        const shortNameLeads = await Lead.find({}).then(leads => {
            return leads.filter(lead => {
                const trimmedName = lead.name ? lead.name.trim() : '';
                return trimmedName.length < 3;
            });
        });
        
        console.log(`Found ${shortNameLeads.length} leads with very short names:`);
        
        shortNameLeads.forEach((lead, index) => {
            console.log(`${index + 1}. Original: "${lead.name}" | Trimmed: "${lead.name.trim()}" | Length: ${lead.name.trim().length}`);
        });
        
        // Check for leads with only spaces or special characters
        const spaceOnlyLeads = await Lead.find({
            name: { $regex: /^\s*$/ }
        });
        
        console.log(`\nFound ${spaceOnlyLeads.length} leads with only spaces:`);
        spaceOnlyLeads.forEach((lead, index) => {
            console.log(`${index + 1}. "${lead.name}" (length: ${lead.name.length})`);
        });
        
        // Check for leads with single characters
        const singleCharLeads = await Lead.find({
            name: { $regex: /^\s*[a-zA-Z]\s*$/ }
        });
        
        console.log(`\nFound ${singleCharLeads.length} leads with single characters:`);
        singleCharLeads.forEach((lead, index) => {
            console.log(`${index + 1}. "${lead.name}"`);
        });
        
    } catch (error) {
        console.error('Error checking short names:', error);
    } finally {
        process.exit(0);
    }
}

// Run the check
checkShortNames();
