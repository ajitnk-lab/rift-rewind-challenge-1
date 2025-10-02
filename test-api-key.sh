#!/bin/bash

# Test Riot Games API Key
API_KEY="RGAPI-afe09931-a170-4541-8f25-2b071c0ab4ed"

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
