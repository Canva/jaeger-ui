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

import {
  PathElem,
  TDdgModel,
  TDdgPayload,
  TDdgPayloadEntry,
  TDdgPath,
  TDdgDistanceToPathElems,
  TDdgServiceMap,
  TDdgVisIdxToPathElem,
} from './types';

const stringifyEntry = ({ service, operation }: TDdgPayloadEntry) => `${service}\v${operation}`;

export default function transformDdgData(
  payload: TDdgPayload,
  { service: focalService, operation: focalOperation }: { service: string; operation?: string }
): TDdgModel {
  const serviceMap: TDdgServiceMap = new Map();
  const distanceToPathElems: TDdgDistanceToPathElems = new Map();
  const pathCompareValues: Map<TDdgPayloadEntry[], string> = new Map();

  const paths = payload
    .slice()
    .sort((a, b) => {
      let aCompareValue = pathCompareValues.get(a);
      if (!aCompareValue) {
        aCompareValue = a.map(stringifyEntry).join();
        pathCompareValues.set(a, aCompareValue);
      }
      let bCompareValue = pathCompareValues.get(b);
      if (!bCompareValue) {
        bCompareValue = b.map(stringifyEntry).join();
        pathCompareValues.set(b, bCompareValue);
      }
      if (aCompareValue > bCompareValue) return 1;
      if (aCompareValue < bCompareValue) return -1;
      return 0;
    })
    .map(payloadPath => {
      // Path with stand-in values is necessary for assigning PathElem.memberOf
      const path: TDdgPath = { focalIdx: -1, members: [] };

      path.members = payloadPath.map(({ operation: operationName, service: serviceName }, i) => {
        // Ensure pathElem.service exists, else create it
        let service = serviceMap.get(serviceName);
        if (!service) {
          service = {
            name: serviceName,
            operations: new Map(),
          };
          serviceMap.set(serviceName, service);
        }

        // Ensure service has operation, else add it
        let operation = service.operations.get(operationName);
        if (!operation) {
          operation = {
            name: operationName,
            service,
            pathElems: [],
          };
          service.operations.set(operationName, operation);
        }

        // Set focalIdx to first occurrence of focalNode
        if (
          path.focalIdx === -1 &&
          serviceName === focalService &&
          (focalOperation == null || operationName === focalOperation)
        ) {
          path.focalIdx = i;
        }

        const pathElem = new PathElem({ path, operation, memberIdx: i });
        operation.pathElems.push(pathElem);
        return pathElem;
      });

      if (path.focalIdx === -1) {
        throw new Error('A payload path lacked the focalNode');
      }

      // Track all pathElems by their distance for visibilityIdx assignment and hop management
      // This needs to be a separate loop as path.focalIdx must be set before distance can be calculated
      path.members.forEach(member => {
        const elems = distanceToPathElems.get(member.distance);
        if (elems) {
          elems.push(member);
        } else {
          distanceToPathElems.set(member.distance, [member]);
        }
      });

      return path;
    });

  // Assign visibility indices such there is a positive, dependent correlation between visibilityIdx and distance
  let downstream = 0;
  let downstreamElems: PathElem[] | void;
  let upstream = 1;
  let upstreamElems: PathElem[] | void;
  let visIdx = 0;
  const visIdxToPathElem: TDdgVisIdxToPathElem = new Map();
  function setIdx(pathElem: PathElem) {
    visIdxToPathElem.set(visIdx, pathElem);
    pathElem.visibilityIdx = visIdx++; // eslint-disable-line no-param-reassign
  }
  do {
    downstreamElems = distanceToPathElems.get(downstream--);
    upstreamElems = distanceToPathElems.get(upstream++);
    if (downstreamElems) downstreamElems.forEach(setIdx);
    if (upstreamElems) upstreamElems.forEach(setIdx);
  } while (downstreamElems || upstreamElems);

  return {
    paths,
    distanceToPathElems,
    services: serviceMap,
    visIdxToPathElem,
  };
}
