const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 5000;
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all origins; you can specify your client URL for security
        methods: ["GET", "POST"]
    }
});

const rooms = {};
app.use(cors()); // Enable CORS for all routes

// Endpoint to fetch champions data
app.get('/api/champions', async (req, res) => {
    try {
        const link = "https://ddragon.leagueoflegends.com/cdn/14.17.1/data/en_US/champion.json";
        const response = await fetch(link);
        const data = await response.json();
        res.json(data.data); // Send only the champions data
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch champions data' });
    }
});

// Start the server
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Handle room creation
    socket.on('createRoom', (username) => {
        const roomName = uuidv4(); // Generate a random room name (UUID)
        socket.username = username;
        rooms[roomName] = { members: [] }; // Add the room to the rooms object
        rooms[roomName].members.push({ id: socket.id, username: username, team:0, lockedStatus: false }); // Add the current user to the room's member list
        socket.join(roomName); // Add the user to the room in Socket.IO
        console.log(`${socket.id} created and joined room: ${roomName}`);
    
        // Emit the room name back to the client
        
        socket.emit('roomCreated', roomName);
        socket.emit('isLeader',true)
        // Emit the updated user list after room creation
        const updatedUserList = rooms[roomName].members.map(member => member.username);
        io.to(roomName).emit('returnNum', rooms[roomName].members.length, updatedUserList);
        
    });
    

    // Handle user disconnection
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);

        // Loop through each room to find where the disconnected user was a member
        for (const roomId in rooms) {
            const room = rooms[roomId];

            // Find the index of the member in the room
            const memberIndex = room.members.findIndex(member => member.id === socket.id);
            
            // If the user was found in the room's members
            if (memberIndex !== -1) {
                const username = room.members[memberIndex].username; // Get the username of the disconnecting user

                // Remove the user from the room's members array
                room.members.splice(memberIndex, 1);
                console.log(`${username} (${socket.id}) left room: ${roomId}`);
                
                // Broadcast the updated player count and user list to the remaining members
                const updatedCount = room.members.length;
                const updatedUserList = room.members.map(member => member.username); // Create an updated user list
                io.to(roomId).emit('returnNum', updatedCount, updatedUserList);

                // Delete the room if it becomes empty
                if (updatedCount === 0) {
                    delete rooms[roomId];
                    console.log(`Room ${roomId} deleted because it became empty`);
                }
            }
        }
    });

    socket.on('selectChampion', (roomId, champion,teamVal) => {
        console.log(`sending ${champion.id} to:`,teamVal)
        
        socket.to(`${roomId}`).emit('championSelected', champion,teamVal);
    });

    socket.on('joinRoom', (room, username) => {
        socket.username = username;
        rooms[room].members.push({ id: socket.id, username: username, lockedStatus: false  });
        socket.join(room);
        console.log(`${socket.id} joined room: ${room}`);
        socket.emit('joinedRoom', room);

        // Emit the updated user list after joining
        const updatedUserList = rooms[room].members.map(member => member.username);
        io.to(room).emit('returnNum', rooms[room].members.length, updatedUserList);
    });

    socket.on('getNumPlayers', (room) => {
        let userList = [];
        if (rooms.hasOwnProperty(room)) {
            for (const user of rooms[room].members) {
                userList.push(user.username);
            }
            io.to(`${room}`).emit('returnNum', rooms[room].members.length, userList);
        }
    });

    socket.on('startChampSelect',(room) =>{

        const roomMembers = rooms[room].members;

    // Split the members into two teams

        roomMembers.forEach((member, index) => {
            if (index % 2 === 0) {
                console.log(member.username,1)
                member.team = 1; // Assign team 1
            } else {
                console.log(member.username,2)
                member.team = 2; // Assign team 2
            }
        });

        socket.to(`${room}`).emit('connectToChampSelect',room)
    })

    socket.on('getIndex',(room)=>{
        if (rooms.hasOwnProperty(room)) {
            // Find the user's index in the specified room
            const userIndex = rooms[room].members.findIndex(member => member.id === socket.id);
            
            if (userIndex !== -1) {
                // Send the index back to the requesting client
                socket.emit('returnIndex', userIndex);
                console.log(`User index for socket ${socket.id} in room ${room}: ${userIndex}`);
            } else {
                // User not found in the room
                socket.emit('returnIndex', -1);
                console.log(`User ${socket.id} not found in room ${room}`);
            }
        } else {
            // Room not found
            socket.emit('returnIndex', -1);
            console.log(`Room ${room} not found`);
        }
    })

    socket.on('updateChampMap',(room,mapVal) =>{
        io.to(`${room}`).emit('addChamps',mapVal)
    })

    socket.on('getTeam',(room)=>{
        
        if(rooms.hasOwnProperty(room)){
            const userIndex = rooms[room].members.findIndex(member => member.id === socket.id);
            const player = rooms[room].members[userIndex]
            io.to(socket.id).emit('returnTeamVal',player)
        }
    })

    socket.on('getPlayerList', (room) => {
        // Check if the room exists
        if (rooms.hasOwnProperty(room)) {
          // Create a list of usernames from the room's members
          const rlist = rooms[room].members.map((member) => member.username);
      
      
          // Emit the list of usernames back to the client that requested it
          socket.emit('returnPlayerList', rlist);
        } else {
          // Handle the case where the room does not exist
          console.error(`Room ${room} does not exist.`);
          socket.emit('returnPlayerList', []); // Send an empty list if the room doesn't exist
        }
      });
    
    socket.on('getLockedStatus', (room) =>{
        if(rooms.hasOwnProperty(room)){
            const userIndex = rooms[room].members.findIndex(member => member.id === socket.id)
            const player = rooms[room].members[userIndex].lockedStatus = true
            console.log(player)
            let allLocked = true
            for(let i = 0; i < rooms[room].members.length ; i++){
                if (rooms[room].members[i].lockedStatus === false){
                    allLocked = false
                }
            }
            if(allLocked){ 
                console.log('revealing all champs')
                io.to(`${room}`).emit('revealChamps')
            }
        }
    })

    socket.on("inLobby",(room) =>{
        if(rooms.hasOwnProperty(room)){
            const member = rooms[room].members.find(member => member.id === socket.id);
            if(member){
                io.to(socket.id).emit('returnLobby',true)
            }
            else{
                io.to(socket.id).emit('returnLobby',false)
            }
        }
    })
      


});


