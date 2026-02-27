const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

app.use(express.static("public"));

let users = {};

io.on("connection", socket => {

    /* JOIN */

    socket.on("join", username => {

        users[socket.id] = username;

        io.emit("users", users);

    });


    /* CALL USER */

    socket.on("callUser", data => {

        io.to(data.to).emit("incomingCall", {

            from: socket.id,
            name: users[socket.id],
            offer: data.offer

        });

    });


    /* ANSWER CALL */

    socket.on("answerCall", data => {

        io.to(data.to).emit("callAccepted", {

            answer: data.answer

        });

    });


    /* ICE */

    socket.on("iceCandidate", data => {

        io.to(data.to).emit("iceCandidate", data.candidate);

    });


    /* REJECT CALL */

    socket.on("rejectCall", data => {

        io.to(data.to).emit("callRejected");

    });


    /* END CALL */

    socket.on("endCall", data => {

        io.to(data.to).emit("callEnded");

    });


    /* DISCONNECT */

    socket.on("disconnect", () => {

    let disconnectedUser = socket.id;

    delete users[socket.id];

    io.emit("users", users);

    // Notify all users that this user went offline
    socket.broadcast.emit("userDisconnected", disconnectedUser);

});

});


const PORT = process.env.PORT || 3000;

http.listen(PORT, () => {
console.log("Server running on port " + PORT);
});