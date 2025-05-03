require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const SantimpaySdk = require("./santim_utils/santimpay-sdk");

const app = express();

// Middleware
app.use(cors({ origin: "*" }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Initialize SantimPay SDK
const santimpay = new SantimpaySdk(
  process.env.SANITMPAY_MERCHANT_ID,
  process.env.SANITMPAY_PRIVATE_KEY
);

/**
 * Initiate Payment Endpoint
 * POST /api/payments/initiate
 */
app.post("/api/payments/initiate", async (req, res) => {
  try {
    const { orderId, amount, description, phoneNumber } = req.body;

    if (!orderId || !amount) {
      return res.status(400).json({
        success: false,
        message: "orderId and amount are required",
      });
    }

    // Generate unique transaction ID
    const transactionId = `txn_${Date.now()}_${Math.floor(
      Math.random() * 1000
    )}`;

    const baseUrl = "https://santim-express.onrender.com";

    // Generate payment URL using SantimPay SDK
    const paymentUrl = await santimpay.generatePaymentUrl(
      transactionId,
      amount,
      description || `Payment for Order #${orderId}`,
      `${baseUrl}/payment/success?transactionId=${transactionId}`,
      `${baseUrl}/payment/failed?transactionId=${transactionId}`,
      `${baseUrl}/api/payments/callback`,
      phoneNumber || "",
      `${baseUrl}/payment/canceled?transactionId=${transactionId}`
    );

    // In a real application, store the transaction in your database here
    console.log(`New payment initiated: ${transactionId} for order ${orderId}`);

    res.json({
      success: true,
      paymentUrl: paymentUrl,
      transactionId: transactionId,
    });
  } catch (error) {
    console.error("Payment initiation error:", error);

    let errorMessage = "Failed to initiate payment";
    let statusCode = 500;

    if (error.response) {
      errorMessage = error.response.data?.message || errorMessage;
      statusCode = error.response.status;
    } else if (error.message) {
      errorMessage = error.message;
    }

    res.status(statusCode).json({
      success: false,
      message: errorMessage,
      error: error.response?.data || error.message,
    });
  }
});

/**
 * SantimPay Callback Endpoint
 * POST /api/payments/callback
 */
app.post("/api/payments/callback", async (req, res) => {
  try {
    const { thirdPartyId, Status, totalAmount } = req.body;

    console.log("Received payment callback:", {
      thirdPartyId,
      Status,
      totalAmount,
    });
    // Update your database with the payment status
    // Example: await updatePaymentStatus(transactionId, status, amount);
    res.json({
      status: "received",
      thirdPartyId: thirdPartyId,
    });
  } catch (error) {
    console.error("Callback processing error:", error);
    res.status(500).json({
      status: "error",
      message: "Callback processing failed",
    });
  }
});

/**
 * Payment Status Check Endpoint
 * GET /api/payments/status/:transactionId
 */
app.get("/api/payments/status/:transactionId", async (req, res) => {
  try {
    const { transactionId } = req.params;

    const status = await santimpay.checkTransactionStatus(transactionId);

    res.json({
      success: true,
      transactionId,
      status,
    });
  } catch (error) {
    console.error("Status check error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check payment status",
    });
  }
});

// Payment status pages (same as previous implementation)
app.get("/payment/success", (req, res) => {
  const transactionDetails = req.query;

  console.log("Payment was a success:", transactionDetails);
  // this is where you can redirect the user to a success
  res.json({
    status: "success",
    txnId: transactionDetails.txnId,
    totalAmount: transactionDetails.totalAmount,
    paymentVia: transactionDetails.paymentVia,
  });
});
app.get("/payment/failed", (req, res) => {
  const transactionDetails = req.query;

  console.log("Payment failed:", transactionDetails);
  res.json({ status: "failed", transactionDetails });
});
app.get("/payment/canceled", (req, res) => {
  const transactionDetails = req.query;

  console.log("Payment was canceled:", transactionDetails);
  res.json({ status: "canceled", transactionDetails });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
