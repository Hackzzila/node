// Flags: --expose-brotli
'use strict';

const common = require('../common');
const assert = require('assert');
const brotli = require('brotli');

const {
  BROTLI_OPERATION_PROCESS, BROTLI_OPERATION_FLUSH, BROTLI_OPERATION_FINISH,
} = brotli.constants;

common.crashOnUnhandledRejection();

async function getOutput(...sequenceOfFlushes) {
  const zipper = new brotli.Compress({ highWaterMark: 16384 });

  zipper.write('A'.repeat(17000));
  for (const flush of sequenceOfFlushes) {
    zipper.flush(flush);
  }

  const data = [];

  return new Promise((resolve) => {
    zipper.on('data', common.mustCall((d) => {
      data.push(d);
      if (data.length === 2) resolve(Buffer.concat(data));
    }, 2));
  });
}

(async function() {
  assert.deepStrictEqual(await getOutput(BROTLI_OPERATION_FLUSH),
                         await getOutput(BROTLI_OPERATION_PROCESS,
                                         BROTLI_OPERATION_FLUSH));

  assert.deepStrictEqual(await getOutput(BROTLI_OPERATION_FINISH),
                         await getOutput(BROTLI_OPERATION_PROCESS,
                                         BROTLI_OPERATION_FINISH));

  assert.deepStrictEqual(await getOutput(BROTLI_OPERATION_FINISH),
                         await getOutput(BROTLI_OPERATION_FLUSH,
                                         BROTLI_OPERATION_FINISH));
})();
