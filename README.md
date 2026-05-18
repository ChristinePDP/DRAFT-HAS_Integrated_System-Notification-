
# Notification System — Quick Guide

## Base URL
`https://notification-lrqp.onrender.com`

---

## 🔐 Authentication & Setup

### Step 1: Obtain a JWT from the Auth System
Before interacting with the Notification System, you must authenticate to retrieve a JSON Web Token (JWT).
* **Endpoint:** `POST https://has-auth.onrender.com/api/auth/login`
* **Content-Type:** `application/json`

**Request Body:**
```json
{ 
  "username": "your_username", 
  "password": "your_password" 
}

```

**Response (200 OK):**

```json
{ 
  "token": "<JWT_TOKEN>" 
}

```

### Step 2: Forwarding Requests via Adapter Layer

All system operations must route through the **Adapter Layer (Group 2)**, which automatically appends the token to the header of the request:

```http
Authorization: Bearer <JWT_TOKEN>

```

*Note: For further token lifecycle details or registration, contact the Auth System owners.*

---

## 🚀 Step-by-Step API Endpoints

### 1. Health Check

Verify if the notification service is operational before sending requests.

* **Method:** `GET`
* **URL:** `https://notification-lrqp.onrender.com/api/health`
* **Headers:** None
* **Request Body:** None

**Example Response (200 OK):**

```json
{ 
  "success": true, 
  "message": "Notification service is running", 
  "timestamp": "2026-05-17T12:00:00.000Z" 
}

```

---

### 2. Send a Notification

Dispatches an email notification to the specified recipient.

* **Method:** `POST`
* **URL:** `https://notification-lrqp.onrender.com/api/notify`
* **Required Headers:**
* `Authorization: Bearer <token>`
* `Content-Type: application/json`



**Request Body:**

```json
{
  "senderSystem": "Appointment System",
  "recipientEmail": "patient@example.com",
  "subject": "Reminder",
  "message": "Your appointment is at 2:00 PM."
}

```

**Example Response (200 OK):**

```json
{ 
  "success": true, 
  "message": "Notification forwarded and sent successfully", 
  "code": "NOTIFICATION_SENT", 
  "data": { 
    "logId": "647f1f77...", 
    "recipientEmail": "patient@example.com" 
  } 
}

```

---

### 3. View Notification Logs (Role-Based Access)

Retrieve historical transactional records of sent, failed, or duplicate notifications.

* **Method:** `GET`
* **URL:** `https://notification-lrqp.onrender.com/api/notification-logs`
* **Required Headers:**
* `Authorization: Bearer <token>`


* **Request Body:** None (`GET` requests do not use a body payload)

#### 🔍 How to Filter Data (Query Parameters)

Since this is a `GET` request, parameters and filters must be passed directly inside the URL string instead of a JSON body.

* **Default View (Page 1, 20 items):**
`GET https://notification-lrqp.onrender.com/api/notification-logs`
* **Filter by Status (e.g., Failed logs only):**
`GET https://notification-lrqp.onrender.com/api/notification-logs?status=Failed`
* **With Pagination (Page 2, 10 items per page):**
`GET https://notification-lrqp.onrender.com/api/notification-logs?page=2&limit=10`
* **Admin Only (Filter logs of a specific recipient):**
`GET https://notification-lrqp.onrender.com/api/notification-logs?recipientEmail=patient@example.com`

#### 👥 Role Privileges:

* **Standard User:** Can view and filter standard system execution logs using `page`, `limit`, and `status`.
* **Admin User:** Grants exclusive access to use the `recipientEmail` parameter to track down logs for a specific user.

**Example Response (200 OK):**

```json
{ 
  "success": true, 
  "data": [ 
    { 
      "_id": "647f1f77...", 
      "senderSystem": "Doctor Portal", 
      "recipientEmail": "patient@example.com", 
      "subject": "Lab results", 
      "status": "Sent", 
      "createdAt": "2026-05-17T11:50:00.000Z" 
    } 
  ], 
  "pagination": { 
    "currentPage": 1, 
    "totalPages": 1, 
    "totalCount": 1 
  } 
}

```

---

## ⚠️ Status Codes & Error Handling

| Status / Error Type | Condition | Troubleshooting / Action Items |
| --- | --- | --- |
| **`Sent`** | Email successfully dispatched via SMTP. | Complete. No action required. |
| **`Failed`** | SMTP network error or invalid email syntax. | Verify recipient email format or inspect SMTP gateway status. |
| **`Duplicate`** | The exact same notification payload was triggered recently. | Implement client-side debounce/throttling to prevent rapid duplicate clicks. |
| **`401 Unauthorized`** | Expired, corrupt, or missing JWT token. | Re-authenticate via the Auth login endpoint to fetch a fresh token. |
| **`403 Forbidden`** | Standard account attempting to query restricted logs. | Ensure the requesting account has administrative permissions before using `recipientEmail`. |
| **`400 Bad Request`** | Missing required properties in the request payload. | Ensure `senderSystem`, `recipientEmail`, `subject`, and `message` are completely provided. |

```

```