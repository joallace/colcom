import React from "react"
import { Link, useParams } from 'react-router-dom'

import Post from "@/components/Post"
import Critique from "@/components/Critique"
import useBreakpoint from "@/hooks/useBreakpoint"
import env from "@/assets/enviroment"
import Modal from "@/components/Modal"


export default () => {
  const [postData, setPostData] = React.useState({})
  const [reset, setReset] = React.useState(false)
  const [showCritique, setShowCritique] = React.useState(false)
  const [submitCritique, setSubmitCritique] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)
  const [currentCommit, setCurrentCommit] = React.useState()
  const [startCommit, setStartCommit] = React.useState()
  const [postBody, setPostBody] = React.useState("")
  const [postCritiques, setPostCritiques] = React.useState([])
  const postTitleRef = React.useRef()
  const { tid, pid } = useParams()
  const isDesktop = useBreakpoint("md")


  const fetchCommitBody = async (commitToFetch = undefined) => {
    if (!commitToFetch && (startCommit === currentCommit))
      return

    const token = localStorage.getItem("accessToken")
    const headers = token ? { "Authorization": `Bearer ${token}` } : undefined
    const commit = commitToFetch || postData.history[currentCommit].commit
    try {
      setIsLoading(true)
      const res = await fetch(`${env.apiAddress}/contents/${pid}/${commit}?parent_id=${tid}`, { headers })
      const data = await res.json()

      if (res.ok && data) {
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
        const url = `${env.apiAddress}/contents/${pid}?omit_body&include_parent_title`
        const res = await fetch(url, { method: "get", headers })
        const data = await res.json()

        if (res.ok && data) {
          setPostData(data)
          setCurrentCommit(data.history.length - 1)
          await fetchCommitBody(data.history[data.history.length - 1].commit)
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
          <div className="topicName">
            respondendo ao tópico "<Link to={`/topics/${postData.parent_id}`}>{postData.parent_title}</Link>"{postData?.config?.answer && <> com "<strong>{postData.config.answer}</strong>"</>}
          </div>

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
              onMouseUp={() => fetchCommitBody()}
              onTouchStart={e => setStartCommit(Number(e.target.value))}
              onTouchEnd={() => fetchCommitBody()}
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
              setPostData={(data) => {
                const history = [...postData.history, { commit: data.commit, date: "agora" }]
                setPostData({ ...postData, ...data, history, commit: undefined })
                setCurrentCommit(history.length - 1)
              }}
              bubbleMenuShouldShow={currentCommit === postData?.history?.length - 1}
              resetState={[reset, setReset]}
            />
            {showCritique &&
              isDesktop ?
              <Critique
                parent_id={pid}
                interval={showCritique}
                setShowCritique={setShowCritique}
                parentRef={postTitleRef}
                commit={postData?.history && postData?.history[currentCommit].commit}
                submitSignal={submitCritique}
                setSubmitSignal={setSubmitCritique}
                setCritiques={setPostCritiques}
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
                    submitSignal={submitCritique}
                    setSubmitSignal={setSubmitCritique}
                    setCritiques={setPostCritiques}
                    {...postCritiques[showCritique]}
                  />
                </div>
                {(showCritique && showCritique.constructor === Array) &&
                  <div className="footer center">
                    <button disabled={isLoading} onClick={() => setSubmitCritique(true)}>
                      {isLoading ?
                        <><div className="button spinner"></div>publicando...</>
                        :
                        "publicar"
                      }
                    </button>
                  </div>
                }
              </Modal>
            }
          </div>
        </>
      }
    </div>
  )
}