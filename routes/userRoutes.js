const express = require('express');
const router = express.Router();
const User = require('./../models/user');
const {jwtAuthMiddleware, generateToken} = require('./../jwt');

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
        // Extract email and password from request body
        const { email, password } = req.body;

        // Check if email or password is missing
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Check if the email exists
        const user = await User.findOne({ email: email });
        if (!user) {
            return res.status(400).json({ error: 'Email does not exist' });
        }

        // If password does not match, return error
        if (!(await user.comparePassword(password))) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Generate token
        const payload = {
            id: user._id,
            role: user.role, // Include role in the token payload
        };
        const token = generateToken(payload);

        // Return token as response
        res.status(200).json({user:user, token });
        console.log('Login success');
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Profile route
router.get('/profile', jwtAuthMiddleware, async (req, res) => {
    try{
        const userData = req.user;
        const userId = userData.id;
        const user = await User.findById(userId);
        console.log(user);
        res.status(200).json({user});
    }catch(err){
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
})

// Delete account route
router.delete('/delete', jwtAuthMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        await User.findByIdAndDelete(userId);
        console.log('User account deleted');
        res.status(200).json({ message: 'Account deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;