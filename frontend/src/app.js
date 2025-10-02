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

// Riot API Rate Limits: 20 requests/1s, 100 requests/2min
const RATE_LIMITS = {
    SHORT_TERM: { requests: 20, window: 1000 }, // 20 requests per 1 second
    LONG_TERM: { requests: 100, window: 120000 } // 100 requests per 2 minutes
};

// Rate limiting tracking
const rateLimitTracker = {
    shortTerm: [],
    longTerm: [],
    
    // Add request timestamp
    addRequest() {
        const now = Date.now();
        this.shortTerm.push(now);
        this.longTerm.push(now);
        this.cleanup(now);
    },
    
    // Remove old requests outside the time windows
    cleanup(now) {
        this.shortTerm = this.shortTerm.filter(time => now - time < RATE_LIMITS.SHORT_TERM.window);
        this.longTerm = this.longTerm.filter(time => now - time < RATE_LIMITS.LONG_TERM.window);
    },
    
    // Check if we can make a request
    canMakeRequest() {
        const now = Date.now();
        this.cleanup(now);
        
        return this.shortTerm.length < RATE_LIMITS.SHORT_TERM.requests && 
               this.longTerm.length < RATE_LIMITS.LONG_TERM.requests;
    },
    
    // Calculate delay needed before next request
    getDelayUntilNextRequest() {
        const now = Date.now();
        this.cleanup(now);
        
        let delay = 0;
        
        // Check short-term limit
        if (this.shortTerm.length >= RATE_LIMITS.SHORT_TERM.requests) {
            const oldestShort = Math.min(...this.shortTerm);
            delay = Math.max(delay, RATE_LIMITS.SHORT_TERM.window - (now - oldestShort) + 100);
        }
        
        // Check long-term limit
        if (this.longTerm.length >= RATE_LIMITS.LONG_TERM.requests) {
            const oldestLong = Math.min(...this.longTerm);
            delay = Math.max(delay, RATE_LIMITS.LONG_TERM.window - (now - oldestLong) + 100);
        }
        
        return delay;
    }
};

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

async function makeApiRequest(url, retryCount = 0) {
    const maxRetries = 3;
    const baseDelay = 1000;
    
    // Wait for rate limit if needed
    if (!rateLimitTracker.canMakeRequest()) {
        const delay = rateLimitTracker.getDelayUntilNextRequest();
        console.log(`⏳ Rate limit reached, waiting ${delay}ms before next request`);
        await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    // Additional safety delay between requests
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    const minDelay = 50; // Minimum 50ms between requests
    
    if (timeSinceLastRequest < minDelay) {
        await new Promise(resolve => setTimeout(resolve, minDelay - timeSinceLastRequest));
    }
    
    lastRequestTime = Date.now();
    rateLimitTracker.addRequest();
    
    const fullUrl = `${url}?api_key=${API_CONFIG.key}`;
    console.log('🌐 Making API request to:', url);
    console.log('🔑 Using API key:', API_CONFIG.key.substring(0, 10) + '...');
    console.log('📊 Rate limit status:', {
        shortTerm: `${rateLimitTracker.shortTerm.length}/${RATE_LIMITS.SHORT_TERM.requests}`,
        longTerm: `${rateLimitTracker.longTerm.length}/${RATE_LIMITS.LONG_TERM.requests}`
    });
    
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
            
            // Handle specific error codes with retry logic
            if (response.status === 429) {
                // Rate limit exceeded - implement exponential backoff
                if (retryCount < maxRetries) {
                    const retryDelay = baseDelay * Math.pow(2, retryCount) + Math.random() * 1000;
                    console.log(`🔄 Rate limited (429), retrying in ${retryDelay}ms (attempt ${retryCount + 1}/${maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                    return makeApiRequest(url, retryCount + 1);
                } else {
                    throw new Error(`Rate limit exceeded (429): Maximum retries reached. ${errorBody || 'Please wait before making more requests'}`);
                }
            } else if (response.status === 503 || response.status === 500) {
                // Server errors - retry with exponential backoff
                if (retryCount < maxRetries) {
                    const retryDelay = baseDelay * Math.pow(2, retryCount);
                    console.log(`🔄 Server error (${response.status}), retrying in ${retryDelay}ms (attempt ${retryCount + 1}/${maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                    return makeApiRequest(url, retryCount + 1);
                } else {
                    throw new Error(`Server error (${response.status}): ${errorBody || 'Service temporarily unavailable'}`);
                }
            } else if (response.status === 401) {
                throw new Error(`API Authentication Failed (401): ${errorBody || 'Invalid or expired API key'}`);
            } else if (response.status === 403) {
                throw new Error(`API Access Forbidden (403): ${errorBody || 'API key lacks required permissions or rate limited'}`);
            } else if (response.status === 404) {
                throw new Error(`Summoner not found (404): ${errorBody || 'The requested summoner does not exist'}`);
            } else {
                throw new Error(`API request failed (${response.status}): ${errorBody || 'Unknown error'}`);
            }
        }
        
        const data = await response.json();
        console.log('✅ API response successful:', data);
        return data;
        
    } catch (error) {
        console.error('🚨 API request error:', error);
        
        // Network or other fetch errors - retry for network issues
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            if (retryCount < maxRetries) {
                const retryDelay = baseDelay * Math.pow(2, retryCount);
                console.log(`🔄 Network error, retrying in ${retryDelay}ms (attempt ${retryCount + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                return makeApiRequest(url, retryCount + 1);
            } else {
                throw new Error(`Network error: Unable to connect to Riot Games API after ${maxRetries} attempts. Please check your internet connection.`);
            }
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
