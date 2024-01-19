import { RequestHandler } from "express"
import { readFile, readdir, stat, writeFile, mkdir } from "fs/promises"

import Content, { IContentToInsert } from "@/models/content"
import { ValidationError, NotFoundError } from "@/errors"


export const getContents: RequestHandler = async (req, res, next) => {
  const page = Number(req.query.page) || 0
  const pageSize = Number(req.query.pageSize) || 10

  try {
    const contents = await Content.findAll({ page, pageSize })
    res.status(200).json(contents)
  }
  catch (err) {
    next(err)
  }
}

const validateContent = (content: IContentToInsert) => {
  const mandatory = ["title", "author_pid", ...(content.type === "topic" ? [] : ["parent_id", "body"])]

  for (const field of mandatory)
    if (!content[field])
      throw new ValidationError({
        message: `"${field}" é um campo obrigatório`,
        errorLocationCode: "CONTROLLER:CONTENT:VALIDADE_CONTENT"
      })
}

export const createContent: RequestHandler = async (req, res, next) => {
  const { title, author_pid, parent_id, body, config } = req.body

  try {
    const type = await Content.getType(parent_id)
    const content: IContentToInsert = { title, author_pid, parent_id, body, type, config }
    validateContent(content)

    const result = await Content.create(content)
    res.status(201).json(result)
  }
  catch (err) {
    next(err)
  }
}

export const getContent: RequestHandler = async (req, res) => {
  const content = await Content.findById(Number(req.params.id))

  if (!content)
    throw new NotFoundError({
      message: "Conteúdo não encontrado.",
      action: 'Verifique se o "id" fornecido está correto.'
    })

  res.status(200).json(content)
}