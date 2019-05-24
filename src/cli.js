#!/usr/bin/env node

const chalk = require('chalk')
const fetch = require('node-fetch')
const bluebird = require('bluebird')
const redis = require('redis')
bluebird.promisifyAll(redis.RedisClient.prototype)
require('dotenv').config()

const server_url = process.env.ENV == 'PROD' ? process.env.PROD_SERVER_URL : process.env.LOCAL_SERVER_URL
const redis_url = process.env.ENV == 'PROD' ? process.env.PROD_REDIS_URL : process.env.LOCAL_REDIS_URL
const client = redis.createClient(redis_url)

const [,, ...args] = process.argv

function msleep(n) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, n)
}

function sleep(n) {
  msleep(n*1000)
}

async function addJob(type, ...args) {
  const res = await fetch(server_url + '/job', {method: 'POST', 
                                                body: JSON.stringify({type:type}), 
                                                headers: {'Content-Type': 'application/json'}})
  const job = await res.json()
  return job.id
}

async function reportOnJob(id) {
  while(true){
    const res = await fetch(server_url + `/job/${id}`)
    const job = await res.json()
    if(job.state == 'completed'){
      const obj = await client.hgetallAsync('bull:work:' + id)
      JSON.parse(obj.returnvalue).scratchOrgs.forEach(e => console.log(chalk.blue(e)))
      JSON.parse(obj.returnvalue).nonScratchOrgs.forEach(e => console.log(chalk.magenta(e)))
      client.quit()
      break
    }
    if(job.state != 'active'){
      console.log(job.id + ' -> ' + job.progress + ' -> ' + job.state)
    }
    sleep(2)
  }
}

if(args[0] == 'a') {
  addJob('auth').then(id => {
    reportOnJob(id)
  })
}
else if(args[0] == 'l') {
  addJob('list').then(id => {
    reportOnJob(id)
  })
}