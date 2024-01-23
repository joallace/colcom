import React from "react"
import {
  PiBookmarkSimple,
  PiBookmarkSimpleFill,
  PiArrowBendUpLeft
} from "react-icons/pi"

import Modal from "@/components/Modal"
import Topic from "@/components/Topic"
import PostSummary from "@/components/PostSummary"
import env from "@/assets/enviroment"

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

  const NoResponse = () => (
    <div className="no-response">
      Ainda não há repostas, que tal contribuir?
    </div>
  )

  React.useEffect(() => {
    const fetchPromoted = async () => {
      try {
        setIsLoading(true)
        const url = `${env.apiAddress}/contents?page=${page + 1}&pageSize=${pageSize}&orderBy="promotions"`
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