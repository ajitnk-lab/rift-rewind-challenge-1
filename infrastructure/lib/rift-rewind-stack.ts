import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as amplify from 'aws-cdk-lib/aws-amplify';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export class RiftRewindStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create S3 bucket for static website hosting (private bucket)
    const websiteBucket = new s3.Bucket(this, 'RiftRewindWebsiteBucket', {
      bucketName: `rift-rewind-website-${this.account}-${this.region}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      lifecycleRules: [
        {
          id: 'DeleteOldVersions',
          enabled: true,
          noncurrentVersionExpiration: cdk.Duration.days(30),
        },
      ],
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For development - change to RETAIN for production
    });

    // Create Origin Access Identity for CloudFront
    const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'RiftRewindOAI', {
      comment: 'OAI for Rift Rewind website',
    });

    // Grant CloudFront access to S3 bucket
    websiteBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject'],
        resources: [websiteBucket.arnForObjects('*')],
        principals: [originAccessIdentity.grantPrincipal],
      })
    );

    // Create CloudWatch Log Group for CloudFront
    const cloudFrontLogGroup = new logs.LogGroup(this, 'CloudFrontLogGroup', {
      logGroupName: '/aws/cloudfront/rift-rewind',
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create CloudFront distribution
    const distribution = new cloudfront.Distribution(this, 'RiftRewindDistribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(websiteBucket, {
          originAccessIdentity,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        compress: true,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
      ],
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100, // Cost optimization - US, Canada, Europe
      enableLogging: true,
      comment: 'Rift Rewind - League of Legends Player Insights',
    });

    // Create AWS Secrets Manager secret for Riot Games API key
    const riotApiSecret = new secretsmanager.Secret(this, 'RiotApiSecret', {
      secretName: 'rift-rewind/riot-api-key',
      description: 'Riot Games API key for Rift Rewind application',
      secretObjectValue: {
        apiKey: cdk.SecretValue.unsafePlainText('RGAPI-afe09931-a170-4541-8f25-2b071c0ab4ed'),
      },
    });

    // Create GitHub token secret for Amplify
    const githubTokenSecret = new secretsmanager.Secret(this, 'GitHubTokenSecret', {
      secretName: 'rift-rewind/github-token',
      description: 'GitHub Personal Access Token for Amplify CI/CD',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'github' }),
        generateStringKey: 'token',
        excludeCharacters: '"@/\\',
      },
    });

    // Create IAM role for Amplify
    const amplifyRole = new iam.Role(this, 'AmplifyRole', {
      assumedBy: new iam.ServicePrincipal('amplify.amazonaws.com'),
      description: 'IAM role for Amplify CI/CD pipeline',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess-Amplify'),
      ],
      inlinePolicies: {
        S3Access: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                's3:GetObject',
                's3:PutObject',
                's3:DeleteObject',
                's3:ListBucket',
              ],
              resources: [
                websiteBucket.bucketArn,
                websiteBucket.arnForObjects('*'),
              ],
            }),
          ],
        }),
        CloudFrontAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'cloudfront:CreateInvalidation',
                'cloudfront:GetDistribution',
                'cloudfront:ListDistributions',
              ],
              resources: [distribution.distributionArn],
            }),
          ],
        }),
        SecretsManagerAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'secretsmanager:GetSecretValue',
              ],
              resources: [
                riotApiSecret.secretArn,
                githubTokenSecret.secretArn,
              ],
            }),
          ],
        }),
      },
    });

    // Create Amplify App for CI/CD
    const amplifyApp = new amplify.CfnApp(this, 'RiftRewindAmplifyApp', {
      name: 'rift-rewind',
      description: 'Rift Rewind - League of Legends Player Insights',
      repository: 'https://github.com/ajitnk-lab/rift-rewind-challenge-1',
      accessToken: githubTokenSecret.secretValueFromJson('token').unsafeUnwrap(),
      iamServiceRole: amplifyRole.roleArn,
      platform: 'WEB',
      buildSpec: `
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - echo "Installing dependencies..."
        - cd frontend/src
        - echo "Retrieving API key from AWS Secrets Manager..."
        - export RIOT_API_KEY=$(aws secretsmanager get-secret-value --secret-id rift-rewind/riot-api-key --region ${this.region} --query SecretString --output text | jq -r .apiKey)
    build:
      commands:
        - echo "Building application with secure API key..."
        - sed -i "s/RGAPI-afe09931-a170-4541-8f25-2b071c0ab4ed/\$RIOT_API_KEY/g" app.js
        - echo "Build completed with secure API key injection"
    postBuild:
      commands:
        - echo "Build completed successfully"
  artifacts:
    baseDirectory: frontend/src
    files:
      - '**/*'
  cache:
    paths: []
      `,
      environmentVariables: [
        {
          name: 'AMPLIFY_DIFF_DEPLOY',
          value: 'false',
        },
        {
          name: 'AMPLIFY_MONOREPO_APP_ROOT',
          value: 'frontend',
        },
      ],
    });

    // Create Amplify branch for main
    const amplifyBranch = new amplify.CfnBranch(this, 'RiftRewindAmplifyBranch', {
      appId: amplifyApp.attrAppId,
      branchName: 'main',
      enableAutoBuild: true,
      enablePerformanceMode: false,
      stage: 'PRODUCTION',
      framework: 'Web',
    });

    // Create CloudWatch Log Group for Amplify
    const amplifyLogGroup = new logs.LogGroup(this, 'AmplifyLogGroup', {
      logGroupName: `/aws/amplify/${amplifyApp.name}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Output important values
    new cdk.CfnOutput(this, 'WebsiteBucketName', {
      value: websiteBucket.bucketName,
      description: 'S3 bucket name for website hosting',
    });

    new cdk.CfnOutput(this, 'CloudFrontDistributionId', {
      value: distribution.distributionId,
      description: 'CloudFront distribution ID',
    });

    new cdk.CfnOutput(this, 'CloudFrontDomainName', {
      value: distribution.distributionDomainName,
      description: 'CloudFront distribution domain name',
    });

    new cdk.CfnOutput(this, 'WebsiteURL', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'Website URL',
    });

    new cdk.CfnOutput(this, 'RiotApiSecretArn', {
      value: riotApiSecret.secretArn,
      description: 'ARN of the Riot Games API key secret',
    });

    new cdk.CfnOutput(this, 'AmplifyAppId', {
      value: amplifyApp.attrAppId,
      description: 'Amplify App ID',
    });

    new cdk.CfnOutput(this, 'AmplifyAppUrl', {
      value: `https://${amplifyBranch.branchName}.${amplifyApp.attrAppId}.amplifyapp.com`,
      description: 'Amplify App URL',
    });

    // Add tags for cost tracking and management
    cdk.Tags.of(this).add('Project', 'RiftRewind');
    cdk.Tags.of(this).add('Environment', 'Production');
    cdk.Tags.of(this).add('CostCenter', 'Development');
    cdk.Tags.of(this).add('Owner', 'DevTeam');
  }
}
