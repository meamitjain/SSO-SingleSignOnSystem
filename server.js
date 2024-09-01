const express = require('express');
const bodyParser = require('body-parser');
const { MongoClient } = require('mongodb');
const path = require('path');
const session = require('express-session');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware setup
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Set up session middleware
app.use(session({
    secret: process.env.SESSION_SECRET, // Use an environment variable for the secret
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 60000 } // Session expiration time in milliseconds (e.g., 60000ms = 1 minute)
}));

// MongoDB connection URL and database name
const url = process.env.MONGODB_URL || 'mongodb://localhost:27017';
const dbName = process.env.DB_NAME || 'userDB';

// Function to connect to MongoDB
const connectToDB = async () => {
    let client;
    try {
        client = await MongoClient.connect(url, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log('Connected to Database');
        return client;
    } catch (err) {
        console.error('Failed to connect to the database', err);
        throw err; // Rethrow the error for the caller to handle
    }
};

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
    if (req.session && req.session.username) {
        return next();
    } else {
        res.sendFile(path.join(__dirname, 'public', 'unauthorized.html'));
    }
};

// Serve the HTML file for registration
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

// Serve the sign-in page
app.get('/signin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve the success page with authentication
app.get('/success', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'success.html'));
});

// Serve the dashboard page with authentication
app.get('/dashboard', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Sign In route
app.post('/signin', async (req, res) => {
    const { username, password } = req.body;

    let client;
    try {
        client = await connectToDB();
        const db = client.db(dbName);
        const usersCollection = db.collection('users');

        // Validate user credentials
        const user = await usersCollection.findOne({ username: username });
        if (!user || user.password !== password) {
            res.status(401).json({ message: 'Invalid username or password.' });
        } else {
            // Set session variables
            req.session.username = username;
            req.session.signInTime = Date.now(); // Store sign-in time in the session

            res.status(200).json({ message: `Successfully signed in. Welcome, ${username}.` });
        }
    } catch (err) {
        console.error('Error occurred while accessing the database', err);
        res.status(500).json({ message: 'Error occurred while accessing the database.' });
    } finally {
        if (client) {
            client.close();
        }
    }
});

// Register route
app.post('/register', async (req, res) => {
    const { username, mobile, email, password } = req.body;

    let client;
    try {
        client = await connectToDB();
        const db = client.db(dbName);
        const usersCollection = db.collection('users');

        // Check if the user already exists
        const existingUser = await usersCollection.findOne({ username: username });
        if (existingUser) {
            res.status(409).json({ message: 'Username already exists.' });
        } else {
            // Insert new user into the database
            await usersCollection.insertOne({ username, mobile, email, password });
            res.status(201).json({ message: 'User registered successfully.' });
        }
    } catch (err) {
        console.error('Error occurred while accessing the database', err);
        res.status(500).json({ message: 'Error occurred while accessing the database.' });
    } finally {
        if (client) {
            client.close();
        }
    }
});

// Logout route
app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Error during logout', err);
            return res.status(500).send('Logout failed');
        }
        res.sendStatus(200);
    });
});

// Start the server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
