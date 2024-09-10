import { useEffect, useState } from "react";
import { socket } from "./SignInPage";
import { useNavigate, useParams } from "react-router-dom";
import "./lobby.css";

export const Lobby = () => {
    const { roomId } = useParams();
    const [count, setCount] = useState(1);
    const [playerNames, setPlayerNames] = useState([]);
    const [isLeader, setLeader] = useState(false);
    const navigate = useNavigate();
    const [isPlayer,setIsPlayer] = useState(true);

    useEffect(() => {
        // Request the number of players and their names when the component mounts
        socket.emit("getNumPlayers", roomId);
        socket.emit("inLobby",roomId)
        // Listen for the number of players and their names
        socket.on("returnNum", (numPlayers, users) => {
            setCount(numPlayers);
            setPlayerNames(users);
        });

        // Listen for the event to check if the user is the leader
        socket.on("isLeader", (val) => {
            setLeader(val);
        });

        // Listen for the event to navigate to the champ select screen
        socket.on("connectToChampSelect", (roomId) => {
            navigate(`/champ-select/${roomId}`);
        });

        socket.on("returnLobby",(val) => {
            setIsPlayer(val)
        })

        // Cleanup listeners when the component unmounts
        return () => {
            socket.off("returnNum");
            socket.off("isLeader");
            socket.off("connectToChampSelect");
            socket.off("returnLobby");
        };
    }, [roomId, navigate]);

    useEffect(()=>{
        if(!isPlayer){
            navigate("/")
        }
    }, )

    const handleStartClick = () => {
        navigate(`/champ-select/${roomId}`);
        socket.emit("startChampSelect", roomId);
    };

    return (
        <div className="lobby-screen">
            <h2>League of Legends Lobby</h2>
            <h2>Number of players: {count}</h2>
            <div className="grid-container">
                {playerNames.map((name, index) => (
                    <div className="grid-items" key={index}>
                        {name}
                    </div>
                ))}
            </div>
            <div className="button-container">
            <button
                className="copy-id-button"
                onClick={() => {
                    navigator.clipboard.writeText(roomId);
                }}
            >
                Copy Lobby ID
            </button>
            {isLeader && (
                <button className="start-match-button" onClick={handleStartClick}>
                    Start Match
                </button>
            )}
            </div>
            
        </div>
    );
};

export default Lobby;
