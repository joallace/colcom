import React from "react"
import {
  PiPaintBucket,
  PiPaintBucketFill,
  PiPencilSimple,
  PiPencilSimpleFill,
  PiEraser,
  PiEraserFill,
  PiArrowCounterClockwiseFill,
  PiArrowClockwiseFill,
  PiTrash
} from "react-icons/pi"

import Input from "@/components/primitives/Input"
import { defaultOrange, defaultGreen, defaultYellow, defaultBlue, defaultFontColor } from "@/assets/scss/_export.module.scss"
import useBreakpoint from "@/hooks/useBreakpoint"

const GRID_SIZE = 16
export const blankGrid = Array(GRID_SIZE).fill().map(() => Array(GRID_SIZE).fill(""))

export const serializeGridToBase64png = (grid) => {
  const flattened = grid.flat()
  const binaryData = new Uint8ClampedArray(flattened.length * 4)

  flattened.forEach((pixelColor, index) => {
    const hex = pixelColor.replace("#", "")
    const i = index * 4

    if (hex.length !== 6) {
      for (let idx = i; idx < i + 4; idx++)
        binaryData[idx] = 0
      return
    }

    binaryData[i]     = parseInt(hex.substring(0, 2), 16) // RR
    binaryData[i + 1] = parseInt(hex.substring(2, 4), 16) // GG
    binaryData[i + 2] = parseInt(hex.substring(4, 6), 16) // BB
    binaryData[i + 3] = 255                               // Alpha
  })

  const img = new ImageData(binaryData, GRID_SIZE, GRID_SIZE)

  const canvas = document.createElement("canvas")
  canvas.setAttribute("width", GRID_SIZE)
  canvas.setAttribute("height", GRID_SIZE)

  const ctx = canvas.getContext("2d")
  ctx.putImageData(img, 0, 0)
  return canvas.toDataURL().split(",")[1]
}

export default function PixelArtEditor({ gridState, error }) {
  const [internalGrid, setInternalGrid] = React.useState(blankGrid)
  const [grid, setGrid] = gridState.length ? gridState : [internalGrid, setInternalGrid]
  const [selectedColor, setSelectedColor] = React.useState(defaultFontColor)
  const [selectedTool, setSelectedTool] = React.useState("pencil")
  const [undoStack, setUndoStack] = React.useState([])
  const [redoStack, setRedoStack] = React.useState([])
  const [isDrawing, setIsDrawing] = React.useState(false)
  const [lastCell, setLastCell] = React.useState(null)
  const [showGrid, setShowGrid] = React.useState(true)
  const isDesktop = useBreakpoint("md")

  const colors = [
    defaultFontColor, defaultOrange, defaultGreen, defaultYellow, defaultBlue
  ]

  const saveState = React.useCallback((currentGrid) => {
    setUndoStack(stack => [...stack.slice(-99), currentGrid])
    setRedoStack([])
  }, [])

  const undo = () => {
    if (undoStack.length > 0) {
      const newUndoStack = [...undoStack]
      const currentState = newUndoStack.pop()
      setRedoStack(stack => [...stack, currentState])
      setGrid(newUndoStack.length ? newUndoStack[newUndoStack.length - 1] : blankGrid)
      setUndoStack(newUndoStack)
    }
  }

  const redo = () => {
    if (redoStack.length > 0) {
      const newRedoStack = [...redoStack]
      const state = newRedoStack.pop()
      setUndoStack(stack => [...stack, state])
      setGrid(state)
      setRedoStack(newRedoStack)
    }
  }

  const discard = () => {
    setGrid(blankGrid)
    saveState(blankGrid)
  }

  const floodFill = React.useCallback((startX, startY, targetColor, replacementColor) => {
    const newGrid = grid.map(row => [...row])
    const queue = [[startX, startY]]
    const visited = new Set([`${startX},${startY}`])

    while (queue.length > 0) {
      const [x, y] = queue.shift()

      if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) continue
      if (newGrid[x][y] !== targetColor) continue

      newGrid[x][y] = replacementColor

      const neighbors = [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1]
      ]

      neighbors.forEach(([nx, ny]) => {
        const key = `${nx},${ny}`
        if (!visited.has(key)) {
          visited.add(key)
          queue.push([nx, ny])
        }
      })
    }

    return newGrid
  }, [grid])

  const interpolateCells = React.useCallback((startX, startY, endX, endY) => {
    const newGrid = grid.map(row => [...row])
    let hasChanges = false

    let x0 = startX
    let y0 = startY
    const x1 = endX
    const y1 = endY

    const dx = Math.abs(x1 - x0)
    const dy = -Math.abs(y1 - y0)
    const sx = x0 < x1 ? 1 : -1
    const sy = y0 < y1 ? 1 : -1
    let err = dx + dy

    while (true) {
      const currentColor = newGrid[x0][y0]
      const targetColor = (selectedTool === "pencil") ? selectedColor : ""

      if (currentColor !== targetColor) {
        newGrid[x0][y0] = targetColor
        hasChanges = true
      }

      if (x0 === x1 && y0 === y1) break
      const e2 = 2 * err
      if (e2 >= dy) {
        err += dy
        x0 += sx
      }
      if (e2 <= dx) {
        err += dx
        y0 += sy
      }
    }

    if (hasChanges) {
      setGrid(newGrid)
      saveState(newGrid)
    }
  }, [selectedColor, selectedTool, grid, saveState])

  const handleCellAction = React.useCallback((x, y) => {
    let newGrid

    switch (selectedTool) {
      case "pencil":
        if (grid[x][y] === selectedColor) return
        newGrid = grid.map(row => [...row])
        newGrid[x][y] = selectedColor
        break
      case "eraser":
        if (grid[x][y] === "") return
        newGrid = grid.map(row => [...row])
        newGrid[x][y] = ""
        break
      case "bucket":
        if (grid[x][y] === selectedColor) return
        newGrid = floodFill(x, y, grid[x][y], selectedColor)
        break
    }

    setGrid(newGrid)
    saveState(newGrid)
  }, [selectedTool, selectedColor, grid, floodFill, saveState])

  const handleMouseDown = (e, x, y) => {
    if (e?.buttons === 2 || e?.button === 2) return
    setIsDrawing(true)
    setLastCell([x, y])
    handleCellAction(x, y)
  }

  const handleMouseEnter = (x, y) => {
    if (isDrawing && lastCell) {
      if (selectedTool === "pencil" || selectedTool === "eraser") {
        interpolateCells(lastCell[0], lastCell[1], x, y)
      }
      setLastCell([x, y])
    }
  }

  const handleMouseUp = () => {
    setIsDrawing(false)
    setLastCell(null)
  }

  return (
    <div className="pixel-art-editor">
      <div className="canvas">
        <div className="tools">
          {["pencil", "eraser", "bucket"].map((tool) => (
            <button
              key={tool}
              className={tool === selectedTool ? "selected" : ""}
              onClick={() => setSelectedTool(tool)}
            >
              {tool === "pencil" && <>{tool === selectedTool ? <PiPencilSimpleFill /> : <PiPencilSimple />} {isDesktop ? "lápis" : ""}</>}
              {tool === "eraser" && <>{tool === selectedTool ? <PiEraserFill /> : <PiEraser />} {isDesktop ? "borracha" : ""}</>}
              {tool === "bucket" && <>{tool === selectedTool ? <PiPaintBucketFill /> : <PiPaintBucket />} {isDesktop ? "balde" : ""}</>}
            </button>
          ))}
        </div>

        <div
          className={`unselectable canvas-grid${showGrid ? "" : " hide-grid"}${error ? " error" : ""}`}
          style={{ "--hover-color": selectedTool !== "eraser" ? selectedColor : "" }}
          onMouseLeave={handleMouseUp}
          onMouseUp={handleMouseUp}
        >
          {grid.map((row, x) =>
            row.map((color, y) => (
              <div
                key={`${x}-${y}`}
                className="canvas-cell"
                style={{ backgroundColor: color }}
                onMouseDown={(e) => handleMouseDown(e, x, y)}
                onMouseEnter={() => handleMouseEnter(x, y)}
                onTouchStart={(e) => {
                  e.preventDefault()
                  handleMouseDown(e, x, y)
                }}
                onTouchMove={(e) => {
                  e.preventDefault()
                  const touch = e.touches[0]
                  const target = document.elementFromPoint(touch.clientX, touch.clientY)
                  if (target?.dataset?.x && target?.dataset?.y) {
                    handleMouseEnter(Number(target.dataset.x), Number(target.dataset.y))
                  }
                }}
                onTouchEnd={handleMouseUp}
                data-x={x}
                data-y={y}
              />
            ))
          )}
        </div>

        <div className="tools">
          <button
            onClick={undo}
            disabled={undoStack.length === 0}
          >
            <PiArrowCounterClockwiseFill /> {isDesktop ? "desfazer" : ""}
          </button>

          <button
            onClick={redo}
            disabled={redoStack.length === 0}
          >
            <PiArrowClockwiseFill /> {isDesktop ? "refazer" : ""}
          </button>

          <button
            onClick={discard}
            className="error"
            disabled={grid.every(row => row.every(pixel => pixel === ""))}
          >
            <PiTrash /> {isDesktop ? "descartar" : ""}
          </button>
        </div>
      </div>

      {error && <span className="error">a foto de perfil é obrigatória!</span>}

      <div className="palette">
        <div className="color-picker" style={{ backgroundColor: selectedColor }}>
          <input
            type="color"
            value={selectedColor}
            className="color-picker"
            onChange={(e) => setSelectedColor(e.target.value)}
          />
        </div>
        {colors.map((color) => (
          <div
            key={color}
            className={`palette-color ${color === selectedColor ? "selected" : ""}`}
            style={{ backgroundColor: color }}
            onClick={() => setSelectedColor(color)}
          />
        ))}
      </div>

      <div>
        <Input
          id="gridToggle"
          label="exibir grid"
          type="checkbox"
          checked={showGrid}
          onChange={() => setShowGrid(!showGrid)}
        />
      </div>
    </div>
  )
}
