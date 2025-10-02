#!/bin/bash

# Rift Rewind - Cross-Region and Error Scenario Testing Script
# This script tests various scenarios to ensure robustness and reliability

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test configuration
TEST_REGIONS=("us-east-1" "us-west-2" "eu-west-1")
RIOT_REGIONS=("na1" "euw1" "eune1" "kr" "jp1")
TEST_SUMMONERS=("Faker" "Doublelift" "Bjergsen" "InvalidSummoner123456789")

# Functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_test() {
    echo -e "${YELLOW}🧪 TEST: $1${NC}"
}

# Test AWS CLI and credentials
test_aws_connectivity() {
    log_test "AWS Connectivity and Credentials"
    
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials not configured or invalid"
        return 1
    fi
    
    local account_id=$(aws sts get-caller-identity --query Account --output text)
    local user_arn=$(aws sts get-caller-identity --query Arn --output text)
    
    log_info "AWS Account ID: $account_id"
    log_info "User/Role ARN: $user_arn"
    log_success "AWS connectivity test passed"
}

# Test cross-region functionality
test_cross_region_deployment() {
    log_test "Cross-Region Deployment Capability"
    
    for region in "${TEST_REGIONS[@]}"; do
        log_info "Testing region: $region"
        
        # Check if region is available
        if aws ec2 describe-regions --region-names $region &> /dev/null; then
            log_success "Region $region is accessible"
            
            # Test CDK bootstrap capability
            if aws cloudformation describe-stacks --stack-name CDKToolkit --region $region &> /dev/null; then
                log_info "CDK already bootstrapped in $region"
            else
                log_warning "CDK not bootstrapped in $region (would need: cdk bootstrap --region $region)"
            fi
        else
            log_error "Region $region is not accessible"
        fi
    done
}

# Test Riot Games API connectivity
test_riot_api_connectivity() {
    log_test "Riot Games API Connectivity"
    
    # Read API key from local env file
    if [ -f ".env.local" ]; then
        source .env.local
        API_KEY=$RIOT_API_KEY
    else
        log_error ".env.local file not found"
        return 1
    fi
    
    if [ -z "$API_KEY" ]; then
        log_error "RIOT_API_KEY not found in .env.local"
        return 1
    fi
    
    for region in "${RIOT_REGIONS[@]}"; do
        log_info "Testing Riot API region: $region"
        
        # Test API connectivity with a simple endpoint
        local response=$(curl -s -w "%{http_code}" -o /dev/null \
            "https://$region.api.riotgames.com/lol/status/v4/platform-data?api_key=$API_KEY")
        
        if [ "$response" = "200" ]; then
            log_success "Riot API $region is accessible"
        elif [ "$response" = "403" ]; then
            log_error "Riot API $region returned 403 (API key invalid or rate limited)"
        elif [ "$response" = "429" ]; then
            log_warning "Riot API $region returned 429 (rate limited)"
        else
            log_error "Riot API $region returned HTTP $response"
        fi
        
        # Rate limiting - wait between requests
        sleep 2
    done
}

# Test error scenarios
test_error_scenarios() {
    log_test "Error Scenario Handling"
    
    # Test invalid summoner names
    log_info "Testing invalid summoner name handling"
    
    # Test with various invalid inputs
    local invalid_inputs=("" "a" "verylongsummonernamethatexceedslimit" "invalid@name" "name with spaces")
    
    for invalid_name in "${invalid_inputs[@]}"; do
        log_info "Testing invalid input: '$invalid_name'"
        
        # This would be tested in the frontend JavaScript
        # For now, we'll just validate the pattern
        if [[ "$invalid_name" =~ ^[a-zA-Z0-9\s]{3,16}$ ]]; then
            log_warning "Input '$invalid_name' passes basic validation but may still be invalid"
        else
            log_success "Input '$invalid_name' correctly fails validation"
        fi
    done
}

# Test frontend build process
test_frontend_build() {
    log_test "Frontend Build Process"
    
    cd frontend
    
    # Test if package.json exists
    if [ ! -f "package.json" ]; then
        log_error "Frontend package.json not found"
        cd ..
        return 1
    fi
    
    # Test npm install
    log_info "Testing npm install..."
    if npm install --silent; then
        log_success "npm install completed successfully"
    else
        log_error "npm install failed"
        cd ..
        return 1
    fi
    
    # Test build process
    log_info "Testing build process..."
    if npm run build; then
        log_success "Frontend build completed successfully"
        
        # Check if dist files were created
        if [ -f "dist/index.html" ] && [ -f "dist/styles.css" ] && [ -f "dist/app.js" ]; then
            log_success "All required build files created"
            
            # Check file sizes
            local html_size=$(stat -f%z "dist/index.html" 2>/dev/null || stat -c%s "dist/index.html" 2>/dev/null)
            local css_size=$(stat -f%z "dist/styles.css" 2>/dev/null || stat -c%s "dist/styles.css" 2>/dev/null)
            local js_size=$(stat -f%z "dist/app.js" 2>/dev/null || stat -c%s "dist/app.js" 2>/dev/null)
            
            log_info "Build file sizes - HTML: ${html_size}B, CSS: ${css_size}B, JS: ${js_size}B"
        else
            log_error "Some build files are missing"
        fi
    else
        log_error "Frontend build failed"
        cd ..
        return 1
    fi
    
    cd ..
}

# Test infrastructure validation
test_infrastructure_validation() {
    log_test "Infrastructure Validation"
    
    cd infrastructure
    
    # Test if package.json exists
    if [ ! -f "package.json" ]; then
        log_error "Infrastructure package.json not found"
        cd ..
        return 1
    fi
    
    # Test npm install
    log_info "Testing CDK dependencies installation..."
    if npm install --silent; then
        log_success "CDK dependencies installed successfully"
    else
        log_error "CDK dependencies installation failed"
        cd ..
        return 1
    fi
    
    # Test TypeScript compilation
    log_info "Testing TypeScript compilation..."
    if npm run build; then
        log_success "TypeScript compilation successful"
    else
        log_error "TypeScript compilation failed"
        cd ..
        return 1
    fi
    
    # Test CDK synth
    log_info "Testing CDK synthesis..."
    if npx cdk synth > /dev/null; then
        log_success "CDK synthesis successful"
    else
        log_error "CDK synthesis failed"
        cd ..
        return 1
    fi
    
    # Run infrastructure tests
    log_info "Running infrastructure tests..."
    if npm test; then
        log_success "Infrastructure tests passed"
    else
        log_error "Infrastructure tests failed"
        cd ..
        return 1
    fi
    
    cd ..
}

# Test deployment script validation
test_deployment_script() {
    log_test "Deployment Script Validation"
    
    # Check if deployment script exists and is executable
    if [ ! -f "deploy.sh" ]; then
        log_error "deploy.sh not found"
        return 1
    fi
    
    if [ ! -x "deploy.sh" ]; then
        log_error "deploy.sh is not executable"
        return 1
    fi
    
    # Test deployment script help
    log_info "Testing deployment script help..."
    if ./deploy.sh --help > /dev/null; then
        log_success "Deployment script help works"
    else
        log_error "Deployment script help failed"
        return 1
    fi
    
    log_success "Deployment script validation passed"
}

# Test security configurations
test_security_configurations() {
    log_test "Security Configuration Validation"
    
    # Check .gitignore
    if [ -f ".gitignore" ]; then
        log_success ".gitignore file exists"
        
        # Check for sensitive patterns
        if grep -q "node_modules" .gitignore && grep -q "\.env" .gitignore; then
            log_success ".gitignore contains essential exclusions"
        else
            log_warning ".gitignore may be missing important exclusions"
        fi
    else
        log_error ".gitignore file not found"
    fi
    
    # Check for exposed secrets in code
    log_info "Scanning for potential exposed secrets..."
    
    if grep -r "RGAPI-" --exclude-dir=node_modules --exclude-dir=.git --exclude="*.sh" . | grep -v ".env.local"; then
        log_error "Potential exposed API keys found in code"
    else
        log_success "No exposed API keys found in committed code"
    fi
    
    # Check CDK security configurations
    if grep -q "BlockPublicAccess.BLOCK_ALL" infrastructure/lib/rift-rewind-stack.ts; then
        log_success "S3 bucket has public access blocked"
    else
        log_warning "S3 bucket public access configuration not found"
    fi
    
    if grep -q "ViewerProtocolPolicy.REDIRECT_TO_HTTPS" infrastructure/lib/rift-rewind-stack.ts; then
        log_success "CloudFront HTTPS enforcement configured"
    else
        log_warning "CloudFront HTTPS enforcement not found"
    fi
}

# Test performance optimizations
test_performance_optimizations() {
    log_test "Performance Optimization Validation"
    
    # Check if build script exists
    if [ -f "frontend/build.js" ]; then
        log_success "Build optimization script exists"
        
        # Check for minification functions
        if grep -q "minify" frontend/build.js; then
            log_success "Minification functions found in build script"
        else
            log_warning "Minification functions not found in build script"
        fi
    else
        log_error "Build optimization script not found"
    fi
    
    # Check CDK for performance configurations
    if grep -q "compress: true" infrastructure/lib/rift-rewind-stack.ts; then
        log_success "CloudFront compression enabled"
    else
        log_warning "CloudFront compression configuration not found"
    fi
    
    if grep -q "CachePolicy.CACHING_OPTIMIZED" infrastructure/lib/rift-rewind-stack.ts; then
        log_success "Optimized caching policy configured"
    else
        log_warning "Optimized caching policy not found"
    fi
}

# Main test execution
main() {
    echo "🧪 Starting Rift Rewind Test Suite..."
    echo "========================================"
    echo ""
    
    local test_results=()
    local failed_tests=0
    
    # Run all tests
    tests=(
        "test_aws_connectivity"
        "test_cross_region_deployment"
        "test_riot_api_connectivity"
        "test_error_scenarios"
        "test_frontend_build"
        "test_infrastructure_validation"
        "test_deployment_script"
        "test_security_configurations"
        "test_performance_optimizations"
    )
    
    for test in "${tests[@]}"; do
        echo ""
        if $test; then
            test_results+=("✅ $test")
        else
            test_results+=("❌ $test")
            ((failed_tests++))
        fi
    done
    
    # Summary
    echo ""
    echo "========================================"
    echo "🏁 Test Suite Summary"
    echo "========================================"
    
    for result in "${test_results[@]}"; do
        echo "$result"
    done
    
    echo ""
    if [ $failed_tests -eq 0 ]; then
        log_success "All tests passed! 🎉"
        echo ""
        echo "✨ Your Rift Rewind application is ready for deployment!"
        echo "🚀 Run './deploy.sh' to deploy to AWS"
    else
        log_error "$failed_tests test(s) failed"
        echo ""
        echo "🔧 Please fix the failing tests before deployment"
        exit 1
    fi
}

# Run main function
main "$@"
