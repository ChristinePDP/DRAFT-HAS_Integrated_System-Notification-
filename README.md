# Notification System — Quick Guide

Base URL
--------
https://notification-lrqp.onrender.com

Authentication
--------------
1) Obtain a JWT from the Auth System:

POST https://has-auth.onrender.com/api/auth/login
Body: { "username": "...", "password": "..." }
Response: { "token": "<JWT_TOKEN>" }

2) Adapter Layer (Group 2) forwards requests and includes the token in the header:

Authorization: Bearer <token>

Endpoints
---------

GET /api/health
- Method: GET
- URL: https://notification-lrqp.onrender.com/api/health
- Headers: none
- Example response (200):
  { "success": true, "message": "Notification service is running", "timestamp": "2026-05-17T12:00:00.000Z" }

POST /api/notify
- Method: POST
- URL: https://notification-lrqp.onrender.com/api/notify
- Required headers:
  - Authorization: Bearer <token>
  - Content-Type: application/json
- Request body (JSON):
  {
    "senderSystem": "Appointment System",
    "recipientEmail": "patient@example.com",
    "subject": "Reminder",
    "message": "Your appointment is at 2:00 PM."
  }
- Example response (200):
  { "success": true, "message": "Notification forwarded and sent successfully", "code": "NOTIFICATION_SENT", "data": { "logId": "647f1f77...", "recipientEmail": "patient@example.com" } }

GET /api/notification-logs
- Method: GET
- URL: https://notification-lrqp.onrender.com/api/notification-logs
- Required headers:
  - Authorization: Bearer <token>
- Query params (optional): `page` (default 1), `limit` (default 20), `status` (Sent|Failed|Duplicate), `recipientEmail` (admin only)
- Example response (200):
  { "success": true, "data": [ { "_id": "647f1f77...", "senderSystem": "Doctor Portal", "recipientEmail": "patient@example.com", "subject": "Lab results", "status": "Sent", "createdAt": "2026-05-17T11:50:00.000Z" } ], "pagination": { "currentPage": 1, "totalPages": 1, "totalCount": 1 } }

Integration flow
----------------
Other System → Adapter Layer (forwards JWT) → Notification System → MongoDB + SMTP Email Gateway → Recipient

Notes
-----
- Always call this service through the Adapter Layer and include `Authorization: Bearer <token>`.
- For token details contact the Auth System owners.
