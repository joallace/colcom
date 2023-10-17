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

import { defaultOrange, defaultGreen, defaultYellow, defaultInputBg } from "@/assets/scss/_export.module.scss"
import useScreenSize from "@/hooks/useScreenSize"

export default ({ type, data = [{}], width, height, ...remainingProps }) => {
  const COLORS = [defaultOrange, defaultGreen, defaultYellow]
  let isDesktop = useScreenSize()

  const tooltipStyle = {
    "backgroundColor": defaultInputBg,
    borderRadius: "0.25rem",
    border: "1px solid #737373"
  }

  switch (type) {
    case "line":
      return (
        <LineChart
          width={width * (isDesktop ? 1 : 0.7)}
          height={height * (isDesktop ? 1 : 0.7)}
          data={data}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5,
          }}
          {...remainingProps}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" fontSize={isDesktop ? null : 10} foc />
          <YAxis fontSize={isDesktop ? null : 10} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend />
          {
            Object.keys(data[0]).map((row, index) => {
              if (row !== "name")
                return <Line dataKey={row} stroke={COLORS[index % COLORS.length]} />
            })
          }

        </LineChart>
      )
    case "area":
      return (
        <AreaChart
          width={width * (isDesktop ? 1 : 0.7)}
          height={height * (isDesktop ? 1 : 0.7)}
          data={data}
          margin={{
            top: 10,
            right: 30,
            left: 0,
            bottom: 0,
          }}
          {...remainingProps}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" fontSize={isDesktop ? null : 10} foc />
          <YAxis fontSize={isDesktop ? null : 10} />
          <Tooltip contentStyle={tooltipStyle} />
          {
            Object.keys(data[0]).map((row, index) => {
              if (row !== "name")
                return <Area type="monotone" dataKey={row} stroke={COLORS[index % COLORS.length]} />
            })
          }
        </AreaChart>
      )
    case "bar":
      return (
        <BarChart
          width={width * (isDesktop ? 1 : 0.7)}
          height={height * (isDesktop ? 1 : 0.7)}
          data={data}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5,
          }}
          {...remainingProps}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend />
          {/* <Bar dataKey="pv" fill="#8884d8" activeBar={<Rectangle fill="pink" stroke="blue" />} />
          <Bar dataKey="uv" fill="#82ca9d" activeBar={<Rectangle fill="gold" stroke="purple" />} /> */}
          {
            Object.keys(data[0]).map((row, index) => {
              if (row !== "name")
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
          {...remainingProps}
        >
          <Pie
            dataKey="value"
            isAnimationActive={false}
            data={data}
            cx="50%"
            cy="50%"
            outerRadius={80}
            fill="#8884d8"
            label
          >
            {
              Object.keys(data[0]).map((row, index) => {
                if (row !== "name")
                  return <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              })
            }
          </Pie>
        </PieChart>
      )
    case "scatter":
      return (
        <ScatterChart
          margin={{
            top: 20,
            right: 20,
            bottom: 20,
            left: 20,
          }}
          width={width * (isDesktop ? 1 : 0.7)}
          height={height * (isDesktop ? 1 : 0.7)}
          {...remainingProps}
        >
          <CartesianGrid />
          <XAxis type="number" dataKey="x" name="stature" unit="cm" />
          <YAxis type="number" dataKey="y" name="weight" unit="kg" />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={tooltipStyle} />
          <Scatter name="A school" data={data} fill={defaultOrange} />
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
          data={data}
          {...remainingProps}
        >
          <PolarGrid />
          <PolarAngleAxis dataKey="name" />
          <PolarRadiusAxis />
          {
            Object.keys(data[0]).map((row, index) => {
              if (row !== "name")
                return <Radar dataKey={row} stroke={COLORS[index % COLORS.length]} fill={COLORS[index % COLORS.length]} fillOpacity={0.6} />
            })
          }
        </RadarChart>
      )
  }
}