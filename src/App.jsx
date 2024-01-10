import { Route, Routes } from "react-router-dom"

import Navbar from "@/components/Navbar"

import Promoted from "@/pages/Promoted"
import All from "@/pages/All"
import Meta from "@/pages/Meta"
import Write from "@/pages/Write"
import Post from "@/pages/Post"

function App() {
  return (
    <>
      <Navbar/>
      <Routes>
        <Route path="/" element={<>Oi</>}/>
        <Route path="/promoted" element={<Promoted/>}/>
        <Route path="/all" element={<All/>}/>
        <Route path="/meta" element={<Meta/>}/>
        <Route path="/write" element={<Write/>}/>
        <Route path="/post/:id" element={<Post/>}/>
      </Routes>      
    </>
  )
}

export default App
