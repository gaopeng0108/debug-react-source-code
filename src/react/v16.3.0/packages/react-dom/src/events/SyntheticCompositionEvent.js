/**
 * Copyright (c) 2013-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import SyntheticEvent from 'react-events/SyntheticEvent';

/**
 * @interface Event
 * @see http://www.w3.org/TR/DOM-Level-3-react-events/#events-compositionevents
 */
const SyntheticCompositionEvent = SyntheticEvent.extend({
  data: null,
});

export default SyntheticCompositionEvent;
