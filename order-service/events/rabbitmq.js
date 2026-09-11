import amqp from 'amqplib';
import Order from '../models/Order.js';

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
const ORDER_EXCHANGE = process.env.RABBITMQ_ORDER_EXCHANGE || 'order.events';
const INVOICE_EXCHANGE = process.env.RABBITMQ_INVOICE_EXCHANGE || 'invoice.events';

let connection = null;
let channel = null;

export async function connectRabbitMQ() {
  if (channel) return channel;

  connection = await amqp.connect(RABBITMQ_URL);
  channel = await connection.createConfirmChannel();

  await channel.assertExchange(ORDER_EXCHANGE, 'topic', { durable: true });
  await channel.assertExchange(INVOICE_EXCHANGE, 'topic', { durable: true });

  const invoiceQueue = process.env.RABBITMQ_ORDER_INVOICE_QUEUE || 'order.invoice.generated';
  await channel.assertQueue(invoiceQueue, { durable: true });
  await channel.bindQueue(invoiceQueue, INVOICE_EXCHANGE, 'invoice.generated');

  // Declare the invoice input queue here too so order.created events are retained
  // while Invoice Service is restarting or deploying. Invoice Service consumes it.
  const invoiceInputQueue = process.env.RABBITMQ_INVOICE_QUEUE || 'invoice.order.created';
  await channel.assertQueue(invoiceInputQueue, { durable: true });
  await channel.bindQueue(invoiceInputQueue, ORDER_EXCHANGE, 'order.created');

  await channel.consume(invoiceQueue, async (message) => {
    if (!message) return;

    try {
      const payload = JSON.parse(message.content.toString());
      const { orderId, url, provider, publicId, generatedAt } = payload;

      if (!orderId || !url) {
        console.error('❌ Invalid invoice.generated event:', payload);
        channel.ack(message);
        return;
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
        console.error(`❌ Order not found for invoice.generated: ${orderId}`);
      }

      channel.ack(message);
    } catch (error) {
      console.error('❌ Failed to consume invoice.generated:', error);
      channel.nack(message, false, true);
    }
  });

  connection.on('error', (error) => {
    console.error('❌ RabbitMQ connection error:', error.message);
  });

  connection.on('close', () => {
    console.error('⚠️ RabbitMQ connection closed. Restart the service to reconnect.');
    connection = null;
    channel = null;
  });

  console.log('🐇 Order Service connected to RabbitMQ');
  return channel;
}

export async function publishEvent(routingKey, payload) {
  if (!channel) {
    await connectRabbitMQ();
  }

  const exchange = routingKey.startsWith('invoice.') ? INVOICE_EXCHANGE : ORDER_EXCHANGE;
  const message = Buffer.from(JSON.stringify(payload));

  await channel.publish(exchange, routingKey, message, {
    persistent: true,
    contentType: 'application/json',
  });

  await channel.waitForConfirms();
}

export async function closeRabbitMQ() {
  try {
    if (channel) await channel.close();
  } catch {}

  try {
    if (connection) await connection.close();
  } catch {}

  channel = null;
  connection = null;
}
