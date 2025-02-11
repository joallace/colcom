import React from "react"
import { Link, useParams, useSearchParams } from 'react-router-dom'

import Post from "@/components/content/Post"
import CritiqueFrame from "@/components/content/Critique"
import useBreakpoint from "@/hooks/useBreakpoint"
import env from "@/assets/enviroment"
import Modal from "@/components/primitives/Modal"
import useUser from "@/context/UserContext"
import { relativeTime } from "@/assets/util"


export default () => {
  const [postData, setPostData] = React.useState({ parent_title: "..." })
  const [reset, setReset] = React.useState(false)
  const [showCritique, setShowCritique] = React.useState(false)
  const [submitCritique, setSubmitCritique] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(true)
  const [currentCommit, setCurrentCommit] = React.useState()
  const [currentSuggestion, setCurrentSuggestion] = React.useState()
  const [startCommit, setStartCommit] = React.useState()
  const [postBody, setPostBody] = React.useState("")
  const [postCritiques, setPostCritiques] = React.useState([])
  const [tempHighlight, setTempHighlight] = React.useState([])
  const [critiquesYOffset, setCritiquesYOffset] = React.useState(0)
  const postTitleRef = React.useRef()
  const [searchParams, setSearchParams] = useSearchParams();
  const { tid, pid } = useParams()
  const { user } = useUser()
  const isDesktop = useBreakpoint("md")


  const fetchCommitBody = async (commitToFetch = undefined) => {
    const headers = user ? { "Authorization": `Bearer ${user.accessToken}` } : undefined
    const commit = commitToFetch ?? postData.history[currentCommit]?.commit

    if (!commit)
      return

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

  const updateCommitQuery = () => {
    if (currentCommit === postData?.history.length - 1) {
      if (searchParams.has("commit"))
        setSearchParams(query => {
          query.delete("commit")
          return query
        })
      return
    }

    const commit = postData.history[currentCommit].commit
    setSearchParams(query => {
      query.set("commit", commit)
      return query
    })
  }

  React.useEffect(() => {
    const history = postData?.history

    if (!history)
      return

    const commit = searchParams.get("commit")
    const index = history.findIndex(version => version.commit === commit)

    if (index > -1)
      setCurrentCommit(index)
    else
      setCurrentCommit(history.length - 1)

    if (user !== undefined)
      fetchCommitBody()
  }, [user, searchParams, postData.history])

  React.useEffect(() => {
    const fetchPost = async () => {
      const headers = user ? { "Authorization": `Bearer ${user.accessToken}` } : undefined
      try {
        setIsLoading(true)
        const url = `${env.apiAddress}/contents/${pid}?omit_body&include_parent_title`
        const res = await fetch(url, { method: "get", headers })
        const data = await res.json()

        if (res.ok && data) {
          document.title = `${data.title} · colcom`
          setPostData(data)
          const commit = data.history[data.history.length - 1].commit
          await fetchCommitBody(commit)
        }
      }
      catch (err) {
        console.error(err)
      }
      finally {
        setIsLoading(false)
      }
    }

    if (user !== undefined)
      fetchPost()
  }, [pid, user])

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
    // We test if the critique to be shown is an array,
    // then render a container with multiple critiques or only one critique
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
      <>
        <div className="topicName">
          respondendo ao tópico
          "<Link to={postData.parent_id && `/topics/${postData.parent_id}`}>{postData.parent_title}</Link>"
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
            onMouseUp={() => { if (startCommit !== currentCommit) { fetchCommitBody(); updateCommitQuery() } }}
            onTouchStart={e => setStartCommit(Number(e.target.value))}
            onTouchEnd={() => { if (startCommit !== currentCommit) { fetchCommitBody(); updateCommitQuery() } }}
            onChange={e => setCurrentCommit(Number(e.target.value))}
          />
          <datalist id="commits">
            {postData?.history?.map((commit, i) => (
              <option key={commit.commit} label={currentCommit === i ? `— ${relativeTime(commit.date)}` : "—"} />
            ))}
          </datalist>
        </div>

        {isLoading ?
          <div className="spinner" />
          :
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
                  {(showCritique && showCritique.constructor === Array) ?
                    <CritiqueFrame
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
                    <Critiques />
                  }
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
        }
      </>
    </div>
  )
}