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

class Hub extends Command {
  async run() {
    const spinner = ora({
      spinner: 'dots2',
      color: 'blue'
    })
    spinner.start()
    const client = redis.createClient(redis_url)
    const res = await fetch(server_url + '/job', {method: 'POST',
                                                  body: JSON.stringify({type: 'hub', args: {}}),
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
          const N = ret_val.tasksDueToday.length + ret_val.tasksDueTomorrow.length
          this.log(`Today is ${new Date().getMonth()+1}.${new Date().getDate()}.${new Date().getFullYear()} and you have ${N == 0 ? 'nothing due soon.' : N + ' task(s) due soon.'}`)
          if(N > 0)
            this.log(`You have ${ret_val.tasksDueToday.length} tasks due today and ${ret_val.tasksDueTomorrow.length} due tomorrow.`)
          if(ret_val.tasksDueToday.length > 0){
            this.log('Tasks due today:')
            ret_val.tasksDueToday.forEach(e => {
              this.log(chalk.gray(e.id) + ' ' + chalk.blueBright(e.name) + ' ' + (e.description !== null ? chalk.redBright(e.description) : ''))
            })
          }
          if(ret_val.tasksDueTomorrow.length > 0){
            this.log('Tasks due tomorrow:')
            ret_val.tasksDueTomorrow.forEach(e => {
              this.log(chalk.gray(e.id) + ' ' + chalk.blueBright(e.name) + ' ' + (e.description !== null ? chalk.redBright(e.description) : ''))
            })
          }
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

Hub.aliases = ['h']

Hub.description = 'see the hub'

Hub.examples = [
  `$ survail hub`
]

module.exports = Hub