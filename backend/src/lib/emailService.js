import nodemailer from "nodemailer";

/**
 * Sends a security OTP to the specified admin email.
 * Falls back to printing the OTP to console if SMTP variables are not set.
 * 
 * @param {string} toEmail 
 * @param {string} otp 
 * @returns {Promise<{success: boolean, delivered: boolean, error?: string}>}
 */
export async function sendEmailOtp(toEmail, otp) {
  const isDev = process.env.NODE_ENV !== "production";
  
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || "noreply@stylingwithmuskan.com";

  console.log(`📨 [Email OTP] Generating OTP for admin: To = ${toEmail}, OTP = ${otp}`);

  if (!host || !user || !pass) {
    console.log("⚠️ [Email Service] SMTP configuration missing. OTP fallback to Console only.");
    return {
      success: true,
      delivered: false,
      message: "SMTP settings missing. Logged to console.",
      otp: isDev ? otp : undefined
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port: Number(port),
      secure: Number(port) === 465, // true for port 465, false for other ports
      auth: {
        user,
        pass,
      },
    });

    const mailOptions = {
      from: `"SWM Admin Security" <${from}>`,
      to: toEmail,
      subject: "Your SWM Admin OTP Code",
      text: `Hello, your OTP code to update the Admin password is: ${otp}. This code is valid for 5 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; border: 1px solid #eaeaea; border-radius: 8px;">
          <h2 style="color: #0F172A; text-align: center;">Styling With Muskan</h2>
          <hr style="border: 0; border-top: 1px solid #eaeaea; margin: 20px 0;" />
          <p style="font-size: 16px; color: #334155;">Hello,</p>
          <p style="font-size: 16px; color: #334155;">A request was made to update your SWM Admin dynamic password. Please use the following One-Time Password (OTP) to complete the security verification:</p>
          <div style="text-align: center; margin: 30px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #2563EB; background-color: #EFF6FF; padding: 10px 30px; border-radius: 6px; border: 1px dashed #BFDBFE;">${otp}</span>
          </div>
          <p style="font-size: 14px; color: #64748B;">This OTP is valid for <strong>5 minutes</strong>. If you did not initiate this request, please change your password immediately or contact technical support.</p>
          <hr style="border: 0; border-top: 1px solid #eaeaea; margin: 20px 0;" />
          <p style="font-size: 12px; color: #94A3B8; text-align: center;">This is an automated security email. Please do not reply directly to this message.</p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`📨 [Email OTP] Email sent successfully: ${info.messageId}`);
    return { success: true, delivered: true, info };
  } catch (error) {
    console.error("❌ [Email Service] Failed to send email via SMTP:", error);
    return { success: true, delivered: false, error: error.message };
  }
}
