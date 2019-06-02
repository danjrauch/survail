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

function add(ret_val){
  console.log(chalk.blue(ret_val.result.rowCount) + ' task(s) inserted ' + chalk.green('successfully.'))
}

function del(ret_val){
  console.log(chalk.blue(ret_val.result.rowCount) + ' task(s) deleted ' + chalk.green('successfully.'))
}

function digest(ret_val){
  const N = ret_val.tasksDueToday.length + ret_val.tasksDueTomorrow.length
  console.log(`Today is ${new Date().getMonth()+1}.${new Date().getDate()}.${new Date().getFullYear()} and you have ${N == 0 ? 'nothing due soon.' : N + ' tasks due soon.'}`)
  if(N > 0) 
    console.log(`You have ${ret_val.tasksDueToday.length} tasks due today and ${ret_val.tasksDueTomorrow.length} due tomorrow.`)
  if(ret_val.tasksDueToday.length > 0){
    console.log('Jobs due today:')
    ret_val.tasksDueToday.forEach(e => {
      console.log(chalk.gray(e.id) + ' ' + chalk.blueBright(e.name) + ' ' + (e.description !== null ? chalk.redBright(e.description) : ''))
    })
  }
  if(ret_val.tasksDueTomorrow.length > 0){
    console.log('Jobs due tomorrow:')
    ret_val.tasksDueTomorrow.forEach(e => {
      console.log(chalk.gray(e.id) + ' ' + chalk.blueBright(e.name) + ' ' + (e.description !== null ? chalk.redBright(e.description) : ''))
    })
  }
}

function list(ret_val){
  ret_val.tasks.forEach(e => {
    let dueString = ''
    if(e.daysbetween == 0)
      dueString = chalk.green('due today')
    else if(e.daysbetween > 0)
      dueString = e.daysbetween == 1 ? chalk.whiteBright(`due in 1 day`) : chalk.whiteBright(`due in ${e.daysbetween <= 5 ? chalk.magentaBright(e.daysbetween) : e.daysbetween} days`)
    else
      dueString = chalk.red('overdue')
    console.log(chalk.gray(e.id) + ' ' + chalk.blueBright(e.name) + ' ' + (e.description !== null ? chalk.redBright(e.description) + ' ' : '') + dueString + ' ' +
                chalk.gray((new Date(e.due_time).getMonth()+1) + '.' + new Date(e.due_time).getDate() + '.' + new Date(e.due_time).getFullYear()))
  })
}

async function execute(type, ...args) {
  const client = redis.createClient(redis_url)
  const res = await fetch(server_url + '/job', {method: 'POST',
                                                body: JSON.stringify({type:type, args:args}),
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
        if(type == 'add') add(ret_val)
        else if(type == 'delete') del(ret_val)
        else if(type == 'digest') digest(ret_val)
        else if(type == 'list') list(ret_val)
      }else
        console.log(chalk.blue(ret_val.code + ' => ') + chalk.red(ret_val.reason))
      client.quit()
      break
    }
    // else if(job.state != 'active')
    //   console.log(job.id + ' -> ' + job.progress + ' -> ' + job.state)
    sleep(1)
  }
}

switch(args[0]){
  case 'add':
  case 'a':
    execute('add', args[1], args[2])
    break
  case 'delete':
  case 'd':
    execute('delete', args.slice(1))
    break
  case 'list':
  case 'l':
    execute('list')
    break
  case 'digest':
    execute('digest')
    break
  default:
    console.log(chalk.blue('Survail : Personal Management System'))
}