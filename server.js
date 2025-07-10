require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const SantimpaySdk = require("./santim_utils/santimpay-sdk");
const mongoose = require("mongoose");
const User = require("./models/user.model.js");
const Transaction = require("./models/transaction.models");

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
const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL;
// Initialize baseUrl for all routes
const baseUrl = process.env.BASE_URL;

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

    // Construct base URL for callbacks
    const baseUrl =
      process.env.FRONTEND_BASE_URL ||
      req.headers.origin ||
      `http://${req.headers.host}`;
    console.log(`${baseUrl}/cancelPayment`);
    // Generate payment URL using SantimPay SDK
    const paymentUrl = await santimpay.generatePaymentUrl(
      transactionId,
      amount,
      description || `Payment for Order #${orderId}`,
      `${baseUrl}/payment/success?transactionId=${transactionId}`,
      `${baseUrl}/payment/failed?transactionId=${transactionId}`,
      `${baseUrl}/api/payments/callback`,
      phoneNumber || "",
      // `${baseUrl}/cancelPayment`
      `${baseUrl}/payment/canceled?transactionId=${transactionId}`
    );

    // Save the transaction in the database
    const transaction = new Transaction({
      transactionId,
      type: "PAYMENT",
      merchantId: process.env.SANITMPAY_MERCHANT_ID,
      amount,
      status: "INITIATED",
      paymentDetails: {
        orderId,
        description,
        phoneNumber,
        paymentUrl,
      },
    });

    await transaction.save();

    console.log(`New payment initiated: ${transactionId} for order ${orderId}`);

    res.json({
      success: true,
      paymentUrl: paymentUrl,
      transactionId: transactionId,
    });
  } catch (error) {
    console.error("Payment initiation error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to initiate payment.",
      error: error.message || error,
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

    // Find and update the transaction in the database
    const transaction = await Transaction.findOneAndUpdate(
      { santimPayTxnId: thirdPartyId },
      {
        $set: {
          status: Status.toUpperCase(),
          "paymentDetails.totalAmount": totalAmount,
        },
        $push: {
          webhookData: {
            thirdPartyId,
            status: Status,
            amount: totalAmount,
            rawData: req.body,
          },
        },
      },
      { new: true }
    );

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found.",
      });
    }

    res.json({
      success: true,
      message: "Callback processed successfully.",
      transaction,
    });
  } catch (error) {
    console.error("Callback processing error:", error);

    res.status(500).json({
      success: false,
      message: "Callback processing failed.",
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
  // const transactionDetails = req.query;

  console.log("Payment was a success:", transactionDetails);
  // // this is where you can redirect the user to a success
  // res.json({
  //   status: "success",
  //   ...transactionDetails,
  // });
  res.redirect(`${FRONTEND_BASE_URL}/successfullPayment`);
});
app.get("/payment/failed", (req, res) => {
  // const transactionDetails = req.query;

  console.log("Payment failed:", transactionDetails);
  // res.json({ status: "failed", transactionDetails });
  res.redirect(`${FRONTEND_BASE_URL}/cancelPayment`);
});
app.get("/payment/canceled", (req, res) => {
  const transactionDetails = req.query;

  console.log("Payment was canceled:", transactionDetails);
  res.json({ status: "canceled", transactionDetails });
});

//-----------------------------------Payout-----------------------------------//

app.post("/api/payments/payout", async (req, res) => {
  let { id, amount, paymentReason, phoneNumber, paymentMethod, telegramId } =
    req.body;

  if (!amount || !phoneNumber || !telegramId) {
    return res.status(400).json({
      success: false,
      message: "Amount, Phone Number, and Telegram ID are required.",
    });
  }

  if (!id) {
    id = `WITHD_${Math.floor(100000 + Math.random() * 900000)}`; // Default Random 6-digit
  }

  if (!paymentReason) {
    paymentReason = `ATS-Bingo withdraw order for ${id}`; // Default reason
  }

  if (!paymentMethod) {
    paymentMethod = "Telebirr"; // Default payment method
  }

  try {
    // Check the user's wallet balance
    // const user = await User.findOne({ telegramId });

    if (!user) {
      console.error("User not found for telegramId:", telegramId);
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    // Ensure the remaining balance after deduction is more than 10 ETB
    const remainingBalance = user.walletBalance - parseFloat(amount);
    if (remainingBalance < 10) {
      console.error(
        `Insufficient balance for user ${telegramId}. Remaining balance would be ${remainingBalance}`
      );
      return res.status(400).json({
        success: false,
        message: "Minimum balance of 10 ETB must be remained in wallet.",
      });
    }

    // Deduct the amount from the user's wallet balance
    const updatedUser = await User.findOneAndUpdate(
      { telegramId },
      { $inc: { walletBalance: -parseFloat(amount) } }, // Deduct the amount
      { new: true }
    );

    console.log(
      `Wallet balance deducted for user ${telegramId}: -${amount}. Remaining balance: ${updatedUser.walletBalance}`
    );

    // Use the baseUrl for the notifyUrl for the payout
    const notifyUrl = `${baseUrl}/api/payments/payout-webhook`;

    const payoutResponse = await santimpay.sendToCustomer(
      id,
      amount,
      paymentReason,
      phoneNumber,
      paymentMethod,
      notifyUrl
    );

    // Save the payout transaction in the database
    const transaction = new Transaction({
      transactionId: id,
      type: "WITHDRAW",
      merchantId: process.env.SANITMPAY_MERCHANT_ID,
      amount,
      status: "INITIATED",
      telegramId,
      payoutDetails: {
        paymentReason,
        phoneNumber,
        paymentMethod,
        notifyUrl: notifyUrl,
      },
    });

    await transaction.save();

    console.log("Payout response:", payoutResponse);

    res.json({
      success: true,
      message: "Payout initiated successfully.",
      data: payoutResponse,
    });
  } catch (error) {
    console.error("Payout error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to initiate payout.",
      error: error.message || error,
    });
  }
});

/**
 * Payout Webhook Endpoint
 * POST /api/payments/payout-webhook
 */
app.post("/api/payments/payout-webhook", async (req, res) => {
  try {
    const { transactionId, status, amount, paymentMethod, timestamp } =
      req.body;

    console.log("Payout webhook received:", req.body);

    // Validate the incoming data
    if (!transactionId || !status) {
      return res.status(400).json({
        success: false,
        message: "Invalid webhook payload.",
      });
    }

    // Find and update the transaction in the database
    const transaction = await Transaction.findOneAndUpdate(
      { transactionId },
      {
        $set: { status: status.toUpperCase() },
        $push: {
          webhookData: {
            status,
            amount,
            paymentMethod,
            timestamp,
            rawData: req.body,
          },
        },
      },
      { new: true }
    );

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found.",
      });
    }

    res.json({
      success: true,
      message: "Webhook processed successfully.",
      transaction,
    });
  } catch (error) {
    console.error("Error processing payout webhook:", error);

    res.status(500).json({
      success: false,
      message: "Failed to process webhook.",
    });
  }
});

//-----------------------------------Payout-Ends-----------------------------------//

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({ error: "Internal server error" });
});

app.post("/api/users/deduct-wallet", async (req, res) => {
  console.log("this is the wallet deduct end point");
});

app.post("/api/users/add-wallet", async (req, res) => {
  console.log("this isthe wallet add end point");
});

// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

mongoose
  .connect(
    "mongodb+srv://robeltab:FIpwU9hafZJeCcQo@cluster0.evg05.mongodb.net/TelegramGame"
  )
  .then(() => {
    console.log("connected to mongodb");
  })
  .catch((error) => {
    console.log("error connecting to mongodb", error);
  });
console.log(`Attempting to start server on port ${PORT}`);
