import {BrowserRouter, Routes, Route} from 'react-router-dom'
import {Homepage} from './pages/homepage'
import {SignInPage} from './pages/SignInPage'
import { Lobby } from './pages/lobby'

export const RoutesComp = () => {
    return(
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<SignInPage/>}/>
                <Route path="/champ-select/:roomId" element={<Homepage/>}/>
                <Route path = "/lobby/:roomId" element = {<Lobby/>}/>
            </Routes>
        </BrowserRouter>
    )
}