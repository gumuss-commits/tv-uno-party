# 🎴 TV UNO Party - Büyük Ekran & Akıllı Telefon UNO Oyunu

Televizyonunuzu büyük bir oyun masasına, akıllı telefonlarınızı ise gizli elinizi tuttuğunuz interaktif birer kontrolcüye dönüştüren profesyonel UNO oyunu! (Jackbox / AirConsole tarzı).

---

## 🌟 Öne Çıkan Özellikler

### 📺 TV Ekranı (Sunucu / Masa Görünümü)
- **1080p & 4K Optimize:** 3-5 metre mesafeden koltuktan rahatça okunabilir büyük tipografi ve canlı grafikler.
- **Dinamik Ortam Aydınlatması:** Masadaki aktif renge (Kırmızı, Mavi, Yeşil, Sarı) göre tüm TV arka planı ambient glow ile renk değiştirir.
- **3D Kart Masası & Yön Yörüngesi:** Oyun yönünü gösteren dönen dairesel halka (Saat yönü / Saat yönünün tersi). Yön değiştirildiğinde yön anında tersine döner!
- **Gerçekçi Deste:** Katmanlı 3D çekme destesi ve atılan kartların hafif açılı gerçekçi dağılımı.
- **Canlı Oyuncu Koltukları:** Masanın etrafında her oyuncunun avatarı, kalan kart sayısı, "Sıra Sende" halesi ve konuşma balonları ("UNO! 🔥", "+4 ATTI! 💥", "PAS ⛔").
- **QR Kod ile Anında Katılım:** TV ekranındaki QR kodu telefonun kamerasıyla okutan herkes saniyeler içinde odaya katılır.
- **Yapay Zeka (Bot) Desteği:** TV ekranından tek tıkla `+ Bot Ekle` diyerek tek başınıza veya eksik kişi varken zeki botlarla oynayabilirsiniz!
- **Kutlama Efektleri:** Kazanan belirlendiğinde tüm TV ekranını kaplayan altın kupa ve konfeti animasyonu.
- **Dahili Web Audio API Ses Efektleri:** Harici mp3 dosyası gerektirmeyen, sıfır gecikmeli sentezlenmiş kart fırlatma, yön değiştirme, siren ve zafer sesleri.

### 📱 Telefon Ekranı (Oyuncu Kontrolcüsü)
- **Gizli El Görünümü:** Kartlarınızı sadece kendi telefonunuzda görürsünüz.
- **Yukarı Kaydırarak TV'ye Fırlatma (Swipe Up):** Kartınızı parmağınızla yukarı doğru kaydırarak TV masasına fırlatabilirsiniz! (Dilerseniz tek dokunuşla da oynayabilirsiniz).
- **Akıllı Kart Vurgulama:** Oynanabilir kartlar parlar ve hafif yukarı kalkar; geçersiz kartlar soluklaşır.
- **Haptik Titreşim Geri Bildirimi:** Sıra size geldiğinde, kart attığınızda ve UNO dediğinizde telefonunuz titrer.
- **Ekran Uyanık Tutucu (Wake Lock):** Oyun boyunca telefon ekranının kapanmasını/kararmasını önler.
- **Joker Renk Seçim Çarkı:** 4 büyük dokunmatik butonla kolay renk seçimi (Kırmızı, Mavi, Yeşil, Sarı).
- **"🔥 UNO!" Butonu:** 1 veya 2 kartınız kaldığında parlayan dev UNO butonu.
- **"⚡ UNO YAKALA!" Butonu:** Rakip 1 kartı kaldığında UNO demeyi unutursa yakalayıp 2 ceza kartı çekmesini sağlayan yakalama butonu.
- **Kopma Koruması:** Telefon kilitlense veya sekme değişse bile oturumu ve elinizi korur.

---

## 🚀 Hızlı Başlangıç

### 1. Yerel Ağda (Aynı Wi-Fi) Başlatma
Terminalde şu komutu çalıştırın:

```bash
npm start
```

---

### 🌐 2. İnternete Açma (Dünya Çapında Online Oynama)
Aynı Wi-Fi'da olmaya gerek kalmadan, arkadaşlarınızla internet üzerinden (mobil veri / 4G / 5G / farklı şehirler) oynamak için:

```bash
npm run online
```

Bu komut otomatik olarak küresel ve güvenli bir **Cloudflare HTTPS** web linki oluşturur:
```
================================================================
🎉 TV UNO OYUNU İNTERNETTE CANLI YAYINDA (ONLINE)!
================================================================
🌐 WEB SİTESİ ADRESİ: https://spiritual-products-therapeutic-julian.trycloudflare.com
📺 TV EKRANI:          https://spiritual-products-therapeutic-julian.trycloudflare.com/tv
📱 TELEFON GİRİŞ:      https://spiritual-products-therapeutic-julian.trycloudflare.com/play
================================================================
```
- TV'de `.../tv` linkini açın.
- Oyuncular dünyanın neresinde olursa olsun `.../play` linkinden veya TV'deki QR kodu okutarak bağlanabilir!

---

### ☁️ 3. Kalıcı 7/24 Ücretsiz Web Sitesi Kurulumu (Render / Railway)
Bilgisayarınız kapalıyken bile oyunun 7/24 internette bir web sitesi olarak kalmasını isterseniz:

1. Bu projeyi **GitHub**'a yükleyin.
2. [render.com](https://render.com) adresine ücretsiz üye olun.
3. **New +** -> **Web Service** seçeneğine tıklayıp GitHub reponuzu bağlayın.
4. Ayarlar:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. **Create Web Service** butonuna basın! Render size kalıcı olarak `https://tv-uno-party.onrender.com` gibi ücretsiz bir web sitesi adresi verir. Proje içerisindeki `render.yaml` ve dinamik origin sistemi her şeyi otomatik ayarlar.

---

### 2. Televizyonda Açma
- Televizyonunuzun dahili web tarayıcısını (Samsung Smart TV, LG webOS, Android TV, vb.) açın veya TV'ye bağlı bilgisayar/HDMI üzerinden `http://<BİLGİSAYAR-IP>:3000/tv` adresine girin.
- Sağ üstteki `⛶ Tam Ekran` butonuna basarak tam ekrana geçin.

### 3. Telefonlarla Katılma
- Telefonunuzun aynı Wi-Fi ağına bağlı olduğundan emin olun.
- Telefon kamerasını TV ekranındaki **QR Koda** tutun ve linke tıklayın.
- Ya da telefon tarayıcınızdan `http://<IP>:3000/play` adresine girip TV'deki 4 haneli **Oda Kodunu** yazın.
- İsminizi, avatarınızı ve renginizi seçip **"ODAYA KATIL"** butonuna basın.

### 4. Oyunu Başlatma
- En az 2 kişi (veya 1 oyuncu + Bot) olduğunda TV ekranındaki **"OYUNU BAŞLAT"** butonuna basın ve partinin tadını çıkarın!

---

## 📜 UNO Kuralları & Dinamikler

1. **Renk ve Numara Eşleme:** Masadaki en üst kartla aynı renkte veya aynı sembol/numarada bir kart atabilirsiniz.
2. **Ceza Kartı Biriktirme (Stacking):** +2 veya +4 atıldığında sonraki oyuncu da +2 veya +4 atarak cezayı katlayabilir! Karşılayamayan oyuncu biriken tüm kartları çeker.
3. **Özel Aksiyon Kartları:**
   - **Pas (Skip):** Sonraki oyuncunun sırasını atlatır.
   - **Yön Değiştir (Reverse):** Oyun yönünü tersine çevirir. (2 kişilik oyunda Pas gibi davranır).
   - **+2 (Draw 2):** Sonraki oyuncuya 2 kart çektirir.
   - **Joker (Wild):** Masanın rengini istediğiniz renge dönüştürür.
   - **Joker +4 (Wild Draw 4):** Hem rengi değiştirir hem de 4 kart ceza verir!
4. **UNO Kuralı:** Elinizde tek kart kaldığında veya son kartınızı atmadan önce **"🔥 UNO!"** butonuna basmalısınız. Eğer basmayı unutursanız diğer oyuncular **"⚡ UNO YAKALA!"** butonuna basarak size 2 ceza kartı çektirebilir!
