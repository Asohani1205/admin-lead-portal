const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  cors: {
    origin: [
      "http://localhost:8080",
      "https://endlessportal.netlify.app",
      "http://localhost:3000",
      "https://admin-lead-portal-production-7382.up.railway.app",
      "https://admin-lead-portal.railway.app",
      "*" // Allow all origins for development
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
  }
});
const moment = require('moment');
const connectDB = require('./config/database');
const Lead = require('./models/Lead');
const cors = require('cors');
const ExcelJS = require('exceljs');
require('dotenv').config();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors({
  origin: [
    "http://localhost:8080",
    "https://endlessportal.netlify.app",
    "http://localhost:3000",
    "https://admin-lead-portal-production-7382.up.railway.app",
    "https://admin-lead-portal.railway.app",
    "*" // Allow all origins for development
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.static('public'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// Connection status endpoint
app.get('/api/connection-status', (req, res) => {
  res.json({
    status: 'connected',
    serverTime: new Date().toISOString(),
    isFetching,
    isFetchingGloballyDisabled,
    dailyLeadCount,
    maxDailyLeads: MAX_DAILY_LEADS,
    leadsDataLength: leadsData.length,
    totalLeadsInDB
  });
});

// Store leads data and stats
let leadsData = [];
let currentLeadIndex = 0;
let activeLeads = [];

// Add fetching toggle
let isFetching = false;

// Add global fetching disable flag
let isFetchingGloballyDisabled = false;

// Add serialized lead tracking
let serializedLeadIndex = 0;
let totalLeadsInDB = 0;

// Daily lead tracking
let dailyLeadCount = 0;
let lastResetDate = new Date().toDateString();
const MAX_DAILY_LEADS = 100; // Increased for faster testing

// Lead emission configuration
const LEAD_EMISSION_CONFIG = {
  minIntervalSeconds: 300,      // Minimum time between leads (5 minutes)
  maxIntervalSeconds: 600,      // Maximum time between leads (10 minutes)
  slowModeOnly: false,          // Disable slow mode for faster emission
  workingHoursOnly: false,      // Disable working hours restriction for testing
  randomizeSources: true,       // Randomly assign sources
  avoidDuplicates: false        // Whether to avoid emitting the same lead twice
};

let stats = {
  dailyLeadsCount: 0,
  yesterdayLeadsCount: 35,
  activeCrawlers: 12,
  highPriorityCrawlers: 4,
  conversionRate: 8.7,
  lastMonthConversionRate: 6.6,
  totalDataPoints: 152000,
  dailyDataPoints: 0,
  newLeadsToday: 0,
  dataPointsCollected: 0
};

const WORK_START_HOUR = 11; // 11 AM
const WORK_END_HOUR = 23; // 11 PM

// Add this at the top of the file, after the imports
let sourceIndex = 0;
const sources = [
    'Facebook',
    'Instagram',
    'LinkedIn',
    'Website',
    'Google'
];

// Function to load initial leads
async function loadInitialLeads() {
  try {
    console.log('Initializing lead generation system...');
    leadsData = await Lead.find({}).sort({ timestamp: -1 });
    totalLeadsInDB = leadsData.length;
    serializedLeadIndex = 0;
    
    // If no leads exist, create some sample leads
    if (leadsData.length === 0) {
      console.log('No leads found in database. Creating sample leads...');
      const sampleLeads = [
        {
          name: 'Rahul Sharma',
          mobile: '9876543210',
          address: '123 MG Road, Indore',
          city: 'Indore',
          source: 'Facebook',
          status: 'New',
          priority: 'High',
          price: 2500000,
          propertyType: 'Apartment',
          locality: 'Vijay Nagar',
          timestamp: new Date()
        },
        {
          name: 'Priya Patel',
          mobile: '8765432109',
          address: '456 AB Road, Indore',
          city: 'Indore',
          source: 'Instagram',
          status: 'New',
          priority: 'Medium',
          price: 1800000,
          propertyType: 'Villa',
          locality: 'Palasia',
          timestamp: new Date()
        },
        {
          name: 'Amit Kumar',
          mobile: '7654321098',
          address: '789 Rajendra Nagar, Indore',
          city: 'Indore',
          source: 'Website',
          status: 'New',
          priority: 'Low',
          price: 1200000,
          propertyType: 'Plot',
          locality: 'Rajendra Nagar',
          timestamp: new Date()
        }
      ];
      
      for (const leadData of sampleLeads) {
        const newLead = new Lead(leadData);
        await newLead.save();
      }
      
      // Reload leads after creating samples
      leadsData = await Lead.find({}).sort({ timestamp: -1 });
      totalLeadsInDB = leadsData.length;
      console.log(`Created ${sampleLeads.length} sample leads. Total leads now: ${totalLeadsInDB}`);
    }
    
    console.log(`System ready with ${leadsData.length} potential leads for serialized emission`);
    return true;
  } catch (error) {
    console.error('Error initializing system:', error.message);
    return false;
  }
}

// Function to calculate random interval for lead emission
function calculateLeadEmissionInterval() {
  // Calculate remaining leads to emit
  const remainingLeads = leadsData.length - dailyLeadCount;
  const maxLeadsToEmit = Math.min(remainingLeads, MAX_DAILY_LEADS - dailyLeadCount);
  
  if (maxLeadsToEmit <= 0) {
    console.log('No more leads to emit today');
    return 3600000; // 1 hour default
  }
  
  // Calculate optimal interval to spread leads over 24 hours (86400 seconds)
  const totalSecondsInDay = 86400; // 24 hours
  const optimalIntervalSeconds = Math.floor(totalSecondsInDay / maxLeadsToEmit);
  
  // Use fixed intervals between 5-10 minutes for realistic testing
  const minInterval = 300; // Minimum 5 minutes (300 seconds)
  const maxInterval = 600; // Maximum 10 minutes (600 seconds)
  
  const finalInterval = Math.floor(Math.random() * (maxInterval - minInterval + 1) + minInterval) * 1000;
  
  console.log(`Remaining leads to emit: ${maxLeadsToEmit}`);
  console.log(`Optimal interval for 24-hour spread: ${optimalIntervalSeconds} seconds`);
  console.log(`Randomized interval: ${Math.round(finalInterval / 1000)} seconds (${Math.round(finalInterval / 1000 / 60)} minutes)`);
  
  return finalInterval;
}

// Function to check if current time is within working hours
function isWithinWorkingHours() {
  const now = new Date();
  // Get current hour in India timezone
  const indiaTime = now.toLocaleString('en-US', { 
    timeZone: 'Asia/Kolkata',
    hour12: false 
  });
  const currentHour = parseInt(indiaTime.split(',')[1].trim().split(':')[0]);
  console.log(`Current time (India): ${indiaTime}, Current hour: ${currentHour}, Working hours: ${WORK_START_HOUR}:00 - ${WORK_END_HOUR}:00`);
  return currentHour >= WORK_START_HOUR && currentHour < WORK_END_HOUR;
}

// Function to reset daily lead count if it's a new day
function resetDailyCountIfNewDay() {
  const today = new Date().toDateString();
  if (today !== lastResetDate) {
    dailyLeadCount = 0;
    lastResetDate = today;
    console.log(`New day detected. Daily lead count reset to 0.`);
  }
}

// Function to emit a new lead
async function emitNewLead() {
  try {
    // Reset daily count if it's a new day
    resetDailyCountIfNewDay();
    
    // Check if we're within working hours (if configured)
    if (LEAD_EMISSION_CONFIG.workingHoursOnly && !isWithinWorkingHours()) {
      console.log(`Outside working hours (${WORK_START_HOUR}:00 - ${WORK_END_HOUR}:00). No leads will be emitted.`);
      return;
    }
    
    // Check if we've reached the daily limit
    if (dailyLeadCount >= MAX_DAILY_LEADS) {
      console.log(`Daily lead limit reached (${MAX_DAILY_LEADS}). No more leads today.`);
      return;
    }
    
          // Check if we have leads in memory
      if (leadsData.length > 0) {
        // Filter out leads that have already been emitted today
        const availableLeads = leadsData.filter(lead => !lead.emittedAt || 
          new Date(lead.emittedAt).toDateString() !== new Date().toDateString());
        
        if (availableLeads.length === 0) {
          console.log('All leads have been emitted today. Resetting for tomorrow...');
          // Reset emittedAt for all leads to allow re-emission tomorrow
          await Lead.updateMany({}, { $unset: { emittedAt: 1 } });
          leadsData = await Lead.find({}).sort({ timestamp: -1 });
          return;
        }
        
        // Randomly select a lead from available leads
        const randomIndex = Math.floor(Math.random() * availableLeads.length);
        const lead = availableLeads[randomIndex]; // Get the original lead object
        
        // Create a copy for emission
        const leadForEmission = { ...lead };
        
        // Randomly select a source (if configured)
        if (LEAD_EMISSION_CONFIG.randomizeSources) {
          const randomSourceIndex = Math.floor(Math.random() * sources.length);
          leadForEmission.source = sources[randomSourceIndex];
        }
        
        // Increment daily count
        dailyLeadCount++;
        
        // Update the lead in database with emitted timestamp and source
        console.log('Updating lead in database:', lead._id, 'with source:', leadForEmission.source);
        const updateResult = await Lead.findByIdAndUpdate(lead._id, {
          source: leadForEmission.source,
          emittedAt: new Date()
        });
        console.log('Database update result:', updateResult);
      
        // Emit the lead to all connected clients
        console.log('Emitting lead to clients:', leadForEmission);
        io.emit('newLead', leadForEmission);
        console.log(`Emitted lead ${dailyLeadCount}/${MAX_DAILY_LEADS} (Available: ${availableLeads.length}):`, lead.name, 'from source:', leadForEmission.source);
      
        // Update the lead in memory with emittedAt
        const leadIndex = leadsData.findIndex(l => l._id.toString() === lead._id.toString());
        if (leadIndex !== -1) {
          leadsData[leadIndex].emittedAt = new Date();
          leadsData[leadIndex].source = leadForEmission.source;
        }
    } else {
      console.log('No leads found in database');
    }
  } catch (error) {
    console.error('Error emitting new lead:', error);
  }
}

// Function to update stats
async function updateStats(socket, newLead) {
  stats.dailyLeadsCount++;
  stats.dailyDataPoints += Math.floor(Math.random() * 10) + 5;
  
  if (Math.random() > 0.8) {
    stats.conversionRate += (Math.random() * 0.2 - 0.1);
    stats.conversionRate = parseFloat(stats.conversionRate.toFixed(1));
  }

  if (Math.random() > 0.9) {
    const change = Math.floor(Math.random() * 3) - 1;
    stats.activeCrawlers = Math.max(8, Math.min(15, stats.activeCrawlers + change));
    stats.highPriorityCrawlers = Math.min(stats.activeCrawlers, Math.max(3, stats.highPriorityCrawlers + (Math.random() > 0.5 ? 1 : -1)));
  }

  socket.emit('updateStats', {
    dailyLeadsCount: stats.dailyLeadsCount,
    yesterdayLeadsCount: stats.yesterdayLeadsCount,
    activeCrawlers: stats.activeCrawlers,
    highPriorityCrawlers: stats.highPriorityCrawlers,
    conversionRate: stats.conversionRate,
    conversionRateChange: (stats.conversionRate - stats.lastMonthConversionRate).toFixed(1),
    totalDataPoints: (stats.totalDataPoints + stats.dailyDataPoints).toLocaleString(),
    dailyDataPoints: stats.dailyDataPoints
  });
}

// API Routes
app.get('/api/leads', async (req, res) => {
  try {
    const { page = 1, limit = 10, search, priority, source } = req.query;
    const query = {};
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { mobile: { $regex: search, $options: 'i' } },
        { address: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (priority) {
      query.priority = priority;
    }
    
    if (source) {
      query.source = source;
    }

    // Get total count and leads from MongoDB
    const total = await Lead.countDocuments(query);
    const leads = await Lead.find(query)
      .sort({ timestamp: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    res.json({
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      leads
    });
  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

// API to get recent emitted leads for activity feed
app.get('/api/recent-leads', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    
    // Get recent leads that were emitted (have emittedAt timestamp)
    // Also include leads with timestamp if emittedAt doesn't exist (fallback)
    const recentLeads = await Lead.find({
      $or: [
        { emittedAt: { $exists: true } },
        { timestamp: { $exists: true } }
      ]
    })
      .sort({ emittedAt: -1, timestamp: -1 })
      .limit(parseInt(limit));

    console.log(`Fetched ${recentLeads.length} recent leads from database`);

    res.json({
      leads: recentLeads,
      count: recentLeads.length
    });
  } catch (error) {
    console.error('Error fetching recent leads:', error);
    res.status(500).json({ error: 'Failed to fetch recent leads' });
  }
});

// Test MongoDB connection
app.get('/api/test-db', async (req, res) => {
  try {
    // Try to create a test lead
    const testLead = new Lead({
      name: 'Test Lead',
      mobile: '1234567890',
      address: 'Test Address',
      city: 'Test City',
      source: 'Website',
      status: 'New',
      priority: 'Medium',
      price: 1000000,
      propertyType: 'Apartment',
      locality: 'Test Locality'
    });
    
    await testLead.save();
    
    // Try to read the test lead
    const savedLead = await Lead.findOne({ name: 'Test Lead' });
    
    // Delete the test lead
    await Lead.deleteOne({ name: 'Test Lead' });
    
    res.json({
      status: 'success',
      message: 'MongoDB connection is working',
      testData: savedLead
    });
  } catch (error) {
    console.error('Database test failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'MongoDB connection failed',
      error: error.message
    });
  }
});

// Global lead emission loop
async function scheduledLeadEmitter() {
  try {
    if (isFetching && !isFetchingGloballyDisabled) {
      await emitNewLead();
    }
  } catch (error) {
    console.error("Error during scheduled lead emission:", error);
  } finally {
    const nextInterval = calculateLeadEmissionInterval();
    const nextIntervalSeconds = Math.round(nextInterval / 1000);
    console.log(`Next lead will be emitted in ${nextIntervalSeconds} seconds`);
    setTimeout(scheduledLeadEmitter, nextInterval);
  }
}

// Socket.IO connection handling
io.on('connection', async (socket) => {
  console.log('New client connected');
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// API to start fetching
app.post('/api/start-fetching', (req, res) => {
  try {
    if (isFetchingGloballyDisabled) {
      console.log('Fetching is globally disabled. Ignoring start request.');
      return res.status(403).json({ status: 'disabled', message: 'Fetching is globally disabled by admin.' });
    }
    isFetching = true;
    console.log('Fetching started (isFetching = true)');
    res.json({ status: 'started', message: 'Lead fetching has been started successfully' });
  } catch (error) {
    console.error('Error starting fetching:', error);
    res.status(500).json({ status: 'error', message: 'Failed to start fetching', error: error.message });
  }
});

// API to stop fetching
app.post('/api/stop-fetching', (req, res) => {
  try {
    isFetching = false;
    console.log('Fetching stopped (isFetching = false)');
    res.json({ status: 'stopped', message: 'Lead fetching has been stopped successfully' });
  } catch (error) {
    console.error('Error stopping fetching:', error);
    res.status(500).json({ status: 'error', message: 'Failed to stop fetching', error: error.message });
  }
});

// API to globally disable fetching
app.post('/api/disable-fetching', (req, res) => {
  isFetchingGloballyDisabled = true;
  isFetching = false;
  console.log('Fetching is now globally disabled by admin.');
  res.json({ status: 'globally_disabled' });
});

// API to globally enable fetching
app.post('/api/enable-fetching', (req, res) => {
  isFetchingGloballyDisabled = false;
  console.log('Fetching is now globally enabled by admin.');
  res.json({ status: 'globally_enabled' });
});

// API to download daily leads as Excel
app.get('/api/download-daily-leads', async (req, res) => {
  try {
    
    // Get today's date range
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));
    
    // Fetch today's emitted leads
    const dailyLeads = await Lead.find({
      emittedAt: {
        $gte: startOfDay,
        $lte: endOfDay
      }
    }).sort({ emittedAt: 1 });
    
    if (dailyLeads.length === 0) {
      return res.status(404).json({ error: 'No leads found for today' });
    }
    
    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Daily Leads');
    
    // Add header row
    worksheet.columns = [
      { header: 'S.No', key: 'sno', width: 10 },
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Mobile', key: 'mobile', width: 15 },
      { header: 'Address', key: 'address', width: 30 },
      { header: 'City', key: 'city', width: 15 },
      { header: 'Source', key: 'source', width: 15 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Priority', key: 'priority', width: 15 },
      { header: 'Emitted At', key: 'emittedAt', width: 20 }
    ];
    
    // Style the header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE6E6FA' }
    };
    
    // Add data rows
    dailyLeads.forEach((lead, index) => {
      worksheet.addRow({
        sno: index + 1,
        name: lead.name,
        mobile: lead.mobile,
        address: lead.address,
        city: lead.city,
        source: lead.source,
        status: lead.status,
        priority: lead.priority,
        emittedAt: moment(lead.emittedAt).format('YYYY-MM-DD HH:mm:ss')
      });
    });
    
    // Add summary row
    worksheet.addRow({});
    worksheet.addRow({
      sno: '',
      name: 'SUMMARY',
      mobile: `Total Leads: ${dailyLeads.length}`,
      address: `Date: ${moment().format('YYYY-MM-DD')}`,
      city: `Generated at: ${moment().format('HH:mm:ss')}`,
      source: '',
      status: '',
      priority: '',
      emittedAt: ''
    });
    
    // Style the summary row
    const summaryRow = worksheet.lastRow;
    summaryRow.font = { bold: true };
    summaryRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFD700' }
    };
    
    // Set response headers for file download
    const fileName = `Daily_Leads_${moment().format('YYYY-MM-DD')}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    // Write to response
    await workbook.xlsx.write(res);
    res.end();
    
    console.log(`Daily leads Excel file downloaded: ${fileName} (${dailyLeads.length} leads)`);
    
  } catch (error) {
    console.error('Error generating Excel file:', error);
    res.status(500).json({ error: 'Failed to generate Excel file' });
  }
});

// API to get fetching status
app.get('/api/fetching-status', (req, res) => {
  res.json({ isFetching });
});

// API to get current daily lead count
app.get('/api/daily-lead-count', (req, res) => {
  res.json({ 
    dailyLeadCount,
    maxDailyLeads: MAX_DAILY_LEADS,
    lastResetDate,
    isWithinWorkingHours: isWithinWorkingHours(),
    workingHoursOnly: LEAD_EMISSION_CONFIG.workingHoursOnly
  });
});

// API to manually trigger a lead emission (for testing)
app.post('/api/emit-test-lead', async (req, res) => {
  try {
    await emitNewLead();
    res.json({ status: 'success', message: 'Test lead emitted' });
  } catch (error) {
    console.error('Error emitting test lead:', error);
    res.status(500).json({ error: error.message });
  }
});

// API to check leads data in memory
app.get('/api/leads-data-status', async (req, res) => {
  try {
    // Get database statistics
    const totalLeadsInDatabase = await Lead.countDocuments({});
    const emittedLeadsCount = await Lead.countDocuments({ emittedAt: { $exists: true } });
    const leadsWithTimestamp = await Lead.countDocuments({ timestamp: { $exists: true } });
    
    res.json({ 
      leadsDataLength: leadsData.length,
      totalLeadsInDB,
      totalLeadsInDatabase,
      emittedLeadsCount,
      leadsWithTimestamp,
      isFetching,
      isFetchingGloballyDisabled
    });
  } catch (error) {
    console.error('Error getting leads data status:', error);
    res.status(500).json({ error: 'Failed to get leads data status' });
  }
});

// API to get lead emission configuration
app.get('/api/lead-emission-config', (req, res) => {
  res.json(LEAD_EMISSION_CONFIG);
});

// Debug endpoint to check current time and timezone
app.get('/api/debug-time', (req, res) => {
  const now = new Date();
  const utcTime = now.toISOString();
  const localTime = now.toString();
  const indiaTime = now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
  const currentHour = now.getHours();
  const isWorkingHours = isWithinWorkingHours();
  
  res.json({
    utcTime,
    localTime,
    indiaTime,
    currentHour,
    workingHours: `${WORK_START_HOUR}:00 - ${WORK_END_HOUR}:00`,
    isWorkingHours,
    isFetching,
    isFetchingGloballyDisabled
  });
});

// API to update lead emission configuration
app.post('/api/lead-emission-config', (req, res) => {
  try {
    const { minIntervalSeconds, maxIntervalSeconds, burstModeChance, slowModeChance, workingHoursOnly, randomizeSources, avoidDuplicates } = req.body;
    
    if (minIntervalSeconds !== undefined) LEAD_EMISSION_CONFIG.minIntervalSeconds = minIntervalSeconds;
    if (maxIntervalSeconds !== undefined) LEAD_EMISSION_CONFIG.maxIntervalSeconds = maxIntervalSeconds;
    if (burstModeChance !== undefined) LEAD_EMISSION_CONFIG.burstModeChance = burstModeChance;
    if (slowModeChance !== undefined) LEAD_EMISSION_CONFIG.slowModeChance = slowModeChance;
    if (workingHoursOnly !== undefined) LEAD_EMISSION_CONFIG.workingHoursOnly = workingHoursOnly;
    if (randomizeSources !== undefined) LEAD_EMISSION_CONFIG.randomizeSources = randomizeSources;
    if (avoidDuplicates !== undefined) LEAD_EMISSION_CONFIG.avoidDuplicates = avoidDuplicates;
    
    console.log('Lead emission configuration updated:', LEAD_EMISSION_CONFIG);
    res.json({ status: 'success', config: LEAD_EMISSION_CONFIG });
  } catch (error) {
    console.error('Error updating lead emission config:', error);
    res.status(500).json({ error: 'Failed to update configuration' });
  }
});

// API to reload leads from database
app.post('/api/reload-leads', async (req, res) => {
  try {
    console.log('Reloading leads from database...');
    
    // Reset daily count to allow re-emission of leads
    dailyLeadCount = 0;
    
    // Reload leads from database
    leadsData = await Lead.find({}).sort({ timestamp: -1 });
    totalLeadsInDB = leadsData.length;
    
    // Reset emittedAt for all leads to allow re-emission
    await Lead.updateMany({}, { $unset: { emittedAt: 1 } });
    
    console.log(`Successfully reloaded ${leadsData.length} leads from database`);
    
    res.json({ 
      status: 'success', 
      message: `Reloaded ${leadsData.length} leads from database`,
      totalLeads: leadsData.length,
      dailyLeadCount: 0
    });
  } catch (error) {
    console.error('Error reloading leads:', error);
    res.status(500).json({ error: 'Failed to reload leads' });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
const server = http.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  try {
    const systemReady = await loadInitialLeads();
    if (systemReady) {
      // Start the global lead emission loop once the system is ready
      console.log('Starting global lead emission schedule...');
      scheduledLeadEmitter();
    } else {
      console.error("System initialization failed. Lead emission schedule not started.");
    }
  } catch (error) {
    console.error('Error during server startup:', error);
  }
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  server.close(() => {
    console.log('Server closed due to uncaught exception');
    process.exit(1);
  });
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  server.close(() => {
    console.log('Server closed due to unhandled rejection');
    process.exit(1);
  });
}); 