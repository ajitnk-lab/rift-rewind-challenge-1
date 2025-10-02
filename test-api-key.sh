#!/bin/bash

# Test Riot Games API Key
API_KEY="RGAPI-3135fd4b-9af6-4efa-9a8b-0ec4729c36cd"

echo "🔑 Testing Riot Games API Key: ${API_KEY:0:10}..."
echo ""

# Test different endpoints to see which ones work
endpoints=(
    "https://na1.api.riotgames.com/lol/status/v4/platform-data"
    "https://na1.api.riotgames.com/lol/summoner/v4/summoners/by-name/Faker"
    "https://euw1.api.riotgames.com/lol/status/v4/platform-data"
    "https://kr.api.riotgames.com/lol/summoner/v4/summoners/by-name/Faker"
)

for endpoint in "${endpoints[@]}"; do
    echo "🌐 Testing: $endpoint"
    
    response=$(curl -s -w "HTTPSTATUS:%{http_code}" "$endpoint?api_key=$API_KEY")
    http_code=$(echo $response | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
    body=$(echo $response | sed -e 's/HTTPSTATUS\:.*//g')
    
    echo "   Status: $http_code"
    echo "   Response: $body"
    echo ""
    
    # Add delay to respect rate limits
    sleep 2
done

echo "✅ API key test completed"
