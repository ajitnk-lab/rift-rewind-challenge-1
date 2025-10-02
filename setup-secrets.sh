#!/bin/bash

# Setup AWS Secrets Manager with Riot Games API Key
# This script securely stores the API key in AWS Secrets Manager

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
AWS_REGION=${AWS_REGION:-us-east-1}
SECRET_NAME="rift-rewind/riot-api-key"
GITHUB_SECRET_NAME="rift-rewind/github-token"

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

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed"
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        log_error "jq is not installed (required for JSON processing)"
        exit 1
    fi
    
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials not configured"
        exit 1
    fi
    
    log_success "Prerequisites met"
}

# Store Riot API key in Secrets Manager
store_riot_api_key() {
    local api_key="$1"
    
    if [ -z "$api_key" ]; then
        log_error "API key is required"
        return 1
    fi
    
    log_info "Storing Riot Games API key in AWS Secrets Manager..."
    
    # Create or update the secret
    if aws secretsmanager describe-secret --secret-id "$SECRET_NAME" --region "$AWS_REGION" &> /dev/null; then
        log_info "Updating existing secret..."
        aws secretsmanager update-secret \
            --secret-id "$SECRET_NAME" \
            --secret-string "{\"apiKey\":\"$api_key\"}" \
            --region "$AWS_REGION" > /dev/null
    else
        log_info "Creating new secret..."
        aws secretsmanager create-secret \
            --name "$SECRET_NAME" \
            --description "Riot Games API key for Rift Rewind application" \
            --secret-string "{\"apiKey\":\"$api_key\"}" \
            --region "$AWS_REGION" > /dev/null
    fi
    
    log_success "Riot API key stored securely in Secrets Manager"
}

# Store GitHub token in Secrets Manager
store_github_token() {
    local github_token="$1"
    
    if [ -z "$github_token" ]; then
        log_warning "GitHub token not provided, skipping..."
        return 0
    fi
    
    log_info "Storing GitHub token in AWS Secrets Manager..."
    
    # Create or update the secret
    if aws secretsmanager describe-secret --secret-id "$GITHUB_SECRET_NAME" --region "$AWS_REGION" &> /dev/null; then
        log_info "Updating existing GitHub token secret..."
        aws secretsmanager update-secret \
            --secret-id "$GITHUB_SECRET_NAME" \
            --secret-string "{\"token\":\"$github_token\"}" \
            --region "$AWS_REGION" > /dev/null
    else
        log_info "Creating new GitHub token secret..."
        aws secretsmanager create-secret \
            --name "$GITHUB_SECRET_NAME" \
            --description "GitHub Personal Access Token for Amplify CI/CD" \
            --secret-string "{\"token\":\"$github_token\"}" \
            --region "$AWS_REGION" > /dev/null
    fi
    
    log_success "GitHub token stored securely in Secrets Manager"
}

# Test secret retrieval
test_secret_retrieval() {
    log_info "Testing secret retrieval..."
    
    # Test Riot API key
    local retrieved_key=$(aws secretsmanager get-secret-value \
        --secret-id "$SECRET_NAME" \
        --region "$AWS_REGION" \
        --query SecretString \
        --output text | jq -r .apiKey 2>/dev/null)
    
    if [ -n "$retrieved_key" ] && [ "$retrieved_key" != "null" ]; then
        log_success "Riot API key retrieval test passed"
        log_info "Retrieved key: ${retrieved_key:0:10}..."
    else
        log_error "Failed to retrieve Riot API key from Secrets Manager"
        return 1
    fi
}

# Read secrets from .env.local
read_local_secrets() {
    if [ -f ".env.local" ]; then
        source .env.local
        log_info "Reading secrets from .env.local"
        
        if [ -n "$RIOT_API_KEY" ]; then
            log_info "Found Riot API key: ${RIOT_API_KEY:0:10}..."
            store_riot_api_key "$RIOT_API_KEY"
        else
            log_warning "RIOT_API_KEY not found in .env.local"
        fi
        
        if [ -n "$GITHUB_PAT" ]; then
            log_info "Found GitHub token: ${GITHUB_PAT:0:10}..."
            store_github_token "$GITHUB_PAT"
        else
            log_warning "GITHUB_PAT not found in .env.local"
        fi
    else
        log_error ".env.local file not found"
        return 1
    fi
}

# Main function
main() {
    echo "🔐 Setting up AWS Secrets Manager for Rift Rewind"
    echo "=============================================="
    echo ""
    
    check_prerequisites
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --api-key)
                RIOT_API_KEY="$2"
                shift 2
                ;;
            --github-token)
                GITHUB_TOKEN="$2"
                shift 2
                ;;
            --region)
                AWS_REGION="$2"
                shift 2
                ;;
            --from-env)
                read_local_secrets
                shift
                ;;
            --help)
                echo "Usage: $0 [OPTIONS]"
                echo "Options:"
                echo "  --api-key KEY       Riot Games API key to store"
                echo "  --github-token TOK  GitHub Personal Access Token"
                echo "  --region REGION     AWS region (default: us-east-1)"
                echo "  --from-env          Read secrets from .env.local file"
                echo "  --help              Show this help message"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # If no arguments provided, read from .env.local
    if [ -z "$RIOT_API_KEY" ] && [ -z "$GITHUB_TOKEN" ]; then
        read_local_secrets
    else
        # Store provided secrets
        if [ -n "$RIOT_API_KEY" ]; then
            store_riot_api_key "$RIOT_API_KEY"
        fi
        
        if [ -n "$GITHUB_TOKEN" ]; then
            store_github_token "$GITHUB_TOKEN"
        fi
    fi
    
    test_secret_retrieval
    
    echo ""
    log_success "Secrets setup completed successfully! 🎉"
    echo ""
    echo "📋 Next steps:"
    echo "1. Deploy infrastructure: cd infrastructure && cdk deploy"
    echo "2. Run deployment: ./deploy.sh"
    echo "3. Secrets will be automatically retrieved during build/deploy"
}

# Run main function
main "$@"
