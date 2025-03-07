import React from "react"

function convertUint8ArrayToHex2D(uint8Array) {
  if (uint8Array.length !== 768) {
    throw new Error("Input Uint8Array must have 768 elements (16x16x3).")
  }

  const result = []
  let index = 0

  for (let row = 0; row < 16; row++) {
    const rowColors = []
    for (let col = 0; col < 16; col++) {
      const r = uint8Array[index++]
      const g = uint8Array[index++]
      const b = uint8Array[index++]

      const hexColor =
        "#" +
        r.toString(16).padStart(2, "0") +
        g.toString(16).padStart(2, "0") +
        b.toString(16).padStart(2, "0")

      rowColors.push(hexColor)
    }
    result.push(rowColors)
  }

  return result
}

export default function ProfilePicture ({ data, size = 48 }) {
  if (!data) return <div className="spinner"/>

  const grid = React.useMemo(() => (convertUint8ArrayToHex2D(data)), [data])

  return (
    <div
      style={{
        display: "grid",
        width: size,
        height: size,
        gridTemplateColumns: "repeat(16, 1fr)"
      }}
    >
      {grid.map((row, x) =>
        row.map((color, y) => (
          <div
            key={`${x}-${y}`}
            style={{
              backgroundColor: color,
              width: size / 16,
              height: size / 16
            }}
          />
        ))
      )}
    </div>
  )
}