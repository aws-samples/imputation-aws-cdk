npm run build
cdk bootstrap
clusterBucketName="devspacepaulimputationeast"
nameTagForCluster="PaulU"
sed -i s/michigan-imputation-aws-public/$clusterBucketName/g imputationserver-aws/bootstrap.sh
aws s3 mb s3://$clusterBucketName
aws s3 sync imputationserver-aws/ s3://$clusterBucketName/
cdk deploy --context nameTag=$nameTagForCluster --context clusterBucketName=$clusterBucketName
clusterId="$(aws ssm get-parameter --name EmrCluster-$nameTagForCluster --query "Parameter.Value" --output text)"
masterNodeInstanceId="$(aws emr list-instances --cluster-id $clusterId --instance-fleet-type MASTER --query "Instances[0].Ec2InstanceId" --output text)"

aws ssm start-session --target $masterNodeInstanceId \
    document-name AWS-StartPortForwardingSession \
    parameters '{"portNumber":["8082"],"localPortNumber":["8080"]}'
