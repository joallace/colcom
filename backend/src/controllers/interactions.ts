import { RequestHandler } from "express"

import Interactions from "@/models/interactions"
import Content from "@/models/content"
import { contentNotFound } from "@/controllers/content"
import { validate } from "@/validation"

export const handleInteraction: RequestHandler = async (req, res) => {
  const author_pid = res.locals.user.pid

  const { content_id, type } = validate("interaction", req.body)
  const result = await Interactions.toggle({ author_pid, content_id, type })

  if (result.outcome === "removed")
    res.status(204).end()
  else
    res.status(result.outcome === "created" ? 201 : 200).json(result.interaction)
}

export const getVoteHistory: RequestHandler = async (req, res) => {
  const { id } = validate("contentParams", req.params)
  const { type } = await Content.getFieldsOrThrow(id, ["type"])

  if (type !== "topic")
    throw contentNotFound("topic")

  res.status(200).json(await Interactions.findVoteHistory(id))
}
