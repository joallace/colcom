import { RequestHandler } from "express"

import Interactions, { InteractionInsertRequest } from "@/models/interactions"

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
  const { content_id, type, colcoins } = req.body
  const author_pid = (<any>req.params.user).pid

  try {
    const interaction: InteractionInsertRequest = { author_pid, content_id, type, colcoins }

    const [status, result] = await Interactions.handleChange(interaction)

    res.status(status).json(result)
  }
  catch (err) {
    next(err)
  }
}

// export const updateInteraction: RequestHandler = async (req, res, next) => {
//   const interaction_id = Number(req.params.id)
//   const { type } = req.body
//   const author_pid = (<any>req.params.user).pid

//   try {
//     const interaction: InteractionAlterRequest = { id: interaction_id, type }

//     const result = await Interactions.updateById(interaction)

//     res.status(201).json(result)
//   }
//   catch (err) {
//     next(err)
//   }
// }

// export const deleteInteraction: RequestHandler = async (req, res, next) => {
//   const interaction_id = Number(req.params.id)
//   const author_pid = (<any>req.params.user).pid

//   try {
//     const result = await Interactions.removeById(interaction_id)

//     res.status(201).json(result)
//   }
//   catch (err) {
//     next(err)
//   }
// }