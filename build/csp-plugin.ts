import type { Plugin } from 'vite'
import { createHash } from 'node:crypto'

// The only external origin the app may talk to.
const CONNECT_SRC = 'https://api.todoist.com'

function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('base64')
}

/**
 * Runs AFTER vite-plugin-singlefile has inlined every script/style into the
 * final index.html. We hash each inline <script> body and emit a strict CSP
 * <meta> that locks script execution to exactly those hashes — so even an
 * injected <script> (XSS) cannot run and exfiltrate the decrypted token.
 *
 * Only applied to the production bundle; the dev server keeps its normal
 * (HMR-friendly) CSP-free behaviour.
 */
export function cspPlugin(): Plugin {
  return {
    name: 'inline-csp',
    enforce: 'post',
    generateBundle(_options, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type !== 'asset' || !file.fileName.endsWith('.html')) continue

        let html =
          typeof file.source === 'string'
            ? file.source
            : Buffer.from(file.source).toString('utf8')

        const scriptHashes = new Set<string>()
        const scriptRe = /<script\b[^>]*>([\s\S]*?)<\/script>/gi
        for (const m of html.matchAll(scriptRe)) {
          const body = m[1]
          if (body && body.trim().length) scriptHashes.add(`'sha256-${sha256(body)}'`)
        }

        const csp = [
          `default-src 'none'`,
          `script-src ${[...scriptHashes].join(' ') || `'none'`}`,
          // Inline <style> blocks + element style attributes (uPlot/Svelte).
          `style-src 'self' 'unsafe-inline'`,
          `img-src 'self' data:`,
          `connect-src ${CONNECT_SRC}`,
          `base-uri 'none'`,
          `form-action 'none'`,
          `frame-ancestors 'none'`,
        ].join('; ')

        const meta = `<meta http-equiv="Content-Security-Policy" content="${csp}">`
        html = /<head[^>]*>/i.test(html)
          ? html.replace(/<head([^>]*)>/i, `<head$1>\n    ${meta}`)
          : meta + html

        file.source = html
      }
    },
  }
}
