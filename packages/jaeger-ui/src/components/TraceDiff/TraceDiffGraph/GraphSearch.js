// @flow

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

import * as React from 'react';
import { Icon, Input } from 'antd';
import _debounce from 'lodash/debounce';
import { connect } from 'react-redux';
import { withRouter } from 'react-router-dom';
import queryString from 'query-string';

import type { Location, /* Match, */ RouterHistory } from 'react-router-dom';

import prefixUrl from '../../../utils/prefix-url';

import type { ReduxState } from '../../../types/index';

import './GraphSearch.css';

type propsType = {
  graphSearch?: string,
  history: RouterHistory,
  location: Location,
};

type stateType = {
  ownInputValue: string,
};

export class UnconnectedGraphSearch extends React.PureComponent<propsType, stateType> {
  inputRef: ?Input;
  static defaultProps = {
    graphSearch: null,
  };

  constructor(props: propsType) {
    super(props);
    this.state = {
      ownInputValue: '',
    };
    this.inputRef = null;
  }

  handleIconClick = () => this.inputRef && this.inputRef.focus();

  handleInputChange = (evt: SyntheticInputEvent<HTMLInputElement>) => {
    const { value } = evt.target;
    this.updateGraphSearchQueryParam(value);
    this.setState({ ownInputValue: value });
  };

  registerInputRef = (ref: ?Input) => {
    this.inputRef = ref;
  };

  updateGraphSearchQueryParam = _debounce((graphSearchQueryParam: ?string) => {
    const { graphSearch, ...queryParams } = queryString.parse(this.props.location.search);
    if (graphSearchQueryParam) {
      queryParams.graphSearch = graphSearchQueryParam;
    }
    this.props.history.replace(prefixUrl(`?${queryString.stringify(queryParams)}`));
  }, 350);

  render() {
    return (
      <div className="GraphSearch">
        <Input
          className="GraphSearch--input"
          onChange={this.handleInputChange}
          ref={this.registerInputRef}
          value={this.state.ownInputValue || this.props.graphSearch}
        />
        <Icon
          className="GraphSearch--icon"
          height="2em"
          width="2em"
          onClick={this.handleIconClick}
          type="search"
        />
      </div>
    );
  }
}

export function mapStateToProps(state: ReduxState): { graphSearch?: string } {
  const { graphSearch } = queryString.parse(state.router.location.search);
  return { graphSearch };
}

export default withRouter(connect(mapStateToProps)(UnconnectedGraphSearch));
