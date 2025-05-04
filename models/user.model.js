const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    telegramId: {
      type: String,
      required: true,
      unique: true,
      index: true, // For fast lookups
    },
    username: String,
    firstName: String,
    lastName: String,
    photoUrl: String,
    languageCode: String,
    walletBalance: {
      type: Number,
      default: 0.0,
      min: 0, // Prevent negative balances
      required: true,
    },
    phoneNumber: String,
  },
  {
    timestamps: true, // Creates createdAt and updatedAt automatically
    collection: "User", // Explicitly set collection name to match Prisma
  }
);

// Customize the output to match Prisma's expected format
userSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
  },
});

const User = mongoose.model("User", userSchema);
module.exports = User;
