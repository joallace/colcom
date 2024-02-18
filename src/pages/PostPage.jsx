import React from "react"
import { useParams } from 'react-router-dom'

import Post from "@/components/Post"
import Critique from "@/components/Critique"
import useBreakpoint from "@/hooks/useBreakpoint"
import env from "@/assets/enviroment"
import Modal from "@/components/Modal"


export default () => {
  const [postData, setPostData] = React.useState({})
  const [showCritique, setShowCritique] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)
  const [currentCommit, setCurrentCommit] = React.useState()
  const [startCommit, setStartCommit] = React.useState()
  const [postBody, setPostBody] = React.useState("")
  const [postCritiques, setPostCritiques] = React.useState([])
  const postTitleRef = React.useRef()
  const { pid } = useParams()
  const isDesktop = useBreakpoint("md")


  const fetchCommitBody = async () => {
    if (startCommit === currentCommit)
      return

    const commit = postData.history[currentCommit].commit
    try {
      setIsLoading(true)
      const res = await fetch(`${env.apiAddress}/contents/${pid}/${commit}`)
      const data = await res.json()

      if (res.ok) {
        setPostBody(data.body)
        setPostCritiques(data.children)
      }
    }
    catch (err) {
      console.error(err)
    }
    finally {
      setIsLoading(false)
    }
  }


  React.useEffect(() => {
    const fetchPost = async () => {
      const token = localStorage.getItem("accessToken")
      const headers = token ? { "Authorization": `Bearer ${token}` } : undefined
      try {
        setIsLoading(true)
        const url = `${env.apiAddress}/contents/${pid}`
        const res = await fetch(url, { method: "get", headers })
        const data = await res.json()

        if (data) {
          setPostData({ ...data, body: undefined })
          setPostBody(data.body)
          setCurrentCommit(data.history.length - 1)
        }
      }
      catch (err) {
        console.error(err)
      }
      finally {
        setIsLoading(false)
      }
    }

    fetchPost()
  }, [])


  return (
    <div className="content">
      {isLoading ?
        <div className="spinner" />
        :
        <>
          {/* <div className="topicName">respondendo ao tópico "<Link to={`/topics/${state.id}`}>{state.title}</Link>"</div> */}
          <div className="timerSlider">
            <input
              type="range"
              id="commit"
              list="commits"
              min={0}
              max={postData?.history?.length - 1 || 0}
              value={currentCommit}
              disabled={showCritique}
              onMouseDown={e => setStartCommit(Number(e.target.value))}
              onMouseUp={fetchCommitBody}
              onTouchStart={e => setStartCommit(Number(e.target.value))}
              onTouchEnd={fetchCommitBody}
              onChange={e => setCurrentCommit(Number(e.target.value))}
            />
            <datalist id="commits">
              {postData?.history?.map((commit, i) => (
                <option key={commit.commit} label={currentCommit === i ? `— ${commit.date}` : "—"} />
              ))}
            </datalist>
          </div>
          <div className="post">
            <Post
              {...postData}
              titleRef={postTitleRef}
              body={postBody}
              critiques={postCritiques}
              alongsideCritique={showCritique}
              setShowCritique={setShowCritique}
              bubbleMenuShouldShow={currentCommit === postData?.history?.length - 1}
            />
            {showCritique &&
              isDesktop ?
              <Critique
                parent_id={pid}
                interval={showCritique}
                setShowCritique={setShowCritique}
                parentRef={postTitleRef}
                commit={postData?.history && postData?.history[currentCommit].commit}
                {...postCritiques[showCritique]}
              />
              :
              <Modal
                isOpen={showCritique}
                setIsOpen={setShowCritique}
              >
                <div className="body">
                  <Critique
                    parent_id={pid}
                    interval={showCritique}
                    setShowCritique={setShowCritique}
                    parentRef={postTitleRef}
                    commit={postData?.history && postData?.history[currentCommit].commit}
                    {...postCritiques[showCritique]}
                  />
                </div>
                <div className="footer center">
                  <button>publicar</button>
                </div>
              </Modal>
            }
          </div>
        </>
      }
    </div>
  )
}