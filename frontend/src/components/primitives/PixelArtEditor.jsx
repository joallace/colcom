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


const blankGrid = Array(16).fill().map(() => Array(16).fill(""))

export default function PixelArtEditor() {
  const [grid, setGrid] = React.useState(blankGrid)
  const [selectedColor, setSelectedColor] = React.useState("#000000")
  const [selectedTool, setSelectedTool] = React.useState("pencil")
  const [undoStack, setUndoStack] = React.useState([])
  const [redoStack, setRedoStack] = React.useState([])
  const [isDrawing, setIsDrawing] = React.useState(false)
  const [lastCell, setLastCell] = React.useState(null)
  const [showGrid, setShowGrid] = React.useState(true)

  const colors = [
    "#000000", "#FFFFFF", "#FF0000", "#00FF00", "#0000FF"
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
    if (targetColor === replacementColor) return

    const newGrid = grid.map(row => [...row])
    const queue = [[startX, startY]]
    const visited = new Set([`${startX},${startY}`])

    while (queue.length > 0) {
      const [x, y] = queue.shift()

      if (x < 0 || x >= 16 || y < 0 || y >= 16) continue
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

    setGrid(newGrid)
    saveState(newGrid)
  }, [grid, saveState])

  const interpolateCells = React.useCallback((startX, startY, endX, endY) => {
    const newGrid = grid.map(row => [...row])
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
      if (selectedTool === "pencil") {
        newGrid[x0][y0] = selectedColor
      } else if (selectedTool === "eraser") {
        newGrid[x0][y0] = ""
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

    setGrid(newGrid)
    saveState(newGrid)
  }, [selectedColor, selectedTool, grid, saveState])

  const handleCellAction = React.useCallback((x, y) => {
    if (selectedTool === "pencil" || selectedTool === "eraser") {
      const newGrid = grid.map(row => [...row])
      newGrid[x][y] = selectedTool === "pencil" ? selectedColor : ""
      setGrid(newGrid)
      saveState(newGrid)
    } else if (selectedTool === "bucket") {
      floodFill(x, y, grid[x][y], selectedColor)
    }
  }, [selectedTool, selectedColor, grid, floodFill, saveState])

  const handleMouseDown = (x, y) => {
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
      <div className="tools">
        <button
          onClick={undo}
          disabled={undoStack.length === 0}
        >
          <PiArrowCounterClockwiseFill /> desfazer
        </button>

        <button
          onClick={redo}
          disabled={redoStack.length === 0}
        >
          <PiArrowClockwiseFill /> refazer
        </button>

        <button
          onClick={discard}
          className="error"
          disabled={grid.every(row => row.every(pixel => pixel === ""))}
        >
          <PiTrash /> descartar
        </button>

        {["pencil", "eraser", "bucket"].map((tool) => (
          <button
            key={tool}
            className={tool === selectedTool ? "selected" : ""}
            onClick={() => setSelectedTool(tool)}
          >
            {tool === "pencil" && <>{tool === selectedTool ? <PiPencilSimpleFill /> : <PiPencilSimple />} lápis</>}
            {tool === "eraser" && <>{tool === selectedTool ? <PiEraserFill /> : <PiEraser />} borracha</>}
            {tool === "bucket" && <>{tool === selectedTool ? <PiPaintBucketFill /> : <PiPaintBucket />} balde</>}
          </button>
        ))}
      </div>

      <div
        className={`unselectable canvas-grid${showGrid ? "" : " hide-grid"}`}
        onMouseLeave={handleMouseUp}
        onMouseUp={handleMouseUp}
      >
        {grid.map((row, x) =>
          row.map((color, y) => (
            <div
              key={`${x}-${y}`}
              className="canvas-cell"
              style={{ backgroundColor: color }}
              onMouseDown={() => handleMouseDown(x, y)}
              onMouseEnter={() => handleMouseEnter(x, y)}
              onTouchStart={(e) => {
                e.preventDefault()
                handleMouseDown(x, y)
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

      <div className="palette">
        <input
          type="color"
          value={selectedColor}
          onChange={(e) => setSelectedColor(e.target.value)}
          className="color-picker"
        />
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
          id="allowMultipleAnswers"
          label="exibir grid"
          type="checkbox"
          checked={showGrid}
          onChange={() => setShowGrid(!showGrid)}
        />
      </div>
    </div>
  )
}