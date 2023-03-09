// Copyright (c) 2017 Uber Technologies, Inc.
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

import fetch from 'isomorphic-fetch';
import moment from 'moment';
import queryString from 'query-string';

import prefixUrl from '../utils/prefix-url';

// export for tests
export function getMessageFromError(errData, status) {
  if (errData.code != null && errData.msg != null) {
    if (errData.code === status) {
      return errData.msg;
    }
    return `${errData.code} - ${errData.msg}`;
  }
  try {
    return JSON.stringify(errData);
  } catch (_) {
    return String(errData);
  }
}

function getJSON(url, options = {}) {
  const { query = null, ...init } = options;
  init.credentials = 'same-origin';
  let queryStr = '';

  if (query) {
    queryStr = `?${typeof query === 'string' ? query : queryString.stringify(query)}`;
  }

  return fetch(`${url}${queryStr}`, init).then(response => {
    if (response.status < 400) {
      return response.json();
    }
    return response.text().then(bodyText => {
      let data;
      let bodyTextFmt;
      let errorMessage;
      try {
        data = JSON.parse(bodyText);
        bodyTextFmt = JSON.stringify(data, null, 2);
      } catch (_) {
        data = null;
        bodyTextFmt = null;
      }
      if (data && Array.isArray(data.errors) && data.errors.length) {
        errorMessage = data.errors.map(err => getMessageFromError(err, response.status)).join('; ');
      } else {
        errorMessage = bodyText || `${response.status} - ${response.statusText}`;
      }
      if (typeof errorMessage === 'string') {
        errorMessage = errorMessage.trim();
      }
      const error = new Error(`HTTP Error: ${errorMessage}`);
      error.httpStatus = response.status;
      error.httpStatusText = response.statusText;
      error.httpBody = bodyTextFmt || bodyText;
      error.httpUrl = url;
      error.httpQuery = typeof query === 'string' ? query : queryString.stringify(query);
      throw error;
    });
  });
}

function populateSpanReference(reference, traceUrl) {
  if (reference.span) {
    return Promise.resolve();
  }

  return (
    getJSON(traceUrl)
      .then(refTraceData => {
        const referenceTrace = refTraceData && refTraceData.data && refTraceData.data[0];
        if (
          !referenceTrace ||
          !Array.isArray(referenceTrace.spans) ||
          typeof referenceTrace.processes !== 'object'
        ) {
          return;
        }

        // We need to reassign `reference.span`, hence ignore no-param-reassign linting rule.
        // eslint-disable-next-line
        reference.span = referenceTrace.spans.find(
          candidateSpan => candidateSpan.spanID === reference.spanID
        );
        if (reference.span && typeof reference.span.processID === 'string') {
          // We need to reassign `reference.span.process`, hence ignore no-param-reassign linting rule.
          // eslint-disable-next-line
          reference.span.process = referenceTrace.processes[reference.span.processID];
        }
      })
      // Catch and swallow error. If we can't parse the reference, Jaeger UI should continue to function
      // `reference.span` population.
      .catch(e => {
        // eslint-disable-next-line
        console.error(e);
      })
  );
}

export const DEFAULT_API_ROOT = prefixUrl('/api/');
export const ANALYTICS_ROOT = prefixUrl('/analytics/');
export const DEFAULT_DEPENDENCY_LOOKBACK = moment.duration(1, 'weeks').asMilliseconds();

const JaegerAPI = {
  apiRoot: DEFAULT_API_ROOT,
  archiveTrace(id) {
    return getJSON(`${this.apiRoot}archive/${id}`, { method: 'POST' });
  },
  fetchDecoration(url) {
    return getJSON(url);
  },
  fetchDeepDependencyGraph(query) {
    return getJSON(`${ANALYTICS_ROOT}v1/dependencies`, { query });
  },
  fetchDependencies(endTs = new Date().getTime(), lookback = DEFAULT_DEPENDENCY_LOOKBACK) {
    return getJSON(`${this.apiRoot}dependencies`, { query: { endTs, lookback } });
  },
  fetchQualityMetrics(service, hours) {
    return getJSON(`/qualitymetrics-v2`, { query: { hours, service } });
  },
  fetchServiceOperations(serviceName) {
    return getJSON(`${this.apiRoot}services/${encodeURIComponent(serviceName)}/operations`);
  },
  fetchServiceServerOps(service) {
    return getJSON(`${this.apiRoot}operations`, {
      query: {
        service,
        spanKind: 'server',
      },
    });
  },
  fetchServices() {
    return getJSON(`${this.apiRoot}services`);
  },
  fetchTrace(id) {
    return getJSON(`${this.apiRoot}traces/${id}`).then(async traceData => {
      const trace = traceData && traceData.data && traceData.data[0];
      const populateSpanReferences = [];
      if (trace && Array.isArray(trace.spans)) {
        trace.spans.map(span => {
          if (!Array.isArray(span.references)) {
            return null;
          }

          span.references.map(reference => {
            populateSpanReferences.push(
              populateSpanReference(reference, `${this.apiRoot}traces/${reference.traceID}`)
            );

            return null;
          });
          return null;
        });
      }

      return Promise.all(populateSpanReferences).then(() => traceData);
    });
  },
  searchTraces(query) {
    return getJSON(`${this.apiRoot}traces`, { query });
  },
  fetchMetrics(metricType, serviceNameList, query) {
    const servicesName = serviceNameList.map(serviceName => `service=${serviceName}`).join(',');

    return getJSON(`${this.apiRoot}metrics/${metricType}`, {
      query: `${servicesName}&${queryString.stringify(query)}`,
    }).then(d => ({ ...d, quantile: query.quantile }));
  },
};

export default JaegerAPI;
