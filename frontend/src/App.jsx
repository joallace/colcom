import { BrowserRouter, Route, Routes, Navigate } from "react-router"

import Navbar from "@/components/layout/Navbar"
import Footer from "@/components/layout/Footer"

import TopicTree from "@/pages/TopicTree"
import Write from "@/pages/Write"
import PostPage from "@/pages/PostPage"
import Login from "@/pages/Login"
import TopicPage from "@/pages/TopicPage"
import Bookmarked from "@/pages/Bookmarked"
import Profile from "@/pages/Profile"
import Podium from "@/pages/Podium"
import Prestige from "@/pages/Prestige"
import Notifications from "@/pages/Notifications"
import TagTopics from "@/pages/TagTopics"
import Meta from "@/pages/Meta"
import ResolveSuggestion from "@/pages/ResolveSuggestion"
import Search from "@/pages/Search"
import Settings from "@/pages/Settings"

function App() {
  const loadingPage = document.getElementById("loading-page")
  loadingPage.style.display = "none"

  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<Navigate to="/promoted" />} />
        <Route path="/promoted" element={<TopicTree orderBy="promotions" />} />
        <Route path="/recent" element={<TopicTree orderBy="id" />} />
        <Route path="/podium" element={<Podium />} />
        <Route path="/prestige" element={<Prestige />} />
        <Route path="/meta" element={<Meta />} />
        <Route path="/search" element={<Search />} />
        <Route path="/bookmarked" element={<Bookmarked />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/write" element={<Write />} />
        <Route path="/topics/:id" element={<TopicPage />} />
        <Route path="/t/:tags" element={<TagTopics />} />
        <Route path="/topics/:tid/posts/:pid" element={<PostPage />} />
        <Route path="/topics/:tid/posts/:pid/suggestions/:hash" element={<ResolveSuggestion />} />
        <Route path="/login" element={<Login />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/users/:name" element={<Profile />} />
      </Routes>
      <Footer />
    </BrowserRouter>
  )
}

export default App
