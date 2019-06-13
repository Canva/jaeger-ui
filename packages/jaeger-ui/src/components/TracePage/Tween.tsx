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

import ease from 'tween-functions';

import { TNil } from '../../types';

interface ITweenState {
  done: boolean;
  value: number;
}

type TTweenCallback = (state: ITweenState) => void;

type TTweenOptions = {
  delay?: number;
  duration: number;
  from: number;
  onComplete?: TTweenCallback;
  onUpdate?: TTweenCallback;
  to: number;
};

export default class Tween {
  callbackComplete: TTweenCallback | TNil;
  callbackUpdate: TTweenCallback | TNil;
  delay: number | TNil;
  duration: number;
  from: number;
  requestID: number | TNil;
  startTime: number;
  timeoutID: number | TNil;
  to: number;

  constructor({ duration, from, to, delay, onUpdate, onComplete }: TTweenOptions) {
    this.startTime = Date.now() + (delay || 0);
    this.duration = duration;
    this.from = from;
    this.to = to;
    if (!onUpdate && !onComplete) {
      this.callbackComplete = undefined;
      this.callbackUpdate = undefined;
      this.timeoutID = undefined;
      this.requestID = undefined;
    } else {
      this.callbackComplete = onComplete;
      this.callbackUpdate = onUpdate;
      if (delay) {
        // @types/node sets the return type of setTieout to NodeJS.Timeout, so prefix
        // with `window.`
        this.timeoutID = window.setTimeout(this._frameCallback, delay);
        this.requestID = undefined;
      } else {
        this.requestID = window.requestAnimationFrame(this._frameCallback);
        this.timeoutID = undefined;
      }
    }
  }

  _frameCallback = () => {
    this.timeoutID = undefined;
    this.requestID = undefined;
    const current = Object.freeze(this.getCurrent());
    if (this.callbackUpdate) {
      this.callbackUpdate(current);
    }
    if (this.callbackComplete && current.done) {
      this.callbackComplete(current);
    }
    if (current.done) {
      this.callbackComplete = undefined;
      this.callbackUpdate = undefined;
    } else {
      this.requestID = window.requestAnimationFrame(this._frameCallback);
    }
  };

  cancel() {
    if (this.timeoutID != null) {
      clearTimeout(this.timeoutID);
      this.timeoutID = undefined;
    }
    if (this.requestID != null) {
      window.cancelAnimationFrame(this.requestID);
      this.requestID = undefined;
    }
    this.callbackComplete = undefined;
    this.callbackUpdate = undefined;
  }

  getCurrent(): ITweenState {
    const t = Date.now() - this.startTime;
    if (t <= 0) {
      // still in the delay period
      return { done: false, value: this.from };
    }
    if (t >= this.duration) {
      // after the expiration
      return { done: true, value: this.to };
    }
    // mid-tween
    return { done: false, value: ease.easeOutQuint(t, this.from, this.to, this.duration) };
  }
}
