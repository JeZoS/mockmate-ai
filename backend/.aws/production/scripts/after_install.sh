#!/bin/bash

#copy env file from s3 bucket to the instance
sudo aws s3 cp s3://mockmate-ai-backend/production/.env /home/ubuntu/mockmate-ai-backend/

# stopping the docker
sudo docker compose -f /home/ubuntu/mockmate-ai-backend/docker-compose.yml down

imagename="418596590147.dkr.ecr.us-east-1.amazonaws.com/mockmate-ai-backend-production-image:latest"

# removing the image
sudo docker rmi "$imagename"

# logging into aws ecr
sudo aws ecr get-login-password --region us-east-1 | sudo docker login --username AWS --password-stdin 418596590147.dkr.ecr.us-east-1.amazonaws.com

source /etc/environment
echo "Instance ID: $INSTANCE_ID"

# starting the docker again
sudo docker compose -f /home/ubuntu/mockmate-ai-backend/docker-compose.yml up -d