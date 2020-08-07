# Michigan Imputation Server on Amazon EMR

This is a CDK Construct Pattern for running the [University of Michigan Imputation Server](https://imputationserver.sph.umich.edu/index.html#!) on your own Amazon EMR clusters. 

This is based on [the work](https://github.com/genepi/imputationserver) of the Medical University of Innsbruck's Institute of Genetic Epidemiology.

//TODO: Arch Diagram

## Getting Started - Prerequisites

You need to have the following things installed on your development machine.

1. The AWS CLI. [Install instructions.](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html)
2. The AWS CDK CLI. Follow the [preqrequisite](https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html#getting_started_prerequisites) and [install](https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html#getting_started_install) steps.
3. The AWS Session Manager Plugin for the AWS CLI. [Install instructions.](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html)

If you have never used EMR in your account before, you will need to create the [default EMR roles](https://awscli.amazonaws.com/v2/documentation/api/latest/reference/emr/create-default-roles.html) before proceeding. Just run the following command. 
```bash
aws emr create-default-roles
```

## Getting Started - Deployment

Clone the repo (and initialize the submodule) and install the node dependencies.
```bash
git clone --recurse-submodules ssh://GITREPOGOESHERE
cd GITREPOGOESHERE
npm install
```
We need a bucket to hold EMR configuration and logging detail. 

```bash
aws s3 mb s3://unique-bucket-name-no-caps-or-spaces
```
Open the `deployImputationCluster.sh` file and edit the first two lines:
```bash
clusterBucketName="unique-bucket-name-no-caps-or-spaces"
nameTagForCluster="User-Department-Whatever"
```
If you want to deploy the EMR cluster into an existing VPC, open the `bin\imputation-aws-cdk.ts` and uncomment the `existingVpc` line and supply your existing VPC id.
```typescript
    ...
    clusterBucketName: app.node.tryGetContext('clusterBucketName')
    //existingVpc: ec2.Vpc.fromLookup(app, "existingVpc", id: "vpc-123456789")
});
```
Run the deployImputationCluster.sh script
```bash
./deployImputationCluster.sh
```
It should look like this when its complete:
```
 ✅  ImputationAwsCdkStack

Stack ARN:
arn:aws:cloudformation:us-east-2:1XXXXXXXX7:stack/ImputationAwsCdkStack/0XXXXX0-bXX2-1XXXa-9XXc-02XXXXXXX9c

Starting session with SessionId: paul-06c20XXXXXXXX290b43
Port 8080 opened for sessionId paul-06cXXXXXXXXXXX43.
```
## Connect to the Imputation server
The last step in the deployment script uses the AWS SSM Session Manager to start a port forwarding session from the master node of the EMR cluster (port 8082) to your localhost (port 8080). 

All you need to do to connect is open a browser and navigate to http://localhost:8080 in your browser and you will see the UM Imputaiton Server landing page. 

TODO:// Image of imputation server landing page.

## Login as Admin and Configure the Imputation Server
The default install does not include some of the reference panels and other applications you are likley going to want to use. To install them, you need to login as the administrator.

Click the 'login' button at the top right of the landing page and use `admin` as the username and `admin1978` as the password. I strongly suggest you change the password as soon as you login.

TODO:// Link to imputation server admin/user guide. 

## Note about Security

Whether you bring your own VPC or use the one this CDK pattern creates for you, the CDK will only deploy into private subnets in your VPC. The EMR instances will not have public IP addresses or be routable from the outside internet. 

Despite these resources being private, you will notice that we didnt have to open a security group, fiddle with a VPN, port forwarding through some insecure basition host, etc. 

We are still able to securely route to the EMR resources because they all have the AWS SSM Agent on them. This lets us open interactive SSH sessions, do hip things like port forwarding, or even run fleet-wide administration commands on your EMR hosts ENTIRELY over the AWS control plane. All routing, authentication, and authorization, and access is handled automatically between your AWS CLI, SSH tools of choice, AWS SSM, and IAM.

## Giving other people access
In order to allow other people to securely port forward to the imputation server they first need to [install the AWS Session Manager Plugin](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html)

Then just run this command:

```bash
aws ssm start-session --target i-XXXXXXXXXXX \
    --document-name AWS-StartPortForwardingSession \
    --parameters '{"portNumber":["8082"],"localPortNumber":["8080"]}'
```

Note, the `target` parameter needs to be the instance ID of the master node for the EMR cluster. You can find that instance ID by looking in the [EMR console](https://console.aws.amazon.com/elasticmapreduce/home). Select the cluster you created, then look under the `Hardware` tab. Select the `master` fleet and you will see the instance ID for the master node. 

Running these command locally will also spit out the instance ID:
```bash
nameTagForClusterUser="Whatever-You-Used-For-Name-Tag-Above"
clusterId="$(aws ssm get-parameter --name EmrCluster-$nameTagForCluster --query "Parameter.Value" --output text)"
aws emr list-instances --cluster-id $clusterId \
    --instance-fleet-type MASTER \
    --query "Instances[0].Ec2InstanceId" --output text
```


## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 License. See the LICENSE file.


