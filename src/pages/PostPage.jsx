import React from "react"
import { useNavigate, useParams } from 'react-router-dom'
import {
  PiCheck,
  PiX
} from "react-icons/pi"

import TextEditor from "@/components/TextEditor"
import Frame from "@/components/Frame"
import Post from "@/components/Post"
import useScreenSize from "@/hooks/useScreenSize"
import env from "@/assets/enviroment"
import Modal from "@/components/Modal"


function getSelectionHeight() {
  if (window.getSelection) {
    const selection = window.getSelection()
    if (selection.rangeCount) {
      const range = selection.getRangeAt(0).cloneRange()
      if (range.getBoundingClientRect) {
        // Sometimes, when selecting a whole paragraph, we can't get the selection rect
        // so we can just pick it from the starting container
        const rect = range.getBoundingClientRect().top ? range.getBoundingClientRect() : range.startContainer.getBoundingClientRect()
        return (rect.top + rect.bottom) / 2
      }
    }
  }
}


export default () => {
  const [postData, setPostData] = React.useState({})
  const [showCritique, setShowCritique] = React.useState(false)
  const [critiqueContent, setCritiqueContent] = React.useState("")
  const [critiqueHeight, setCritiqueHeight] = React.useState()
  const [critiqueYCoord, setCritiqueYCoord] = React.useState(0)
  const [isLoading, setIsLoading] = React.useState(false)
  const [currentCommit, setCurrentCommit] = React.useState()
  const [startCommit, setStartCommit] = React.useState()
  const [postBody, setPostBody] = React.useState("")
  const [postCritiques, setPostCritiques] = React.useState([])
  const postTitleRef = React.useRef()
  const critiqueTitleRef = React.useRef()
  const navigate = useNavigate()
  const { pid } = useParams()
  const isDesktop = useScreenSize("md")


  const submitCritique = async () => {
    const title = critiqueTitleRef?.current.textContent
    const commit = postData.history[currentCommit].commit
    const [from, to] = showCritique

    if (!title || !critiqueContent || !from || !to || !commit) {
      setError(true)
      return
    }

    const token = localStorage.getItem("accessToken")
    if (!token) {
      navigate("/login")
      return
    }

    try {
      const url = `${env.apiAddress}/contents`

      const res = await fetch(url, {
        method: "post",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ title, body: critiqueContent, config: { from, to, commit }, parent_id: pid })
      })

      const data = await res.json()

      if (res.status >= 400) {
        setGlobalError(data.message.toLowerCase())
        return
      }
    }
    catch (err) {
      console.error(err)
    }
  }

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

  const critiqueHeaderConfig = {
    "save": {
      description: "confirmar crítica",
      icons: PiCheck,
      onClick: () => submitCritique()
    },
    "close": {
      description: "fechar crítica",
      icons: PiX,
      onClick: () => setShowCritique(false)
    },
  }


  React.useEffect(() => {
    if (critiqueHeight && showCritique) {
      const y = getSelectionHeight() + window.scrollY - critiqueHeight - postTitleRef?.current.offsetTop

      setCritiqueYCoord(y)
      window.scrollTo({ top: y, behavior: "smooth" })
    }
  }, [critiqueHeight, showCritique])

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

  const Critique = ({ data }) => (
    <Frame
      headerConfig={isDesktop ? critiqueHeaderConfig : undefined}
      readOnly={false}
      isCritique
      justify
      titleRef={critiqueTitleRef}
      // metrics
      style={{ transform: isDesktop ? `translate(0,${critiqueYCoord}px)` : undefined, width: isDesktop ? undefined : "100%" }}
      setHeight={setCritiqueHeight}
    >
      <TextEditor content={critiqueContent} setContent={setCritiqueContent} />
    </Frame>
  )

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
              <Critique />
              :
              <Modal
                isOpen={showCritique}
                setIsOpen={setShowCritique}
                style={{ width: "90%" }}
              >
                <div className="body">
                  <Critique />
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