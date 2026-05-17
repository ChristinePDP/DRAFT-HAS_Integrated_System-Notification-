import NotificationLog from '../models/NotificationLog.js';
import { sendEmail } from '../config/mailer.js';

/**
 * Process Notification Controller
 * 
 * Handles incoming notification requests forwarded by the Adapter Layer (Group 2).
 * The Adapter Layer is the ONLY external actor that directly calls this endpoint,
 * routing requests from various microservices (Appointment System, Queue System, etc.)
 * on their behalf.
 * 
 * Implements duplicate detection, email sending, and database logging.
 * 
 * Request body format (forwarded by Adapter Layer):
 * {
 *   "senderSystem": "string" (optional - original sender's name, e.g., "Appointment System"),
 *   "recipientEmail": "string",
 *   "subject": "string",
 *   "message": "string"
 * }
 * 
 * If senderSystem is not provided, it will be auto-detected from the JWT token's role.
 */
export const processNotification = async (req, res) => {
  try {
    // Step 1: Extract and validate request body
    // Note: The Adapter Layer forwards the request on behalf of the original sender
    const { senderSystem: providedSenderSystem, recipientEmail, subject, message } = req.body;

    // Validate required fields
    if (!recipientEmail || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'Adapter Layer: Missing required fields in forwarded request',
        code: 'MISSING_FIELDS',
        required: ['recipientEmail', 'subject', 'message'],
        received: { recipientEmail, subject, message },
      });
    }

    // DETERMINE SENDER SYSTEM
    // Priority: Use senderSystem if provided by Adapter Layer, otherwise auto-detect from token
    let senderSystem = 'Unknown System';
    
    if (providedSenderSystem && providedSenderSystem.trim()) {
      // Use the sender system explicitly passed by the Adapter Layer
      senderSystem = providedSenderSystem;
      console.log(`[Adapter Layer] Using provided sender system: ${senderSystem}`);
    } else if (req.user && req.user.role) {
      // Fall back to auto-detection based on JWT role
      const role = req.user.role;
      if (role === 'Doctor') senderSystem = 'Doctor Portal';
      else if (role === 'Patient') senderSystem = 'Patient Portal';
      else if (role === 'Admin') senderSystem = 'Admin System';
      else senderSystem = `${role} System`;
      console.log(`[Adapter Layer] Auto-detected sender system from token role: ${senderSystem}`);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Adapter Layer: Invalid email format in forwarded request',
        code: 'INVALID_EMAIL',
        recipientEmail,
      });
    }

    // Step 2: Duplicate Check
    // Query for identical notifications sent within the last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const duplicateRecord = await NotificationLog.findOne({
      recipientEmail: recipientEmail.toLowerCase(),
      message,
      status: { $in: ['Sent', 'Duplicate'] }, // Check only successful sends
      createdAt: { $gte: fiveMinutesAgo },
    });

    if (duplicateRecord) {
      // Log as duplicate
      await NotificationLog.create({
        senderSystem,
        recipientEmail: recipientEmail.toLowerCase(),
        subject,
        message,
        status: 'Duplicate',
      });

      console.log(
        `[Adapter Layer] ⚠ Duplicate notification detected for ${recipientEmail}. Original sent at ${duplicateRecord.createdAt}`
      );

      return res.status(409).json({
        success: false,
        message: 'Adapter Layer: Duplicate notification detected. This exact message was already sent to this recipient within the last 5 minutes.',
        code: 'DUPLICATE_NOTIFICATION',
        originalNotificationTime: duplicateRecord.createdAt,
        recipientEmail,
        senderSystem,
      });
    }

    // Step 3: Send email
    let emailSent = false;
    let sendEmailError = null;

    try {
      await sendEmail(recipientEmail, subject, message);
      emailSent = true;
      console.log(`[Adapter Layer] ✅ Email sent successfully via ${senderSystem} to ${recipientEmail}`);
    } catch (error) {
      sendEmailError = error.message;
      console.error(`[Adapter Layer] ❌ Email sending failed for ${senderSystem}:`, sendEmailError);
    }

    // Step 4: Save notification log to MongoDB
    const notificationLog = await NotificationLog.create({
      senderSystem,
      senderEmail: req.user && req.user.email ? req.user.email.toLowerCase() : null,
      recipientEmail: recipientEmail.toLowerCase(),
      subject,
      message,
      status: emailSent ? 'Sent' : 'Failed',
      errorDetails: sendEmailError,
    });

    // If email failed, return error response to Adapter Layer
    if (!emailSent) {
      return res.status(500).json({
        success: false,
        message: 'Adapter Layer: Failed to send notification email on behalf of sender system',
        code: 'EMAIL_SEND_FAILED',
        senderSystem,
        details: sendEmailError,
        logId: notificationLog._id,
      });
    }

    // Step 5: Return success response to Adapter Layer
    return res.status(200).json({
      success: true,
      message: 'Adapter Layer: Notification forwarded and sent successfully',
      code: 'NOTIFICATION_SENT',
      data: {
        logId: notificationLog._id,
        senderSystem,
        recipientEmail,
        sentAt: notificationLog.createdAt,
      },
    });
  } catch (error) {
    console.error('[Adapter Layer] Unexpected error in processNotification:', error);

    // Attempt to save error log to database
    try {
      const { senderSystem, recipientEmail, subject, message } = req.body;
      if (recipientEmail) {
        await NotificationLog.create({
          senderSystem: senderSystem || 'Unknown',
          recipientEmail: recipientEmail.toLowerCase(),
          subject: subject || 'N/A',
          message: message || 'N/A',
          status: 'Failed',
          errorDetails: error.message,
        });
      }
    } catch (dbError) {
      console.error('Failed to log error to database:', dbError.message);
    }

    return res.status(500).json({
      success: false,
      message: 'Internal server error while processing notification',
      code: 'INTERNAL_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Contact support if this persists',
    });
  }
};

/**
 * Get Notification Logs
 * Retrieves notification logs with Role-Based Access Control (RBAC) and pagination.
 */
export const getNotificationLogs = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;

    const query = {};
    
    // Status filter (allows fetching only "Failed" or "Sent" logs if requested)
    if (status) query.status = status;

    // ====================================================================
    // INTEGRATION FIX: ROLE-BASED ACCESS CONTROL (RBAC)
    // Identify the user requesting the data based on their verified token
    // ====================================================================
    const user = req.user; // Extracted from authMiddleware

    // Fallback security: Block access if the token lacks a proper role payload
    if (!user || !user.role) {
      query.recipientEmail = 'unauthorized_access'; 
    } 
    // GROUP 5 (Patient Portal): Patients can only view their own emails
    else if (user.role === 'Patient') {
      if (!user.email) {
        return res.status(400).json({ success: false, message: "Token payload missing 'email' for patient validation." });
      }
      query.recipientEmail = user.email.toLowerCase();
    } 
    // GROUP 6 (Doctor Portal): Doctors can ONLY view logs they personally sent
    else if (user.role === 'Doctor') {
      if (!user.email) {
        return res.status(400).json({ success: false, message: "Token payload missing 'email' for doctor validation." });
      }
      query.senderEmail = user.email.toLowerCase();
    } 
    // ADMIN ROLE: Unrestricted access. Allowed to fetch all logs or search by specific recipient
    else if (user.role === 'Admin') {
      if (req.query.recipientEmail) {
        query.recipientEmail = req.query.recipientEmail.toLowerCase();
      }
    }

    // ====================================================================
    
    // Fetch from database with the constructed query
    const logs = await NotificationLog.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const totalCount = await NotificationLog.countDocuments(query);

    return res.status(200).json({
      success: true,
      data: logs,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
      },
    });
  } catch (error) {
    console.error('Error fetching notification logs:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve notification logs',
      code: 'FETCH_LOGS_ERROR',
      details: error.message,
    });
  }
};