'use strict'
const promiseToCallback = require('promise-to-callback')
const scaffold = require('eth-json-rpc-middleware/scaffold')
const waitForBlock = require('eth-json-rpc-middleware/waitForBlock')
const cidFromHash = require('ipld-eth-star/util/cidFromHash')
const sha3 = require('ethereumjs-util').sha3
const rlp = require('rlp')

module.exports = createIpfsMiddleware

function createIpfsMiddleware ({ ipfs, blockTracker }) {
  return waitForBlock({ blockTracker })(scaffold({

    eth_getBalance: (req, res, next, end) => {
      const [address, blockRef] = req.params
      // only handle latest
      if (blockRef !== 'latest') return next()
      // construct ethPath
      const ethPath = `state/${address}/balance`
      performIpfsLookup(ethPath, (err, result) => {
        if (err) return end(err)
        const resultHex = '0x' + result.value.toString('hex')
        res.result = resultHex
        end()
      })
    },

    eth_getTransactionCount: (req, res, next, end) => {
      const [address, blockRef] = req.params
      // only handle latest
      if (blockRef !== 'latest') return next()
      // construct ethPath
      const ethPath = `state/${address}/nonce`
      performIpfsLookup(ethPath, (err, result) => {
        if (err) return end(err)
        const resultHex = '0x' + result.value.toString('hex')
        res.result = resultHex
        end()
      })
    },

    eth_getCode: (req, res, next, end) => {
      const [address, blockRef] = req.params
      // only handle latest
      if (blockRef !== 'latest') return next()
      // construct ethPath
      const ethPath = `state/${address}/code`
      performIpfsLookup(ethPath, (err, result) => {
        if (err) return end(err)
        const resultHex = '0x' + result.value.toString('hex')
        res.result = resultHex
        end()
      })
    },

    eth_getStorageAt: (req, res, next, end) => {
      const [address, key, blockRef] = req.params
      // only handle latest
      if (blockRef !== 'latest') return next()
      // construct ethPath
      const ethPath = `state/${address}/storage/${key}`
      console.log('storage:', ethPath)
      performIpfsLookup(ethPath, (err, result) => {
        if (err) return end(err)
        const decoded = rlp.decode(result.value)
        const resultHex = '0x' + decoded.toString('hex')
        res.result = resultHex
        end()
      })
    }

  }))

  function performIpfsLookup (ethPath, cb) {
    const currentBlock = blockTracker.getCurrentBlock()
    const blockHashBuf = Buffer.from(currentBlock.hash.slice(2), 'hex')
    const cid = cidFromHash('eth-block', blockHashBuf)
    const dagPath = transformEthPath(ethPath)
    promiseToCallback(ipfs.dag.get(cid, dagPath))(cb)
  }
}

function transformEthPath (ethPath, blockHashBuf) {
  const ethPathParts = ethPath.split('/')
  // build ipfs dag query string
  let dagPathParts = []
  let remainingParts = ethPathParts.slice()
  // search for hex key in remainingParts
  dagPathParts = remainingParts.map((part) => {
    // remove header
    if (part === 'eth') return ''
    // abort if not hex
    if (part.slice(0, 2) !== '0x') return part
    // hash
    const keyBuf = Buffer.from(part.slice(2), 'hex')
    const hashString = sha3(keyBuf).toString('hex')
    // chunked into half-bytes
    const chunked = hashString.split('').join('/')
    return chunked
  })
  // finalize
  const dagPath = dagPathParts.filter(Boolean).join('/')
  return dagPath
}
