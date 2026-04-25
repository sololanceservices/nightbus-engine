// ==================== utils/emailService.js ====================
const nodemailer = require('nodemailer');

/**
 * Real email service using Nodemailer and Gmail SMTP.
 */
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER || process.env.SMTP_USER,
    pass: process.env.GMAIL_APP_PASS || process.env.SMTP_PASS
  }
});

const sendOTP = async (email, otp) => {
  try {
    const mailOptions = {
      from: `"Night Bus Auth" <${process.env.GMAIL_USER || process.env.SMTP_USER}>`,
      to: email,
      subject: 'Your Verification Code - Night Bus',
      text: `Your OTP for Night Bus is: ${otp}. It expires in 10 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 500px;">
          <h2 style="color: #6366f1; text-align: center;">Night Bus Verification</h2>
          <p>Hello,</p>
          <p>Use the following 6-digit OTP to complete your verification process. This code is valid for 10 minutes.</p>
          <div style="background-color: #f3f4f6; padding: 15px; text-align: center; border-radius: 8px; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #111827;">${otp}</span>
          </div>
          <p style="color: #6b7280; font-size: 12px; text-align: center;">If you didn't request this, please ignore this email.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="text-align: center; font-weight: bold; color: #6366f1;">Night Bus Team</p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent successfully to ${email}: ${info.messageId}`);
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Email Error:', error);
    // Log helpful error for Gmail auth failures
    if (error.code === 'EAUTH') {
      console.log('💡 TIP: Check if GMAIL_APP_PASS is a valid App Password and not your regular password.');
    }
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendOTP
};
