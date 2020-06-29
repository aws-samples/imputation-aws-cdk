import * as cdk from '@aws-cdk/core';
import assets = require("@aws-cdk/aws-s3-assets");
import ec2 = require('@aws-cdk/aws-ec2');
import emr = require('@aws-cdk/aws-emr');
import iam = require('@aws-cdk/aws-iam');
import s3 = require ('@aws-cdk/aws-s3');
import ssm = require('@aws-cdk/aws-ssm');

import smallInstanceConfig from '../imputationserver-aws/clusters/small/instance-groups.json'
import spotInstanceConfig from '../imputationserver-aws/clusters/spot/instance-groups.json'
import smallEmrConfig from '../imputationserver-aws/clusters/small/emr-config.json'
import spotEmrConfig from '../imputationserver-aws/clusters/spot/emr-config.json'
import { InstanceType } from '@aws-cdk/aws-ec2';

export interface ImputationStackProps extends cdk.StackProps {
  existingVpc?: ec2.Vpc;  
  nameTag: string;
  clusterType: ImputationClusterConfigType;
  clusterBucketName: string;
}

export enum ImputationClusterConfigType { small, largeSpot };

export class ImputationAwsCdkStack extends cdk.Stack {

  public readonly Vpc: ec2.Vpc; 
  public readonly cluster: emr.CfnCluster; 
  public readonly clusterBucket: s3.IBucket;

  private readonly masterFleetConfig?: emr.CfnCluster.InstanceFleetConfigProperty;
  private readonly taskFleetConfig?: emr.CfnCluster.InstanceFleetConfigProperty;
  private readonly coreFleetConfig?: emr.CfnCluster.InstanceFleetConfigProperty;

  constructor(scope: cdk.Construct, id: string, props: ImputationStackProps) {
    super(scope, id, props);
    

    this.clusterBucket = s3.Bucket.fromBucketName(this, 'existingClusterBucket', props.clusterBucketName);

    const emrRole = new iam.Role(this, 'emrClusterRole', {
      assumedBy: new iam.ServicePrincipal('elasticmapreduce.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromManagedPolicyArn(this, 'emrDefaultRolePolicy', 'arn:aws:iam::aws:policy/service-role/AmazonElasticMapReduceRole'), 
                        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')]
    });

    const emrEc2Role = new iam.Role(this, 'emrEc2Role', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromManagedPolicyArn(this, 'emrDefaultEc2RolePolicy', 'arn:aws:iam::aws:policy/service-role/AmazonElasticMapReduceforEC2Role'), 
                        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')]
    });

    const emrInstanceProfile = new iam.CfnInstanceProfile(this, 'emrInstanceProfile',{
      roles: [emrEc2Role.roleName]
    });


    this.clusterBucket.grantReadWrite(emrEc2Role);

    const bootstrapFile = new assets.Asset(this, 'bootstrapFile', {
      path: 'imputationserver-aws/bootstrap.sh'
    });
    bootstrapFile.grantRead(emrRole);
    bootstrapFile.grantRead(emrEc2Role);


    if(props.existingVpc != null){
      this.Vpc = props.existingVpc;
    }else{
      this.Vpc = new ec2.Vpc(this, "imputationVpc", {
        cidr: "10.80.0.0/16",
        subnetConfiguration: [
          {
            cidrMask: 20,
            name: 'dmz',
            subnetType: ec2.SubnetType.PUBLIC,
          },
          {
            cidrMask: 20,
            name: 'application',
            subnetType: ec2.SubnetType.PRIVATE,
          },
          {
            cidrMask: 20,
            name: 'database',
            subnetType: ec2.SubnetType.ISOLATED,
          }, 
        ]
      });

      this.Vpc.addS3Endpoint("s3Endpoint");      
    }

    const appSubnetSelection = { subnetType: ec2.SubnetType.PRIVATE };
    const appSubnets = this.Vpc.selectSubnets(appSubnetSelection);



    var instanceConfigToUse = smallInstanceConfig;
    var emrConfigToUse = smallEmrConfig;
    switch(props.clusterType){
      case ImputationClusterConfigType.largeSpot: {
        instanceConfigToUse=spotInstanceConfig;
        emrConfigToUse = spotEmrConfig;
        break;
      }
      case ImputationClusterConfigType.small: {
        instanceConfigToUse= smallInstanceConfig;
        emrConfigToUse = smallEmrConfig;
        break;
      }
    }
     


    for (let instanceConfig of instanceConfigToUse) {

      var blockDeviceConfigs: Array<emr.CfnInstanceGroupConfig.EbsBlockDeviceConfigProperty> = [];
      for(let ebsDeviceConfig of instanceConfig.EbsConfiguration.EbsBlockDeviceConfigs){
        blockDeviceConfigs.push({
          volumeSpecification: {
            sizeInGb: ebsDeviceConfig.VolumeSpecification.SizeInGB,
            volumeType: ebsDeviceConfig.VolumeSpecification.VolumeType
          },
          volumesPerInstance: ebsDeviceConfig.VolumesPerInstance          
        });
      }

      const instanceFleetParams: emr.CfnCluster.InstanceFleetConfigProperty = {
        name: instanceConfig.Name,
        targetOnDemandCapacity: instanceConfig.InstanceCount,        
        instanceTypeConfigs: [{
            instanceType: instanceConfig.InstanceType,
            ebsConfiguration:{
              ebsBlockDeviceConfigs: blockDeviceConfigs,
              ebsOptimized: true
            } 
          }          
        ]
      };

      if (instanceConfig.InstanceGroupType == "MASTER"){
        this.masterFleetConfig = instanceFleetParams;
      }
      if (instanceConfig.InstanceGroupType == "TASK"){
        this.taskFleetConfig = instanceFleetParams;
      }
      if (instanceConfig.InstanceGroupType == "CORE"){
        this.coreFleetConfig = instanceFleetParams;
      }
      
    }
          
    this.cluster = new emr.CfnCluster(this, 'imputationCluster', {
      name: `imputationCluster-${props.nameTag}`,
      releaseLabel: "emr-5.29.0",
      instances: {
        ec2SubnetIds: appSubnets.subnetIds,        
        ...(typeof this.masterFleetConfig !== "undefined" && {
					masterInstanceFleet: this.masterFleetConfig
        }),
        ...(typeof this.coreFleetConfig !== "undefined" && {
					coreInstanceFleet: this.coreFleetConfig
        })       
      },
      jobFlowRole: emrInstanceProfile.attrArn,
      serviceRole: emrRole.roleArn,
      visibleToAllUsers: true,
      logUri: `s3://${this.clusterBucket.bucketName}`,
      bootstrapActions: [{
        name: "startup",
        scriptBootstrapAction: {
          path: bootstrapFile.s3ObjectUrl
        }
      }],
      configurations: [{
        classification: emrConfigToUse[0].Classification,
        configurationProperties: emrConfigToUse[0].Properties
      }]
    });


    if(props.existingVpc == null){
      this.cluster.node.addDependency(this.Vpc.internetConnectivityEstablished);
    }    

    if(typeof this.taskFleetConfig != "undefined"){
      const cfnFleetConfig = { ...this.taskFleetConfig, clusterId: this.cluster.ref, instanceFleetType: "TASK" }
      new emr.CfnInstanceFleetConfig(this, 'taskGroupConfig', cfnFleetConfig );
    }

    new ssm.StringParameter(this, 'clusterIdParam', {
      allowedPattern: '.*',
      description: `EmrClusterId for cluster: ${props.nameTag}`,
      parameterName: `EmrCluster-${props.nameTag}`,
      stringValue: this.cluster.ref
    });

  }
}
