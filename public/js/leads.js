// State management
let currentPage = 1;
let currentFilters = {
    search: '',
    priority: '',
    source: '',
    dateRange: 'last7days'
};

// Cache for leads data
let cachedLeads = [];

// DOM Elements
const leadsTableBody = document.getElementById('leadsTableBody');
const totalLeadsCount = document.getElementById('totalLeadsCount');
const searchInput = document.querySelector('input[placeholder="Search leads..."]');
const priorityFilter = document.querySelector('select[name="priority"]');
const sourceFilter = document.querySelector('select[name="source"]');
const dateRangeFilter = document.querySelector('select[name="dateRange"]');
const toggleFetchingBtn = document.getElementById('toggleFetchingBtn');

if (typeof socket === 'undefined') {
  window.socket = io(API_BASE_URL);
}

// Load leads data
async function loadLeads() {
    try {
        const queryParams = new URLSearchParams({
            page: currentPage,
            limit: 10,
            ...currentFilters
        });
        
        const data = await apiRequest(`/api/leads?${queryParams}`);
        
        if (data && Array.isArray(data.leads)) {
            cachedLeads = data.leads;
            renderLeads(data.leads);
            updatePagination(data);
            totalLeadsCount.textContent = data.total;
        } else {
            throw new Error('Invalid data format received from server');
        }
    } catch (error) {
        console.error('Error loading leads:', error);
        showNotification('Failed to load leads. Retrying...', 'error');
        // Retry after 2 seconds
        setTimeout(loadLeads, 2000);
    }
}

// Render leads in table
function renderLeads(leads) {
    if (!Array.isArray(leads)) {
        console.error('Invalid leads data:', leads);
        return;
    }

    leadsTableBody.innerHTML = leads.map(lead => `
        <tr class="hover:bg-gray-700">
            <td class="px-1 py-1 w-4">
                <div class="flex items-center">
                    <div class="flex-shrink-0">
                        <span class="w-1.5 h-1.5 rounded-full ${getPriorityClass(lead.priority)}"></span>
                    </div>
                    <div class="ml-1">
                        <div class="text-xs font-medium text-white truncate max-w-[15px]">${lead.name || ''}</div>
                    </div>
                </div>
            </td>
            <td class="px-1 py-1 w-3">
                <div class="text-xs text-white truncate max-w-[10px]">${lead.mobile || ''}</div>
                <div class="text-xs text-gray-400 truncate max-w-[10px]">${lead.city || 'Indore'}</div>
            </td>
            <td class="px-1 py-1 w-16">
                <span class="source-badge ${(lead.source || '').toLowerCase()} text-xs px-1">${lead.source || ''}</span>
            </td>
            <td class="px-1 py-1 w-16">
                <span class="px-1 py-0.5 text-xs rounded-full ${getStatusClass(lead.status)}">${lead.status || 'New'}</span>
            </td>
            <td class="px-1 py-1 w-24 text-xs text-gray-400">
                ${new Date(lead.timestamp).toLocaleString()}
            </td>
            <td class="px-1 py-1 w-16 text-right text-xs font-medium">
                <button onclick="editLead('${lead._id}')" class="text-blue-400 hover:text-blue-300 mr-1">Edit</button>
                <button onclick="deleteLead('${lead._id}')" class="text-red-400 hover:text-red-300">Delete</button>
            </td>
        </tr>
    `).join('');
}

// Helper functions for styling
function getPriorityClass(priority) {
    return {
        'High': 'bg-red-500',
        'Medium': 'bg-yellow-500',
        'Low': 'bg-green-500'
    }[priority] || 'bg-gray-500';
}

function getStatusClass(status) {
    return {
        'New': 'bg-green-500 text-white',
        'Contacted': 'bg-blue-500 text-white',
        'Qualified': 'bg-purple-500 text-white',
        'Lost': 'bg-gray-500 text-white'
    }[status] || 'bg-gray-500 text-white';
}

// Update pagination
function updatePagination(data) {
    const paginationContainer = document.getElementById('pagination');
    const totalPages = data.totalPages;
    
    let paginationHTML = '';
    
    if (totalPages > 1) {
        paginationHTML += `
            <button onclick="changePage(${Math.max(1, currentPage - 1)})" 
                    class="px-3 py-1 rounded-md ${currentPage === 1 ? 'bg-gray-700 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'}">
                Previous
            </button>
        `;
        
        for (let i = 1; i <= totalPages; i++) {
            paginationHTML += `
                <button onclick="changePage(${i})" 
                        class="px-3 py-1 rounded-md ${currentPage === i ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}">
                    ${i}
                </button>
            `;
        }
        
        paginationHTML += `
            <button onclick="changePage(${Math.min(totalPages, currentPage + 1)})" 
                    class="px-3 py-1 rounded-md ${currentPage === totalPages ? 'bg-gray-700 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'}">
                Next
            </button>
        `;
    }
    
    paginationContainer.innerHTML = paginationHTML;
}

// Change page
function changePage(page) {
    currentPage = page;
    loadLeads(); // Force refresh when changing pages
}

// Edit lead
async function editLead(leadId) {
    // Implementation for editing a lead
    showNotification('Edit lead functionality coming soon');
}

// Delete lead
async function deleteLead(leadId) {
    if (!confirm('Are you sure you want to delete this lead?')) return;
    
    try {
        await apiRequest(`/api/leads/${leadId}`, { method: 'DELETE' });
        showNotification('Lead deleted successfully');
        loadLeads();
    } catch (error) {
        showNotification('Failed to delete lead', 'error');
    }
}

// Event listeners for filters
searchInput?.addEventListener('input', debounce(() => {
    currentFilters.search = searchInput.value;
    currentPage = 1;
    loadLeads(); // Force refresh when searching
}, 300));

priorityFilter?.addEventListener('change', () => {
    currentFilters.priority = priorityFilter.value;
    currentPage = 1;
    loadLeads(); // Force refresh when filtering
});

sourceFilter?.addEventListener('change', () => {
    currentFilters.source = sourceFilter.value;
    currentPage = 1;
    loadLeads(); // Force refresh when filtering
});

dateRangeFilter?.addEventListener('change', () => {
    currentFilters.dateRange = dateRangeFilter.value;
    currentPage = 1;
    loadLeads(); // Force refresh when filtering
});

// Socket event handler for new leads
socket.on('newLead', (lead) => {
    // Add to cache
    if (!Array.isArray(cachedLeads)) {
        cachedLeads = [];
    }
    cachedLeads.unshift(lead);
    
    // If we're on the first page and not filtering, add the new lead to the top
    if (currentPage === 1 && !currentFilters.search && !currentFilters.priority && !currentFilters.source) {
        const currentLeads = Array.from(leadsTableBody.children);
        if (currentLeads.length >= 10) {
            currentLeads.pop(); // Remove the last lead if we already have 10
        }
        
        const newLeadHtml = `
            <tr class="hover:bg-gray-700 animate-fade-in">
                <td class="px-1 py-1 w-4">
                    <div class="flex items-center">
                        <div class="flex-shrink-0">
                            <span class="w-1.5 h-1.5 rounded-full ${getPriorityClass(lead.priority)}"></span>
                        </div>
                        <div class="ml-1">
                            <div class="text-xs font-medium text-white truncate max-w-[15px]">${lead.name || ''}</div>
                        </div>
                    </div>
                </td>
                <td class="px-1 py-1 w-3">
                    <div class="text-xs text-white truncate max-w-[10px]">${lead.mobile || ''}</div>
                    <div class="text-xs text-gray-400 truncate max-w-[10px]">${lead.city || 'Indore'}</div>
                </td>
                <td class="px-1 py-1 w-16">
                    <span class="source-badge ${(lead.source || '').toLowerCase()} text-xs px-1">${lead.source || ''}</span>
                </td>
                <td class="px-1 py-1 w-16">
                    <span class="px-1 py-0.5 text-xs rounded-full ${getStatusClass(lead.status)}">${lead.status || 'New'}</span>
                </td>
                <td class="px-1 py-1 w-24 text-xs text-gray-400">
                    ${new Date(lead.timestamp).toLocaleString()}
                </td>
                <td class="px-1 py-1 w-16 text-right text-xs font-medium">
                    <button onclick="editLead('${lead._id}')" class="text-blue-400 hover:text-blue-300 mr-1">Edit</button>
                    <button onclick="deleteLead('${lead._id}')" class="text-red-400 hover:text-red-300">Delete</button>
                </td>
            </tr>
        `;
        
        const tempContainer = document.createElement('tbody');
        tempContainer.innerHTML = newLeadHtml;
        const newLeadElement = tempContainer.firstElementChild;
        
        leadsTableBody.insertBefore(newLeadElement, leadsTableBody.firstElementChild);
        
        // Update total count
        const currentTotal = parseInt(totalLeadsCount.textContent || '0');
        totalLeadsCount.textContent = currentTotal + 1;
        
        // Add highlight animation
        newLeadElement.classList.add('bg-green-900', 'bg-opacity-25');
        setTimeout(() => {
            newLeadElement.classList.remove('bg-green-900', 'bg-opacity-25');
        }, 2000);
    }
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        loadLeads(); // Force refresh when tab becomes visible
    }
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadLeads(); // Force refresh on initial load
    
    // Add event listeners for filters
    searchInput?.addEventListener('input', debounce(() => {
        currentFilters.search = searchInput.value;
        currentPage = 1;
        loadLeads(); // Force refresh when searching
    }, 300));

    priorityFilter?.addEventListener('change', () => {
        currentFilters.priority = priorityFilter.value;
        currentPage = 1;
        loadLeads(); // Force refresh when filtering
    });

    sourceFilter?.addEventListener('change', () => {
        currentFilters.source = sourceFilter.value;
        currentPage = 1;
        loadLeads(); // Force refresh when filtering
    });

    dateRangeFilter?.addEventListener('change', () => {
        currentFilters.dateRange = dateRangeFilter.value;
        currentPage = 1;
        loadLeads(); // Force refresh when filtering
    });
});

// Debounce helper
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

async function updateFetchingStatus() {
    const res = await fetch(`${API_BASE_URL}/api/fetching-status`);
    const data = await res.json();
    toggleFetchingBtn.textContent = data.isFetching ? 'Stop Fetching' : 'Start Fetching';
}

toggleFetchingBtn?.addEventListener('click', async () => {
    await fetch(
        `${API_BASE_URL}${toggleFetchingBtn.textContent.includes('Start') ? '/api/start-fetching' : '/api/stop-fetching'}`,
        { method: 'POST' }
    );
    await updateFetchingStatus();
});

// On page load, set the correct button text
updateFetchingStatus(); 