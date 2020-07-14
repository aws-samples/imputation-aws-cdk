### Build the CDK stack and boostrap the enviornment
npm run build
cdk bootstrap

### Prepare bucket with neccesary EMR files
clusterBucketName="existing-or-newbucket-all-lowercase-nospaces"
nameTagForCluster="NameTag-For-Cluster-Spaces-And-Caps-Ok"
sed -i 's/s3:\/\/.*\//s3:\/\/'$clusterBucketName'\//g' imputationserver-aws/bootstrap.sh
aws s3 mb s3://$clusterBucketName
aws s3 sync imputationserver-aws/ s3://$clusterBucketName/

cdk deploy --context nameTag=$nameTagForCluster --context clusterBucketName=$clusterBucketName

### Grab the cluster id and master node instance id from parameter store
clusterId="$(aws ssm get-parameter --name EmrCluster-$nameTagForCluster --query "Parameter.Value" --output text)"
masterNodeInstanceId="$(aws emr list-instances --cluster-id $clusterId --instance-fleet-type MASTER --query "Instances[0].Ec2InstanceId" --output text)"

### Start the port forwarding session via AWS SSM
aws ssm start-session --target $masterNodeInstanceId \
    --document-name AWS-StartPortForwardingSession \
    --parameters '{"portNumber":["8082"],"localPortNumber":["8080"]}'
