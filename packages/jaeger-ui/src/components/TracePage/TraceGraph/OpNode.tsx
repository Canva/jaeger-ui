// Copyright (c) 2018 The Jaeger Authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import * as React from 'react';
import { Popover } from 'antd';
import cx from 'classnames';

import { TSumSpan } from './types';
import CopyIcon from '../../common/CopyIcon';
import TDagVertex from '../../../model/trace-dag/types/TDagVertex';
import { TNil } from '../../../types';
import colorGenerator from '../../../utils/color-generator';

import './OpNode.css';

type Props = {
  count: number;
  errors: number;
  time: number;
  percent: number;
  selfTime: number;
  percentSelfTime: number;
  operation: string;
  service: string;
  mode: string;
  isUiFindMatch: boolean;
};

export const MODE_SERVICE = 'service';
export const MODE_TIME = 'time';
export const MODE_SELFTIME = 'selftime';

export const HELP_TABLE = (
  <table className="OpNode OpNode--mode-service">
    <tbody>
      <tr>
        <td className="OpNode--metricCell">Count / Error</td>
        <td className="OpNode--labelCell">
          <strong>Service</strong>
        </td>
        <td className="OpNode--metricCell">Avg</td>
      </tr>
      <tr>
        <td className="OpNode--metricCell">Duration</td>
        <td className="OpNode--labelCell">Operation</td>
        <td className="OpNode--metricCell">Self time</td>
      </tr>
    </tbody>
  </table>
);

export function round2(percent: number) {
  return Math.round(percent * 100) / 100;
}

export default class OpNode extends React.PureComponent<Props> {
  render() {
    const {
      count,
      errors,
      time,
      percent,
      selfTime,
      percentSelfTime,
      operation,
      service,
      mode,
      isUiFindMatch,
    } = this.props;

    // Spans over 20 % time are full red - we have probably to reconsider better approach
    let backgroundColor;
    if (mode === MODE_TIME) {
      const percentBoosted = Math.min(percent / 20, 1);
      backgroundColor = [255, 0, 0, percentBoosted].join();
    } else if (mode === MODE_SELFTIME) {
      backgroundColor = [255, 0, 0, percentSelfTime / 100].join();
    } else {
      backgroundColor = colorGenerator
        .getRgbColorByKey(service)
        .concat(0.8)
        .join();
    }

    const className = cx('OpNode', `OpNode--mode-${mode}`, {
      'is-ui-find-match': isUiFindMatch,
    });

    const table = (
      <table className={className} cellSpacing="0">
        <tbody
          className="OpNode--body"
          style={{
            background: `rgba(${backgroundColor})`,
          }}
        >
          <tr>
            <td className="OpNode--metricCell OpNode--count">
              {count} / {errors}
            </td>
            <td className="OpNode--labelCell OpNode--service">
              <strong>{service}</strong>
              <CopyIcon
                className="OpNode--copyIcon"
                copyText={`${service} ${operation}`}
                tooltipTitle="Copy label"
              />
            </td>
            <td className="OpNode--metricCell OpNode--avg">{round2(time / 1000 / count)} ms</td>
          </tr>
          <tr>
            <td className="OpNode--metricCell OpNode--time">
              {time / 1000} ms ({round2(percent)} %)
            </td>
            <td className="OpNode--labelCell OpNode--op">{operation}</td>
            <td className="OpNode--metricCell OpNode--selfTime">
              {selfTime / 1000} ms ({round2(percentSelfTime)} %)
            </td>
          </tr>
        </tbody>
      </table>
    );

    return (
      <Popover overlayClassName="OpNode--popover" mouseEnterDelay={0.25} content={table}>
        {table}
      </Popover>
    );
  }
}

export function getNodeDrawer(mode: string, uiFindVertexKeys: Set<number | string> | TNil) {
  return function drawNode(vertex: TDagVertex<TSumSpan>) {
    const { data, operation, service } = vertex.data;
    return (
      <OpNode
        {...data}
        isUiFindMatch={uiFindVertexKeys ? uiFindVertexKeys.has(vertex.key) : false}
        mode={mode}
        operation={operation}
        service={service}
      />
    );
  };
}
