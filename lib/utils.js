const AWS = require('aws-sdk')

/**
 * Validate configuration properties
 * 
 * @param {Object} config The config object to be validated 
 * @param {Array} ignore Array with keys to ignore on validation
 */
function validateConfig(config, ignore) {
  if (!ignore) {
    ignore = []
  }
  Object.keys(config).forEach(key => {
    if (!config[key] && !(ignore.indexOf(key) > -1)) {
      throw new Error('The `' + key + '` property must be set on configure function')
    }
  })
}

/**
 * Validate email object required values
 * 
 * @param {Object} email
 * @return {Object} return email validated object
 */
function sanitizeEmailData(email) {
  const parsedValues = {}
  
  if (!email) {
    throw new Error('The `email` object property is required')
  }

  // validate required fields
  if (!email.to && !email.cc && !email.bcc) {
    throw new Error('Email destination is required. Please, send at least one of these properties: `to`, `cc` or `bcc`')
  }

  if (!email.from) {
    throw new Error('Email source is required. Send a `from` value')
  }

  if (!email.subject) {
    throw new Error('Email `subject` is required')
  }

  if (!email.body) {
    throw new Error('Email `body` is required')
  }

  
  // validate fields types
  if (email.template && !isObject(email.body)) {
    throw new TypeError('Expected email param `body` to be a Object on html email')
  }

  if (!email.template && !isString(email.body)) {
    throw new TypeError('Expected email param `body` to be a string on text email')
  }

  const strings = ['from', 'subject', 'template']
  strings.forEach(v => {
    if (email[v] && !isString(email[v])) {
      throw new TypeError('Expected email param `' + v + '` to be a string')
    }
  })

  const arrayStrings = ['to', 'cc', 'bcc', 'replyTo']
  arrayStrings.forEach(v => {
    if (email[v] && isString(email[v])) {
      parsedValues[v] = [email[v]]
    } else if (email[v] && !isArrayOfStrings(email[v])) {
      throw new TypeError('Expected email param `' + v + '` to be a string or an array of strings')
    }
  })

  return { ...email, ...parsedValues }
}

function isObject(value) {
  return typeof value === 'object'
}

function isString(value) {
  return typeof value === 'string'
}

function isArrayOfStrings(value) {
  if (Array.isArray(value)) { 
    return value.every(v => isString(v))
  }

  return false
}

/**
 * Validate template with the body object
 * 
 * @param {String} bucket The S3 bucket where the template is stored
 * @param {String} template The template name with path
 * @param {Object} params Object to be validate on template
 * @return {Promise} Returns a promise with the built template
 */
async function buildTemplate(bucket, template, params) {
  return await getTemplate(bucket, template)
    .then(template => new Function(template).call(params))
}

/**
 * Retrieves the template from the bucket
 * 
 * @param {String} bucket The S3 bucket where the template is stored
 * @param {String} template The template name with path
 * @return {Promise} Returns a promise with the raw template
 */
function getTemplate(bucket, template) {
  const S3 = new AWS.S3({ apiVersion: '2006-03-01' })
  const templateKey = template + '.js'
  return S3.getObject({ Bucket: bucket, Key: templateKey }).promise()
    .then(data => data.Body.toString('utf-8'))
}

/**
 * Create a cron expression for schedule the notification
 *  
 * @param {Object} schedule
 * @return {Object} Schedule object with the cron expression property
 */
function cronBuilder (schedule, delay) {
  const minute = schedule.minute
  const hour = schedule.hour
  const day = schedule.day
  const month = schedule.month
  const weekDay = schedule.weekDay
  const year = schedule.year
  const workingDays = schedule.workingDays
  const end = schedule.end
  let cron
  
  if (day && (weekDay || workingDays)) { 
    throw new Error('The `day` and `weekDay` properties of the schedule can not be set together')
  }

  if (end) {
    const endDate = new Date(end)
    if (!(endDate instanceof Date && !isNaN(endDate))) {
      throw new TypeError('Schedule `end` date format is invalid. Please, use ISO format (YYYY-MM-DD or YYYY-MM-DD HH:MM)')
    }

    schedule.end = endDate.getTime()
  }

  // Set a default `only once` schedule (with 2 minutes ahead) when no property is given
  if (!minute && !hour && !day && !month && !weekDay && !year) {
    // Get a UTC date with 2 minutes ahead
    const date = new Date(Date.now() + (delay*1000))
    cron = {
      minute: date.getUTCMinutes(),
      hour: date.getUTCHours(),
      dayOfMonth: date.getUTCDate(),
      month: date.getUTCMonth() + 1,
      dayOfWeek: '?',
      year: date.getUTCFullYear()
    }
    schedule.once = true
  } else {
    const dayOfMonth = day || ((weekDay || workingDays) ? '?' : '*')
    cron = {
      minute: minute || '0',
      hour: hour || '11', // Default hour 8am on GMT-3
      dayOfMonth: dayOfMonth,
      month: month || '*',
      dayOfWeek: weekDay || (workingDays ? 'MON-FRI' : (dayOfMonth !== '?' ? '?' : '*')),
      year: year || '*'
    }
  }

  schedule.expression = `cron(${cron.minute} ${cron.hour} ${cron.dayOfMonth} ${cron.month} ${cron.dayOfWeek} ${cron.year})`
  return schedule
}

module.exports = {
  validateConfig,
  sanitizeEmailData,
  buildTemplate,
  cronBuilder
}