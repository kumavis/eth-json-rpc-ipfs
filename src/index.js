const scaffold = require('eth-json-rpc-middleware/scaffold')
const waitForBlock = require('eth-json-rpc-middleware/waitForBlock')
const cidFromHash = require('ipld-eth-star/util/cidFromHash')
const sha3 = require('ethereumjs-util').sha3

module.exports = createIpfsMiddleware

function createIpfsMiddleware ({ ipfs, blockTracker }) {
  return waitForBlock({ blockTracker })(scaffold({

    'eth_getBalance': (req, res, next, end) => {
      const [address, blockRef] = req.params
      // only handle latest
      if (blockRef !== 'latest') return next()
      // construct ethPath
      const ethPath = `${address}/balance`
      performIpfsLookup(ethPath, res, end)
    },

    'eth_getTransactionCount': (req, res, next, end) => {
      const [address, blockRef] = req.params
      // only handle latest
      if (blockRef !== 'latest') return next()
      // construct ethPath
      const ethPath = `${address}/nonce`
      performIpfsLookup(ethPath, res, end)
    },

    'eth_getCode': (req, res, next, end) => {
      const [address, blockRef] = req.params
      // only handle latest
      if (blockRef !== 'latest') return next()
      // construct ethPath
      const ethPath = `${address}/code`
      performIpfsLookup(ethPath, res, end)
    },

    'eth_getStorageAt': (req, res, next, end) => {
      const [address, key, blockRef] = req.params
      // only handle latest
      if (blockRef !== 'latest') return next()
      // construct ethPath
      const ethPath = `${address}/storage/${key}`
      performIpfsLookup(ethPath, res, end)
    }

  }))

  function performIpfsLookup (ethPath, res, end) {
    const currentBlock = blockTracker.getCurrentBlock()
    const blockHashBuf = Buffer.from(currentBlock.hash.slice(2), 'hex')
    const cid = cidFromHash('eth-block', blockHashBuf)
    const dagPath = transformEthPath(ethPath)
    // console.log('dagPath:', dagPath)
    ipfs.dag.get(cid, dagPath).then((result) => {
      const resultHex = '0x' + result.value.toString('hex')
      // console.log('query result:', resultHex)
      res.result = resultHex
      end()
    }).catch((err) => {
      console.error(err)
      end(err)
    })
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
