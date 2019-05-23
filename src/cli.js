#!/usr/bin/env node

const chalk = require('chalk')
const fetch = require('node-fetch')

const [,, ...args] = process.argv

console.log(args)

async function addJob() {
  let res = await fetch('http://localhost:5000/job', {method: 'POST'})
  let job = await res.json()
  return job.id
}

if(args[0] == 't'){
  addJob().then(value => { 
    
   })
}