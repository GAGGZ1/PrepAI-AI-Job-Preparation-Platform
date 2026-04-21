# Project Architecture Explanation

## Quick Summary (30-second elevator pitch)

Prep-AI is a **3-tier full-stack application** with a **React frontend** communicating via **RESTful API** with an **Express backend**, using **MongoDB** for persistence and **Redis** for caching/rate limiting. It follows **MVC architecture** on the backend and **component-based architecture** with **Context API** on the frontend, with JWT-based **stateless authentication**.

---

## High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLIENT LAYER (Browser)                       │
│  React SPA (Single Page Application)                            │
│  ├─ Components (UI)                                             │
│  ├─ Context API (State Management)                              │
│  ├─ Custom Hooks (Logic)                                        │
│  └─ React Router (Navigation)                                   │
└────────────────────┬────────────────────────────────────────────┘
                     │ HTTP/REST API
                     │ JSON + JWT Tokens in Cookies
                     ↓
┌─────────────────────────────────────────────────────────────────┐
│               API GATEWAY LAYER (Express Server)                │
│  ├─ CORS Middleware                                             │
│  ├─ Cookie Parser                                               │
│  ├─ JSON Body Parser                                            │
│  └─ Route Handlers                                              │
└────────────────────┬────────────────────────────────────────────┘
                     │ Routes
                     ├─ /api/auth/* → Auth Controller
                     └─ /api/interview/* → Interview Controller
                     │
        ┌────────────┼────────────┐
        ↓            ↓            ↓
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Controllers  │ │ Middlewares  │ │ Services     │
│              │ │              │ │              │
│ - Parse req  │ │ - Auth       │ │ - Business   │
│ - Validate   │ │ - RateLimit  │ │   Logic      │
│ - Call svc   │ │ - File Upload│ │ - AI API     │
│ - Send resp  │ │              │ │ - Validation │
└──────┬───────┘ └──────────────┘ └──────┬───────┘
       │                                  │
       └──────────────┬───────────────────┘
                      ↓
        ┌─────────────────────────────┐
        │     DATA ACCESS LAYER       │
        │  (Mongoose Models)          │
        │  ├─ User Model              │
        │  ├─ Interview Report Model  │
        │  └─ Blacklist Model         │
        └──────────────┬──────────────┘
                       │
        ┌──────────────┼──────────────┐
        ↓              ↓              ↓
    ┌────────┐    ┌────────┐    ┌────────┐
    │MongoDB │    │ Redis  │    │ External│
    │(NoSQL) │    │(Cache) │    │ APIs   │
    │        │    │        │    │(Google)│
    └────────┘    └────────┘    └────────┘
```

---

## Architecture Layers Explained

### 1. **Presentation Layer (Frontend)**

**Technology:** React 19, React Router 7, SASS

**Components:**
- **Pages**: Full-screen components (Login, Register, Home, Interview)
- **UI Components**: Reusable components (LoadingIndicator, buttons, forms)
- **Feature Modules**: Organized by feature (auth, interview)
  
**State Management:**
- **Context API**: Global state (User, Interview data)
- **useState**: Local component state
- **Custom Hooks**: Reusable logic (useAuth, useInterview)

**Routing:**
- Client-side routing with React Router
- No full page reloads, instant navigation
- Lazy loading of components

**Key Pattern: Component Composition**
```
App (Root)
├── AuthProvider (Context)
│   └── InterviewProvider (Context)
│       └── RouterProvider
│           ├── <Layout>
│           │   ├── <Login> → useAuth hook
│           │   ├── <Register> → useAuth hook
│           │   ├── <Home> → useInterview hook
│           │   └── <Interview> → useInterview hook
```

### 2. **API/Gateway Layer (Express Server)**

**Technology:** Express.js 5, Middleware stack

**Responsibilities:**
- Parse and validate incoming requests
- Apply middleware (CORS, cookies, auth, rate limiting)
- Route requests to correct controller
- Send responses back to client
- Handle errors globally

**Middleware Stack (in order):**
```
Request
  ↓
express.json() → Parse JSON body
  ↓
cookieParser() → Parse cookies
  ↓
cors() → Allow cross-origin requests
  ↓
Rate Limit Middleware → Check request limits
  ↓
Auth Middleware (if protected route) → Verify JWT
  ↓
Route Handler → Controller
  ↓
Response
```

**Key Pattern: Separation of Concerns**
- Routes define endpoints
- Middleware handles cross-cutting concerns
- Controllers orchestrate requests
- Services contain business logic

### 3. **Controllers Layer**

**Technology:** Express route handlers

**Responsibilities:**
- Extract data from request (body, params, query)
- Validate input
- Call appropriate service/model
- Format response
- Send HTTP response with status code

**Example: Login Controller Flow**
```
1. Extract email, password from req.body
2. Call userModel.findOne() to find user
3. Validate password with bcrypt.compare()
4. Create JWT token
5. Set cookie
6. Send response with user data
```

### 4. **Service Layer**

**Technology:** Custom business logic

**Responsibilities:**
- Implement business rules
- Integrate with external APIs (Google GenAI)
- Coordinate multiple models/operations
- Transform data as needed
- Handle complex logic

**Currently implemented:**
- `ai.service.js`: AI interview generation logic

### 5. **Model Layer**

**Technology:** Mongoose (MongoDB ODM)

**Data Models:**
```javascript
User
├─ username (String, unique, required)
├─ email (String, unique, required)
└─ password (String, hashed, required)

InterviewReport
├─ userId (Reference to User)
├─ questions (Array)
├─ answers (Array)
├─ score (Number)
└─ feedback (String)

TokenBlacklist
├─ token (String, unique)
└─ createdAt (Date, TTL index)
```

**Responsibilities:**
- Define data schema
- Validate data before saving
- Query database
- Create indexes for performance
- Handle relationships

### 6. **Data Persistence Layer**

**Technologies:**
- **MongoDB**: Document database for storing users, interviews, reports
- **Redis**: In-memory cache for rate limiting, session data

---

## Authentication Architecture

```
Frontend                              Backend
┌─────────────────┐                  ┌──────────────────┐
│ User Logs In    │                  │ Database Check   │
└────────┬────────┘                  └────────┬─────────┘
         │                                    │
         │ POST /api/auth/login              │
         │ {email, password}                 │
         ├───────────────────────────────────→│
         │                                    │
         │                         Bcrypt verify password
         │                                    │
         │                         JWT.sign(payload, secret)
         │                                    │
         │← ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
         │ 200 + Set-Cookie: token=JWT       │
         │ {user, message}                   │
         │                                    │
Browser stores cookie (httpOnly)
         │                                    │
         │ GET /api/interview/list           │
         │ Cookie: token=JWT                 │
         ├───────────────────────────────────→│
         │                                    │
         │                         Middleware authUser:
         │                         1. Read token from cookie
         │                         2. Check if blacklisted
         │                         3. JWT.verify(token, secret)
         │                         4. Set req.user = decoded
         │                                    │
         │← ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
         │ 200 + [interviews]                │
```

**Why JWT + Cookies?**
- JWT: Stateless, scalable, no server-side session storage
- Cookies: Automatic with requests, secure from XSS if httpOnly
- withCredentials: Allows cookies to be sent with cross-origin requests

**Token Blacklist for Logout:**
```
User Logout
  ↓
Backend receives logout request (with token in cookie)
  ↓
Add token to TokenBlacklist collection
  ↓
Set TTL index to auto-delete after 24 hours
  ↓
Future requests with this token are rejected
```

---

## Data Flow: Complete User Journey

### Registration Flow
```
User fills registration form
  ↓
Frontend: useAuth.handleRegister()
  ↓
API call: register({username, email, password})
  ↓
Axios POST to http://localhost:3000/api/auth/register
  ↓
Backend Route: authRouter.post("/register", registerUserController)
  ↓
Controller validates input (not empty, not exists)
  ↓
Service/Model: Hash password with bcrypt
  ↓
Create user document in MongoDB
  ↓
Generate JWT token: jwt.sign({id, username}, SECRET, {expiresIn: "1d"})
  ↓
Set HTTP-only cookie: res.cookie("token", token)
  ↓
Send response: {user: {id, username, email}, message: "registered"}
  ↓
Frontend: setUser(data.user) → Context updated
  ↓
All components using useAuth can now access user data
  ↓
UI shows logged-in state
  ↓
Auto-redirect to home page
```

### Interview Flow
```
User clicks "Start Interview"
  ↓
Frontend: useInterview.startInterview()
  ↓
API call: POST /api/interview/start
  ↓
Request includes JWT cookie
  ↓
Backend: Auth middleware verifies JWT → req.user = {id, username}
  ↓
Interview controller calls AI service
  ↓
AI service calls Google GenAI API
  ↓
Generate questions based on topic
  ↓
Store interview session in MongoDB
  ↓
Send questions to frontend
  ↓
Frontend: Display questions to user
  ↓
User answers questions
  ↓
Frontend: POST /api/interview/submit with answers
  ↓
Backend: Call AI service to analyze answers
  ↓
Generate report and score
  ↓
Save report to InterviewReport collection
  ↓
Send report to frontend
  ↓
Frontend: Display report with feedback
```

---

## Design Patterns Used

### 1. **MVC Architecture (Backend)**
- **Model**: Mongoose schemas (User, Interview)
- **View**: JSON responses
- **Controller**: Request handlers (registerUserController, etc)

### 2. **Component-Based Architecture (Frontend)**
- Break UI into reusable components
- Each component has single responsibility
- Props for data passing, Hooks for state

### 3. **Context Pattern (Frontend)**
- AuthContext wraps all components
- Provides user state and auth functions
- Accessed via useAuth hook
- Eliminates prop drilling

### 4. **Repository Pattern (Implicit)**
- Mongoose models act as repositories
- All database queries go through models
- Centralized data access logic

### 5. **Middleware Pattern (Backend)**
- Reusable functions that process requests
- Auth middleware, rate limit middleware, etc
- Chain of responsibility: each middleware calls next()

### 6. **Separation of Concerns**
- Routes: Define endpoints
- Middlewares: Handle cross-cutting concerns
- Controllers: Orchestrate logic
- Services: Implement business rules
- Models: Data access

---

## Technology Choices & Rationale

### Backend

| Technology | Why | Alternative |
|---|---|---|
| **Node.js/Express** | Fast, lightweight, easy to learn, async by default | Django, Spring Boot |
| **MongoDB** | Flexible schema (good for prototypes), easy horizontal scaling | PostgreSQL (more structure) |
| **Mongoose** | Easy data validation, hooks, relationships | Prisma, TypeORM |
| **JWT** | Stateless auth, scalable to microservices | Session cookies |
| **bcryptjs** | Industry standard password hashing with salt | Argon2 (more secure but slower) |
| **Redis** | Fast in-memory store for rate limiting, caching | Memcached, database |

### Frontend

| Technology | Why | Alternative |
|---|---|---|
| **React** | Component reusability, large ecosystem, developer experience | Vue, Angular |
| **Vite** | Fast build tool, fast dev server, fast HMR | Webpack, Next.js |
| **React Router** | Easy client-side routing, maintains URL state | Next.js (server-side) |
| **Axios** | Better defaults than fetch, interceptor support | Fetch API, React Query |
| **Context API** | Built-in, no external dependencies, good for small/medium apps | Redux (more complex), Jotai |
| **SASS** | CSS variables, nesting, mixins for maintainability | Tailwind, CSS-in-JS |

---

## Scalability Considerations

### Current Architecture (Good for MVP)
```
Single Frontend Server (React)
         ↓ (HTTPS)
Single Backend Server (Express)
         ↓
MongoDB + Redis
```

### Future: Horizontal Scaling
```
Load Balancer
    ├─ Frontend Server 1
    ├─ Frontend Server 2
    └─ Frontend Server 3

API Load Balancer
    ├─ Backend Server 1
    ├─ Backend Server 2
    └─ Backend Server 3
    
Database Replication
    ├─ MongoDB Primary
    ├─ MongoDB Replica 1
    └─ MongoDB Replica 2

Cache Cluster
    ├─ Redis Node 1
    ├─ Redis Node 2
    └─ Redis Node 3
```

### Improvements for Scale
1. **Caching**: Redis for sessions, frequently accessed data
2. **Database**: Indexing, query optimization, read replicas
3. **Async Jobs**: Bull queue for long-running operations
4. **CDN**: Serve static assets (React build)
5. **Microservices**: Separate AI service, Interview service, Auth service
6. **Message Queue**: Kafka/RabbitMQ for decoupled services
7. **API Rate Limiting**: Prevent abuse
8. **Monitoring**: DataDog, New Relic for performance tracking

---

## Security Architecture

### 1. **Authentication**
```
✓ JWT tokens with secret key
✓ Bcrypt password hashing with salt
✓ HTTP-only cookies (prevent XSS)
✓ CORS configured for specific origin
✓ Token blacklist for logout
✓ Token expiry (24 hours)
```

### 2. **Input Validation**
```
✓ Validate all inputs on backend
✓ Check for required fields
✓ Unique constraints on email/username
✓ Password strength (implicitly via bcrypt)
```

### 3. **Rate Limiting**
```
✓ express-rate-limit middleware
✓ Redis backend for distributed rate limiting
✓ Prevent brute force attacks
✓ Prevent API abuse
```

### 4. **CORS**
```
✓ Only allow frontend origin (localhost:5173)
✓ Whitelist safe headers
✓ Prevent unauthorized cross-origin requests
```

### 5. **Improvements Needed**
```
⚠ Add HTTPS (SSL/TLS) in production
⚠ Add CSRF protection (CSRF tokens)
⚠ Add request validation schema (Zod/Joi)
⚠ Add logging and monitoring
⚠ Add SQL injection protection (Mongoose prevents by default)
⚠ Add XSS protection (Content Security Policy headers)
⚠ Implement refresh token rotation
```

---

## Deployment Architecture

### Development
```
Frontend: http://localhost:5173 (Vite dev server)
Backend: http://localhost:3000 (Node dev server)
Database: MongoDB local or Atlas
Cache: Redis local
```

### Production
```
Frontend: 
├─ Build: npm run build (generates static files)
├─ Deploy to: Vercel, Netlify, AWS S3 + CloudFront
└─ CDN: Serve dist/ folder

Backend:
├─ Containerize: Docker container
├─ Deploy to: AWS EC2, Heroku, Railway, Render
├─ Environment: Ubuntu server, Node runtime
└─ Process Manager: PM2 (keep server running)

Database:
├─ MongoDB: Atlas (cloud) or self-hosted
├─ Backup: Daily automated backups
└─ Replication: High availability setup

Cache:
├─ Redis: Redis Cloud or self-hosted
└─ High availability: Cluster mode
```

### Docker Example (Backend)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

---

## Error Handling Architecture

### Backend Error Handling
```
Request
  ↓
Middleware catches errors
  ↓
Controller uses try-catch
  ↓
If error: send error response
  ├─ 400: Bad Request (client error)
  ├─ 401: Unauthorized (no auth)
  ├─ 403: Forbidden (no permission)
  └─ 500: Internal Server Error (server error)
  ↓
Frontend receives error
  ↓
Show error message to user
```

### Frontend Error Handling
```
User action
  ↓
Try-catch in useAuth/useInterview hook
  ↓
If error: setError(message)
  ↓
Component shows error in UI
  ↓
User sees message or retry button
```

---

## Performance Optimization

### Backend
1. **Database Indexes**: Index on email (unique), username (unique)
2. **Caching**: Redis for rate limit tracking
3. **Connection Pooling**: MongoDB connection reuse
4. **Compression**: gzip compression for responses
5. **Pagination**: Limit data returned per request

### Frontend
1. **Code Splitting**: Lazy load routes
2. **Memoization**: React.memo for heavy components
3. **Debouncing**: Debounce API calls on input
4. **Bundle Size**: Tree-shaking unused code
5. **Caching**: Browser cache for static assets

---

## Testing Architecture (To be implemented)

```
Frontend Tests:
├─ Unit Tests: Jest + React Testing Library
│  ├─ Component rendering
│  ├─ Hook behavior
│  └─ API service functions
├─ Integration Tests: User flows
│  ├─ Login → Home → Interview
│  └─ Form submission
└─ E2E Tests: Cypress/Playwright
   └─ Full user journey

Backend Tests:
├─ Unit Tests: Jest
│  ├─ Controller logic
│  ├─ Service logic
│  └─ Middleware
├─ Integration Tests
│  ├─ API endpoints
│  ├─ Database operations
│  └─ Auth flow
└─ Load Tests: k6 or Artillery
   └─ Concurrent user testing
```

---

## System Component Interaction

```
┌──────────────────────────────────────────────────────────────┐
│                        Frontend Layer                        │
│  React Components ← Context API → Hooks → API Services      │
└────────────────────────┬─────────────────────────────────────┘
                         │
          HTTP REST API (JSON + Cookies)
                         │
┌────────────────────────┴─────────────────────────────────────┐
│                      Backend Layer                            │
│  Routes → Controllers → Services → Models → Database         │
│                  ↑                                            │
│           Middlewares (Auth, RateLimit, etc)                │
└────────────────────────┬─────────────────────────────────────┘
                         │
              ┌──────────┼──────────┐
              ↓          ↓          ↓
           MongoDB    Redis    Google API
```

---

## How to Explain This in an Interview

**"Tell me about your project architecture"**

*Start with the big picture:*
> "It's a 3-tier full-stack application. The frontend is a React SPA built with Vite, communicating via REST API with an Express backend. The backend uses MongoDB for persistence and Redis for rate limiting and caching. We're using JWT for stateless authentication."

*Then explain each layer:*
> "On the frontend, we have React components organized by feature, using Context API for state management and custom hooks for logic reuse. The backend follows MVC pattern with routes, controllers, services, and models. The controllers handle requests, validate input, call services, and return responses."

*Then explain data flow:*
> "When a user logs in, we hash their password with bcrypt, verify it, create a JWT token, and set it in an HTTP-only cookie. For protected routes, our auth middleware verifies the token before allowing the request through."

*Then explain why these choices:*
> "We chose JWT + cookies because JWT is stateless and scalable, while cookies are secure from XSS. We used MongoDB because we're iterating quickly and need flexible schema. Context API is simpler than Redux for this app size."

*Then discuss trade-offs:*
> "The trade-off of this architecture is that it's simple to understand but might not scale well with hundreds of concurrent users. For production, we'd add caching, database replication, and potentially break it into microservices."

---

## Checklist for Interview

- [ ] Can draw the 3-layer architecture
- [ ] Can explain why each technology was chosen
- [ ] Can trace a user action from frontend to backend
- [ ] Can explain JWT flow with cookies
- [ ] Can identify security considerations
- [ ] Can discuss scalability improvements
- [ ] Can explain design patterns used
- [ ] Can discuss trade-offs in current architecture
- [ ] Can suggest how to handle 1M concurrent users
- [ ] Can discuss what you'd do differently next time

---

**Remember:** When explaining architecture, always connect it back to the problem you're solving and the trade-offs you made.
