import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import { mergeAttributes, Node } from '@tiptap/core'

import { defaultOrange, defaultGreen, defaultYellow } from "@/assets/scss/_export.module.scss"
import useScreenSize from '@/hooks/useScreenSize';


export const TipTapLineChart = props => {
  const data = JSON.parse(props.node.attrs.data.replace(/'/g, "\""))
  let isDesktop = useScreenSize()

  const defaultColors = [defaultOrange, defaultGreen, defaultYellow]

  console.log(props.node.attrs)

  if(data)
    return (
      <NodeViewWrapper className="chart">
        <LineChart
          width={500 * (isDesktop ? 1 : 0.7)}
          height={300 * (isDesktop ? 1 : 0.7)}
          data={data}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" fontSize={isDesktop ? null : 10} foc/>
          <YAxis fontSize={isDesktop ? null : 10} />
          <Tooltip />
          <Legend />
          {Object.keys(data[0]).map((row, index) => {
              if (row !== "name")
                return <Line type="monotone" dataKey={row} stroke={defaultColors[index-1]} activeDot={{ r: 8 }} />
          })}

        </LineChart>
      </NodeViewWrapper>
    );
}

export default Node.create({
  name: 'chart',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      "data": {
        default: [],
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'chart',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['chart', mergeAttributes(HTMLAttributes)]
  },

  addNodeView() {
    return ReactNodeViewRenderer(TipTapLineChart)
  },
})