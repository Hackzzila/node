// Flags: --expose-brotli
'use strict';
const common = require('../common');
const brotli = require('brotli');

new brotli.Compress({ flush: brotli.constants.BROTLI_OPERATION_FLUSH });

common.expectsError(
  () => new brotli.Compress({ flush: 'foobar' }),
  {
    code: 'ERR_INVALID_ARG_TYPE',
    type: TypeError,
    message: 'The "options.flush" property must be of type number. ' +
             'Received type string'
  }
);

common.expectsError(
  () => new brotli.Compress({ flush: 10000 }),
  {
    code: 'ERR_OUT_OF_RANGE',
    type: RangeError,
    message: 'The value of "options.flush" is out of range. It must ' +
             'be >= 0 and <= 2. Received 10000'
  }
);

new brotli.Compress({ finishFlush: brotli.constants.BROTLI_OPERATION_FLUSH });

common.expectsError(
  () => new brotli.Compress({ finishFlush: 'foobar' }),
  {
    code: 'ERR_INVALID_ARG_TYPE',
    type: TypeError,
    message: 'The "options.finishFlush" property must be of type number. ' +
             'Received type string'
  }
);

common.expectsError(
  () => new brotli.Compress({ finishFlush: 10000 }),
  {
    code: 'ERR_OUT_OF_RANGE',
    type: RangeError,
    message: 'The value of "options.finishFlush" is out of range. It must ' +
             'be >= 0 and <= 2. Received 10000'
  }
);
