// simple in-memory OTP store
// otpStore[email] = { otp: '123456', expiresAt: 1234567890, attempts: 0 }

export const otpStore = {};

// helper to clear expired otps periodically (optional)
setInterval(() => {
  const now = Date.now();
  for (const email of Object.keys(otpStore)) {
    if (otpStore[email].expiresAt <= now) {
      delete otpStore[email];
    }
  }
}, 60 * 1000); // every minute
