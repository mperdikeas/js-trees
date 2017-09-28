// @flow
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


import _ from 'lodash';
import {assert} from 'chai';

export type F<V,E> = (n: Node<V, E>, parentN: ?Node<V, E>, birthEdge: ?E)=> void;
type FV<V,E> = (n: Node<V, E>)=> boolean;
type ValuePrinter<V> = (v: V)=>string;


const TREE_NODE_ID_SYMBOL_KEY: string = 'mjb44-NODE-id';

class Holder<V> {
    value: V;
    constructor(value:V) {
        this.value = value;
    }
}

function foo() : Holder<number> {
    const returnValue: Holder<number> = new Holder(42);
    return returnValue;
}

class Node<V, E> {
    value: V;
    children: ?Map<E, Node<V,E>>;

    constructor(value: V) {
        this.value = value;
        this.children = null;
    }


    allChildrenSatisfy(f: FV<V,E>): boolean {
        let rv: boolean = true;
        if (this.children!=null) {
            this.children.forEach( (v:Node<V,E>, e:E) => {
                if (!f(v))
                    rv = false;
            });
            return rv;
        } else throw new Error('bad choreography');
    }

    set(edge: E, node: Node<V,E>): ?Node<V,E> {
        if (this.children === null) {
            this.children = new Map();
        }
        const children: ?Map<E, Node<V, E>> = this.children;
        if (children!=null) {
            const prevValue: ?Node<V, E> = children.get(edge);
            children.set(edge, node);
            return prevValue;
        } else throw new Error('bug1');
    }

    setn(edge: E, node: Node<V,E>): void {
        const prevValue: ?Node<V, E> = this.set(edge, node);
        assert.isTrue(prevValue===undefined);
    }

    isLeaf(): boolean {
        return this.children === null;
    }

    depthFirstTraversal(f: F<V,E>, visitStartNode: boolean, visitParentFirstThenChildren: boolean): void {
        const cycleDetector: Array<Node<V,E>> = [];
        const that = this;
        function _visit(n: Node<V,E>, parentN: ?Node<V,E>, birthEdge: ?E) {
            assert.isTrue(!cycleDetector.includes(n), 'cycle detected');
            cycleDetector.push(n);
            if (visitParentFirstThenChildren) {
                if ((n!==that) || visitStartNode) {
                    f(n, parentN, birthEdge);
                }
            }
            const children: ?Map<E, Node<V,E>> = n.children;
            if (children != null) {
                children.forEach( (v: Node<V,E>, k: E) => {
                    _visit(v, n, k);
                });
            }
            if (!visitParentFirstThenChildren) {
                if ((n!==that) || visitStartNode) {
                    f(n, parentN, birthEdge);
                }
            }
        }
        _visit(this, null, null);        
    }

    descendants(_includingThisNode: ?boolean): Array<Node<V, E>> {
        const includingThisNode: boolean = _includingThisNode == null ? false : _includingThisNode;
        const descendants: Array<Node<V, E>> = [];
        function f(n : Node<V, E>) {
            descendants.push(n);
        }

        this.depthFirstTraversal(f, includingThisNode, true);
        assert.isTrue(   ((!includingThisNode) && (descendants.length===0) && ( this.isLeaf())) ||
                         ((!includingThisNode) && (descendants.length>  0) && (!this.isLeaf())) ||
                         (( includingThisNode) && (descendants.length>  0)) );
        return descendants;
    }

    leafs(_includingThisNode: ?boolean): Array<Node<V,E>> {
        const includingThisNode: boolean = _includingThisNode == null ? false : _includingThisNode;        
        const rv: Array<Node<V,E>> = [];
        function addLeavesOnly(n: Node<V, E>): void {
            if (n.isLeaf())
                rv.push(n);
        }
        this.depthFirstTraversal(addLeavesOnly, includingThisNode, true);
        return rv;
    }

    edgeThatLeadsTo(n: Node<V, E>): ?E {
        assert.isFalse(this.isLeaf());
        const children: ?Map<E, Node<V, E>> = this.children;
        assert.isFalse(children === undefined);
        if (children != null) {
            const rv: Array<E> = [];
            children.forEach( function (child: Node<V, E>, edge: E) {
                const descendants: Array<Node<V, E>> = child.descendants(true);
                if (descendants.includes(n))
                    rv.push(edge);
            });
            if (rv.length > 1) throw new Error('Bug! ${rv.length} edges leading to node: ${n} - impossible if the graph is a tree.');
            else if (rv.length === 0) return null;
            else return rv[0];
        } else throw new Error('bug3');
    }

    print(_valuePrinter: ?ValuePrinter<V>): string {
        const defaultValuePrinter: ValuePrinter<V> = (x: V)=>String(x);
        let valuePrinter: ValuePrinter<V> = (_valuePrinter==null?defaultValuePrinter:_valuePrinter);
        const s: symbol = Symbol.for(TREE_NODE_ID_SYMBOL_KEY);// Symbol();
        let i: number = 0;
        const lines: Array<string> = [];
        const printerVisitor: F<V,E> = function printNode(n: Node<V,E>, parentN: ?Node<V,E>, birthEdge: ?E) {
            assert.isTrue( ((parentN==null) && (birthEdge==null)) || ((parentN!=null) && (birthEdge!=null)) );
            if (!n.hasOwnProperty(s))
                // $SuppressFlowFinding: access of computed property/element. Indexable signature not found in ...
                n[s] = i++;
            if (parentN==null) {
                assert.isTrue(parentN===null);
                assert.isTrue(birthEdge===null);
                assert.isTrue(_.isEmpty(lines));
                // $SuppressFlowFinding: access of computed property/element. Indexable signature not found in ...
                let line: string = `ROOT node #${n[s]} with value: ${valuePrinter(n.value)}`;
                lines.push(line);
            } else {
                assert.isTrue(birthEdge !== undefined);
                if (birthEdge!=null) {
                    // $SuppressFlowFinding: access of computed property/element. Indexable signature not found in ...                    
                    let line: string = `node #${parentN[s]} ~~[${birthEdge}]~~> node #${n[s]} with value: ${valuePrinter(n.value)}`;
                    lines.push(line);
                } else throw new Error('bug');
            }
        };
        this.depthFirstTraversal(printerVisitor, true, true);
        return lines.join('\n');
    }
}


exports.Node = Node;
exports.TREE_NODE_ID_SYMBOL_KEY = TREE_NODE_ID_SYMBOL_KEY;