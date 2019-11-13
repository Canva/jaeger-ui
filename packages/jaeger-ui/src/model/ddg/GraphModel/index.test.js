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

import GraphModel, { makeGraph } from './index';
import {
  convergentPaths,
  doubleFocalPath,
  generationPaths,
  focalPayloadElem,
  simplePath,
  wrap,
} from '../sample-paths.test.resources';
import transformDdgData from '../transformDdgData';
import { ECheckedStatus, EDirection, EDdgDensity } from '../types';
import { encode } from '../visibility-codec';

describe('GraphModel', () => {
  const convergentModel = transformDdgData(wrap(convergentPaths), focalPayloadElem);
  const doubleFocalModel = transformDdgData(wrap([doubleFocalPath, simplePath]), focalPayloadElem);
  const generationModel = transformDdgData(wrap(generationPaths), focalPayloadElem);
  const simpleModel = transformDdgData(wrap([simplePath]), focalPayloadElem);

  describe('constructor', () => {
    /**
     * This function takes in a Graph and validates the structure based on the expected vertices.
     *
     * @param {GraphModel} graph - The Graph to validate.
     * @param {Object[]} expectedVertices - The vertices that the Graph should have.
     * @param {number[]} expectedVertices[].visIndices - The visibility indices that should all share one
     *     DdgVertex.
     * @param {number[]} expectedVertices[].focalSIdeNeighbors - A single visibilityIdx is sufficient to define a
     *     neighboring vertex. For each focalSide visibilityIdx, the expectedVertex should have an
     *     edge connecting the expectedVertex back to the focalSideNeighbor.
     */
    function validateGraph(graph, expectedVertices) {
      let expectedEdgeCount = 0;
      expectedVertices.forEach(({ visIndices, focalSideNeighbors = [] }) => {
        // Validate that all visIndices share the same vertex
        const pathElems = visIndices.map(visIdx => graph.visIdxToPathElem[visIdx]);
        const vertices = pathElems.map(elem => graph.pathElemToVertex.get(elem));
        const vertex = vertices[0];
        expect(new Set(vertices)).toEqual(new Set([vertex]));
        // Validate that the common vertex is associated with all of its pathElems
        expect(graph.vertexToPathElems.get(vertex)).toEqual(new Set(pathElems));

        // Validate that there is an edge connecting the vertex with each expected focalSideNeighbor
        expectedEdgeCount += focalSideNeighbors.length;
        const focalSideEdges = Array.from(
          new Set(pathElems.map(elem => graph.pathElemToEdge.get(elem)))
        ).filter(Boolean);
        const focalSideKeys = focalSideEdges.map(({ to, from }) => (to === vertex.key ? from : to));
        const expectedKeys = focalSideNeighbors.map(
          idx => graph.pathElemToVertex.get(graph.visIdxToPathElem[idx]).key
        );
        expect(focalSideKeys).toEqual(expectedKeys);
      });

      // Validate that there aren't any rogue vertices nor edges
      expect(graph.vertices.size).toBe(expectedVertices.length);
      expect(new Set(graph.pathElemToEdge.values()).size).toBe(expectedEdgeCount);
    }

    it('creates five vertices and four edges for one-path ddg', () => {
      const testGraph = new GraphModel({
        ddgModel: simpleModel,
        density: EDdgDensity.PreventPathEntanglement,
        showOp: true,
      });
      validateGraph(testGraph, [
        {
          visIndices: [0],
        },
        {
          visIndices: [1],
          focalSideNeighbors: [0],
        },
        {
          visIndices: [2],
          focalSideNeighbors: [0],
        },
        {
          visIndices: [3],
          focalSideNeighbors: [1],
        },
        {
          visIndices: [4],
          focalSideNeighbors: [2],
        },
      ]);
    });

    it('adds separate vertices for equal PathElems that have different focalPaths, even those with equal focalSideNeighbors', () => {
      const convergentGraph = new GraphModel({
        ddgModel: convergentModel,
        density: EDdgDensity.PreventPathEntanglement,
        showOp: true,
      });
      validateGraph(convergentGraph, [
        {
          visIndices: [0, 1],
        },
        {
          visIndices: [2],
          focalSideNeighbors: [0],
        },
        {
          visIndices: [3],
          focalSideNeighbors: [0],
        },
        {
          visIndices: [4, 5],
          focalSideNeighbors: [0],
        },
        {
          visIndices: [6],
          focalSideNeighbors: [2],
        },
        {
          visIndices: [7],
          focalSideNeighbors: [3],
        },
        {
          visIndices: [8],
          focalSideNeighbors: [6],
        },
        {
          visIndices: [9],
          focalSideNeighbors: [7],
        },
      ]);
    });

    it('reuses edge when possible', () => {
      const convergentGraph = new GraphModel({
        ddgModel: convergentModel,
        density: EDdgDensity.PreventPathEntanglement,
        showOp: true,
      });
      const sharedEdgeElemA = convergentGraph.visIdxToPathElem[5];
      const sharedEdgeElemB = convergentGraph.visIdxToPathElem[4];

      expect(convergentGraph.pathElemToEdge.get(sharedEdgeElemA)).toBe(
        convergentGraph.pathElemToEdge.get(sharedEdgeElemB)
      );
    });

    describe('error cases', () => {
      it('errors if given model contains a pathElem that cannot be connected to the focal node', () => {
        const invalidModel = {
          ...simpleModel,
          visIdxToPathElem: simpleModel.visIdxToPathElem.slice(),
        };
        invalidModel.visIdxToPathElem.splice(1, 1);
        expect(
          () =>
            new GraphModel({
              ddgModel: invalidModel,
              density: EDdgDensity.PreventPathEntanglement,
              showOp: true,
            })
        ).toThrowError();
      });
    });
  });

  describe('generations', () => {
    const generationGraph = makeGraph(generationModel, false, EDdgDensity.MostConcise);
    const oneHopIndices = [
      ...generationGraph.distanceToPathElems.get(-1),
      ...generationGraph.distanceToPathElems.get(0),
      ...generationGraph.distanceToPathElems.get(1),
    ].map(({ visibilityIdx }) => visibilityIdx);
    const external = ({ isExternal }) => isExternal;
    const hasher = generationGraph.getPathElemHasher();
    const internal = ({ isExternal }) => !isExternal;

    const downstreamTargets = generationGraph.distanceToPathElems.get(2);
    const upstreamTargets = generationGraph.distanceToPathElems.get(-2);
    const targets = [...downstreamTargets, ...upstreamTargets];
    const twoHopIndices = [...oneHopIndices, ...targets.map(({ visibilityIdx }) => visibilityIdx)];
    const targetKey = hasher(targets[0]);
    const { visibilityIdx: targetLeafIdx } = downstreamTargets.find(external);
    const [hiddenDownstreamTargetNotLeaf, visibleDownstreamTargetNotLeaf] = downstreamTargets.filter(
      internal
    );

    const { visibilityIdx: targetRootIdx } = upstreamTargets.find(external);
    const [hiddenUpstreamTargetNotRoot, visibleUpstreamTargetNotRoot] = upstreamTargets.filter(internal);
    const leafAndRootVisEncoding = encode([...oneHopIndices, targetLeafIdx, targetRootIdx]);
    const partialInternalTargetVisIndices = [
      ...oneHopIndices,
      targetLeafIdx,
      targetRootIdx,
      visibleDownstreamTargetNotLeaf.visibilityIdx,
      visibleUpstreamTargetNotRoot.visibilityIdx,
    ];
    const partialInternalTargetVisEncoding = encode(partialInternalTargetVisIndices);
    const allVisible = encode(generationGraph.visIdxToPathElem.map((_elem, idx) => idx));

    const subsetOfTargetExternalNeighborVisibilityIndices = [
      visibleDownstreamTargetNotLeaf.externalSideNeighbor.visibilityIdx,
      visibleUpstreamTargetNotRoot.externalSideNeighbor.visibilityIdx,
    ];

    const allButSomeExternalVisible = encode([
      ...twoHopIndices,
      ...subsetOfTargetExternalNeighborVisibilityIndices,
    ]);

    describe('getGeneration', () => {
      it('returns empty array if key does not exist', () => {
        const absentKey = 'absent key';

        expect(generationGraph.getGeneration(absentKey, EDirection.Downstream)).toEqual([]);
        expect(generationGraph.getGeneration(absentKey, EDirection.Upstream)).toEqual([]);
      });

      it('returns empty array if key has no visible elems', () => {
        expect(
          generationGraph.getGeneration(targetKey, EDirection.Downstream, encode(oneHopIndices))
        ).toEqual([]);
        expect(generationGraph.getGeneration(targetKey, EDirection.Upstream, encode(oneHopIndices))).toEqual(
          []
        );
      });

      it('returns empty array if key is leaf/root elem', () => {
        expect(
          generationGraph.getGeneration(targetKey, EDirection.Downstream, leafAndRootVisEncoding)
        ).toEqual([]);

        expect(generationGraph.getGeneration(targetKey, EDirection.Upstream, leafAndRootVisEncoding)).toEqual(
          []
        );
      });

      it('omits focalSide elems', () => {
        const downstreamResult = generationGraph.getGeneration(
          targetKey,
          EDirection.Downstream,
          partialInternalTargetVisEncoding
        );
        expect(downstreamResult).toEqual([visibleDownstreamTargetNotLeaf.externalSideNeighbor]);
        expect(downstreamResult).toEqual(
          expect.not.arrayContaining([hiddenDownstreamTargetNotLeaf.externalSideNeighbor])
        );
        expect(downstreamResult).toEqual(
          expect.not.arrayContaining([visibleUpstreamTargetNotRoot.focalSideNeighbor])
        );

        const upstreamResult = generationGraph.getGeneration(
          targetKey,
          EDirection.Upstream,
          partialInternalTargetVisEncoding
        );
        expect(upstreamResult).toEqual([visibleUpstreamTargetNotRoot.externalSideNeighbor]);
        expect(upstreamResult).toEqual(
          expect.not.arrayContaining([hiddenUpstreamTargetNotRoot.externalSideNeighbor])
        );
        expect(downstreamResult).toEqual(
          expect.not.arrayContaining([visibleDownstreamTargetNotLeaf.focalSideNeighbor])
        );
      });
    });

    describe('getGenerationVisibility', () => {
      it('returns null if getGeneration returns []', () => {
        expect(
          generationGraph.getGenerationVisibility(targetKey, EDirection.Downstream, leafAndRootVisEncoding)
        ).toEqual(null);
        expect(
          generationGraph.getGenerationVisibility(targetKey, EDirection.Upstream, leafAndRootVisEncoding)
        ).toEqual(null);
      });

      it('returns ECheckedStatus.Empty if all neighbors are hidden', () => {
        expect(generationGraph.getGenerationVisibility(targetKey, EDirection.Downstream)).toEqual(
          ECheckedStatus.Empty
        );
        expect(
          generationGraph.getGenerationVisibility(
            targetKey,
            EDirection.Downstream,
            partialInternalTargetVisEncoding
          )
        ).toEqual(ECheckedStatus.Empty);

        expect(generationGraph.getGenerationVisibility(targetKey, EDirection.Upstream)).toEqual(
          ECheckedStatus.Empty
        );
        expect(
          generationGraph.getGenerationVisibility(
            targetKey,
            EDirection.Upstream,
            partialInternalTargetVisEncoding
          )
        ).toEqual(ECheckedStatus.Empty);
      });

      it('returns ECheckedStatus.Full if all neighbors are visible', () => {
        const partialTargetExternalEncoding = encode([
          ...partialInternalTargetVisIndices,
          ...subsetOfTargetExternalNeighborVisibilityIndices,
        ]);

        expect(generationGraph.getGenerationVisibility(targetKey, EDirection.Downstream, allVisible)).toEqual(
          ECheckedStatus.Full
        );
        expect(
          generationGraph.getGenerationVisibility(
            targetKey,
            EDirection.Downstream,
            partialTargetExternalEncoding
          )
        ).toEqual(ECheckedStatus.Full);
        expect(generationGraph.getGenerationVisibility(targetKey, EDirection.Upstream, allVisible)).toEqual(
          ECheckedStatus.Full
        );
        expect(
          generationGraph.getGenerationVisibility(
            targetKey,
            EDirection.Upstream,
            partialTargetExternalEncoding
          )
        ).toEqual(ECheckedStatus.Full);
      });

      it('returns ECheckedStatus.Partial if only some neighbors are visible', () => {
        expect(
          generationGraph.getGenerationVisibility(targetKey, EDirection.Downstream, allButSomeExternalVisible)
        ).toEqual(ECheckedStatus.Partial);
        expect(
          generationGraph.getGenerationVisibility(targetKey, EDirection.Upstream, allButSomeExternalVisible)
        ).toEqual(ECheckedStatus.Partial);
      });
    });

    describe('getVisWithUpdatedGeneration', () => {
      const downstreamFullIndices = [
        ...twoHopIndices,
        ...generationGraph.distanceToPathElems.get(3).map(({ visibilityIdx }) => visibilityIdx),
      ];
      const downstreamFullEncoding = encode(downstreamFullIndices);
      const upstreamFullIndices = [
        ...twoHopIndices,
        ...generationGraph.distanceToPathElems.get(-3).map(({ visibilityIdx }) => visibilityIdx),
      ];
      const upstreamFullEncoding = encode(upstreamFullIndices);

      it('returns undefined if there is no generation to update', () => {
        expect(
          generationGraph.getVisWithUpdatedGeneration(targetKey, EDirection.Downstream, encode(oneHopIndices))
        ).toEqual(undefined);
        expect(
          generationGraph.getVisWithUpdatedGeneration(targetKey, EDirection.Upstream, encode(oneHopIndices))
        ).toEqual(undefined);
        expect(
          generationGraph.getVisWithUpdatedGeneration(
            targetKey,
            EDirection.Downstream,
            leafAndRootVisEncoding
          )
        ).toEqual(undefined);
        expect(
          generationGraph.getVisWithUpdatedGeneration(targetKey, EDirection.Upstream, leafAndRootVisEncoding)
        ).toEqual(undefined);
      });

      it('emptys target generation if it is full', () => {
        expect(
          generationGraph.getVisWithUpdatedGeneration(targetKey, EDirection.Downstream, allVisible)
        ).toEqual({
          visEncoding: upstreamFullEncoding,
          update: ECheckedStatus.Empty,
        });
        expect(
          generationGraph.getVisWithUpdatedGeneration(targetKey, EDirection.Upstream, allVisible)
        ).toEqual({
          visEncoding: downstreamFullEncoding,
          update: ECheckedStatus.Empty,
        });
      });

      it('fills target generation if it is empty', () => {
        expect(generationGraph.getVisWithUpdatedGeneration(targetKey, EDirection.Downstream)).toEqual({
          visEncoding: downstreamFullEncoding,
          update: ECheckedStatus.Full,
        });
        expect(generationGraph.getVisWithUpdatedGeneration(targetKey, EDirection.Upstream)).toEqual({
          visEncoding: upstreamFullEncoding,
          update: ECheckedStatus.Full,
        });
      });

      it('fills target generation if it is partially full', () => {
        expect(
          generationGraph.getVisWithUpdatedGeneration(
            targetKey,
            EDirection.Downstream,
            allButSomeExternalVisible
          )
        ).toEqual({
          visEncoding: encode([...downstreamFullIndices, ...subsetOfTargetExternalNeighborVisibilityIndices]),
          update: ECheckedStatus.Full,
        });
        expect(
          generationGraph.getVisWithUpdatedGeneration(
            targetKey,
            EDirection.Upstream,
            allButSomeExternalVisible
          )
        ).toEqual({
          visEncoding: encode([...upstreamFullIndices, ...subsetOfTargetExternalNeighborVisibilityIndices]),
          update: ECheckedStatus.Full,
        });
      });
    });
  });

  describe('getVisible', () => {
    const convergentGraph = new GraphModel({
      ddgModel: convergentModel,
      density: EDdgDensity.PreventPathEntanglement,
      showOp: true,
    });

    describe('visEncoding provided', () => {
      it('returns just focalNode', () => {
        const { edges, vertices } = convergentGraph.getVisible(encode([0]));
        expect(edges).toHaveLength(0);
        expect(vertices).toEqual([expect.objectContaining(convergentPaths[0][1])]);
      });

      it('returns two specified vertices and their connecting edge', () => {
        const { edges, vertices } = convergentGraph.getVisible(encode([0, 4]));
        expect(edges).toHaveLength(1);
        expect(vertices).toEqual([
          expect.objectContaining(convergentPaths[0][1]),
          expect.objectContaining(convergentPaths[0][0]),
        ]);
      });

      it('does not return duplicate data when multiple visIndices share vertices and edges', () => {
        const { edges, vertices } = convergentGraph.getVisible(encode([0, 1, 4, 5]));
        expect(edges).toHaveLength(1);
        expect(vertices).toEqual([
          expect.objectContaining(convergentPaths[0][1]),
          expect.objectContaining(convergentPaths[0][0]),
        ]);
      });

      it('handles out of bounds visIdx', () => {
        const { edges, vertices } = convergentGraph.getVisible(encode([100]));
        expect(edges).toHaveLength(0);
        expect(vertices).toHaveLength(0);
      });

      it('is resiliant against mutation of the ddg model', () => {
        const willMutate = convergentModel.visIdxToPathElem.slice();
        const victimOfMutation = new GraphModel({
          ddgModel: {
            visIdxToPathElem: willMutate,
          },
          density: EDdgDensity.PreventPathEntanglement,
        });
        const idx = willMutate.length - 1;
        const prior = victimOfMutation.getVisible(encode([idx]));
        willMutate.push({ problematic: 'pathElem' });
        const now = victimOfMutation.getVisible(encode([idx, idx + 1]));
        expect(prior).toEqual(now);
      });
    });

    describe('visEncoding not provided', () => {
      it('returns edges and vertices within two hops', () => {
        const twoHopGraph = new GraphModel({
          ddgModel: simpleModel,
          density: EDdgDensity.PreventPathEntanglement,
        });
        const expectedVertices = simpleModel.visIdxToPathElem.map(elem =>
          twoHopGraph.pathElemToVertex.get(elem)
        );
        const expectedEdges = simpleModel.visIdxToPathElem
          .filter(elem => elem.distance)
          .map(elem => twoHopGraph.pathElemToEdge.get(elem));
        const { edges, vertices } = twoHopGraph.getVisible();
        expect(new Set(edges)).toEqual(new Set(expectedEdges));
        expect(new Set(vertices)).toEqual(new Set(expectedVertices));
      });

      it('handles graphs smaller than two hops', () => {
        const emptyGraph = new GraphModel({
          ddgModel: { distanceToPathElems: new Map(), visIdxToPathElem: [] },
          density: EDdgDensity.PreventPathEntanglement,
        });
        expect(emptyGraph.getVisible()).toEqual({
          edges: [],
          vertices: [],
        });
      });
    });
  });

  describe('uiFindMatches', () => {
    const convergentGraph = new GraphModel({
      ddgModel: convergentModel,
      density: EDdgDensity.PreventPathEntanglement,
      showOp: true,
    });
    const hideOpGraph = new GraphModel({
      ddgModel: convergentModel,
      density: EDdgDensity.PreventPathEntanglement,
      showOp: false,
    });
    const shorten = str => str.substring(0, str.length - 3);
    const visEncoding = encode([0, 1, 2, 3, 4, 5]);
    const { vertices: visibleVertices } = convergentGraph.getVisible(visEncoding);
    const { service: focalService, operation: focalOperation } = visibleVertices[0];
    const { service: otherService } = visibleVertices[2];
    const { vertices: oplessVertices } = hideOpGraph.getVisible(visEncoding);
    const {
      operation: { name: otherOp },
    } = Array.from(hideOpGraph.vertexToPathElems.get(oplessVertices[2]))[0];

    describe('getHiddenUiFindMatches', () => {
      it('returns a subset of hidden vertices that match provided uiFind', () => {
        const uiFind = `${shorten(focalService)} ${shorten(focalOperation)} ${shorten(otherService)}`;
        expect(convergentGraph.getHiddenUiFindMatches(uiFind, encode([0, 1]))).toEqual(
          new Set([visibleVertices[2]])
        );
      });

      it('matches only on service.name if showOp is false', () => {
        const uiFind = `${shorten(oplessVertices[1].service)} ${shorten(otherOp)}`;
        expect(hideOpGraph.getHiddenUiFindMatches(uiFind, encode([0]))).toEqual(new Set([oplessVertices[1]]));
      });

      it('returns an empty set when provided empty or undefined uiFind', () => {
        expect(convergentGraph.getHiddenUiFindMatches()).toEqual(new Set());
        expect(convergentGraph.getHiddenUiFindMatches('')).toEqual(new Set());
      });

      it('returns an empty set when all matches are visible', () => {
        const uiFind = `${shorten(focalService)} ${shorten(otherService)}`;
        expect(convergentGraph.getHiddenUiFindMatches(uiFind, visEncoding)).toEqual(new Set());
      });
    });

    describe('getVisibleUiFindMatches', () => {
      it('returns a subset of getVisible that match provided uiFind', () => {
        const uiFind = `${shorten(focalService)} ${shorten(focalOperation)} ${shorten(otherService)}`;
        expect(convergentGraph.getVisibleUiFindMatches(uiFind, visEncoding)).toEqual(
          new Set([visibleVertices[0], visibleVertices[2]])
        );
      });

      it('matches only on service.name if showOp is false', () => {
        const uiFind = `${shorten(focalService)} ${shorten(otherOp)}`;
        expect(hideOpGraph.getVisibleUiFindMatches(uiFind, visEncoding)).toEqual(
          new Set([visibleVertices[0]])
        );
      });

      it('returns an empty set when provided empty or undefined uiFind', () => {
        expect(convergentGraph.getVisibleUiFindMatches()).toEqual(new Set());
        expect(convergentGraph.getVisibleUiFindMatches('')).toEqual(new Set());
      });
    });
  });

  describe('getVertexVisiblePathElems', () => {
    const overlapGraph = new GraphModel({
      ddgModel: doubleFocalModel,
      density: EDdgDensity.UpstreamVsDownstream,
      showOp: true,
    });
    const lastElemKey = overlapGraph.getPathElemHasher()(overlapGraph.visIdxToPathElem[6]);

    it('returns `undefined` if key does not match any vertex', () => {
      expect(overlapGraph.getVertexVisiblePathElems('absent key')).toBe(undefined);
    });

    it('returns `undefined` if key has no pathElems', () => {
      const convergentGraph = new GraphModel({
        ddgModel: convergentModel,
        density: EDdgDensity.PreventPathEntanglement,
        showOp: true,
      });
      const focalElemKey = convergentGraph.getPathElemHasher()(convergentGraph.visIdxToPathElem[0]);
      const focalVertex = convergentGraph.vertices.get(focalElemKey);
      convergentGraph.vertexToPathElems.get(focalVertex).clear();
      expect(convergentGraph.getVertexVisiblePathElems(focalElemKey)).toBe(undefined);

      convergentGraph.vertexToPathElems.delete(focalVertex);
      expect(convergentGraph.getVertexVisiblePathElems(focalElemKey)).toBe(undefined);
    });

    it('returns elems within two hops when visEncoding is omitted', () => {
      expect(overlapGraph.getVertexVisiblePathElems(lastElemKey)).toHaveLength(1);
    });

    it('returns visible elems according to provided key', () => {
      const fullKey = encode(Array.from(overlapGraph.visIdxToPathElem.keys()));
      expect(overlapGraph.getVertexVisiblePathElems(lastElemKey, encode([0]))).toHaveLength(0);
      expect(overlapGraph.getVertexVisiblePathElems(lastElemKey, fullKey)).toHaveLength(2);
    });
  });

  describe('getVisWithoutVertex', () => {
    const overlapGraph = new GraphModel({
      ddgModel: convergentModel,
      density: EDdgDensity.OnePerLevel,
      showOp: true,
    });
    const vertexKey = overlapGraph.getPathElemHasher()(overlapGraph.distanceToPathElems.get(2)[0]);

    it('handles absent visEncoding', () => {
      expect(overlapGraph.getVisWithoutVertex(vertexKey)).toBe(encode([0, 1, 2, 3, 4, 5]));
    });

    it('uses provided visEncoding', () => {
      expect(overlapGraph.getVisWithoutVertex(vertexKey, encode([0, 1, 2, 3, 5, 6, 7, 8, 9]))).toBe(
        encode([0, 1, 2, 3, 5])
      );
    });

    it('returns undefined if vertex is already hidden', () => {
      expect(overlapGraph.getVisWithoutVertex(vertexKey, encode([0, 1, 2, 3, 5]))).toBe(undefined);
    });

    it('returns undefined if vertex has no elems', () => {
      expect(overlapGraph.getVisWithoutVertex('absent vertex key')).toBe(undefined);
    });
  });

  describe('getVisWithVertices', () => {
    const overlapGraph = new GraphModel({
      ddgModel: convergentModel,
      density: EDdgDensity.PreventPathEntanglement,
      showOp: true,
    });
    const vertices = [
      overlapGraph.pathElemToVertex.get(overlapGraph.distanceToPathElems.get(3)[0]),
      overlapGraph.pathElemToVertex.get(overlapGraph.distanceToPathElems.get(-1)[0]),
    ];

    it('handles absent visEncoding', () => {
      expect(overlapGraph.getVisWithVertices(vertices)).toBe(encode([0, 1, 2, 3, 4, 5, 6, 7, 8]));
    });

    it('uses provided visEncoding', () => {
      expect(overlapGraph.getVisWithVertices(vertices, encode([0, 1, 3]))).toBe(
        encode([0, 1, 2, 3, 4, 5, 6, 8])
      );
    });

    it('throws error if given absent vertex', () => {
      expect(() => overlapGraph.getVisWithVertices([{}])).toThrowError();
    });
  });

  describe('makeGraph', () => {
    it('returns Graph with correct properties', () => {
      const graph = makeGraph(convergentModel, true, EDdgDensity.PreventPathEntanglement);
      expect(graph instanceof GraphModel).toBe(true);
      expect(graph.density).toBe(EDdgDensity.PreventPathEntanglement);
      expect(graph.distanceToPathElems).toEqual(convergentModel.distanceToPathElems);
      expect(graph.showOp).toBe(true);
      expect(graph.visIdxToPathElem).toEqual(convergentModel.visIdxToPathElem);
    });
  });
});
