import { Route, Routes } from "react-router-dom"

import Navbar from './components/Navbar'

import Promoted from './pages/Promoted'
import All from "./pages/All"
import Meta from "./pages/Meta"

function App() {
  return (
    <>
      <Navbar/>
      <Routes>
        <Route path="/" element={<>Oi</>}/>
        <Route path="/promoted" element={<Promoted/>}/>
        <Route path="/all" element={<All/>}/>
        <Route path="/meta" element={<Meta/>}/>
      </Routes>      
    </>
  )
}

export default App
