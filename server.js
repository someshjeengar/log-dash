const express = require('express');


const app = express();

const db = require('./db');
require('dotenv').config();

const bodyParser = require('body-parser'); 
app.use(bodyParser.json()); // req.body
const cors = require('cors');

app.use(cors()); // Allow all origins

app.use(cors({ origin: "https://helpful-begonia-dd5ddb.netlify.app"})); // Updated frontend URL


const PORT = process.env.PORT || 3000;

// Import the router files
const userRoutes = require('./routes/userRoutes');

// Middleware to handle errors
app.use((err, req, res, next) => {
    if (err.message === "Email already exists") {
        return res.status(400).send("Email already exists"); // Send error message
    }
    console.error(err.stack);
    res.status(500).send("Something went wrong!");
});

// Use the routers
app.use('/user', userRoutes);
// app.use('/candidate', candidateRoutes);

app.listen(PORT, () => {
    console.log('Server is running on port 3000');
});
