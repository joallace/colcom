import React from "react"
import { PiTag, PiThumbsDown, PiThumbsDownFill, PiThumbsUp, PiThumbsUpFill } from "react-icons/pi"

import Popover from "@/components/primitives/Popover"
import TagPill from "@/components/content/TagPill"
import TagInput from "@/components/content/TagInput"
import { TAG_RULE, VISIBLE_TAGS, voteOnTag } from "@/assets/tags"
import useUser from "@/context/UserContext"
import useToLogin from "@/hooks/useToLogin"


// One empty list, so a topic without tags doesn't look like new tags on every render
const NO_TAGS = []

const plural = (count, singular, plural) => `${count} ${count === 1 ? singular : plural}`

// Every tag proposed on the topic with its votes, buttons to endorse or contest each (pressing the
// active one withdraws the vote) and a field to propose another
function TagCuration({ topicId, tags, setTags }) {
  const { user } = useUser()
  const toLogin = useToLogin()
  const [error, setError] = React.useState("")
  const [pending, setPending] = React.useState(false)

  const vote = async (name, value) => {
    if (!user) {
      toLogin()
      return
    }

    setPending(true)
    const result = await voteOnTag(user.accessToken, topicId, name, value)
    setPending(false)

    if (result.error)
      setError(result.error)
    else {
      setError("")
      setTags(result.tags)
    }
  }

  return (
    <>
      <p className="tagRule">{TAG_RULE}</p>
      {tags.length === 0 ?
        <p className="tagRule">nenhuma tag proposta ainda.</p>
        :
        <ul className="tagVotes">
          {tags.map(tag => (
            <li key={tag.slug}>
              <TagPill {...tag} />
              <span className="counts">
                {plural(tag.endorsements, "apoio", "apoios")} · {plural(tag.contests, "contestação", "contestações")}
                {!tag.visible && " · oculta"}
              </span>
              <button
                type="button"
                className="tagVote"
                aria-label={`apoiar ${tag.name}`}
                aria-pressed={tag.userVote === 1}
                disabled={pending}
                onClick={() => vote(tag.name, tag.userVote === 1 ? 0 : 1)}
              >
                {tag.userVote === 1 ? <PiThumbsUpFill /> : <PiThumbsUp />}
              </button>
              <button
                type="button"
                className="tagVote contest"
                aria-label={`contestar ${tag.name}`}
                aria-pressed={tag.userVote === -1}
                disabled={pending}
                onClick={() => vote(tag.name, tag.userVote === -1 ? 0 : -1)}
              >
                {tag.userVote === -1 ? <PiThumbsDownFill /> : <PiThumbsDown />}
              </button>
            </li>
          ))}
        </ul>
      }
      {user ?
        <TagInput label="propor uma tag" exclude={tags.map(tag => tag.slug)} disabled={pending} onPick={name => vote(name, 1)} />
        :
        <button type="button" onClick={toLogin}>entre para votar nas tags</button>
      }
      {error && <p className="tagError" role="alert">{error}</p>}
    </>
  )
}

// A topic's visible tags as pills, the first few and a "+N" for the rest, and a button opening the
// panel where anyone curates them
export default function TagList({ topicId, tags: initialTags = NO_TAGS }) {
  const [tags, setTags] = React.useState(initialTags)
  // A refetched topic (another user logged in) brings its own tags
  const [lastInitial, setLastInitial] = React.useState(initialTags)
  const [expanded, setExpanded] = React.useState(false)

  if (initialTags !== lastInitial) {
    setLastInitial(initialTags)
    setTags(initialTags)
  }

  const shown = tags.filter(tag => tag.visible)
  const listed = expanded ? shown : shown.slice(0, VISIBLE_TAGS)

  return (
    <div className="tagList">
      {listed.length > 0 &&
        <ul aria-label="tags do tópico">
          {listed.map(tag => <li key={tag.slug}><TagPill {...tag} /></li>)}
        </ul>
      }
      {listed.length < shown.length &&
        <button type="button" className="tagPill action" onClick={() => setExpanded(true)} aria-label={`mostrar mais ${shown.length - listed.length} tags`}>
          +{shown.length - listed.length}
        </button>
      }
      <Popover
        className="tagPill action"
        aria-label="tags do tópico: votar e propor"
        heading="tags do tópico"
        panelClassName="tagCuration"
        placement="bottom-start"
        content={<TagCuration topicId={topicId} tags={tags} setTags={setTags} />}
      >
        <PiTag aria-hidden />
        {shown.length === 0 && <span>adicionar tags</span>}
      </Popover>
    </div>
  )
}
