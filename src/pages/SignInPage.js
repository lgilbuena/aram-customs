import React, { useEffect, useState } from 'react'; 
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import './signin.css'
export const socket = io('http://localhost:5000');
export const SignInPage = () => {
    const [lobbyCode, setLobbyCode] = useState("")
    const [username,setUsername] = useState("")
    const [errorMessage, setErrorMessage] = useState(""); // State for error message
    const navigate = useNavigate();
    useEffect(() => {
        // Listen for the 'roomCreated' event and navigate to the specific room page
        socket.on('roomCreated', (roomName) => {
            navigate(`/lobby/${roomName}`);
        });
        
        socket.on('joinedRoom', (roomName) =>{
            navigate(`/lobby/${roomName}`);
        })

        // Cleanup listener when the component unmounts
        return () => {
            socket.off('roomCreated');
        };
    }, [navigate]);

    const createRoom = () => {
        if (!username.trim()) {
            setErrorMessage("Username is required!"); // Show error if username is empty
            return;
        }
        setErrorMessage(""); // Clear any previous error messages
        console.log('room created!');
        socket.emit('createRoom', username);
    };

    const joinRoom = () => {
        if (!username.trim()) {
            setErrorMessage("Username is required!"); // Show error if username is empty
            return;
        }
        if (lobbyCode.trim()) {
            setErrorMessage(""); // Clear any previous error messages
            console.log(username, `joining room with code:`, lobbyCode);
            socket.emit('joinRoom', lobbyCode, username);
        }
    };

    const handleChange = (event) => {
        setLobbyCode(event.target.value);
    };
    const handleUserChange = (event) => {
        setUsername(event.target.value);
    };

    return (
        <div className='signin'>
            <div className='signin-card'>
                <h1 className='title'>
                    Custom ARAM Lobby Maker
                </h1>

                <input 
                    className='username-input'
                    type="text"
                    value={username}
                    onChange={handleUserChange}
                    placeholder='Enter username'
                />
                {errorMessage && <p style={{ color: 'red' }}>{errorMessage}</p>}
                <button
                    className='create-button' 
                    onClick={createRoom}>
                    Create Room
                </button>
                <input
                    className='lobby-input' 
                    type="password"
                    value={lobbyCode}
                    onChange={handleChange}
                    placeholder='Enter lobby code'
                />
                <button
                    className='join-button' 
                    onClick={joinRoom}>
                    Join Room
                </button>
            </div>
            
            
        </div>
    );
};

export default SignInPage;
