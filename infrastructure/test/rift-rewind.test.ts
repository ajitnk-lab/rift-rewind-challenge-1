import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as RiftRewind from '../lib/rift-rewind-stack';

test('S3 Bucket Created', () => {
  const app = new cdk.App();
  const stack = new RiftRewind.RiftRewindStack(app, 'MyTestStack');
  const template = Template.fromStack(stack);

  template.hasResourceProperties('AWS::S3::Bucket', {
    PublicAccessBlockConfiguration: {
      BlockPublicAcls: true,
      BlockPublicPolicy: true,
      IgnorePublicAcls: true,
      RestrictPublicBuckets: true,
    },
  });
});

test('CloudFront Distribution Created', () => {
  const app = new cdk.App();
  const stack = new RiftRewind.RiftRewindStack(app, 'MyTestStack');
  const template = Template.fromStack(stack);

  template.hasResourceProperties('AWS::CloudFront::Distribution', {
    DistributionConfig: {
      DefaultRootObject: 'index.html',
    },
  });
});

test('Secrets Manager Secrets Created', () => {
  const app = new cdk.App();
  const stack = new RiftRewind.RiftRewindStack(app, 'MyTestStack');
  const template = Template.fromStack(stack);

  template.resourceCountIs('AWS::SecretsManager::Secret', 2);
});
