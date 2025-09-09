// DOM Elements
const activityFeed = document.getElementById('activityFeed');
const newLeadsCount = document.getElementById('newLeadsCount');
const leadsChange = document.getElementById('leadsChange');
const activeCrawlersCount = document.getElementById('activeCrawlersCount');
const crawlerStatus = document.getElementById('crawlerStatus');
const conversionRate = document.getElementById('conversionRate');
const conversionChange = document.getElementById('conversionChange');
const totalDataPoints = document.getElementById('totalDataPoints');
const dailyDataPoints = document.getElementById('dailyDataPoints');

// Initialize counters
let todayLeads = 0;
let totalLeadsProcessed = 0;

// Create activity feed item
function createActivityItem(lead) {
    console.log('Creating activity item for lead:', lead);
    
    const item = document.createElement('div');
    item.className = 'bg-gray-700 p-4 rounded-lg';
    
    // Use emittedAt if available, otherwise use timestamp
    const timestamp = lead.emittedAt || lead.timestamp;
    const timeAgo = Math.floor((Date.now() - new Date(timestamp)) / 1000);
    const timeString = timeAgo < 60 ? `${timeAgo}s ago` : `${Math.floor(timeAgo / 60)}m ago`;

    console.log('Timestamp calculation:', { timestamp, timeAgo, timeString });

    // Define source badge colors
    const sourceBadgeColors = {
        facebook: 'bg-blue-600',
        instagram: 'bg-pink-600',
        linkedin: 'bg-blue-700',
        website: 'bg-green-600',
        google: 'bg-red-500'
    };

    const sourceColor = sourceBadgeColors[lead.source.toLowerCase()] || 'bg-gray-600';

    // Only show content if it exists
    const name = lead.name ? lead.name : 'Unknown Lead';
    const mobile = lead.mobile ? lead.mobile : '';
    const address = lead.address ? lead.address : '';

    console.log('Lead data for display:', { name, mobile, address, source: lead.source });
    console.log('Raw lead object:', lead);
    console.log('Lead name check:', lead.name, 'Type:', typeof lead.name);

    item.innerHTML = `
        <div class="flex justify-between items-start">
            <div class="flex-1">
                <div class="flex items-center mb-2">
                    <span class="font-semibold text-lg">${name}</span>
                    ${lead.source ? `<span class="ml-2 px-2 py-1 ${sourceColor} text-xs rounded-full">${lead.source}</span>` : ''}
                </div>
                ${mobile ? `
                <div class="text-sm text-gray-400 mb-1">
                    <span>${mobile}</span>
                </div>
                ` : ''}
                ${address ? `
                <div class="text-sm text-gray-400">
                    <span>${address}</span>
                </div>
                ` : ''}
            </div>
            <div class="text-sm text-gray-400">${timeString}</div>
        </div>
    `;

    // Add to activity feed
    activityFeed.insertBefore(item, activityFeed.firstChild);

    // Keep only last 50 items
    if (activityFeed.children.length > 50) {
        activityFeed.removeChild(activityFeed.lastChild);
    }
}

// Update stats display
function updateStatsDisplay() {
    // Update leads count
    newLeadsCount.textContent = todayLeads;
    leadsChange.textContent = `+${todayLeads} today`;
    
    // Update crawler status
    activeCrawlersCount.textContent = '3';
    crawlerStatus.textContent = 'All systems operational';
    
    // Update conversion rate
    const rate = Math.round((todayLeads / totalLeadsProcessed) * 100) || 0;
    conversionRate.textContent = `${rate}%`;
    conversionChange.textContent = `+${Math.round(rate * 0.1)}% from yesterday`;
    
    // Update data points
    totalDataPoints.textContent = formatNumber(totalLeadsProcessed * 15);
    dailyDataPoints.textContent = `+${formatNumber(todayLeads * 15)} today`;
}

// Socket event handlers
if (typeof socket === 'undefined') {
  console.log('Initializing Socket.IO connection to:', API_BASE_URL);
  window.socket = io(API_BASE_URL, {
    transports: ['websocket', 'polling'],
    timeout: 20000,
    forceNew: true
  });
}

socket.on('connect', () => {
    console.log('✅ Socket.IO connected successfully to server');
    console.log('Socket ID:', socket.id);
});

socket.on('connect_error', (error) => {
    console.error('❌ Socket.IO connection error:', error);
});

socket.on('disconnect', (reason) => {
    console.log('🔌 Socket.IO disconnected:', reason);
});

socket.on('newLead', (lead) => {
    console.log('🎯 Received new lead via Socket.IO:', lead);
    console.log('Lead name:', lead.name, 'Lead mobile:', lead.mobile, 'Lead source:', lead.source);
    createActivityItem(lead);
    todayLeads++;
    totalLeadsProcessed++;
    updateStatsDisplay();
    console.log('✅ Lead added to activity feed. Total leads today:', todayLeads);
});

// Start/Stop Fetching Button Logic
const toggleFetchingBtn = document.getElementById('toggleFetchingBtn');
const downloadDailyLeadsBtn = document.getElementById('downloadDailyLeadsBtn');

async function updateFetchingStatus() {
    try {
        console.log('Attempting to connect to:', `${API_BASE_URL}/api/fetching-status`);
        const res = await fetch(`${API_BASE_URL}/api/fetching-status`);
        console.log('Response status:', res.status);
        
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        const data = await res.json();
        console.log('Fetching status data:', data);
        
        if (toggleFetchingBtn) {
            toggleFetchingBtn.textContent = data.isFetching ? 'Stop Fetching' : 'Start Fetching';
            toggleFetchingBtn.disabled = false;
        }
    } catch (error) {
        console.error('Error updating fetching status:', error);
        console.error('API_BASE_URL:', API_BASE_URL);
        console.error('Current location:', window.location.href);
        
        if (toggleFetchingBtn) {
            toggleFetchingBtn.textContent = 'Connection Error';
            toggleFetchingBtn.disabled = false;
        }
    }
}

toggleFetchingBtn?.addEventListener('click', async () => {
    if (!toggleFetchingBtn) return;
    toggleFetchingBtn.disabled = true;
    const isStarting = toggleFetchingBtn.textContent.includes('Start');
    toggleFetchingBtn.textContent = isStarting ? 'Starting...' : 'Stopping...';
    try {
        await fetch(
            `${API_BASE_URL}${isStarting ? '/api/start-fetching' : '/api/stop-fetching'}`,
            { method: 'POST' }
        );
    } catch (error) {}
    await updateFetchingStatus();
});

// Function to load recent leads from database
async function loadRecentLeads() {
    try {
        console.log('Loading recent leads from database...');
        const response = await fetch(`${API_BASE_URL}/api/recent-leads?limit=50`);
        const data = await response.json();
        
        console.log('Recent leads response:', data);
        
        if (data.leads && data.leads.length > 0) {
            // Clear existing activity feed
            activityFeed.innerHTML = '';
            
            // Reset counters
            todayLeads = 0;
            totalLeadsProcessed = 0;
            
            // Add each lead to the activity feed
            data.leads.forEach(lead => {
                // Use emittedAt timestamp if available, otherwise use timestamp
                const leadTimestamp = lead.emittedAt || lead.timestamp;
                const leadWithTimestamp = { ...lead, timestamp: leadTimestamp };
                createActivityItem(leadWithTimestamp);
                todayLeads++;
                totalLeadsProcessed++;
            });
            
            // Update stats display after loading
            updateStatsDisplay();
            
            console.log(`Loaded ${data.leads.length} recent leads from database`);
        } else {
            console.log('No recent leads found in database');
        }
    } catch (error) {
        console.error('Error loading recent leads:', error);
    }
}

// Function to check if download button should be visible
function checkDownloadButtonVisibility() {
    // Always show the download button - no time restrictions
    if (downloadDailyLeadsBtn) {
        downloadDailyLeadsBtn.style.display = 'block';
    }
}

// Download Daily Leads Button Logic
downloadDailyLeadsBtn?.addEventListener('click', async () => {
    try {
        downloadDailyLeadsBtn.disabled = true;
        downloadDailyLeadsBtn.textContent = 'Downloading...';
        
        const response = await fetch(`${API_BASE_URL}/api/download-daily-leads`);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to download leads');
        }
        
        // Create blob and download
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        
        // Get filename from response headers or use default
        const contentDisposition = response.headers.get('content-disposition');
        let filename = `Daily_Leads_${new Date().toISOString().split('T')[0]}.xlsx`;
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename="(.+)"/);
            if (filenameMatch) {
                filename = filenameMatch[1];
            }
        }
        
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        console.log('Daily leads Excel file downloaded successfully');
        
    } catch (error) {
        console.error('Error downloading daily leads:', error);
        alert(`Error downloading leads: ${error.message}`);
    } finally {
        downloadDailyLeadsBtn.disabled = false;
        downloadDailyLeadsBtn.textContent = 'Download Daily Leads';
    }
});

// Test connection function
async function testConnection() {
    try {
        console.log('Testing connection to:', `${API_BASE_URL}/health`);
        const response = await fetch(`${API_BASE_URL}/health`);
        const data = await response.json();
        console.log('Health check response:', data);
        return true;
    } catch (error) {
        console.error('Connection test failed:', error);
        return false;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Page loaded, testing connection...');
    console.log('Current location:', window.location.href);
    console.log('API_BASE_URL:', API_BASE_URL);
    
    const isConnected = await testConnection();
    console.log('Connection test result:', isConnected);
    
    if (!isConnected) {
        console.error('Failed to connect to backend. Please check the deployment URL.');
        if (toggleFetchingBtn) {
            toggleFetchingBtn.textContent = 'Backend Unavailable';
            toggleFetchingBtn.disabled = true;
        }
    }
    
    updateFetchingStatus();
    updateStatsDisplay();
    loadRecentLeads(); // Load recent leads on page load
    checkDownloadButtonVisibility(); // Check if download button should be visible
    
    // Check download button visibility every minute
    setInterval(checkDownloadButtonVisibility, 60000);
});

// Initial stats update
updateStatsDisplay(); 