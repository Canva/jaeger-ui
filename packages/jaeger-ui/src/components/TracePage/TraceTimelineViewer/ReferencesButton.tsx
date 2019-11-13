// Copyright (c) 2019 Uber Technologies, Inc.
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

import React from 'react';
import { Dropdown, Menu, Tooltip } from 'antd';
import IoNetwork from 'react-icons/lib/io/network';
import { bindActionCreators } from 'redux';
import { connect, Dispatch } from 'react-redux';
import { withRouter } from 'react-router-dom';
import { History as RouterHistory, Location } from 'history';

import './ReferencesButton.css';

import { FetchedTrace, ReduxState, TNil } from '../../../types';
import { actions as timelineActions } from './duck';
import { extractUiFindFromState } from '../../common/UiFindInput';
import { SpanReference, Trace } from '../../../types/trace';
import updateUiFind from '../../../utils/update-ui-find';

type TDispatchProps = {
  focusUiFindMatches: (trace: Trace, uiFind: string | TNil) => void;
};

type TReduxProps = {
  uiFind: string | TNil;
  trace: FetchedTrace | TNil;
};

type TOwnProps = {
  references: SpanReference[];
  traceID: string;
  history: RouterHistory;
  location: Location;
  match: any;
};

type TReferencesButtonProps = TDispatchProps & TReduxProps & TOwnProps;

class ReferencesButtonImpl extends React.PureComponent<TReferencesButtonProps> {
  focusUiFindMatches = (uiFind: string) => {
    const { trace, focusUiFindMatches, location, history } = this.props;
    if (trace && trace.data) {
      updateUiFind({
        location,
        history,
        uiFind,
      });
      focusUiFindMatches(trace.data, uiFind);
    }
  };

  referencesList = (references: SpanReference[]) => (
    <Menu>
      {references.map(({ span, spanID }) => (
        <Menu.Item key={`${spanID}`}>
          <a role="button" onClick={() => this.focusUiFindMatches(spanID)}>
            {span ? `${span.operationName} - ${spanID}` : spanID}
          </a>
        </Menu.Item>
      ))}
    </Menu>
  );

  render() {
    const { references } = this.props;

    return (
      <Tooltip arrowPointAtCenter mouseLeaveDelay={0.5} placement="left" title="Contains multiple references">
        <Dropdown overlay={this.referencesList(references)} placement="bottomRight" trigger={['click']}>
          <a className="multi-parent-button">
            <IoNetwork />
          </a>
        </Dropdown>
      </Tooltip>
    );
  }
}

export function mapDispatchToProps(dispatch: Dispatch<ReduxState>): TDispatchProps {
  const { focusUiFindMatches } = bindActionCreators(timelineActions, dispatch);
  return { focusUiFindMatches };
}

// export for tests
export function mapStateToProps(state: ReduxState, ownProps: TOwnProps): TReduxProps {
  const { traces } = state.trace;
  const trace = ownProps.traceID ? traces[ownProps.traceID] : null;
  return {
    trace,
    ...extractUiFindFromState(state),
  };
}

export default withRouter(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )(ReferencesButtonImpl)
);
