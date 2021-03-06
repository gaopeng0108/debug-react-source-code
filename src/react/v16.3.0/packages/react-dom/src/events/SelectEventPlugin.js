/**
 * Copyright (c) 2013-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {accumulateTwoPhaseDispatches} from 'react-events/EventPropagators';
import ExecutionEnvironment from 'fbjs/lib/ExecutionEnvironment';
import SyntheticEvent from 'react-events/SyntheticEvent';
import isTextInputElement from 'shared/isTextInputElement';
import getActiveElement from 'fbjs/lib/getActiveElement';
import shallowEqual from 'fbjs/lib/shallowEqual';

import {isListeningToAllDependencies} from './ReactBrowserEventEmitter';
import {getNodeFromInstance} from '../client/ReactDOMComponentTree';
import * as ReactInputSelection from '../client/ReactInputSelection';
import {DOCUMENT_NODE} from '../shared/HTMLNodeType';

const skipSelectionChangeEvent =
  ExecutionEnvironment.canUseDOM &&
  'documentMode' in document &&
  document.documentMode <= 11;

const eventTypes = {
  select: {
    phasedRegistrationNames: {
      bubbled: 'onSelect',
      captured: 'onSelectCapture',
    },
    dependencies: [
      'topBlur',
      'topContextMenu',
      'topFocus',
      'topKeyDown',
      'topKeyUp',
      'topMouseDown',
      'topMouseUp',
      'topSelectionChange',
    ],
  },
};

let activeElement = null;
let activeElementInst = null;
let lastSelection = null;
let mouseDown = false;

/**
 * Get an object which is a unique representation of the current selection.
 *
 * The return value will not be consistent across nodes or browsers, but
 * two identical selections on the same node will return identical objects.
 *
 * @param {DOMElement} node
 * @return {object}
 */
function getSelection(node) {
  if (
    'selectionStart' in node &&
    ReactInputSelection.hasSelectionCapabilities(node)
  ) {
    return {
      start: node.selectionStart,
      end: node.selectionEnd,
    };
  } else if (window.getSelection) {
    const selection = window.getSelection();
    return {
      anchorNode: selection.anchorNode,
      anchorOffset: selection.anchorOffset,
      focusNode: selection.focusNode,
      focusOffset: selection.focusOffset,
    };
  }
}

/**
 * Poll selection to see whether it's changed.
 *
 * @param {object} nativeEvent
 * @return {?SyntheticEvent}
 */
function constructSelectEvent(nativeEvent, nativeEventTarget) {
  // Ensure we have the right element, and that the user is not dragging a
  // selection (this matches native `select` event behavior). In HTML5, select
  // fires only on input and textarea thus if there's no focused element we
  // won't dispatch.
  if (
    mouseDown ||
    activeElement == null ||
    activeElement !== getActiveElement()
  ) {
    return null;
  }

  // Only fire when selection has actually changed.
  const currentSelection = getSelection(activeElement);
  if (!lastSelection || !shallowEqual(lastSelection, currentSelection)) {
    lastSelection = currentSelection;

    const syntheticEvent = SyntheticEvent.getPooled(
      eventTypes.select,
      activeElementInst,
      nativeEvent,
      nativeEventTarget,
    );

    syntheticEvent.type = 'select';
    syntheticEvent.target = activeElement;

    accumulateTwoPhaseDispatches(syntheticEvent);

    return syntheticEvent;
  }

  return null;
}

/**
 * This plugin creates an `onSelect` event that normalizes select events
 * across form elements.
 *
 * Supported elements are:
 * - input (see `isTextInputElement`)
 * - textarea
 * - contentEditable
 *
 * This differs from native browser implementations in the following ways:
 * - Fires on contentEditable fields as well as inputs.
 * - Fires for collapsed selection.
 * - Fires after user input.
 */
const SelectEventPlugin = {
  eventTypes: eventTypes,

  extractEvents: function(
    topLevelType,
    targetInst,
    nativeEvent,
    nativeEventTarget,
  ) {
    const doc =
      nativeEventTarget.window === nativeEventTarget
        ? nativeEventTarget.document
        : nativeEventTarget.nodeType === DOCUMENT_NODE
          ? nativeEventTarget
          : nativeEventTarget.ownerDocument;
    // Track whether all listeners exists for this plugin. If none exist, we do
    // not extract events. See #3639.
    if (!doc || !isListeningToAllDependencies('onSelect', doc)) {
      return null;
    }

    const targetNode = targetInst ? getNodeFromInstance(targetInst) : window;

    switch (topLevelType) {
      // Track the input node that has focus.
      case 'topFocus':
        if (
          isTextInputElement(targetNode) ||
          targetNode.contentEditable === 'true'
        ) {
          activeElement = targetNode;
          activeElementInst = targetInst;
          lastSelection = null;
        }
        break;
      case 'topBlur':
        activeElement = null;
        activeElementInst = null;
        lastSelection = null;
        break;
      // Don't fire the event while the user is dragging. This matches the
      // semantics of the native select event.
      case 'topMouseDown':
        mouseDown = true;
        break;
      case 'topContextMenu':
      case 'topMouseUp':
        mouseDown = false;
        return constructSelectEvent(nativeEvent, nativeEventTarget);
      // Chrome and IE fire non-standard event when selection is changed (and
      // sometimes when it hasn't). IE's event fires out of order with respect
      // to key and input events on deletion, so we discard it.
      //
      // Firefox doesn't support selectionchange, so check selection status
      // after each key entry. The selection changes after keydown and before
      // keyup, but we check on keydown as well in the case of holding down a
      // key, when multiple keydown events are fired but only one keyup is.
      // This is also our approach for IE handling, for the reason above.
      case 'topSelectionChange':
        if (skipSelectionChangeEvent) {
          break;
        }
      // falls through
      case 'topKeyDown':
      case 'topKeyUp':
        return constructSelectEvent(nativeEvent, nativeEventTarget);
    }

    return null;
  },
};

export default SelectEventPlugin;
