import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import * as s3 from '@aws-cdk/aws-s3';
import * as ImputationAwsCdk from '../lib/imputation-aws-cdk-stack';

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new ImputationAwsCdk.ImputationAwsCdkStack(app, 'ImputationAwsCdkStack', {
      nameTag: "test", 
      clusterType : ImputationAwsCdk.ImputationClusterConfigType.small,
      clusterBucketName: "testbucketPleaseRename"

    });
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});
