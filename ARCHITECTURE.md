# Rift Rewind - Architecture Documentation

## 🏗️ Well-Architected Design

This project implements a Riot Games-inspired League of Legends player insights website following AWS Well-Architected Framework principles.

## 🎯 Project Overview

**Rift Rewind** is a modern web application that provides comprehensive League of Legends player insights through the Riot Games API. The application features a unique gaming-inspired design with innovative community features.

### Key Features
- **Player Search & Insights**: Real-time summoner data, ranked statistics, and match history
- **Community Leaderboard**: Local storage-based ranking system for discovered players
- **Interactive Visualizations**: Champion mastery charts and animated UI elements
- **Responsive Design**: Mobile-first approach with creative CSS animations
- **Security-First**: Input sanitization, rate limiting, and secure API handling

## 🏛️ Architecture Components

### Frontend Architecture
```
frontend/
├── public/
│   └── index.html          # Main HTML structure
├── src/
│   ├── css/
│   │   └── styles.css      # Riot Games-inspired styling
│   └── js/
│       ├── config.js       # Configuration and security
│       ├── api.js          # Riot Games API integration
│       ├── ui.js           # UI management and interactions
│       ├── leaderboard.js  # Community leaderboard feature
│       └── app.js          # Main application controller
└── dist/                   # Build output directory
```

### Infrastructure Architecture
```
infrastructure/
├── lib/
│   └── infrastructure-stack.ts  # CDK infrastructure definition
├── bin/
│   └── infrastructure.ts        # CDK app entry point
└── cdk.json                     # CDK configuration
```

## ☁️ AWS Infrastructure

### Core Services
- **Amazon S3**: Secure static website hosting with private bucket access
- **Amazon CloudFront**: Global CDN for optimal performance and security
- **AWS Amplify**: CI/CD pipeline with GitHub integration
- **AWS Secrets Manager**: Secure storage for GitHub tokens and API keys

### Security Implementation
- **S3 Bucket Security**: Block all public access, CloudFront-only distribution
- **HTTPS Enforcement**: Redirect HTTP to HTTPS via CloudFront
- **Secret Management**: Environment variables and AWS Secrets Manager
- **Input Validation**: Client-side sanitization and rate limiting

## 🚀 CI/CD Pipeline

### GitHub Integration
1. **Source Control**: GitHub repository with branch protection
2. **Automated Builds**: Amplify triggers on main branch commits
3. **Build Process**: npm-based build with file copying to dist/
4. **Deployment**: Automatic deployment to Amplify hosting

### Build Specification
```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - cd frontend
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: frontend/dist
    files:
      - '**/*'
```

## 🎮 Riot Games API Integration

### API Endpoints Used
- **Summoner API**: Player profile and basic information
- **League API**: Ranked statistics and tier information
- **Match API**: Recent match history and game details
- **Champion Mastery API**: Champion proficiency data

### Rate Limiting & Caching
- **Client-side Rate Limiting**: 100 requests per 2 minutes
- **Request Caching**: 5-minute cache for API responses
- **Error Handling**: Comprehensive error messages and retry logic

## 🌟 Innovative Features

### Community Leaderboard
- **Local Storage**: Client-side persistence for discovered players
- **Ranking Algorithm**: Score-based system using tier, rank, and LP
- **Regional Filtering**: Filter players by region (NA, EUW, KR, etc.)
- **Search Tracking**: Track how often players are searched

### Interactive Elements
- **Particle System**: Animated background effects
- **Loading Animations**: Rift portal-inspired loading screens
- **Hover Effects**: Dynamic card animations and glow effects
- **Responsive Charts**: Canvas-based champion mastery visualization

### Creative Design
- **Color Scheme**: Riot Games gold (#c89b3c) and blue (#0f2027) palette
- **Typography**: Cinzel serif for headings, Inter for body text
- **Animations**: CSS keyframes for glow, float, and fade effects
- **Mobile Responsive**: Adaptive layout for all screen sizes

## 💰 AWS Free Tier Optimization

### Cost-Effective Design
- **Static Hosting**: S3 + CloudFront for minimal costs
- **Client-side Processing**: Reduce server-side compute needs
- **Local Storage**: Avoid database costs for leaderboard feature
- **Efficient Caching**: Minimize API calls and data transfer

### Resource Limits
- **S3 Storage**: Under 5GB for static assets
- **CloudFront**: 1TB data transfer per month
- **Amplify**: 1000 build minutes per month
- **API Calls**: Rate-limited to stay within quotas

## 🔒 Security Best Practices

### Input Security
- **Sanitization**: Remove XSS-prone characters from user input
- **Validation**: Verify region codes and summoner name formats
- **Length Limits**: Restrict input length to prevent abuse

### API Security
- **Environment Variables**: Store sensitive keys securely
- **CORS Headers**: Proper cross-origin request handling
- **Timeout Handling**: Prevent hanging requests
- **Error Masking**: Don't expose internal error details

### Infrastructure Security
- **Private S3 Bucket**: No public read access
- **CloudFront OAI**: Origin Access Identity for S3 access
- **HTTPS Only**: Force secure connections
- **Secret Rotation**: Use AWS Secrets Manager for tokens

## 📊 Performance Optimizations

### Frontend Performance
- **Minified Assets**: Compressed CSS and JavaScript
- **Image Optimization**: Optimized profile icons and assets
- **Lazy Loading**: Load content as needed
- **Caching Strategy**: Browser and API response caching

### Network Performance
- **CDN Distribution**: Global CloudFront edge locations
- **Compression**: Gzip compression for text assets
- **HTTP/2**: Modern protocol support
- **DNS Optimization**: Fast domain resolution

## 🚀 Deployment Instructions

### Prerequisites
- AWS CLI configured with appropriate permissions
- Node.js 18+ and npm
- AWS CDK CLI installed globally

### Infrastructure Deployment
```bash
cd infrastructure
npm install
npx cdk bootstrap
npx cdk deploy
```

### Frontend Deployment
```bash
cd frontend
npm install
npm run build
# Amplify automatically deploys on git push
```

## 🔮 Future Enhancements

### Potential Features
- **Real-time Match Tracking**: Live game monitoring
- **Champion Analytics**: Detailed champion statistics
- **Team Composition Analysis**: Synergy recommendations
- **Tournament Brackets**: Community tournament system
- **Social Features**: Player following and notifications

### Technical Improvements
- **Progressive Web App**: Offline functionality
- **Server-side Rendering**: SEO optimization
- **Database Integration**: Persistent leaderboards
- **Machine Learning**: Predictive analytics
- **WebSocket Integration**: Real-time updates

## 📈 Monitoring & Analytics

### Performance Monitoring
- **CloudFront Metrics**: Request counts and error rates
- **S3 Metrics**: Storage usage and request patterns
- **Amplify Metrics**: Build success rates and deployment times

### User Analytics
- **Client-side Tracking**: User interaction patterns
- **API Usage**: Request frequency and popular endpoints
- **Error Tracking**: Client-side error reporting

## 🎯 Innovation Showcase

### Unique Use Case
**"Community-Driven Player Discovery Platform"**

Rift Rewind transforms the traditional player lookup tool into a community-driven discovery platform. Instead of just searching for players, users contribute to a growing database of skilled players across regions. The innovative leaderboard system creates a gamified experience where discovering high-ranked players becomes part of the fun.

### Technical Innovation
- **Hybrid Architecture**: Combines static hosting with dynamic API integration
- **Client-side Intelligence**: Smart caching and rate limiting without backend
- **Visual Storytelling**: Game-inspired UI that tells the story of each player
- **Community Building**: Social features without requiring user accounts

This architecture demonstrates how modern web technologies can create engaging, performant, and cost-effective applications while maintaining security and scalability principles.
