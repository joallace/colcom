import React from "react"
import { Link, useParams, useSearchParams } from 'react-router'

import Post from "@/components/content/Post"
import CritiqueFrame from "@/components/content/Critique"
import CritiquePopover from "@/components/content/CritiquePopover"
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
  const [critiqueVersions, setCritiqueVersions] = React.useState({})
  // For a suggestion, the text of the version it was made on, to highlight what it changes
  const [diffBase, setDiffBase] = React.useState()
  const latestRequest = React.useRef(0)
  const [tempHighlight, setTempHighlight] = React.useState([])
  const postTitleRef = React.useRef()
  const [searchParams, setSearchParams] = useSearchParams();
  const { pid } = useParams()
  const { user } = useUser()
  const isDesktop = useBreakpoint("md")


  // The version the URL asks for (?commit=), or the latest one. The URL is the single source of
  // truth for which version is shown: the slider and the critiques' links only change the URL.
  const commitFromUrl = () => {
    const history = postData?.history
    if (!history?.length)
      return

    const commit = searchParams.get("commit")
    return history.some(version => version.commit === commit) ? commit : history.at(-1).commit
  }

  const fetchCommitBody = async (commit = commitFromUrl()) => {
    const headers = user ? { "Authorization": `Bearer ${user.accessToken}` } : undefined

    if (!commit)
      return

    // Only the latest request may update the page, or a slow response could show an older version
    const request = ++latestRequest.current

    try {
      setIsLoading(true)
      const res = await fetch(`${env.apiAddress}/contents/${pid}/${commit}`, { headers })
      const data = await res.json()

      if (res.ok && data && request === latestRequest.current) {
        setPostBody(data.body)
        setBodyCommit(commit)
        setPostCritiques(data.critiques)
        setCritiqueVersions(data.versions ?? {})
        setDiffBase(data.base?.body)
      }
    }
    catch (err) {
      console.error(err)
    }
    finally {
      if (request === latestRequest.current)
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
    () => projectCritiques(postBody, postCritiques, bodyCommit, critiqueVersions),
    [postBody, postCritiques, bodyCommit, critiqueVersions]
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

    const commit = commitFromUrl()
    setCurrentCommit(history.findIndex(version => version.commit === commit))

    if (user !== undefined)
      fetchCommitBody(commit)
  }, [user, searchParams, postData.history])

  React.useEffect(() => {
    const fetchPost = async () => {
      const headers = user ? { "Authorization": `Bearer ${user.accessToken}` } : undefined
      try {
        setIsLoading(true)
        const url = `${env.apiAddress}/contents/${pid}?omit_body&include_parent_title`
        const res = await fetch(url, { method: "get", headers })
        const data = await res.json()

        // The version itself is loaded by the effect above, once the history is known
        if (res.ok && data) {
          document.title = `${data.title} · colcom`
          setPostData(data)
        }
        else
          setIsLoading(false)
      }
      catch (err) {
        console.error(err)
        setIsLoading(false)
      }
    }

    if (user !== undefined)
      fetchPost()
  }, [pid, user])

  // showCritique holds what is open: a new critique's [from, to] selection, the index of one
  // critique, or the JSON list of overlapping critiques opened together from one highlight
  const isNewCritique = Array.isArray(showCritique)
  const isCritiqueGroup = typeof showCritique === "string" && showCritique.startsWith("[")
  const openCritiques = !showCritique ? [] : isCritiqueGroup ? JSON.parse(showCritique) : [showCritique]

  const renderCritique = index => (
    <CritiqueFrame
      key={isNewCritique ? "new-critique" : `critique-${index}`}
      parent_id={pid}
      interval={index}
      setShowCritique={setShowCritique}
      commit={postData?.history && postData?.history[currentCommit].commit}
      submitSignal={submitCritique}
      setSubmitSignal={setSubmitCritique}
      setCritiques={setPostCritiques}
      tempHighlight={tempHighlight}
      // Only a group offers highlighting each critique's own passage
      setTempHighlight={isCritiqueGroup ? setTempHighlight : undefined}
      quote={newCritiqueQuote}
      {...critiques[index]}
    />
  )

  const getPostFrame = React.useCallback(() => postTitleRef.current?.closest(".frame"), [])

  // The element marking where critiques are open (`showCritique`'s value): their highlight, or for a
  // removed passage its entry in the list below the post
  const findCritiqueAnchor = React.useCallback(value =>
    getPostFrame()?.querySelector(`mark[data-commit-index="${CSS.escape(String(value))}"]`)
    ?? document.querySelector(`.removedCritiques [data-critique-index="${CSS.escape(String(value))}"]`),
  [getPostFrame])

  const getCritiqueAnchor = React.useCallback(() =>
    isNewCritique ? getPostFrame()?.querySelector("mark.temporary") : findCritiqueAnchor(showCritique),
  [getPostFrame, findCritiqueAnchor, isNewCritique, showCritique])

  // A link can ask for a critique to be open (?critique=<id>), e.g. from a profile or the bookmarks.
  // It opens once its version is shown and its highlight exists (the editor adds highlights just
  // after mounting), together with the critiques overlapping it, which share that highlight.
  const openedFromUrl = React.useRef(null)
  React.useEffect(() => {
    const critiqueId = Number(searchParams.get("critique"))
    const index = critiques.findIndex(critique => critique.id === critiqueId)

    if (!critiqueId || isLoading || index === -1 || openedFromUrl.current === critiqueId)
      return

    const group = groupedCritiques.find(({ index: indexes }) => indexes.includes(index))
    const value = group && group.index.length > 1 ? JSON.stringify(group.index) : String(index)

    let frame, attempts = 0
    const open = () => {
      const anchor = findCritiqueAnchor(value)
      if (!anchor && attempts++ < 60) {
        frame = requestAnimationFrame(open)
        return
      }

      openedFromUrl.current = critiqueId
      setShowCritique(value)
      anchor?.scrollIntoView({ block: "center" })
    }

    open()
    return () => cancelAnimationFrame(frame)
  }, [searchParams, critiques, groupedCritiques, isLoading, findCritiqueAnchor])

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
          onMouseUp={() => { if (startCommit !== currentCommit) updateCommitQuery() }}
          onTouchStart={e => setStartCommit(Number(e.target.value))}
          onTouchEnd={() => { if (startCommit !== currentCommit) updateCommitQuery() }}
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
            diffBase={diffBase}
            resetState={[reset, setReset]}
          />
          {showCritique &&
            isDesktop ?
            // Holds the critiques' width in the layout; the popover itself is positioned beside the post
            <div className="critiques">
              <CritiquePopover getPost={getPostFrame} getAnchor={getCritiqueAnchor}>
                {openCritiques.map(renderCritique)}
              </CritiquePopover>
            </div>
            :
            <Modal
              isOpen={showCritique}
              setIsOpen={setShowCritique}
            >
              <div className="body">
                {openCritiques.map(renderCritique)}
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
                  <button data-critique-index={index} onClick={() => setShowCritique(String(index))}>{critique.title}</button>
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