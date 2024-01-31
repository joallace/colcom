import React from "react"

import Modal from "@/components/Modal"
import Input from "@/components/Input"
import Chart from "@/components/Chart"
import { ChartContext } from "@/context/ChartContext"

const chartDefaults = {
  "line": {
    inputs: ["linhas", "pontos"],
    bounds: [[1, 10], [2, 20]]
  },
  "area": {
    inputs: ["linhas", "pontos"],
    bounds: [[1, 10], [2, 20]]
  },
  "bar": {
    inputs: ["barras", "pontos"],
    bounds: [[1, 10], [2, 20]]
  },
  "pie": {
    inputs: ["seções"],
    bounds: [[2, 10]]
  },
  "scatter": {
    inputs: ["pontos"],
    bounds: [[3, 20]]
  },
  "radar": {
    inputs: ["seções", "variáveis"],
    bounds: [[1, 3], [3, 10]]
  }
}

const reservedWords = {
  "0name": "nome",
  "0value": "valor",
  "0x": "x",
  "0y": "y"
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
        const obj = { "0name": String.fromCharCode('A'.charCodeAt() + index + Math.floor(index / 26) * 6) }
        for (let i = 1; i <= numberColumns; i++) {
          obj['x' + i] = Math.random().toFixed(2)
        }
        return obj
      })
    case "pie":
      return Array.from({ length: numberColumns }, (_, i) => ({
        "0name": String.fromCharCode('A'.charCodeAt() + i + Math.floor(i / 26) * 6),
        "0value": parseFloat(Math.random().toFixed(2)),
      }))
    case "scatter":
      return Array.from({ length: numberColumns }, () => ({
        "0x": Math.random().toFixed(2),
        "0y": Math.random().toFixed(2),
      }))
  }
}

export default ({ isOpen, setIsOpen, editor, setChartOutput, editionMode = false, currentData, currentType = "line", setIsLegendOn, ...remainingProps }) => {
  const [chartType, setChartType] = React.useState(currentType)
  const [legend, setLegend] = React.useState(true)
  const [input1, setInput1] = React.useState(2)
  const [input2, setInput2] = React.useState(5)
  const [chartData, setChartData] = React.useState(editionMode ? currentData : generateChartData(chartType, input1, input2))
  const [chartKeys, setChartKeys] = React.useState(Object.keys(chartData[0]))
  const [dataInputStage, setDataInputStage] = React.useState(editionMode)
  const [error, setError] = React.useState(false)
  const { setChartString } = React.useContext(ChartContext)

  const updateChartValue = (i, j, value) => {
    setChartData(chartData.map((c, idx) => {
      if (i === idx)
        return { ...c, [chartKeys[j]]: value }
      else
        return c
    }))
  }

  // Updates the chartKeys buffer
  const updateKey = (i, value) => {
    // Escaping if the key begins with a number (which breaks the obj key order)
    if (/^\d$/.test(value))
      return

    setChartKeys(chartKeys.map((v, idx) => {
      if (i === idx)
        return value
      else
        return v
    }))
  }

  // Updates the chartData objects keys
  const updateChartKeys = () => {
    const oldKeys = Object.keys(chartData[0])

    setChartData(chartData.map(v => {
      // Searches for the different key and creates a new key then deletes the old one
      chartKeys.forEach((key, i) => {
        if (oldKeys[i] === key)
          return
        Object.defineProperty(v, key, Object.getOwnPropertyDescriptor(v, oldKeys[i]))
        delete v[oldKeys[i]]
      })

      // Returning the new object with the intended order
      return chartKeys.reduce((obj, k) => {
        obj[k] = v[k];
        return obj;
      }, {});
    }))
  }

  // Checks if there is no empty keys and every key is different from each other
  const validateKeys = () => chartKeys.every(v => v !== "") && (new Set(chartKeys)).size === chartKeys.length

  const validateInput = (value, inputId) => {
    const upperBound = chartDefaults[chartType].bounds[inputId][1]
    return value === "" || (value > 0 && value <= upperBound)
  }

  const validateAndUpdate = (inputId, setter) => {
    return e => {
      const value = e.target.value
      if (validateInput(value, inputId)) {
        setError(0)
        setter(parseInt(value.replace(/\D/, "")))
        setChartData(generateChartData(chartType, inputId === 0 ? value : input1, inputId === 1 ? value : input2))
      }
      else {
        setError(inputId + 1)
      }
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      setIsOpen={setIsOpen}
      title={`${editionMode ? "edite o" : "insira um"} gráfico`}
    >
      <div className="body">
        <div className="inputs">
          {dataInputStage ?
            <table>
              <thead>
                <tr>
                  {chartKeys.map((key, i) =>
                    <th>
                      <input
                        value={key[0] === "0" ? reservedWords[key] : key}
                        onChange={e => { updateKey(i, e.target.value) }}
                        onKeyUp={e => e.key === "Enter" && (validateKeys() && updateChartKeys())}
                        onBlur={() => { validateKeys() && updateChartKeys() }}
                        style={{ minWidth: `${Math.min(key.length + 2, 32)}ch` }}
                        readOnly={key[0] === "0"}
                      />
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {chartData.map((data, i) =>
                  <tr>
                    {chartKeys.map((_, j) =>
                      <td>
                        <input
                          value={Object.values(data)[j]}
                          onChange={e => updateChartValue(i, j, e.target.value)}
                        />
                      </td>
                    )}
                  </tr>
                )}
              </tbody>
            </table>
            :
            <>
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
                onChange={e => { setChartType(e.target.value); setChartData(generateChartData(e.target.value, input1, input2)) }}
                value={chartType}
              />

              <Input
                label={`n.º de ${chartDefaults[chartType].inputs[0]}`}
                value={input1 ? input1 : ""}
                onChange={validateAndUpdate(0, setInput1)}
                errorMessage={error === 1 && `deve ser de 1 a ${chartDefaults[chartType].bounds[0][1]}`}
              />

              {(chartType !== "pie" && chartType !== "scatter") &&
                <Input
                  label={`n.º de ${chartDefaults[chartType].inputs[1]}`}
                  value={input2 ? input2 : ""}
                  onChange={validateAndUpdate(1, setInput2)}
                  errorMessage={error === 2 && `deve ser de 1 a ${chartDefaults[chartType].bounds[1][1]}`}
                />
              }
            </>
          }
          {chartType !== "scatter" && (!dataInputStage || (dataInputStage && editionMode)) &&
            <Input
              label="Legenda"
              type="checkbox"
              id="legend"
              checked={legend}
              onChange={() => { setLegend(!legend) }}
              style={editionMode ? { marginTop: "1rem" } : {}}
            />
          }
        </div>
        <Chart
          type={chartType}
          data={chartData}
          width={400}
          height={200}
          isLegendOn={legend}
        />
      </div>
      <div className="footer">
        {dataInputStage ?
          <>
            {
              !editionMode &&
              <button
                style={{ marginRight: "0.5rem" }}
                onClick={() => { setDataInputStage(false) }}
              >
                voltar
              </button>
            }
            <button
              onClick={() => {
                if (editionMode) {
                  setChartOutput(chartData)
                  setIsLegendOn(legend)
                  setChartString({ type: chartType, legend, data: chartData })
                }
                else {
                  const chartStr = `<chart type="${chartType}" isLegendOn="${legend}" data="${JSON.stringify(chartData).replace(/\"/g, "'")}"></chart>`
                  editor.chain().focus().insertContent(chartStr).run()
                  setDataInputStage(false)
                }
                setIsOpen(false)
              }}
            >
              {editionMode ? "atualizar" : "inserir"}
            </button>
          </>
          :
          <button
            onClick={() => { setDataInputStage(true); setChartKeys(Object.keys(chartData[0])) }}
          >
            continuar
          </button>
        }
      </div>
    </Modal >
  )
}