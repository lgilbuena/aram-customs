const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const { randomInt } = require('crypto');

const app = express();
const PORT = process.env.PORT || 5000;
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all origins; you can specify your client URL for security
        methods: ["GET", "POST"]
    }
});

const rooms = {};
app.use(cors()); // Enable CORS for all routes

const getRoom = (roomId) => {
    if (typeof roomId !== 'string' || !Object.prototype.hasOwnProperty.call(rooms, roomId)) {
        return null;
    }
    return rooms[roomId];
};

const getMember = (room, socketId) => room?.members.find(member => member.id === socketId) || null;

const validUsername = (username) => typeof username === 'string' && username.trim().length > 0 && username.trim().length <= 32;

const validChampion = (champion) => champion && typeof champion.id === 'string' && champion.image && typeof champion.image.full === 'string';

const createRoomCode = () => {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code;
    do {
        code = Array.from({ length: 8 }, () => alphabet[randomInt(alphabet.length)]).join('');
    } while (Object.prototype.hasOwnProperty.call(rooms, code));
    return code;
};

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
        const roomName = createRoomCode();
        socket.username = username;
        if (!validUsername(username)) {
            socket.emit('roomError', 'Username must be between 1 and 32 characters.');
            return;
        }
        username = username.trim();
        rooms[roomName] = { id: uuidv4(), code: roomName, serverStarted: false, leaderId: socket.id, members: [] };
        rooms[roomName].members.push({ id: socket.id, username: username, team: 0, lockedStatus: false });
        socket.join(roomName);
        console.log(`${socket.id} created and joined room: ${roomName}`);
    
        // Emit the room name back to the client
        socket.emit('roomCreated', roomName);
        // Emit the updated user list after room creation
        const updatedUserList = rooms[roomName].members.map(member => member.username);
        io.to(roomName).emit('returnNum', rooms[roomName].members.length, updatedUserList);
    });
    
    // Handle acknowledgment from client
    socket.on('ackRoomCreated', () => {
        for (const room of Object.values(rooms)) {
            if (room.leaderId === socket.id) {
                socket.emit('isLeader', true);
                return;
            }
        }
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

                if (room.serverStarted) {
                    io.to(roomId).emit('matchAborted', 'A player disconnected.');
                } else if (room.leaderId === socket.id && updatedCount > 0) {
                    room.leaderId = room.members[0].id;
                    io.to(roomId).emit('isLeader', false);
                    io.to(room.leaderId).emit('isLeader', true);
                }

                // Delete the room if it becomes empty
                if (updatedCount === 0) {
                    delete rooms[roomId];
                    console.log(`Room ${roomId} deleted because it became empty`);
                }
            }
        }
    });

    socket.on('selectChampion', (roomId, champion,teamVal) => {
        const room = getRoom(roomId);
        const member = getMember(room, socket.id);
        if (!room || !member || !room.serverStarted || !validChampion(champion)) {
            socket.emit('roomError', 'Unable to select that champion.');
            return;
        }
        console.log(`sending ${champion.id} to:`, member.team);
        socket.to(roomId).emit('championSelected', champion, member.team);
    });

    socket.on('joinRoom', (room, username) => {
        const targetRoom = getRoom(room);
        if (!targetRoom) {
            socket.emit('roomError', 'That lobby does not exist.');
            return;
        }
        if (!validUsername(username)) {
            socket.emit('roomError', 'Username must be between 1 and 32 characters.');
            return;
        }
        if(targetRoom.serverStarted === false){
            username = username.trim();
            socket.username = username;
            targetRoom.members.push({ id: socket.id, username: username, team: 0, lockedStatus: false });
            socket.join(room);
            console.log(`${socket.id} joined room: ${room}`);
            socket.emit('joinedRoom', room);

            // Emit the updated user list after joining
            const updatedUserList = targetRoom.members.map(member => member.username);
            io.to(room).emit('returnNum', targetRoom.members.length, updatedUserList);
        }
        else{
            socket.emit('roomError', 'That lobby has already started.');
        }

        });

    socket.on('getNumPlayers', (room) => {
        let userList = [];
        const targetRoom = getRoom(room);
        if (targetRoom) {
            for (const user of targetRoom.members) {
                userList.push(user.username);
            }
            io.to(room).emit('returnNum', targetRoom.members.length, userList);
        }
    });

    socket.on('startChampSelect',(room) =>{
        const targetRoom = getRoom(room);
        const member = getMember(targetRoom, socket.id);
        if (!targetRoom || !member || targetRoom.leaderId !== socket.id) {
            socket.emit('roomError', 'Only the lobby leader can start the match.');
            return;
        }
        if (targetRoom.serverStarted) return;

        const roomMembers = targetRoom.members;

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
        targetRoom.serverStarted = true
        socket.to(`${room}`).emit('connectToChampSelect',room)
    })

    socket.on('getIndex',(room)=>{
        const targetRoom = getRoom(room);
        if (targetRoom) {
            // Find the user's index in the specified room
            const userIndex = targetRoom.members.findIndex(member => member.id === socket.id);
            
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
        const targetRoom = getRoom(room);
        const memberIndex = targetRoom ? targetRoom.members.findIndex(member => member.id === socket.id) : -1;
        if (!targetRoom || !targetRoom.serverStarted || memberIndex === -1 || !mapVal || mapVal.index !== memberIndex || !validChampion(mapVal.x)) {
            socket.emit('roomError', 'Unable to update that selection.');
            return;
        }
        io.to(room).emit('addChamps', mapVal);
    })

    socket.on('getTeam',(room)=>{
        
        const targetRoom = getRoom(room);
        const player = getMember(targetRoom, socket.id);
        socket.emit('returnTeamVal', player);
    })

    socket.on('getPlayerList', (room) => {
        // Check if the room exists
        const targetRoom = getRoom(room);
        if (targetRoom) {
          // Create a list of usernames from the room's members
          const rlist = targetRoom.members.map((member) => member.username);
      
      
          // Emit the list of usernames back to the client that requested it
          socket.emit('returnPlayerList', rlist);
        } else {
          // Handle the case where the room does not exist
          console.error(`Room ${room} does not exist.`);
          socket.emit('returnPlayerList', []); // Send an empty list if the room doesn't exist
        }
      });
    
    socket.on('getLockedStatus', (room) =>{
        const targetRoom = getRoom(room);
        const userIndex = targetRoom ? targetRoom.members.findIndex(member => member.id === socket.id) : -1;
        if(targetRoom && userIndex !== -1 && targetRoom.serverStarted){
            targetRoom.members[userIndex].lockedStatus = true;
            let allLocked = true
            for(let i = 0; i < targetRoom.members.length ; i++){
                if (targetRoom.members[i].lockedStatus === false){
                    allLocked = false
                }
            }
            if(allLocked){ 
                console.log('revealing all champs')
                io.to(room).emit('revealChamps')
            }
        } else {
            socket.emit('roomError', 'Unable to lock in.');
        }
    })

    socket.on("inLobby",(room) =>{
        const targetRoom = getRoom(room);
        if(targetRoom){
            const member = getMember(targetRoom, socket.id);
            if(member){
                io.to(socket.id).emit('returnLobby',true)
            }
            else{
                io.to(socket.id).emit('returnLobby',false)
            }
        } else {
            socket.emit('returnLobby', false);
        }
    })
      


});


