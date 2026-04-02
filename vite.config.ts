import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? ''
const isUserOrOrgPagesRepo = repositoryName.endsWith('.github.io')
const githubPagesBase =
  process.env.GITHUB_ACTIONS === 'true' && repositoryName !== ''
    ? isUserOrOrgPagesRepo
      ? '/'
      : `/${repositoryName}/`
    : '/'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: githubPagesBase,
})
