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

import { EDdgEdgeKeys, TDdgOperation, TDdgPath } from './types';

export default class PathElem {
  memberIdx: number;
  memberOf: TDdgPath;
  operation: TDdgOperation;
  private _visibilityIdx?: number;

  constructor({
    path,
    operation,
    memberIdx,
  }: {
    path: TDdgPath;
    operation: TDdgOperation;
    memberIdx: number;
  }) {
    this.memberIdx = memberIdx;
    this.memberOf = path;
    this.operation = operation;
  }

  get distance() {
    return this.memberIdx - this.memberOf.focalIdx;
  }

  set visibilityIdx(visibilityIdx: number) {
    if (this._visibilityIdx == null) {
      this._visibilityIdx = visibilityIdx;
    } else {
      throw new Error('Visibility Index cannot be changed once set');
    }
  }

  get visibilityIdx(): number {
    if (this._visibilityIdx == null) {
      throw new Error('Visibility Index was never set for this PathElem');
    }
    return this._visibilityIdx;
  }

  get focalSideNeighbor(): PathElem | null {
    if (!this.distance) return null;
    return this.memberOf.members[this.memberIdx - this.distance / Math.abs(this.distance)];
  }

  get focalSideEdgesKey(): EDdgEdgeKeys {
    return this.distance < 0 ? EDdgEdgeKeys.egressEdges : EDdgEdgeKeys.ingressEdges;
  }

  get farSideEdgesKey(): EDdgEdgeKeys {
    return this.distance > 0 ? EDdgEdgeKeys.egressEdges : EDdgEdgeKeys.ingressEdges;
  }

  private toJSONHelper = () => ({
    memberIdx: this.memberIdx,
    operation: this.operation.name,
    service: this.operation.service.name,
    visibilityIdx: this._visibilityIdx,
  });

  /* 
   * Because the memberOf on a PathElem contains an array of all of its members which in turn all contain
   * memberOf back to the path, some assistance is necessary when creating error messages. toJSON is called by
   * JSON.stringify and expected to return a JSON object. To that end, this method simplifies the
   * representation of the PathElems in memberOf's path.
   */
  toJSON() {
    return {
      ...this.toJSONHelper(),
      memberOf: {
        focalIdx: this.memberOf.focalIdx,
        members: this.memberOf.members.map(member => member.toJSONHelper()),
      },
    };
  }

  toString() {
    return JSON.stringify(this.toJSON(), null, 2);
  }

  get [Symbol.toStringTag]() {
    return `PathElem ${this._visibilityIdx}`;
  }
}
