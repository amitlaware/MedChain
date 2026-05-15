import mongoose from "mongoose";

export const TRANSFER_REQUEST_STATUSES = ["pending", "approved", "completed", "rejected", "cancelled"];

const transferRequestSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Patient is required."]
    },
    recordId: {
      type: String,
      required: [true, "Record ID is required."]
    },
    fromHospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      required: [true, "Source hospital is required."]
    },
    toHospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      required: [true, "Destination hospital is required."],
      validate: {
        validator(value) {
          return !this.fromHospital || !value || !value.equals(this.fromHospital);
        },
        message: "Destination hospital must be different from source hospital."
      }
    },
    toDoctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false
    },
    status: {
      type: String,
      enum: {
        values: TRANSFER_REQUEST_STATUSES,
        message: "Invalid transfer request status."
      },
      default: "pending",
      required: true
    }
  },
  {
    timestamps: true
  }
);

transferRequestSchema.index({ patientId: 1, status: 1 });
transferRequestSchema.index({ fromHospital: 1, toHospital: 1 });

const TransferRequest = mongoose.model("TransferRequest", transferRequestSchema);

export default TransferRequest;
