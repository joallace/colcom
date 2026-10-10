import React from "react"
import { Link } from "react-router"

import NoResponse from "@/components/primitives/NoResponse"
import env from "@/assets/enviroment"
import Topic from "@/components/content/Topic"
import Spinner from "@/components/primitives/Spinner"
import useUser from "@/context/UserContext"


// The foundational topics, where everyone decides how colcom should be and work. The instance opens
// them and the API sends them in their groups and order (backend/src/metaTopics.ts), so this page
// lists them whole, with no pagination.
export default function Meta() {
  const [groups, setGroups] = React.useState([])
  // Who the shown groups were fetched for; it's loading until that's who is viewing
  const [loaded, setLoaded] = React.useState({})
  const { user } = useUser()
  const isLoading = loaded.user !== user

  React.useEffect(() => {
    const fetchMeta = async () => {
      const headers = user ? { "Authorization": `Bearer ${user.accessToken}` } : undefined
      try {
        const res = await fetch(`${env.apiAddress}/meta`, { headers })
        const data = await res.json()
        setGroups(res.ok ? data.groups.filter(group => group.topics.length > 0) : [])
      }
      catch (err) {
        console.error(err)
        setGroups([])
      }
      finally {
        setLoaded({ user })
      }
    }

    if (user !== undefined)
      fetchMeta()
  }, [user])

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
