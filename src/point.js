// @flow
require('source-map-support').install();

'use strict';

// The rationale behind using this idiom is described in:
//     http://stackoverflow.com/a/36628148/274677
//
if (!global._babelPolyfill) // https://github.com/s-panferov/awesome-typescript-loader/issues/121
    require('babel-polyfill');
// The above is important as Babel only transforms syntax (e.g. arrow functions)
// so you need this in order to support new globals or (in my experience) well-known Symbols, e.g. the following:
//
//     console.log(Object[Symbol.hasInstance]);
//
// ... will print 'undefined' without the the babel-polyfill being required.



import assert from 'assert';
import _      from 'lodash';

export type DemonstrateUseOfExportedTypes = {a: number, b: string};

const foobarzar : DemonstrateUseOfExportedTypes = {a: 1,b: '2'};

class Point {
    x: number;
    y: number;
    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
    }
    rotate90Right(): Point {
        // $SuppressFlowFinding: obvious mistyping just to demonstrate use of line-specific suppression
        const n: number = 'problem';
        return new Point(-this.y, this.x);
    }
    rotate90Left(): Point {
        return new Point(this.y, -this.x);
    }
    equals(p2: Point) {
        return this.x===p2.x && this.y===p2.y;
    }
    add(otherPoint: Point): Point {
        assert(otherPoint instanceof Point);
        return new Point(this.x+otherPoint.x, this.y+otherPoint.y);
    }
    clone(): Point {
        return new Point(this.x, this.y);
    }
    static foo(): number {
        return 3;
    }
}

const a: Array<number>  = _.uniq([1,1,1,2,1,2,2]);


function between(x: number,a: number,b: number): boolean {
    return (x>=a) && (x<b);
}

function foo() {
    throw new Error();
}


exports.Point = Point;
exports.between = between;
exports.foo = foo;
