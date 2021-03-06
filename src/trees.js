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

import type {Stringifier, Predicate} from 'flow-common-types';

export type F<V,E>  = (n: Node<V, E>, parentN: ?Node<V, E>, birthEdge: ?E, depth: number)=> void;
export type F2<V,E> = (n: Node<V, E>, childN : ?Node<V, E>, childEdge: ?E, distanceFromStart: number, isRoot: boolean)=> void;



const TREE_NODE_ID_SYMBOL_KEY: string = 'mjb44-NODE-id';


class Node<V, E> {
    value: V;
    parent: ?Node<V, E>;
    children: ?Map<E, Node<V,E>>;

    constructor(value: V) {
        this.value = value;
        this.children = null;
        this.parent = null;
    }

    setParent(n: Node<V, E>): void {
        this.parent = n;
    }

    allChildrenSatisfy(f: Predicate<Node<V,E>>): boolean {
        let rv: boolean = true;
        if (this.children!=null) {
            this.children.forEach( (v:Node<V,E>, e:E) => {
                if (!f(v))
                    rv = false;
            });
            return rv;
        } else throw new Error('bad choreography'); // todo: is this really useful? the mathematical way to approach this would be to return true if there are no children
    }
    /* Iteration of children during traversal is automatically done based on insertion
       order (https://stackoverflow.com/a/31159284/274677).
       This is exactly the behavior I want if the trees are to be used in an alpha-beta pruning
       algorithm, in which case I may want to place the children in such an order as to increase
       the likelihood of pruning incidents.
    */
    set(edge: E, node: Node<V,E>): ?Node<V,E> {
        if (this.children === null) {
            this.children = new Map();
        }
        const children: ?Map<E, Node<V, E>> = this.children;
        if (children!=null) {
            const prevValue: ?Node<V, E> = children.get(edge);
            children.set(edge, node);
            node.setParent(this);
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
        function _visit(n: Node<V,E>, parentN: ?Node<V,E>, birthEdge: ?E, depth: number) {
            assert.isTrue(!cycleDetector.includes(n), 'cycle detected');
            cycleDetector.push(n);
            if (visitParentFirstThenChildren) {
                if ((n!==that) || visitStartNode) {
                    f(n, parentN, birthEdge, depth);
                }
            }
            const children: ?Map<E, Node<V,E>> = n.children;
            if (children != null) {
                children.forEach( (v: Node<V,E>, k: E) => {
                    _visit(v, n, k, depth+1);
                });
            }
            if (!visitParentFirstThenChildren) {
                if ((n!==that) || visitStartNode) {
                    f(n, parentN, birthEdge, depth);
                }
            }
        }
        _visit(this, null, null, 0);
    }

    traverseAncestors(f: F2<V, E>, includingThisNode: boolean = true): void {
        let distance = 0;
        let node: Node<V, E> = this;
        let child: ?Node<V, E> = null;
        let edge: ?E = null;
        while (true) {
            if ((node!==this) || includingThisNode)
                f(node, child, edge, distance, node.parent===null);
            if (node.parent!=null) {
                const savedParent: Node<V, E> = node.parent;
                child = node;
                edge = node.parent.edgeThatLeadsTo(node);
                node = savedParent;
                distance++;
            } else
                break;
        }
    }

    // "previous" is understood to be according to the map's enumeration order (which is the insertion order)
    allPreviousSiblingsSatisfyPredicate(pred: Predicate<Node<V, E>>): boolean {
        if (this.parent==null) {
            assert.isTrue(this.parent===null); // re-inforcing rigor (albeit at runtime) that FlowType's nagging forced me to abandon
            return true;
        } else {
            let allSatisfy = true;
            if (this.parent.children!=null) {
                for (let [edge, node] of this.parent.children) {
                    (edge: E);
                    (node: Node<V, E>);
                    if (node===this)
                        break;
                    if (!pred(node)) {
                        allSatisfy = false;
                        break;
                    }
                }
                return allSatisfy;
            } else {
                // re-inforcing rigor (albeit at runtime) that FlowType's nagging forced me to abandon
                assert.isTrue(this.parent.children===null);
                return true;
            }
        }
    }

    onePrevousSiblingFailsPredicate(pred: Predicate<Node<V, E>>): boolean {
        return !this.allPreviousSiblingsSatisfyPredicate(pred);
    }

    allAncestorsSatisfyPredicate(pred: Predicate<Node<V, E>>, includingThisNode: boolean = true): boolean {
        let earliestAncestorThatDoesntSatisfyPredicate: ?Node<V, E> = this.earliestAncestorThatDoesntSatisfyPredicate(pred, includingThisNode);
        if (earliestAncestorThatDoesntSatisfyPredicate===null)
            return true;
        else {
            assert.isTrue(earliestAncestorThatDoesntSatisfyPredicate!=null);
            return false;
        }
    }

    earliestAncestorThatDoesntSatisfyPredicate(pred: Predicate<Node<V, E>>, includingThisNode: boolean = true): ?Node<V, E> {
        function f(x: Node<V, E>) {
            if (!pred(x))
                throw x;
        }
        try {
            this.traverseAncestors(f, includingThisNode);
            return null;
        } catch (x) {
            assert.isTrue(x instanceof Node);
            return x;
        }
    }
    
    descendants(includingThisNode: boolean = false): Array<Node<V, E>> {
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

    leaves(_includingThisNode: ?boolean): Array<Node<V,E>> {
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

    print(valuePrinter: Stringifier<V> =  (x: V)=>String(x)): string {
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

    // root is at depth 0
    depthFromRoot(): number {
        if (this.parent==null) {
            assert.isTrue(this.parent===null); // we should never expect to find an undefined parent, only null is allowed
            return 0;
        } else {
            return 1+this.parent.depthFromRoot();
        }
    }
}


exports.Node = Node;
exports.TREE_NODE_ID_SYMBOL_KEY = TREE_NODE_ID_SYMBOL_KEY;
