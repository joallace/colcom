import { BrowserRouter, Route, Routes, Navigate, Outlet } from "react-router-dom"
import ThemeEditor from "@/components/ThemeEditor"

import Navbar from "@/components/layout/Navbar"
import Footer from "@/components/layout/Footer"

import TopicTree from "@/pages/TopicTree"
import Write from "@/pages/Write"
import PostPage from "@/pages/PostPage"
import Login from "@/pages/Login"
import TopicPage from "@/pages/TopicPage"
import Bookmarked from "@/pages/Bookmarked"

function App() {
  const loadingPage = document.getElementById("loading-page")
  loadingPage.style.display = "none"

  return (
    <BrowserRouter>
      <Navbar />
      <ThemeEditor />
        <Routes>
          <Route path="/" element={<LayoutWithOutlet />}>
          <Route path="/" element={<Navigate to="/promoted" />} />
          <Route path="/promoted" element={<TopicTree orderBy="promotions" />} />
          <Route path="/recent" element={<TopicTree orderBy="id" />} />
          <Route path="/leaderboard" element={<></>} />
          <Route path="/meta" element={<TopicTree where="meta" />} />
          <Route path="/bookmarked" element={<Bookmarked />} />
          <Route path="/write" element={<Write />} />
          <Route path="/topics/:id" element={<TopicPage />} />
          <Route path="/topics/:tid/posts/:pid" element={<PostPage />} />
          <Route path="/login" element={<Login />} />
        </Route>
        </Routes>
      <Footer />
    </BrowserRouter>
  )
}
const LayoutWithOutlet = () => <Outlet />;


export { App }

export default App
