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

class Delete extends Command {
  async run() {
    const {flags} = this.parse(Delete)
    const spinner = ora({
      spinner: 'dots2',
      color: 'blue'
    })
    spinner.start()
    const client = redis.createClient(redis_url)
    const res = await fetch(server_url + '/job', {method: 'POST',
                                                  body: JSON.stringify({type: 'delete', args:{ids: flags.id}}),
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
          if(ret_val.result.rowCount == 0)
            this.log(`There are ${chalk.red('no')} records with these ids.`)
          else
            this.log(chalk.blue(ret_val.result.rowCount) + ' task(s) deleted ' + chalk.green('successfully.'))
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

Delete.aliases = ['d']

Delete.description = 'delete a task'

Delete.examples = [
  `$ survail delete -id 3 4 2`
]

Delete.flags = {
  id: flags.string({
    char: 'i',
    required: true,
    multiple: true
  })
}

module.exports = Delete