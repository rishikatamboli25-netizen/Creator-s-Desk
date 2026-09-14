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
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5006;

const AWS_REGION = process.env.AWS_REGION;
const ORDER_CREATED_QUEUE_URL = process.env.ORDER_CREATED_QUEUE_URL;
const INVOICE_GENERATED_QUEUE_URL = process.env.INVOICE_GENERATED_QUEUE_URL;

const SQS_VISIBILITY_TIMEOUT = Number(
  process.env.SQS_VISIBILITY_TIMEOUT || 120
);

const WAIT_TIME_SECONDS = 20;
const MAX_NUMBER_OF_MESSAGES = 10;

const SHIPPING_CHARGE = 20;

const LOGO_PATH = path.join(
  __dirname,
  'creators-desk-logo.png'
);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

let consumerRunning = false;
let sqsClient = null;

/* -------------------------------------------------------------------------- */
/* Configuration                                                              */
/* -------------------------------------------------------------------------- */

function assertConfig() {
  const missing = [];

  if (!AWS_REGION) {
    missing.push('AWS_REGION');
  }

  if (!ORDER_CREATED_QUEUE_URL) {
    missing.push('ORDER_CREATED_QUEUE_URL');
  }

  if (!INVOICE_GENERATED_QUEUE_URL) {
    missing.push('INVOICE_GENERATED_QUEUE_URL');
  }

  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    missing.push('CLOUDINARY_CLOUD_NAME');
  }

  if (!process.env.CLOUDINARY_API_KEY) {
    missing.push('CLOUDINARY_API_KEY');
  }

  if (!process.env.CLOUDINARY_API_SECRET) {
    missing.push('CLOUDINARY_API_SECRET');
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing configuration: ${missing.join(', ')}`
    );
  }
}

function getSqsClient() {
  if (!sqsClient) {
    assertConfig();

    sqsClient = new SQSClient({
      region: AWS_REGION,
    });
  }

  return sqsClient;
}

/* -------------------------------------------------------------------------- */
/* Formatting                                                                 */
/* -------------------------------------------------------------------------- */

function formatMoney(value) {
  return `₹${Number(value || 0).toFixed(2)}`;
}

function numberToWordsUnderThousand(number) {
  const ones = [
    '',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ];

  const tens = [
    '',
    '',
    'Twenty',
    'Thirty',
    'Forty',
    'Fifty',
    'Sixty',
    'Seventy',
    'Eighty',
    'Ninety',
  ];

  let words = '';

  if (number >= 100) {
    words += `${ones[Math.floor(number / 100)]} Hundred`;

    number %= 100;

    if (number) {
      words += ' ';
    }
  }

  if (number >= 20) {
    words += tens[Math.floor(number / 10)];

    number %= 10;

    if (number) {
      words += ` ${ones[number]}`;
    }
  } else if (number > 0) {
    words += ones[number];
  }

  return words;
}

function numberToIndianWords(amount) {
  const rounded = Math.round(
    Number(amount || 0)
  );

  if (rounded === 0) {
    return 'Zero Rupees Only';
  }

  const parts = [];

  let remaining = rounded;

  const crore = Math.floor(
    remaining / 10000000
  );

  remaining %= 10000000;

  const lakh = Math.floor(
    remaining / 100000
  );

  remaining %= 100000;

  const thousand = Math.floor(
    remaining / 1000
  );

  remaining %= 1000;

  if (crore) {
    parts.push(
      `${numberToWordsUnderThousand(crore)} Crore`
    );
  }

  if (lakh) {
    parts.push(
      `${numberToWordsUnderThousand(lakh)} Lakh`
    );
  }

  if (thousand) {
    parts.push(
      `${numberToWordsUnderThousand(thousand)} Thousand`
    );
  }

  if (remaining) {
    parts.push(
      numberToWordsUnderThousand(remaining)
    );
  }

  return `${parts.join(' ')} Rupees Only`;
}

function generateInvoiceNumber() {
  return crypto
    .randomInt(
      100000000000,
      1000000000000
    )
    .toString();
}

/* -------------------------------------------------------------------------- */
/* PDF helpers                                                                */
/* -------------------------------------------------------------------------- */

function drawLabel(doc, text, x, y) {
  doc
    .font('Helvetica-Bold')
    .fontSize(7.5)
    .fillColor('#666666')
    .text(text, x, y);
}

function drawValue(
  doc,
  text,
  x,
  y,
  width = 210,
  options = {}
) {
  doc
    .font(options.bold ? 'Helvetica-Bold' : 'Helvetica')
    .fontSize(options.fontSize || 9)
    .fillColor('#111111')
    .text(String(text || ''), x, y, {
      width,
      lineGap: options.lineGap || 1,
      ...options,
    });
}

function drawWrappedText(
  doc,
  text,
  x,
  y,
  width,
  options = {}
) {
  const fontSize = options.fontSize || 8.5;
  const lineGap = options.lineGap ?? 1;

  doc
    .font(options.bold ? 'Helvetica-Bold' : 'Helvetica')
    .fontSize(fontSize)
    .fillColor(options.color || '#333333');

  const height = doc.heightOfString(
    String(text || ''),
    {
      width,
      lineGap,
    }
  );

  doc.text(String(text || ''), x, y, {
    width,
    lineGap,
  });

  return height;
}

/* -------------------------------------------------------------------------- */
/* Invoice PDF                                                                */
/* -------------------------------------------------------------------------- */

function createInvoicePdf(order) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 42,
      info: {
        Title: `Invoice ${
          order.invoiceNumber ||
          order.orderId ||
          ''
        }`,
        Author: "Creator's Desk",
        Subject: 'Commercial Invoice',
      },
    });

    const chunks = [];

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;

    const left = doc.page.margins.left;
    const right =
      pageWidth - doc.page.margins.right;

    const contentWidth = right - left;

    doc.on('data', (chunk) => {
      chunks.push(chunk);
    });

    doc.on('end', () => {
      resolve(Buffer.concat(chunks));
    });

    doc.on('error', reject);

    /* ---------------------------------------------------------------------- */
    /* Header                                                                 */
    /* ---------------------------------------------------------------------- */

    try {
      doc.image(
        LOGO_PATH,
        left,
        42,
        {
          fit: [62, 62],
          align: 'left',
          valign: 'center',
        }
      );
    } catch (error) {
      console.warn(
        'Invoice logo could not be loaded:',
        error.message
      );
    }

    const brandX = left + 80;

    doc
      .font('Helvetica-Bold')
      .fontSize(20)
      .fillColor('#111111')
      .text(
        "CREATOR'S DESK.",
        brandX,
        43
      );

    // Seller details remain intentionally small/subordinate.
    drawWrappedText(
      doc,
      'Near Roadways Bus Stand, Bhopal Ganj, Bhilwara, Rajasthan 311001',
      brandX,
      69,
      285,
      {
        fontSize: 7.5,
        color: '#555555',
        lineGap: 1,
      }
    );

    doc
      .font('Helvetica')
      .fontSize(7.5)
      .fillColor('#555555')
      .text(
        'www.creator-s-desk.vercel.app',
        brandX,
        84
      );

    doc
      .font('Helvetica-Bold')
      .fontSize(21)
      .fillColor('#111111')
      .text(
        'INVOICE',
        right - 170,
        43,
        {
          width: 170,
          align: 'right',
        }
      );

    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#666666')
      .text(
        'COMMERCIAL INVOICE',
        right - 170,
        69,
        {
          width: 170,
          align: 'right',
        }
      );

    doc
      .moveTo(left, 124)
      .lineTo(right, 124)
      .lineWidth(0.8)
      .stroke('#222222');

    /* ---------------------------------------------------------------------- */
    /* Invoice metadata                                                       */
    /* ---------------------------------------------------------------------- */

    const metaTop = 140;

    const col1 = left;
    const col2 =
      left + contentWidth * 0.50;

    drawLabel(
      doc,
      'INVOICE NUMBER',
      col1,
      metaTop
    );

    drawValue(
      doc,
      order.invoiceNumber ||
        generateInvoiceNumber(),
      col1,
      metaTop + 12,
      220,
      { fontSize: 9.2 }
    );

    drawLabel(
      doc,
      'ORDER ID',
      col1,
      metaTop + 34
    );

    drawValue(
      doc,
      order.orderId || 'N/A',
      col1,
      metaTop + 46,
      250,
      { fontSize: 9 }
    );

    drawLabel(
      doc,
      'INVOICE DATE',
      col2,
      metaTop
    );

    drawValue(
      doc,
      new Date(
        order.createdAt || Date.now()
      ).toLocaleDateString('en-IN'),
      col2,
      metaTop + 12,
      190,
      { fontSize: 9.2 }
    );

    drawLabel(
      doc,
      'PAYMENT METHOD',
      col2,
      metaTop + 34
    );

    drawValue(
      doc,
      order.paymentMethod || 'N/A',
      col2,
      metaTop + 46,
      190,
      { fontSize: 9 }
    );

    drawLabel(
      doc,
      'PAYMENT STATUS',
      col2,
      metaTop + 68
    );

    drawValue(
      doc,
      order.paymentMethod === 'ONLINE'
        ? 'PAID'
        : 'PAY ON DELIVERY',
      col2,
      metaTop + 80,
      190,
      { fontSize: 9 }
    );

    if (
      order.paymentMethod === 'ONLINE' &&
      order.paymentId
    ) {
      drawLabel(
        doc,
        'PAYMENT ID',
        col1,
        metaTop + 68
      );

      drawValue(
        doc,
        order.paymentId,
        col1,
        metaTop + 80,
        250,
        { fontSize: 8.5 }
      );
    }

    /* ---------------------------------------------------------------------- */
    /* Seller / Bill To                                                       */
    /* ---------------------------------------------------------------------- */

    const partyTop = 250;
    const partyPadding = 14;

    const partyHeight = 98;

    const sellerX = left + partyPadding;

    const billToX =
      left + contentWidth * 0.57;

    const sellerWidth =
      contentWidth * 0.48;

    const billToWidth =
      contentWidth * 0.37;

    doc
      .roundedRect(
        left,
        partyTop,
        contentWidth,
        partyHeight,
        4
      )
      .lineWidth(0.7)
      .stroke('#D5D5D5');

    /* Seller — intentionally quiet */
    drawLabel(
      doc,
      'SELLER',
      sellerX,
      partyTop + 13
    );

    drawWrappedText(
      doc,
      "Creator's Desk.",
      sellerX,
      partyTop + 27,
      sellerWidth,
      {
        fontSize: 9.5,
        bold: true,
        color: '#111111',
      }
    );

    drawWrappedText(
      doc,
      'Near Roadways Bus Stand, Bhopal Ganj, Bhilwara, Rajasthan 311001',
      sellerX,
      partyTop + 42,
      sellerWidth,
      {
        fontSize: 7.6,
        color: '#444444',
        lineGap: 1,
      }
    );

    doc
      .font('Helvetica')
      .fontSize(7.6)
      .fillColor('#444444')
      .text(
        'GSTIN: Not registered under GST',
        sellerX,
        partyTop + 65
      )
      .text(
        'www.creator-s-desk.vercel.app',
        sellerX,
        partyTop + 78
      );

    /* Bill To — primary party information */
    drawLabel(
      doc,
      'BILL TO',
      billToX,
      partyTop + 13
    );

    const customerName =
      order.customerName ||
      'Customer';

    drawWrappedText(
      doc,
      customerName,
      billToX,
      partyTop + 27,
      billToWidth,
      {
        fontSize: 10,
        bold: true,
        color: '#111111',
        lineGap: 1,
      }
    );

    const street =
      order.shippingAddress?.street ||
      'N/A';

    const cityStateZip = [
      order.shippingAddress?.city,
      order.shippingAddress?.state,
      order.shippingAddress?.zip,
    ]
      .filter(Boolean)
      .join(', ');

    // IMPORTANT:
    // Address 2 starts after the real rendered height
    // of address 1, preventing overlap.
    const address1Y =
      partyTop + 43;

    const address1Height =
      drawWrappedText(
        doc,
        street,
        billToX,
        address1Y,
        billToWidth,
        {
          fontSize: 8.2,
          color: '#333333',
          lineGap: 1.5,
        }
      );

    const address2Y =
      address1Y +
      address1Height +
      3;

    drawWrappedText(
      doc,
      cityStateZip || 'N/A',
      billToX,
      address2Y,
      billToWidth,
      {
        fontSize: 8.2,
        color: '#333333',
        lineGap: 1.5,
      }
    );

    /* ---------------------------------------------------------------------- */
    /* Items table                                                            */
    /* ---------------------------------------------------------------------- */

    const tableTop = 370;

    const headerHeight = 27;
    const minimumRowHeight = 27;

    const columns = [
      {
        title: '#',
        width: 32,
        align: 'center',
      },
      {
        title: 'DESCRIPTION',
        width: 228,
        align: 'left',
      },
      {
        title: 'QTY',
        width: 45,
        align: 'center',
      },
      {
        title: 'UNIT PRICE',
        width: 82,
        align: 'right',
      },
      {
        title: 'AMOUNT',
        width:
          contentWidth -
          32 -
          228 -
          45 -
          82,
        align: 'right',
      },
    ];

    doc
      .rect(
        left,
        tableTop,
        contentWidth,
        headerHeight
      )
      .fill('#F1F1F1');

    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor('#222222');

    let x = left;

    columns.forEach((column) => {
      doc.text(
        column.title,
        x + 5,
        tableTop + 9,
        {
          width: column.width - 10,
          align: column.align,
        }
      );

      x += column.width;
    });

    const items = Array.isArray(order.items)
      ? order.items
      : [];

    let y =
      tableTop + headerHeight;

    items.forEach((item, index) => {
      const quantity =
        Number(item.quantity || 1);

      const price =
        Number(item.price || 0);

      const amount =
        price * quantity;

      const description =
        item.name || 'Item';

      // Calculate description height first so long
      // product names don't overlap other cells.
      doc
        .font('Helvetica-Bold')
        .fontSize(9);

      const descriptionHeight =
        doc.heightOfString(
          description,
          {
            width:
              columns[1].width - 12,
            lineGap: 1,
          }
        );

      const rowHeight = Math.max(
        minimumRowHeight,
        descriptionHeight + 12
      );

      doc
        .rect(
          left,
          y,
          contentWidth,
          rowHeight
        )
        .lineWidth(0.5)
        .stroke('#E1E1E1');

      /* Serial number */
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#111111')
        .text(
          String(index + 1),
          left + 5,
          y + 9,
          {
            width:
              columns[0].width - 10,
            align: 'center',
          }
        );

      /* Description */
      const descriptionX =
        left + columns[0].width;

      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor('#111111')
        .text(
          description,
          descriptionX + 6,
          y + 8,
          {
            width:
              columns[1].width - 12,
            lineGap: 1,
          }
        );

      /* Quantity */
      const quantityX =
        descriptionX +
        columns[1].width;

      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#111111')
        .text(
          String(quantity),
          quantityX + 5,
          y + 9,
          {
            width:
              columns[2].width - 10,
            align: 'center',
          }
        );

      /* Unit price */
      const priceX =
        quantityX +
        columns[2].width;

      doc.text(
        formatMoney(price),
        priceX + 5,
        y + 9,
        {
          width:
            columns[3].width - 10,
          align: 'right',
        }
      );

      /* Amount */
      const amountX =
        priceX +
        columns[3].width;

      doc.text(
        formatMoney(amount),
        amountX + 5,
        y + 9,
        {
          width:
            columns[4].width - 10,
          align: 'right',
        }
      );

      y += rowHeight;
    });

    if (items.length === 0) {
      const rowHeight = 27;

      doc
        .rect(
          left,
          y,
          contentWidth,
          rowHeight
        )
        .lineWidth(0.5)
        .stroke('#E1E1E1');

      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#555555')
        .text(
          'No line items',
          left + 8,
          y + 9
        );

      y += rowHeight;
    }

    /* ---------------------------------------------------------------------- */
    /* Totals                                                                 */
    /* ---------------------------------------------------------------------- */

    const subtotal = items.reduce(
      (sum, item) => {
        return (
          sum +
          Number(item.price || 0) *
            Number(item.quantity || 1)
        );
      },
      0
    );

    const shippingCharge = Number(
      order.shippingCharge ??
        SHIPPING_CHARGE
    );

    const calculatedGrandTotal =
      subtotal + shippingCharge;

    const grandTotal = Number(
      order.totalAmount ??
        calculatedGrandTotal
    );

    const totalsWidth = 235;
    const totalsX =
      right - totalsWidth;

    let totalsY = y + 17;

    const drawTotalRow = (
      labelText,
      amount,
      bold = false
    ) => {
      doc
        .font(
          bold
            ? 'Helvetica-Bold'
            : 'Helvetica'
        )
        .fontSize(
          bold ? 10.5 : 9
        )
        .fillColor('#222222')
        .text(
          labelText,
          totalsX,
          totalsY,
          {
            width: 135,
          }
        );

      doc.text(
        formatMoney(amount),
        totalsX + 135,
        totalsY,
        {
          width: 100,
          align: 'right',
        }
      );

      totalsY += bold ? 24 : 19;
    };

    drawTotalRow(
      'Subtotal',
      subtotal
    );

    drawTotalRow(
      'Shipping',
      shippingCharge
    );

    doc
      .moveTo(
        totalsX,
        totalsY - 5
      )
      .lineTo(right, totalsY - 5)
      .lineWidth(0.8)
      .stroke('#222222');

    totalsY += 5;

    drawTotalRow(
      'Grand Total',
      grandTotal,
      true
    );

    /* ---------------------------------------------------------------------- */
    /* Amount in words                                                        */
    /* ---------------------------------------------------------------------- */

    const wordsTop =
      totalsY + 9;

    doc
      .font('Helvetica-Bold')
      .fontSize(7.5)
      .fillColor('#666666')
      .text(
        'AMOUNT IN WORDS',
        left,
        wordsTop
      );

    doc
      .font('Helvetica')
      .fontSize(9.2)
      .fillColor('#111111')
      .text(
        numberToIndianWords(grandTotal),
        left,
        wordsTop + 13,
        {
          width:
            contentWidth * 0.58,
        }
      );

    /* ---------------------------------------------------------------------- */
    /* Footer / Notes                                                         */
    /* ---------------------------------------------------------------------- */

    const footerTop =
      Math.max(
        wordsTop + 58,
        pageHeight - 145
      );

    doc
      .moveTo(left, footerTop)
      .lineTo(right, footerTop)
      .lineWidth(0.6)
      .stroke('#D5D5D5');

    doc
      .font('Helvetica-Bold')
      .fontSize(7.5)
      .fillColor('#666666')
      .text(
        'NOTES',
        left,
        footerTop + 13
      );

    drawWrappedText(
      doc,
      'This is a computer-generated commercial invoice. GST is not charged because the seller is not registered under GST.',
      left,
      footerTop + 27,
      contentWidth,
      {
        fontSize: 8,
        color: '#333333',
        lineGap: 1.5,
      }
    );

    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#333333')
      .text(
        'Thank you for your purchase.',
        left,
        footerTop + 43
      );

    doc
      .font('Helvetica')
      .fontSize(7.5)
      .fillColor('#777777')
      .text(
        "Creator's Desk. • Bhilwara, Rajasthan • www.creator-s-desk.vercel.app",
        left,
        pageHeight - 43,
        {
          width: contentWidth,
          align: 'center',
        }
      );

    doc.end();
  });
}

/* -------------------------------------------------------------------------- */
/* Cloudinary                                                                 */
/* -------------------------------------------------------------------------- */

function uploadPdf(buffer, orderId) {
  return new Promise((resolve, reject) => {
    const stream =
      cloudinary.uploader.upload_stream(
        {
          resource_type: 'image',
          type:
            process.env.CLOUDINARY_DELIVERY_TYPE ||
            'upload',
          public_id: `invoices/${orderId}`,
          format: 'pdf',
          overwrite: true,
          use_filename: false,
        },
        (error, result) => {
          if (error) {
            return reject(error);
          }

          resolve(result);
        }
      );

    stream.end(buffer);
  });
}

/* -------------------------------------------------------------------------- */
/* SQS event handling                                                         */
/* -------------------------------------------------------------------------- */

async function handleOrderCreated(order) {
  if (!order?.orderId) {
    throw new Error(
      'order.created event is missing orderId'
    );
  }

  const invoiceNumber =
    order.invoiceNumber ||
    generateInvoiceNumber();

  console.log(
    `🧾 Generating invoice ${invoiceNumber} for order ${order.orderId}`
  );

  const pdfBuffer = await createInvoicePdf({
    ...order,
    invoiceNumber,
    shippingCharge: Number(
      order.shippingCharge ??
        SHIPPING_CHARGE
    ),
  });

  console.log('📄 PDF generated:', {
    size: pdfBuffer.length,
    header: pdfBuffer
      .subarray(0, 8)
      .toString(),
  });

  const uploadResult =
    await uploadPdf(
      pdfBuffer,
      order.orderId
    );

  const url =
    uploadResult?.secure_url ||
    uploadResult?.url;

  if (!url) {
    throw new Error(
      'Cloudinary did not return a delivery URL'
    );
  }

  const event = {
    event: 'invoice.generated',

    data: {
      orderId: order.orderId,
      invoiceNumber,
      url,
      provider: 'cloudinary',
      publicId:
        uploadResult.public_id || null,
      generatedAt:
        new Date().toISOString(),
    },

    publishedAt:
      new Date().toISOString(),
  };

  const client = getSqsClient();

  const result = await client.send(
    new SendMessageCommand({
      QueueUrl:
        INVOICE_GENERATED_QUEUE_URL,
      MessageBody:
        JSON.stringify(event),
    })
  );

  console.log(
    `✅ Invoice ${invoiceNumber} generated and published for order ${order.orderId} (${result.MessageId})`
  );
}

async function startSqsConsumer() {
  assertConfig();

  if (consumerRunning) {
    return;
  }

  consumerRunning = true;

  const client = getSqsClient();

  console.log(
    '📥 Invoice Service listening for order.created events...'
  );

  while (consumerRunning) {
    try {
      const response =
        await client.send(
          new ReceiveMessageCommand({
            QueueUrl:
              ORDER_CREATED_QUEUE_URL,
            MaxNumberOfMessages:
              MAX_NUMBER_OF_MESSAGES,
            WaitTimeSeconds:
              WAIT_TIME_SECONDS,
            VisibilityTimeout:
              SQS_VISIBILITY_TIMEOUT,
          })
        );

      for (
        const message of response.Messages || []
      ) {
        try {
          const envelope =
            JSON.parse(
              message.Body || '{}'
            );

          if (
            envelope.event !==
            'order.created'
          ) {
            throw new Error(
              `Unexpected event in order queue: ${envelope.event}`
            );
          }

          await handleOrderCreated(
            envelope.data
          );

          await client.send(
            new DeleteMessageCommand({
              QueueUrl:
                ORDER_CREATED_QUEUE_URL,
              ReceiptHandle:
                message.ReceiptHandle,
            })
          );
        } catch (messageError) {
          console.error(
            '❌ Failed to process order.created:',
            messageError
          );

          // Do not delete failed messages.
          // SQS will retry after the visibility timeout.
        }
      }
    } catch (pollError) {
      if (!consumerRunning) {
        break;
      }

      console.error(
        '❌ SQS invoice consumer error:',
        pollError.message
      );

      await new Promise(
        (resolve) =>
          setTimeout(resolve, 5000)
      );
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Compatibility endpoint                                                     */
/* -------------------------------------------------------------------------- */

app.post('/generate', async (req, res) => {
  try {
    const invoiceNumber =
      req.body.invoiceNumber ||
      generateInvoiceNumber();

    const pdfBuffer =
      await createInvoicePdf({
        ...req.body,
        invoiceNumber,
        shippingCharge: Number(
          req.body.shippingCharge ??
            SHIPPING_CHARGE
        ),
      });

    res.setHeader(
      'Content-Type',
      'application/pdf'
    );

    res.setHeader(
      'Content-Disposition',
      `attachment; filename=invoice-${
        invoiceNumber ||
        req.body.orderId ||
        'invoice'
      }.pdf`
    );

    res.send(pdfBuffer);
  } catch (error) {
    console.error(
      'Invoice generation error:',
      error
    );

    res.status(500).json({
      error:
        'Failed to generate invoice',
    });
  }
});

/* -------------------------------------------------------------------------- */
/* Health                                                                    */
/* -------------------------------------------------------------------------- */

app.get('/health', (req, res) => {
  res.status(200).json({
    service: 'invoice-service',
    status: consumerRunning
      ? 'healthy'
      : 'degraded',
    uptime: process.uptime(),
    timestamp:
      new Date().toISOString(),
  });
});

/* -------------------------------------------------------------------------- */
/* Server lifecycle                                                           */
/* -------------------------------------------------------------------------- */

async function startServer() {
  startSqsConsumer().catch(
    (error) => {
      console.error(
        '⚠️ Invoice SQS consumer unavailable:',
        error.message
      );
    }
  );

  app.listen(
    PORT,
    '0.0.0.0',
    () => {
      console.log(
        `🧾 Invoice Service running on port ${PORT}`
      );
    }
  );
}

function shutdown() {
  consumerRunning = false;
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

startServer();