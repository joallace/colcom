import { RequestHandler } from "express"
import { PODIUM_PERIODS, PODIUM_SIZE } from "@colcom/shared"

import Podium from "@/models/podium"
import { systemUserId } from "@/meta"
import { validate } from "@/validation"


// The users with the most prestige, but not the system account: its topics are the instance's own
export const getPodiumUsers: RequestHandler = async (req, res) => {
  const users = await Podium.topUsers(PODIUM_SIZE, await systemUserId())
  res.status(200).json({ users })
}

// The topics or posts most approved over the period: the most up votes beyond their down votes
export const getPodiumContents: RequestHandler = async (req, res) => {
  const { type, period } = validate("podium", req.query)
  const contents = await Podium.topContents({ type, days: PODIUM_PERIODS[period], size: PODIUM_SIZE })
  res.status(200).json({ contents })
}
