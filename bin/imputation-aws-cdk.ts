#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import ec2 = require('@aws-cdk/aws-ec2');
import s3 = require('@aws-cdk/aws-s3');
import { ImputationAwsCdkStack, ImputationClusterConfigType } from '../lib/imputation-aws-cdk-stack';
import { App } from '@aws-cdk/core';

const app = new cdk.App();
new ImputationAwsCdkStack(app, 'ImputationAwsCdkStack', {
    description: "Michigan Imputation Server on Amazon EMR (ib-AoSa4lTDq0)",
    nameTag: app.node.tryGetContext('nameTag'),
    clusterType: ImputationClusterConfigType.small,
    clusterBucketName: app.node.tryGetContext('clusterBucketName')
    //existingVpc: ec2.Vpc.fromLookup(app, "existingVpc", id: "vpc-123456789")
});
