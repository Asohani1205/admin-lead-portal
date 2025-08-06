// Load sidebar content
document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.getElementById('sidebar');
    sidebar.innerHTML = `
        <div class="w-64 bg-gray-800 p-4 h-full">
            <div class="text-xl font-bold mb-8">Endless Leads Portal</div>
            <nav>
                <a href="/index.html" class="block py-2 px-4 text-gray-300 hover:bg-gray-700 rounded mb-2">Dashboard</a>
                <a href="/pages/leads.html" class="block py-2 px-4 text-gray-300 hover:bg-gray-700 rounded mb-2">Leads</a>
            </nav>
        </div>
    `;

    // Highlight current page in navigation
    const currentPage = window.location.pathname;
    const navLinks = sidebar.querySelectorAll('nav a');
    navLinks.forEach(link => {
        if (link.getAttribute('href') === currentPage) {
            link.classList.remove('text-gray-300', 'hover:bg-gray-700');
            link.classList.add('bg-blue-600', 'text-white');
        }
    });

    // If sidebar is being loaded dynamically, hide or remove the Leads link
    const leadsLink = document.querySelector('a[href*="leads"]');
    if (leadsLink) {
        leadsLink.style.display = 'none';
    }
});

// Format date helper function
function formatDate(date) {
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(new Date(date));
}

// Format number helper function
function formatNumber(num) {
    return new Intl.NumberFormat('en-US').format(num);
}

// Format currency helper function
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(amount);
}

// Show notification helper function
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 px-6 py-3 rounded-lg text-white ${
        type === 'success' ? 'bg-green-500' : 
        type === 'error' ? 'bg-red-500' : 
        'bg-yellow-500'
    }`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Set the backend API base URL dynamically
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? "http://localhost:3000" 
    : window.location.origin;

// API request helper function
async function apiRequest(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json'
            },
            ...options
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('API request failed:', error);
        showNotification(error.message, 'error');
        throw error;
    }
}

// (Remove all socket connection and fetching control logic from here)
// ... existing code ... 