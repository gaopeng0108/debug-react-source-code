/**
 * Copyright (c) 2013-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import ReactDOM from 'react-dom';
import {findCurrentFiberUsingSlowPath} from 'react-reconciler/reflection';
import * as ReactInstanceMap from 'shared/ReactInstanceMap';
import {
  ClassComponent,
  FunctionalComponent,
  HostComponent,
  HostText,
} from 'shared/ReactTypeOfWork';
import SyntheticEvent from 'react-events/SyntheticEvent';
import invariant from 'fbjs/lib/invariant';

import {topLevelTypes, mediaEventTypes} from '../events/BrowserEventConstants';

const {findDOMNode} = ReactDOM;
const {
  EventPluginHub,
  EventPluginRegistry,
  EventPropagators,
  ReactControlledComponent,
  ReactDOMComponentTree,
  ReactDOMEventListener,
} = ReactDOM.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;

function Event(suffix) {}

/**
 * @class ReactTestUtils
 */

function findAllInRenderedFiberTreeInternal(fiber, test) {
  if (!fiber) {
    return [];
  }
  const currentParent = findCurrentFiberUsingSlowPath(fiber);
  if (!currentParent) {
    return [];
  }
  let node = currentParent;
  let ret = [];
  while (true) {
    if (
      node.tag === HostComponent ||
      node.tag === HostText ||
      node.tag === ClassComponent ||
      node.tag === FunctionalComponent
    ) {
      const publicInst = node.stateNode;
      if (test(publicInst)) {
        ret.push(publicInst);
      }
    }
    if (node.child) {
      node.child.return = node;
      node = node.child;
      continue;
    }
    if (node === currentParent) {
      return ret;
    }
    while (!node.sibling) {
      if (!node.return || node.return === currentParent) {
        return ret;
      }
      node = node.return;
    }
    node.sibling.return = node.return;
    node = node.sibling;
  }
}

/**
 * Utilities for making it easy to test React components.
 *
 * See https://reactjs.org/docs/test-utils.html
 *
 * Todo: Support the entire DOM.scry query syntax. For now, these simple
 * utilities will suffice for testing purposes.
 * @lends ReactTestUtils
 */
const ReactTestUtils = {
  renderIntoDocument: function(element) {
    const div = document.createElement('div');
    // None of our tests actually require attaching the container to the
    // DOM, and doing so creates a mess that we rely on test isolation to
    // clean up, so we're going to stop honoring the name of this method
    // (and probably rename it eventually) if no problems arise.
    // document.documentElement.appendChild(div);
    return ReactDOM.render(element, div);
  },

  isElement: function(element) {
    return React.isValidElement(element);
  },

  isElementOfType: function(inst, convenienceConstructor) {
    return React.isValidElement(inst) && inst.type === convenienceConstructor;
  },

  isDOMComponent: function(inst) {
    return !!(inst && inst.nodeType === 1 && inst.tagName);
  },

  isDOMComponentElement: function(inst) {
    return !!(inst && React.isValidElement(inst) && !!inst.tagName);
  },

  isCompositeComponent: function(inst) {
    if (ReactTestUtils.isDOMComponent(inst)) {
      // Accessing inst.setState warns; just return false as that'll be what
      // this returns when we have DOM nodes as refs directly
      return false;
    }
    return (
      inst != null &&
      typeof inst.render === 'function' &&
      typeof inst.setState === 'function'
    );
  },

  isCompositeComponentWithType: function(inst, type) {
    if (!ReactTestUtils.isCompositeComponent(inst)) {
      return false;
    }
    const internalInstance = ReactInstanceMap.get(inst);
    const constructor = internalInstance.type;
    return constructor === type;
  },

  findAllInRenderedTree: function(inst, test) {
    if (!inst) {
      return [];
    }
    invariant(
      ReactTestUtils.isCompositeComponent(inst),
      'findAllInRenderedTree(...): instance must be a composite component',
    );
    const internalInstance = ReactInstanceMap.get(inst);
    return findAllInRenderedFiberTreeInternal(internalInstance, test);
  },

  /**
   * Finds all instance of components in the rendered tree that are DOM
   * components with the class name matching `className`.
   * @return {array} an array of all the matches.
   */
  scryRenderedDOMComponentsWithClass: function(root, classNames) {
    return ReactTestUtils.findAllInRenderedTree(root, function(inst) {
      if (ReactTestUtils.isDOMComponent(inst)) {
        let className = inst.className;
        if (typeof className !== 'string') {
          // SVG, probably.
          className = inst.getAttribute('class') || '';
        }
        const classList = className.split(/\s+/);

        if (!Array.isArray(classNames)) {
          invariant(
            classNames !== undefined,
            'TestUtils.scryRenderedDOMComponentsWithClass expects a ' +
              'className as a second argument.',
          );
          classNames = classNames.split(/\s+/);
        }
        return classNames.every(function(name) {
          return classList.indexOf(name) !== -1;
        });
      }
      return false;
    });
  },

  /**
   * Like scryRenderedDOMComponentsWithClass but expects there to be one result,
   * and returns that one result, or throws exception if there is any other
   * number of matches besides one.
   * @return {!ReactDOMComponent} The one match.
   */
  findRenderedDOMComponentWithClass: function(root, className) {
    const all = ReactTestUtils.scryRenderedDOMComponentsWithClass(
      root,
      className,
    );
    if (all.length !== 1) {
      throw new Error(
        'Did not find exactly one match (found: ' +
          all.length +
          ') ' +
          'for class:' +
          className,
      );
    }
    return all[0];
  },

  /**
   * Finds all instance of components in the rendered tree that are DOM
   * components with the tag name matching `tagName`.
   * @return {array} an array of all the matches.
   */
  scryRenderedDOMComponentsWithTag: function(root, tagName) {
    return ReactTestUtils.findAllInRenderedTree(root, function(inst) {
      return (
        ReactTestUtils.isDOMComponent(inst) &&
        inst.tagName.toUpperCase() === tagName.toUpperCase()
      );
    });
  },

  /**
   * Like scryRenderedDOMComponentsWithTag but expects there to be one result,
   * and returns that one result, or throws exception if there is any other
   * number of matches besides one.
   * @return {!ReactDOMComponent} The one match.
   */
  findRenderedDOMComponentWithTag: function(root, tagName) {
    const all = ReactTestUtils.scryRenderedDOMComponentsWithTag(root, tagName);
    if (all.length !== 1) {
      throw new Error(
        'Did not find exactly one match (found: ' +
          all.length +
          ') ' +
          'for tag:' +
          tagName,
      );
    }
    return all[0];
  },

  /**
   * Finds all instances of components with type equal to `componentType`.
   * @return {array} an array of all the matches.
   */
  scryRenderedComponentsWithType: function(root, componentType) {
    return ReactTestUtils.findAllInRenderedTree(root, function(inst) {
      return ReactTestUtils.isCompositeComponentWithType(inst, componentType);
    });
  },

  /**
   * Same as `scryRenderedComponentsWithType` but expects there to be one result
   * and returns that one result, or throws exception if there is any other
   * number of matches besides one.
   * @return {!ReactComponent} The one match.
   */
  findRenderedComponentWithType: function(root, componentType) {
    const all = ReactTestUtils.scryRenderedComponentsWithType(
      root,
      componentType,
    );
    if (all.length !== 1) {
      throw new Error(
        'Did not find exactly one match (found: ' +
          all.length +
          ') ' +
          'for componentType:' +
          componentType,
      );
    }
    return all[0];
  },

  /**
   * Pass a mocked component module to this method to augment it with
   * useful methods that allow it to be used as a dummy React component.
   * Instead of rendering as usual, the component will become a simple
   * <div> containing any provided children.
   *
   * @param {object} module the mock function object exported from a
   *                        module that defines the component to be mocked
   * @param {?string} mockTagName optional dummy root tag name to return
   *                              from render method (overrides
   *                              module.mockTagName if provided)
   * @return {object} the ReactTestUtils object (for chaining)
   */
  mockComponent: function(module, mockTagName) {
    mockTagName = mockTagName || module.mockTagName || 'div';

    module.prototype.render.mockImplementation(function() {
      return React.createElement(mockTagName, null, this.props.children);
    });

    return this;
  },

  /**
   * Simulates a top level event being dispatched from a raw event that occurred
   * on an `Element` node.
   * @param {Object} topLevelType A type from `BrowserEventConstants.topLevelTypes`
   * @param {!Element} node The dom to simulate an event occurring on.
   * @param {?Event} fakeNativeEvent Fake native event to use in SyntheticEvent.
   */
  simulateNativeEventOnNode: function(topLevelType, node, fakeNativeEvent) {
    fakeNativeEvent.target = node;
    ReactDOMEventListener.dispatchEvent(topLevelType, fakeNativeEvent);
  },

  /**
   * Simulates a top level event being dispatched from a raw event that occurred
   * on the `ReactDOMComponent` `comp`.
   * @param {Object} topLevelType A type from `BrowserEventConstants.topLevelTypes`.
   * @param {!ReactDOMComponent} comp
   * @param {?Event} fakeNativeEvent Fake native event to use in SyntheticEvent.
   */
  simulateNativeEventOnDOMComponent: function(
    topLevelType,
    comp,
    fakeNativeEvent,
  ) {
    ReactTestUtils.simulateNativeEventOnNode(
      topLevelType,
      findDOMNode(comp),
      fakeNativeEvent,
    );
  },

  nativeTouchData: function(x, y) {
    return {
      touches: [{pageX: x, pageY: y}],
    };
  },

  Simulate: null,
  SimulateNative: {},
};

/**
 * Exports:
 *
 * - `ReactTestUtils.Simulate.click(Element)`
 * - `ReactTestUtils.Simulate.mouseMove(Element)`
 * - `ReactTestUtils.Simulate.change(Element)`
 * - ... (All keys from event plugin `eventTypes` objects)
 */
function makeSimulator(eventType) {
  return function(domNode, eventData) {
    invariant(
      !React.isValidElement(domNode),
      'TestUtils.Simulate expected a DOM node as the first argument but received ' +
        'a React element. Pass the DOM node you wish to simulate the event on instead. ' +
        'Note that TestUtils.Simulate will not work if you are using shallow rendering.',
    );
    invariant(
      !ReactTestUtils.isCompositeComponent(domNode),
      'TestUtils.Simulate expected a DOM node as the first argument but received ' +
        'a component instance. Pass the DOM node you wish to simulate the event on instead.',
    );

    const dispatchConfig =
      EventPluginRegistry.eventNameDispatchConfigs[eventType];

    const fakeNativeEvent = new Event();
    fakeNativeEvent.target = domNode;
    fakeNativeEvent.type = eventType.toLowerCase();

    // We don't use SyntheticEvent.getPooled in order to not have to worry about
    // properly destroying any properties assigned from `eventData` upon release
    const targetInst = ReactDOMComponentTree.getInstanceFromNode(domNode);
    const event = new SyntheticEvent(
      dispatchConfig,
      targetInst,
      fakeNativeEvent,
      domNode,
    );

    // Since we aren't using pooling, always persist the event. This will make
    // sure it's marked and won't warn when setting additional properties.
    event.persist();
    Object.assign(event, eventData);

    if (dispatchConfig.phasedRegistrationNames) {
      EventPropagators.accumulateTwoPhaseDispatches(event);
    } else {
      EventPropagators.accumulateDirectDispatches(event);
    }

    ReactDOM.unstable_batchedUpdates(function() {
      // Normally extractEvent enqueues a state restore, but we'll just always
      // do that since we we're by-passing it here.
      ReactControlledComponent.enqueueStateRestore(domNode);
      EventPluginHub.runEventsInBatch(event, true);
    });
    ReactControlledComponent.restoreStateIfNeeded();
  };
}

function buildSimulators() {
  ReactTestUtils.Simulate = {};

  let eventType;
  for (eventType in EventPluginRegistry.eventNameDispatchConfigs) {
    /**
     * @param {!Element|ReactDOMComponent} domComponentOrNode
     * @param {?object} eventData Fake event data to use in SyntheticEvent.
     */
    ReactTestUtils.Simulate[eventType] = makeSimulator(eventType);
  }
}

// Rebuild ReactTestUtils.Simulate whenever event plugins are injected
const oldInjectEventPluginOrder =
  EventPluginHub.injection.injectEventPluginOrder;
EventPluginHub.injection.injectEventPluginOrder = function() {
  oldInjectEventPluginOrder.apply(this, arguments);
  buildSimulators();
};
const oldInjectEventPlugins = EventPluginHub.injection.injectEventPluginsByName;
EventPluginHub.injection.injectEventPluginsByName = function() {
  oldInjectEventPlugins.apply(this, arguments);
  buildSimulators();
};

buildSimulators();

/**
 * Exports:
 *
 * - `ReactTestUtils.SimulateNative.click(Element/ReactDOMComponent)`
 * - `ReactTestUtils.SimulateNative.mouseMove(Element/ReactDOMComponent)`
 * - `ReactTestUtils.SimulateNative.mouseIn/ReactDOMComponent)`
 * - `ReactTestUtils.SimulateNative.mouseOut(Element/ReactDOMComponent)`
 * - ... (All keys from `BrowserEventConstants.topLevelTypes`)
 *
 * Note: Top level event types are a subset of the entire set of handler types
 * (which include a broader set of "synthetic" events). For example, onDragDone
 * is a synthetic event. Except when testing an event plugin or React's event
 * handling code specifically, you probably want to use ReactTestUtils.Simulate
 * to dispatch synthetic events.
 */

function makeNativeSimulator(eventType) {
  return function(domComponentOrNode, nativeEventData) {
    const fakeNativeEvent = new Event(eventType);
    Object.assign(fakeNativeEvent, nativeEventData);
    if (ReactTestUtils.isDOMComponent(domComponentOrNode)) {
      ReactTestUtils.simulateNativeEventOnDOMComponent(
        eventType,
        domComponentOrNode,
        fakeNativeEvent,
      );
    } else if (domComponentOrNode.tagName) {
      // Will allow on actual dom nodes.
      ReactTestUtils.simulateNativeEventOnNode(
        eventType,
        domComponentOrNode,
        fakeNativeEvent,
      );
    }
  };
}

const eventKeys = [].concat(
  Object.keys(topLevelTypes),
  Object.keys(mediaEventTypes),
);

eventKeys.forEach(function(eventType) {
  // Event type is stored as 'topClick' - we transform that to 'click'
  const convenienceName =
    eventType.indexOf('top') === 0
      ? eventType.charAt(3).toLowerCase() + eventType.substr(4)
      : eventType;
  /**
   * @param {!Element|ReactDOMComponent} domComponentOrNode
   * @param {?Event} nativeEventData Fake native event to use in SyntheticEvent.
   */
  ReactTestUtils.SimulateNative[convenienceName] = makeNativeSimulator(
    eventType,
  );
});

export default ReactTestUtils;
