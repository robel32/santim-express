const axios = require("axios");
const { signES256 } = require("./cryptography.js");
const { PRODUCTION_BASE_URL } = require("./constants.js");

class SantimpaySdk {
  constructor(merchantId, privateKey) {
    this.privateKey = privateKey;
    this.merchantId = merchantId;
    this.baseUrl = PRODUCTION_BASE_URL;
  }
  generateSignedTokenForInitiatePayment(amount, paymentReason) {
    const time = Math.floor(Date.now() / 1000);
    const payload = {
      amount,
      paymentReason,
      merchantId: this.merchantId,
      generated: time,
    };
    return signES256(payload, this.privateKey);
  }
  generateSignedTokenForDirectPayment(
    amount,
    paymentReason,
    paymentMethod,
    phoneNumber
  ) {
    const time = Math.floor(Date.now() / 1000);
    const payload = {
      amount,
      paymentReason,
      paymentMethod,
      phoneNumber,
      merchantId: this.merchantId,
      generated: time,
    };
    return signES256(payload, this.privateKey);
  }
  generateSignedTokenForGetTransaction(id) {
    const time = Math.floor(Date.now() / 1000);
    const payload = {
      id,
      merId: this.merchantId,
      generated: time,
    };
    return signES256(payload, this.privateKey);
  }
  async generatePaymentUrl(
    id,
    amount,
    paymentReason,
    successRedirectUrl,
    failureRedirectUrl,
    notifyUrl,
    phoneNumber = "",
    cancelRedirectUrl = ""
  ) {
    try {
      const token = this.generateSignedTokenForInitiatePayment(
        amount,
        paymentReason
      );
      const payload = {
        id,
        amount,
        reason: paymentReason,
        merchantId: this.merchantId,
        signedToken: token,
        successRedirectUrl,
        failureRedirectUrl,
        notifyUrl,
        cancelRedirectUrl,
      };
      if (phoneNumber && phoneNumber.length > 0) {
        payload.phoneNumber = phoneNumber;
      }
      const response = await axios.post(
        `${this.baseUrl}/initiate-payment`,
        payload

        // {
        // headers: {
        //   Authorization: `Bearer ${this.token}`
        // }
        // }
      );

      if (response.status === 200) {
        console.log("response" + response.data.url);
        return response.data.url;
      } else {
        throw new Error("Failed to initiate payment");
      }
    } catch (error) {
      if (error.response && error.response.data) {
        throw error.response.data;
      }
      throw error;
    }
  }
  async sendToCustomer(
    id,
    amount,
    paymentReason,
    phoneNumber,
    paymentMethod,
    notifyUrl
  ) {
    try {
      const token = this.generateSignedTokenForDirectPaymentOrB2C(
        amount,
        paymentReason,
        this.merchantId,
        paymentMethod,
        phoneNumber
      );
      const payload = {
        id,
        clientReference: id,
        amount,
        reason: paymentReason,
        merchantId: this.merchantId,
        signedToken: token,
        receiverAccountNumber: phoneNumber,
        notifyUrl,
        paymentMethod,
      };
      const response = await axios.post(
        `${this.baseUrl}/payout-transfer`,
        payload
      );
      if (response.status === 200) {
        return response.data;
      } else {
        throw new Error("Failed to initiate B2C");
      }
    } catch (error) {
      if (error.response && error.response.data) {
        throw error.response.data;
      }
      throw error;
    }
  }
  generateSignedTokenForDirectPaymentOrB2C(
    amount,
    paymentReason,
    paymentMethod,
    phoneNumber
  ) {
    const time = Math.floor(Date.now() / 1000);
    const payload = {
      amount,
      paymentReason,
      paymentMethod,
      phoneNumber,
      merchantId: this.merchantId,
      generated: time,
    };
    return signES256(payload, this.privateKey);
  }
  async directPayment(
    id,
    amount,
    paymentReason,
    notifyUrl,
    phoneNumber,
    paymentMethod
  ) {
    try {
      const token = this.generateSignedTokenForDirectPayment(
        amount,
        paymentReason,
        paymentMethod,
        phoneNumber
      );
      const payload = {
        id,
        amount,
        reason: paymentReason,
        merchantId: this.merchantId,
        signedToken: token,
        phoneNumber,
        paymentMethod,
        notifyUrl,
      };
      if (phoneNumber && phoneNumber.length > 0) {
        payload.phoneNumber = phoneNumber;
      }
      const response = await axios.post(
        `${this.baseUrl}/direct-payment`,
        payload

        // {
        // headers: {
        //   Authorization: `Bearer ${this.token}`
        // }
        // }
      );

      if (response.status === 200) {
        return response.data;
      } else {
        throw new Error("Failed to initiate direct payment");
      }
    } catch (error) {
      if (error.response && error.response.data) {
        throw error.response.data;
      }
      throw error;
    }
  }
  async checkTransactionStatus(id) {
    try {
      const token = this.generateSignedTokenForGetTransaction(id);
      const data = {
        id,
        merchantId: this.merchantId,
        signedToken: token,
      };
      console.log("checking");
      console.log(data);
      const response = await axios.post(
        `${this.baseUrl}/fetch-transaction-status`,
        {
          id,
          merchantId: this.merchantId,
          signedToken: token,
        }
        // {
        // headers: {
        //   Authorization: `Bearer ${this.token}`
        // }
        // }
      );

      if (response.status === 200) {
        return response.data;
      } else {
        throw new Error("Failed to initiate payment");
      }
    } catch (error) {
      if (error.response && error.response.data) {
        throw error.response.data;
      }
      throw error;
    }
  }
}

module.exports = SantimpaySdk;
