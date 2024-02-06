import React from "react"
import { useParams } from 'react-router-dom'
import {
  PiCheck,
  PiX
} from "react-icons/pi"

import TextEditor from "@/components/TextEditor"
import Frame from "@/components/Frame"
import Post from "@/components/Post"
import env from "@/assets/enviroment"


function getSelectionHeight() {
  if (window.getSelection) {
    const selection = window.getSelection();
    if (selection.rangeCount) {
      const range = selection.getRangeAt(0).cloneRange();
      if (range.getBoundingClientRect) {
        // Sometimes, when selecting a whole paragraph, we can't get the selection rect
        // so we can just pick it from the starting container
        const rect = range.getBoundingClientRect().top ? range.getBoundingClientRect() : range.startContainer.getBoundingClientRect()
        return (rect.top + rect.bottom) / 2
      }
    }
  }
}


export default () =>{
  const [postData, setPostData] = React.useState({})
  const [showCritique, setShowCritique] = React.useState(false)
  const [critiqueTitle, setCritiqueTitle] = React.useState("")
  const [critiqueContent, setCritiqueContent] = React.useState("")
  const [critiqueHeight, setCritiqueHeight] = React.useState()
  const [critiqueYCoord, setCritiqueYCoord] = React.useState(0)
  const [isLoading, setIsLoading] = React.useState(false)
  const { pid } = useParams()

  const critiqueHeaderConfig = {
    "save": {
      description: "confirmar crítica",
      icons: PiCheck
    },
    "close": {
      description: "fechar crítica",
      icons: PiX,
      onClick: () => setShowCritique(false)
    },
  }

  React.useEffect(() => {
    if (critiqueHeight && showCritique) {
      const y = getSelectionHeight() + window.scrollY - critiqueHeight

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

        if (data)
          setPostData(data)
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
    <div className="post">
      {isLoading ?
        <div className="spinner" />
        :
        <>
          {/* <div className="topicName">respondendo ao tópico "<Link to={`/topics/${state.id}`}>{state.title}</Link>"</div> */}

          <Post
            {...postData}
            alongsideCritique={showCritique}
            setShowCritique={setShowCritique}
          />
          {showCritique &&
            <Frame
              title={critiqueTitle}
              setTitle={setCritiqueTitle}
              headerConfig={critiqueHeaderConfig}
              readOnly={false}
              isCritique
              justify
              // metrics
              style={{ transform: `translate(0,${critiqueYCoord}px)` }}
              setHeight={setCritiqueHeight}
            >
              <TextEditor content={critiqueContent} setContent={setCritiqueContent} />
            </Frame>
          }
        </>
      }
    </div>
  )
}