#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { RiftRewindStack } from '../lib/rift-rewind-stack';

const app = new cdk.App();

new RiftRewindStack(app, 'RiftRewindStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
  description: 'Rift Rewind - League of Legends Player Insights Application Infrastructure',
});
