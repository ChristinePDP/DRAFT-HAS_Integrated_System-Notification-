// 

import nodemailer from 'nodemailer';
import 'dotenv/config';

// GMAIL CONFIGURATION
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true, // true para sa port 465 (SSL)
  auth: {
    user: process.env.NODEMAILER_USER,
    pass: process.env.NODEMAILER_PASS,
  },
  connectionTimeout: 10000, // 10 seconds timeout para hindi mag-hang ng 2 mins kung sakaling i-block pa rin
});

export const sendEmail = async (to, subject, text) => {
  try {
    const mailOptions = {
      from: `"Hospital Notification System" <${process.env.NODEMAILER_USER}>`, // Ito yung lalabas na pangalan sa sender
      to,
      subject,
      text,
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log(`✓ Real Email sent to ${to}: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error('❌ Failed to send email:', error);
    throw error;
  }
};
