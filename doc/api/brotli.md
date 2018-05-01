# Brotli

> Stability: 1 - Experimental

The `brotli` module provides compression functionality implemented using Brotli.
It can be accessed using:

```js
const brotli = require('brotli');
```

Compressing or decompressing a stream (such as a file) can be accomplished by
piping the source stream data through a `brotli` stream into a destination
stream:

```js
const compress = new brotli.Compress();
const fs = require('fs');
const inp = fs.createReadStream('input.txt');
const out = fs.createWriteStream('input.txt.gz');

inp.pipe(compress).pipe(out);
```

It is also possible to compress or decompress data in a single step:

```js
const input = '.................................';
brotli.compress(input, (err, buffer) => {
  if (!err) {
    console.log(buffer.toString('base64'));
  } else {
    // handle error
  }
});

const buffer = Buffer.from('GyAA+CVcgowA4A==', 'base64');
brotli.decompress(buffer, (err, buffer) => {
  if (!err) {
    console.log(buffer.toString());
  } else {
    // handle error
  }
});
```

## Threadpool Usage

Note that all brotli APIs except those that are explicitly synchronous use
libuv's threadpool, which can have surprising and negative performance
implications for some applications, see the [`UV_THREADPOOL_SIZE`][]
documentation for more information.

## Compressing HTTP requests and responses

The `brotli` module can be used to implement support for the `br`
content-encoding mechanisms defined by
[HTTP](https://tools.ietf.org/html/rfc7230#section-4.2).

The HTTP [`Accept-Encoding`][] header is used within an http request to identify
the compression encodings accepted by the client. The [`Content-Encoding`][]
header is used to identify the compression encodings actually applied to a
message.

The examples given below are drastically simplified to show the basic concept.
Using `brotli` encoding can be expensive, and the results ought to be cached.
See [Memory Usage Tuning][] for more information on the speed/memory/compression
tradeoffs involved in `brotli` usage.

```js
// client request example
const brotli = require('brotli');
const http = require('http');
const fs = require('fs');
const request = http.get({ host: 'example.com',
                           path: '/',
                           port: 80,
                           headers: { 'Accept-Encoding': 'br' } });
request.on('response', (response) => {
  const output = fs.createWriteStream('example.com_index.html');

  switch (response.headers['content-encoding']) {
    case 'br':
      response.pipe(new brotli.Decompress()).pipe(output);
      break;
    default:
      response.pipe(output);
      break;
  }
});
```

```js
// server example
// Running a brotli operation on every request is quite expensive.
// It would be much more efficient to cache the compressed buffer.
const brotli = require('brotli');
const http = require('http');
const fs = require('fs');
http.createServer((request, response) => {
  const raw = fs.createReadStream('index.html');
  let acceptEncoding = request.headers['accept-encoding'];
  if (!acceptEncoding) {
    acceptEncoding = '';
  }

  // Note: This is not a conformant accept-encoding parser.
  // See https://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.3
  // Note: A quality of 4 is a good balace of speed and quality.
  // See https://blogs.akamai.com/2016/02/understanding-brotlis-potential.html
  if (/\bbr\b/.test(acceptEncoding)) {
    response.writeHead(200, { 'Content-Encoding': 'br' });
    raw.pipe(new brotli.Compress({ quality: 4 })).pipe(response);
  } else {
    response.writeHead(200, {});
    raw.pipe(response);
  }
}).listen(1337);
```

By default, the `brotli` methods will throw an error when decompressing
truncated data. However, if it is known that the data is incomplete, or
the desire is to inspect only the beginning of a compressed file, it is
possible to suppress the default error handling by changing the flushing
method that is used to decompress the last chunk of input data:

```js
// This is a truncated version of the buffer from the above examples
const buffer = Buffer.from('GyAA+CV', 'base64');

brotli.unzip(
  buffer,
  { finishFlush: brotli.constants.BROTLI_OPERATION_FLUSH },
  (err, buffer) => {
    if (!err) {
      console.log(buffer.toString());
    } else {
      // handle error
    }
  });
```

This will not change the behavior in other error-throwing situations, e.g.
when the input data has an invalid format. Using this method, it will not be
possible to determine whether the input ended prematurely or lacks the
integrity checks, making it necessary to manually check that the
decompressed result is valid.

## Flushing

Calling [`.flush()`][] on a compression stream will make `brotli` return as much
output as currently possible. This may come at the cost of degraded compression
quality, but can be useful when data needs to be available as soon as possible.

In the following example, `flush()` is used to write a compressed partial
HTTP response to the client:
```js
const brotli = require('brotli');
const http = require('http');

http.createServer((request, response) => {
  // For the sake of simplicity, the Accept-Encoding checks are omitted.
  response.writeHead(200, { 'content-encoding': 'br' });
  const output = new brotli.Compress();
  output.pipe(response);

  setInterval(() => {
    output.write(`The current time is ${Date()}\n`, () => {
      // The data has been passed to brotli, but the compression algorithm may
      // have decided to buffer the data for more efficient compression.
      // Calling .flush() will make the data available as soon as the client
      // is ready to receive it.
      output.flush();
    });
  }, 1000);
}).listen(1337);
```

## Constants
<!-- YAML
added: v0.5.8
-->

<!--type=misc-->

All of the constants defined in [`brotli/encode.h`][] and [`brotli/decode.h`][]
are also defined on `require('brotli').constants`. In the normal course of
operations, it will not be necessary to use these constants. They are documented
so that their presence is not surprising.

Allowed op values.

* `brotli.constants.BROTLI_OPERATION_PROCESS`
* `brotli.constants.BROTLI_OPERATION_FLUSH`
* `brotli.constants.BROTLI_OPERATION_FINISH`

Return codes for the compression functions. 

* `brotli.constants.BROTLI_TRUE`
* `brotli.constants.BROTLI_FALSE`

Return codes for the decompression functions. Negative values are errors,
positive values are used for special but normal events.

* `brotli.constants.BROTLI_DECODER_NO_ERROR`
* `brotli.constants.BROTLI_DECODER_SUCCESS`
* `brotli.constants.BROTLI_DECODER_NEEDS_MORE_INPUT`
* `brotli.constants.BROTLI_DECODER_NEEDS_MORE_OUTPUT`
* `brotli.constants.BROTLI_DECODER_ERROR_FORMAT_EXUBERANT_NIBBLE`
* `brotli.constants.BROTLI_DECODER_ERROR_FORMAT_RESERVED`
* `brotli.constants.BROTLI_DECODER_ERROR_FORMAT_EXUBERANT_META_NIBBLE`
* `brotli.constants.BROTLI_DECODER_ERROR_FORMAT_SIMPLE_HUFFMAN_ALPHABET`
* `brotli.constants.BROTLI_DECODER_ERROR_FORMAT_SIMPLE_HUFFMAN_SAME`
* `brotli.constants.BROTLI_DECODER_ERROR_FORMAT_CL_SPACE`
* `brotli.constants.BROTLI_DECODER_ERROR_FORMAT_HUFFMAN_SPACE`
* `brotli.constants.BROTLI_DECODER_ERROR_FORMAT_CONTEXT_MAP_REPEAT`
* `brotli.constants.BROTLI_DECODER_ERROR_FORMAT_BLOCK_LENGTH_1`
* `brotli.constants.BROTLI_DECODER_ERROR_FORMAT_BLOCK_LENGTH_2`
* `brotli.constants.BROTLI_DECODER_ERROR_FORMAT_TRANSFORM`
* `brotli.constants.BROTLI_DECODER_ERROR_FORMAT_DICTIONARY`
* `brotli.constants.BROTLI_DECODER_ERROR_FORMAT_WINDOW_BITS`
* `brotli.constants.BROTLI_DECODER_ERROR_FORMAT_PADDING_1`
* `brotli.constants.BROTLI_DECODER_ERROR_FORMAT_PADDING_2`
* `brotli.constants.BROTLI_DECODER_ERROR_FORMAT_DISTANCE`
* `brotli.constants.BROTLI_DECODER_ERROR_DICTIONARY_NOT_SET`
* `brotli.constants.BROTLI_DECODER_ERROR_INVALID_ARGUMENTS`
* `brotli.constants.BROTLI_DECODER_ERROR_ALLOC_CONTEXT_MODES`
* `brotli.constants.BROTLI_DECODER_ERROR_ALLOC_TREE_GROUPS`
* `brotli.constants.BROTLI_DECODER_ERROR_ALLOC_CONTEXT_MAP`
* `brotli.constants.BROTLI_DECODER_ERROR_ALLOC_RING_BUFFER_1`
* `brotli.constants.BROTLI_DECODER_ERROR_ALLOC_RING_BUFFER_2`
* `brotli.constants.BROTLI_DECODER_ERROR_ALLOC_BLOCK_TYPE_TREES`
* `brotli.constants.BROTLI_DECODER_ERROR_UNREACHABLE`

Chunk sizes.

* `brotli.constants.BROTLI_MIN_CHUNK`
* `brotli.constants.BROTLI_MAX_CHUNK`
* `brotli.constants.BROTLI_DEFAULT_CHUNK`

Compression mode.

* `brotli.constants.BROTLI_MODE_GENERIC`
* `brotli.constants.BROTLI_MODE_TEXT`
* `brotli.constants.BROTLI_MODE_FONT`
* `brotli.constants.BROTLI_DEFAULT_MODE`

Quality levels.

* `brotli.constants.BROTLI_MIN_QUALITY`
* `brotli.constants.BROTLI_MAX_QUALITY`
* `brotli.constants.BROTLI_DEFAULT_QUALITY`

LGWIN values.

* `brotli.constants.BROTLI_MIN_WINDOW_BITS`
* `brotli.constants.BROTLI_MAX_WINDOW_BITS`
* `brotli.constants.BROTLI_LARGE_MAX_WINDOW_BITS`
* `brotli.constants.BROTLI_DEFAULT_WINDOW`

LGBLOCK values.

* `brotli.constants.BROTLI_MIN_INPUT_BLOCK_BITS`
* `brotli.constants.BROTLI_MAX_INPUT_BLOCK_BITS`

NPOSTFIX values.

* `brotli.constants.BROTLI_MAX_NPOSTFIX`

Misc.

* `brotli.constants.BROTLI_PARAM_MODE`
* `brotli.constants.BROTLI_PARAM_QUALITY`
* `brotli.constants.BROTLI_PARAM_LGWIN`
* `brotli.constants.BROTLI_PARAM_LGBLOCK`
* `brotli.constants.BROTLI_PARAM_DISABLE_LITERAL_CONTEXT_MODELING`
* `brotli.constants.BROTLI_PARAM_SIZE_HINT`
* `brotli.constants.BROTLI_PARAM_LARGE_WINDOW`
* `brotli.constants.BROTLI_PARAM_NPOSTFIX`
* `brotli.constants.BROTLI_PARAM_NDIRECT`
* `brotli.constants.BROTLI_DECODER_PARAM_DISABLE_RING_BUFFER_REALLOCATION`
* `brotli.constants.BROTLI_DECODER_PARAM_LARGE_WINDOW`

## Class: Options
<!-- YAML
added: v0.11.1
changes:
  - version: v9.4.0
    pr-url: https://github.com/nodejs/node/pull/16042
    description: The `dictionary` option can be an ArrayBuffer.
  - version: v8.0.0
    pr-url: https://github.com/nodejs/node/pull/12001
    description: The `dictionary` option can be an Uint8Array now.
  - version: v5.11.0
    pr-url: https://github.com/nodejs/node/pull/6069
    description: The `finishFlush` option is supported now.
-->

<!--type=misc-->

Each class takes an `options` object. All options are optional.

Note that some options are only relevant when compressing, and are
ignored by the decompression classes.

* `flush` {integer}
**Default:** `brotli.constants.BROTLI_OPERATION_FLUSH`
* `finishFlush` {integer}
**Default:** `brotli.constants.BROTLI_OPERATION_FINISH`
* `chunkSize` {integer}
**Default:** `16 * 1024`
* `mode` {integer} (compression only)
**Default:** `brotli.constants.BROTLI_DEFAULT_MODE`
* `quality` {integer} (compression only)
**Default:** `brotli.constants.BROTLI_DEFAULT_QUALITY`
* `lgwin` {integer} (compression only)
**Default:** `brotli.constants.BROTLI_DEFAULT_WINDOW`
* `lgblock` {integer} (compression only)
**Default:** `0`
* `disableLiteralContextModeling` {boolean} (compression only)
**Default:** `false`
* `sizeHint` {integer} (compression only)
**Default:** `0`
* `npostfix` {integer} (compression only)
**Default:** `0`
* `ndirect` {integer} (compression only)
**Default:** `0`
* `disableRingBufferReallocation` {boolean} (decompression only)
**Default:** `false`
* `largeWindow` {boolean}
**Default:** `false`
* `info` {boolean} (If `true`, returns an object with `buffer` and `engine`)

See [`brotli/encode.h`][] and [`brotli/decode.h`][] for more information on
these.

## Class: brotli.Compress
<!-- YAML
added: v0.5.8
-->

Compress a stream.

### new brotli.Compress(options)

Creates and returns a new [Compress][] object with the given [`options`][].

### Class Property: brotli.Compress.codes

Error codes for compression operations.

## Class: brotli.Decompress
<!-- YAML
added: v0.5.8
-->

Decompress a stream.

### new brotli.Decompress(options)

Creates and returns a new [Decompress][] object with the given [`options`][].

### Class Property: brotli.Decompress.codes

Error codes for decompression operations.

## Class: brotli.Brotli
<!-- YAML
added: v0.5.8
-->

Not exported by the `brotli` module. It is documented here because it is the
base class of the compressor/decompressor classes.

### brotli.bytesWritten
<!-- YAML
added: v10.0.0
-->

* {number}

The `brotli.bytesWritten` property specifies the number of bytes written to
the engine, before the bytes are processed (compressed or decompressed,
as appropriate for the derived class).

### brotli.close([callback])
<!-- YAML
added: v0.9.4
-->

Close the underlying handle.

### brotli.flush([kind], callback)
<!-- YAML
added: v0.5.8
-->

* `kind` **Default:** `brotli.constants.BROTLI_OPERATION_FLUSH`

Flush pending data. Don't call this frivolously, premature flushes negatively
impact the effectiveness of the compression algorithm.

Calling this only flushes data from the internal `brotli` state, and does not
perform flushing of any kind on the streams level. Rather, it behaves like a
normal call to `.write()`, i.e. it will be queued up behind other pending
writes and will only produce output when data is being read from the stream.

### brotli.reset()
<!-- YAML
added: v0.7.0
-->

Reset the compressor/decompressor to factory defaults. Only applicable to
the inflate and deflate algorithms.

## brotli.constants
<!-- YAML
added: v7.0.0
-->

Provides an object enumerating Brotli-related constants.

## brotli.createCompress([options])
<!-- YAML
added: v0.5.8
-->

Creates and returns a new [Compress][] object with the given [`options`][].

## brotli.createDecompress([options])
<!-- YAML
added: v0.5.8
-->

Creates and returns a new [Decompress][] object with the given [`options`][].

## Convenience Methods

<!--type=misc-->

All of these take a [`Buffer`][], [`TypedArray`][], [`DataView`][],
[`ArrayBuffer`][] or string as the first argument, an optional second argument
to supply options to the `brotli` classes and will call the supplied callback
with `callback(error, result)`.

Every method has a `*Sync` counterpart, which accept the same arguments, but
without a callback.

### brotli.compress(buffer[, options][, callback])
<!-- YAML
added: v0.6.0
changes:
  - version: v9.4.0
    pr-url: https://github.com/nodejs/node/pull/16042
    description: The `buffer` parameter can be an ArrayBuffer.
  - version: v8.0.0
    pr-url: https://github.com/nodejs/node/pull/12223
    description: The `buffer` parameter can be any TypedArray or DataView now.
  - version: v8.0.0
    pr-url: https://github.com/nodejs/node/pull/12001
    description: The `buffer` parameter can be an Uint8Array now.
-->

If callback is omitted a Promise will be returned.

### brotli.compressSync(buffer[, options])
<!-- YAML
added: v0.11.12
changes:
  - version: v9.4.0
    pr-url: https://github.com/nodejs/node/pull/16042
    description: The `buffer` parameter can be an ArrayBuffer.
  - version: v8.0.0
    pr-url: https://github.com/nodejs/node/pull/12223
    description: The `buffer` parameter can be any TypedArray or DataView now.
  - version: v8.0.0
    pr-url: https://github.com/nodejs/node/pull/12001
    description: The `buffer` parameter can be an Uint8Array now.
-->

- `buffer` {Buffer|TypedArray|DataView|ArrayBuffer|string}

Compress a chunk of data with [Compress][].

### brotli.decompress(buffer[, options][, callback])
<!-- YAML
added: v0.6.0
changes:
  - version: v8.0.0
    pr-url: https://github.com/nodejs/node/pull/12223
    description: The `buffer` parameter can be any TypedArray or DataView now.
  - version: v8.0.0
    pr-url: https://github.com/nodejs/node/pull/12001
    description: The `buffer` parameter can be an Uint8Array now.
-->

If callback is omitted a Promise will be returned.

### brotli.decompressSync(buffer[, options])
<!-- YAML
added: v0.11.12
changes:
  - version: v9.4.0
    pr-url: https://github.com/nodejs/node/pull/16042
    description: The `buffer` parameter can be an ArrayBuffer.
  - version: v8.0.0
    pr-url: https://github.com/nodejs/node/pull/12223
    description: The `buffer` parameter can be any TypedArray or DataView now.
  - version: v8.0.0
    pr-url: https://github.com/nodejs/node/pull/12001
    description: The `buffer` parameter can be an Uint8Array now.
-->

- `buffer` {Buffer|TypedArray|DataView|ArrayBuffer|string}

Decompress a chunk of data with [Decompress][].

[`.flush()`]: #brotli_brotli_flush_kind_callback
[`Accept-Encoding`]: https://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.3
[`ArrayBuffer`]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer
[`brotli/encode.h`]: https://github.com/google/brotli/blob/v1.0.4/c/include/brotli/encode.h
[`brotli/decode.h`]: https://github.com/google/brotli/blob/v1.0.4/c/include/brotli/decode.h
[`Buffer`]: buffer.html#buffer_class_buffer
[Decompress]: #brotli_class_brotli_decompress
[Compress]: #brotli_class_brotli_compress
[`Content-Encoding`]: https://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.11
[`DataView`]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView
[`TypedArray`]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray
[`options`]: #brotli_class_options
[Memory Usage Tuning]: #brotli_memory_usage_tuning
[`UV_THREADPOOL_SIZE`]: cli.html#cli_uv_threadpool_size_size
