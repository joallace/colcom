import React from "react"

export const ChartContext = React.createContext()

export function ChartProvider({ children }) {
    const [chartString, setChartStr] = React.useState("")

    const setChartString = ({type, legend, data}) => {
        setChartStr(`<chart type="${type}" isLegendOn="${legend}" data="${JSON.stringify(data).replace(/\"/g, "'")}"></chart>`)
    }

    const resetChartStr = () => setChartStr("")

    return (
        <ChartContext.Provider value={{ chartString, resetChartStr, setChartString }}>
            {children}
        </ChartContext.Provider>
    )
}