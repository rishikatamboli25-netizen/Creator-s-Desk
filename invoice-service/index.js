import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import PDFDocument from 'pdfkit';
import { v2 as cloudinary } from 'cloudinary';
import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
  SQSClient,
} from '@aws-sdk/client-sqs';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5006;
const AWS_REGION = process.env.AWS_REGION;
const ORDER_CREATED_QUEUE_URL = process.env.ORDER_CREATED_QUEUE_URL;
const INVOICE_GENERATED_QUEUE_URL = process.env.INVOICE_GENERATED_QUEUE_URL;
const SQS_VISIBILITY_TIMEOUT = Number(process.env.SQS_VISIBILITY_TIMEOUT || 120);
const WAIT_TIME_SECONDS = 20;
const MAX_NUMBER_OF_MESSAGES = 10;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

let consumerRunning = false;
let sqsClient = null;

function assertConfig() {
  const missing = [];

  if (!AWS_REGION) missing.push('AWS_REGION');
  if (!ORDER_CREATED_QUEUE_URL) missing.push('ORDER_CREATED_QUEUE_URL');
  if (!INVOICE_GENERATED_QUEUE_URL) missing.push('INVOICE_GENERATED_QUEUE_URL');
  if (!process.env.CLOUDINARY_CLOUD_NAME) missing.push('CLOUDINARY_CLOUD_NAME');
  if (!process.env.CLOUDINARY_API_KEY) missing.push('CLOUDINARY_API_KEY');
  if (!process.env.CLOUDINARY_API_SECRET) missing.push('CLOUDINARY_API_SECRET');

  if (missing.length > 0) {
    throw new Error(`Missing configuration: ${missing.join(', ')}`);
  }
}

function getSqsClient() {
  if (!sqsClient) {
    assertConfig();
    sqsClient = new SQSClient({ region: AWS_REGION });
  }

  return sqsClient;
}

function createInvoicePdf(order) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(20).text("CREATOR'S DESK.", { align: 'center' });
    doc.moveDown();

    doc.fontSize(12).text(`Invoice ID: ${order.orderId}`);
    doc.text(
      `Date: ${new Date(order.createdAt || Date.now()).toLocaleDateString('en-IN')}`
    );
    doc.text(`Payment Method: ${order.paymentMethod || 'N/A'}`);

    if (order.paymentId) {
      doc.text(`Payment ID: ${order.paymentId}`);
    }

    doc.moveDown();

    doc.text('Billed To:');
    doc.text(`${order.shippingAddress?.street || 'N/A'}`);
    doc.text(
      `${order.shippingAddress?.city || ''}, ${order.shippingAddress?.state || ''} ${order.shippingAddress?.zip || ''}`.trim()
    );
    doc.moveDown();

    doc.text('---------------------------------------------------------');

    for (const item of order.items || []) {
      const quantity = Number(item.quantity || 1);
      const lineTotal = Number(item.price || 0) * quantity;
      doc.text(`${item.name} (x${quantity}) - ₹${lineTotal.toFixed(2)}`);
    }

    doc.text('---------------------------------------------------------');
    doc.moveDown();

    doc.fontSize(14).text(
      `Total Amount: ₹${Number(order.totalAmount || 0).toFixed(2)}`,
      { align: 'right' }
    );

    doc.end();
  });
}

function uploadPdf(buffer, orderId) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'image',
        type: process.env.CLOUDINARY_DELIVERY_TYPE || 'upload',
        public_id: `invoices/${orderId}`,
        format: 'pdf',
        overwrite: true,
        use_filename: false,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    stream.end(buffer);
  });
}

async function handleOrderCreated(order) {
  if (!order?.orderId) {
    throw new Error('order.created event is missing orderId');
  }

  console.log(`🧾 Generating invoice for order ${order.orderId}`);

  const pdfBuffer = await createInvoicePdf(order);
  const uploadResult = await uploadPdf(pdfBuffer, order.orderId);

  const url = uploadResult?.secure_url || uploadResult?.url;

  if (!url) {
    throw new Error('Cloudinary did not return a delivery URL');
  }

  const event = {
    event: 'invoice.generated',
    data: {
      orderId: order.orderId,
      url,
      provider: 'cloudinary',
      publicId: uploadResult.public_id || null,
      generatedAt: new Date().toISOString(),
    },
    publishedAt: new Date().toISOString(),
  };

  const client = getSqsClient();

  const result = await client.send(
    new SendMessageCommand({
      QueueUrl: INVOICE_GENERATED_QUEUE_URL,
      MessageBody: JSON.stringify(event),
    })
  );

  console.log(
    `✅ Invoice generated and published for order ${order.orderId} (${result.MessageId})`
  );
}

async function startSqsConsumer() {
  assertConfig();

  if (consumerRunning) return;
  consumerRunning = true;

  const client = getSqsClient();
  console.log('📥 Invoice Service listening for order.created events...');

  while (consumerRunning) {
    try {
      const response = await client.send(
        new ReceiveMessageCommand({
          QueueUrl: ORDER_CREATED_QUEUE_URL,
          MaxNumberOfMessages: MAX_NUMBER_OF_MESSAGES,
          WaitTimeSeconds: WAIT_TIME_SECONDS,
          VisibilityTimeout: SQS_VISIBILITY_TIMEOUT,
        })
      );

      for (const message of response.Messages || []) {
        try {
          const envelope = JSON.parse(message.Body || '{}');

          if (envelope.event !== 'order.created') {
            throw new Error(`Unexpected event in order queue: ${envelope.event}`);
          }

          await handleOrderCreated(envelope.data);

          await client.send(
            new DeleteMessageCommand({
              QueueUrl: ORDER_CREATED_QUEUE_URL,
              ReceiptHandle: message.ReceiptHandle,
            })
          );
        } catch (messageError) {
          console.error('❌ Failed to process order.created:', messageError);
          // Keep the message in SQS so it can be retried after its visibility timeout.
        }
      }
    } catch (pollError) {
      if (!consumerRunning) break;

      console.error('❌ SQS invoice consumer error:', pollError.message);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

// Compatibility/debug endpoint. Normal checkout uses the SQS event-driven flow.
app.post('/generate', async (req, res) => {
  try {
    const pdfBuffer = await createInvoicePdf(req.body);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=invoice-${req.body.orderId || 'invoice'}.pdf`
    );
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Invoice generation error:', error);
    res.status(500).json({ error: 'Failed to generate invoice' });
  }
});

app.get('/health', (req, res) => {
  res.status(200).json({
    service: 'invoice-service',
    status: consumerRunning ? 'healthy' : 'degraded',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

async function startServer() {
  startSqsConsumer().catch((error) => {
    console.error('⚠️ Invoice SQS consumer unavailable:', error.message);
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🧾 Invoice Service running on port ${PORT}`);
  });
}

function shutdown() {
  consumerRunning = false;
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

startServer();
