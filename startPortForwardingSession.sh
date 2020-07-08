nameTagForCluster="User-Department-Whatever"

clusterId="$(aws ssm get-parameter --name EmrCluster-$nameTagForCluster --query "Parameter.Value" --output text)"
masterNodeInstanceId="$(aws emr list-instances --cluster-id $clusterId --instance-fleet-type MASTER --query "Instances[0].Ec2InstanceId" --output text)"

aws ssm start-session --target $masterNodeInstanceId \
    --document-name AWS-StartPortForwardingSession \
    --parameters '{"portNumber":["8082"],"localPortNumber":["8080"]}'