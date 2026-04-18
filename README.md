# Prep-AI: Interview Preparation Platform

An AI-powered interview preparation platform that helps candidates practice and improve their interview skills using intelligent feedback and realistic interview scenarios.

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Configuration](#environment-configuration)
- [Running the Application](#running-the-application)
- [API Documentation](#api-documentation)
- [Project Architecture](#project-architecture)
- [Contributing](#contributing)
- [License](#license)

## ✨ Features

- **User Authentication**: Secure registration and login with JWT tokens
- **AI-Powered Interviews**: Generate realistic interview questions using Google GenAI
- **Interview Reports**: Detailed analysis and feedback on interview performance
- **File Upload**: Support for resume and document uploads
- **Rate Limiting**: Protect API endpoints with intelligent rate limiting using Redis
- **User Blacklist**: Security feature to manage user access
- **PDF Parsing**: Extract and analyze PDF documents
- **Web Automation**: Browser automation capabilities with Puppeteer

## 🛠 Tech Stack

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js 5.x
- **Database**: MongoDB with Mongoose ODM
- **Cache**: Redis
- **Authentication**: JWT (JSON Web Tokens)
- **AI Integration**: Google GenAI API
- **Validation**: Zod
- **File Handling**: Multer

- **Password Hashing**: bcryptjs
- **Rate Limiting**: express-rate-limit + rate-limit-redis
- **PDF Processing**: pdf-parse
- **Browser Automation**: Puppeteer

### Frontend
- **Framework**: React 19
- **Build Tool**: Vite
- **Routing**: React Router 7
- **HTTP Client**: Axios
- **Styling**: SASS
- **Linting**: ESLint
- **Loading UI**: react-loading-indicators

## 📁 Project Structure

```
prep-ai/
├── Backend/                    # Node.js/Express server
│   ├── src/
│   │   ├── app.js             # Express app configuration
│   │   ├── config/            # Database and Redis configuration
│   │   │   ├── database.js
│   │   │   └── redis.js
│   │   ├── controllers/       # Route controllers
│   │   │   ├── auth.controller.js
│   │   │   └── interview.controller.js
│   │   ├── models/            # MongoDB models
│   │   │   ├── user.model.js
│   │   │   ├── interviewReport.model.js
│   │   │   └── blacklist.model.js
│   │   ├── routes/            # API routes
│   │   │   ├── auth.routes.js
│   │   │   └── interview.routes.js
│   │   ├── middlewares/       # Express middlewares
│   │   │   ├── auth.middleware.js
│   │   │   ├── file.middleware.js
│   │   │   └── rateLimit.middleware.js
│   │   ├── services/          # Business logic
│   │   │   └── ai.service.js
│   │   ├── utils/             # Utility functions
│   │   └── workers/           # Bull job workers
│   ├── logs/                  # Application logs
│   ├── server.js              # Entry point
│   └── package.json
│
├── Frontend/                  # React/Vite application
│   ├── src/
│   │   ├── main.jsx           # React entry point
│   │   ├── App.jsx            # Root component
│   │   ├── app.routes.jsx     # Route configuration
│   │   ├── components/        # Reusable components
│   │   │   └── LoadingIndicator.jsx
│   │   ├── features/          # Feature modules
│   │   │   ├── auth/          # Authentication feature
│   │   │   │   ├── pages/     # Auth pages (Login, Register)
│   │   │   │   ├── services/  # Auth API calls
│   │   │   │   ├── hooks/     # Auth hooks (useAuth)
│   │   │   │   └── context/   # Auth context
│   │   │   └── interview/     # Interview feature
│   │   │       ├── pages/     # Interview pages (Home, Interview)
│   │   │       ├── services/  # Interview API calls
│   │   │       ├── hooks/     # Interview hooks
│   │   │       └── context/   # Interview context
│   │   ├── style/             # Global styles
│   │   ├── hooks/             # Global custom hooks
│   │   ├── providers/         # Context providers
│   │   └── utils/             # Utility functions
│   ├── public/
│   ├── index.html
│   ├── vite.config.js
│   ├── eslint.config.js
│   └── package.json
│
└── README.md                  # This file
```

## 📦 Prerequisites

- **Node.js**: v14 or higher
- **npm** or **yarn**: Package manager
- **MongoDB**: Local or cloud instance (MongoDB Atlas)
- **Redis**: Local or cloud instance
- **Google GenAI API Key**: For AI features

## 🚀 Installation

### 1. Clone the repository
```bash
git clone <repository-url>
cd prep-ai
```

### 2. Backend Setup

```bash
cd Backend
npm install
```

### 3. Frontend Setup

```bash
cd ../Frontend
npm install
```

## ⚙️ Environment Configuration

### Backend Configuration

Create a `.env` file in the `Backend/` directory:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/prep-ai
# Or use MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/prep-ai

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
# Or use Redis Cloud:
# REDIS_URL=redis://:password@host:port

# JWT
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRY=7d

# Google GenAI
GOOGLE_GENAI_API_KEY=your_google_genai_api_key_here

# File Upload
MAX_FILE_SIZE=5242880  # 5MB in bytes
UPLOAD_DIR=./uploads

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100
```

### Frontend Configuration

Create a `.env` file in the `Frontend/` directory:

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

## 🏃 Running the Application

### Development Mode

**Terminal 1 - Backend Server:**
```bash
cd Backend
npm run dev
```
The server will start on `http://localhost:5000`

**Terminal 2 - Frontend Dev Server:**
```bash
cd Frontend
npm run dev
```
The frontend will start on `http://localhost:5173`

### Production Build

**Backend:**
```bash
cd Backend
npm start
```

**Frontend:**
```bash
cd Frontend
npm run build
npm run preview
```

## 📡 API Documentation

### Authentication Endpoints
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/refresh` - Refresh JWT token

### Interview Endpoints
- `GET /api/interview/` - Get user's interviews
- `POST /api/interview/start` - Start a new interview
- `POST /api/interview/submit` - Submit interview answers
- `GET /api/interview/:id` - Get interview details
- `GET /api/interview/:id/report` - Get interview report

## 🏗 Project Architecture

### Backend Architecture

**Layered Architecture:**
1. **Routes Layer**: Handles HTTP requests and routes
2. **Middleware Layer**: Authentication, file handling, rate limiting
3. **Controller Layer**: Request validation and orchestration
4. **Service Layer**: Business logic (AI integration, interview logic)
5. **Model Layer**: Database schemas and queries
6. **Config Layer**: Database and external service configuration

### Frontend Architecture

**Component-Based Architecture:**
1. **Pages**: Full-page components (Login, Register, Home, Interview)
2. **Features**: Feature modules with pages, services, hooks, and context
3. **Components**: Reusable UI components
4. **Hooks**: Custom React hooks for logic reuse
5. **Context**: React Context for state management
6. **Services**: API communication layer

## 🤝 Contributing

1. Create a feature branch: `git checkout -b feature/feature-name`
2. Commit your changes: `git commit -m 'Add feature description'`
3. Push to the branch: `git push origin feature/feature-name`
4. Open a Pull Request

## 📝 License

This project is licensed under the ISC License.

---

**Happy Interviewing! 🎤**

For issues, questions, or suggestions, please open an issue in the repository.
