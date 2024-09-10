// App.js
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './homepage.css'
import { useNavigate, useParams } from "react-router-dom";
import { socket } from './SignInPage';

// const socket = io('http://localhost:5000');

export const Homepage = () => {
  
  const [champions, setChampions] = useState([]);
  const [displayedChampions, setDisplayedChampions] = useState([]);
  const [displayedChampions1, setDisplayedChampions1] = useState([]); // State for displayed champions
  const [rollCount, setRollCount] = useState(0); // Number of rolls performed
  const [canRoll, setCanRoll] = useState(true); // Whether the user can roll
  const [numPlayers,setNumPlayers] = useState(1);
  const {roomId} = useParams();
  const [idx,setIdx] = useState(-1);
  const [playerChampMap, setPlayerChampMap] = useState({})
  const [playerVal,setPlayerVal] = useState({})
  const [playerNameList,setPlayerNameList] = useState([])
  const [essentialsCalled, setEssentialsCalled] = useState(false);
  const [lockedIn,setLockedIn] = useState(false)
  const [revealState, setRevealState] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (!essentialsCalled) {
      function callEssentials() {
        socket.emit('getNumPlayers', roomId);
        socket.emit('getIndex', roomId);
        socket.emit('getPlayerList', roomId);
        socket.emit('getTeam', roomId);
      }
  
      callEssentials();
      setEssentialsCalled(true);
    }
  
    socket.on('returnTeamVal', (val) => {
      setPlayerVal(val);
    });
  
    // Other socket event handlers and cleanup
  }, [roomId, essentialsCalled]);

  useEffect(() => {
    socket.on('championSelected', (champ, teamval) => {
      console.log(`Received! ${champ.id}! Sending to team`, teamval);
      console.log(playerVal.team, teamval);
  
      if (playerVal.team === teamval) {
        if (playerVal.team === 1) {
          // Update state for team 1
          setDisplayedChampions(prev => {
            const updated = addUniqueChampion(champ, prev);
            console.log('Updated displayedChampions:', updated); // Log the updated state here
            return updated;
          });
        } else if (playerVal.team === 2) {
          // Update state for team 2
          setDisplayedChampions1(prev => {
            const updated = addUniqueChampion(champ, prev);
            console.log('Updated displayedChampions1:', updated); // Log the updated state here
            return updated;
          });
        }
      } else {
        socket.emit('getTeam', roomId);
      }
    });
  
    return () => {
      socket.off('championSelected');
    };
  }, [playerVal]);
  
  // Function to add a unique champion
  const addUniqueChampion = (newChampion, currentList) => {
    // Check if the new champion already exists in the current list
    if (!currentList.some(champ => champ.id === newChampion.id)) {
      return [...currentList, newChampion]; // Add the new champion if it's unique
    }
    return currentList; // Return the current list if the champion is already present
  };
  

  useEffect(() => {

    socket.on('returnTeamVal',(val)=>{
      if(val === null){
        navigate('/')
      }
      setPlayerVal(val)
    })
    const fetchChampions = async () => {
      try {
        const response = await axios.get('https://aram-customs.onrender.com/api/champions'); // Your backend URL
        const championsArray = Object.values(response.data); // Convert object to array
        setChampions(championsArray);

        // Display one random champion on initial load
        selectRandomChampion(championsArray);
      } catch (error) {
        console.error('Error fetching champions:', error);
      }
    };

    fetchChampions();
    
    

    
    

    socket.on('returnNum',(playerCount,users) =>{
      setNumPlayers(playerCount)
      let newPlayerChampMap = {};
      for(let i = 0; i < playerCount; i++){
        newPlayerChampMap[i] = null;
      }
      setPlayerChampMap(newPlayerChampMap)
    })
    
    socket.on('returnIndex',(myIdx)=>{
      setIdx(myIdx)
    })

    socket.on('addChamps',(val)=>{
      
      setPlayerChampMap(prevMap => {
        const newMap = { ...prevMap, [val.index]: val.x };
        return newMap;
      });
      
    })

    socket.on('returnPlayerList',(val)=>{
      setPlayerNameList(val)
    })

    socket.on('revealChamps', () => {
      setRevealState(true)
    })
    

   

    return () => {
      socket.off('championSelected');
      socket.off('returnNum')
      socket.off('returnIndex')
      socket.off('returnTeamVal')
    };

    
  }, [roomId]);


  // Function to select a random champion excluding the ones already displayed
  const selectRandomChampion = (excludeChampions = []) => {
    
    if (champions.length === 0) return;

    // Exclude already displayed champions
    const excludedIds = excludeChampions.map(champ => champ.id);
    const filteredChampions = champions.filter(champ => !excludedIds.includes(champ.id));

    if (filteredChampions.length === 0) return; // No more champions to add

    // Select a new random champion
    const randomIndex = Math.floor(Math.random() * filteredChampions.length);
    const newChampion = filteredChampions[randomIndex];
    
    // Add the new champion to the displayed list
    if (playerVal.team === 1) {
      setDisplayedChampions(prev => [...prev, newChampion]);

    } 
    if (playerVal.team === 2) {
      setDisplayedChampions1(prev => [...prev, newChampion]);
    }
    socket.emit('selectChampion',roomId,newChampion,playerVal.team)
  };

  function handleClickedChamp(x) {
    
    // Use the setPlayerChampMap function to correctly update the state
    let hovered = false
    for(const i in playerChampMap){
      if(playerChampMap[i] !== null && playerChampMap[i].id===x.id){
        hovered = true
      }
    }
    if(!lockedIn){
      
      
      if(!hovered){
      setPlayerChampMap(prevMap => {
        const newMap = { ...prevMap, [idx]: x };
        socket.emit('updateChampMap', roomId, { index:idx, x });
        return newMap;
    })}};
}


  const handleRoll = () => {
    if(playerVal.team===1){
      if (rollCount < 2) {
        // First two rolls are free
        selectRandomChampion(displayedChampions);
        setRollCount(prev => prev + 1);
      } else if (Math.random() < 0.49) {
        // 50% chance of failing to roll after two free rolls
        alert('Out of rolls! Sorry :P');
        setCanRoll(false); // Optionally disable further rolling
      } else {
        // Roll succeeded
        selectRandomChampion(displayedChampions);
        setRollCount(prev => prev + 1);
      }
    }
    else{
      if (rollCount < 2) {
        // First two rolls are free
        selectRandomChampion(displayedChampions1);
        setRollCount(prev => prev + 1);
      } else if (Math.random() < 0.49) {
        // 50% chance of failing to roll after two free rolls
        alert('Out of rolls! Sorry :P');
        setCanRoll(false); // Optionally disable further rolling
      } else {
        // Roll succeeded
        selectRandomChampion(displayedChampions1);
        setRollCount(prev => prev + 1);
      }
    }
  };

  const renderPlayers1 = () => {
    
    return Array.from({ length: Math.ceil(numPlayers / 2) }, (_, i) => {
      // Get the champion from the map
      const index = i*2
      const champion = playerChampMap[index];
      const playerName = playerNameList[index]
  
      // Render the player div
      return (
        <div key={index * 2} className='player'>
          {playerName}
          {(champion && playerVal.team===1) || (champion && revealState && playerVal.team === 2)? (
            <div className='player-champion'>
              <img
                src={`https://ddragon.leagueoflegends.com/cdn/14.17.1/img/champion/${champion.image.full}`}
                alt={champion.name}
                className="player-champ-image"
              />
              <div className="player-champ-name">{champion.name}</div> {/* Optional: add a class for styling the name */}
            </div>
          ) : null}
        </div>
      );
    });
  };

  const renderPlayers2 = () => {
    const numDivs = Math.ceil(numPlayers);
    
    return Array.from({ length: Math.floor(numDivs / 2) }, (_, i) => {
      // Get the champion from the map
      const index = i*2+1;
      const champion = playerChampMap[index];
      const playerName = playerNameList[index]
      // Render the player div
      return (
        <div key={index * 2} className='player'>
          {playerName}
          {(champion && playerVal.team ===2) || (champion && playerVal.team === 1 && revealState === true) ? (
            <div className='player-champion'>
              <img
                src={`https://ddragon.leagueoflegends.com/cdn/14.17.1/img/champion/${champion.image.full}`}
                alt={champion.name}
                className="player-champ-image"
              />
              <div className="player-champ-name">{champion.name}</div>
            </div>
          ) : null}
        </div>
      );
    });
  };

  const handleLockButton = () => {
    if(playerChampMap[idx] !== null){
    setLockedIn(true)
    socket.emit('getLockedStatus',roomId)}
  }
  

  return (
    <div className='App'>
      <h1>League of Legends Champions</h1>
      <div className='lobby'>
        <div className='player-list'>
          {renderPlayers1()}
          
        </div>
        <div className='champion-window'>
          <div className="champion-grid">
            {(playerVal.team === 1 ? displayedChampions : displayedChampions1).map((champion) => (
              <div key={champion.id} className="champion-card" onClick={() => handleClickedChamp(champion)}>
                <h3>{champion.name}</h3>
                <img 
                  src={`https://ddragon.leagueoflegends.com/cdn/14.17.1/img/champion/${champion.image.full}`} 
                  alt={champion.name} 
                  className="champion-image"/>
              </div>
            ))}
          </div>
          <button onClick={handleRoll} disabled={!canRoll}>Roll 🎲</button>
          <button onClick={handleLockButton} disabled={lockedIn || playerChampMap[idx] === null}>Lock in</button>
        </div>
        <div className='player-list'>
        {renderPlayers2()}
        </div>
      </div>
    </div>
  );
}

