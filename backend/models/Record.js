import mongoose from "mongoose";

const recordSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Patient is required."]
    },
    cid: {
      type: String,
      required: [true, "CID is required."],
      trim: true,
      minlength: [3, "CID must be at least 3 characters."]
    },
    fileHash: {
      type: String,
      required: [true, "File hash is required."],
      trim: true,
      minlength: [64, "File hash must be a SHA-256 hex string."]
    },
    filename: {
      type: String,
      required: [true, "Filename is required."],
      trim: true,
      minlength: [1, "Filename is required."],
      maxlength: [255, "Filename cannot exceed 255 characters."]
    },
    permissions: {
        type: [
          {
            doctorId: {
              type: mongoose.Schema.Types.ObjectId,
              ref: "User",
              required: true
            },
            canView: {
              type: Boolean,
              default: true
            },
            expires: {
              type: Date,
              default: null
            }
          }
        ],
        default: [],
        validate: {
          validator(value) {
            return Array.isArray(value);
          },
          message: "Permissions must be an array of permission objects."
        }
    },
    hospitalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      required: [true, "Hospital is required."]
    }
  },
  {
    timestamps: true
  }
);

recordSchema.index({ patientId: 1, hospitalId: 1 });
recordSchema.index({ cid: 1 }, { unique: true });

const Record = mongoose.model("Record", recordSchema);

export default Record;
