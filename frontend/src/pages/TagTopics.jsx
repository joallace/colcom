import React from "react"
import { useLocation, useNavigate, useParams } from "react-router"
import { PiX } from "react-icons/pi"

import env from "@/assets/enviroment"
import { tagPath, tagsFromPath, toggleTag } from "@/assets/tags"
import TagPill from "@/components/content/TagPill"
import TopicTree from "@/pages/TopicTree"


// /t/<slug>+<slug>…: the topics having all of those tags, like a forum's section. The header shows
// the tags combined (each one removable, to widen the set) and the tags those topics have most
// (each one added on a click, to narrow it).
export default function TagTopics() {
  const { tags: param } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const slugs = tagsFromPath(param)
  const key = slugs.join(",")
  // What was fetched, and for which tags: it's loading until that's what is asked for
  const [info, setInfo] = React.useState({})

  React.useEffect(() => {
    const controller = new AbortController()

    const fetchInfo = async () => {
      try {
        const res = await fetch(`${env.apiAddress}/tags/${key}`, { signal: controller.signal })
        const data = await res.json()

        if (!res.ok) {
          setInfo({ key, error: res.status === 404 ? "tag não encontrada." : "tags inválidas." })
          return
        }

        // A merged tag's page is its tag's
        if (data.canonical !== key) {
          navigate(tagPath(data.canonical.split(",")), { replace: true })
          return
        }

        setInfo({ key, data })
        document.title = `${data.tags.map(tag => tag.name).join(" + ")} · colcom`
      }
      catch (err) {
        if (err.name !== "AbortError") {
          console.error(err)
          setInfo({ key, error: "não foi possível se conectar ao colcom." })
        }
      }
    }

    fetchInfo()
    return () => controller.abort()
  }, [key, navigate])

  const loaded = info.key === key ? info : {}
  const { data, error } = loaded

  return (
    // Remounted for every set of tags, so the page count is asked for again
    <TopicTree key={key} orderBy="id" tags={key} path={location.pathname}>
      <header className="tagHeader">
        {error ?
          <p className="tagRule">{error}</p>
          :
          data &&
          <>
            {/* The pills are the title: links are phrasing content, so they can be in a heading */}
            <h1 className="tagSet">
              {data.tags.map((tag, index) => (
                <React.Fragment key={tag.slug}>
                  {index > 0 && <span className="plus" aria-label="e">+</span>}
                  <TagPill
                    {...tag}
                    to={slugs.length > 1 ? tagPath(toggleTag(slugs, tag.slug)) : "/recent"}
                    title={`remover ${tag.name}`}
                  >
                    <PiX aria-hidden />
                    <span className="visuallyHidden"> (remover)</span>
                  </TagPill>
                </React.Fragment>
              ))}
            </h1>
            <p className="tagCount">{data.topics} tópico{data.topics === 1 ? "" : "s"}</p>
            {data.related.length > 0 &&
              // Not a <nav>: that element carries the navbar's styles
              <div className="relatedTags" role="group" aria-label="refinar com outra tag">
                <span>refinar:</span>
                <ul>
                  {data.related.map(tag => (
                    <li key={tag.slug}>
                      <TagPill {...tag} to={tagPath([...slugs, tag.slug])} title={`${tag.name}: ${tag.topics} destes tópicos`}>
                        <span className="detail">{tag.topics}</span>
                      </TagPill>
                    </li>
                  ))}
                </ul>
              </div>
            }
          </>
        }
      </header>
    </TopicTree>
  )
}
