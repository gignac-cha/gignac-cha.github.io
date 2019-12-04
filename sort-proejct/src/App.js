import React from 'react';

import $ from 'jquery';
import _ from 'lodash';
import moment from 'moment';
import classnames from 'classnames';

import { library } from '@fortawesome/fontawesome-svg-core';
import { fas } from '@fortawesome/free-solid-svg-icons';
import { far } from '@fortawesome/free-regular-svg-icons';
import { fab } from '@fortawesome/free-brands-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

// Add all icons to the library so you can use it in your page
library.add(fas, far, fab);


const ALGORITHMS = [
  { key: 'bubble', text: 'Bubble Sort' },
  { key: 'insertion', text: 'Insertion Sort' },
  { key: 'selection', text: 'Selection Sort' },
  { key: 'merge', text: 'Merge Sort' },
  { key: 'heap', text: 'Heap Sort' },
  { key: 'quick', text: 'Quick Sort' },
  { key: 'radix', text: 'Radix Sort' },
  { key: 'tim', text: 'Tim Sort' },
];
const MARGIN = 10;
const PADDING = 5;
const WIDTH = 10;


class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      width: 0,
      height: 0,
      algorithm: '',
      numbers: [],
      maximum: 0,
      minimum: 0,
      sortStart: false,
      sorting: false,
      speed: 10,
      defaults: {
        bubble: {
          a: { index: -1, alpha: 0, delta: 0 },
          b: { index: -1, alpha: 0, delta: 0 },
          completed: -1,
          count: 0,
        },
      },
    };
  }
  componentDidMount() {
    this.setSize(this.refSvg);
    $(this.refSvg).on('resize', e => this.setSize(e));

    const { defaults } = this.state;
    this.setState(_.chain(defaults).entries().map(([ k, v ]) => [ k, _.cloneDeep(v) ]).fromPairs().value());
  }
  render() {
    const { algorithm, numbers, sortStart, sorting, speed } = this.state;
    return (
      <div className="container">
        <div className="row mt-4">
          {algorithms.map(this.renders.algorithms)}
        </div>
        <div className="row mt-4">
          {ALGORITHMS.map(this.renders.algorithms)}
        </div>
        <div className="row mt-4">
          <div className="col col-2">
            <button className="btn btn-primary form-control" onClick={this.onClicks.generate} disabled={algorithm.length === 0 || sortStart}>
              <FontAwesomeIcon icon={fas.faPlusCircle} /> Generate Data
            </button>
          </div>
          <div className="col col-2">
            <input type="range" className="form-control custom-range" min={1} max={100} step={1} value={speed} onChange={this.onChanges.speed} />
          </div>
        </div>
        <div className="row mt-4">
          <div className="col col-2">
            {this.state.sorting ? (
            <button className="btn btn-warning form-control" onClick={this.onClicks.sort} disabled={algorithm.length === 0 || numbers.length === 0}>
              <FontAwesomeIcon icon={fas.faPause} /> Pause
            </button>
            ) : (
            <button className="btn btn-success form-control" onClick={this.onClicks.sort} disabled={algorithm.length === 0 || numbers.length === 0}>
              <FontAwesomeIcon icon={fas.faPlay} /> Start
            </button>
            )}
          </div>
          <div className="col col-2">
            <button className="btn btn-danger form-control" onClick={this.onClicks.stopSort} disabled={!sortStart || numbers.length === 0}>
              <FontAwesomeIcon icon={fas.faStop} /> Stop
            </button>
          </div>
          <div className="col col-2">
            <button className="btn btn-secondary form-control" onClick={this.onClicks.shuffle} disabled={sortStart}>
              <FontAwesomeIcon icon={fas.faRandom} /> Shuffle
            </button>
          </div>
          <div className="col col-2">
            <button className="btn btn-dark form-control" onClick={this.onClicks.resetSort} disabled={sorting}>
              <FontAwesomeIcon icon={fas.faRedo} /> Reset
            </button>
          </div>
        </div>
        <div className="row mt-4">
          <div className="col col-12">{this.renders.count()}</div>
          <div className="col col-12">{this.renders.numbers()}</div>
        </div>
        <div className="row mt-4">
          <div className="col col-12">

          </div>
        </div>
      </div>
    );
  }

  renders = {
    algorithms: ({ key, text }) => {
      const active = key === this.state.algorithm;
      const className = classnames(
        'form-control',
        'mt-2',
        {
          'border-primary': active,
        },
      );
      return (
        <div key={key} className="col col-2">
          <button className={className} onClick={this.onClicks.algorithm} data-algorithm={key} disabled={active}>{text}</button>
        </div>
      );
    },
    numbers: () => <svg ref={e => this.refSvg = e} width={'100%'} height={200}>{this.state.numbers.map(this.renders.number)}</svg>,
    number: (number, i) => {
      const { maximum, algorithm } = this.state;
      let lineX = MARGIN + (i + 1) * WIDTH + i * PADDING;
      const lineY = MARGIN + maximum - number;
      let color = '#bbb';
      if (algorithm === 'bubble') {
        const { bubble } = this.state;
        if (i === bubble.a.index) {
          color = `rgba(0, 127, 0, ${bubble.a.alpha / 256})`;
          lineX += bubble.a.delta * (WIDTH + PADDING);
        } else if (i === bubble.b.index) {
          color = `rgba(0, 0, 255, ${bubble.b.alpha / 256})`;
          lineX += bubble.b.delta * (WIDTH + PADDING);
        } else if (bubble.completed >= 0 && i >= bubble.completed) {
          color = '#333';
        }
      }
      return <line key={i} x1={lineX} y1={lineY} x2={lineX} y2={110} stroke={color} strokeWidth={WIDTH}></line>
    },
    count: () => {
      const { algorithm } = this.state;
      if (algorithm === 'bubble') {
        return <pre>Swap Count: {this.state[algorithm].count}</pre>
      }
    },
  }

  onClicks = {
    algorithm: e => {
      const { algorithm } = e.currentTarget.dataset;
      this.setState({ algorithm });
    },
    generate: e => {
      const { width } = this.state;
      const count = _.toInteger((width - MARGIN * 2 - WIDTH) / (PADDING + WIDTH) + 1);
      const numbers = _.chain(_.range(count)).map(i => _.random(1, 100)).value();
      const maximum = _.max(numbers);
      const minimum = _.min(numbers);
      this.setState({ numbers, maximum, minimum });
    },
    sort: e => {
      const { algorithm, sortStart, sorting } = this.state;
      if (sortStart) {
        this.setState({ sorting: !sorting });
      } else {
        this.setState({ sortStart: true, sorting: true });
        setTimeout(this.algorithms[algorithm], 0, 'initialize');
      }
    },
    shuffle: e => {
      const numbers = _.shuffle(this.state.numbers);
      this.setState({ numbers });
    },
    stopSort: e => {
      const { algorithm, defaults } = this.state;
      this.setState({ sortStart: false, sorting: false, [ algorithm ]: _.cloneDeep(defaults[algorithm]) });
    },
    resetSort: e => {
      this.setState({ algorithm: '', numbers: [], sortStart: false, sorting: false });
    },
  }
  onChanges = {
    speed: e => {
      const speed = _.toNumber(e.currentTarget.value);
      this.setState({ speed });
    },
  }

  setSize = e => {
    const width = $(e).width();
    const height = $(e).height();
    this.setState({ width, height });
  }
  algorithms = {
    bubble: (step, i, j, n, count) => {
      const { algorithm, numbers, sorting, bubble } = this.state;
      const self = this.algorithms[algorithm];

      const selectA = (i, count) => {
        if (this.state.sorting) {
        // console.log(algorithm, 'selectA', i, count)
        if (count < 0xff) {
          bubble.a.alpha = count;
          setTimeout(selectA, 1000 / 60, i, count + 0xff * (this.state.speed / 100));
        } else {
          bubble.a.alpha = 0xff;
          setTimeout(self, 0, 'select-b', i, j, n);
        }
        this.setState({ bubble });
        } else if (this.state.sortStart) {
          setTimeout(selectA, 1000 / 60, i, count);
        }
      };
      const selectB = (j, count) => {
        if (this.state.sorting) {
        // console.log(algorithm, 'selectB', j, count)
        if (count < 0xff) {
          bubble.b.alpha = count;
          setTimeout(selectB, 1000 / 60, j, count + 0xff * (this.state.speed / 100));
        } else {
          bubble.b.alpha = 0xff;
          setTimeout(self, 0, 'compare', i, j, n);
        }
        this.setState({ bubble });
        } else if (this.state.sortStart) {
          setTimeout(selectB, 1000 / 60, j, count);
        }
      };
      const compare = (i, j) => {
        if (this.state.sorting) {
        // console.log(algorithm, 'compare', i, j, numbers[i], numbers[j])
        if (numbers[i] > numbers[j]) {
          setTimeout(self, 0, 'swap', i, j, n);
        } else {
          setTimeout(self, 0, 'next', i, j, n);
        }
        } else if (this.state.sortStart) {
          setTimeout(compare, 1000 / 60, i, j);
        }
      };
      const swap = (i, j, count) => {
        if (this.state.sorting) {
        // console.log(algorithm, 'swap', i, j, count)
        if (count < 100) {
          bubble.a.delta = (j - i) / 100 * count;
          bubble.b.delta = -bubble.a.delta;
          setTimeout(swap, 1000 / 60, i, j, count + 100 * (this.state.speed / 100));
        } else {
          bubble.a.index = j;
          bubble.b.index = i;
          bubble.a.delta = 0;
          bubble.b.delta = 0;
          bubble.count++;
          [ numbers[i], numbers[j] ] = [ numbers[j], numbers[i] ];
          setTimeout(self, 0, 'next', i, j, n);
        }
        this.setState({ numbers, bubble });
        } else if (this.state.sortStart) {
          setTimeout(swap, 1000 / 60, i, j, count);
        }
      };
      const next = (i, j, n) => {
        if (this.state.sorting) {
        // console.log(algorithm, 'next', i, j, n)
        setTimeout(self, 0, 'select-a', i, j, n);
        } else if (this.state.sortStart) {
          setTimeout(next, 1000 / 60, i, j, n);
        }
      };

      if (sorting) {
        if (step === 'initialize') {
          // console.log(algorithm, step)
          bubble.completed = numbers.length;
          bubble.count = 0;
          setTimeout(self, 0, 'select-a', 0, 1, bubble.completed);
        } else if (step === 'select-a') {
          // console.log(algorithm, step, i, j, n)
          bubble.a.index = i;
          setTimeout(selectA, 0, i, 0);
        } else if (step === 'select-b') {
          // console.log(algorithm, step, i, j, n)
          bubble.b.index = j;
          setTimeout(selectB, 0, j, 0);
        } else if (step === 'compare') {
          // console.log(algorithm, step, i, j, n)
          setTimeout(compare, 0, i, j);
        } else if (step === 'swap') {
          // console.log(algorithm, step, i, j, n)
          setTimeout(swap, 0, i, j, 0);
        } else if (step === 'next') {
          // console.log(algorithm, step, i, j, n)
          bubble.a.index = -1;
          bubble.b.index = -1;
          bubble.a.delta = 0;
          bubble.b.delta = 0;
          if (j + 1 === n) {
            bubble.completed = n - 1;
            setTimeout(next, 0, 0, 1, bubble.completed);
          } else if (n > 1) {
            setTimeout(next, 0, i + 1, j + 1, bubble.completed);
          } else {
            bubble.completed = 0;
            this.setState({ sortStart: false, sorting: false });
          }
        }
      } else {
        setTimeout(self, 1000 / 60, step, i, j, n);
      }
      this.setState({ bubble });
    },
  }
}

export default App;
