# 🚀 Deployment Guide - Rift Rewind

This guide provides comprehensive instructions for deploying the Rift Rewind application to AWS using best practices and automated deployment scripts.

## 📋 Prerequisites

### Required Tools
- **AWS CLI** (v2.0+) - [Installation Guide](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
- **AWS CDK** (v2.87.0+) - `npm install -g aws-cdk`
- **Node.js** (v18+) - [Download](https://nodejs.org/)
- **Git** - For version control

### AWS Account Setup
1. **AWS Account** with appropriate permissions
2. **AWS CLI configured** with credentials:
   ```bash
   aws configure
   ```
3. **CDK Bootstrap** (will be done automatically by deployment script)

### Required AWS Permissions
Your AWS user/role needs the following permissions:
- CloudFormation (full access)
- S3 (full access)
- CloudFront (full access)
- Amplify (full access)
- IAM (create/manage roles and policies)
- Secrets Manager (full access)
- CloudWatch Logs (full access)

## 🎯 Quick Deployment

### One-Command Deployment
```bash
./deploy.sh
```

This script will:
1. ✅ Check all prerequisites
2. 🏗️ Build and optimize frontend files
3. 🚀 Deploy AWS infrastructure via CDK
4. 📤 Upload optimized files to S3
5. 🔄 Invalidate CloudFront cache
6. 📊 Display deployment information

### Deployment Options
```bash
# Deploy to specific region
./deploy.sh --region us-west-2

# Skip tests during deployment
./deploy.sh --skip-tests

# Skip frontend build (use existing dist files)
./deploy.sh --skip-build

# Show help
./deploy.sh --help
```

## 🔧 Manual Deployment Steps

### 1. Frontend Build
```bash
cd frontend
npm install
npm run build
cd ..
```

### 2. Infrastructure Deployment
```bash
cd infrastructure
npm install
cdk bootstrap
cdk deploy
cd ..
```

### 3. Frontend Upload
```bash
# Get bucket name from CDK outputs
BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name RiftRewindStack \
  --query 'Stacks[0].Outputs[?OutputKey==`WebsiteBucketName`].OutputValue' \
  --output text)

# Upload files
aws s3 sync frontend/dist/ s3://$BUCKET_NAME/ --delete
```

### 4. CloudFront Invalidation
```bash
# Get distribution ID
DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
  --stack-name RiftRewindStack \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistributionId`].OutputValue' \
  --output text)

# Create invalidation
aws cloudfront create-invalidation \
  --distribution-id $DISTRIBUTION_ID \
  --paths "/*"
```

## 🏗️ Infrastructure Architecture

### AWS Services Used
- **Amazon S3** - Static website hosting (private bucket)
- **Amazon CloudFront** - Global CDN with HTTPS
- **AWS Amplify** - CI/CD pipeline
- **AWS Secrets Manager** - Secure API key storage
- **Amazon CloudWatch** - Logging and monitoring
- **AWS IAM** - Security and access control

### Security Features
- 🔒 Private S3 bucket with Origin Access Identity (OAI)
- 🛡️ HTTPS enforcement across all services
- 🔐 API keys stored in AWS Secrets Manager
- 🎯 IAM roles with least privilege access
- 📊 Comprehensive logging and monitoring

### Cost Optimization
- 💰 Free Tier compliant configuration
- 🌍 Regional restrictions (US, Canada, Europe only)
- ⏰ Lifecycle policies for old versions
- 📈 Efficient caching strategies

## 🔄 CI/CD Pipeline

### Amplify Integration
The deployment includes an AWS Amplify app that automatically:
1. Monitors the GitHub repository
2. Triggers builds on code changes
3. Deploys updates automatically
4. Provides build logs and status

### GitHub Integration
1. **Repository**: `https://github.com/ajitnk-lab/rift-rewind-challenge-1`
2. **Branch**: `main`
3. **Auto-deploy**: Enabled for main branch

## 🧪 Testing

### Infrastructure Tests
```bash
cd infrastructure
npm test
```

### Frontend Testing
```bash
cd frontend
npm run dev  # Start development server
npm run serve  # Serve built files
```

## 📊 Performance Optimizations

### Build Optimizations
- **HTML Minification** - Removes whitespace and comments
- **CSS Minification** - Compresses stylesheets
- **JavaScript Minification** - Reduces file sizes
- **Gzip Compression** - Enabled via CloudFront
- **Cache Headers** - Optimized for performance

### Performance Metrics
The build process provides optimization statistics:
```
📊 Optimization Results:
HTML: 15,234 → 12,456 bytes (18% reduction)
CSS: 8,567 → 6,234 bytes (27% reduction)
JS: 25,678 → 18,234 bytes (29% reduction)
Total: 49,479 → 36,924 bytes (25% reduction)
```

## 🔍 Monitoring and Logging

### CloudWatch Integration
- **CloudFront Logs** - Access and error logs
- **Amplify Logs** - Build and deployment logs
- **Application Logs** - Custom application metrics

### Log Retention
- CloudFront: 30 days
- Amplify: 30 days
- Custom logs: Configurable

## 🛠️ Troubleshooting

### Common Issues

#### 1. CDK Bootstrap Error
```bash
# Solution: Bootstrap CDK in your region
cdk bootstrap --region us-east-1
```

#### 2. Permission Denied
```bash
# Solution: Check AWS credentials and permissions
aws sts get-caller-identity
```

#### 3. Build Failures
```bash
# Solution: Clean and rebuild
cd frontend
npm run clean
npm run build
```

#### 4. CloudFront Cache Issues
```bash
# Solution: Invalidate cache
aws cloudfront create-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --paths "/*"
```

### Debug Commands
```bash
# Check stack status
aws cloudformation describe-stacks --stack-name RiftRewindStack

# View CDK diff
cd infrastructure && cdk diff

# Check S3 bucket contents
aws s3 ls s3://YOUR_BUCKET_NAME --recursive

# View CloudFront distributions
aws cloudfront list-distributions
```

## 🔄 Updates and Maintenance

### Updating the Application
1. Make changes to code
2. Commit to GitHub
3. Run deployment script or let Amplify auto-deploy
4. Monitor deployment status

### Updating Infrastructure
1. Modify CDK stack in `infrastructure/lib/rift-rewind-stack.ts`
2. Run `cdk diff` to preview changes
3. Run `cdk deploy` to apply changes

### Secrets Management
```bash
# Update Riot Games API key
aws secretsmanager update-secret \
  --secret-id rift-rewind/riot-api-key \
  --secret-string '{"apiKey":"NEW_API_KEY"}'

# Update GitHub token
aws secretsmanager update-secret \
  --secret-id rift-rewind/github-token \
  --secret-string '{"token":"NEW_GITHUB_TOKEN"}'
```

## 🗑️ Cleanup

### Remove All Resources
```bash
# Delete CDK stack (removes all AWS resources)
cd infrastructure
cdk destroy

# Clean local build files
cd ../frontend
npm run clean
```

## 📞 Support

### Getting Help
- Check AWS CloudFormation console for stack events
- Review CloudWatch logs for application errors
- Use AWS CLI for debugging commands
- Check GitHub Actions for CI/CD issues

### Useful Links
- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [AWS Amplify Documentation](https://docs.aws.amazon.com/amplify/)
- [CloudFront Documentation](https://docs.aws.amazon.com/cloudfront/)
- [Project Repository](https://github.com/ajitnk-lab/rift-rewind-challenge-1)

---

**Built with ❤️ for the League of Legends community**
