export const verifyCustomerProfile = (req, res, next) => {
  try {
    const customer = req.customer; // from authenticateCustomer middleware

    // If customer not authenticated using ZIP
    if (!customer.isAuthenticated) {
      return res.status(400).json({
        message: "Please complete your profile with ZIP code to create a bid.",
      });
    }

    next(); // continue to bid creation
  } catch (error) {
    console.error("verifyCustomerProfile Error:", error);
    return res.status(500).json({
      message: "Server error validating customer profile",
    });
  }
};
