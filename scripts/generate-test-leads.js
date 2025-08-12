const connectDB = require('../config/database');
const Lead = require('../models/Lead');

// Connect to MongoDB
connectDB();

async function generateTestLeads() {
    try {
        console.log('Generating test leads with proper names...');
        
        const testNames = [
            'Aarav Patel', 'Zara Khan', 'Vivaan Singh', 'Anaya Sharma', 'Arjun Gupta',
            'Myra Verma', 'Advait Kumar', 'Kiara Reddy', 'Dhruv Joshi', 'Aisha Malhotra',
            'Krishna Iyer', 'Riya Nair', 'Ved Mehta', 'Anvi Kapoor', 'Shaurya Chopra',
            'Diya Saxena', 'Aryan Tiwari', 'Mira Bhat', 'Reyansh Das', 'Zoya Rao',
            'Ishaan Menon', 'Kyra Pillai', 'Vihaan Nambiar', 'Aaradhya Kurian', 'Arnav Pillai',
            'Anika Nair', 'Shaan Iyer', 'Misha Menon', 'Vedant Kurian', 'Kiara Nambiar'
        ];
        
        const testLeads = [];
        
        for (let i = 0; i < 10; i++) {
            const randomName = testNames[Math.floor(Math.random() * testNames.length)];
            const randomMobile = `9${Math.floor(Math.random() * 9000000000) + 1000000000}`;
            
            const testLead = new Lead({
                name: randomName,
                mobile: randomMobile,
                address: `${Math.floor(Math.random() * 999) + 1}, Test Street, Indore, Madhya Pradesh`,
                city: 'Indore',
                source: ['Facebook', 'Instagram', 'LinkedIn', 'Google', 'Website'][Math.floor(Math.random() * 5)],
                status: 'New',
                priority: 'Medium',
                price: Math.floor(Math.random() * 5000000) + 1000000,
                propertyType: 'Apartment',
                locality: 'Vijay Nagar',
                timestamp: new Date()
            });
            
            testLeads.push(testLead);
        }
        
        // Save all test leads
        const savedLeads = await Lead.insertMany(testLeads);
        
        console.log(`Successfully created ${savedLeads.length} test leads:`);
        savedLeads.forEach((lead, index) => {
            console.log(`${index + 1}. ${lead.name} - ${lead.mobile} - ${lead.source}`);
        });
        
        console.log('\nTest leads are ready for emission!');
        
    } catch (error) {
        console.error('Error generating test leads:', error);
    } finally {
        process.exit(0);
    }
}

// Run the generation
generateTestLeads();
