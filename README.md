# Felicity Event Management System

A comprehensive fest event management platform built with the MERN stack (MongoDB, Express.js, React, Node.js).

## Libraries & Frameworks

### Backend
| Library | Justification |
|---|---|
| **Express.js** | Lightweight, widely-adopted Node.js web framework for building REST APIs |
| **Mongoose** | ODM for MongoDB providing schema validation, middleware, and query building |
| **bcrypt** | Industry-standard password hashing with salting for secure credential storage |
| **jsonwebtoken** | JWT generation and verification for stateless, token-based authentication |
| **Nodemailer** | Feature-rich email sending library supporting SMTP for registration tickets, password resets |
| **Multer** | Middleware for handling multipart/form-data file uploads (chat files) |
| **qrcode** | QR code generation for registration tickets |
| **dotenv** | Environment variable management from `.env` files |
| **cors** | Cross-Origin Resource Sharing middleware for frontend-backend communication |

### Frontend
| Library | Justification |
|---|---|
| **React 19** | Component-based UI library for building interactive single-page applications |
| **Chakra UI v3** | Accessible, composable component library for rapid UI development with consistent design |
| **React Router DOM v7** | Declarative routing with nested routes and role-based protected routes |
| **React Icons** | Comprehensive icon library for UI elements |
| **Vite** | Fast build tool with hot module replacement for efficient development |

## Advanced Features Implemented

### Tier A (10 marks each)
1. **Hackathon/Team Event Registration** – Team leader creates team with invite link, members join via link, independent form submissions for each member, team size validation (min/max), team completion tracking
2. **Merchandise Event Payment Approval Workflow** – Organizer sets up UPI ID, participants upload payment proof screenshots, organizer reviews and approves/rejects, stock management with purchase limits per participant

### Tier B (7 marks each)
1. **Password Reset for Organizers** – Organizer submits reset request, admin reviews requests, generates temporary password, emails new credentials to organizer
2. **Team Chat** – Real-time messaging within registered teams, typing indicators with online/offline status, file sharing (images, documents), notification system for new messages

### Tier C (5 marks each)
1. **Anonymous Feedback System** – SHA-256 hashed participant identity, rating (1-5) with comments, feedback analytics with rating distribution, CSV export for organizers, only available after event completion
2. **Calendar Integration** – Add-to-Calendar support for Google Calendar, Outlook, and downloadable .ics files for any calendar application

## Setup & Installation

### Prerequisites
- Node.js (v18+)
- MongoDB (Atlas or local)
- npm

### Backend Setup
```bash
# From the project root
npm install

# Create .env file with required variables:
# MONGO_URI, JWT_SECRET, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE, SMTP_FROM

# Start development server
npm run dev
```

### Frontend Setup
```bash
cd frontend
npm install

# Create .env file:
# VITE_API_URL=http://localhost:5000/api

# Start development server
npm run dev
```

### Production Build
```bash
cd frontend
npm run build
```

## User Roles
- **Participant** – Browse events, register, purchase merchandise, submit feedback
- **Organizer** – Create/manage events, review registrations/payments, view analytics
- **Admin** – Manage organizer accounts, review password reset requests
