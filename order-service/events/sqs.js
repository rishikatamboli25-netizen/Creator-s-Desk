import dotenv from 'dotenv';
dotenv.config();

import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
  SQSClient,
} from '@aws-sdk/client-sqs';

import Order from '../models/Order.js';

const REGION = process.env.AWS_REGION;
const ORDER_CREATED_QUEUE_URL = process.env.ORDER_CREATED_QUEUE_URL;
const INVOICE_GENERATED_QUEUE_URL = process.env.INVOICE_GENERATED_QUEUE_URL;
const VISIBILITY_TIMEOUT = Number(process.env.SQS_VISIBILITY_TIMEOUT || 120);

const WAIT_TIME_SECONDS = 20;
const MAX_NUMBER_OF_MESSAGES = 10;

let sqsClient = null;
let consumerRunning = false;

function assertConfig() {
  const missing = [];

  if (!REGION) missing.push('AWS_REGION');
  if (!ORDER_CREATED_QUEUE_URL) missing.push('ORDER_CREATED_QUEUE_URL');
  if (!INVOICE_GENERATED_QUEUE_URL) missing.push('INVOICE_GENERATED_QUEUE_URL');

  if (missing.length > 0) {
    throw new Error(`Missing SQS configuration: ${missing.join(', ')}`);
  }
}

export function getSqsClient() {
  if (!sqsClient) {
    assertConfig();
    sqsClient = new SQSClient({ region: REGION });
  }

  return sqsClient;
}

export async function publishEvent(eventName, payload) {
  const client = getSqsClient();

  let queueUrl;

  if (eventName === 'order.created') {
    queueUrl = ORDER_CREATED_QUEUE_URL;
  } else if (eventName === 'invoice.generated') {
    queueUrl = INVOICE_GENERATED_QUEUE_URL;
  } else {
    throw new Error(`Unsupported event: ${eventName}`);
  }

  const message = {
    event: eventName,
    data: payload,
    publishedAt: new Date().toISOString(),
  };

  const result = await client.send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(message),
    })
  );

  console.log(`📤 Published ${eventName}: ${result.MessageId}`);
  return result;
}

async function handleInvoiceGenerated(payload) {
  const { orderId, url, provider, publicId, generatedAt } = payload || {};

  if (!orderId || !url) {
    throw new Error('Invalid invoice.generated event: orderId and url are required');
  }

  const updated = await Order.findOneAndUpdate(
    { _id: orderId },
    {
      $set: {
        'document.url': url,
        'document.provider': provider || 'cloudinary',
        'document.publicId': publicId || null,
        'document.generatedAt': generatedAt ? new Date(generatedAt) : new Date(),
      },
    },
    { new: true }
  );

  if (!updated) {
    throw new Error(`Order not found for invoice.generated: ${orderId}`);
  }

  console.log(`✅ Saved invoice document for order ${orderId}`);
}

export async function startInvoiceGeneratedConsumer() {
  assertConfig();

  if (consumerRunning) return;
  consumerRunning = true;

  const client = getSqsClient();
  console.log('📥 Order Service listening for invoice.generated events...');

  while (consumerRunning) {
    try {
      const response = await client.send(
        new ReceiveMessageCommand({
          QueueUrl: INVOICE_GENERATED_QUEUE_URL,
          MaxNumberOfMessages: MAX_NUMBER_OF_MESSAGES,
          WaitTimeSeconds: WAIT_TIME_SECONDS,
          VisibilityTimeout: VISIBILITY_TIMEOUT,
        })
      );

      for (const message of response.Messages || []) {
        try {
          const envelope = JSON.parse(message.Body || '{}');

          if (envelope.event !== 'invoice.generated') {
            throw new Error(`Unexpected event in invoice queue: ${envelope.event}`);
          }

          await handleInvoiceGenerated(envelope.data);

          await client.send(
            new DeleteMessageCommand({
              QueueUrl: INVOICE_GENERATED_QUEUE_URL,
              ReceiptHandle: message.ReceiptHandle,
            })
          );
        } catch (messageError) {
          console.error('❌ Failed to process invoice.generated:', messageError);
          // Do not delete the message. SQS will make it visible again after the visibility timeout.
        }
      }
    } catch (pollError) {
      if (!consumerRunning) break;
      console.error('❌ SQS invoice consumer error:', pollError.message);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

export function stopSqsConsumers() {
  consumerRunning = false;
}
