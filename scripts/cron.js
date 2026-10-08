import https from "https";

const urls = [
  "https://creator-s-desk-api-gateway.onrender.com/health",
  "https://creator-s-desk-auth-service.onrender.com/health",
  "https://creator-s-desk-invoice-service.onrender.com/health",
  "https://creator-s-desk-payment-service.onrender.com/health",
  "https://creator-s-desk-order-service.onrender.com/health",
  "https://creator-s-desk-ai-service.onrender.com/health",
  "https://creator-s-desk-product-service.onrender.com/",
];

urls.forEach((url) => {
  https.get(url).on("error", (err) => {
    console.error(`Failed to hit ${url}:`, err.message);
  });
});