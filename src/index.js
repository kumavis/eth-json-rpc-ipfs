'use strict'
const promiseToCallback = require('promise-to-callback')
const scaffold = require('eth-json-rpc-middleware/scaffold')
const cidFromHash = require('ipld-eth-star/util/cidFromHash')
const sha3 = require('ethereumjs-util').sha3
const rlp = require('rlp')

module.exports = createIpfsMiddleware

function createIpfsMiddleware ({ ipfs, cht }) {
  return scaffold({

    eth_getBalance: async (req, res, next, end) => {
      const [address, blockRef] = req.params
      // only handle latest
      const blockHash = await cht.blockRefToHash(blockRef)
      // construct ethPath
      const ethPath = `state/${address}/balance`
      const result = await performIpfsLookup(blockHash, ethPath)
      const resultHex = '0x' + result.value.toString('hex')
      res.result = resultHex
      end()
    },

    eth_getTransactionCount: async (req, res, next, end) => {
      const [address, blockRef] = req.params
      // only handle latest
      const blockHash = await cht.blockRefToHash(blockRef)
      // construct ethPath
      const ethPath = `state/${address}/nonce`
      const result = await performIpfsLookup(blockHash, ethPath)
      const resultHex = '0x' + result.value.toString('hex')
      res.result = resultHex
      end()
    },

    eth_getCode: async (req, res, next, end) => {
      const [address, blockRef] = req.params
      // only handle latest
      const blockHash = await cht.blockRefToHash(blockRef)
      // construct ethPath
      const ethPath = `state/${address}/code`
      const result = await performIpfsLookup(blockHash, ethPath)
      const resultHex = '0x' + result.value.toString('hex')
      res.result = resultHex
      end()
    },

    eth_getStorageAt: async (req, res, next, end) => {
      const [address, key, blockRef] = req.params
      // only handle latest
      const blockHash = await cht.blockRefToHash(blockRef)
      // construct ethPath
      const ethPath = `state/${address}/storage/${key}`
      const result = await performIpfsLookup(blockHash, ethPath)
      const decoded = rlp.decode(result.value)
      const resultHex = '0x' + decoded.toString('hex')
      res.result = resultHex
      end()
    }

  })

  async function performIpfsLookup (blockHash, ethPath) {
    const cid = cidFromHash('eth-block', blockHash)
    const dagPath = transformEthPath(ethPath)
    return await ipfs.dag.get(cid, dagPath)
  }
}

function transformEthPath (ethPath, blockHashBuf) {
  const ethPathParts = ethPath.split('/')
  // build ipfs dag query string
  let dagPathParts = []
  let remainingParts = ethPathParts.slice()
  // search for hex key in remainingParts
  dagPathParts = remainingParts.map((part) => {
    // remove "eth" top level namespace
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
