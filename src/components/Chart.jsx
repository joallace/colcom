import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  BarChart,
  Bar,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Tooltip,
  Legend
} from "recharts"

import { defaultOrange, defaultGreen, defaultYellow, defaultBlue, defaultInputBg, defaultFontColor } from "@/assets/scss/_export.module.scss"
import useScreenSize from "@/hooks/useScreenSize"


const desktopMargin = {
  top: 5,
  right: 10,
  left: 10,
  bottom: 5
}

const mobileMargin = {
  top: 10,
  right: 5,
  left: -45,
  bottom: 5
}

export default ({ type, data = [{}], width, height, isLegendOn = true, ...remainingProps }) => {
  const isDesktop = useScreenSize()

  const COLORS = [defaultOrange, defaultGreen, defaultYellow, defaultBlue, defaultFontColor]
  const RADIAN = Math.PI / 180
  const tooltipStyle = {
    backgroundColor: defaultInputBg,
    borderRadius: "0.25rem",
    border: "1px solid #737373"
  }

  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)

    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central">
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    )
  }

  const transformedData = () => data.map(o=>{
    let values = Object.entries(o).slice(1).map(([key, value])=>[key, parseFloat(value)])
    return {"0name": o["0name"], ...Object.fromEntries(values)}
  })

  switch (type) {
    case "line":
      return (
        <LineChart
          width={width * (isDesktop ? 1 : 0.7)}
          height={height * (isDesktop ? 1 : 0.7)}
          data={transformedData()}
          margin={isDesktop? desktopMargin : mobileMargin}
          {...remainingProps}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="0name" fontSize={isDesktop ? null : 10} foc />
          <YAxis fontSize={isDesktop ? null : 10} />
          <Tooltip contentStyle={tooltipStyle} />
          {isLegendOn && <Legend />}
          {
            Object.keys(data[0]).map((row, index) => {
              if (row !== "0name")
                return <Line animationDuration={500} dataKey={row} stroke={COLORS[index % COLORS.length]} />
            })
          }

        </LineChart>
      )
    case "area":
      return (
        <AreaChart
          width={width * (isDesktop ? 1 : 0.7)}
          height={height * (isDesktop ? 1 : 0.7)}
          data={transformedData()}
          margin={isDesktop? desktopMargin : mobileMargin}
          {...remainingProps}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="0name" fontSize={isDesktop ? null : 10} foc />
          <YAxis fontSize={isDesktop ? null : 10} />
          <Tooltip contentStyle={tooltipStyle} />
          {isLegendOn && <Legend />}
          {
            Object.keys(data[0]).map((row, index) => {
              if (row !== "0name")
                return <Area animationDuration={500} dataKey={row} stroke={COLORS[index % COLORS.length]} fill={COLORS[index % COLORS.length]} />
            })
          }
        </AreaChart>
      )
    case "bar":
      return (
        <BarChart
          width={width * (isDesktop ? 1 : 0.7)}
          height={height * (isDesktop ? 1 : 0.7)}
          data={transformedData()}
          margin={isDesktop? desktopMargin : mobileMargin}
          {...remainingProps}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="0name" />
          <YAxis />
          <Tooltip contentStyle={tooltipStyle} />
          {isLegendOn && <Legend />}
          {
            Object.keys(data[0]).map((row, index) => {
              if (row !== "0name")
                return <Bar dataKey={row} fill={COLORS[index % COLORS.length]} />
            })
          }
        </BarChart>
      )
    case "pie":
      return (
        <PieChart
          width={width * (isDesktop ? 1 : 0.7)}
          height={height * (isDesktop ? 1 : 0.7)}
          // margin={isDesktop? desktopMargin : mobileMargin}
          {...remainingProps}
        >
          <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: defaultFontColor }} />
          {isLegendOn && <Legend />}
          <Pie
            dataKey="0value"
            data={transformedData()}
            animationDuration={500}
            cx="50%"
            cy="50%"
            label={renderCustomizedLabel}
            labelLine={false}
            outerRadius={width * (isDesktop ? 1 : 0.7) / 5}
          >
            {
              Object.keys(data).map((row, index) => {
                return <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              })
            }
          </Pie>
        </PieChart>
      )
    case "scatter":
      return (
        <ScatterChart
          width={width * (isDesktop ? 1 : 0.7)}
          height={height * (isDesktop ? 1 : 0.7)}
          margin={isDesktop? desktopMargin : mobileMargin}
          {...remainingProps}
        >
          <CartesianGrid />
          <XAxis type="number" dataKey="0x" name="stature" unit="cm" />
          <YAxis type="number" dataKey="0y" name="weight" unit="kg" />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={tooltipStyle} itemStyle={{ color: defaultFontColor }} />
          <Scatter data={data} fill={defaultOrange} />
        </ScatterChart>
      )
    case "radar":
      return (
        <RadarChart
          cx="50%"
          cy="50%"
          outerRadius="80%"
          width={width * (isDesktop ? 1 : 0.7)}
          height={height * (isDesktop ? 1 : 0.7)}
          data={transformedData()}
          // margin={isDesktop? desktopMargin : mobileMargin}
          {...remainingProps}
        >
          <PolarGrid />
          <PolarAngleAxis dataKey="0name" />
          <PolarRadiusAxis />
          <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: defaultFontColor }} />
          {isLegendOn && <Legend />}
          {
            Object.keys(data[0]).map((row, index) => {
              if (row !== "0name")
                return <Radar animationDuration={500} dataKey={row} stroke={COLORS[index % COLORS.length]} fill={COLORS[index % COLORS.length]} fillOpacity={0.6} />
            })
          }
        </RadarChart>
      )
  }
}