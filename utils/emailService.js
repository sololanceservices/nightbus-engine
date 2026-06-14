// ==================== utils/emailService.js ====================
const nodemailer = require('nodemailer');
const https = require('https');

/**
 * Helper to perform HTTPS POST requests (compatible with all Node.js versions)
 */
const postJSON = (url, headers, body) => {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      method: 'POST',
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      headers: headers
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, data: parsed });
        } catch (e) {
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, data: { message: data } });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(JSON.stringify(body));
    req.end();
  });
};

/**
 * Real email service using Nodemailer (Gmail SMTP) or Brevo HTTP API.
 */
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 465,
  secure: parseInt(process.env.SMTP_PORT) === 465 || !process.env.SMTP_PORT, // true for 465, false for other ports
  auth: {
    user: process.env.GMAIL_USER || process.env.SMTP_USER,
    pass: process.env.GMAIL_APP_PASS || process.env.SMTP_PASS
  }
});

const sendOTP = async (email, otp) => {
  const htmlContent = `
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
  `;

  // 1. If Brevo API key is available, use Brevo HTTP API (Safe from Hostinger SMTP Port Blocking)
  if (process.env.BREVO_API_KEY) {
    try {
      console.log('Sending OTP via Brevo HTTP API...');
      const response = await postJSON(
        'https://api.brevo.com/v3/smtp/email',
        {
          'accept': 'application/json',
          'api-key': process.env.BREVO_API_KEY,
          'content-type': 'application/json'
        },
        {
          sender: {
            name: "Night Bus Auth",
            email: process.env.BREVO_SENDER || process.env.GMAIL_USER || process.env.SMTP_USER
          },
          to: [{ email: email }],
          subject: 'Your Verification Code - Night Bus',
          htmlContent: htmlContent
        }
      );

      if (!response.ok) {
        throw new Error(response.data.message || 'Failed to send via Brevo API');
      }

      console.log(`✅ Email sent successfully to ${email} via Brevo API`);
      return { success: true, messageId: response.data.messageId };
    } catch (error) {
      console.error('❌ Brevo API Email Error:', error);
      return { success: false, error: error.message };
    }
  }

  // 2. Fallback to Nodemailer SMTP
  try {
    const mailOptions = {
      from: `"Night Bus Auth" <${process.env.GMAIL_USER || process.env.SMTP_USER}>`,
      to: email,
      subject: 'Your Verification Code - Night Bus',
      text: `Your OTP for Night Bus is: ${otp}. It expires in 10 minutes.`,
      html: htmlContent
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent successfully to ${email}: ${info.messageId}`);
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ SMTP Email Error:', error);
    if (error.code === 'EAUTH') {
      console.log('💡 TIP: Check if GMAIL_APP_PASS is a valid App Password and not your regular password.');
    }
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendOTP
};

