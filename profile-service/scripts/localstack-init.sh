#!/usr/bin/env bash
# Provisions SNS FIFO topic, SQS queue and subscription for the Profile Service
# outbox → SNS → SQS → OpenSearch pipeline.
set -euo pipefail

export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-us-east-1}"
ACCOUNT_ID="000000000000"

echo "[init] Creating SNS FIFO topic profile-events.fifo..."
awslocal sns create-topic \
  --name profile-events.fifo \
  --attributes FifoTopic=true,ContentBasedDeduplication=false \
  >/dev/null

echo "[init] Creating SQS queue profile-index-queue..."
awslocal sqs create-queue --queue-name profile-index-queue >/dev/null

TOPIC_ARN="arn:aws:sns:${AWS_DEFAULT_REGION}:${ACCOUNT_ID}:profile-events.fifo"
QUEUE_ARN="arn:aws:sqs:${AWS_DEFAULT_REGION}:${ACCOUNT_ID}:profile-index-queue"

echo "[init] Subscribing profile-index-queue to profile-events.fifo..."
awslocal sns subscribe \
  --topic-arn "$TOPIC_ARN" \
  --protocol sqs \
  --notification-endpoint "$QUEUE_ARN" \
  >/dev/null

echo "[init] Profile Service messaging topology ready."
