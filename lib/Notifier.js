const aws4 = require('aws4')
const axios = require('axios')
const utils = require('./utils')

/**
 * Create a new instance of Notifier
 */
function Notifier() {
  this.delay = 120
  this.config = {
    api: process.env.NOTIFIER_API_URL,
    app: process.env.NOTIFIER_APP_NAME,
    templateBucket: process.env.NOTIFIER_TEMPLATE_BUCKET,
  }

  /**
   * Set notifier configuration properties
   * 
   * @param {Object} config The config object for the notifier
   */
  this.configure = function(config) {
    this.config.api = config.api || this.config.api
    this.config.app = config.app || this.config.app
    this.config.templateBucket = config.templateBucket || this.config.templateBucket
    this.delay = !config.delay ? this.delay : config.delay > 120 ? config.delay : 120
  }

  // Method for create a new notification
  this.create = function(data) {
    data.operation = 'CREATE'
    return this._putNotification(data)
  }

  // Method for update an existing notification
  this.update = function(data) {
    data.operation = 'UPDATE'
    return this._putNotification(data)
  }

  // Method for remove an existing notification
  this.remove = function(data) {
    utils.validateConfig(this.config, ['templateBucket', 'app'])
    let newData = {}
    if (typeof data === 'string') {
      newData.id = data
    } else {
      newData = data
    }
    newData.operation = 'REMOVE'
    return this._removeNotification(newData)
  }

  // Pre-send function for create and update methods
  this._putNotification = async function(data) {
    utils.validateConfig(this.config)

    const _validatedEmail = { email: utils.sanitizeEmailData(data.email) }
    const validatedData = Object.assign({}, data, _validatedEmail)

    if (validatedData.operation === 'UPDATE' && !validatedData.id) {
      throw new Error('Update method parameters must have an id')
    }
    
    // Try to build the template to prevent error throw when email is sent
    if (validatedData.email.template) {
      await utils.buildTemplate(this.config.templateBucket, validatedData.email.template, validatedData.email.body)
    }

    // Inject `app` and `templateBucket` on data object 
    validatedData.app = this.config.app
    validatedData.templateBucket = this.config.templateBucket

    // Set notification schedule expression
    if (!validatedData.schedule) {
      validatedData.schedule = {}
    }
    validatedData.schedule = utils.cronBuilder(validatedData.schedule, this.delay)
    
    return this._send(validatedData, this.config)
  }

  // Pre send function for remove method
  this._removeNotification = function(data) {
    if(data.operation === 'REMOVE' && !data.id) {
      throw new Error('Remove method parameters must have an id.')
    }

    return this._send(data, this.config)
  }

  // Send notification data to serverless with AWS credentials signed headers
  this._send = function(data, config) {
    const stringData = JSON.stringify(data)
    
    // Reject `data` object bigger than 256kb
    if (stringData.length > 256000) {
     throw new Error(`The size of your data object is more than 256kb (is ${stringData.length / 1000}kb), unfortunately we can not create notifications of this size`)
    }

    // Set AWS `options` and `credentials` that will be used for sign header
    const _urlWithoutProtocol = config.api.split('//').pop()
    const hostname = _urlWithoutProtocol.split('/')[0]
    const path = '/' + _urlWithoutProtocol.split('/').slice(1).join('/')

    const opts = {
      hostname: hostname,
      service: 'execute-api',
      region: process.env.AWS_REGION,
      method: 'POST',
      path: path,
      body: stringData
    }

    const credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }

    // Sign header with AWS auth
    aws4.sign(opts,  credentials)
    
    return axios.post(config.api, stringData, opts)
      .then(res => res.data)
  }
}

// export a new instance of Notifier
module.exports = new Notifier()