// Riot Games API Configuration
const API_CONFIG = {
    key: 'RGAPI-afe09931-a170-4541-8f25-2b071c0ab4ed', // Working API key - tested and verified
    baseUrl: 'https://{region}.api.riotgames.com',
    endpoints: {
        summoner: '/lol/summoner/v4/summoners/by-name/{summonerName}',
        league: '/lol/league/v4/entries/by-summoner/{summonerId}',
        mastery: '/lol/champion-mastery/v4/champion-masteries/by-summoner/{summonerId}'
    }
};

// Rate limiting and caching
const requestCache = new Map();
const requestQueue = [];
let lastRequestTime = 0;
const REQUEST_DELAY = 1200; // 1.2 seconds between requests

// DOM Elements
const elements = {
    searchBtn: document.getElementById('search-btn'),
    summonerInput: document.getElementById('summoner-name'),
    regionSelect: document.getElementById('region'),
    loading: document.getElementById('loading'),
    results: document.getElementById('results'),
    summonerCard: document.getElementById('summoner-card'),
    championMastery: document.getElementById('champion-mastery'),
    leaderboardList: document.getElementById('leaderboard-list'),
    leaderboardRegion: document.getElementById('leaderboard-region'),
    notification: document.getElementById('notification')
};

// Local storage for leaderboard
const STORAGE_KEYS = {
    leaderboard: 'rift-rewind-leaderboard',
    searchHistory: 'rift-rewind-search-history'
};

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    loadLeaderboard();
    
    // Add particle animation
    createParticleEffect();
});

function initializeEventListeners() {
    elements.searchBtn.addEventListener('click', handleSearch);
    elements.summonerInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
    });
    elements.leaderboardRegion.addEventListener('change', filterLeaderboard);
}

async function handleSearch() {
    const summonerName = elements.summonerInput.value.trim();
    const region = elements.regionSelect.value;
    
    console.log('🔍 Starting search for:', summonerName, 'in region:', region);
    
    if (!summonerName) {
        showNotification('Please enter a summoner name', 'error');
        return;
    }
    
    if (!validateSummonerName(summonerName)) {
        showNotification('Invalid summoner name format', 'error');
        return;
    }
    
    showLoading(true);
    
    try {
        console.log('📡 Fetching summoner data...');
        const summonerData = await fetchSummonerData(summonerName, region);
        console.log('✅ Summoner data received:', summonerData);
        
        console.log('📡 Fetching league data...');
        const leagueData = await fetchLeagueData(summonerData.id, region);
        console.log('✅ League data received:', leagueData);
        
        console.log('📡 Fetching mastery data...');
        const masteryData = await fetchMasteryData(summonerData.id, region);
        console.log('✅ Mastery data received:', masteryData);
        
        displaySummonerResults(summonerData, leagueData, masteryData, region);
        addToLeaderboard(summonerData, leagueData, region);
        
        showNotification('Summoner data loaded successfully!', 'success');
    } catch (error) {
        console.error('🚨 Search error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name,
            summonerName: summonerName,
            region: region,
            timestamp: new Date().toISOString()
        });
        
        // Show detailed error to user for debugging
        const errorMessage = `Search failed: ${error.message}`;
        showNotification(errorMessage, 'error');
        
        // Also log to console for developer debugging
        console.log('🔧 Debug info - API Key first 10 chars:', API_CONFIG.key.substring(0, 10));
        console.log('🔧 Debug info - Full URL would be:', buildApiUrl('summoner', region, { summonerName: encodeURIComponent(summonerName) }));
    } finally {
        showLoading(false);
    }
}

async function fetchSummonerData(summonerName, region) {
    const cacheKey = `summoner-${region}-${summonerName.toLowerCase()}`;
    
    if (requestCache.has(cacheKey)) {
        const cached = requestCache.get(cacheKey);
        if (Date.now() - cached.timestamp < 300000) { // 5 minutes cache
            return cached.data;
        }
    }
    
    const url = buildApiUrl('summoner', region, { summonerName: encodeURIComponent(summonerName) });
    const data = await makeApiRequest(url);
    
    requestCache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
}

async function fetchLeagueData(summonerId, region) {
    const cacheKey = `league-${region}-${summonerId}`;
    
    if (requestCache.has(cacheKey)) {
        const cached = requestCache.get(cacheKey);
        if (Date.now() - cached.timestamp < 300000) {
            return cached.data;
        }
    }
    
    const url = buildApiUrl('league', region, { summonerId });
    const data = await makeApiRequest(url);
    
    requestCache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
}

async function fetchMasteryData(summonerId, region) {
    const cacheKey = `mastery-${region}-${summonerId}`;
    
    if (requestCache.has(cacheKey)) {
        const cached = requestCache.get(cacheKey);
        if (Date.now() - cached.timestamp < 300000) {
            return cached.data;
        }
    }
    
    const url = buildApiUrl('mastery', region, { summonerId });
    const data = await makeApiRequest(url);
    
    requestCache.set(cacheKey, { data, timestamp: Date.now() });
    return data.slice(0, 5); // Top 5 champions
}

function buildApiUrl(endpoint, region, params) {
    let url = API_CONFIG.baseUrl.replace('{region}', region) + API_CONFIG.endpoints[endpoint];
    
    Object.entries(params).forEach(([key, value]) => {
        url = url.replace(`{${key}}`, value);
    });
    
    return url;
}

async function makeApiRequest(url) {
    // Rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    
    if (timeSinceLastRequest < REQUEST_DELAY) {
        await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY - timeSinceLastRequest));
    }
    
    lastRequestTime = Date.now();
    
    const fullUrl = `${url}?api_key=${API_CONFIG.key}`;
    console.log('🌐 Making API request to:', url);
    console.log('🔑 Using API key:', API_CONFIG.key.substring(0, 10) + '...');
    
    try {
        const response = await fetch(fullUrl);
        
        console.log('📡 Response status:', response.status);
        console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));
        
        if (!response.ok) {
            // Try to get the error response body
            let errorBody = '';
            try {
                const errorText = await response.text();
                errorBody = errorText;
                console.log('❌ Error response body:', errorText);
                
                // Try to parse as JSON for structured error
                try {
                    const errorJson = JSON.parse(errorText);
                    console.log('❌ Parsed error JSON:', errorJson);
                } catch (e) {
                    console.log('❌ Error response is not JSON');
                }
            } catch (e) {
                console.log('❌ Could not read error response body:', e);
            }
            
            // Handle specific error codes with detailed messages
            if (response.status === 401) {
                throw new Error(`API Authentication Failed (401): ${errorBody || 'Invalid or expired API key'}`);
            } else if (response.status === 403) {
                throw new Error(`API Access Forbidden (403): ${errorBody || 'API key lacks required permissions'}`);
            } else if (response.status === 404) {
                throw new Error(`Summoner not found (404): ${errorBody || 'The requested summoner does not exist'}`);
            } else if (response.status === 429) {
                throw new Error(`Rate limit exceeded (429): ${errorBody || 'Too many requests, please wait'}`);
            } else if (response.status === 500) {
                throw new Error(`Riot API Server Error (500): ${errorBody || 'Internal server error'}`);
            } else if (response.status === 503) {
                throw new Error(`Riot API Unavailable (503): ${errorBody || 'Service temporarily unavailable'}`);
            } else {
                throw new Error(`API request failed (${response.status}): ${errorBody || 'Unknown error'}`);
            }
        }
        
        const data = await response.json();
        console.log('✅ API response successful:', data);
        return data;
        
    } catch (error) {
        console.error('🚨 API request error:', error);
        
        // Network or other fetch errors
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            throw new Error(`Network error: Unable to connect to Riot Games API. Please check your internet connection.`);
        }
        
        // Re-throw our custom errors
        throw error;
    }
}

function displaySummonerResults(summoner, leagues, masteries, region) {
    // Display summoner card
    const rankedData = leagues.find(league => league.queueType === 'RANKED_SOLO_5x5') || {};
    
    elements.summonerCard.innerHTML = `
        <div class="summoner-info">
            <div class="summoner-avatar">
                <img src="https://ddragon.leagueoflegends.com/cdn/13.24.1/img/profileicon/${summoner.profileIconId}.png" 
                     alt="Profile Icon" class="profile-icon">
                <div class="summoner-level">${summoner.summonerLevel}</div>
            </div>
            <div class="summoner-details">
                <h3 class="summoner-name">${summoner.name}</h3>
                <p class="summoner-region">${region.toUpperCase()}</p>
                ${rankedData.tier ? `
                    <div class="rank-info">
                        <span class="rank-tier">${rankedData.tier} ${rankedData.rank}</span>
                        <span class="rank-lp">${rankedData.leaguePoints} LP</span>
                        <div class="rank-stats">
                            <span class="wins">${rankedData.wins}W</span>
                            <span class="losses">${rankedData.losses}L</span>
                            <span class="winrate">${Math.round((rankedData.wins / (rankedData.wins + rankedData.losses)) * 100)}%</span>
                        </div>
                    </div>
                ` : '<p class="unranked">Unranked</p>'}
            </div>
        </div>
    `;
    
    // Display champion mastery
    if (masteries.length > 0) {
        elements.championMastery.innerHTML = `
            <h4 class="mastery-title">Champion Mastery</h4>
            <div class="mastery-list">
                ${masteries.map(mastery => `
                    <div class="mastery-item">
                        <div class="champion-icon">
                            <img src="https://ddragon.leagueoflegends.com/cdn/13.24.1/img/champion/${getChampionName(mastery.championId)}.png" 
                                 alt="Champion" onerror="this.src='https://via.placeholder.com/64x64/C89B3C/FFFFFF?text=?'">
                        </div>
                        <div class="mastery-info">
                            <div class="mastery-level">Level ${mastery.championLevel}</div>
                            <div class="mastery-points">${mastery.championPoints.toLocaleString()} points</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    elements.results.classList.remove('hidden');
    elements.results.scrollIntoView({ behavior: 'smooth' });
}

function addToLeaderboard(summoner, leagues, region) {
    const leaderboard = getLeaderboard();
    const rankedData = leagues.find(league => league.queueType === 'RANKED_SOLO_5x5');
    
    if (!rankedData) return; // Only add ranked players
    
    const playerData = {
        id: summoner.id,
        name: summoner.name,
        region: region,
        tier: rankedData.tier,
        rank: rankedData.rank,
        leaguePoints: rankedData.leaguePoints,
        wins: rankedData.wins,
        losses: rankedData.losses,
        profileIconId: summoner.profileIconId,
        summonerLevel: summoner.summonerLevel,
        lastUpdated: Date.now(),
        score: calculatePlayerScore(rankedData)
    };
    
    // Remove existing entry for this player
    const existingIndex = leaderboard.findIndex(p => p.id === summoner.id && p.region === region);
    if (existingIndex !== -1) {
        leaderboard.splice(existingIndex, 1);
    }
    
    leaderboard.push(playerData);
    leaderboard.sort((a, b) => b.score - a.score);
    
    // Keep only top 100 players
    if (leaderboard.length > 100) {
        leaderboard.splice(100);
    }
    
    saveLeaderboard(leaderboard);
    loadLeaderboard();
}

function calculatePlayerScore(rankedData) {
    const tierValues = {
        'IRON': 1, 'BRONZE': 2, 'SILVER': 3, 'GOLD': 4,
        'PLATINUM': 5, 'EMERALD': 6, 'DIAMOND': 7, 'MASTER': 8,
        'GRANDMASTER': 9, 'CHALLENGER': 10
    };
    
    const rankValues = { 'IV': 1, 'III': 2, 'II': 3, 'I': 4 };
    
    const tierScore = (tierValues[rankedData.tier] || 0) * 1000;
    const rankScore = (rankValues[rankedData.rank] || 0) * 100;
    const lpScore = rankedData.leaguePoints;
    
    return tierScore + rankScore + lpScore;
}

function loadLeaderboard() {
    const leaderboard = getLeaderboard();
    const filteredLeaderboard = filterLeaderboardByRegion(leaderboard);
    
    elements.leaderboardList.innerHTML = filteredLeaderboard.map((player, index) => `
        <div class="leaderboard-item">
            <div class="rank-position">#${index + 1}</div>
            <div class="player-avatar">
                <img src="https://ddragon.leagueoflegends.com/cdn/13.24.1/img/profileicon/${player.profileIconId}.png" 
                     alt="Profile" class="mini-profile-icon">
            </div>
            <div class="player-info">
                <div class="player-name">${player.name}</div>
                <div class="player-region">${player.region.toUpperCase()}</div>
            </div>
            <div class="player-rank">
                <div class="rank-tier">${player.tier} ${player.rank}</div>
                <div class="rank-lp">${player.leaguePoints} LP</div>
            </div>
            <div class="player-stats">
                <div class="winrate">${Math.round((player.wins / (player.wins + player.losses)) * 100)}%</div>
                <div class="games">${player.wins + player.losses} games</div>
            </div>
        </div>
    `).join('');
}

function filterLeaderboard() {
    loadLeaderboard();
}

function filterLeaderboardByRegion(leaderboard) {
    const selectedRegion = elements.leaderboardRegion.value;
    if (selectedRegion === 'all') return leaderboard;
    return leaderboard.filter(player => player.region === selectedRegion);
}

function getLeaderboard() {
    const stored = localStorage.getItem(STORAGE_KEYS.leaderboard);
    return stored ? JSON.parse(stored) : [];
}

function saveLeaderboard(leaderboard) {
    localStorage.setItem(STORAGE_KEYS.leaderboard, JSON.stringify(leaderboard));
}

function validateSummonerName(name) {
    return /^[a-zA-Z0-9\s]{3,16}$/.test(name);
}

function showLoading(show) {
    elements.loading.classList.toggle('hidden', !show);
    elements.searchBtn.disabled = show;
}

function showNotification(message, type) {
    elements.notification.textContent = message;
    elements.notification.className = `notification ${type}`;
    elements.notification.classList.add('show');
    
    setTimeout(() => {
        elements.notification.classList.remove('show');
    }, 4000);
}

function getChampionName(championId) {
    // Simplified champion mapping - in production, this would use Data Dragon API
    const champions = {
        1: 'Annie', 2: 'Olaf', 3: 'Galio', 4: 'TwistedFate', 5: 'XinZhao',
        // Add more champions as needed
    };
    return champions[championId] || 'Unknown';
}

function createParticleEffect() {
    const particles = document.querySelector('.background-particles');
    
    for (let i = 0; i < 50; i++) {
        const particle = document.createElement('div');
        particle.style.cssText = `
            position: absolute;
            width: 2px;
            height: 2px;
            background: var(--riot-gold);
            border-radius: 50%;
            opacity: ${Math.random() * 0.5 + 0.1};
            left: ${Math.random() * 100}%;
            top: ${Math.random() * 100}%;
            animation: float ${Math.random() * 10 + 10}s linear infinite;
        `;
        particles.appendChild(particle);
    }
}

// Add CSS animation for particles
const style = document.createElement('style');
style.textContent = `
    @keyframes float {
        0% { transform: translateY(100vh) rotate(0deg); }
        100% { transform: translateY(-100vh) rotate(360deg); }
    }
`;
document.head.appendChild(style);
