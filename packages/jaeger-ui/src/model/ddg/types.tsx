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

import { TVertex } from '@jaegertracing/plexus/lib/types';

import PathElem from './PathElem';
import { fetchedState } from '../../constants';
import { ApiError } from '../../types/api-error';

export { default as PathElem } from './PathElem';

export type TDdgPayloadEntry = {
  operation: string;
  service: string;
};

export type TDdgPayload = TDdgPayloadEntry[][];

export type TDdgService = {
  name: string;
  operations: Map<string, TDdgOperation>;
};

export type TDdgOperation = {
  name: string;
  pathElems: PathElem[];
  service: TDdgService;
};

export type TDdgServiceMap = Map<string, TDdgService>;

export type TDdgPath = {
  focalIdx: number;
  members: PathElem[];
};

export type TDdgDistanceToPathElems = Map<number, PathElem[]>;

export type TDdgModel = {
  distanceToPathElems: TDdgDistanceToPathElems;
  paths: TDdgPath[];
  services: TDdgServiceMap;
  visIdxToPathElem: PathElem[];
};

export type TDdgVertex = TVertex<{ service: string; operation: string }>;

export type TDdgStateEntry =
  | {
      state: typeof fetchedState.LOADING;
    }
  | {
      error: ApiError;
      state: typeof fetchedState.ERROR;
    }
  | {
      model: TDdgModel;
      state: typeof fetchedState.DONE;
      styleStates: Map<number, number>;
    };

export type TDdgState = Record<string, Record<string, Record<string, Record<string, TDdgStateEntry>>>>;

export enum EViewModifier {
  None,
  Hovered,
  Selected,
  Emphasized = 1 << 2, // eslint-disable-line no-bitwise
}

export type TDdgRequiredUrlState = {
  service: string;
  operation?: string;
  start: number;
  end: number;
};

export type TDdgActionMeta = {
  query: TDdgRequiredUrlState;
};

export type TDdgAddStylePayload = TDdgRequiredUrlState & { visibilityIndices: number[]; style: number };

export type TDdgClearStylePayload = TDdgRequiredUrlState & { visibilityIndices?: number[]; style?: number };
