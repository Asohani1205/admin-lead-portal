const io = require('socket.io-client');

// Connect to the server
const socket = io('http://localhost:3000');

let leadCount = 0;
let startTime = Date.now();

console.log('Testing lead emission rate...');
console.log('Target: 800 leads per day (~33 leads per hour)');
console.log('Starting timer...\n');

// Listen for new leads
socket.on('newLead', (lead) => {
    leadCount++;
    const elapsedMinutes = (Date.now() - startTime) / 60000;
    const rate = leadCount / elapsedMinutes;
    
    console.log(`Lead #${leadCount}: ${lead.name} from ${lead.source}`);
    console.log(`Current rate: ${rate.toFixed(2)} leads per minute`);
    console.log(`Elapsed time: ${elapsedMinutes.toFixed(2)} minutes`);
    console.log('---');
    
    // Stop after 5 minutes
    if (elapsedMinutes >= 5) {
        console.log(`\nTest completed!`);
        console.log(`Total leads received: ${leadCount}`);
        console.log(`Average rate: ${(leadCount / elapsedMinutes).toFixed(2)} leads per minute`);
        console.log(`Projected daily rate: ${(leadCount / elapsedMinutes * 1440).toFixed(0)} leads per day`);
        console.log(`Target rate: 800 leads per day`);
        process.exit(0);
    }
});

// Handle connection
socket.on('connect', () => {
    console.log('Connected to server');
});

// Handle disconnection
socket.on('disconnect', () => {
    console.log('Disconnected from server');
});

// Handle errors
socket.on('error', (error) => {
    console.error('Socket error:', error);
}); 