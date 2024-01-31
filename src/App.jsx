import { Route, Routes } from "react-router-dom"

import Navbar from "@/components/Navbar"

import Promoted from "@/pages/Promoted"
import All from "@/pages/All"
import Meta from "@/pages/Meta"
import Write from "@/pages/Write"
import Post from "@/pages/Post"
import Login from "@/pages/Login"
import TopicPage from "@/pages/TopicPage"

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
        <Route path="/topics/:id" element={<TopicPage/>}/>
        <Route path="/topics/:tid/posts/:pid" element={<Post/>}/>
        <Route path="/login" element={<Login/>}/>
      </Routes>      
    </>
  )
}

export default App
