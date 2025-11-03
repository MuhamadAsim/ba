import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Customer from "../models/customerModel.js"; // make sure default import
import multer from "multer";
import path from "path";

// SIGNUP
export const signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if customer already exists
    const existingCustomer = await Customer.findOne({ email });
    if (existingCustomer) {
      return res.status(409).json({
        message: "Email is already in use. Please try logging in."
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const newCustomer = new Customer({
      name,
      email,
      password: hashedPassword,
      isAuthenticated: true
    });

    await newCustomer.save();

    // Generate JWT token
    const token = jwt.sign(
      { customerId: newCustomer._id, email: newCustomer.email },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.status(201).json({
      message: "Account created successfully! You are now logged in.",
      token,
      customer: {
        id: newCustomer._id,
        name: newCustomer.name,
        email: newCustomer.email,
        avatar: newCustomer.avatar || null, // send avatar too if exists
        phone: newCustomer.phone || null,
        address: newCustomer.address || null,
        zip: newCustomer.zip || null
      }
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({
      message: "Server error during signup. Please try again later.",
      error: error.message
    });
  }
};

// SIGNIN
export const signin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find customer by email
    const customer = await Customer.findOne({ email });
    if (!customer) {
      return res.status(404).json({
        message: "No account found with this email. Please sign up first."
      });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, customer.password);
    if (!isMatch) {
      return res.status(401).json({
        message: "Incorrect password. Please try again."
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { customerId: customer._id, email: customer.email },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    customer.isAuthenticated = true;
    await customer.save();

    res.status(200).json({
      message: "Login successful! Welcome back.",
      token,
      customer: {
        id: customer._id,
        name: customer.name,
        email: customer.email,
        avatar: customer.avatar || null,
        phone: customer.phone || null,
        address: customer.address || null,
        zip: customer.zip || null,
      }
    });
  } catch (error) {
    console.error("Signin error:", error);
    res.status(500).json({
      message: "Server error during login. Please try again later.",
      error: error.message
    });
  }
};






// UPDATE PROFILE
export const updateProfile = async (req, res) => {
  try {
    const customer = req.customer; // from authenticateCustomer middleware

    // Only allow updates to specific fields
    const fieldsToUpdate = ["name", "phone", "address", "zip"];
    fieldsToUpdate.forEach((field) => {
      if (req.body[field] !== undefined) customer[field] = req.body[field];
    });

    // ✅ If avatar file uploaded (Cloudinary)
    if (req.file) {
      customer.avatar = req.file.path; // Cloudinary gives the full URL here
    }

    await customer.save();

    res.status(200).json({
      message: "Profile updated successfully",
      customer: {
        id: customer._id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone || "",
        address: customer.address || "",
        zip: customer.zip || "",
        avatar: customer.avatar || "",
      },
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({
      message: "Server error while updating profile",
      error: error.message,
    });
  }
};
