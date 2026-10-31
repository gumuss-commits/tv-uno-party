/**
 * TV UNO - Online Cloudflare Quick Tunnel Launcher
 * Creates an instant, globally accessible HTTPS website with zero account/login needed.
 */

const { spawn } = require('child_process');
const http = require('http');

const LOCAL_PORT = process.env.PORT || 3000;

// Helper to check if server is already responding
function checkServerReady(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/api/network`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function start() {
  console.log('⏳ TV UNO sunucusu kontrol ediliyor...');

  const isAlreadyRunning = await checkServerReady(LOCAL_PORT);
  let serverProcess = null;

  if (!isAlreadyRunning) {
    console.log('🚀 TV UNO yerel sunucusu başlatılıyor...');
    serverProcess = spawn('node', ['server/server.js'], {
      stdio: 'inherit',
      shell: true,
      env: process.env
    });

    // Wait for server to come up
    let attempts = 0;
    while (attempts < 15) {
      await new Promise(r => setTimeout(r, 600));
      if (await checkServerReady(LOCAL_PORT)) break;
      attempts++;
    }
  } else {
    console.log('✅ Yerel sunucu zaten aktif (Port ' + LOCAL_PORT + ').');
  }

  console.log('🌐 İnternet tüneli (Cloudflare HTTPS) kuruluyor...');
  console.log('   (Lütfen birkaç saniye bekleyin, herkese açık link oluşturuluyor...)');

  // Spawn cloudflared quick tunnel
  const cloudflared = spawn('npx', ['--yes', 'cloudflared', 'tunnel', '--url', `http://localhost:${LOCAL_PORT}`], {
    shell: true
  });

  let publicUrlFound = false;

  const handleOutput = (data) => {
    const text = data.toString();

    // Look for https://*.trycloudflare.com
    const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
    if (match && !publicUrlFound) {
      publicUrlFound = true;
      const publicUrl = match[0];

      console.log('\n' + '='.repeat(64));
      console.log('🎉 TV UNO OYUNU İNTERNETTE CANLI YAYINDA (ONLINE)!');
      console.log('='.repeat(64));
      console.log(`🌐 WEB SİTESİ ADRESİ: ${publicUrl}`);
      console.log(`📺 TV EKRANI:          ${publicUrl}/tv`);
      console.log(`📱 TELEFON GİRİŞ:      ${publicUrl}/play`);
      console.log('='.repeat(64));
      console.log('✨ AYNI WI-FI AĞINDA OLMAYA GEREK YOK!');
      console.log('   Arkadaşlarınıza bu linki atabilir veya TV ekranındaki QR kodu');
      console.log('   herhangi bir telefonla (4G/5G dahil) okutabilirsiniz.\n');
    }
  };

  cloudflared.stdout.on('data', handleOutput);
  cloudflared.stderr.on('data', handleOutput);

  cloudflared.on('close', (code) => {
    console.log('Tünel kapatıldı. (Kod:', code, ')');
    if (serverProcess) serverProcess.kill();
    process.exit(code || 0);
  });

  // Handle clean exit
  const cleanup = () => {
    console.log('\nKapatılıyor...');
    cloudflared.kill();
    if (serverProcess) serverProcess.kill();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

start().catch(err => {
  console.error('Hata:', err);
  process.exit(1);
});
