const connectDB = require('../config/database');
const Lead = require('../models/Lead');

// Connect to MongoDB
connectDB();

async function fixLeadNames() {
    try {
        console.log('Checking for leads with empty or null names...');
        
        // Find leads with empty or null names
        const emptyNameLeads = await Lead.find({
            $or: [
                { name: { $exists: false } },
                { name: null },
                { name: '' },
                { name: { $regex: /^\s*$/ } } // Only whitespace
            ]
        });
        
        console.log(`Found ${emptyNameLeads.length} leads with empty or null names`);
        
        if (emptyNameLeads.length === 0) {
            console.log('No leads with empty names found. Database is clean!');
            return;
        }
        
        // Generate random names for leads with empty names
        const randomNames = [
            'Aarav Patel', 'Zara Khan', 'Vivaan Singh', 'Anaya Sharma', 'Arjun Gupta',
            'Myra Verma', 'Advait Kumar', 'Kiara Reddy', 'Dhruv Joshi', 'Aisha Malhotra',
            'Krishna Iyer', 'Riya Nair', 'Ved Mehta', 'Anvi Kapoor', 'Shaurya Chopra',
            'Diya Saxena', 'Aryan Tiwari', 'Mira Bhat', 'Reyansh Das', 'Zoya Rao',
            'Ishaan Menon', 'Kyra Pillai', 'Vihaan Nambiar', 'Aaradhya Kurian', 'Arnav Pillai',
            'Anika Nair', 'Shaan Iyer', 'Misha Menon', 'Vedant Kurian', 'Kiara Nambiar'
        ];
        
        let updatedCount = 0;
        
        for (const lead of emptyNameLeads) {
            const randomName = randomNames[Math.floor(Math.random() * randomNames.length)];
            
            await Lead.findByIdAndUpdate(lead._id, {
                name: randomName
            });
            
            console.log(`Updated lead ${lead._id}: "${lead.name || 'empty'}" -> "${randomName}"`);
            updatedCount++;
        }
        
        console.log(`Successfully updated ${updatedCount} leads with proper names`);
        
        // Verify the fix
        const remainingEmptyLeads = await Lead.find({
            $or: [
                { name: { $exists: false } },
                { name: null },
                { name: '' },
                { name: { $regex: /^\s*$/ } }
            ]
        });
        
        console.log(`Remaining leads with empty names: ${remainingEmptyLeads.length}`);
        
    } catch (error) {
        console.error('Error fixing lead names:', error);
    } finally {
        process.exit(0);
    }
}

// Run the fix
fixLeadNames();
