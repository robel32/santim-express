const mongoose = require("mongoose");

const gameSchema = new mongoose.Schema(
  {
    gameId: {
      type: String,
      required: true,
      unique: true,
      index: true, // For fast lookups
    },
    betAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    players: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User", // References User._id
          required: true,
        },
      },
    ],
    status: {
      type: String,
      enum: ["active", "completed", "cancelled"],
      default: "active",
    },
    winnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // References User._id
      required: false, // Set when game ends
    },
    winningAmount: {
      type: Number,
      min: 0,
      required: false,
    },
    systemCommisson: {
      type: Number,
      min: 0,
      required: false,
    },
  },
  {
    timestamps: true,
    collection: "Game",
  }
);

// Customize output to match User schema format
gameSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
  },
});

const Game = mongoose.model("Game", gameSchema);
module.exports = Game;
