// Starts the Express API (port 4000) and the Vite dev server (port 5173)
// together, without adding a `concurrently` dependency.
import { spawn } from 'node:child_process'

const jobs = [
  spawn('node', ['server/index.js'], { stdio: 'inherit' }),
  spawn('npx', ['vite'], { stdio: 'inherit', shell: true }),
]

const kill = () => jobs.forEach((j) => j.kill())
process.on('SIGINT', () => { kill(); process.exit(0) })
process.on('SIGTERM', () => { kill(); process.exit(0) })
