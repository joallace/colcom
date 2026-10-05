import { RequestHandler } from "express"

import Interactions, { InteractionInsertRequest } from "@/models/interactions"
import { validate } from "@/validation"

export const getContentInteractions: RequestHandler = async (req, res, next) => {
  const content_id = req.params.id
  try {
    const interactions = await Interactions.findAll({ where: "i.content_id = $1", values: [content_id] })
    res.status(200).json(interactions)
  }
  catch (err) {
    next(err)
  }
}

export const handleInteraction: RequestHandler = async (req, res, next) => {
  const author_pid = res.locals.user.pid

  try {
    const { content_id, type } = validate("interaction", req.body)
    const interaction: InteractionInsertRequest = { author_pid, content_id, type }

    const [status, result] = await Interactions.handleChange(interaction)

    res.status(status).json(result)
  }
  catch (err) {
    next(err)
  }
}
