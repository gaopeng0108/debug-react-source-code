/**
 * Copyright (c) 2013-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import SyntheticUIEvent from './SyntheticUIEvent';

/**
 * @interface FocusEvent
 * @see http://www.w3.org/TR/DOM-Level-3-react-events/
 */
const SyntheticFocusEvent = SyntheticUIEvent.extend({
  relatedTarget: null,
});

export default SyntheticFocusEvent;
