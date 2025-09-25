import express, { application } from "express";
import mongoose from "mongoose";
import cors from "cors";
import UserModel from "./Models/User.js";
import ApplianceModel from "./Models/Appliance.js";
import bcrypt from 'bcrypt';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

let app = express();
app.use(cors());
app.use(express.json());
const MongConnect = "mongodb+srv://Shifw:Sh121212@cluster0.djsr0sq.mongodb.net/Renting_household_appliances";
mongoose.connect(MongConnect,{
    //useNewUrlParser: true,
    //useUnifiedTopology:true
});

// Nodemailer transporter setup
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'arw93955@gmail.com',
        pass: 'ivjd rpcm pbme tuam',
    },
});

// api for insert new User
app.post("/addUser", async (req, res) => {
    console.log("Received /addUser request", req.body);
    try {
        const user = await UserModel.findOne({ user: req.body.user });
        const email = await UserModel.findOne({ email: req.body.email });


        if (user) {
            return res.status(400).json({ message: "User already exists." });
        } else if (email) {
            return res.status(400).json({ message: "Email already exists." });
        } else {
            const hashedPassword = await bcrypt.hash(req.body.password, 10);


            const newUser = new UserModel({
                user: req.body.user,
                password: hashedPassword, 
                isAdmin: req.body.isAdmin || false,
                email: req.body.email,
                gender: req.body.gender,
                imgUrl: req.body.imgUrl,
            });

            await newUser.save();
            // Return the user object as expected by the frontend
            return res.status(201).json({ UserServer: newUser, message: "User added successfully." });
        }
    }catch (error) {
        console.error("Error saving user:", error);
        return res.status(500).json({ message: "Internal server error." });
    }
});

// api for login User
app.post("/getUser", async (req, res) => {
    try {
        const user = await UserModel.findOne({ user: { $regex: `^${req.body.user}$`, $options: 'i' } });
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        } else {
            // Compare the hashed password
            const isMatch = await bcrypt.compare(req.body.password, user.password);
            if (isMatch) {
                return res.status(200).json({ user: user, message: "Login successful." });
            } else {
                return res.status(401).json({ message: "Invalid password." });
            }
        }
    } catch (error) {
        console.error("Error during login:", error);
        return res.status(500).json({ message: "Internal server error." });
    }
});

// api to update user details
app.put('/updateUser/:user', async (req, res) => {
    try {
        const { user } = req.params;
        const { password, imgUrl, gender } = req.body;

        const existingUser = await UserModel.findOne({ user });
        if (!existingUser) {
            return res.status(404).json({ message: 'User not found.' });
        }
        // Update only the allowed fields
        if (password) {
            existingUser.password = await bcrypt.hash(password, 10); 
        }
        if (imgUrl) {
            existingUser.imgUrl = imgUrl;
        }
        if (gender) {
            existingUser.gender = gender;
        }

        const updatedUser = await existingUser.save();
        res.status(200).json({ message: 'User updated successfully.', user: updatedUser });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ message: 'Internal server error.', error: error.message });
    }
});


// api for get Users details
app.get("/getUsers", async (req, res) => {
    try {
        // Fetch users where isAdmin is false
        const users = await UserModel.find({ isAdmin: false });
        return res.status(200).json(users);
    } catch (error) {
        console.error("Error fetching users:", error);
        return res.status(500).json({ message: "Internal server error." });
    }
});

// api for insert new Appliance
app.post("/inserAppliance", async (req, res) => {
    try {
            console.log("/inserAppliance payload:", req.body);
            const { name, imgUrl, price, dueDate, details, available } = req.body;

            if (!name || name.trim() === "") {
                return res.status(400).json({ message: "Name is required." });
            }
            if (!details || details.trim() === "") {
                return res.status(400).json({ message: "Details are required." });
            }

            const newAppliance = new ApplianceModel({
                name: name.trim(),
                imgUrl: imgUrl || "",
                price: String(price),
                details: details.trim(),
                available: Boolean(available),
            });
            await newAppliance.save();
            return res.status(201).json({ message: "Appliance added successfully." });
        } catch (error) {
        console.error("Error saving appliance:", error);
        return res.status(500).json({ message: error?.message || "Internal server error." });
    }
});

// api for aggrecation to get User Appliances
app.get("/getSpecificAppliance", async (req, res) => {
    try {
        const ApplianceWithUser = await ApplianceModel.aggregate([
            {
                $lookup: {
                    from: "users", 
                    localField: "name", // Field in ApplianceModel
                    foreignField: "user", // Field in UserModel for joining
                    as: "userdata"
                }
            },
            {
                "$project": {
                    "userdata.password": 0, // ignore password
                    "userdata.user": 0 // ignore user
                }
            }
        ]);
        if (!ApplianceWithUser || ApplianceWithUser.length === 0) {
            return res.status(404).json({ message: "No appliances found." });
        }
        res.json({ Appliance: ApplianceWithUser });
    } catch (error) {
        console.error("Error fetching specific appliances:", error); 
        return res.status(500).json({ message: error.message });
    }
});

// api for delete any User
app.delete('/deleteUser/:user', async (req, res) => {
    try {
      const { user } = req.params; 
      // Find and delete the user
      const deletedUser = await UserModel.findOneAndDelete({ user });
      if (!deletedUser) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.status(200).json({ message: 'User deleted successfully', deletedUser });
    } catch (error) {
      res.status(500).json({ message: 'Error deleting user', error: error.message });
    }
  });

// api for delete any appliance
app.delete('/appliances/:id', async (req, res) => {
    try {
        const deletedAppliance = await ApplianceModel.findByIdAndDelete(req.params.id);

        if (!deletedAppliance) {
            return res.status(404).json({ message: 'Appliance not found' });
        }

        res.status(200).json({ message: 'Appliance deleted successfully', appliance: deletedAppliance });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting appliance', error: error.message });
    }
});

// api for update any appliance
app.put('updateAppliance/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, price, dueDate, details, available } = req.body;

        // Find the appliance by ID and user
        const appliance = await ApplianceModel.findOne({ _id: id, user });

        if (!appliance) {
            return res.status(404).json({ message: 'Appliance not found for the specified user.' });
        }

        // Update appliance details
        appliance.price = price || appliance.price;
        appliance.dueDate = dueDate || appliance.dueDate;
        appliance.details = details || appliance.details;
        appliance.available = completed !== undefined ? available : appliance.available;

        const updatedAppliance = await appliance.save();
        res.status(200).json({ message: 'Appliance updated successfully', appliance: updatedAppliance });
    } catch (error) {
        res.status(500).json({ message: 'Error updating appliance', error: error.message });
    }
});

// Request OTP endpoint
app.post('/request-otp', async (req, res) => {
    const { email } = req.body;
    try {
        const user = await UserModel.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes 
        user.otp = otp;
        user.otpExpires = otpExpires;
        await user.save();

        // Send OTP email
        await transporter.sendMail({
            from: 'arw93955@gmail.com',
            to: email,
            subject: 'Your OTP Code',
            text: `Your OTP code is: ${otp}. It expires in 10 minutes.`
        });
        return res.json({ message: 'OTP sent to email.' });
    } catch (error) {
        console.error('Error sending OTP:', error);
        return res.status(500).json({ message: 'Failed to send OTP.' });
    }
});

// Verify OTP endpoint
app.post('/verify-otp', async (req, res) => {
    const { email, otp } = req.body;
    try {
        const user = await UserModel.findOne({ email });
        if (!user || !user.otp || !user.otpExpires) {
            return res.status(400).json({ message: 'OTP not requested.' });
        }
        if (user.otp !== otp) {
            return res.status(400).json({ message: 'Invalid OTP.' });
        }
        if (user.otpExpires < new Date()) {
            return res.status(400).json({ message: 'OTP expired.' });
        }
        // OTP is valid
        return res.json({ message: 'OTP verified.' });
    } catch (error) {
        console.error('Error verifying OTP:', error);
        return res.status(500).json({ message: 'Failed to verify OTP.' });
    }
});

// Reset password endpoint
app.post('/reset-password', async (req, res) => {
    const { email, otp, newPassword } = req.body;
    try {
        const user = await UserModel.findOne({ email });
        if (!user || !user.otp || !user.otpExpires) {
            return res.status(400).json({ message: 'OTP not requested.' });
        }
        if (user.otp !== otp) {
            return res.status(400).json({ message: 'Invalid OTP.' });
        }
        if (user.otpExpires < new Date()) {
            return res.status(400).json({ message: 'OTP expired.' });
        }
        // Update password
        user.password = await bcrypt.hash(newPassword, 10);
        user.otp = undefined;
        user.otpExpires = undefined;
        await user.save();
        return res.json({ message: 'Password reset successful.' });
    } catch (error) {
        console.error('Error resetting password:', error);
        return res.status(500).json({ message: 'Failed to reset password.' });
    }
});

// api for get user profile
app.get("/getUserProfile/:username", async (req, res) => {
    try {
        const user = await UserModel.findOne({ user: req.params.username.toLowerCase() });
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }
        // Return user data without sensitive information
        const userData = {
            user: user.user,
            email: user.email,
            gender: user.gender,
            imgUrl: user.imgUrl,
            isAdmin: user.isAdmin
        };
        return res.status(200).json(userData);
    } catch (error) {
        console.error("Error fetching user profile:", error);
        return res.status(500).json({ message: "Internal server error." });
    }
});

app.listen(5000,()=>{
    console.log("Server running on port 5000");
})
