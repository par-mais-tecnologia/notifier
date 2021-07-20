# notifier

A node.js library to create and schedule notifications using AWS services.

## Flow

![Notifier Flow](https://s3-sa-east-1.amazonaws.com/static.parmais.com.br/images/notifier-flow.jpeg)

- **Notifier:** validate and format all data, generate schedule expression and send to API Gateway.
- **API Gateway:** validate authorization and send call Lambda01 function.
- **Lambda01**: create, update and remove scheduled rules on CloudWatchEvents.
- **CloudWatchEvent**: call Lambda02 function in the scheduled period.
- **Lambda02**: read templates on S3, build templates and send to SES.
- **S3**: stores the templates.
- **SES**: send email.

## Install

Using npm:

`$ npm install @parmais/notifier`

## How to use

### Configure

```js
const notifier = require('@parmais/notifier');

notifier.configure({
  api: <API_URL>,
  app: <APP_NAME>,
  templateBucket: <BUCKET_NAME>,
  delay: 120
});
```

You can also set environment variables for these settings:

```
NOTIFIER_API_URL=<API_URL>
NOTIFIER_APP_NAME=<APP_NAME>
NOTIFIER_TEMPLATE_BUCKET=<BUCKET_NAME>
```

> **NOTE**: The default and minimum value for delay setting is 120 (seconds). The delay is used when no schedule is given, then the notification will be scheduled 120 seconds ahead.

#### Authorization

For the Notifier works properly, you must have the AWS credentials set using the following environment variables:

```
AWS_ACCESS_KEY_ID=<YOUR_AWS_KEY>
AWS_SECRET_ACCESS_KEY=<YOUR_AWS_SECRET>
AWS_REGION=<API_AWS_REGION>
```

### Create

Creating a simple `TEXT` email:

```js
notifier.create({
    email: {
      from: 'Your Name <your-name@domain.com>',
      to: 'john@domain.com',
      subject: 'Hello John',
      body: 'Hi, this is a test',
    }
  })
  .then(res => console.log(res)) // returns an object with the notification id
  .catch(err => console.log(err));
```

Creating a `HTML` email:

```js
notifier.create({
    email: {
      from: 'Your Name <your-name@domain.com>',
      to: 'john@domain.com',
      subject: 'Hello John',
      body: { name: 'John' },
      template: 'HelloTemplate'
    }
  });
```

Creating a `SMS`:

```js
notifier.create({
    sms: {
      to: '+5548998754321',
      message: 'Hello user, this is a sms message'
    }
  });
```

### Update

Just send the notification id you want to update:

```js
notifier.update({
    id: 'my-notification-id-123',
    email: {
      from: 'Your Name <your-name@domain.com>',
      to: 'john@domain.com',
      subject: 'Hello John',
      body: 'Hi, this is a test',
    }
  });
```

> **NOTE:** You need to send all the data again on update!

### Remove

Just send the notification id you want to remove:

```js
notifier.remove({ id: 'my-notification-id-123' });

OR

notifier.remove('my-notification-id-123');
```

### Email fields

The available fields, types and defaults:

| Field       | Type                     | Required |
|-------------|--------------------------|----------|
| from        | String                   | *        |
| to          | String or Array\<String> |          |
| cc          | String or Array\<String> |          |
| bcc         | String or Array\<String> |          |
| replyTo     | String or Array\<String> |          |
| subject     | String                   | *        |
| body        | String or Object         | *        |
| template    | String                   |          |

> **NOTE:** At least one of these fields are required: to, cc or bcc
> **NOTE 2:** If the template field is given, the body type must be an Object


### SMS fields

The available fields, types and defaults:

| Field       | Type                     | Required |
|-------------|--------------------------|----------|
| to          | String                   |          |
| phone       | String                   |          |
| message     | String                   | *        |

> **NOTE:** At least one of these fields are required: to or phone
> **NOTE 2:** The phone number must be in international format (E.164)

## Schedule

If you do not set any schedules, the notification will be sent as soon as possible. (respecting the configured delay)

But if you want, you can schedule your notification sending a `schedule` property:

```js
notifier.create({
    email: {
      from: 'Your Name <your-name@domain.com>',
      to: 'john@domain.com',
      subject: 'Hello John',
      body: 'Hi, this is a test',
    },
    schedule {
      day: '16',
      hour: '22', // will send every 16th at 10:00 PM GMT
    }
  })
```

A few more examples:

```js
// 6:00 PM Monday through Friday (only working days)
{
  hour: '18',
  weekDay: '2-6' // OR 'MON-FRI'
  // OR workingDays: true
}

// Every 10 minutes on Monday AND Thursday
{ 
  hour: '*',
  min: '0/10',
  weekDay: 'MON,THU'
}

// 9:00 AM on the first Monday of each month
{ 
  hour: '9',
  weekDay: '2#1'
}

// December 25th at 12:00 AM, just once
{
  hour: '0',
  day: '25',
  month: 'DEC',
  once: true
}
```

The available fields, values and wildcards:

| Name         | Field   | Values                         | Wildcards     | Default |
|--------------|---------|--------------------------------|---------------|---------|
| Minutes      | min     | 0-59                           | , - * /       | 0       |
| Hours        | hour    | 0-23                           | , - * /       | 11      |
| Day-of-month | day     | 1-31                           | , - * ? / L W | *       |
| Month        | month   | 1-12 or JAN-DEC                | , - * /       | *       |
| Day-of-week  | weekDay | 1-7 or SUN-SAT                 | , - * ? / L # | ?       |
| Year         | year    | 1970-2199                      | , - * /       | *       |
| End date     | end     | YYYY-MM-DD or YYYY-MM-DD HH:MM |               |         |
| Once         | once    | true or false                  |               | false   |

> **NOTE:** The notification will send only once if the `once` field is true
> **NOTE 2:** The notification will  no longer be sent after the end date

#### Wildcards

  - The **,** (comma) wildcard includes additional values. In the Month field, JAN,FEB,MAR would include January, February, and March.

  - The **-** (dash) wildcard specifies ranges. In the Day field, 1-15 would include days 1 through 15 of the specified month.

  - The **\*** (asterisk) wildcard includes all values in the field. In the Hours field, **\*** would include every hour. You cannot use **\*** in both the Day-of-month and Day-of-week fields. If you use it in one, you must use **?** in the other.

  - The **/** (forward slash) wildcard specifies increments. In the Minutes field, you could enter 1/10 to specify every tenth minute, starting from the first minute of the hour (for example, the 11th, 21st, and 31st minute, and so on).

  - The **?** (question mark) wildcard specifies one or another. In the Day-of-month field you could enter **7** and if you didn't care what day of the week the 7th was, you could enter **?** in the Day-of-week field.

  - The **L** wildcard in the Day-of-month or Day-of-week fields specifies the last day of the month or week.

  - The **W** wildcard in the Day-of-month field specifies a weekday. In the Day-of-month field, 3W specifies the day closest to the third weekday of the month.

  - The **#** wildcard in the Day-of-week field specifies a certain instance of the specified day of the week within a month. For example, 3#2 would be the second Tuesday of the month: the 3 refers to Tuesday because it is the third day of each week, and the 2 refers to the second day of that type within the month.

#### Limits

  - You can't specify the Day-of-month and Day-of-week fields in the same schedule. If you specify a value (or a *) in one of the fields, a **?** (question mark) will be automatically set in the other.

  - Schedule that lead to rates faster than 1 minute are not supported.


## TODO

  - Create tests

## License

Copyright (c) 2019 Par 6 Tecnologia LTDA;
Licensed under __[Apache 2.0][Lic]__.

[Lic]: ./LICENSE