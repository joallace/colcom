import { RequestHandler } from "express"

import Content from "@/models/content"
import { metaTitles, systemUserId } from "@/meta"
import { META_GROUPS } from "@/metaTopics"


// How many of each topic's posts the page shows, as the topic lists do
const PREVIEW_POSTS = 3

// The foundational topics in their groups and order (metaTopics.ts), each as the topic lists send it
export const getMeta: RequestHandler = async (req, res) => {
  const systemId = await systemUserId()
  const titles = metaTitles()
  const trees = systemId === undefined ? [] : await Content.findTopicsByTitle(systemId, titles, {
    childLimit: PREVIEW_POSTS,
    userPid: res.locals.user?.pid
  })
  const byTitle = new Map(trees.map(tree => [tree.title, tree]))

  res.status(200).json({
    groups: META_GROUPS.map(({ key, name, description, topics }) => ({
      key,
      name,
      description,
      topics: topics.map(topic => byTitle.get(topic.title)).filter(Boolean)
    }))
  })
}
