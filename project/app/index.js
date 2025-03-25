import { Server } from "socket.io";
import express from "express";
import http from "http";
import Message from "../models/message.js";
import User from "../models/user.js";
import connectDB from "../database/connectdb.js";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"]
    },
});

connectDB();

io.on("connection", async (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on("registerUser", async (email) => {
        console.log(email);
        const user = await User.findOne({ email: email });
        // console.log(user);
        if (!user) {
            console.log(`⚠️ User ${email} not found`);
            return;
        }

        user.socketId = socket.id;
        await user.save();
        // users[userId] = socket.id;
        console.log(`User registered: ${email} -> ${socket.id}`);
    });

    socket.on("sendMessage", async (data) => {
        const { content, to, from } = data;
        // console.log(content, to, from);
        const recipient = await User.findOne({ _id: to });
        // console.log(recipient);

        if (!recipient) {
            console.log(`⚠️ User ${to} not found or offline`);
            return;
        }

        const message = new Message({ sender: from, receiver: to, content: content });
        await message.save();

        if (recipient.socketId) {
            io.to(recipient.socketId).emit("receiveMessage", {
                content, from
            });
            console.log(`Message sent to ${to} (${recipient}): ${content}`);
        } else {
            console.log(`User ${to} is not registered`);
        }
    });

    socket.on("call-user", ({ to, offer }) => {
        console.log("Calling user:", to);
        // console.log(offer);
        console.log(`User ${socket.id}`);
        io.emit("incoming-call", { from: socket.id, offer });
    });

    socket.on("answer-call", ({ to, answer }) => {
        console.log("Answering call:", to);
        io.emit("call-answered", { from: socket.id, answer });
    });

    socket.on("ice-candidate", ({ to, candidate }) => {
        console.log("Sending ICE candidate:", to);
        io.to(to).emit("ice-candidate", { from: socket.id, candidate });
    });

    socket.on("disconnect", async () => {
        console.log(`User disconnected: ${socket.id}`);
        await User.findOneAndUpdate({ socketId: socket.id }, { socketId: null });
    });
});

server.listen(3001, () => {
    console.log("✅ Socket.IO Server running on port 3001");
});
