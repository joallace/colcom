import React from 'react';
import { NodeViewWrapper } from '@tiptap/react'

import Chart from "@/components/primitives/Chart"
import ChartModal from "@/components/Editor/ChartModal"

// How the editor draws a chart node (`TipTapChart`); double-clicking it opens the modal to edit it.
// A critique highlight on it is drawn as an outline, through its data attributes.
export default function ChartNodeView(props) {
  const [data, setData] = React.useState(JSON.parse(props.node.attrs.data.replace(/'/g, "\"")))
  const [modal, setModal] = React.useState(false)
  const [isLegendOn, setIsLegendOn] = React.useState(props.node.attrs.isLegendOn)
  const type = props.node.attrs.type
  const readOnly = props.node.attrs.readOnly
  const { highlight, highlightIndex, highlightLevel } = props.node.attrs

  // A criticised chart opens its critiques when clicked, as a highlighted passage does
  const openCritiques = () => {
    if (highlightIndex != null)
      props.extension.options.setShowCritique(String(highlightIndex))
  }

  return (
    <>
      <NodeViewWrapper
        className="chart"
        data-highlight={highlight ?? undefined}
        data-commit-index={highlightIndex ?? undefined}
        data-level={highlightLevel ?? undefined}
        onClick={openCritiques}
        onDoubleClick={() => !readOnly && setModal(true)}
      >
        <Chart
          type={type}
          data={data}
          width={500}
          height={300}
          isLegendOn={isLegendOn}

        />
      </NodeViewWrapper>

      {modal &&
        <ChartModal
          editionMode
          isOpen={modal}
          setIsOpen={setModal}
          currentData={data}
          currentType={type}
          setChartOutput={setData}
          setIsLegendOn={setIsLegendOn}
        />
      }
    </>
  );
}
