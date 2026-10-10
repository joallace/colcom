import { RequestHandler } from "express"

import Interactions, { InteractionInsertRequest } from "@/models/interactions"
import Content from "@/models/content"
import { contentNotFound } from "@/controllers/content"
import { validate } from "@/validation"

export const getContentInteractions: RequestHandler = async (req, res) => {
  const content_id = req.params.id
  const interactions = await Interactions.findAll({ where: "i.content_id = $1", values: [content_id] })
  res.status(200).json(interactions)
}

export const handleInteraction: RequestHandler = async (req, res) => {
  const author_pid = res.locals.user.pid

  const { content_id, type } = validate("interaction", req.body)
  const interaction: InteractionInsertRequest = { author_pid, content_id, type }

  const [status, result] = await Interactions.handleChange(interaction)

  res.status(status).json(result)
}

export const getVoteHistory: RequestHandler = async (req, res) => {
  const { id } = validate("contentParams", req.params)
  const { type } = await Content.getDataById(id, ["type"])

  if (type !== "topic")
    throw contentNotFound("topic")

  res.status(200).json(await Interactions.findVoteHistory(id))
}
