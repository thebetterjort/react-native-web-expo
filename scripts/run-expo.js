process.env.EXPO_LOCAL = true

const packageJson = require('../package.json')
const { expo: appInfo } = require('../app.json')

const qs = require('qs')
const express = require('express')
const bodyParser = require('body-parser')
const proxy = require('http-proxy-middleware')
const { Config, Project, ProjectSettings, ProjectUtils, UrlUtils } = require('xdl')
const cwd = process.cwd()

Config.offline = true

const opts = {
  maxWorkers: 2,
  reset: false
}

const { HOSTNAME = '' } = process.env
const parts = HOSTNAME.split('-')

const codesandboxId = parts[parts.length - 1]
const codesandboxHost = `${codesandboxId}.sse.codesandbox.io`
const codesandboxUrl = `https://${codesandboxHost}`
const expoUrl = `exp://${codesandboxHost}`

const welcomeBody = `
  <html>
    <head>
      <style>
        .container {
          position: absolute;
          top: 0; right: 0; left: 0; bottom: 0;
          padding: 1em;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: rgb(0, 0, 32);
        }

        h1 {
          text-align: center;
          font-size: 16px;
          font-weight: 400;
          font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol";
          color: white;
          margin: 18px 0;
        }

        a {
          color: inherit;
          text-decoration: underline;
        }

        code {
          font-family: dm, "Dank Mono", "Fira Code", "Fira Mono", monospace;
        }

        #qr {
          padding: 1em;
          background: white;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>
          Open
            <a target="_blank" href="${expoUrl}"><code>${expoUrl}</code></a>
          in Expo!
        </h1>
        <div id="qr"></div>
        <h1>
          <a target="_blank" href="https://itunes.apple.com/app/apple-store/id982107779?pt=17102800&amp;ct=www&amp;mt=8">Get iOS App.</a>
          <a target="_blank" href="https://play.google.com/store/apps/details?id=host.exp.exponent">Get Android app.</a>
          <br />
          <small>(On iOS you can enter the URL above into Safari)</small>
        </h1>
      </div>
      <script src="https://davidshimjs.github.io/qrcodejs/qrcode.min.js"></script>
      <script>
        var qrUrl = 'exp://${codesandboxHost}';
        new QRCode(document.getElementById("qr"), qrUrl);
      </script>
    </body>
  </html>
`

const app = express()

app.use(bodyParser.json({ limit: '10mb' }))
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }))

app.get('/', async (req, res) => {
  const referer = req.get('referer') || ''
  if (referer.includes('codesandbox.io')) {
    return res.status(200).send(welcomeBody)
  }

  const { exp: manifest } = await ProjectUtils.readConfigJsonAsync(cwd)
  const platform = req.headers['exponent-platform'] || 'ios'

  manifest.xde = true
  manifest.developer = { tool: null, projectRoot: cwd }
  manifest.env = {}

  manifest.packagerOpts = {
    urlType: 'http',
    hostType: 'tunnel',
    lanType: 'hostname',
    dev: true,
    minify: false,
    urlRandomness: null
  }

  const queryParams = await UrlUtils.constructBundleQueryParamsAsync(
    cwd,
    manifest.packagerOpts,
    codesandboxHost
  )

  manifest.bundleUrl = [
    codesandboxUrl,
    '/node_modules/expo/AppEntry.bundle?',
    `platform=${platform}&`,
    queryParams
  ].join('')

  manifest.debuggerHost = codesandboxHost
  manifest.hostUri = codesandboxHost
  manifest.logUrl = null
  manifest.mainModuleName = packageJson.main
  manifest.name = appInfo.name
  manifest.orientation = appInfo.orientation
  manifest.slug = appInfo.slug

  manifest.id = `@anonymous/${manifest.slug}-${codesandboxId}`

  res.status(200).json(manifest)
})

const proxyMiddleware = proxy({
  target: 'http://localhost:19001',
  logLevel: 'warn',
  changeOrigin: true
})

app.use('*', proxyMiddleware)
app.listen(8080)

const delay = (d = 1000) => new Promise(resolve => setTimeout(resolve, d))
;(async () => {
  console.log(`Hello from CodeSandbox SSE ${codesandboxId}...`)
  console.log(`Starting Expo on ${codesandboxUrl}...`)

  try {
    await delay(1000) // Attempt not to confuse CodeSandbox with 19001 port
    const start$ = Project.startReactNativeServerAsync(cwd, opts)

    ProjectUtils.attachLoggerStream(cwd, {
      stream: {
        write: chunk => {
          if (chunk.tag !== 'metro' && chunk.tag !== 'expo') {
            return
          }

          if (typeof chunk.msg === 'string' && chunk.msg[0] !== '{') {
            console.log(chunk.msg)
          }
        }
      },
      type: 'raw'
    })

    await start$
    console.log('Expo is ready to serve requests!')
  } catch (err) {
    console.error(err)
  }
})()

process.on('exit', async () => {
  await Project.stopReactNativeServerAsync(cwd)
})
