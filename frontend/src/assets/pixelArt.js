export const GRID_SIZE = 16
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

    binaryData[i] = parseInt(hex.substring(0, 2), 16) // RR
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
