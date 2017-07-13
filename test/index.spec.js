const chai = require('chai')
chai.use(require('dirty-chai'))
const expect = chai.expect
const JsonRpcEngine = require('json-rpc-engine')
const asMiddleware = require('json-rpc-engine/src/asMiddleware')
const RpcBlockTracker = require('eth-block-tracker')
const EthQuery = require('eth-query')
const TestBlockMiddleware = require('eth-block-tracker/test/util/testBlockMiddleware')
const createIpfsMiddleware = require('../src/index')
const scaffold = require('eth-json-rpc-middleware/scaffold')

// const middleware = createIpfsMiddleware({ blockTracker })



// it('contructor - no opts', (t) => {
//   // t.plan(1)
//
//   t.throws(() => {
//     createIpfsMiddleware()
//   }, Error, 'Constructor without options fails')
//   t.end()
// })
//
// it('contructor - empty opts', (t) => {
//   // t.plan(1)
//
//   t.throws(() => {
//     createIpfsMiddleware({})
//   }, Error, 'Constructor without empty options')
//   t.end()
// })

it('provider - balance query', (done) => {
  // t.plan(3)

  const { engine, dataEngine, testBlockSource, blockTracker } = createTestSetup()

  // unblock from waiting for block
  testBlockSource.nextBlock()
  blockTracker.start()

  // fire request for `test_method`
  engine.handle({ id: 1, method: 'eth_getBalance', params: ['0x52bc44d5378309ee2abf1539bf71de1b7d7be3b5', 'latest'] }, (err, res) => {
    expect(err).not.to.exist('No error in response')
    expect(res).to.exist('Has response')
    expect(res.result).to.eql('0x1234', 'Response result is correct.')
    blockTracker.stop()
    done()
  })

})

// util

function createTestSetup() {
  // raw data source
  const { engine: dataEngine, testBlockSource } = createEngineForTestData()
  const dataProvider = providerFromEngine(dataEngine)
  // create block tracker
  const blockTracker = new RpcBlockTracker({ provider: dataProvider })
  // create dummy ipfs
  const ipfs = {
    dag: {
      get: (cid, path) => new Promise((resolve, reject) => {
        const pathParts = path.split('/')
        if (pathParts.includes('storage')) {
          return resolve({ value: Buffer.from('deadbeef', 'hex'), remainderPath: '' })
        }
        const lastPathPart = pathParts.slice(-1)[0]
        switch (lastPathPart) {
          case 'balance':
            return resolve({ value: Buffer.from('1234', 'hex'), remainderPath: '' })
          case 'nonce':
            return resolve({ value: Buffer.from('02', 'hex'), remainderPath: '' })
          case 'code':
            return resolve({ value: Buffer.from('101010', 'hex'), remainderPath: '' })
          default:
            return reject()
        }
      })
    }
  }
  // create higher level
  const engine = new JsonRpcEngine()
  const provider = providerFromEngine(engine)
  // add block ref middleware
  engine.push(createIpfsMiddleware({ blockTracker, ipfs }))
  // add data source
  engine.push(asMiddleware(dataEngine))
  const query = new EthQuery(provider)
  return { engine, provider, dataEngine, dataProvider, query, blockTracker, testBlockSource }
}

function createEngineForTestData() {
  const engine = new JsonRpcEngine()
  const testBlockSource = new TestBlockMiddleware()
  engine.push(testBlockSource.createMiddleware())
  return { engine, testBlockSource }
}

function providerFromEngine(engine) {
  const provider = { sendAsync: engine.handle.bind(engine) }
  return provider
}