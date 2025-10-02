#!/bin/bash

# Rift Rewind Deployment Script
# This script handles the complete deployment process for the Rift Rewind application

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
AWS_REGION=${AWS_REGION:-us-east-1}
STACK_NAME="RiftRewindStack"
FRONTEND_DIR="frontend"
INFRASTRUCTURE_DIR="infrastructure"

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

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if AWS CLI is installed
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed. Please install it first."
        exit 1
    fi
    
    # Check if CDK is installed
    if ! command -v cdk &> /dev/null; then
        log_error "AWS CDK is not installed. Please install it first."
        exit 1
    fi
    
    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed. Please install it first."
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials not configured. Please run 'aws configure' first."
        exit 1
    fi
    
    log_success "All prerequisites met"
}

build_frontend() {
    log_info "Building frontend..."
    
    cd $FRONTEND_DIR
    
    # Install dependencies if package.json exists
    if [ -f "package.json" ]; then
        log_info "Installing frontend dependencies..."
        npm install
    fi
    
    # Build frontend
    log_info "Optimizing frontend files..."
    npm run build
    
    cd ..
    log_success "Frontend build completed"
}

deploy_infrastructure() {
    log_info "Deploying AWS infrastructure..."
    
    cd $INFRASTRUCTURE_DIR
    
    # Install CDK dependencies
    log_info "Installing CDK dependencies..."
    npm install
    
    # Bootstrap CDK if needed
    log_info "Bootstrapping CDK..."
    cdk bootstrap --region $AWS_REGION
    
    # Deploy stack
    log_info "Deploying CDK stack..."
    cdk deploy --require-approval never --region $AWS_REGION
    
    cd ..
    log_success "Infrastructure deployment completed"
}

upload_frontend() {
    log_info "Uploading frontend files to S3..."
    
    # Get S3 bucket name from CDK outputs
    BUCKET_NAME=$(aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --region $AWS_REGION \
        --query 'Stacks[0].Outputs[?OutputKey==`WebsiteBucketName`].OutputValue' \
        --output text)
    
    if [ -z "$BUCKET_NAME" ]; then
        log_error "Could not retrieve S3 bucket name from stack outputs"
        exit 1
    fi
    
    log_info "Uploading to bucket: $BUCKET_NAME"
    
    # Upload files with proper content types and cache headers
    aws s3 sync $FRONTEND_DIR/dist/ s3://$BUCKET_NAME/ \
        --delete \
        --region $AWS_REGION \
        --cache-control "public, max-age=31536000" \
        --metadata-directive REPLACE
    
    # Set specific cache headers for HTML files
    aws s3 cp s3://$BUCKET_NAME/index.html s3://$BUCKET_NAME/index.html \
        --metadata-directive REPLACE \
        --cache-control "public, max-age=0, must-revalidate" \
        --content-type "text/html" \
        --region $AWS_REGION
    
    log_success "Frontend files uploaded successfully"
}

invalidate_cloudfront() {
    log_info "Invalidating CloudFront cache..."
    
    # Get CloudFront distribution ID from CDK outputs
    DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --region $AWS_REGION \
        --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistributionId`].OutputValue' \
        --output text)
    
    if [ -z "$DISTRIBUTION_ID" ]; then
        log_error "Could not retrieve CloudFront distribution ID from stack outputs"
        exit 1
    fi
    
    log_info "Invalidating distribution: $DISTRIBUTION_ID"
    
    aws cloudfront create-invalidation \
        --distribution-id $DISTRIBUTION_ID \
        --paths "/*" \
        --region $AWS_REGION
    
    log_success "CloudFront invalidation initiated"
}

get_deployment_info() {
    log_info "Retrieving deployment information..."
    
    # Get stack outputs
    WEBSITE_URL=$(aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --region $AWS_REGION \
        --query 'Stacks[0].Outputs[?OutputKey==`WebsiteURL`].OutputValue' \
        --output text)
    
    AMPLIFY_URL=$(aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --region $AWS_REGION \
        --query 'Stacks[0].Outputs[?OutputKey==`AmplifyAppUrl`].OutputValue' \
        --output text)
    
    echo ""
    echo "🎉 Deployment completed successfully!"
    echo ""
    echo "📊 Deployment Information:"
    echo "├── CloudFront URL: $WEBSITE_URL"
    echo "├── Amplify URL: $AMPLIFY_URL"
    echo "├── AWS Region: $AWS_REGION"
    echo "├── Stack Name: $STACK_NAME"
    echo "└── Deployment Time: $(date)"
    echo ""
    echo "🔗 Access your application at: $WEBSITE_URL"
}

run_tests() {
    log_info "Running infrastructure tests..."
    
    cd $INFRASTRUCTURE_DIR
    npm test
    cd ..
    
    log_success "All tests passed"
}

# Main deployment process
main() {
    echo "🚀 Starting Rift Rewind deployment process..."
    echo ""
    
    check_prerequisites
    
    # Parse command line arguments
    SKIP_TESTS=false
    SKIP_BUILD=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-tests)
                SKIP_TESTS=true
                shift
                ;;
            --skip-build)
                SKIP_BUILD=true
                shift
                ;;
            --region)
                AWS_REGION="$2"
                shift 2
                ;;
            --help)
                echo "Usage: $0 [OPTIONS]"
                echo "Options:"
                echo "  --skip-tests    Skip running tests"
                echo "  --skip-build    Skip frontend build"
                echo "  --region        AWS region (default: us-east-1)"
                echo "  --help          Show this help message"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Run tests if not skipped
    if [ "$SKIP_TESTS" = false ]; then
        run_tests
    fi
    
    # Build frontend if not skipped
    if [ "$SKIP_BUILD" = false ]; then
        build_frontend
    fi
    
    deploy_infrastructure
    upload_frontend
    invalidate_cloudfront
    get_deployment_info
    
    log_success "Deployment process completed successfully! 🎉"
}

# Run main function
main "$@"
