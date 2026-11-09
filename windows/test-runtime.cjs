const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || require.resolve('playwright', {paths:[path.resolve(__dirname,'../provas-dcer')]}));
const { createHmac } = require('node:crypto');
const assert = require('node:assert/strict');
function totp(secret) {
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bits=[...secret.trim()].map(c=>alphabet.indexOf(c).toString(2).padStart(5,'0')).join('');
  const bytes=[]; for(let i=0;i+8<=bits.length;i+=8) bytes.push(parseInt(bits.slice(i,i+8),2));
  const counter=Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));
  const digest=createHmac('sha1',Buffer.from(bytes)).update(counter).digest();
  const offset=digest[19]&15;
  return String((digest.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,'0');
}
(async()=>{
  const url=process.argv[2] || 'https://localhost:33443';
  const browser=await chromium.launch({channel:'msedge',headless:true});
  const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1366,height:900}});
  const page=await context.newPage();
  try {
    const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    await page.goto(url+'/admin/login');
    await page.locator('input[name="email"]').fill(process.argv[3] || 'admin@dcer.local');
    await page.locator('input[name="password"]').fill(process.env.WINDOWS_TEST_PASSWORD || 'dcerpaulista');
    await page.locator('form').filter({has:page.locator('input[name="password"]')}).locator('button').click();
    await page.waitForURL('**/admin/mfa/configurar');
    const secret=await page.locator('p.font-mono').innerText();
    await page.locator('input[name="code"]').fill(totp(secret));
    await page.getByRole('button',{name:'Ativar MFA',exact:true}).click();
    await page.waitForURL('**/admin');
    assert.equal((await context.cookies()).find(c=>c.name==='provas_admin').secure,true);
    console.log('LOGIN_AND_MFA_OK');
    await page.goto(url+'/admin/sistema');
    assert.equal(await page.locator('h1').innerText(),'Sistema');
    assert.equal(await page.locator('input[name="password"]').inputValue(),'');
    console.log('WINDOWS_SYSTEM_SMTP_PAGE_OK');
    await page.screenshot({path:path.resolve('build/windows/validation-desktop.png'),fullPage:true});
    await page.goto(url+'/admin/seguranca');
    assert.equal((await page.locator('h1').innerText()).includes('Seguranca'),true);
    const response=await context.request.get(url+'/admin/seguranca/backup');
    assert.equal(response.ok(),true,'Backup HTTP '+response.status());
    assert.equal(response.headers()['content-type'],'application/gzip','Backup retornou pagina de erro: '+response.url());
    console.log('BACKUP_OK');
    if(process.env.TEST_BADGE==='1') {
      const badge=await context.request.get(url+'/admin/eventos/win-test-event/inscricoes/win-test-registration/cracha');
      assert.equal(badge.status(),200);
      assert.equal((await badge.body()).subarray(0,4).toString(),'%PDF');
      console.log('BADGE_PDF_QR_OK');
    }
    await page.setViewportSize({width:390,height:844});
    await page.goto(url+'/prova');
    await page.screenshot({path:path.resolve('build/windows/validation-mobile.png'),fullPage:true});
    assert.deepEqual(errors,[]);
    console.log('BROWSER_VALIDATION_OK');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
