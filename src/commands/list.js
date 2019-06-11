const {Command, flags} = require('@oclif/command')
const result = require('dotenv').config({ path: __dirname + '/../../.env' })
if (result.error) {
  throw result.error
}
const chalk = require('chalk')
const {cli} = require('cli-ux')
const ora = require('ora')
const fetch = require('node-fetch')
const bluebird = require('bluebird')
const redis = require('redis')
bluebird.promisifyAll(redis.RedisClient.prototype)

const server_url = process.env.ENV == 'PROD' ? process.env.PROD_SERVER_URL : process.env.LOCAL_SERVER_URL
const redis_url = process.env.ENV == 'PROD' ? process.env.PROD_REDIS_URL : process.env.LOCAL_REDIS_URL

class List extends Command {
  async run() {
    const spinner = ora({
      spinner: 'dots2',
      color: 'blue'
    })
    spinner.start()
    const client = redis.createClient(redis_url)
    const res = await fetch(server_url + '/job', {method: 'POST',
                                                  body: JSON.stringify({type: 'list', args: {}}),
                                                  headers: {'Content-Type': 'application/json'}})
    const job = await res.json()
    const id = job.id
    while(true){
      const res = await fetch(server_url + `/job/${id}`)
      const job = await res.json()
      if(job.state == 'completed' || job.state == 'failed'){
        job.state == 'completed' ? spinner.stop() : spinner.fail()
        const obj = await client.hgetallAsync('bull:work:' + id)
        const ret_val = JSON.parse(obj.returnvalue)
        if(ret_val.code == 0){
          ret_val.tasks.forEach(e => {
            let dueString = ''
            if(e.daysbetween == 0)
              dueString = chalk.green('due today')
            else if(e.daysbetween > 0 && e.daysbetween < 100)
              dueString = chalk.whiteBright(`due in ${e.daysbetween <= 5 ? chalk.magentaBright(e.daysbetween) : e.daysbetween} ${e.daysbetween == 1 ? 'day' : 'days'}`)
            else if(e.daysbetween < 0)
              dueString = chalk.red('overdue')
            if(dueString != '')
              dueString += ' ' + chalk.gray(e.dayofweek) + ' ' + chalk.gray((new Date(e.due_time).getMonth()+1) + '.' + new Date(e.due_time).getDate() + '.' + new Date(e.due_time).getFullYear())
            this.log(chalk.gray(e.id) + ' ' + chalk.blueBright(e.name) + ' ' + (e.description ? chalk.redBright(e.description) + ' ' : '') + dueString)
          })
        }else
          this.log(chalk.blue(ret_val.code + ' => ') + chalk.red(ret_val.reason))
        client.quit()
        break
      }
      // else if(job.state != 'active')
      //   this.log(job.id + ' -> ' + job.progress + ' -> ' + job.state)
      await cli.wait(500)
    }
  }
}

List.aliases = ['l']

List.description = 'list all open tasks'
  
List.examples = [
  `$ survail list`
  ]

module.exports = List