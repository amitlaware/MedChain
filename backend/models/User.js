import bcrypt from "bcryptjs";
import mongoose from "mongoose";

export const USER_ROLES = ["patient", "doctor", "admin"];

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false
    },
    role: {
      type: String,
      enum: USER_ROLES,
      required: true,
      default: "patient"
    },
    hospitalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      default: null
    },
    hospitalName: {
      type: String,
      trim: true,
      default: ""
    },
    licenseNumber: {
      type: String,
      trim: true,
      default: ""
    },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
      default: "other"
    },
    dateOfBirth: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

userSchema.pre("save", async function hashPassword(next) {
  if (!this.isModified("password")) {
    next();
    return;
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toSafeObject = function toSafeObject() {
  // Logic to map local data to Blockchain MSPs for visual proof
  let mspId = "Org1MSP"; 
  if (this.role === "admin") mspId = "GlobalAdmin";
  else if (this.hospitalName && this.hospitalName.toLowerCase().includes("san")) mspId = "Org2MSP";
  else if (this.hospitalName && this.hospitalName.toLowerCase().includes("pra")) mspId = "Org1MSP";

  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    role: this.role,
    hospitalId: this.hospitalId,
    hospitalName: this.hospitalName,
    licenseNumber: this.licenseNumber,
    gender: this.gender,
    dateOfBirth: this.dateOfBirth,
    mspId
  };
};

const User = mongoose.model("User", userSchema);

export default User;
