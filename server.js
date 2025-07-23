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

// Add serialized lead tracking
let serializedLeadIndex = 0;
let totalLeadsInDB = 0;

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

const WORK_START_HOUR = 6; // 6 AM
const WORK_END_HOUR = 24; // 12 AM (midnight)

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
    console.log(`System ready with ${leadsData.length} potential leads for randomized emission`);
    return true;
  } catch (error) {
    console.error('Error initializing system:', error.message);
    return false;
  }
}

// Function to calculate random interval for lead emission
function calculateLeadEmissionInterval() {
  // Calculate total time in milliseconds for 24 hours
  const totalTime = 24 * 60 * 60 * 1000; // 24 hours
  const totalLeadsToEmit = 360; // Target 360 leads per day (15 per hour * 24 hours)
  const averageInterval = totalTime / totalLeadsToEmit;

  // Add some randomness (±30% of average interval)
  const randomFactor = 0.3;
  const minInterval = averageInterval * (1 - randomFactor);
  const maxInterval = averageInterval * (1 + randomFactor);

  return Math.floor(Math.random() * (maxInterval - minInterval + 1) + minInterval);
}

// Function to emit a new lead
async function emitNewLead() {
  try {
    // Get a random lead from MongoDB
    const leads = await Lead.find({});
    if (leads.length > 0) {
      const randomIndex = Math.floor(Math.random() * leads.length);
      const lead = leads[randomIndex];
      
      // Get the next source in sequence
      lead.source = sources[sourceIndex];
      sourceIndex = (sourceIndex + 1) % sources.length;
      
      // Emit the lead to all connected clients
      io.emit('newLead', lead);
      console.log('Emitted lead:', lead.name, 'from source:', lead.source);
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
    if (isFetching) {
      await emitNewLead();
    }
  } catch (error) {
    console.error("Error during scheduled lead emission:", error);
  } finally {
    const nextInterval = calculateLeadEmissionInterval();
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

// API to get fetching status
app.get('/api/fetching-status', (req, res) => {
  res.json({ isFetching });
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