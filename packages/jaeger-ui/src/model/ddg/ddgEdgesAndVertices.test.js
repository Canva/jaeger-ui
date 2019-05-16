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

import * as testResources from './sample-paths.test.resources';
import transformDdgData from './transformDdgData';
import { changeVisibility, createVisibilityKey } from './visibility-key'

import DdgEdgesAndVertices from './ddgEdgesAndVertices';

describe('DdgEdgesAndVertices', () => {
  function validateDdgEV(ddgEV, expectedVertices) {
    let expectedEdgeCount = 0;
    expectedVertices.forEach(({ visibilityIndices, ingressNeighborVisibilityIndices = [], egressNeighborVisibilityIndices = [] }) => {
      const pathElems = visibilityIndices.map(visibilityIdx => ddgEV.visibilityIdxToPathElem.get(visibilityIdx));
      const vertex = ddgEV.pathElemToVertex.get(pathElems[0]);
      // expect(vertex.pathElems).toEqual(new Set(pathElems));

      expectedEdgeCount += ingressNeighborVisibilityIndices.length;
      ingressNeighborVisibilityIndices.forEach(ingressNeighborVisibilityIdx => {
        const ingressNeighbor = ddgEV.pathElemToVertex.get(ddgEV.visibilityIdxToPathElem.get(ingressNeighborVisibilityIdx));
        const edge = vertex.ingressEdges.get(ingressNeighbor);
        expect(edge).toBeDefined();
        expect(ingressNeighbor.egressEdges.get(vertex)).toBe(edge);
        expect(edge.to).toBe(vertex);
        expect(edge.from).toBe(ingressNeighbor);
      });

      expectedEdgeCount += egressNeighborVisibilityIndices.length;
      egressNeighborVisibilityIndices.forEach(egressNeighborVisibilityIdx => {
        const egressNeighbor = ddgEV.pathElemToVertex.get(ddgEV.visibilityIdxToPathElem.get(egressNeighborVisibilityIdx));
        const edge = vertex.egressEdges.get(egressNeighbor);
        expect(edge).toBeDefined();
        expect(egressNeighbor.ingressEdges.get(vertex)).toBe(edge);
        expect(edge.to).toBe(egressNeighbor);
        expect(edge.from).toBe(vertex);
      });
    });

    expect(ddgEV.vertices.size).toBe(expectedVertices.length);
    expect(ddgEV.edges.size).toBe(expectedEdgeCount / 2);
  }

  const simpleDdgModel = transformDdgData(
    [testResources.simplePath],
    testResources.focalPathElem
  );
  describe('getVertexKey', () => {
    const simpleTestfocalPathElem = simpleDdgModel.paths[0].members[2];
    const expectedKeyEntry = pathElem => `${pathElem.operation.service.name}::${pathElem.operation.name}`;
    const expectedFocalPathElemKey = expectedKeyEntry(simpleTestfocalPathElem);
    const emptyDdgEdgesAndVertices = new DdgEdgesAndVertices({ ddgModel: {} });

    it('creates key for focal pathElem', () => {
      expect(emptyDdgEdgesAndVertices.getVertexKey(simpleTestfocalPathElem)).toBe(expectedFocalPathElemKey);
    });

    it('creates key for downstream pathElem', () => {
      const targetPathElem = simpleDdgModel.paths[0].members[0];
      const interimPathElem = simpleDdgModel.paths[0].members[1];
      expect(emptyDdgEdgesAndVertices.getVertexKey(targetPathElem)).toBe([
        expectedKeyEntry(targetPathElem),
        expectedKeyEntry(interimPathElem),
        expectedFocalPathElemKey,
      ].join('|'));
    });

    it('creates key for downstream pathElem', () => {
      const targetPathElem = simpleDdgModel.paths[0].members[4];
      const interimPathElem = simpleDdgModel.paths[0].members[3];
      expect(emptyDdgEdgesAndVertices.getVertexKey(targetPathElem)).toBe([
        expectedFocalPathElemKey,
        expectedKeyEntry(interimPathElem),
        expectedKeyEntry(targetPathElem),
      ].join('|'));
    });
  });

  describe('simple one-path one-hop ddg', () => {
    let simpleTestDdgEV;
    const oneHopVisibilityKey = createVisibilityKey([0,1,2]);
    /*
    let downstreamPathElem;
    let downstreamVertex;
    let focalPathElem;
    let focalVertex;
    let upstreamPathElem;
    let upstreamVertex;

    function updatePathElemsAndVertices() {
      downstreamPathElem = simpleTestDdgEV.pathElemsByDistance.get(-1)[0];
      downstreamVertex = simpleTestDdgEV.pathElemToVertex.get(downstreamPathElem);
      focalPathElem = simpleTestDdgEV.pathElemsByDistance.get(0)[0];
      focalVertex = simpleTestDdgEV.pathElemToVertex.get(focalPathElem);
      upstreamPathElem = simpleTestDdgEV.pathElemsByDistance.get(1)[0];
      upstreamVertex = simpleTestDdgEV.pathElemToVertex.get(upstreamPathElem);
    }
    */

    beforeEach(() => {
      simpleTestDdgEV = new DdgEdgesAndVertices({
        ddgModel: simpleDdgModel,
      });
      simpleTestDdgEV.getEdgesAndVertices(oneHopVisibilityKey);
    });

    it('creates three vertices and two edges for one-path one-hop ddg', () => {
      /*
      updatePathElemsAndVertices();
      expect(simpleTestDdgEV.vertices.size).toBe(3);
      expect(simpleTestDdgEV.edges.size).toBe(2);

      expect(upstreamVertex).toBeDefined();
      expect(upstreamVertex.pathElems.size).toBe(1);
      expect(upstreamVertex.pathElems.has(upstreamPathElem)).toBe(true);
      expect(upstreamVertex.ingressEdges.size).toBe(1);
      expect(upstreamVertex.egressEdges.size).toBe(0);

      expect(focalVertex).toBeDefined();
      expect(focalVertex.pathElems.size).toBe(1);
      expect(focalVertex.pathElems.has(focalPathElem)).toBe(true);
      expect(focalVertex.ingressEdges.size).toBe(1);
      expect(focalVertex.egressEdges.size).toBe(1);

      expect(downstreamVertex).toBeDefined();
      expect(downstreamVertex.pathElems.size).toBe(1);
      expect(downstreamVertex.pathElems.has(downstreamPathElem)).toBe(true);
      expect(downstreamVertex.ingressEdges.size).toBe(0);
      expect(downstreamVertex.egressEdges.size).toBe(1);

      const ingressEdge = focalVertex.ingressEdges.get(downstreamVertex);
      const egressEdge = focalVertex.egressEdges.get(upstreamVertex);
      expect(ingressEdge.from).toBe(downstreamVertex);
      expect(ingressEdge.to).toBe(focalVertex);
      expect(ingressEdge).toBe(downstreamVertex.egressEdges.get(focalVertex));
      expect(egressEdge.from).toBe(focalVertex);
      expect(egressEdge.to).toBe(upstreamVertex);
      expect(egressEdge).toBe(upstreamVertex.ingressEdges.get(focalVertex));
      */

      validateDdgEV(simpleTestDdgEV, [
        {
          visibilityIndices: [0],
          ingressNeighborVisibilityIndices: [2],
          egressNeighborVisibilityIndices: [1],
        },
        {
          visibilityIndices: [1],
          ingressNeighborVisibilityIndices: [0],
        },
        {
          visibilityIndices: [2],
          egressNeighborVisibilityIndices: [0],
        },
      ]);
    });

    it('removes vertex and edge', () => {
      simpleTestDdgEV.getEdgesAndVertices(changeVisibility({ visibilityKey: oneHopVisibilityKey, hideIndices: [1] }));
      /*
      updatePathElemsAndVertices();

      expect(simpleTestDdgEV.vertices.size).toBe(2);
      expect(simpleTestDdgEV.edges.size).toBe(1);

      expect(upstreamVertex).toBeUndefined();

      expect(focalVertex).toBeDefined();
      expect(focalVertex.pathElems.size).toBe(1);
      expect(focalVertex.pathElems.has(focalPathElem)).toBe(true);
      expect(focalVertex.ingressEdges.size).toBe(1);
      expect(focalVertex.egressEdges.size).toBe(0);

      expect(downstreamVertex).toBeDefined();
      expect(downstreamVertex.pathElems.size).toBe(1);
      expect(downstreamVertex.pathElems.has(downstreamPathElem)).toBe(true);
      expect(downstreamVertex.ingressEdges.size).toBe(0);
      expect(downstreamVertex.egressEdges.size).toBe(1);

      const edge = focalVertex.ingressEdges.get(downstreamVertex);
      expect(edge.from).toBe(downstreamVertex);
      expect(edge.to).toBe(focalVertex);
      expect(edge).toBe(downstreamVertex.egressEdges.get(focalVertex));
      */

      validateDdgEV(simpleTestDdgEV, [
        {
          visibilityIndices: [0],
          ingressNeighborVisibilityIndices: [2],
        },
        {
          visibilityIndices: [2],
          egressNeighborVisibilityIndices: [0],
        },
      ]);

    });
  });

  describe('convergent paths', () => {
    const oneHopVisibilityKey = createVisibilityKey([0,1,2,3,4,5]);
    const downstreamAndFocalValidationParams = [
      {
        visibilityIndices: [0],
        egressNeighborVisibilityIndices: [2,3],
        ingressNeighborVisibilityIndices: [4],
      },
      {
        visibilityIndices: [4,5],
        egressNeighborVisibilityIndices: [0],
      },
    ];
    let convergentDdgEV;

    beforeEach(() => {
      const convergentDdgModel = transformDdgData(
        testResources.convergentPaths,
        testResources.focalPathElem
      );
      convergentDdgEV = new DdgEdgesAndVertices({
        ddgModel: convergentDdgModel,
      });
      convergentDdgEV.getEdgesAndVertices(oneHopVisibilityKey);
    });

    it('creates 3 edges and 4 vertices for initial hop', () => {
      validateDdgEV(convergentDdgEV, [
        ...downstreamAndFocalValidationParams,
        {
          visibilityIndices: [2],
          ingressNeighborVisibilityIndices: [0],
        },
        {
          visibilityIndices: [3],
          ingressNeighborVisibilityIndices: [0],
        },
      ]);
    });

    it('adds separate vertices for equal PathElems that have different focalSideNeighbors', () => {
      convergentDdgEV.getEdgesAndVertices(changeVisibility({ visibilityKey: oneHopVisibilityKey, showIndices: [6,7] }));
      validateDdgEV(convergentDdgEV, [
        ...downstreamAndFocalValidationParams,
        {
          visibilityIndices: [2],
          egressNeighborVisibilityIndices: [6],
          ingressNeighborVisibilityIndices: [0],
        },
        {
          visibilityIndices: [6],
          ingressNeighborVisibilityIndices: [2],
        },
        {
          visibilityIndices: [3],
          egressNeighborVisibilityIndices: [7],
          ingressNeighborVisibilityIndices: [0],
        },
        {
          visibilityIndices: [7],
          ingressNeighborVisibilityIndices: [3],
        },
      ]);
    });
  });
});
