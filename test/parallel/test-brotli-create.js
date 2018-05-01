// Flags: --expose-brotli
'use strict';

require('../common');
const assert = require('assert');
const brotli = require('brotli');

{
  const compress = brotli.createCompress();
  assert(compress instanceof brotli.Compress);
}

{
  const decompress = brotli.createDecompress();
  assert(decompress instanceof brotli.Decompress);
}
