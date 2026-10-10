import React from "react"
import { Link } from "react-router"

import NoResponse from "@/components/primitives/NoResponse"
import Topic from "@/components/content/Topic"
import Spinner from "@/components/primitives/Spinner"
import useUser from "@/context/UserContext"
import useApiResource from "@/hooks/useApiResource"


// The foundational topics, where everyone decides how colcom should be and work. The instance opens
// them and the API sends them in their groups and order (backend/src/metaTopics.ts), so this page
// lists them whole, with no pagination.
export default function Meta() {
  const { user } = useUser()
  // Fetched again for whoever is viewing (their votes and bookmarks); a failure shows no groups
  const { data, isLoading } = useApiResource(user !== undefined ? "/meta" : null, { deps: [user] })
  const groups = data?.groups.filter(group => group.topics.length > 0) ?? []

  React.useEffect(() => {
    document.title = "meta · colcom"
  }, [])

  return (
    <div className={`content ${(isLoading || groups.length === 0) ? "centered" : "tree"} meta`}>
      <header className="metaHeader">
        <h1>meta</h1>
        <p>
          Aqui a comunidade decide como o colcom deve ser e funcionar. Estes tópicos foram abertos pela própria
          instância e levam a tag reservada <Link to="/t/meta">Meta</Link>, que ninguém pode tirar deles nem pôr em
          outros tópicos.
        </p>
        <p>Responda com um post, critique e vote: o post mais votado de cada tópico é, por enquanto, a posição da comunidade.</p>
      </header>
      {
        isLoading ?
          <Spinner />
          :
          groups.length > 0 ?
            groups.map(group => (
              <section key={group.key} className="metaGroup" aria-labelledby={`meta-${group.key}`}>
                <header>
                  <h2 id={`meta-${group.key}`}>{group.name}</h2>
                  <p>{group.description}</p>
                </header>
                {group.topics.map(topic => <Topic {...topic} key={`t${topic.id}`} />)}
              </section>
            ))
            :
            <NoResponse>os tópicos meta ainda não foram abertos.</NoResponse>
      }
    </div>
  )
}
