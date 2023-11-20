import React from 'react';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import { mergeAttributes, Node } from '@tiptap/core'

import Chart from "@/components/Chart"

export const TipTapChart = props => {
  const data = JSON.parse(props.node.attrs.data.replace(/'/g, "\""))
  const type = props.node.attrs.type
  const isLegendOn = props.node.attrs.isLegendOn

  return (
    <NodeViewWrapper className="chart">
      <Chart
        type={type}
        data={data}
        width={500}
        height={300}
        isLegendOn={isLegendOn}
      />
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
      "type": {
        default: "line"
      },
      "isLegendOn": {
        default: true
      }
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
    return ReactNodeViewRenderer(TipTapChart)
  },
})