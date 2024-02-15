import { Route, Routes, Navigate } from "react-router-dom"

import Navbar from "@/components/Navbar"

import TopicTree from "@/pages/TopicTree"
import All from "@/pages/All"
import Meta from "@/pages/Meta"
import Write from "@/pages/Write"
import PostPage from "@/pages/PostPage"
import Login from "@/pages/Login"
import TopicPage from "@/pages/TopicPage"

function App() {
  return (
    <>
      <Navbar/>
      <Routes>
        <Route path="/" element={<Navigate to="/promoted"/>}/>
        <Route path="/promoted" element={<TopicTree orderBy="promotions"/>}/>
        <Route path="/bookmarked" element={<TopicTree where="bookmark"/>}/>
        <Route path="/all" element={<TopicTree orderBy="id"/>}/>
        <Route path="/meta" element={<TopicTree where="meta"/>}/>
        <Route path="/write" element={<Write/>}/>
        <Route path="/topics/:id" element={<TopicPage/>}/>
        <Route path="/topics/:tid/posts/:pid" element={<PostPage/>}/>
        <Route path="/login" element={<Login/>}/>
      </Routes>      
    </>
  )
}

export default App
