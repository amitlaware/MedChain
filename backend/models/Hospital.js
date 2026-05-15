import mongoose from "mongoose";

const hospitalSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Hospital name is required."],
      trim: true,
      minlength: [2, "Hospital name must be at least 2 characters."],
      maxlength: [120, "Hospital name cannot exceed 120 characters."]
    },
    address: {
      type: String,
      required: [true, "Hospital address is required."],
      trim: true,
      minlength: [5, "Hospital address must be at least 5 characters."],
      maxlength: [300, "Hospital address cannot exceed 300 characters."]
    }
  },
  {
    timestamps: true
  }
);

hospitalSchema.index({ name: 1 });

const Hospital = mongoose.model("Hospital", hospitalSchema);

export default Hospital;
