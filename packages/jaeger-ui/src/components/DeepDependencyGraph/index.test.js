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
import { shallow } from 'enzyme';
import cloneDeep from 'lodash/cloneDeep';
import _set from 'lodash/set';

import { DeepDependencyGraphPageImpl, mapDispatchToProps, mapStateToProps } from '.';
import ErrorMessage from '../common/ErrorMessage';
import LoadingIndicator from '../common/LoadingIndicator';
import { fetchedState } from '../../constants';
import * as extractQuery from '../../model/ddg/extractQuery';

describe('DeepDependencyGraphPage', () => {
  describe('DeepDependencyGraphPageImpl', () => {
    describe('shouldComponentUpdate', () => {
      const props = {
        start: 'testStart',
        end: 'testEnd',
        service: 'testService',
        operation: 'testOperation',
        graphState: {
          uxState: new Map(),
          state: fetchedState.DONE,
        },
      };
      const ddgPageImpl = new DeepDependencyGraphPageImpl(props);

      it('returns false if props are unchanged', () => {
        expect(ddgPageImpl.shouldComponentUpdate({ ...props })).toBe(false);
      });

      it('returns false if irrelevant prop is changed', () => {
        expect(ddgPageImpl.shouldComponentUpdate({ ...props, irrelevantProp: 'ignored' })).toBe(false);
      });

      it('returns false if graphState uxState prop is changed', () => {
        const graphState = {
          ...props.graphState,
          uxState: new Map([[3, 4]]),
        };
        expect(ddgPageImpl.shouldComponentUpdate({ ...props, graphState })).toBe(false);
      });

      it('returns true if certain props change', () => {
        ['service', 'operation', 'start', 'end', 'graphState.state'].forEach(prop => {
          const newProps = cloneDeep(props);
          _set(newProps, prop, 'new value');
          expect(ddgPageImpl.shouldComponentUpdate(newProps)).toBe(true);
        });
      });
    });

    describe('render', () => {
      it('renders message to query a ddg when no graphState is provided', () => {
        const message = shallow(<DeepDependencyGraphPageImpl />)
          .find('h1')
          .last();
        expect(message.text()).toBe('Enter query above');
      });

      it('renders LoadingIndicator when loading', () => {
        const wrapper = shallow(<DeepDependencyGraphPageImpl graphState={{ state: fetchedState.LOADING }} />);
        expect(wrapper.find(LoadingIndicator)).toHaveLength(1);
      });

      it('renders ErrorMessage when erred', () => {
        const error = 'Some API error';
        const errorComponent = shallow(
          <DeepDependencyGraphPageImpl graphState={{ error, state: fetchedState.ERROR }} />
        ).find(ErrorMessage);
        expect(errorComponent).toHaveLength(1);
        expect(errorComponent.prop('error')).toBe(error);
      });

      it('renders graph when done', () => {
        const graphStandin = shallow(
          <DeepDependencyGraphPageImpl graphState={{ state: fetchedState.DONE }} />
        )
          .find('h1')
          .last();
        expect(graphStandin.text()).toBe('Loaded');
      });

      it('renders indication of unknown graphState', () => {
        const state = 'invalid state';
        const unknownIndication = shallow(<DeepDependencyGraphPageImpl graphState={{ state }} />)
          .find('div')
          .find('div')
          .last()
          .text();
        expect(unknownIndication).toMatch(new RegExp(state));
        expect(unknownIndication).toMatch(/Unknown graphState/);
      });
    });
  });

  describe('mapDispatchToProps()', () => {
    it('creates the actions correctly', () => {
      expect(mapDispatchToProps(() => {})).toEqual({
        fetchDeepDependencyGraph: expect.any(Function),
      });
    });
  });

  describe('mapStateToProps()', () => {
    const start = 'testStart';
    const end = 'testEnd';
    const service = 'testService';
    const operation = 'testOperation';
    const search = '?someParam=someValue';
    const expected = {
      start,
      end,
      service,
      operation,
    };
    let querySpy;

    beforeAll(() => {
      querySpy = jest.spyOn(extractQuery, 'default');
    });

    beforeEach(() => {
      querySpy.mockReset();
    });

    it('uses gets relevant params from location.search', () => {
      querySpy.mockReturnValue(expected);
      const result = mapStateToProps({}, { location: { search } });
      expect(result).toEqual(expected);
      expect(querySpy).toHaveBeenLastCalledWith(search);
    });

    it('includes graphState iff location.search has service, start, end, and optionally operation', () => {
      const graphState = 'testGraphState';
      const graphStateWithoutOp = 'testGraphStateWithoutOp';
      const reduxState = {};
      _set(reduxState, ['deepDependencyGraph', service, operation, start, end], graphState);
      _set(reduxState, ['deepDependencyGraph', service, '*', start, end], graphStateWithoutOp);

      querySpy.mockReturnValue(expected);
      const result = mapStateToProps(reduxState, { location: { search } });
      expect(result.graphState).toEqual(graphState);

      const { operation: _op, ...rest } = expected;
      querySpy.mockReturnValue(rest);
      const resultWithoutOp = mapStateToProps(reduxState, { location: { search } });
      expect(resultWithoutOp.graphState).toEqual(graphStateWithoutOp);

      querySpy.mockReturnValue({});
      const resultWithoutParams = mapStateToProps(reduxState, { location: { search } });
      expect(resultWithoutParams.graphState).toBeUndefined();
    });
  });
});
