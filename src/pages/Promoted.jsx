import React from "react"
import {
  PiBookmarkSimple,
  PiBookmarkSimpleFill,
  PiArrowBendUpLeft
} from "react-icons/pi"

import Modal from "@/components/Modal"
import Topic from "@/components/Topic"
import PostSummary from "@/components/PostSummary"

const lorem = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum."

const headerConfig = {
  "answer": {
    description: "responder tópico",
    icons: PiArrowBendUpLeft,
    onClick: () => { }
  },
  "bookmark": {
    description: ["salvar tópico", "remover tópico dos salvos"],
    icons: [PiBookmarkSimple, PiBookmarkSimpleFill],
    onStart: () => false,
    onClick: () => { }
  }
}

export default function Promoted() {
  const [topics, setTopics] = React.useState([])
  const [page, setPage] = React.useState(0)
  const [pageSize, setPageSize] = React.useState(10)
  const [isLoading, setIsLoading] = React.useState(false)
  const [modalOpen, setModalOpen] = React.useState(false)
  const toggleModal = () => { setModalOpen(!modalOpen) }


  const posts = [{ id: 1, percentage: 54.5, shortAnswer: "Socialismo", summary: lorem }, { id: 2, percentage: 45.5, shortAnswer: "Capitalismo", summary: lorem }]

  const NoResponse = () => (
    <div className="no-response">
      Ainda não há repostas, que tal contribuir?
    </div>
  )

  React.useEffect(() => {
    const fetchPromoted = async () => {
      try {
        setIsLoading(true)
        const url = `http://localhost:3000/contents?page=${page + 1}&pageSize=${pageSize}&orderBy="promotions"`
        const res = await fetch(url, { method: "get" })
        const data = await res.json()

        if (Array.isArray(data))
          setTopics(data)
        else
          setTopics([])
      }
      catch (err) {
        console.error(err)
      }
      finally {
        setIsLoading(false)
      }
    }

    fetchPromoted()
  }, [])

  return (
    <div className="content">
      {
        isLoading ?
          <div className="spinner" />
          :
          topics.length > 0 ?
            topics.map(topic => (
              <Topic title={String(topic.title)} headerConfig={headerConfig} metrics>
                <NoResponse />
              </Topic>
            ))
            :
            <NoResponse />
      }
      {/* <Topic
        title="Socialismo ou Capitalismo?"
        headerConfig={headerConfig}
        style={{ paddingTop: "0.75rem" }}
        metrics
      >
        {
          posts.length > 0 ?
            posts.map(post => <PostSummary {...post} />)
            :
            <NoResponse/>
        }
      </Topic>
      <Topic
        title="Como reduzir a probreza na cidade?"
        headerConfig={headerConfig}
        style={{ padding: "2rem 0" }}
        metrics
      >
        <div className="no-response">
          Ainda não há repostas, que tal contribuir?
        </div>
      </Topic> */}
    </div>
  )
}