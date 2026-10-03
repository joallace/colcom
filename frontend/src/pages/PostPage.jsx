import React from "react"
import { Link, useParams, useSearchParams } from 'react-router'

import Post from "@/components/content/Post"
import CritiqueFrame from "@/components/content/Critique"
import Modal from "@/components/primitives/Modal"
import LoadingButton from "@/components/primitives/LoadingButton"
import Spinner from "@/components/primitives/Spinner"
import useBreakpoint from "@/hooks/useBreakpoint"
import env from "@/assets/enviroment"
import useUser from "@/context/UserContext"
import { relativeTime } from "@/assets/util"
import { docFromHtml, projectCritiques, quoteFromRange } from "@/assets/anchoring"


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
  const [bodyCommit, setBodyCommit] = React.useState()
  const [postCritiques, setPostCritiques] = React.useState([])
  const [tempHighlight, setTempHighlight] = React.useState([])
  const [critiquesYOffset, setCritiquesYOffset] = React.useState(0)
  const postTitleRef = React.useRef()
  const [searchParams, setSearchParams] = useSearchParams();
  const { pid } = useParams()
  const { user } = useUser()
  const isDesktop = useBreakpoint("md")


  const fetchCommitBody = async (commitToFetch = undefined) => {
    const headers = user ? { "Authorization": `Bearer ${user.accessToken}` } : undefined
    const commit = commitToFetch ?? postData.history[currentCommit]?.commit

    if (!commit)
      return

    try {
      setIsLoading(true)
      const res = await fetch(`${env.apiAddress}/contents/${pid}/${commit}`, { headers })
      const data = await res.json()

      if (res.ok && data) {
        setPostBody(data.body)
        setBodyCommit(commit)
        setPostCritiques(data.critiques)
      }
    }
    catch (err) {
      console.error(err)
    }
    finally {
      setIsLoading(false)
    }
  }

  // Overlapping critiques are drawn as a single highlight that opens all of them. A group whose
  // passage was edited since one of its critiques was made is drawn as "changed".
  function groupOverlappingMarks(critiques) {
    const marks = critiques
      .map((critique, i) => ({ ...critique.anchor, index: [i] }))
      .filter(mark => mark.match !== "removed")
      .sort((a, b) => a.from - b.from)

    const groups = []

    for (const mark of marks) {
      const current = groups.at(-1)

      if (current && mark.from < current.to) {
        current.to = Math.max(current.to, mark.to)
        current.index.push(mark.index[0])
        current.changed ||= mark.match === "fuzzy"
      }
      else
        groups.push({ ...mark, index: [...mark.index], changed: mark.match === "fuzzy" })
    }

    return groups.map(({ from, to, index, changed }) => ({ from, to, index, type: changed ? "changed" : "definitive" }))
  }

  // Critiques made on earlier versions are carried onto the one being read by searching for their quote
  const critiques = React.useMemo(
    () => projectCritiques(postBody, postCritiques, bodyCommit),
    [postBody, postCritiques, bodyCommit]
  )
  const groupedCritiques = React.useMemo(() => groupOverlappingMarks(critiques), [critiques])
  const removedCritiques = critiques
    .map((critique, index) => ({ critique, index }))
    .filter(({ critique }) => critique.anchor.match === "removed")

  // The quote a critique being written will store, taken from the selection on the version being read
  const newCritiqueQuote = React.useMemo(
    () => Array.isArray(showCritique) ? quoteFromRange(docFromHtml(postBody), ...showCritique) : undefined,
    [showCritique, postBody]
  )

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
      quote={newCritiqueQuote}
      {...critiques[index]}
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
          value={currentCommit ?? 0}
          disabled={showCritique || Number.isFinite(currentSuggestion)}
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
        <div className="postSpinnerWrapper">
          <Spinner/>
        </div>
        :
        <>
        <div className="post">
          <Post
            {...postData}
            fetchCommit={fetchCommitBody}
            commit={postData?.history && postData?.history[currentCommit].commit}
            currentSuggestion={currentSuggestion}
            setCurrentSuggestion={setCurrentSuggestion}
            titleRef={postTitleRef}
            body={postBody}
            critiques={critiques}
            groupedCritiques={groupedCritiques}
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
                    quote={newCritiqueQuote}
                    {...critiques[showCritique]}
                  />
                  :
                  <Critiques />
                }
              </div>
              {(showCritique && showCritique.constructor === Array) &&
                <div className="footer center">
                  <LoadingButton isLoading={isLoading} onClick={() => setSubmitCritique(true)}>
                    {isLoading ? "publicando..." : "publicar"}
                  </LoadingButton>
                </div>
              }
            </Modal>
          }
        </div>

        {removedCritiques.length > 0 &&
          <section className="removedCritiques">
            <h3>Críticas a trechos removidos do texto</h3>
            <ul>
              {removedCritiques.map(({ critique, index }) =>
                <li key={critique.id}>
                  <button onClick={() => setShowCritique(String(index))}>{critique.title}</button>
                  <span>por {critique.author}</span>
                </li>
              )}
            </ul>
          </section>
        }
        </>
      }
    </div>
  )
}