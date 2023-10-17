import React from "react"

import Modal from "@/components/Modal"
import Input from "@/components/Input"
import Chart from "@/components/Chart"

const chartDefaults = {
  "line": {
    inputs: ["linhas", "pontos"],
    values: [2, 5],
    bounds: [[1, 10], [2,20]]
  },
  "area": {
    inputs: ["linhas", "pontos"],
    values: [2, 5],
    bounds: [[1, 10], [2, 20]]
  },
  "bar": {
    inputs: ["barras", "pontos"],
    values: [2, 5],
    bounds: [[1, 10], [2, 20]]
  },
  "pie": {
    inputs: ["seções"],
    values: [5],
    bounds: [[2, 10]]
  },
  "scatter": {
    inputs: ["pontos"],
    values: [8],
    bounds: [[3, 100]]
  },
  "radar": {
    inputs: ["seções", "variáveis"],
    values: [2, 5],
    bounds: [[1, 3], [3, 10]]
  }
}

export default ({ isOpen, setIsOpen, ...remainingProps }) => {
  const [chartType, setChartType] = React.useState("line")
  const [input1, setInput1] = React.useState(chartDefaults[chartType].values[0])
  const [input2, setInput2] = React.useState(chartDefaults[chartType].values[1])


  const generateChartData = (type, numberColumns, numberRows) => {
    if (!numberColumns || !numberRows)
      return [{}]

    switch (type) {
      case "line":
      case "area":
      case "radar":
      case "bar":
        return Array.from({ length: numberRows }, (_, index) => {
          const obj = { name: String.fromCharCode('A'.charCodeAt() + index + Math.floor(index / 26) * 6) }
          for (let i = 1; i <= numberColumns; i++) {
            obj['x' + i] = Math.random().toFixed(2)
          }
          return obj
        })
      case "pie":
        return Array.from({ length: numberColumns }, (_, i) => ({
          name: String.fromCharCode('A'.charCodeAt() + i + Math.floor(i / 26) * 6),
          value: parseFloat(Math.random().toFixed(2)),
        }))
      case "scatter":
        return Array.from({ length: numberColumns }, () => ({
          x: Math.random().toFixed(2),
          y: Math.random().toFixed(2),
        }))
    }
  }

  const validateInput = (e, inputId) => {
    return e.target.value==="" || (e.target.value >= 0 && e.target.value <= chartDefaults[chartType].bounds[inputId][1])
  }

  return (
    <Modal
      isOpen={isOpen}
      setIsOpen={setIsOpen}
      title="insira um gráfico"
      footer={[<button>continuar</button>]}
    >
      <div className="body">
        <div className="left">
          <Input
            label="tipo de gráfico"
            type="select"
            options={{
              "linha": "line",
              "área": "area",
              "barra": "bar",
              "pizza": "pie",
              "pontos": "scatter",
              "radar": "radar"
            }}
            onChange={e => { setChartType(e.target.value) }}
            value={chartType}
          />

          <div className="bottom">
            <Input
              label={`n.º de ${chartDefaults[chartType].inputs[0]}`}
              value={input1 ? input1 : ""}
              onChange={e => { validateInput(e, 0) && setInput1(e.target.value.replace(/\D/, "")) }}
            />
            {(chartType !== "pie" && chartType !== "scatter") &&
              <Input
                label={`n.º de ${chartDefaults[chartType].inputs[1]}`}
                value={input2 ? input2 : ""}
                onChange={e => { validateInput(e, 1) && setInput2(e.target.value.replace(/\D/, "")) }}
              />
            }
          </div>
        </div>
        <Chart className="right" type={chartType} data={generateChartData(chartType, input1, input2)} width={400} height={200} />
      </div>
    </Modal >
  )
}