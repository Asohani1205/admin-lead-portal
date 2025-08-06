const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  cors: {
    origin: [
      "http://localhost:8080",
      "https://endlessportal.netlify.app",
      "http://localhost:3000"
    ],
    methods: ["GET", "POST"],
    credentials: true
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
    "http://localhost:3000"
  ],
  credentials: true
}));
app.use(express.json());
app.use(express.static('public'));

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
const MAX_DAILY_LEADS = 21;

// Lead emission configuration
const LEAD_EMISSION_CONFIG = {
  minIntervalSeconds: 5,        // Minimum time between leads (seconds)
  maxIntervalSeconds: 300,      // Maximum time between leads (seconds)
  burstModeChance: 0.1,        // 10% chance of burst mode (faster emission)
  slowModeChance: 0.1,         // 10% chance of slow mode (slower emission)
  workingHoursOnly: true,       // Only emit during working hours
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

const WORK_START_HOUR = 10; // 10 AM
const WORK_END_HOUR = 19; // 7 PM

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
    console.log(`System ready with ${leadsData.length} potential leads for serialized emission`);
    return true;
  } catch (error) {
    console.error('Error initializing system:', error.message);
    return false;
  }
}

// Function to calculate random interval for lead emission
function calculateLeadEmissionInterval() {
  // Calculate working hours (10 AM to 7 PM = 9 hours)
  const workingHours = WORK_END_HOUR - WORK_START_HOUR; // 9 hours
  const totalWorkingTime = workingHours * 60 * 60 * 1000; // 9 hours in milliseconds
  const totalLeadsToEmit = MAX_DAILY_LEADS; // 21 leads per day
  const averageInterval = totalWorkingTime / totalLeadsToEmit;

  // Add more randomness (±50% of average interval for more variation)
  const randomFactor = 0.5;
  const minInterval = averageInterval * (1 - randomFactor);
  const maxInterval = averageInterval * (1 + randomFactor);

  // Add extra randomness: sometimes emit leads faster or slower
  const extraRandomness = Math.random();
  let finalInterval;
  
  if (extraRandomness < LEAD_EMISSION_CONFIG.burstModeChance) {
    // Burst mode: very fast emission
    finalInterval = Math.random() * (LEAD_EMISSION_CONFIG.minIntervalSeconds * 1000 * 2);
  } else if (extraRandomness < (LEAD_EMISSION_CONFIG.burstModeChance + LEAD_EMISSION_CONFIG.slowModeChance)) {
    // Slow mode: slower emission
    finalInterval = averageInterval * (1.5 + Math.random() * 1);
  } else {
    // Normal mode: random interval within configured bounds
    const minMs = LEAD_EMISSION_CONFIG.minIntervalSeconds * 1000;
    const maxMs = LEAD_EMISSION_CONFIG.maxIntervalSeconds * 1000;
    finalInterval = Math.floor(Math.random() * (maxMs - minMs + 1) + minMs);
  }

  return Math.max(LEAD_EMISSION_CONFIG.minIntervalSeconds * 1000, Math.floor(finalInterval));
}

// Function to check if current time is within working hours
function isWithinWorkingHours() {
  const now = new Date();
  const currentHour = now.getHours();
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
      // Randomly select a lead instead of sequential
      const randomIndex = Math.floor(Math.random() * leadsData.length);
      const lead = { ...leadsData[randomIndex] }; // Create a copy to avoid modifying original
      
      // Randomly select a source (if configured)
      if (LEAD_EMISSION_CONFIG.randomizeSources) {
        const randomSourceIndex = Math.floor(Math.random() * sources.length);
        lead.source = sources[randomSourceIndex];
      }
      
      // Increment daily count
      dailyLeadCount++;
      
      // Update the lead in database with emitted timestamp and source
      await Lead.findByIdAndUpdate(lead._id, {
        source: lead.source,
        emittedAt: new Date()
      });
      
      // Emit the lead to all connected clients
      io.emit('newLead', lead);
      console.log(`Emitted lead ${randomIndex + 1}/${totalLeadsInDB} (Daily: ${dailyLeadCount}/${MAX_DAILY_LEADS}):`, lead.name, 'from source:', lead.source);
      
      // Remove the emitted lead from the pool to avoid duplicates (if configured)
      if (LEAD_EMISSION_CONFIG.avoidDuplicates) {
        leadsData.splice(randomIndex, 1);
        totalLeadsInDB = leadsData.length;
        console.log(`Remaining leads in pool: ${totalLeadsInDB}`);
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
    const recentLeads = await Lead.find({ emittedAt: { $exists: true } })
      .sort({ emittedAt: -1 })
      .limit(parseInt(limit));

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
  if (isFetchingGloballyDisabled) {
    console.log('Fetching is globally disabled. Ignoring start request.');
    return res.status(403).json({ status: 'disabled', message: 'Fetching is globally disabled by admin.' });
  }
  isFetching = true;
  console.log('Fetching started (isFetching = true)');
  res.json({ status: 'started' });
});

// API to stop fetching
app.post('/api/stop-fetching', (req, res) => {
  isFetching = false;
  console.log('Fetching stopped (isFetching = false)');
  res.json({ status: 'stopped' });
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
    const now = new Date();
    const currentHour = now.getHours();
    
    // Check if it's after 7 PM (19:00) to allow download
    if (currentHour < 19) {
      return res.status(403).json({ 
        error: 'Daily leads download is only available after 7 PM',
        availableAt: '19:00 (7 PM)'
      });
    }
    
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
      { header: 'Price', key: 'price', width: 15 },
      { header: 'Property Type', key: 'propertyType', width: 20 },
      { header: 'Locality', key: 'locality', width: 20 },
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
        price: lead.price,
        propertyType: lead.propertyType,
        locality: lead.locality,
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
      price: '',
      propertyType: '',
      locality: '',
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

// API to get lead emission configuration
app.get('/api/lead-emission-config', (req, res) => {
  res.json(LEAD_EMISSION_CONFIG);
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

// Start server
const PORT = process.env.PORT || 3000;
http.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  const systemReady = await loadInitialLeads();
  if (systemReady) {
    // Start the global lead emission loop once the system is ready
    console.log('Starting global lead emission schedule...');
    scheduledLeadEmitter();
  } else {
    console.error("System initialization failed. Lead emission schedule not started.");
  }
}); 