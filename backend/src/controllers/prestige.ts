import { RequestHandler } from "express"

import Prestige from "@/models/prestige"
import User from "@/models/user"
import { validate } from "@/validation"


// What earns prestige and how much can be earned, as the page explaining it shows them
export const getPrestigeRules: RequestHandler = async (req, res) => {
  res.status(200).json(await Prestige.rules())
}

// Anyone's awards, newest first, with their total: every point of a profile's prestige explained
export const getUserPrestige: RequestHandler = async (req, res) => {
  const { name } = validate("userParams", req.params)
  const { page, pageSize } = validate("pages", req.query)
  const user = await User.findByName(name)
  const { events, count } = await Prestige.history(user.pid, { page, pageSize })

  res.status(200).json({ prestige: user.prestige, events, count })
}
