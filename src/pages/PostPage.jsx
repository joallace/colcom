import React from "react"
import { Link, useParams } from 'react-router-dom'

import Post from "@/components/Post"
import CritiqueFrame from "@/components/Critique"
import useBreakpoint from "@/hooks/useBreakpoint"
import env from "@/assets/enviroment"
import Modal from "@/components/primitives/Modal"
import useUser from "@/context/UserContext"
import { relativeTime } from "@/assets/util"


export default () => {
  const [postData, setPostData] = React.useState({})
  const [reset, setReset] = React.useState(false)
  const [showCritique, setShowCritique] = React.useState(false)
  const [submitCritique, setSubmitCritique] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)
  const [currentCommit, setCurrentCommit] = React.useState()
  const [currentSuggestion, setCurrentSuggestion] = React.useState()
  const [startCommit, setStartCommit] = React.useState()
  const [postBody, setPostBody] = React.useState("")
  const [postCritiques, setPostCritiques] = React.useState([])
  const [tempHighlight, setTempHighlight] = React.useState([])
  const [critiquesYOffset, setCritiquesYOffset] = React.useState(0)
  const postTitleRef = React.useRef()
  const { tid, pid } = useParams()
  const { user } = useUser()
  const isDesktop = useBreakpoint("md")


  const fetchCommitBody = async (commitToFetch = undefined) => {
    if (!commitToFetch && (startCommit === currentCommit))
      return

    const headers = user ? { "Authorization": `Bearer ${user.accessToken}` } : undefined
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

  function groupOverlappingMarks(marks) {
    marks = marks.map((v, i) => ({ from: v.config.from, to: v.config.to, index: [i] }))
      .sort((a, b) => a.from - b.from)

    const groupedMarks = []

    let currentMark = null
    let previousMark = null

    marks.forEach(mark => {
      if (!currentMark || mark.from >= previousMark.to) {
        if (previousMark)
          groupedMarks.push(previousMark)
        currentMark = mark
      } else {
        currentMark.to = Math.max(currentMark.to, mark.to)
        currentMark.index.push(mark.index[0])
      }
      previousMark = currentMark
    })

    if (currentMark)
      groupedMarks.push(currentMark)

    return groupedMarks
  }

  React.useEffect(() => {
    const fetchPost = async () => {
      const headers = user ? { "Authorization": `Bearer ${user.accessToken}` } : undefined
      try {
        setIsLoading(true)
        const url = `${env.apiAddress}/contents/${pid}?omit_body&include_parent_title`
        const res = await fetch(url, { method: "get", headers })
        const data = await res.json()

        if (res.ok && data) {
          setPostData(data)
          document.title = `${data.title} · colcom`
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
  }, [pid])

  const Critique = ({ index, setOffset, skipOffset, setHighlight }) => (
    <CritiqueFrame
      parent_id={pid}
      interval={index}
      setShowCritique={setShowCritique}
      parentRef={postTitleRef}
      commit={postData?.history && postData?.history[currentCommit].commit}
      submitSignal={submitCritique}
      setSubmitSignal={setSubmitCritique}
      setCritiques={setPostCritiques}
      tempHighlight={tempHighlight}
      setTempHighlight={setHighlight}
      setOffset={setOffset}
      skipOffset={skipOffset}
      {...postCritiques[index]}
    />
  )

  const Critiques = () => {
    if (showCritique[0] === "[") {
      return (
        <div className="critiques" style={{ transform: `translate(0,${critiquesYOffset}px)` }}>
          {
            JSON.parse(showCritique).map((index, i) =>
              <Critique
                key={`critique-${index}`}
                index={index}
                setOffset={i === 0 ? setCritiquesYOffset : undefined}
                skipOffset={i !== 0}
                setHighlight={setTempHighlight}
              />
            )
          }
        </div>
      )
    }
    else
      return <Critique index={showCritique} />
  }


  return (
    <div className="content">
      {isLoading ?
        <div className="spinner" />
        :
        <>
          <div className="topicName">
            respondendo ao tópico
            "<Link to={`/topics/${postData.parent_id}`}>{postData.parent_title}</Link>"
            {postData?.config?.answer && <> com "<strong style={{ color: "white" }}>{postData.config.answer}</strong>"</>}
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
                <option key={commit.commit} label={currentCommit === i ? `— ${relativeTime(commit.date)}` : "—"} />
              ))}
            </datalist>
          </div>

          <div className="post">
            <Post
              {...postData}
              fetchCommit={fetchCommitBody}
              commit={postData?.history && postData?.history[currentCommit].commit}
              currentSuggestion={currentSuggestion}
              setCurrentSuggestion={setCurrentSuggestion}
              titleRef={postTitleRef}
              body={postBody}
              critiques={postCritiques}
              groupedCritiques={groupOverlappingMarks(postCritiques)}
              alongsideCritique={showCritique}
              setShowCritique={setShowCritique}
              setPostData={setPostData}
              updatePostData={(data) => {
                const history = [...postData.history, { commit: data.commit, date: new Date().getTime() }]
                setPostData({ ...postData, ...data, history, commit: undefined })
                setCurrentCommit(history.length - 1)
              }}
              bubbleMenuShouldShow={currentCommit === postData?.history?.length - 1 && !Number.isFinite(currentSuggestion)}
              tempHighlight={tempHighlight}
              resetState={[reset, setReset]}
            />
            {showCritique &&
              isDesktop ?
              <Critiques />
              :
              <Modal
                isOpen={showCritique}
                setIsOpen={setShowCritique}
              >
                <div className="body">
                  <Critiques />
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