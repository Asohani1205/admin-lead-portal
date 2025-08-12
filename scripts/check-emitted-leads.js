const connectDB = require('../config/database');
const Lead = require('../models/Lead');

// Connect to MongoDB
connectDB();

async function checkEmittedLeads() {
    try {
        console.log('Checking recently emitted leads...');
        
        // Get leads that have been emitted (have emittedAt timestamp)
        const emittedLeads = await Lead.find({ 
            emittedAt: { $exists: true } 
        }).sort({ emittedAt: -1 }).limit(10);
        
        console.log(`Found ${emittedLeads.length} recently emitted leads:`);
        console.log('='.repeat(80));
        
        emittedLeads.forEach((lead, index) => {
            console.log(`${index + 1}. ID: ${lead._id}`);
            console.log(`   Name: "${lead.name}" (length: ${lead.name ? lead.name.length : 0})`);
            console.log(`   Mobile: "${lead.mobile}"`);
            console.log(`   Source: "${lead.source}"`);
            console.log(`   Emitted At: ${lead.emittedAt}`);
            console.log(`   Name check: ${lead.name ? 'Has name' : 'No name'}`);
            console.log(`   Trimmed name: "${lead.name ? lead.name.trim() : ''}"`);
            console.log('   ' + '-'.repeat(40));
        });
        
        // Check if any emitted leads have problematic names
        const problematicEmitted = emittedLeads.filter(lead => {
            const trimmedName = lead.name ? lead.name.trim() : '';
            return trimmedName.length < 3 || !trimmedName;
        });
        
        if (problematicEmitted.length > 0) {
            console.log(`\nFound ${problematicEmitted.length} emitted leads with problematic names:`);
            problematicEmitted.forEach((lead, index) => {
                console.log(`${index + 1}. "${lead.name}" (emitted: ${lead.emittedAt})`);
            });
        } else {
            console.log('\nAll emitted leads have proper names.');
        }
        
    } catch (error) {
        console.error('Error checking emitted leads:', error);
    } finally {
        process.exit(0);
    }
}

// Run the check
checkEmittedLeads();
