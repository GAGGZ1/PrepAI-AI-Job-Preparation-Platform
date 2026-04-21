# Interview Guide: Prep-AI Project Code Walkthrough

This guide explains every line of code in the Prep-AI project, helping you understand and explain each component during interviews.

## Table of Contents
1. [Backend Structure](#backend-structure)
2. [Frontend Structure](#frontend-structure)
3. [Key Concepts Explained](#key-concepts-explained)
4. [Interview Topics](#interview-topics)
5. [Technical Deep Dive](#technical-deep-dive)

---

## Backend Structure

### 1. **Server Entry Point** (`Backend/server.js`)

```javascript
require("dotenv").config()
// Loads environment variables from .env file into process.env
// This allows us to keep sensitive data (API keys, passwords) outside the code

const app = require("./src/app")
// Imports the Express application configuration from app.js

const connectToDB = require("./src/config/database")
// Imports the database connection function

connectToDB()
// Connects to MongoDB when the server starts

app.listen(3000, () => {
    console.log("Server is running on port 3000")
})
// Starts the Express server on port 3000
// This makes the server accessible at http://localhost:3000
```

**What You Should Explain:**
- Why `.env` is important: Security, different configurations for dev/production
- How `require()` loads modules in Node.js
- Server startup process and port binding

---

### 2. **Express App Configuration** (`Backend/src/app.js`)

```javascript
const express = require("express")
const cookieParser = require("cookie-parser")
const cors = require("cors")

// Create an Express application instance
const app = express()

// Middleware to parse JSON request bodies
app.use(express.json())
// Converts incoming JSON strings to JavaScript objects
// Example: {"username": "john"} → req.body = {username: "john"}

// Middleware to parse cookies from requests
app.use(cookieParser())
// Makes cookies accessible via req.cookies
// Used for storing JWT tokens on the client side

// Middleware to enable Cross-Origin Resource Sharing (CORS)
app.use(cors({
    origin: "http://localhost:5173",
    // Only allow requests from the React frontend running on localhost:5173
    credentials: true
    // Allow sending cookies with cross-origin requests (important for JWT authentication)
}))

// Import all route handlers
const authRouter = require("./routes/auth.routes")
const interviewRouter = require("./routes/interview.routes")

// Mount routes at specific paths
app.use("/api/auth", authRouter)
// All auth routes will be prefixed with /api/auth
// Example: POST /api/auth/register

app.use("/api/interview", interviewRouter)
// All interview routes will be prefixed with /api/interview
// Example: GET /api/interview/list

module.exports = app
// Export app so it can be used in server.js
```

**What You Should Explain:**
- Middleware concept: Functions that process requests before they reach route handlers
- Order of middleware matters: More restrictive middleware should come first
- CORS and why it's needed when frontend and backend have different ports
- Route mounting and organization
- Why JWT tokens need credentials: true in CORS

---

### 3. **Database Configuration** (`Backend/src/config/database.js`)

```javascript
const mongoose = require("mongoose")
// Mongoose is an ODM (Object Document Mapper) for MongoDB

async function connectToDB() {
    // async function returns a Promise that can be awaited

    try {
        // Try to connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI)
        // MONGO_URI is defined in .env file
        // Example: "mongodb://localhost:27017/prep-ai"

        console.log("Connected to Database")
        // Log success message
    }
    catch (err) {
        // If connection fails, catch the error
        console.log(err)
        // Log the error for debugging
    }
}

module.exports = connectToDB
// Export the function so it can be called from server.js
```

**What You Should Explain:**
- Async/await for asynchronous operations
- Try-catch for error handling
- Why connection happens at startup: Fail fast if DB is unavailable
- MongoDB connection string format

---

### 4. **User Model** (`Backend/src/models/user.model.js`)

```javascript
const mongoose = require("mongoose")

// Define the structure of the User document in MongoDB
const userSchema = new mongoose.Schema({
    username: {
        type: String,
        // Field must be a string
        unique: [ true, "username already taken" ],
        // username must be unique in the database
        // Second element is the error message shown to user
        required: true,
        // This field must be provided when creating a user
    },

    email: {
        type: String,
        unique: [ true, "Account already exists with this email address" ],
        // Email must be unique (no duplicate emails)
        required: true,
    },

    password: {
        type: String,
        // Stores the hashed password (never store plain text passwords!)
        required: true
    }
})

// Create a MongoDB model from the schema
// "users" is the collection name in MongoDB
const userModel = mongoose.model("users", userSchema)

module.exports = userModel
// Export so controllers can use this model to query/modify users
```

**What You Should Explain:**
- Schema vs Model: Schema defines structure, Model creates instances
- MongoDB collections vs traditional database tables
- Why unique constraints on email and username
- Never store plain text passwords (must be hashed with bcrypt)
- Mongoose validation happens before saving to database

---

### 5. **Auth Controller** (`Backend/src/controllers/auth.controller.js`)

```javascript
const userModel = require("../models/user.model")
const bcrypt = require("bcryptjs")
// bcryptjs is used to hash passwords securely
const jwt = require("jsonwebtoken")
// JWT is used to create secure tokens for authentication
const tokenBlacklistModel = require("../models/blacklist.model")

/**
 * REGISTER USER CONTROLLER
 * Handles user registration
 */
async function registerUserController(req, res) {
    // req = request object (contains data from client)
    // res = response object (what we send back to client)

    // Destructure username, email, password from request body
    const { username, email, password } = req.body

    // Validate that all required fields are provided
    if (!username || !email || !password) {
        return res.status(400).json({
            // 400 = Bad Request (client error)
            message: "Please provide username, email and password"
        })
    }

    // Check if user with this email or username already exists
    const isUserAlreadyExists = await userModel.findOne({
        $or: [ { username }, { email } ]
        // $or operator: Find if EITHER username OR email matches
    })

    // If user exists, reject registration
    if (isUserAlreadyExists) {
        return res.status(400).json({
            message: "Account already exists with this email address or username"
        })
    }

    // Hash the password using bcryptjs with 10 rounds
    // 10 rounds = more secure but slower (each round doubles computation time)
    const hash = await bcrypt.hash(password, 10)
    // Plain password: "mypassword"
    // Hashed password: "$2a$10$..."
    // One-way function: Can't reverse hash to get original password

    // Create new user in database
    const user = await userModel.create({
        username,
        email,
        password: hash
        // Store hashed password, not plain text!
    })

    // Create JWT token for authentication
    const token = jwt.sign(
        { id: user._id, username: user.username },
        // Payload: data encoded in the token
        // user._id is MongoDB's unique identifier
        process.env.JWT_SECRET,
        // Secret key to sign the token
        // Only the server knows this, prevents token tampering
        { expiresIn: "1d" }
        // Token expires after 1 day
    )

    // Set cookie in response
    res.cookie("token", token)
    // Cookie is automatically sent with every request from the client
    // Browser stores this and includes it in the Cookie header

    // Send success response with user data (exclude password!)
    res.status(201).json({
        // 201 = Created (success, resource created)
        message: "User registered successfully",
        user: {
            id: user._id,
            username: user.username,
            email: user.email
            // Note: password is NOT included in response
        }
    })
}

/**
 * LOGIN USER CONTROLLER
 * Handles user login
 */
async function loginUserController(req, res) {
    const { email, password } = req.body

    // Find user by email
    const user = await userModel.findOne({ email })

    // If no user found
    if (!user) {
        return res.status(400).json({
            message: "Invalid email or password"
            // Don't specify "user not found" for security
            // Attackers use this to enumerate valid emails
        })
    }

    // Compare provided password with stored hashed password
    const isPasswordValid = await bcrypt.compare(password, user.password)
    // bcrypt.compare returns true if passwords match
    // This is the only way to verify hashed passwords (can't reverse the hash)

    // If password doesn't match
    if (!isPasswordValid) {
        return res.status(400).json({
            message: "Invalid email or password"
        })
    }

    // Create JWT token for this session
    const token = jwt.sign(
        { id: user._id, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
    )

    // Set cookie with token
    res.cookie("token", token)

    // Send success response
    res.status(200).json({
        // 200 = OK (success)
        message: "User loggedIn successfully.",
        user: {
            id: user._id,
            username: user.username,
            email: user.email
        }
    })
}
```

**What You Should Explain:**
- Authentication flow: Register → Hash password → Create token → Set cookie
- bcrypt rounds: Balance between security and performance
- JWT structure: Header.Payload.Signature
- Why not to include sensitive info in response
- Why error messages should be generic (security)
- Destructuring vs accessing properties

---

### 6. **Auth Middleware** (`Backend/src/middlewares/auth.middleware.js`)

```javascript
const jwt = require("jsonwebtoken")
const tokenBlacklistModel = require("../models/blacklist.model")

/**
 * AUTHENTICATION MIDDLEWARE
 * Protects routes by verifying JWT token
 */
async function authUser(req, res, next) {
    // req = request object
    // res = response object  
    // next = function to call when middleware completes

    // Get token from cookies
    const token = req.cookies.token
    // Cookies are sent automatically with each request from the client

    // Check if token exists
    if (!token) {
        return res.status(401).json({
            // 401 = Unauthorized (not authenticated)
            message: "Token not provided."
        })
    }

    // Check if token is blacklisted (logout)
    const isTokenBlacklisted = await tokenBlacklistModel.findOne({
        token
    })

    // If token is blacklisted, it's invalid
    if (isTokenBlacklisted) {
        return res.status(401).json({
            message: "token is invalid"
        })
    }

    try {
        // Verify token using JWT_SECRET
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        // jwt.verify checks:
        // 1. Token signature is valid (not tampered)
        // 2. Token hasn't expired

        // Store decoded user info in request object
        req.user = decoded
        // Now req.user = { id: "...", username: "..." }
        // Controllers can access this with req.user

        next()
        // Call next middleware/route handler
        // If we don't call next(), request processing stops

    } catch (err) {
        // Token is invalid (tampered, expired, malformed)
        return res.status(401).json({
            message: "Invalid token."
        })
    }
}

module.exports = { authUser }
```

**What You Should Explain:**
- Middleware pattern: Function that processes request and calls next()
- Purpose of middleware: Protect routes from unauthorized access
- Token verification: Server can't be fooled (JWT_SECRET prevents tampering)
- Token blacklist: Way to implement logout (prevent reuse of token)
- Order matters: Auth middleware should come AFTER route definition

---

### 7. **Auth Routes** (`Backend/src/routes/auth.routes.js`)

```javascript
const { Router } = require('express')
// Router is a mini Express app for handling routes
const authController = require("../controllers/auth.controller")
// Import controller with handler functions
const authMiddleware = require("../middlewares/auth.middleware")
// Import middleware to protect private routes

const authRouter = Router()
// Create a new router instance

/**
 * @route POST /api/auth/register
 * @description Register a new user
 * @access Public (anyone can access)
 */
authRouter.post("/register", authController.registerUserController)
// POST request to /api/auth/register
// Calls registerUserController to handle it
// Public route: no authentication required

/**
 * @route POST /api/auth/login
 * @description login user with email and password
 * @access Public
 */
authRouter.post("/login", authController.loginUserController)
// POST request to /api/auth/login
// Calls loginUserController to handle it

/**
 * @route GET /api/auth/logout
 * @description clear token from user cookie and add the token in blacklist
 * @access Public
 */
authRouter.get("/logout", authController.logoutUserController)
// GET request to /api/auth/logout

/**
 * @route GET /api/auth/get-me
 * @description get the current logged in user details
 * @access Private (authentication required)
 */
authRouter.get("/get-me", 
    authMiddleware.authUser,  // Middleware: verify token first
    authController.getMeController  // Controller: handle request
)
// Private route: authMiddleware runs before controller
// If authMiddleware fails (no valid token), controller is never called
// req.user is available in controller because middleware sets it

module.exports = authRouter
// Export router so it can be mounted in app.js
```

**What You Should Explain:**
- Difference between public and private routes
- Route definition syntax: method, path, middleware array, controller
- Middleware chain: multiple middlewares run in order
- RESTful conventions: POST for creating, GET for retrieving
- Router vs App: Router is modular, App is the main server

---

## Frontend Structure

### 8. **Root App Component** (`Frontend/src/App.jsx`)

```javascript
import { RouterProvider } from "react-router"
// RouterProvider: Enables React Router functionality
// Manages client-side routing (page changes without page reload)

import { router } from "./app.routes.jsx"
// Import route configuration (defines all available pages)

import { AuthProvider } from "./features/auth/auth.context.jsx"
// AuthProvider: Context that shares auth state across all components
// Without this, prop drilling would be needed to pass auth data

import { InterviewProvider } from "./features/interview/interview.context.jsx"
// InterviewProvider: Context that shares interview state

function App() {
  return (
    <AuthProvider>
      {/* Wrap everything with AuthProvider */}
      {/* Now all components can access auth context with useAuth hook */}
      
      <InterviewProvider>
        {/* Wrap everything with InterviewProvider */}
        {/* Now all components can access interview context */}
        
        <RouterProvider router={router} />
        {/* Enable React Router */}
        {/* This displays different pages based on current URL */}
      </InterviewProvider>
    </AuthProvider>
  )
}

export default App
// Export component so it can be rendered in main.jsx
```

**What You Should Explain:**
- Context API: Alternative to Redux for state management
- Provider pattern: Makes state available to all children
- Why nested providers: Different features can have separate contexts
- React Router: Enables SPA (Single Page Application) navigation
- Component composition: Wrapping components in other components

---

### 9. **Auth API Service** (`Frontend/src/features/auth/services/auth.api.js`)

```javascript
import axios from "axios"
// Axios: HTTP client library for making API requests

// Create an Axios instance with default configuration
const api = axios.create({
    baseURL: "http://localhost:3000",
    // All requests will be sent to http://localhost:3000
    // Example: api.get("/api/auth/login") → http://localhost:3000/api/auth/login
    
    withCredentials: true
    // Include cookies with every request
    // Important: Allows JWT cookies to be sent to backend
})

/**
 * REGISTER FUNCTION
 * Sends registration request to backend
 */
export async function register({ username, email, password }) {
    try {
        // POST request to backend
        const response = await api.post('/api/auth/register', {
            username, email, password
        })
        // Request body: { username, email, password }

        return response.data
        // Return response data from backend
        // Frontend gets: { message: "...", user: { id, username, email } }

    } catch (err) {
        // If request fails (network error, 4xx/5xx status)
        console.log(err)
        // Log error for debugging
    }
}

/**
 * LOGIN FUNCTION
 * Sends login request to backend
 */
export async function login({ email, password }) {
    try {
        // POST request to backend
        const response = await api.post("/api/auth/login", {
            email, password
        })

        return response.data
        // Return user data: { message: "...", user: { id, username, email } }

    } catch (err) {
        console.log(err)
        throw err
        // Re-throw error so component can handle it
    }
}

/**
 * LOGOUT FUNCTION
 * Sends logout request to backend
 */
export async function logout() {
    try {
        // GET request to backend logout endpoint
        const response = await api.get("/api/auth/logout")

        return response.data

    } catch (err) {
        // Silently fail (logout should always work on frontend)
    }
}

/**
 * GET ME FUNCTION
 * Fetches current user details
 */
export async function getMe() {
    try {
        // GET request to backend
        // Request includes JWT cookie (withCredentials: true)
        const response = await api.get("/api/auth/get-me")
        // Backend checks cookie, identifies user, returns their data

        return response.data
        // Return: { user: { id, username, email } }

    } catch (err) {
        console.log(err)
        // Handle error silently
    }
}
```

**What You Should Explain:**
- Axios vs Fetch: Axios has better defaults, interceptor support
- baseURL: Simplifies endpoint definitions
- withCredentials: Why cookies need to be explicitly included
- Async/await: Cleaner than .then() chains
- Error handling: Try-catch vs throwing errors
- Separating API calls from components: Reusability, testing

---

### 10. **Auth Hook (useAuth)** (`Frontend/src/features/auth/hooks/useAuth.js`)

```javascript
import { useContext, useEffect } from "react"
// useContext: Hook to access context values
// useEffect: Hook to run side effects (like checking login on page load)

import { AuthContext } from "../auth.context"
// Import the auth context to access auth state

import { login, register, logout, getMe } from "../services/auth.api"
// Import API functions to make requests to backend

export const useAuth = () => {
    // Custom hook: Returns auth state and functions

    // Get context value
    const context = useContext(AuthContext)
    
    // Destructure state and setState functions
    const { user, setUser, loading, setLoading } = context
    // user: Currently logged-in user data (or null if not logged in)
    // setUser: Function to update user state
    // loading: Boolean indicating if request is in progress
    // setLoading: Function to update loading state

    /**
     * HANDLE LOGIN
     */
    const handleLogin = async ({ email, password }) => {
        setLoading(true)
        // Show loading indicator to user
        
        try {
            // Call API login function
            const data = await login({ email, password })
            // Backend validates email/password, creates JWT token
            // Response: { user: { id, username, email }, message: "..." }
            
            setUser(data.user)
            // Update context with user data
            // All components using useAuth will now see logged-in user
            
            return data.user
            // Return user data to component

        } catch (err) {
            // Login failed
            throw err
            // Re-throw so component can show error message
            
        } finally {
            setLoading(false)
            // Hide loading indicator (runs whether success or error)
        }
    }

    /**
     * HANDLE REGISTER
     */
    const handleRegister = async ({ username, email, password }) => {
        setLoading(true)
        
        try {
            // Call API register function
            const data = await register({ username, email, password })
            // Backend creates user, returns JWT token
            
            setUser(data.user)
            // Update context with user data
            // User is now logged in after registration

        } catch (err) {
            // Register failed
            // Silently fail here (component should show error)
        } finally {
            setLoading(false)
        }
    }

    /**
     * HANDLE LOGOUT
     */
    const handleLogout = async () => {
        setLoading(true)
        
        try {
            // Call API logout function
            const data = await logout()
            // Backend invalidates JWT token (adds to blacklist)
            
            setUser(null)
            // Clear user from context
            // All components will see user as logged out

        } catch (err) {
            // Logout failed
        } finally {
            setLoading(false)
        }
    }

    /**
     * CHECK IF USER IS LOGGED IN ON PAGE LOAD
     */
    useEffect(() => {
        // This runs when component mounts
        
        // Check if there's a stored token/user
        // Call getMe to verify token is still valid
        // If valid, setUser with their data
        // If invalid, user stays null
        
        // This ensures user stays logged in after page refresh
    }, [])
    // [] = dependency array
    // Empty array means run only once on component mount

    // Return state and functions for component to use
    return {
        user,
        loading,
        handleLogin,
        handleRegister,
        handleLogout
    }
}
```

**What You Should Explain:**
- Custom hooks: Reuse logic across multiple components
- useContext: Access context values without prop drilling
- useEffect: Side effects like checking login on mount
- Try-catch-finally: Finally always runs (even if error)
- State management: Lifting state up to context
- Loading state: Important for UX (show spinners while waiting)

---

## Key Concepts Explained

### A. **Authentication Flow**

```
User Registration:
1. User enters: username, email, password
2. Frontend sends POST /api/auth/register
3. Backend: 
   - Validates input
   - Checks if user exists
   - Hashes password with bcrypt
   - Stores user in MongoDB
   - Creates JWT token: jwt.sign(payload, secret, options)
   - Sets cookie with token: res.cookie("token", token)
   - Returns user data
4. Frontend: 
   - Stores user in context
   - Browser stores cookie automatically
   - Redirects to home page

User Login:
1. User enters: email, password
2. Frontend sends POST /api/auth/login
3. Backend:
   - Finds user by email
   - Compares password with bcrypt.compare()
   - If match: creates JWT token, sets cookie
   - If not: returns error
4. Frontend: Stores user in context, redirects

User Logout:
1. Frontend sends GET /api/auth/logout
2. Backend:
   - Gets token from cookie
   - Adds token to blacklist collection
   - Invalidates the token
3. Frontend:
   - Clears user from context
   - Browser cookie is deleted
   - Redirects to login

Protected Route:
1. User visits /api/interview/list
2. Backend middleware authUser runs:
   - Gets token from cookie
   - Checks if token is blacklisted
   - Verifies token with jwt.verify()
   - Sets req.user with decoded data
   - Calls next() to proceed to controller
3. Controller can access req.user to get current user's data
```

### B. **JWT (JSON Web Tokens)**

```
Structure: header.payload.signature

Header:
{
  "alg": "HS256",    // Algorithm
  "typ": "JWT"       // Type
}

Payload:
{
  "id": "507f1f77bcf86cd799439011",
  "username": "john",
  "iat": 1704067200,    // Issued at
  "exp": 1704153600     // Expires at
}

Signature:
HMACSHA256(base64(header) + "." + base64(payload), SECRET)

Why secure:
- Signature proves backend created this token
- If someone changes payload, signature becomes invalid
- Only server knows the SECRET
- Client can't forge a token without the secret
```

### C. **Hashing vs Encryption**

```
Hashing (Password Storage):
- password "john123" → hash "$2a$10$..." (one-way)
- Can't reverse hash to get original password
- bcrypt: Add salt (random data) + multiple rounds
- If two users have same password, their hashes are different
- Purpose: Verify password without storing plain text

Encryption (Data Protection):
- plaintext "secret" → cipher "XYZ..." (reversible)
- With key: cipher "XYZ..." → plaintext "secret"
- JWT uses HMAC (kind of encryption) with secret key
- Purpose: Protect data, but ability to decrypt

Always hash passwords, never encrypt them
```

### D. **Cookies vs Local Storage**

```
Cookies:
✓ Sent automatically with every request
✓ Secure from XSS (if httpOnly flag set)
✗ Not accessible to JavaScript
✓ Small size limit (4KB)
✓ Can be scoped to domain/path
✓ Backend can set them

Local Storage:
✗ Not sent automatically
✗ Vulnerable to XSS attacks
✓ Accessible to JavaScript
✓ Larger size (~5-10MB)
✗ No automatic scoping
✗ Only frontend can set

JWT tokens:
- Store in httpOnly cookie for security
- withCredentials: true allows sending cookies with requests
```

---

## Interview Topics

### **1. Authentication & Security**
- [ ] How does JWT work and why is it secure?
- [ ] What's the difference between hashing and encryption?
- [ ] Why should passwords be hashed, not encrypted?
- [ ] How does bcrypt salt work?
- [ ] What's a token blacklist and when is it used?
- [ ] Why use httpOnly cookies instead of localStorage?
- [ ] What's CORS and why is it needed?
- [ ] How to prevent CSRF attacks?

### **2. Backend Architecture**
- [ ] What's a middleware and when is it used?
- [ ] Explain the MVC/MVCS pattern used here
- [ ] What's the difference between a route and a controller?
- [ ] How does Express routing work?
- [ ] What's dependency injection?
- [ ] How to structure a scalable Node.js app?
- [ ] What's error handling best practices?

### **3. Frontend Architecture**
- [ ] What's React Context API and how is it different from Redux?
- [ ] What are custom hooks and when to use them?
- [ ] What's the difference between useState and useContext?
- [ ] How does React Router work?
- [ ] What's component composition vs inheritance?
- [ ] What's lifting state up?
- [ ] How to handle loading states in React?

### **4. Database**
- [ ] MongoDB vs SQL databases: when to use each?
- [ ] What's a schema in Mongoose?
- [ ] What are indexes and why are they important?
- [ ] How does unique validation work?
- [ ] What's an ODM (Object Document Mapper)?

### **5. HTTP & APIs**
- [ ] What are HTTP status codes (200, 400, 401, 403)?
- [ ] RESTful API design principles
- [ ] Difference between GET, POST, PUT, DELETE
- [ ] How does HTTP request/response work?
- [ ] What's request body vs query params vs path params?
- [ ] What's a Cookie vs Header?

### **6. Async Programming**
- [ ] Promise vs Callback vs Async/Await
- [ ] What's the event loop?
- [ ] What's a microtask queue?
- [ ] How to handle errors in async functions?
- [ ] What's await and when does it block?

### **7. Code Quality**
- [ ] Input validation: why and how?
- [ ] Error handling: try-catch vs callbacks
- [ ] Logging and debugging
- [ ] Code organization and modularity
- [ ] DRY (Don't Repeat Yourself) principle

---

## Technical Deep Dive

### **Connection Flow Diagram**

```
User Opens App
    ↓
React loads App.jsx
    ↓
Providers wrap RouterProvider
    ↓
AuthProvider: creates AuthContext
InterviewProvider: creates InterviewContext
    ↓
RouterProvider: matches URL to route
    ↓
Component (e.g., Login.jsx) mounts
    ↓
useAuth hook reads from AuthContext
    ↓
User clicks "Login"
    ↓
handleLogin calls login() from auth.api.js
    ↓
Axios makes POST to http://localhost:3000/api/auth/login
    ↓
Request includes withCredentials: true (sends cookies)
    ↓
Backend receives request
    ↓
authRouter routes to loginUserController
    ↓
Controller validates email/password
    ↓
Controller creates JWT token and sets cookie
    ↓
Backend sends response with user data
    ↓
Frontend receives response
    ↓
setUser(data.user) updates context
    ↓
All components using useAuth see logged-in user
    ↓
Protected components render
```

### **Data Flow Example: Login**

```javascript
// Frontend Component (Login.jsx)
const { handleLogin } = useAuth()

const onSubmit = (formData) => {
  handleLogin(formData)  // formData = { email, password }
}

// Goes to:
// Frontend useAuth Hook
const handleLogin = async ({ email, password }) => {
  setLoading(true)
  const data = await login({ email, password })
  setUser(data.user)
}

// Goes to:
// Frontend API Service (auth.api.js)
export async function login({ email, password }) {
  const response = await api.post("/api/auth/login", {
    email, password
  })
  return response.data
}

// HTTP Request to:
// Backend Route (auth.routes.js)
authRouter.post("/login", authController.loginUserController)

// Goes to:
// Backend Controller (auth.controller.js)
async function loginUserController(req, res) {
  const { email, password } = req.body
  const user = await userModel.findOne({ email })
  
  const isPasswordValid = await bcrypt.compare(
    password, 
    user.password
  )
  
  const token = jwt.sign(
    { id: user._id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  )
  
  res.cookie("token", token)
  res.status(200).json({
    message: "User loggedIn successfully.",
    user: { id: user._id, username, email }
  })
}

// Response back to Frontend
// Frontend sets user in context
// UI updates to show logged-in state
```

### **Error Handling Examples**

```javascript
// Backend: Validate input
if (!username || !email || !password) {
  return res.status(400).json({
    message: "Please provide username, email and password"
  })
}

// Backend: Check if user exists
const isUserAlreadyExists = await userModel.findOne({
  $or: [ { username }, { email } ]
})
if (isUserAlreadyExists) {
  return res.status(400).json({
    message: "Account already exists..."
  })
}

// Backend: Verify password
if (!isPasswordValid) {
  return res.status(400).json({
    message: "Invalid email or password"
  })
}

// Frontend: Handle login error
try {
  const data = await login({ email, password })
  setUser(data.user)
} catch (err) {
  // Show error message to user
  setError(err.message)
}
```

---

## Interview Preparation Checklist

Before your interview, be able to:

- [ ] Draw the architecture of the entire app
- [ ] Explain the authentication flow from start to finish
- [ ] Trace a user action from frontend to backend and back
- [ ] Explain why each technology was chosen (JWT, bcrypt, Mongoose, etc)
- [ ] Identify security vulnerabilities and fixes
- [ ] Suggest how to scale this app
- [ ] Explain trade-offs in your implementation
- [ ] Code a simple feature from scratch (e.g., add a new route)
- [ ] Debug common issues (CORS errors, 401 errors, etc)
- [ ] Discuss performance optimizations

---

**Good luck with your interview! 🚀**

This guide covers the core concepts. Study the actual code files and be prepared to explain any line in detail.
