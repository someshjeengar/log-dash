const express = require('express');
const User = require('../models/user');
const Candidate = require('../models/candidate');
const { jwtAuthMiddleware } = require('../jwt');

const checkAdminRole = async (userID) => {
    try {
        const user = await User.findById(userID);
        if (user.role === 'admin') {
            return true;
        }
    } catch (err) {
        return false;
    }
};

module.exports = (io) => {
    const router = express.Router();

    // POST route to add a candidate
    router.post('/', jwtAuthMiddleware, async (req, res) => {
        try {
            if (!(await checkAdminRole(req.user.id)))
                return res.status(403).json({ message: 'user does not have admin role' });

            const data = req.body; // Assuming the request body contains the candidate data

            // Create a new User document using the Mongoose model
            const newCandidate = new Candidate(data);

            // Save the new user to the database
            const response = await newCandidate.save();
            console.log('data saved');
            res.status(200).json({ response: response });
        } catch (err) {
            console.log(err);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });

    router.delete('/:candidateID', jwtAuthMiddleware, async (req, res) => {
        try {
            if (!checkAdminRole(req.user.id))
                return res.status(403).json({ message: 'user does not have admin role' });

            const candidateID = req.params.candidateID; // Extract the id from the URL parameter

            const response = await Candidate.findByIdAndDelete(candidateID);

            if (!response) {
                return res.status(404).json({ error: 'Candidate not found' });
            }

            console.log('candidate deleted');
            res.status(200).json(response);
        } catch (err) {
            console.log(err);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });

    // let's start voting
    router.post('/vote/:candidateID', jwtAuthMiddleware, async (req, res) => {
        const candidateID = req.params.candidateID;
        const userId = req.user.id;

        try {
            const candidate = await Candidate.findById(candidateID);
            if (!candidate) {
                return res.status(404).json({ message: 'Candidate not found' });
            }

            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            // Check if the user has already voted
            const voteIndex = candidate.votes.findIndex(vote => vote.user.toString() === userId);

            if (voteIndex === -1) {
                // User has not voted, add their vote
                candidate.votes.push({ user: userId });
                candidate.voteCount++;
            } else {
                // User has already voted, remove their vote
                candidate.votes.splice(voteIndex, 1);
                candidate.voteCount--;
            }

            await candidate.save();

            // Emit real-time vote count update
            io.emit('voteCountUpdate', {
                candidateID: candidate._id.toString(), // Ensure it's a string
                voteCount: candidate.voteCount
            });

            return res.status(200).json({
                message: voteIndex === -1 ? 'Vote recorded successfully' : 'Vote removed successfully',
                candidate: {
                    name: candidate.name,
                    profilePicture: candidate.profilePicture,
                    age: candidate.age,
                    party: candidate.party,
                    voteCount: candidate.voteCount,
                    voters: candidate.votes.map(vote => vote.user.toString()) // Include voters list
                }
            });
        } catch (err) {
            console.log(err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    });

    // vote count 
    router.get('/votecount', async (req, res) => {
        try {
            // Find all candidates and sort them by voteCount in descending order
            const candidate = await Candidate.find().sort({ voteCount: 'desc' });

            // Map the candidates to only return their name and voteCount
            const voteRecord = candidate.map((data) => {
                return {
                    party: data.party,
                    count: data.voteCount
                };
            });
            console.log(voteRecord);

            return res.status(200).json(voteRecord);
        } catch (err) {
            console.log(err);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });

    // Get List of all candidates with name, profilePicture, age, and party fields
    router.get('/', async (req, res) => {
        try {
            // Find all candidates and select the required fields
            const candidates = await Candidate.find({}, 'name profilePicture age party voteCount').sort({ voteCount: 'desc' });
            console.log(candidates);
            // Return the list of candidates
            res.status(200).json(candidates);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });

    // PUT route to update a candidate's profile picture
    router.put('/:candidateID', jwtAuthMiddleware, async (req, res) => {
        try {
            if (!(await checkAdminRole(req.user.id))) {
                return res.status(403).json({ message: 'User does not have admin role' });
            }

            const candidateID = req.params.candidateID;
            const { profilePicture } = req.body;

            if (!profilePicture) {
                return res.status(400).json({ message: 'Profile picture URL is required' });
            }

            const candidate = await Candidate.findById(candidateID);
            if (!candidate) {
                return res.status(404).json({ message: 'Candidate not found' });
            }

            candidate.profilePicture = profilePicture; // Update the profile picture
            await candidate.save();

            console.log('Profile picture updated');
            res.status(200).json({ message: 'Profile picture updated successfully', candidate });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });

    return router;
};