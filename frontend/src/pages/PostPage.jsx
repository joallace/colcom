import React from "react"
import { Link, useParams, useSearchParams } from 'react-router'

import Post from "@/components/content/Post"
import CritiqueFrame from "@/components/content/Critique"
import CritiquePopover from "@/components/content/CritiquePopover"
import Modal from "@/components/primitives/Modal"
import LoadingButton from "@/components/primitives/LoadingButton"
import Spinner from "@/components/primitives/Spinner"
import useBreakpoint from "@/hooks/useBreakpoint"
import api, { ApiError } from "@/assets/api"
import useUser from "@/context/UserContext"
import { relativeTime } from "@/assets/util"
import { docFromHtml, projectCritiques, quoteFromRange } from "@/assets/anchoring"
import { groupOverlappingMarks } from "@/assets/critiqueDensity"


export default function PostPage() {
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
  // What critiques from earlier versions need to be followed here: each one's chain of versions
  // (lineages) and their texts (versions)
  const [critiqueHistory, setCritiqueHistory] = React.useState({ versions: {}, lineages: {} })
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
    if (!commit)
      return

    // Only the latest request may update the page, or a slow response could show an older version
    const request = ++latestRequest.current

    try {
      setIsLoading(true)
      const data = await api.get(`/contents/${pid}/${commit}`)

      if (data && request === latestRequest.current) {
        setPostBody(data.body)
        setBodyCommit(commit)
        setPostCritiques(data.critiques)
        setCritiqueHistory({ versions: data.versions ?? {}, lineages: data.lineages ?? {} })
        setDiffBase(data.base?.body)
        // A marked passage's positions belong to the version it was marked on
        setTempHighlight([])
      }
    }
    catch (err) {
      // A refused version leaves the one shown
      if (!(err instanceof ApiError))
        console.error(err)
    }
    finally {
      if (request === latestRequest.current)
        setIsLoading(false)
    }
  }

  // Critiques made on earlier versions are carried onto the one being read by searching for their quote
  const critiques = React.useMemo(
    () => projectCritiques(postBody, postCritiques, bodyCommit, critiqueHistory.versions, critiqueHistory.lineages),
    [postBody, postCritiques, bodyCommit, critiqueHistory]
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

  const showVersionFromUrl = React.useEffectEvent(() => {
    const history = postData?.history

    if (!history)
      return

    const commit = commitFromUrl()
    setCurrentCommit(history.findIndex(version => version.commit === commit))

    if (user !== undefined)
      fetchCommitBody(commit)
  })

  React.useEffect(() => {
    // Moves the slider to the URL's version and starts loading it; the loading state is shared with
    // the suggestion buttons, which load commits the URL doesn't name, so it can't be derived from it
    // eslint-disable-next-line react-hooks/set-state-in-effect
    showVersionFromUrl()
  }, [user, searchParams, postData.history])

  React.useEffect(() => {
    const fetchPost = async () => {
      try {
        setIsLoading(true)
        const data = await api.get(`/contents/${pid}?omit_body&include_parent_title`)

        // The version itself is loaded by the effect above, once the history is known
        if (data) {
          document.title = `${data.title} · colcom`
          setPostData(data)
        }
        else
          setIsLoading(false)
      }
      catch (err) {
        if (!(err instanceof ApiError))
          console.error(err)
        setIsLoading(false)
      }
    }

    if (user !== undefined)
      fetchPost()
  }, [pid, user])

  // showCritique holds what is open: a new critique's [from, to] selection, the index of one
  // critique, or the JSON list of overlapping critiques opened together from one highlight, in the
  // order they're shown. Only the first marks its passage as it opens.
  const isNewCritique = Array.isArray(showCritique)
  const isCritiqueGroup = typeof showCritique === "string" && showCritique.startsWith("[")
  const openCritiques = !showCritique ? [] : isCritiqueGroup ? JSON.parse(showCritique) : [showCritique]

  const renderCritique = (index, position) => (
    <CritiqueFrame
      key={isNewCritique ? "new-critique" : `critique-${index}`}
      parent_id={Number(pid)}
      interval={index}
      setShowCritique={setShowCritique}
      commit={postData?.history && postData?.history[currentCommit].commit}
      submitSignal={submitCritique}
      setSubmitSignal={setSubmitCritique}
      setCritiques={setPostCritiques}
      tempHighlight={tempHighlight}
      setTempHighlight={isLoading? null : setTempHighlight}
      isInGroup={isCritiqueGroup}
      highlightOnOpen={position === 0}
      quote={newCritiqueQuote}
      {...critiques[index]}
    />
  )

  const getPostFrame = React.useCallback(() => postTitleRef.current?.closest(".frame"), [])

  // The element marking where critiques are open (`showCritique`'s value): their highlight (a mark,
  // or a chart, which carries it as attributes), or for a removed passage its entry in the list below the post.
  // Each segment of a group lists the group in its own order, so a group opened in another order
  // (from a link) is anchored at its first segment.
  const findCritiqueAnchor = React.useCallback(value => {
    const index = CSS.escape(String(value))
    const post = getPostFrame()

    const sameGroup = () => {
      const group = JSON.parse(value)
      return [...post.querySelectorAll(`mark[data-commit-index^="["], .chart[data-commit-index^="["]`)].find(element => {
        const indexes = JSON.parse(element.dataset.commitIndex)
        return indexes.length === group.length && group.every(i => indexes.includes(i))
      })
    }

    return post?.querySelector(`mark[data-commit-index="${index}"], .chart[data-commit-index="${index}"]`)
      ?? (post && String(value).startsWith("[") ? sameGroup() : undefined)
      ?? document.querySelector(`.removedCritiques [data-critique-index="${index}"]`)
  }, [getPostFrame])

  const getCritiqueAnchor = React.useCallback(() =>
    isNewCritique ? getPostFrame()?.querySelector("mark.temporary, .chart[data-highlight=\"temporary\"]") : findCritiqueAnchor(showCritique),
  [getPostFrame, findCritiqueAnchor, isNewCritique, showCritique])

  // A link can ask for a critique to be open (?critique=<id>), e.g. from a profile or the bookmarks.
  // It opens once its version is shown and its highlight exists (the editor adds highlights just
  // after mounting), first, followed by the critiques overlapping it, which share that highlight.
  const openedFromUrl = React.useRef(null)
  React.useEffect(() => {
    const critiqueId = Number(searchParams.get("critique"))
    const index = critiques.findIndex(critique => critique.id === critiqueId)

    if (!critiqueId || isLoading || index === -1 || openedFromUrl.current === critiqueId)
      return

    const group = groupedCritiques.find(({ index: indexes }) => indexes.includes(index))
    const value = group && group.index.length > 1 ? JSON.stringify([index, ...group.index.filter(i => i !== index)]) : String(index)

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
    <div className="content wide">
      <div className="topicName">
        respondendo ao tópico
        &quot;<Link to={postData.parent_id && `/topics/${postData.parent_id}`}>{postData.parent_title}</Link>&quot;
        {postData?.config?.answer && <> com &quot;<strong>{postData.config.answer}</strong>&quot;</>}
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
        <div className="post">
          {/* The list of removed passages stays under the post, beside the critiques however long they get */}
          <div className="postColumn">
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
          </div>
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
      }
    </div>
  )
}