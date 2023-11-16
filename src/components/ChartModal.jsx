import React from "react"

import Modal from "@/components/Modal"
import Input from "@/components/Input"
import Chart from "@/components/Chart"

const chartDefaults = {
  "line": {
    inputs: ["linhas", "pontos"],
    values: [2, 5],
    bounds: [[1, 10], [2, 20]]
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

export default ({ isOpen, setIsOpen, ...remainingProps }) => {
  const [chartType, setChartType] = React.useState("line")
  const [legend, setLegend] = React.useState(true)
  const [input1, setInput1] = React.useState(chartDefaults[chartType].values[0])
  const [input2, setInput2] = React.useState(chartDefaults[chartType].values[1])
  const [chartData, setChartData] = React.useState(generateChartData(chartType, input1, input2))
  const [chartKeys, setChartKeys] = React.useState([])
  const [dataInputStage, setDataInputStage] = React.useState(false)

  const updateChartValue = (i, j, value) => {
    setChartData(chartData.map((c, idx) => {
      if (i === idx)
        return { ...c, [Object.keys(chartData[0])[j]]: value }
      else
        return c
    }))
  }

  const updateKey = (i, value) => {
    setChartKeys(chartKeys.map((v, idx) => {
      if (i === idx)
        return value
      else
        return v
    }))
  }

  const updateChartKeys = () => {
    const oldKeys = Object.keys(chartData[0])
    console.log("old", oldKeys)
    setChartData(chartData.map(v => {
      chartKeys.forEach((key, i) => {
        if (oldKeys[i] === key)
          return
        Object.defineProperty(v, key, Object.getOwnPropertyDescriptor(v, oldKeys[i]))
        delete v[oldKeys[i]]
      })
      return v
    }))
  }

  const validateKeys = () => chartKeys.every(v => v !== "") && (new Set(chartKeys)).size === chartKeys.length

  const validateInput = (e, inputId) => {
    return e.target.value === "" || (e.target.value >= 0 && e.target.value <= chartDefaults[chartType].bounds[inputId][1])
  }

  React.useEffect(() => {
    setChartData(generateChartData(chartType, input1, input2))
  }, [chartType, input1, input2])

  React.useEffect(() => {
    console.log(chartKeys)
    if (validateKeys())
      updateChartKeys()
  }, [chartKeys])

  return (
    <Modal
      isOpen={isOpen}
      setIsOpen={setIsOpen}
      title="insira um gráfico"
      footer={dataInputStage ?
        [<button style={{ marginRight: "0.5rem" }} onClick={() => { if (validateKeys()) { setDataInputStage(false); updateChartKeys() } }}>voltar</button>,
        <button onClick={() => { if (validateKeys()) { setDataInputStage(false); updateChartKeys() } }}>inserir</button>]
        :
        [<button onClick={() => { setDataInputStage(true); setChartKeys(Object.keys(chartData[0])) }}>continuar</button>]
      }
    >
      <div className="body">
        {dataInputStage ?
          <>
            <table>
              <thead>
                <tr>
                  {chartKeys.map((_, i) =>
                    <th>
                      <input value={chartKeys[i]} onChange={e => updateKey(i, e.target.value)} />
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {chartData.map((_, i) =>
                  <tr>
                    {chartKeys.map((_, j) =>
                      <td>
                        <input value={Object.values(chartData[i])[j]} onChange={e => updateChartValue(i, j, e.target.value)} />
                      </td>
                    )}
                  </tr>
                )}
              </tbody>
            </table>
          </>
          :
          <>
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

              {chartType !== "scatter" &&
                <Input
                  label="Legenda"
                  type="checkbox"
                  id="legend"
                  checked={legend}
                  onChange={() => { setLegend(!legend) }} />
              }
            </div>
          </>
        }
        <Chart className="right" type={chartType} data={chartData} width={400} height={200} isLegendOn={legend} />
      </div>
    </Modal >
  )
}