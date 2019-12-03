import React, { useRef, useState, useEffect } from 'react';

import $ from 'jquery';
import _ from 'lodash';

import { library } from '@fortawesome/fontawesome-svg-core';
import { fas } from '@fortawesome/free-solid-svg-icons';
import { far } from '@fortawesome/free-regular-svg-icons';
import { fab } from '@fortawesome/free-brands-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

// Add all icons to the library so you can use it in your page
library.add(fas, far, fab);


class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      width: 0,
      height: 0,
      updating: false,
      updateTask: -1,
      // tick: 0,
      fps: 0,
      count: 0,
    }
  }
  componentDidMount() {
    this.setSize();
    $(window).on('resize', this.onResizes.window);
    const updating = true;
    const updateTask = setTimeout(this.update);
    const fps = 60;
    this.setState({ updating, updateTask, fps });
  }
  componentWillUnmount() {
    clearTimeout(this.state.updateTask);
  }
  render() {
    const styles = {
      canvas: {
        position: 'fixed',
        left: 0,
        top: 0,
      },
    };
    return (
      <div className="container-fluid">
        <canvas ref={e => this.canvas = e} width={this.state.width} height={this.state.height} style={styles.canvas}></canvas>
        <div className="row mt-4">
          <div className="col col-12">
            <button onClick={this.onClicks.updating}><FontAwesomeIcon icon={this.state.updating ? fas.faPause : fas.faPlay} /></button>
          </div>
        </div>
        <div className="row mt-4">
          <div className="col col-12">
            <pre className="text-light">width: {this.state.width}</pre>
            <pre className="text-light">height: {this.state.height}</pre>
            <pre className="text-light">updating: {JSON.stringify(this.state.updating)}</pre>
            <pre className="text-light">count: {this.state.count}</pre>
          </div>
        </div>
        <div className="row">
          <div className="col col-12">
          </div>
        </div>
        <div className="row">
          <div className="col col-12">
          </div>
        </div>
      </div>
    );
  }

  onResizes = {
    window: e => () => this.setSize(),
  }
  onClicks = {
    updating: e => {
      this.setState({ updating: !this.state.updating })
    },
  };

  setSize = () => {
    const width = $(window).width();
    const height = $(window).height();
    this.setState({ width, height });
  }

  update = (tick = 0, snows = []) => {
    const { width, height, updating, fps } = this.state;
    if (updating) {
      const context = this.canvas.getContext('2d');
      // context.clearRect(0, 0, width, height);

      context.fillStyle = '#333';
      context.fillRect(0, 0, width, height);

      if (tick % (fps / 10) === 0) {
        const count = snows.length > 0 ? _.random(0, 2) : _.random(5, 10);
        _.chain(count).range().forEach(i => {
          const x = _.random(width);
          const y = 0;
          const z = _.random(-5, 5);
          const size = _.random(2, 5);
          const degree = 0;
          const snow = { x, y, z, size, degree };
          snows.push(snow);
          return true;
        }).value();
        this.setState({ count: snows.length });
      }

      _.chain(snows).map((snow, i) => {
        const { x, y, z, size, degree } = snow;
        const alpha = .75 + z * .5;
        context.beginPath();
        context.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        context.arc(x + 10 * Math.cos(degree / 360 * 2 * Math.PI), y, size, 0, 2 * Math.PI);
        context.fill();
        context.closePath();
        if (y < height + size) {
          snow.y += size;
          snow.degree += 3;
          snow.degree %= 360;
        } else {
          return i;
        }
      }).filter().reverse().forEach(i => {
        snows.splice(i, 1);
      }).value();
    }
    const updateTask = setTimeout(this.update, 1000 / fps, (tick + 1) % fps, snows);
    this.setState({ updateTask });
  }
}

export default App;
