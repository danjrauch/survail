#!/usr/bin/env node

const result = require('dotenv').config({ path: '/Users/drauch/Projects/survail-cli/.env' })
if (result.error) {
  throw result.error
}
const chalk = require('chalk')
const fs = require('fs')
const fetch = require('node-fetch')
const bluebird = require('bluebird')
const redis = require('redis')
bluebird.promisifyAll(redis.RedisClient.prototype)

const server_url = process.env.ENV == 'PROD' ? process.env.PROD_SERVER_URL : process.env.LOCAL_SERVER_URL
const redis_url = process.env.ENV == 'PROD' ? process.env.PROD_REDIS_URL : process.env.LOCAL_REDIS_URL

const [,, ...args] = process.argv

function msleep(n) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, n)
}

function sleep(n) {
  msleep(n*1000)
}

function list(ret_val){
  ret_val.tasks.forEach(e => console.log(chalk.blue(e.name) + ' ' + chalk.magenta(e.id)))
}

async function execute(type, ...arg) {
  const client = redis.createClient(redis_url)
  const res = await fetch(server_url + '/job', {method: 'POST',
                                                body: JSON.stringify({type:type}),
                                                headers: {'Content-Type': 'application/json'}})
  const job = await res.json()
  const id = job.id
  while(true){
    const res = await fetch(server_url + `/job/${id}`)
    const job = await res.json()
    if(job.state == 'completed' || job.state == 'failed'){
      const obj = await client.hgetallAsync('bull:work:' + id)
      const ret_val = JSON.parse(obj.returnvalue)
      if(ret_val.code == 0){
        if(type == 'list') list(ret_val)
      }else
        console.log(chalk.blue(ret_val.code + ' => ') + chalk.red(ret_val.reason))
      client.quit()
      break
    }else if(job.state != 'active')
      console.log(job.id + ' -> ' + job.progress + ' -> ' + job.state)
    sleep(2)
  }
}

switch(args[0]){
  case 'a':
    // execute('auth')
    let rawdata = fs.readFileSync(process.env.HOME + '/.sfdx/blake.winkler@servioconsulting.com.json')
    let student = JSON.parse(rawdata)
    console.log(student)
    break
  case 'l':
    execute('list')
    break
  default:
    console.log(chalk.blue('Survail : Personal Management System'))
}