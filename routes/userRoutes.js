const express = require('express');
const router = express.Router();
const User = require('./../models/user');
const {jwtAuthMiddleware, generateToken} = require('./../jwt');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const otpStore = {}; // Temporary store for OTPs

// POST route to add a person
router.post('/signup', async (req, res) => {
    try {
        const data = req.body;

        // Check if there is already an admin user
        const adminUser = await User.findOne({ role: 'admin' });
        if (data.role === 'admin' && adminUser) {
            return res.status(400).json({ error: 'Admin user already exists' });
        }

        // Check if the email already exists
        const existingEmailUser = await User.findOne({ email: data.email });
        if (existingEmailUser) {
            return res.status(400).json({ error: 'Email already exists' });
        }

        // Create a new User document using the Mongoose model
        const newUser = new User(data);

        // Save the new user to the database
        const response = await newUser.save();
        console.log('data saved');

        const payload = {
            id: response._id,
            role: response.role, // Include role in the token payload
        };
        console.log(JSON.stringify(payload));
        const token = generateToken(payload);

        res.status(200).json({ response: response, token: token });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Login Route
router.post('/login', async (req, res) => {
    try {
        // Extract email from request body
        const { email } = req.body;

        // Check if email is missing
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // Check if the email exists
        const user = await User.findOne({ email: email });
        if (!user) {
            return res.status(400).json({ error: 'Email does not exist' });
        }

        // Generate token
        const payload = {
            id: user._id,
            role: user.role, // Include role in the token payload
        };
        const token = generateToken(payload);
        console.log(user);
        // Return token as response
        res.status(200).json({ user: user, token });
        console.log('Login success');
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Profile route
router.get('/profile', jwtAuthMiddleware, async (req, res) => {
    try {
        const userData = req.user;
        const userId = userData.id;
        const user = await User.findById(userId, 'name email role'); // Fetch only username, email, and role
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(200).json({ user });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Route to send OTP
router.post('/send-otp', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const otp = crypto.randomInt(100000, 999999).toString(); // Generate 6-digit OTP
        otpStore[email] = otp;

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL, // Your email
                pass: process.env.EMAIL_PASSWORD, // Your email password
            },
        });

        const mailOptions = {
            from: process.env.EMAIL,
            to: email,
            subject: 'Your OTP for Login',
            text: `Your OTP is ${otp}. It is valid for 5 minutes.`,
        };

        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: 'OTP sent successfully' });
         console.log(`OTP sent to ${email}: ${otp}`);

        // Clear OTP after 5 minutes
        setTimeout(() => delete otpStore[email], 300000);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to send OTP' });
    }
});

// Route to verify OTP
router.post('/verify-otp', (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({ error: 'Email and OTP are required' });
        }

        if (otpStore[email] === otp) {
            delete otpStore[email]; // Clear OTP after successful verification
            res.status(200).json({ message: 'OTP verified successfully' });
        } else {
            res.status(400).json({ error: 'Invalid OTP' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to verify OTP' });
    }
});

module.exports = router;
