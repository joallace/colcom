import React from 'react';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import { mergeAttributes, Node } from '@tiptap/core'

import Chart from "@/components/Chart"
import ChartModal from './ChartModal';

export const TipTapChart = props => {
  const [data, setData] = React.useState(JSON.parse(props.node.attrs.data.replace(/'/g, "\"")))
  const [modal, setModal] = React.useState(false)
  const [isLegendOn, setIsLegendOn] = React.useState(props.node.attrs.isLegendOn)
  const type = props.node.attrs.type

  return (
    <>
      <NodeViewWrapper className="chart" onDoubleClick={() => setModal(true)}>
        <Chart
          type={type}
          data={data}
          width={500}
          height={300}
          isLegendOn={isLegendOn}

        />
      </NodeViewWrapper>

      <ChartModal
        editionMode
        isOpen={modal}
        setIsOpen={setModal}
        currentData={data}
        currentType={type}
        setChartOutput={setData}
        setIsLegendOn={setIsLegendOn}
      />
    </>
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